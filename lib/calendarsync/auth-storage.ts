import { spawn } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import YAML from "yaml";

/**
 * CalendarAuth structure matching CalendarSync's Go struct
 */
interface CalendarAuth {
  CalendarID: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expiry?: string; // ISO 8601 timestamp
}

/**
 * Storage file structure matching CalendarSync's format
 */
interface StorageFile {
  Calendars: CalendarAuth[];
}

export interface AccountTokens {
  /** Google calendar ID (e.g., email or calendar@group.calendar.google.com) */
  calendarId: string;
  /** Decrypted access token from NextAuth */
  accessToken: string;
  /** Decrypted refresh token from NextAuth */
  refreshToken: string;
  /** Token expiry timestamp (Unix seconds) */
  expiresAt?: number;
}

/**
 * Creates an auth-storage.yaml file in CalendarSync's expected format,
 * encrypted using the AGE encryption tool.
 * 
 * This function:
 * 1. Creates the YAML structure CalendarSync expects
 * 2. Uses the `age` CLI tool to encrypt with CALENDARSYNC_ENCRYPTION_KEY
 * 3. Returns the encrypted content as a string (to store in database)
 * 
 * @param accounts - Array of account tokens to include in auth storage
 * @returns Base64-encoded encrypted auth storage file content
 */
export async function createAuthStorageFile(accounts: AccountTokens[]): Promise<string> {
  const encryptionKey = process.env.CALENDARSYNC_ENCRYPTION_KEY;
  
  if (!encryptionKey) {
    throw new Error(
      "Missing CALENDARSYNC_ENCRYPTION_KEY environment variable. This key is required to encrypt auth storage for CalendarSync CLI."
    );
  }

  // Build CalendarSync's auth storage structure
  const storageFile: StorageFile = {
    Calendars: accounts.map((account) => ({
      CalendarID: account.calendarId,
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      token_type: "Bearer",
      expiry: account.expiresAt
        ? new Date(account.expiresAt * 1000).toISOString()
        : undefined,
    })),
  };

  // Convert to YAML
  const yamlContent = YAML.stringify(storageFile, {
    lineWidth: 0,
    indent: 2,
  });

  // Encrypt using age CLI tool with passphrase
  const encryptedContent = await encryptWithAge(yamlContent, encryptionKey);
  
  return encryptedContent;
}

/**
 * Encrypts content using the age CLI tool with a passphrase.
 * 
 * @param content - Plain text content to encrypt
 * @param passphrase - Encryption passphrase
 * @returns Encrypted content (age armor format)
 */
async function encryptWithAge(content: string, passphrase: string): Promise<string> {
  const tempInputFile = join(tmpdir(), `age-input-${randomUUID()}.txt`);
  const tempOutputFile = join(tmpdir(), `age-output-${randomUUID()}.age`);

  try {
    // Write content to temp file
    await writeFile(tempInputFile, content, "utf8");

    // Run age encryption with passphrase
    await new Promise<void>((resolve, reject) => {
      const age = spawn("age", [
        "--encrypt",
        "--passphrase",
        "--output",
        tempOutputFile,
        tempInputFile,
      ], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Write passphrase to stdin
      age.stdin.write(passphrase + "\n");
      age.stdin.write(passphrase + "\n"); // age asks for confirmation
      age.stdin.end();

      let stderr = "";
      age.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      age.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`age encryption failed with code ${code}: ${stderr}`));
        }
      });

      age.on("error", (error) => {
        reject(new Error(`Failed to spawn age command: ${error.message}`));
      });
    });

    // Read encrypted content
    const encryptedContent = await readFile(tempOutputFile, "utf8");
    return encryptedContent;

  } finally {
    // Clean up temp files
    try {
      await unlink(tempInputFile);
    } catch (error) {
      // Ignore cleanup errors
    }
    try {
      await unlink(tempOutputFile);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Writes an auth storage file to disk for CalendarSync to use.
 * 
 * @param authStoragePath - Path where to write the auth storage file
 * @param encryptedContent - Encrypted auth storage content (from createAuthStorageFile)
 */
export async function writeAuthStorageFile(
  authStoragePath: string,
  encryptedContent: string
): Promise<void> {
  await writeFile(authStoragePath, encryptedContent, "utf8");
}

/**
 * Checks if the age encryption tool is available.
 * 
 * @returns true if age command is available, false otherwise
 */
export async function isAgeAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const age = spawn("age", ["--version"]);
    
    age.on("close", (code) => {
      resolve(code === 0);
    });
    
    age.on("error", () => {
      resolve(false);
    });
  });
}

