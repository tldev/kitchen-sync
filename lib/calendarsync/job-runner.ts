import { JobRunStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CalendarSyncBinaryNotFoundError,
  CalendarSyncExecutionError,
  type CalendarSyncConfig,
  runCalendarSync,
} from "./executor";
import { writeRunLog } from "./run-logs";
import { buildCliConfig } from "@/lib/yaml-preview";
import { writeAuthStorageFile } from "./auth-storage";
import { writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { mkdtemp, rm } from "fs/promises";
import { randomUUID } from "crypto";

const LOG_PREFIX = "[sync-job-runner]";

type JobRunnerLogger = Partial<Pick<Console, "debug" | "info" | "warn" | "error">>;

type JobRunWithRelations = Prisma.JobRunGetPayload<{
  include: {
    job: {
      include: {
        sourceCalendar: {
          include: {
            account: true;
          };
        };
        destinationCalendar: {
          include: {
            account: true;
          };
        };
      };
    };
  };
}>;

interface ProcessPendingJobRunsOptions {
  logger?: JobRunnerLogger;
}

export interface ProcessPendingJobRunsResult {
  processed: number;
  succeeded: number;
  failed: number;
}

export async function processPendingJobRuns(
  options: ProcessPendingJobRunsOptions = {},
): Promise<ProcessPendingJobRunsResult> {
  const logger = options.logger ?? console;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  while (true) {
    const claimed = await claimNextPendingRun();
    if (!claimed) {
      break;
    }

    processed += 1;

    try {
      const success = await executeRun(claimed, logger);
      if (success) {
        succeeded += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      failed += 1;
      logger.error?.(`${LOG_PREFIX} unexpected error while executing job run ${claimed.run.id}`, error);
    }
  }

  if (processed === 0) {
    logger.debug?.(`${LOG_PREFIX} no pending job runs found.`);
  }

  return { processed, succeeded, failed };
}

async function claimNextPendingRun(): Promise<{ run: JobRunWithRelations } | null> {
  return prisma.$transaction(
    async (tx) => {
      while (true) {
        const run = await tx.jobRun.findFirst({
          where: {
            status: JobRunStatus.PENDING,
          },
          orderBy: {
            createdAt: "asc",
          },
          include: {
            job: {
              include: {
                sourceCalendar: {
                  include: {
                    account: true,
                  },
                },
                destinationCalendar: {
                  include: {
                    account: true,
                  },
                },
              },
            },
          },
        });

        if (!run) {
          return null;
        }

        const startedAt = new Date();
        const updated = await tx.jobRun.updateMany({
          where: {
            id: run.id,
            status: JobRunStatus.PENDING,
          },
          data: {
            status: JobRunStatus.RUNNING,
            startedAt,
          },
        });

        if (updated.count === 0) {
          continue;
        }

        run.status = JobRunStatus.RUNNING;
        run.startedAt = startedAt;
        return { run };
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

async function executeRun(
  claimed: { run: JobRunWithRelations },
  logger: JobRunnerLogger,
): Promise<boolean> {
  const { run } = claimed;
  const job = run.job;
  const startTime = new Date();

  let message = "";
  let success = false;
  let stdout = "";
  let stderr = "";
  let exitCode: number | null = null;
  let signal: NodeJS.Signals | null = null;
  let binaryPath: string | undefined;
  let durationMs = 0;
  let logLocation: string | null = null;
  let tempDir: string | undefined;

  try {
    // Create temp directory for this run
    tempDir = await mkdtemp(join(tmpdir(), `calendarsync-${randomUUID()}-`));
    const authStoragePath = join(tempDir, "auth-storage.yaml");

    // Check if both accounts have auth storage
    const sourceAuthStorage = job.sourceCalendar.account.calendarSyncAuthStorage;
    const destAuthStorage = job.destinationCalendar.account.calendarSyncAuthStorage;

    if (!sourceAuthStorage && !destAuthStorage) {
      throw new Error(
        "Neither source nor destination account has CalendarSync auth storage configured. " +
        "Please set up auth storage for at least one account."
      );
    }

    // If accounts are different and both have auth storage, we need to merge them
    // If same account or only one has storage, use whichever is available
    let authStorageContent: string;
    if (job.sourceCalendar.accountId === job.destinationCalendar.accountId) {
      // Same account - use its auth storage
      authStorageContent = sourceAuthStorage || destAuthStorage || "";
    } else if (sourceAuthStorage && destAuthStorage) {
      // Different accounts, both have storage - we'll use source's for now
      // TODO: Merge both auth storages if needed
      logger.warn?.(
        `${LOG_PREFIX} Both source and destination accounts have auth storage. Using source account's storage.`
      );
      authStorageContent = sourceAuthStorage;
    } else {
      // One has storage, use it
      authStorageContent = sourceAuthStorage || destAuthStorage || "";
    }

    // Write auth storage to temp file
    await writeAuthStorageFile(authStoragePath, authStorageContent);

    // Build config with auth storage path
    const config = buildCalendarSyncConfig(job, authStoragePath);

    const result = await runCalendarSync({
      config,
      workingDirectory: tempDir,
      onStdout: (chunk) => {
        stdout += chunk;
      },
      onStderr: (chunk) => {
        stderr += chunk;
      },
    });

    success = result.success;
    stdout = result.stdout;
    stderr = result.stderr;
    exitCode = result.exitCode;
    signal = result.signal;
    durationMs = result.durationMs;
    binaryPath = result.binaryPath;
    message = `CalendarSync completed successfully in ${result.durationMs}ms.`;
  } catch (error) {
    const failureDetails = extractFailureDetails(error);
    success = false;
    message = failureDetails.message;
    stdout = failureDetails.stdout ?? stdout;
    stderr = failureDetails.stderr ?? stderr;
    exitCode = failureDetails.exitCode ?? exitCode;
    signal = failureDetails.signal ?? signal;
    durationMs = failureDetails.durationMs ?? durationMs;
    binaryPath = failureDetails.binaryPath ?? binaryPath;
  } finally {
    // Clean up temp directory
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        logger.warn?.(`${LOG_PREFIX} Failed to clean up temp directory ${tempDir}`, error);
      }
    }
  }

  try {
    const logContent = formatLogContent({
      jobId: job.id,
      jobName: job.name,
      runId: run.id,
      startedAt: run.startedAt ?? startTime,
      finishedAt: new Date(),
      status: success ? JobRunStatus.SUCCESS : JobRunStatus.FAILED,
      message,
      stdout,
      stderr,
      exitCode,
      signal,
      binaryPath,
      durationMs,
    });

    logLocation = await writeRunLog(job.id, run.id, logContent);
  } catch (error) {
    logger.error?.(`${LOG_PREFIX} failed to persist logs for job run ${run.id}`, error);
    logLocation = null;
  }

  const finishedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.jobRun.update({
      where: { id: run.id },
      data: {
        status: success ? JobRunStatus.SUCCESS : JobRunStatus.FAILED,
        finishedAt,
        message,
        logLocation,
      },
    });

    await tx.syncJob.update({
      where: { id: job.id },
      data: {
        lastRunAt: finishedAt,
      },
    });
  });

  if (success) {
    logger.info?.(`${LOG_PREFIX} completed job run ${run.id} for job ${job.id}.`);
  } else {
    logger.warn?.(`${LOG_PREFIX} job run ${run.id} for job ${job.id} failed: ${message}`);
  }

  return success;
}

function extractFailureDetails(
  error: unknown,
): {
  message: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
  durationMs?: number;
  binaryPath?: string;
} {
  if (error instanceof CalendarSyncExecutionError) {
    const { result } = error;
    
    // Include stderr in the message for better debugging
    let message = `CalendarSync exited with code ${result.exitCode ?? "unknown"}.`;
    if (result.stderr && result.stderr.trim()) {
      // Get last few lines of stderr for the message (keep it concise)
      const stderrLines = result.stderr.trim().split('\n');
      const lastLines = stderrLines.slice(-3).join('\n');
      message += `\n\nError output:\n${lastLines}`;
    }
    
    return {
      message,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      signal: result.signal,
      durationMs: result.durationMs,
      binaryPath: result.binaryPath,
    };
  }

  if (error instanceof CalendarSyncBinaryNotFoundError) {
    return {
      message: error.message,
      binaryPath: error.binaryPath,
    };
  }

  if (error instanceof Error) {
    return {
      message: `CalendarSync execution failed: ${error.message}`,
    };
  }

  return {
    message: "CalendarSync execution failed due to an unknown error.",
  };
}

function buildCalendarSyncConfig(
  job: JobRunWithRelations["job"],
  authStoragePath: string
): CalendarSyncConfig {
  const transformers = extractConfigArray(job.config, "transformers");
  const filters = extractConfigArray(job.config, "filters");

  // Build CLI-compatible config
  return buildCliConfig({
    sourceCalendarId: job.sourceCalendar.googleCalendarId,
    sourceAccountId: job.sourceCalendar.account.providerAccountId,
    destinationCalendarId: job.destinationCalendar.googleCalendarId,
    destinationAccountId: job.destinationCalendar.account.providerAccountId,
    transformers,
    filters,
    authStoragePath,
  });
}

function extractConfigArray(
  config: Prisma.JsonValue | null,
  key: "transformers" | "filters",
): CalendarSyncConfig[] {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return [];
  }

  const record = config as Record<string, unknown>;
  const value = record[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is CalendarSyncConfig => Boolean(item && typeof item === "object"));
}

function formatLogContent(details: {
  jobId: string;
  jobName: string;
  runId: string;
  startedAt: Date;
  finishedAt: Date;
  status: JobRunStatus;
  message: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  binaryPath?: string;
  durationMs: number;
}): string {
  const lines = [
    `${LOG_PREFIX} Job ${details.jobId} (${details.jobName}) run ${details.runId}`,
    `Started at: ${details.startedAt.toISOString()}`,
    `Finished at: ${details.finishedAt.toISOString()}`,
    `Status: ${details.status}`,
    `Message: ${details.message}`,
    `Duration: ${details.durationMs}ms`,
    `Exit code: ${details.exitCode ?? "n/a"}`,
    `Signal: ${details.signal ?? "n/a"}`,
    `Binary: ${details.binaryPath ?? "unknown"}`,
    "",
    "---- STDOUT ----",
    details.stdout ? details.stdout.trimEnd() : "<empty>",
    "",
    "---- STDERR ----",
    details.stderr ? details.stderr.trimEnd() : "<empty>",
    "",
  ];

  return lines.join("\n");
}

