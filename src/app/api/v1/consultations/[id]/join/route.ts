/**
 * GET /api/v1/consultations/:sessionId/join
 *
 * P3 Day 3 — Returns a participant-specific join URL for an active consultation.
 *
 * Auth:    eh_patient_session (patient) OR admin/doctor session (staff)
 * Gate:    video_consultation feature flag must be ON
 *
 * Response includes:
 *   - joinUrl — signed Jitsi URL (with JWT) or public URL
 *   - roomId  — Jitsi room name
 *   - status  — scheduled | active | ended
 *   - waitingRoom — whether patient must wait for doctor to admit
 *
 * Also marks participant.joinedAt = now (first join) and updates session status
 * to "active" when the first participant joins.
 */

import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import {
  consultationSessions,
  consultationParticipants,
  consultationRoomConfigs,
} from "@/db/schema";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { getFeatureFlag } from "@/lib/config/feature-flags";
import { requireAuth } from "@/lib/auth";
import { redisGet } from "@/lib/core/redis";
import { buildParticipantJoinUrl } from "@/lib/consultations/jitsi";

interface PatientSession {
  patientId: string;
  phoneHash: string;
}

export const GET = withErrorHandler(async (
  req: NextRequest,
  ctx?: { params: Promise<Record<string, string>> },
) => {
  if (!await getFeatureFlag("video_consultation")) {
    throw new AppError("SYS_CONFIG_MISSING", "Video consultation not available", "Video consultation is not yet enabled.", 503);
  }

  const { id: sessionId } = await ctx!.params;

  // Fetch session
  const sessionRows = await db
    .select()
    .from(consultationSessions)
    .where(eq(consultationSessions.id, sessionId))
    .limit(1);

  if (!sessionRows.length) {
    throw new AppError("DB_NOT_FOUND", "Session not found", "Consultation session not found.", 404);
  }

  const session = sessionRows[0];

  if (session.status === "ended") {
    throw new AppError("SYS_UNHANDLED", "Session ended", "This consultation has already ended.", 410);
  }

  if (!session.roomId) {
    throw new AppError("SYS_UNHANDLED", "Room not ready", "The consultation room is not yet ready.", 503);
  }

  // Determine who is joining: patient session or staff session
  let actorId: string;
  let actorType: "patient" | "user";
  let participantName: string;
  let isModerator: boolean;

  const rawToken = req.cookies.get("eh_patient_session")?.value;
  if (rawToken) {
    // Patient joining
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const patientSession = await redisGet<PatientSession>(`patient:session:${tokenHash}`);
    if (!patientSession) {
      throw new AppError("AUTH_SESSION_EXPIRED", "Session expired", "Your session has expired. Please verify your phone again.", 401);
    }
    actorId = patientSession.patientId;
    actorType = "patient";
    participantName = "Patient";
    isModerator = false;
  } else {
    // Staff joining (doctor, admin)
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    if (!["owner", "admin", "advisor", "doctor"].includes(auth.role)) {
      throw new AppError("AUTH_FORBIDDEN", "Forbidden", "Insufficient permissions.", 403);
    }
    actorId = auth.entityId ?? auth.userId;
    actorType = "user";
    participantName = auth.fullName ?? "Doctor";
    isModerator = auth.role === "doctor" || auth.role === "admin" || auth.role === "owner";
  }

  // Check participant is registered for this session
  const participantRows = await db
    .select()
    .from(consultationParticipants)
    .where(
      and(
        eq(consultationParticipants.sessionId, sessionId),
        eq(consultationParticipants.actorId, actorId),
      ),
    )
    .limit(1);

  if (!participantRows.length) {
    throw new AppError("AUTH_FORBIDDEN", "Not a participant", "You are not registered for this consultation.", 403);
  }

  const participant = participantRows[0];

  // If waiting room enabled, non-admitted patients must wait
  const roomConfigRows = await db
    .select({ waitingRoomEnabled: consultationRoomConfigs.waitingRoomEnabled, autoAdmit: consultationRoomConfigs.autoAdmit })
    .from(consultationRoomConfigs)
    .limit(1); // simplified: no hospital-specific config lookup here

  const waitingRoomEnabled = roomConfigRows[0]?.waitingRoomEnabled ?? true;
  const autoAdmit = roomConfigRows[0]?.autoAdmit ?? false;

  const isAdmitted = participant.admitted || isModerator || autoAdmit;

  if (waitingRoomEnabled && !isAdmitted && actorType === "patient") {
    return NextResponse.json({
      data: {
        sessionId,
        status: session.status,
        waitingRoom: true,
        message: "The doctor will admit you shortly. Please wait.",
      },
    });
  }

  // Mark joinedAt if first time
  if (!participant.joinedAt) {
    await db
      .update(consultationParticipants)
      .set({ joinedAt: new Date(), admitted: true })
      .where(eq(consultationParticipants.id, participant.id));
  }

  // Activate session on first participant join
  if (session.status === "scheduled") {
    await db
      .update(consultationSessions)
      .set({ status: "active", startedAt: new Date() })
      .where(and(eq(consultationSessions.id, sessionId), eq(consultationSessions.status, "scheduled")));
  }

  // Build participant-specific join URL
  const joinUrl = buildParticipantJoinUrl(session.roomId, {
    name: participantName,
    isModerator,
  });

  return NextResponse.json({
    data: {
      sessionId,
      roomId: session.roomId,
      roomUrl: session.roomUrl,
      joinUrl,
      status: "active",
      waitingRoom: false,
      isModerator,
    },
  });
});
