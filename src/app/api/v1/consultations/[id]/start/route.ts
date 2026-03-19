/**
 * POST /api/v1/consultations/:id/start
 *
 * P3 Day 3 — Creates a consultation session for a confirmed online appointment.
 * :id = appointmentId
 *
 * Auth:    Doctor (own appointment) OR admin/owner/advisor
 * Gate:    video_consultation feature flag must be ON
 */

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { appointments, consultationSessions, consultationParticipants } from "@/db/schema";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { getFeatureFlag } from "@/lib/config/feature-flags";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { generateRoomName, buildParticipantJoinUrl } from "@/lib/consultations/jitsi";

export const POST = withErrorHandler(async (
  req: NextRequest,
  ctx?: { params: Promise<Record<string, string>> },
) => {
  if (!await getFeatureFlag("video_consultation")) {
    throw new AppError("SYS_CONFIG_MISSING", "Video consultation not available", "Video consultation is not yet enabled.", 503);
  }

  const { id: appointmentId } = await ctx!.params;

  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "doctor"]);
  if (forbidden) return forbidden;

  // 1. Fetch appointment
  const apptRows = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!apptRows.length) {
    throw new AppError("DB_NOT_FOUND", "Appointment not found", "Appointment not found.", 404);
  }

  const appt = apptRows[0];

  if (appt.type !== "online_consultation") {
    throw new AppError("SYS_UNHANDLED", "Not an online consultation", "This appointment is not an online consultation.", 400);
  }

  if (!["confirmed", "in_progress"].includes(appt.status)) {
    throw new AppError("SYS_UNHANDLED", "Appointment not confirmed", "Appointment must be confirmed before starting a consultation.", 409);
  }

  // Doctor role: can only start for their own appointments
  if (auth.role === "doctor" && appt.doctorId !== auth.entityId) {
    throw new AppError("AUTH_FORBIDDEN", "Forbidden", "You can only start consultations for your own appointments.", 403);
  }

  // 2. Check for existing session (idempotent)
  const existingSession = await db
    .select()
    .from(consultationSessions)
    .where(eq(consultationSessions.appointmentId, appointmentId))
    .limit(1);

  if (existingSession.length > 0) {
    const session = existingSession[0];
    if (session.status === "ended") {
      throw new AppError("SYS_UNHANDLED", "Session already ended", "This consultation session has already ended.", 409);
    }

    const doctorName = auth.fullName ?? "Doctor";
    const joinUrl = buildParticipantJoinUrl(session.roomId!, {
      name: doctorName,
      isModerator: true,
    });

    return NextResponse.json({
      data: {
        sessionId: session.id,
        appointmentId,
        status: session.status,
        roomId: session.roomId,
        joinUrl,
        isExisting: true,
      },
    });
  }

  // 3. Generate room
  const roomId = generateRoomName(appointmentId);
  const roomUrl = `https://${process.env.JITSI_DOMAIN ?? "meet.jit.si"}/${roomId}`;

  // 4. Create session
  const [session] = await db
    .insert(consultationSessions)
    .values({
      appointmentId,
      provider: "jitsi",
      roomId,
      roomUrl,
      status: "scheduled",
    })
    .returning({ id: consultationSessions.id });

  // 5. Add patient participant
  if (appt.patientId) {
    await db.insert(consultationParticipants).values({
      sessionId: session.id,
      actorId: appt.patientId,
      actorType: "patient",
      role: "patient",
      admitted: false,
    }).onConflictDoNothing();
  }

  // 6. Add doctor participant (auto-admitted)
  if (appt.doctorId) {
    await db.insert(consultationParticipants).values({
      sessionId: session.id,
      actorId: appt.doctorId,
      actorType: "user",
      role: "doctor",
      admitted: true,
    }).onConflictDoNothing();
  }

  // 7. Update appointment status to in_progress
  await db
    .update(appointments)
    .set({ status: "in_progress" })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.status, "confirmed")));

  // 8. Build doctor's join URL
  const doctorName = auth.fullName ?? "Doctor";
  const joinUrl = buildParticipantJoinUrl(roomId, {
    name: doctorName,
    isModerator: true,
  });

  return NextResponse.json({
    data: {
      sessionId: session.id,
      appointmentId,
      status: "scheduled",
      roomId,
      roomUrl,
      joinUrl,
      patientId: appt.patientId,
    },
  }, { status: 201 });
});
