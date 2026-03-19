/**
 * PHI Encryption Module — AES-256-GCM + phone hashing
 *
 * encryptPhone / decryptPhone — AES-256-GCM with ENCRYPTION_KEY env var
 * hashPhone — HMAC-SHA-256 with PHONE_SALT (stable, never changes after first patient row)
 * hashDeviceFp — SHA-256 of device fingerprint (no salt needed, not PHI)
 *
 * WARNING: Never change PHONE_SALT after the first patient row is written.
 *          Salt change = all existing phoneHash values become unmatchable.
 */

import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes } from "crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;  // 96 bits — GCM standard
const TAG_LENGTH = 16; // 128 bits
const KEY_VERSION_SEPARATOR = ":";

function getKeyBuffer(): Buffer {
  if (!env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set — cannot encrypt PHI");
  }
  return Buffer.from(env.ENCRYPTION_KEY, "hex");
}

/**
 * Encrypt a phone number (or any short string) with AES-256-GCM.
 * Output format: `{version}:{base64(iv+ciphertext+tag)}`
 *
 * Example: "v1:abc123..."
 */
export function encryptPhone(phone: string): string {
  const key = getKeyBuffer();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(phone, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, encrypted, tag]).toString("base64");
  return `${env.ENCRYPTION_KEY_VERSION}${KEY_VERSION_SEPARATOR}${payload}`;
}

/**
 * Decrypt a phone number encrypted with encryptPhone().
 */
export function decryptPhone(ciphertext: string): string {
  const separatorIdx = ciphertext.indexOf(KEY_VERSION_SEPARATOR);
  if (separatorIdx === -1) {
    throw new Error("Invalid ciphertext format — missing version separator");
  }

  const payload = Buffer.from(ciphertext.slice(separatorIdx + 1), "base64");
  const key = getKeyBuffer();

  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(payload.length - TAG_LENGTH);
  const encrypted = payload.subarray(IV_LENGTH, payload.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Stable HMAC-SHA-256 hash of a phone number using PHONE_SALT.
 * Used as the lookup key for patients — never changes after first write.
 *
 * Input phone should be in E.164 format: +91XXXXXXXXXX
 */
export function hashPhone(phone: string): string {
  if (!env.PHONE_SALT) {
    throw new Error("PHONE_SALT is not set — cannot hash phone");
  }
  return createHmac("sha256", env.PHONE_SALT)
    .update(phone.trim())
    .digest("hex");
}

/**
 * SHA-256 hash of a device fingerprint string.
 * No salt needed — device fps are not reversible PHI on their own.
 */
export function hashDeviceFp(fp: string): string {
  return createHash("sha256").update(fp).digest("hex");
}
