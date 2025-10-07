import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Recommended IV length for GCM
const AUTH_TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const rawKey = process.env.TOKEN_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error(
      "Missing TOKEN_ENCRYPTION_KEY environment variable. Generate a 32-byte key encoded in base64 to encrypt OAuth tokens."
    );
  }

  const decodedKey = decodeKey(rawKey);

  if (decodedKey.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must decode to 32 bytes. Provide a base64 or hex encoded 256-bit key."
    );
  }

  cachedKey = decodedKey;
  return decodedKey;
}

function decodeKey(rawKey: string): Buffer {
  const trimmed = rawKey.trim();

  // Try base64 first
  try {
    const base64 = Buffer.from(trimmed, "base64");
    if (base64.length === 32) {
      return base64;
    }
  } catch (error) {
    // ignore and try hex
  }

  // Fallback to hex decoding
  try {
    const hex = Buffer.from(trimmed, "hex");
    if (hex.length === 32) {
      return hex;
    }
    return hex;
  } catch (error) {
    // ignore and rethrow in loadKey
  }

  return Buffer.from(trimmed);
}

export function encryptToken(value: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptToken(payload: string): string {
  const key = loadKey();
  const buffer = Buffer.from(payload, "base64");

  if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Encrypted payload is too short to contain IV and auth tag");
  }

  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

export function isTokenEncrypted(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    decryptToken(value);
    return true;
  } catch (error) {
    return false;
  }
}
