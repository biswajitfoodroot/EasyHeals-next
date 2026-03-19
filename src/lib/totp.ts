/**
 * TOTP Utilities — RFC 6238 (Time-Based One-Time Password)
 *
 * Pure Node.js implementation — no external packages.
 * Used for admin/owner 2FA (G-TOTP gate, HLD §8.2).
 *
 * Compatible with Google Authenticator, Authy, and any standard TOTP app.
 *
 * Algorithm:
 *   TOTP(K, T) = HOTP(K, floor(time / 30))
 *   HOTP(K, C) = Truncate(HMAC-SHA1(K, C)) mod 10^6
 */

import { createHash, createHmac, randomBytes } from "crypto";

// ─── Base32 ───────────────────────────────────────────────────────────────────

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += B32[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(str: string): Buffer {
  const s = str.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of s) {
    const idx = B32.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ─── HOTP core ────────────────────────────────────────────────────────────────

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);

  // Counter as 8-byte big-endian buffer
  const buf = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }

  const hmac = createHmac("sha1", key).update(buf).digest();

  // Dynamic truncation (RFC 4226 §5.4)
  const offset = hmac[19] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % 1_000_000).padStart(6, "0");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Generate a new base32-encoded TOTP secret (160 bits). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/**
 * Build the otpauth:// URI for QR code generation.
 * Compatible with Google Authenticator, Authy, etc.
 */
export function generateTotpUri(secret: string, email: string, issuer = "EasyHeals Admin"): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(email)}`;
  return (
    `otpauth://totp/${label}` +
    `?secret=${secret}` +
    `&issuer=${encodeURIComponent(issuer)}` +
    `&algorithm=SHA1&digits=6&period=30`
  );
}

/**
 * Verify a 6-digit TOTP code against a secret.
 * Accepts codes from current window ± `window` steps (default ±1 = ±30s drift).
 */
export function verifyTotpToken(secret: string, token: string, window = 1): boolean {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const clean = token.replace(/\s/g, "");
  for (let delta = -window; delta <= window; delta++) {
    if (hotp(secret, counter + delta) === clean) return true;
  }
  return false;
}

/**
 * Generate 8 one-time recovery codes (format: XXXX-XXXX-XXXX).
 * Store SHA-256 hashes in DB — never store raw codes.
 */
export function generateRecoveryCodes(): string[] {
  return Array.from({ length: 8 }, () => {
    const bytes = randomBytes(6).toString("hex").toUpperCase();
    return `${bytes.slice(0, 4)}-${bytes.slice(4, 8)}-${bytes.slice(8, 12)}`;
  });
}

/** Hash a recovery code for secure DB storage. */
export function hashRecoveryCode(code: string): string {
  const normalized = code.replace(/-/g, "").toUpperCase();
  return createHash("sha256").update(normalized).digest("hex");
}

/** Check if a submitted code matches any stored recovery code hash. */
export function matchRecoveryCode(submitted: string, storedHashes: string[]): number {
  const hash = hashRecoveryCode(submitted);
  return storedHashes.findIndex((h) => h === hash);
}
