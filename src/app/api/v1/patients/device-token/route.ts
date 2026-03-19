/**
 * POST /api/v1/patients/device-token   — register FCM device token
 * DELETE /api/v1/patients/device-token — unregister device token
 *
 * P3 Day 4 — FCM push notification device registration.
 *
 * Auth:   eh_patient_session cookie (OTP-verified)
 * Store:  Redis key patient:devices:{patientId} → JSON array (max 5 tokens per patient)
 *         TTL: 30 days (renewed on each register call)
 *
 * Platform: "android" | "ios" | "web"
 *
 * No DB migration needed — device tokens are ephemeral and managed in Redis.
 * A DB column (deviceTokens) can be added later if persistence beyond Redis is needed.
 */

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { redisGet, redisSet, redisDel } from "@/lib/core/redis";

const DEVICE_TOKEN_TTL = 30 * 24 * 60 * 60; // 30 days
const MAX_TOKENS_PER_PATIENT = 5;

interface PatientSession { patientId: string; phoneHash: string; }
interface DeviceTokenEntry {
  token: string;
  platform: "android" | "ios" | "web";
  registeredAt: string; // ISO
}

async function requirePatientSession(req: NextRequest): Promise<PatientSession> {
  const rawToken = req.cookies.get("eh_patient_session")?.value;
  if (!rawToken) throw new AppError("AUTH_SESSION_EXPIRED", "No patient session", "Please verify your phone to continue.", 401);
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const session = await redisGet<PatientSession>(`patient:session:${tokenHash}`);
  if (!session) throw new AppError("AUTH_SESSION_EXPIRED", "Session expired", "Your session has expired.", 401);
  return session;
}

const registerSchema = z.object({
  token: z.string().min(10).max(500),
  platform: z.enum(["android", "ios", "web"]),
});

const unregisterSchema = z.object({
  token: z.string().min(10).max(500),
});

// ── POST — register device token ──────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);
  const { patientId } = session;

  const payload = await req.json().catch(() => null);
  if (!payload) throw new AppError("SYS_UNHANDLED", "Invalid body", "Invalid request body", 400);

  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Validation error", 400);
  }

  const { token, platform } = parsed.data;
  const key = `patient:devices:${patientId}`;

  // Load existing tokens
  const existing = (await redisGet<DeviceTokenEntry[]>(key)) ?? [];

  // Remove duplicate (same token, different platform or timestamp)
  const deduplicated = existing.filter((e) => e.token !== token);

  // Enforce max tokens per patient (keep newest)
  const capped = deduplicated.slice(-(MAX_TOKENS_PER_PATIENT - 1));

  const updated: DeviceTokenEntry[] = [
    ...capped,
    { token, platform, registeredAt: new Date().toISOString() },
  ];

  await redisSet(key, updated, DEVICE_TOKEN_TTL);

  return NextResponse.json({
    data: { registered: true, platform, tokenCount: updated.length },
  }, { status: 200 });
});

// ── DELETE — unregister device token ─────────────────────────────────────────

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);
  const { patientId } = session;

  const payload = await req.json().catch(() => null);
  if (!payload) throw new AppError("SYS_UNHANDLED", "Invalid body", "Invalid request body", 400);

  const parsed = unregisterSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", "Invalid token", 400);
  }

  const { token } = parsed.data;
  const key = `patient:devices:${patientId}`;

  const existing = (await redisGet<DeviceTokenEntry[]>(key)) ?? [];
  const filtered = existing.filter((e) => e.token !== token);

  if (filtered.length === 0) {
    await redisDel(key);
  } else {
    await redisSet(key, filtered, DEVICE_TOKEN_TTL);
  }

  return NextResponse.json({
    data: { unregistered: true, remaining: filtered.length },
  });
});
