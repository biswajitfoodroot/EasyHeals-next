/**
 * OTP Module — generation, hashing, verification
 *
 * Generates 6-digit OTPs and stores bcrypt hashes in the DB.
 * Comparison is done with bcrypt to prevent timing attacks on hash comparisons.
 *
 * OTP flow:
 *   1. generateOTP() → raw 6-digit string (sent to user via SMS)
 *   2. hashOTP(raw) → bcrypt hash (stored in DB)
 *   3. verifyOTP(raw, hash) → boolean (called on submission)
 */

import bcrypt from "bcryptjs";
import { randomInt } from "crypto";

const BCRYPT_ROUNDS = 10;
const OTP_LENGTH = 6;

/**
 * Generate a cryptographically random 6-digit OTP string.
 * Returns a zero-padded string, e.g. "042817"
 */
export function generateOTP(): string {
  const max = Math.pow(10, OTP_LENGTH);
  const otp = randomInt(0, max);
  return otp.toString().padStart(OTP_LENGTH, "0");
}

/**
 * Hash an OTP with bcrypt (10 rounds).
 * Store this hash in DB — never the raw OTP.
 */
export async function hashOTP(otp: string): Promise<string> {
  return bcrypt.hash(otp, BCRYPT_ROUNDS);
}

/**
 * Verify a raw OTP against a stored bcrypt hash.
 * Returns false (not throws) on mismatch or error.
 */
export async function verifyOTP(otp: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(otp, hash);
  } catch {
    return false;
  }
}
