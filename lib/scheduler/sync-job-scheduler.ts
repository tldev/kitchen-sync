import cron, { ScheduledTask } from "node-cron";
import { JobRunStatus, Prisma, SyncJobCadence, SyncJobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_CRON_EXPRESSION = "*/1 * * * *";
const LOG_PREFIX = "[sync-job-scheduler]";

type SchedulerLogger = Partial<Pick<Console, "debug" | "info" | "warn" | "error">>;

export interface SyncJobSchedulerOptions {
  cronExpression?: string;
  timezone?: string;
  runOnStartup?: boolean;
  logger?: SchedulerLogger;
}

export interface EnqueueDueJobsOptions {
  now?: Date;
  logger?: SchedulerLogger;
}

declare global {
  // eslint-disable-next-line no-var
  var __syncJobSchedulerTask: ScheduledTask | undefined;
}

function addCadenceInterval(base: Date, cadence: SyncJobCadence): Date {
  const next = new Date(base.getTime());

  switch (cadence) {
    case SyncJobCadence.FIFTEEN_MINUTES: {
      next.setMinutes(next.getMinutes() + 15);
      break;
    }
    case SyncJobCadence.HOURLY: {
      next.setHours(next.getHours() + 1);
      break;
    }
    case SyncJobCadence.DAILY: {
      next.setDate(next.getDate() + 1);
      break;
    }
    default: {
      throw new Error(`Unsupported sync job cadence: ${cadence}`);
    }
  }

  return next;
}

function calculateNextRunAt(
  cadence: SyncJobCadence,
  previousNextRunAt: Date | null,
  now: Date,
): Date {
  const base = previousNextRunAt ?? now;
  let candidate = addCadenceInterval(base, cadence);

  while (candidate <= now) {
    candidate = addCadenceInterval(candidate, cadence);
  }

  return candidate;
}

export async function enqueueDueSyncJobs({
  now = new Date(),
  logger,
}: EnqueueDueJobsOptions = {}): Promise<number> {
  const dueJobs = await prisma.syncJob.findMany({
    where: {
      status: SyncJobStatus.ACTIVE,
      OR: [
        { nextRunAt: null },
        { nextRunAt: { lte: now } },
      ],
    },
    select: {
      id: true,
    },
  });

  let enqueuedCount = 0;

  for (const { id } of dueJobs) {
    try {
      const enqueued = await prisma.$transaction(
        async (tx) => {
          const job = await tx.syncJob.findUnique({
            where: { id },
            select: {
              id: true,
              cadence: true,
              nextRunAt: true,
              status: true,
            },
          });

          if (!job || job.status !== SyncJobStatus.ACTIVE) {
            return false;
          }

          if (job.nextRunAt && job.nextRunAt > now) {
            return false;
          }

          const nextRunAt = calculateNextRunAt(job.cadence, job.nextRunAt, now);

          await tx.jobRun.create({
            data: {
              jobId: job.id,
              status: JobRunStatus.PENDING,
            },
          });

          await tx.syncJob.update({
            where: { id: job.id },
            data: {
              nextRunAt,
            },
          });

          return true;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      if (enqueued) {
        enqueuedCount += 1;
      }
    } catch (error) {
      logger?.error?.(`${LOG_PREFIX} failed to enqueue sync job ${id}`, error);
    }
  }

  return enqueuedCount;
}

export function startSyncJobScheduler(
  options: SyncJobSchedulerOptions = {},
): ScheduledTask {
  if (globalThis.__syncJobSchedulerTask) {
    return globalThis.__syncJobSchedulerTask;
  }

  const logger: SchedulerLogger = options.logger ?? console;
  const cronExpression =
    options.cronExpression ?? process.env.SYNC_JOB_SCHEDULER_CRON ?? DEFAULT_CRON_EXPRESSION;
  const timezone = options.timezone ?? process.env.SYNC_JOB_SCHEDULER_TZ ?? undefined;

  if (!cron.validate(cronExpression)) {
    throw new Error(
      `${LOG_PREFIX} invalid cron expression provided: "${cronExpression}". Update SYNC_JOB_SCHEDULER_CRON or scheduler options.`,
    );
  }

  let tickInFlight = false;

  const task = cron.schedule(
    cronExpression,
    async () => {
      if (tickInFlight) {
        logger.warn?.(`${LOG_PREFIX} previous tick still running, skipping this cycle.`);
        return;
      }

      tickInFlight = true;
      try {
        const enqueued = await enqueueDueSyncJobs({ logger });
        if (enqueued > 0) {
          logger.info?.(
            `${LOG_PREFIX} enqueued ${enqueued} sync job${enqueued === 1 ? "" : "s"} for execution.`,
          );
        } else {
          logger.debug?.(`${LOG_PREFIX} no due sync jobs found during scheduled run.`);
        }
      } catch (error) {
        logger.error?.(`${LOG_PREFIX} failed to enqueue due sync jobs`, error);
      } finally {
        tickInFlight = false;
      }
    },
    {
      scheduled: false,
      timezone,
    },
  );

  task.start();
  globalThis.__syncJobSchedulerTask = task;

  if (options.runOnStartup ?? true) {
    enqueueDueSyncJobs({ logger })
      .then((enqueued) => {
        if (enqueued > 0) {
          logger.info?.(
            `${LOG_PREFIX} enqueued ${enqueued} sync job${enqueued === 1 ? "" : "s"} during startup.`,
          );
        } else {
          logger.debug?.(`${LOG_PREFIX} no due sync jobs found during startup.`);
        }
      })
      .catch((error) => {
        logger.error?.(`${LOG_PREFIX} failed to enqueue due sync jobs during startup`, error);
      });
  }

  return task;
}
