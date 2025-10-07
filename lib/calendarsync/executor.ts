import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { access, mkdtemp, rm, writeFile } from "fs/promises";
import { constants as fsConstants } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import YAML from "yaml";

export const DEFAULT_CALENDARSYNC_BINARY =
  process.env.CALENDARSYNC_BINARY ?? "/usr/local/bin/calendarsync";

export interface CalendarSyncConfig {
  [key: string]: unknown;
}

export interface CalendarSyncExecutionOptions {
  /**
   * Path to the CalendarSync executable. Defaults to the value baked into the container image.
   */
  binaryPath?: string;
  /**
   * Raw configuration mapped to the CalendarSync YAML schema.
   */
  config: CalendarSyncConfig;
  /**
   * Optional environment overrides for the spawned process.
   */
  env?: NodeJS.ProcessEnv;
  /**
   * Receives stdout log chunks as they are produced by the CLI.
   */
  onStdout?: (chunk: string) => void;
  /**
   * Receives stderr log chunks as they are produced by the CLI.
   */
  onStderr?: (chunk: string) => void;
  /**
   * Abort signal to cancel execution. A SIGTERM is sent to the child process on abort.
   */
  signal?: AbortSignal | null;
  /**
   * Persist the generated configuration file for debugging instead of removing it when the process finishes.
   */
  keepConfigFile?: boolean;
  /**
   * Allows callers to override the base temporary directory used for config generation.
   */
  workingDirectory?: string;
}

export interface CalendarSyncExecutionResult {
  /** Exit code returned by the CalendarSync CLI. */
  exitCode: number | null;
  /** Signal used to terminate the process, if applicable. */
  signal: NodeJS.Signals | null;
  /** Combined stdout output captured during execution. */
  stdout: string;
  /** Combined stderr output captured during execution. */
  stderr: string;
  /** Elapsed time for the run in milliseconds. */
  durationMs: number;
  /** Absolute path to the YAML configuration file used for the run. */
  configPath: string;
  /** Path to the CalendarSync binary that was invoked. */
  binaryPath: string;
  /** Indicates whether the CLI exited successfully. */
  success: boolean;
}

export class CalendarSyncExecutionError extends Error {
  public readonly cause?: unknown;

  constructor(
    public readonly result: CalendarSyncExecutionResult,
    options?: { cause?: unknown },
  ) {
    super(
      `CalendarSync execution failed with exit code ${result.exitCode} and signal ${result.signal}`,
    );
    this.name = "CalendarSyncExecutionError";
    this.cause = options?.cause;
  }
}

export class CalendarSyncBinaryNotFoundError extends Error {
  public readonly cause?: unknown;

  constructor(public readonly binaryPath: string, options?: { cause?: unknown }) {
    super(
      `CalendarSync binary is not executable or missing at path: ${binaryPath}. Ensure the container image bundles the binary or pass a custom path via CALENDARSYNC_BINARY.`,
    );
    this.name = "CalendarSyncBinaryNotFoundError";
    this.cause = options?.cause;
  }
}

/**
 * Generates a CalendarSync YAML configuration and executes the CLI, streaming logs to the provided callbacks.
 *
 * @throws CalendarSyncBinaryNotFoundError when the binary is not present or executable.
 * @throws CalendarSyncExecutionError when the CLI exits with a non-zero exit code.
 */
export async function runCalendarSync({
  binaryPath = DEFAULT_CALENDARSYNC_BINARY,
  config,
  env,
  onStdout,
  onStderr,
  signal,
  keepConfigFile = false,
  workingDirectory,
}: CalendarSyncExecutionOptions): Promise<CalendarSyncExecutionResult> {
  await ensureBinaryIsExecutable(binaryPath);

  const baseDir = workingDirectory ?? tmpdir();
  const tempDir = await mkdtemp(join(baseDir, "calendarsync-"));
  const configPath = join(tempDir, `${randomUUID()}.yaml`);
  const yamlContent = YAML.stringify(config);
  await writeFile(configPath, yamlContent, "utf8");

  const startTime = Date.now();
  const child = spawn(binaryPath, ["--config", configPath], {
    env: {
      ...process.env,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  const abortSignal = signal ?? null;
  const abortHandler = () => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  };
  if (abortSignal) {
    if (abortSignal.aborted) {
      abortHandler();
    } else {
      abortSignal.addEventListener("abort", abortHandler, { once: true });
    }
  }

  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");

  child.stdout?.on("data", (chunk: string) => {
    stdout += chunk;
    onStdout?.(chunk);
  });

  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
    onStderr?.(chunk);
  });

  try {
    const result = await new Promise<CalendarSyncExecutionResult>((resolve, reject) => {
      child.once("error", async (error) => {
        try {
          await cleanupTempFiles(tempDir, keepConfigFile);
        } finally {
          reject(error);
        }
      });

      child.once("close", async (code, termSignal) => {
        const durationMs = Date.now() - startTime;
        const executionResult: CalendarSyncExecutionResult = {
          exitCode: code,
          signal: termSignal,
          stdout,
          stderr,
          durationMs,
          configPath,
          binaryPath,
          success: code === 0,
        };

        let cleanupError: unknown;
        try {
          await cleanupTempFiles(tempDir, keepConfigFile);
        } catch (error) {
          cleanupError = error;
        }

        if (executionResult.success) {
          if (cleanupError) {
            reject(cleanupError as Error);
            return;
          }

          resolve(executionResult);
        } else {
          const executionError = new CalendarSyncExecutionError(executionResult, {
            cause: cleanupError,
          });
          reject(executionError);
        }
      });
    });

    return result;
  } finally {
    if (abortSignal) {
      abortSignal.removeEventListener("abort", abortHandler);
    }
  }
}

async function ensureBinaryIsExecutable(binaryPath: string): Promise<void> {
  try {
    await access(binaryPath, fsConstants.X_OK);
  } catch (error) {
    throw new CalendarSyncBinaryNotFoundError(binaryPath, { cause: error });
  }
}

async function cleanupTempFiles(directory: string, keepConfigFile: boolean): Promise<void> {
  if (keepConfigFile) {
    return;
  }

  await rm(directory, { recursive: true, force: true });
}
