/**
 * POST /api/v1/consultations/:sessionId/invite
 *
 * P3 Day 3 — Doctor invites an additional participant to an active session.
 * Supports: specialist, family_member, interpreter, coordinator
 *
 * Auth:  Doctor (own session) OR admin/owner/advisor
 * Gate:  video_consultation feature flag must be ON
 */

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { consultationSessions, consultationParticipants, consultationRoomConfigs } from "@/db/schema";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { getFeatureFlag } from "@/lib/config/feature-flags";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { buildParticipantJoinUrl } from "@/lib/consultations/jitsi";

const inviteSchema = z.object({
  actorId: z.string().min(1),
  actorType: z.enum(["patient", "user"]),
  role: z.enum(["specialist", "family_member", "interpreter", "coordinator"]),
  name: z.string().min(1).max(200),
});

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

  const payload = await req.json().catch(() => null);
  if (!payload) throw new AppError("SYS_UNHANDLED", "Invalid body", "Invalid request body", 400);

  const parsed = inviteSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Validation error", 400);
  }

  const { actorId, actorType, role, name } = parsed.data;

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
    throw new AppError("SYS_UNHANDLED", "Session ended", "Cannot invite participants to an ended session.", 409);
  }

  if (!session.roomId) {
    throw new AppError("SYS_UNHANDLED", "Room not ready", "The consultation room is not ready yet.", 503);
  }

  // Check allowed participant types for this session (via room config)
  const roomConfigRows = await db
    .select({ allowedParticipantTypes: consultationRoomConfigs.allowedParticipantTypes, maxParticipants: consultationRoomConfigs.maxParticipants })
    .from(consultationRoomConfigs)
    .limit(1);

  const allowedTypes = roomConfigRows[0]?.allowedParticipantTypes ?? ["patient", "doctor", "specialist", "coordinator", "family_member", "interpreter"];
  const maxParticipants = roomConfigRows[0]?.maxParticipants ?? 4;

  if (!allowedTypes.includes(role)) {
    throw new AppError("AUTH_FORBIDDEN", "Participant type not allowed", `Participant type "${role}" is not allowed for this consultation room.`, 403);
  }

  // Check current participant count
  const currentParticipants = await db
    .select({ id: consultationParticipants.id })
    .from(consultationParticipants)
    .where(eq(consultationParticipants.sessionId, sessionId));

  if (currentParticipants.length >= maxParticipants) {
    throw new AppError("SYS_UNHANDLED", "Room full", `Maximum ${maxParticipants} participants allowed.`, 409);
  }

  // Insert participant (idempotent via unique constraint)
  await db
    .insert(consultationParticipants)
    .values({
      sessionId,
      actorId,
      actorType,
      role,
      admitted: false,
    })
    .onConflictDoNothing();

  // Generate invite URL for the new participant
  const inviteUrl = buildParticipantJoinUrl(session.roomId, {
    name,
    isModerator: false,
  });

  return NextResponse.json({
    data: {
      sessionId,
      actorId,
      role,
      inviteUrl,
      message: `${name} has been invited as ${role}. Share the invite URL with them.`,
    },
  }, { status: 201 });
});
