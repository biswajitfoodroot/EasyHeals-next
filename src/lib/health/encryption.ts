/**
 * Health PHI Encryption — AES-256-GCM
 *
 * SEPARATE from src/lib/security/encryption.ts (phone encryption).
 * Uses HEALTH_PHI_ENCRYPTION_KEY — a distinct 32-byte hex key.
 *
 * Never log dataEncrypted field. Never cache decrypted health data in Redis.
 * Key rotation: update HEALTH_PHI_KEY_VERSION and re-encrypt on next patient access (lazy).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;   // 96-bit GCM standard
const TAG_LENGTH = 16;  // 128-bit auth tag
const VERSION_SEP = ":";

function getHealthKey(): Buffer {
  if (!env.HEALTH_PHI_ENCRYPTION_KEY) {
    throw new Error("HEALTH_PHI_ENCRYPTION_KEY not set — cannot encrypt health PHI");
  }
  const buf = Buffer.from(env.HEALTH_PHI_ENCRYPTION_KEY, "hex");
  if (buf.length !== 32) {
    throw new Error("HEALTH_PHI_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  }
  return buf;
}

/**
 * Encrypt any JSON-serializable health data object.
 * Output: `{version}:{base64(iv+ciphertext+tag)}`
 */
export function encryptPHI(data: unknown): string {
  const key = getHealthKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, encrypted, tag]).toString("base64");
  const version = env.HEALTH_PHI_KEY_VERSION ?? "v1";
  return `${version}${VERSION_SEP}${payload}`;
}

/**
 * Decrypt a value produced by encryptPHI().
 * Returns the original object (parsed from JSON).
 */
export function decryptPHI<T = unknown>(ciphertext: string): T {
  const sepIdx = ciphertext.indexOf(VERSION_SEP);
  if (sepIdx === -1) throw new Error("Invalid health PHI ciphertext — missing version");

  const payload = Buffer.from(ciphertext.slice(sepIdx + 1), "base64");
  const key = getHealthKey();

  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(payload.length - TAG_LENGTH);
  const body = payload.subarray(IV_LENGTH, payload.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(body),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(decrypted) as T;
}

/** Returns true if HEALTH_PHI_ENCRYPTION_KEY is configured. */
export function isHealthEncryptionConfigured(): boolean {
  return Boolean(env.HEALTH_PHI_ENCRYPTION_KEY && env.HEALTH_PHI_ENCRYPTION_KEY.length === 64);
}
