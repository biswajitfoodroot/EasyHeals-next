/**
 * PATCH /api/v1/consultations/:sessionId/admit/:participantId
 *
 * P3 Day 3 — Doctor admits a participant from the waiting room.
 *
 * Auth:  Doctor (own session) OR admin/owner/advisor
 * Gate:  video_consultation feature flag must be ON
 *
 * Sets participant.admitted = true. The patient's next GET /join call
 * will detect admitted=true and return their join URL.
 */

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { consultationSessions, consultationParticipants } from "@/db/schema";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { getFeatureFlag } from "@/lib/config/feature-flags";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

export const PATCH = withErrorHandler(async (
  req: NextRequest,
  ctx?: { params: Promise<Record<string, string>> },
) => {
  if (!await getFeatureFlag("video_consultation")) {
    throw new AppError("SYS_CONFIG_MISSING", "Video consultation not available", "Video consultation is not yet enabled.", 503);
  }

  const { id: sessionId, participantId } = await ctx!.params;

  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "doctor"]);
  if (forbidden) return forbidden;

  // Fetch session
  const sessionRows = await db
    .select({ id: consultationSessions.id, status: consultationSessions.status })
    .from(consultationSessions)
    .where(eq(consultationSessions.id, sessionId))
    .limit(1);

  if (!sessionRows.length) {
    throw new AppError("DB_NOT_FOUND", "Session not found", "Consultation session not found.", 404);
  }

  if (sessionRows[0].status === "ended") {
    throw new AppError("SYS_UNHANDLED", "Session ended", "Cannot admit participants to an ended session.", 409);
  }

  // Fetch participant
  const participantRows = await db
    .select()
    .from(consultationParticipants)
    .where(
      and(
        eq(consultationParticipants.id, participantId),
        eq(consultationParticipants.sessionId, sessionId),
      ),
    )
    .limit(1);

  if (!participantRows.length) {
    throw new AppError("DB_NOT_FOUND", "Participant not found", "Participant not found in this session.", 404);
  }

  const participant = participantRows[0];

  if (participant.admitted) {
    return NextResponse.json({
      data: { participantId, admitted: true, message: "Already admitted." },
    });
  }

  // Admit
  await db
    .update(consultationParticipants)
    .set({ admitted: true })
    .where(eq(consultationParticipants.id, participantId));

  return NextResponse.json({
    data: {
      sessionId,
      participantId,
      actorId: participant.actorId,
      role: participant.role,
      admitted: true,
    },
  });
});
