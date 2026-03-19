/**
 * POST /api/v1/consultations/:sessionId/end
 *
 * P3 Day 3 — End an active consultation session.
 *
 * Auth:  Doctor (own session) OR admin/owner/advisor
 * Gate:  video_consultation feature flag must be ON
 *
 * Flow:
 *   1. Verify session is active (not already ended)
 *   2. Set session.status = "ended", endedAt = now
 *   3. Mark all participants as left (leftAt = now if not already set)
 *   4. Update appointment status: in_progress → completed
 *   5. (Optional) If body.postVisitNotes provided → create EMR visit record
 *      (only if emr_lite flag ON and NEON_DATABASE_URL set)
 */

import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { appointments, consultationSessions, consultationParticipants } from "@/db/schema";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { getFeatureFlag } from "@/lib/config/feature-flags";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

const endSchema = z.object({
  // Optional — doctor can attach post-consult notes that create an EMR visit record
  postVisitNotes: z.string().max(5000).optional(),
  patientId: z.string().uuid().optional(), // required if postVisitNotes provided
}).optional();

export const POST = withErrorHandler(async (
  req: NextRequest,
  ctx?: { params: Promise<Record<string, string>> },
) => {
  if (!await getFeatureFlag("video_consultation")) {
    throw new AppError("SYS_CONFIG_MISSING", "Video consultation not available", "Video consultation is not yet enabled.", 503);
  }

  const { id: sessionId } = await ctx!.params;

  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "doctor"]);
  if (forbidden) return forbidden;

  // Fetch session + appointment
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
    throw new AppError("SYS_UNHANDLED", "Already ended", "This consultation has already ended.", 409);
  }

  // Doctor can only end their own session
  if (auth.role === "doctor") {
    const doctorParticipant = await db
      .select({ id: consultationParticipants.id })
      .from(consultationParticipants)
      .where(
        and(
          eq(consultationParticipants.sessionId, sessionId),
          eq(consultationParticipants.actorId, auth.entityId ?? ""),
          eq(consultationParticipants.actorType, "user"),
        ),
      )
      .limit(1);

    if (!doctorParticipant.length) {
      throw new AppError("AUTH_FORBIDDEN", "Forbidden", "You are not a participant in this consultation.", 403);
    }
  }

  const now = new Date();

  // 1. End session
  await db
    .update(consultationSessions)
    .set({ status: "ended", endedAt: now })
    .where(eq(consultationSessions.id, sessionId));

  // 2. Mark all participants who haven't left yet
  await db
    .update(consultationParticipants)
    .set({ leftAt: now })
    .where(
      and(
        eq(consultationParticipants.sessionId, sessionId),
        isNull(consultationParticipants.leftAt),
      ),
    );

  // 3. Complete the appointment
  await db
    .update(appointments)
    .set({ status: "completed", completedAt: now })
    .where(
      and(
        eq(appointments.id, session.appointmentId),
        eq(appointments.status, "in_progress"),
      ),
    );

  // 4. Optional: create EMR visit record with post-consult notes
  let visitId: string | null = null;
  const body = await req.json().catch(() => null);
  const bodyParsed = endSchema.safeParse(body);

  if (bodyParsed.success && bodyParsed.data?.postVisitNotes && bodyParsed.data?.patientId) {
    const emrEnabled = await getFeatureFlag("emr_lite");
    if (emrEnabled) {
      try {
        // Dynamic import to avoid circular dep — EMR module is isolated
        const { emrDb, visitRecords, emrEncryptSafe } = await import("@/lib/emr");
        if (emrDb) {
          const [visit] = await emrDb
            .insert(visitRecords)
            .values({
              patientId: bodyParsed.data.patientId,
              doctorId: auth.role === "doctor" ? (auth.entityId ?? null) : null,
              appointmentId: session.appointmentId,
              isTeleconsultation: true,
              notesEncrypted: emrEncryptSafe(bodyParsed.data.postVisitNotes),
            })
            .returning({ id: visitRecords.id });
          visitId = visit.id;
        }
      } catch {
        // Non-fatal — EMR note creation failure must not block session end
      }
    }
  }

  return NextResponse.json({
    data: {
      sessionId,
      status: "ended",
      endedAt: now.toISOString(),
      appointmentId: session.appointmentId,
      visitId,
    },
  });
});
