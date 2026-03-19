/**
 * src/lib/emr/index.ts
 *
 * P3 — EMR module entry point (ARCHITECTURE.md §A.1, §A.2).
 *
 * ISOLATION RULE: This module and all files in src/lib/emr/*
 * MUST NOT import from any other src/lib/* module.
 * It will become a separate deploy unit at P4.
 *
 * Allowed imports:
 *   ✅  src/db/emr-client.ts    (infra, not a lib module)
 *   ✅  src/db/emr-schema.ts    (infra, not a lib module)
 *   ✅  Node.js built-ins (crypto, etc.)
 *   ❌  src/lib/auth.ts         — forbidden
 *   ❌  src/lib/security/*      — forbidden
 *   ❌  src/lib/notifications/* — forbidden
 *
 * EMR route handlers ARE allowed to call other lib/* modules
 * (they live in src/app/api/, not src/lib/emr/).
 *
 * Exports:
 *   isEmrAvailable()  — checks feature flag + DB connection
 *   emrEncrypt()      — AES-256-GCM encrypt for PHI storage
 *   emrDecrypt()      — AES-256-GCM decrypt PHI from DB
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { emrDb } from "@/db/emr-client";

// ── Feature flag check ─────────────────────────────────────────────────────
// NOTE: Cannot use src/lib/config/feature-flags (isolation rule).
// Reads EH_FLAG_EMR_LITE env var directly (deploy-time override only).
// DB-level flag check happens inside the route handler via a direct import.

export function isEmrConfigured(): boolean {
  return !!process.env.NEON_DATABASE_URL && emrDb !== null;
}

// ── EMR Encryption ─────────────────────────────────────────────────────────
// Separate key from ENCRYPTION_KEY — EMR PHI has its own key rotation schedule.
// Key format: 32-byte hex string (64 hex chars)
// Generate: openssl rand -hex 32

const EMR_KEY_HEX = process.env.EMR_ENCRYPTION_KEY ?? "";

function getEmrKey(): Buffer {
  if (!EMR_KEY_HEX || EMR_KEY_HEX.length < 64) {
    throw new Error("EMR_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate: openssl rand -hex 32");
  }
  return Buffer.from(EMR_KEY_HEX, "hex");
}

/**
 * Encrypt a PHI string for EMR storage.
 * Output format: "iv_b64:authTag_b64:ciphertext_b64"
 *
 * Example:
 *   const encrypted = emrEncrypt(JSON.stringify(diagnosisArray));
 *   // store in visit_records.diagnosis_encrypted
 */
export function emrEncrypt(plaintext: string): string {
  const key = getEmrKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a PHI string from EMR storage.
 * Expects format: "iv_b64:authTag_b64:ciphertext_b64"
 *
 * Returns null if decryption fails (key mismatch, tampered data).
 */
export function emrDecrypt(encrypted: string): string | null {
  try {
    const key = getEmrKey();
    const [ivB64, authTagB64, ciphertextB64] = encrypted.split(":");
    if (!ivB64 || !authTagB64 || !ciphertextB64) return null;

    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Encrypt a value only if EMR_ENCRYPTION_KEY is configured.
 * In local dev without the key set, stores plaintext with a "dev:" prefix.
 * NEVER use dev mode in production.
 */
export function emrEncryptSafe(plaintext: string): string {
  if (!EMR_KEY_HEX) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("EMR_ENCRYPTION_KEY must be set in production");
    }
    return `dev:${plaintext}`;
  }
  return emrEncrypt(plaintext);
}

/**
 * Decrypt a value encrypted by emrEncryptSafe.
 */
export function emrDecryptSafe(stored: string): string | null {
  if (stored.startsWith("dev:")) {
    return stored.slice(4);
  }
  return emrDecrypt(stored);
}

// ── Re-exports for route handlers ─────────────────────────────────────────
export { emrDb } from "@/db/emr-client";
export type { EmrDb } from "@/db/emr-client";
export * from "@/db/emr-schema";
