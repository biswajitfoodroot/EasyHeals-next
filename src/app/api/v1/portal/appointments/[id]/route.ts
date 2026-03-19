/**
 * PATCH /api/v1/portal/appointments/[id]
 *
 * Provider-side appointment actions:
 *   Body: { action: "accept" | "reject" | "complete", reason?: string }
 *
 * Auth: hospital_admin (own hospital), doctor (own appointments), admin/owner
 * Status transitions:
 *   requested  → accept  → confirmed
 *   requested  → reject  → cancelled
 *   confirmed  → complete → completed
 */
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { appointments, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";

const actionSchema = z.object({
  action: z.enum(["accept", "reject", "complete"]),
  reason: z.string().max(500).optional(),
});

export const PATCH = withErrorHandler(async (
  req: NextRequest,
  ctx?: { params: Promise<Record<string, string>> },
) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "doctor", "hospital_admin"]);
  if (forbidden) return forbidden;

  const { id: appointmentId } = await ctx!.params;

  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Invalid action", 400);
  }

  const { action, reason } = parsed.data;

  // Fetch appointment
  const rows = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      hospitalId: appointments.hospitalId,
      doctorId: appointments.doctorId,
    })
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!rows.length) {
    throw new AppError("DB_NOT_FOUND", "Appointment not found", "Appointment not found.", 404);
  }

  const appt = rows[0];

  // Scope check — hospital_admin can only act on their own hospital's appointments
  if (auth.role === "hospital_admin" && auth.entityId && appt.hospitalId !== auth.entityId) {
    throw new AppError("AUTH_FORBIDDEN", "Forbidden", "You can only manage appointments for your hospital.", 403);
  }

  // Doctor can only act on their own appointments
  if (auth.role === "doctor" && auth.entityId && appt.doctorId !== auth.entityId) {
    throw new AppError("AUTH_FORBIDDEN", "Forbidden", "You can only manage your own appointments.", 403);
  }

  // Validate state transitions
  if (action === "accept" && appt.status !== "requested") {
    throw new AppError("SYS_UNHANDLED", "Invalid transition", `Cannot accept appointment with status: ${appt.status}`, 409);
  }
  if (action === "reject" && !["requested", "confirmed"].includes(appt.status)) {
    throw new AppError("SYS_UNHANDLED", "Invalid transition", `Cannot reject appointment with status: ${appt.status}`, 409);
  }
  if (action === "complete" && appt.status !== "confirmed") {
    throw new AppError("SYS_UNHANDLED", "Invalid transition", `Cannot complete appointment with status: ${appt.status}`, 409);
  }

  const now = new Date();
  let updateValues: Record<string, unknown>;

  if (action === "accept") {
    updateValues = { status: "confirmed", confirmedAt: now };
  } else if (action === "reject") {
    updateValues = { status: "cancelled", cancelledAt: now, cancellationReason: reason ?? "Rejected by provider" };
  } else {
    updateValues = { status: "completed", completedAt: now };
  }

  await db
    .update(appointments)
    .set(updateValues)
    .where(eq(appointments.id, appointmentId));

  const newStatus = action === "accept" ? "confirmed" : action === "reject" ? "cancelled" : "completed";

  return NextResponse.json({
    data: { appointmentId, status: newStatus, action },
    message: `Appointment ${action}ed successfully.`,
  });
});
