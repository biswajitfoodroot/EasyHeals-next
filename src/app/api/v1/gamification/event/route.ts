/**
 * POST /api/v1/gamification/event
 *
 * P2 Day 3 — Gamification Phase-A event endpoint (HLD §6.1).
 *
 * Records a patient's passive engagement event and awards points.
 * Auth:    eh_patient_session cookie (OTP-verified Redis session)
 * Gate:    gamification_points feature flag (P1 default ON)
 * DPDP:   no PII stored — actorId = patientId (internal UUID only)
 *
 * Phase-A events accepted here (no proof verification required):
 *   PROFILE_COMPLETED    proofId: patientId
 *   CONSENT_GRANTED      proofId: `${patientId}:${purpose}`
 *   NEWS_READ_5          proofId: `${patientId}:${weekISO}`  e.g. "2026-W11"
 *   DAILY_CHECKIN        proofId: `${patientId}:${YYYY-MM-DD}`
 *   PROFILE_PHOTO_ADDED  proofId: patientId
 *   SHARE_PROFILE        proofId: `${patientId}:${YYYY-MM-DD}:${sequence}`
 *
 * Phase-B events (APPOINTMENT_COMPLETED, REVIEW_SUBMITTED) are gated
 * behind `gamification_phase_b` flag and verified via CRM outbox — not handled here.
 *
 * Response:
 *   201  { awarded: true,  points: 10, totalPoints: 120 }
 *   200  { awarded: false, reason: "duplicate"|"daily_cap_reached"|"abuse_flagged" }
 *   403  Feature flag OFF
 */

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { redisGet } from "@/lib/core/redis";
import { getFeatureFlag } from "@/lib/config/feature-flags";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { awardPoints, getActorStats, type PhaseAEventType } from "@/lib/gamification/award";

// ── Patient session ────────────────────────────────────────────────────────

interface PatientSession {
  patientId: string;
  phoneHash: string;
  phoneEncrypted: string | null;
  city: string | null;
  lang: string;
  deviceFpHash?: string;
}

async function requirePatientSession(req: NextRequest): Promise<PatientSession> {
  const rawToken = req.cookies.get("eh_patient_session")?.value;
  if (!rawToken) {
    throw new AppError("AUTH_SESSION_EXPIRED", "No patient session", "Please verify your phone to continue.", 401);
  }
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const session = await redisGet<PatientSession>(`patient:session:${tokenHash}`);
  if (!session) {
    throw new AppError("AUTH_SESSION_EXPIRED", "Session expired", "Your session has expired. Please verify your phone again.", 401);
  }
  return session;
}

// ── Validation ─────────────────────────────────────────────────────────────

const PHASE_A_EVENTS: PhaseAEventType[] = [
  "PROFILE_COMPLETED",
  "CONSENT_GRANTED",
  "NEWS_READ_5",
  "DAILY_CHECKIN",
  "PROFILE_PHOTO_ADDED",
  "SHARE_PROFILE",
];

const eventSchema = z.object({
  eventType: z.enum(PHASE_A_EVENTS as [PhaseAEventType, ...PhaseAEventType[]]),
  proofId: z.string().min(1).max(200),
  proofType: z.string().min(1).max(50).default("self_reported"),
  deviceFpHash: z.string().max(64).optional(),
});

// ── Handler ────────────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  // Feature flag gate
  const enabled = await getFeatureFlag("gamification_points");
  if (!enabled) {
    throw new AppError("SYS_CONFIG_MISSING", "Gamification disabled", "Gamification is not enabled.", 403);
  }

  const session = await requirePatientSession(req);
  const { patientId } = session;

  const body = await req.json().catch(() => null);
  if (!body) throw new AppError("SYS_UNHANDLED", "Invalid body", "Invalid request body", 400);

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Validation error", 400);
  }

  const { eventType, proofId, proofType, deviceFpHash } = parsed.data;

  // Enforce: proofId must contain the patient's own ID to prevent cross-patient forgery
  if (!proofId.startsWith(patientId)) {
    throw new AppError("SYS_UNHANDLED", "Invalid proofId", "proofId must start with your patient ID.", 400);
  }

  const result = await awardPoints({
    actorId: patientId,
    actorType: "patient",
    eventType,
    proofId,
    proofType,
    deviceFpHash: deviceFpHash ?? session.deviceFpHash,
  });

  // Always return current stats alongside the award result
  const stats = await getActorStats(patientId, "patient");

  return NextResponse.json(
    {
      ...result,
      stats,
    },
    { status: result.awarded ? 201 : 200 },
  );
});
