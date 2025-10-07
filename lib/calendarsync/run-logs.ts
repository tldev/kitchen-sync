import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join, relative, resolve } from "path";

const DEFAULT_LOG_DIRECTORY = join(process.cwd(), "calendarsync-data", "logs");

function getLogDirectory(): string {
  return process.env.CALENDARSYNC_LOG_DIR?.trim() || DEFAULT_LOG_DIRECTORY;
}

async function ensureParentDirectoryExists(filePath: string): Promise<void> {
  const directory = dirname(filePath);
  await mkdir(directory, { recursive: true });
}

export function getCalendarSyncLogDirectory(): string {
  return getLogDirectory();
}

export async function writeRunLog(
  jobId: string,
  runId: string,
  content: string,
): Promise<string> {
  const logDirectory = getLogDirectory();
  const relativePath = join(jobId, `${runId}.log`);
  const absolutePath = resolve(logDirectory, relativePath);

  const normalizedDirectory = resolve(logDirectory);
  if (relative(normalizedDirectory, absolutePath).startsWith("..")) {
    throw new Error("Resolved log path escapes the configured log directory.");
  }

  await ensureParentDirectoryExists(absolutePath);
  await writeFile(absolutePath, content, "utf8");

  return relativePath;
}

export async function readRunLog(location: string): Promise<string> {
  const logDirectory = getLogDirectory();
  const absolutePath = resolve(logDirectory, location);
  const normalizedDirectory = resolve(logDirectory);

  if (relative(normalizedDirectory, absolutePath).startsWith("..")) {
    throw new Error("Resolved log path escapes the configured log directory.");
  }

  return readFile(absolutePath, "utf8");
}

