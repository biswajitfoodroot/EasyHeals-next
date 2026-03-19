/**
 * OTP Authentication Routes (Task 3.3)
 *
 * POST /api/v1/auth/otp/send   → sends OTP via notification provider
 * POST /api/v1/auth/otp/verify → verifies OTP, creates patient + Redis session
 *
 * Rate limits (enforced per phoneHash):
 *   - Max 3 OTP sends per phone per 10 min → 1h lockout on 4th attempt
 *
 * Session: Redis key patient:session:{token} → JSON (TTL 24h)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { otpVerifications, patients } from "@/db/schema";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { generateOTP, hashOTP, verifyOTP } from "@/lib/security/otp";
import { hashPhone, encryptPhone } from "@/lib/security/encryption";
import { getNotificationProvider } from "@/lib/notifications";
import { redisGet, redisSet, redisIncr } from "@/lib/core/redis";
import { createPatientSession } from "@/lib/core/patient-session";

// ── Schemas ──────────────────────────────────────────────────────────────────

const sendSchema = z.object({
  phone: z
    .string()
    .min(8)
    .max(20)
    .regex(/^\+?\d[\d\s\-()]+$/, "Invalid phone format"),
  lang: z.enum(["en", "hi", "mr", "ta", "te", "kn", "bn"]).default("en"),
});

const verifySchema = z.object({
  phone: z.string().min(8).max(20),
  otp: z.string().length(6).regex(/^\d{6}$/),
  city: z.string().optional(),
});

// ── OTP Rate Limit helpers ────────────────────────────────────────────────────

const OTP_MAX_PER_10MIN = 3;
const OTP_WINDOW_SECONDS = 600; // 10 minutes
const OTP_LOCKOUT_SECONDS = 3600; // 1 hour

async function checkOTPRateLimit(phoneHash: string): Promise<void> {
  // Check lockout key first
  const lockoutKey = `rate:otp:lockout:${phoneHash}`;
  const lockedOut = await redisGet<string>(lockoutKey);
  if (lockedOut) {
    throw new AppError(
      "RATE_OTP_FLOOD",
      "OTP rate limit lockout active",
      "Too many attempts. Please try again after 1 hour.",
      429,
    );
  }

  // Increment sliding window counter
  const countKey = `rate:otp:${phoneHash}:${Math.floor(Date.now() / (OTP_WINDOW_SECONDS * 1000))}`;
  const count = await redisIncr(countKey, OTP_WINDOW_SECONDS);

  if (count !== null && count > OTP_MAX_PER_10MIN) {
    // Trigger lockout
    await redisSet(lockoutKey, "1", OTP_LOCKOUT_SECONDS);
    throw new AppError(
      "RATE_OTP_FLOOD",
      "OTP flood limit triggered",
      "Too many attempts. Please try again after 1 hour.",
      429,
    );
  }
}

// ── POST /api/v1/auth/otp  (action determined by body.action) ──────────────

async function handleSend(req: NextRequest): Promise<Response> {
  const payload = await req.json().catch(() => null);
  if (!payload) throw new AppError("SYS_UNHANDLED", "Invalid body", "Invalid request body", 400);

  const parsed = sendSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Invalid phone", 400);
  }

  const { phone, lang } = parsed.data;
  const phoneHash = hashPhone(phone);

  // Rate limit check
  await checkOTPRateLimit(phoneHash);

  // Generate + hash OTP
  const otp = generateOTP();
  const otpHash = await hashOTP(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Invalidate any existing OTP for this phone
  await db
    .update(otpVerifications)
    .set({ usedAt: new Date() })
    .where(eq(otpVerifications.phoneHash, phoneHash));

  // Insert new OTP record
  await db.insert(otpVerifications).values({
    phoneHash,
    otpHash,
    expiresAt,
    channel: "sms",
  });

  // Send via notification provider
  const notifier = getNotificationProvider();
  await notifier.sendOTP(phone, otp, lang);

  return NextResponse.json({
    message: "OTP sent",
    expiresAt: expiresAt.toISOString(),
  });
}

async function handleVerify(req: NextRequest): Promise<Response> {
  const payload = await req.json().catch(() => null);
  if (!payload) throw new AppError("SYS_UNHANDLED", "Invalid body", "Invalid request body", 400);

  const parsed = verifySchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", "Invalid OTP format", 400);
  }

  const { phone, otp, city } = parsed.data;
  const phoneHash = hashPhone(phone);

  // Find latest OTP record for this phone
  const records = await db
    .select()
    .from(otpVerifications)
    .where(eq(otpVerifications.phoneHash, phoneHash))
    .orderBy(otpVerifications.createdAt)
    .limit(1);

  if (!records.length) {
    throw new AppError("AUTH_OTP_EXPIRED", "No OTP found", "No OTP was sent for this phone. Please request a new one.", 401);
  }

  const record = records[records.length - 1];

  if (record.usedAt) {
    throw new AppError("AUTH_OTP_EXPIRED", "OTP already used", "This OTP has already been used. Please request a new one.", 401);
  }

  if (new Date() > record.expiresAt) {
    throw new AppError("AUTH_OTP_EXPIRED", "OTP expired", "This OTP has expired. Please request a new one.", 401);
  }

  const valid = await verifyOTP(otp, record.otpHash);
  if (!valid) {
    throw new AppError("AUTH_INVALID_TOKEN", "Invalid OTP", "Incorrect OTP. Please check and try again.", 401);
  }

  // Mark OTP as used
  await db
    .update(otpVerifications)
    .set({ usedAt: new Date() })
    .where(eq(otpVerifications.id, record.id));

  // Find or create patient by phone hash
  const existingPatients = await db
    .select({ id: patients.id, deletedAt: patients.deletedAt })
    .from(patients)
    .where(eq(patients.phoneHash, phoneHash))
    .limit(1);

  let patientId: string;

  if (existingPatients.length > 0) {
    const existing = existingPatients[0];
    if (existing.deletedAt) {
      throw new AppError("AUTH_FORBIDDEN", "Account deleted", "This account has been deleted. Please contact support.", 403);
    }
    patientId = existing.id;
    // Update city if provided
    if (city) {
      await db.update(patients).set({ city }).where(eq(patients.id, patientId));
    }
  } else {
    const [newPatient] = await db
      .insert(patients)
      .values({ phoneHash, city: city ?? null })
      .returning({ id: patients.id });
    patientId = newPatient.id;
  }

  // P2 — encrypt phone for WA delivery; store in patients table (one-time write)
  let phoneEncrypted: string | null = null;
  try {
    phoneEncrypted = encryptPhone(phone);
    await db
      .update(patients)
      .set({ phoneEncrypted })
      .where(eq(patients.id, patientId));
  } catch {
    // Non-fatal — ENCRYPTION_KEY may not be set in local dev; WA delivery will be skipped
    phoneEncrypted = null;
  }

  // Create patient session (Redis if configured, SQLite DB fallback for local dev)
  const response = NextResponse.json({
    patientId,
    message: "Phone verified successfully",
  });

  await createPatientSession(
    {
      patientId,
      phoneHash,
      phoneEncrypted,
      city: city ?? null,
      lang: "en",
      consentPurposes: [],
    },
    response,
  );

  return response;
}

// ── Route handler dispatchers ─────────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  // Distinguish send vs verify by URL path suffix
  const url = new URL(req.url);
  const path = url.pathname;

  if (path.endsWith("/send")) return handleSend(req);
  if (path.endsWith("/verify")) return handleVerify(req);

  throw new AppError("SYS_UNHANDLED", "Unknown OTP action", "Unknown OTP action", 404);
});
