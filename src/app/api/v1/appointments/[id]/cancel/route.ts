/**
 * PATCH /api/v1/appointments/[id]/cancel
 *
 * Patient cancels their own active appointment.
 *
 * Validation chain:
 *  1. requirePatientSession — valid auth cookie
 *  2. Appointment must exist
 *  3. Ownership — patientId === session.patientId
 *  4. Status guard — only "requested" or "confirmed" are cancellable
 *  5. Time guard — scheduledAt must be at least hospital.cancellationWindowHours in the future
 *  6. Body reason — required non-empty string
 *
 * Side-effects (on success):
 *  - Updates appointment: status="cancelled", cancelledAt, cancellationReason
 *  - If slotId set: frees the slot (isBooked=false, appointmentId=null)
 *  - If paymentStatus="paid": sets paymentStatus="refund_pending" for ops review
 *  - publishEvent("appointment.cancelled") → CRM outbox
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { appointments, appointmentSlots, hospitals } from "@/db/schema";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { requirePatientSession } from "@/lib/core/patient-session";
import { publishEvent } from "@/lib/crm/outbox";

const cancelSchema = z.object({
  reason: z.string().min(1, "Cancellation reason is required").max(500),
});

export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requirePatientSession(req);
  const { patientId } = session;
  const { id } = await ctx.params;

  // ── Parse body ─────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => null);
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Validation error",
      parsed.error.issues[0]?.message ?? "Cancellation reason is required",
      400,
    );
  }
  const { reason } = parsed.data;

  // ── Fetch appointment + hospital in one join ────────────────────────────────
  const rows = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      hospitalId: appointments.hospitalId,
      status: appointments.status,
      scheduledAt: appointments.scheduledAt,
      slotId: appointments.slotId,
      paymentStatus: appointments.paymentStatus,
      cancellationWindowHours: hospitals.cancellationWindowHours,
    })
    .from(appointments)
    .leftJoin(hospitals, eq(hospitals.id, appointments.hospitalId))
    .where(eq(appointments.id, id))
    .limit(1);

  // ── Check 2: exists ─────────────────────────────────────────────────────────
  if (!rows.length) {
    throw new AppError("DB_NOT_FOUND", "Appointment not found", "Appointment not found.", 404);
  }
  const appt = rows[0];

  // ── Check 3: ownership ──────────────────────────────────────────────────────
  if (appt.patientId !== patientId) {
    throw new AppError("AUTH_FORBIDDEN", "Not your appointment", "You are not authorised to cancel this appointment.", 403);
  }

  // ── Check 4: status guard ───────────────────────────────────────────────────
  const cancellableStatuses = ["requested", "confirmed"];
  if (!cancellableStatuses.includes(appt.status)) {
    throw new AppError(
      "BOOK_HOSPITAL_CLOSED",
      `Cannot cancel appointment in status: ${appt.status}`,
      "This appointment cannot be cancelled at this stage.",
      409,
    );
  }

  // ── Check 5: time guard ─────────────────────────────────────────────────────
  if (appt.scheduledAt) {
    const windowHours = appt.cancellationWindowHours ?? 2;
    const cutoffMs = windowHours * 60 * 60 * 1000;
    const timeUntilAppt = appt.scheduledAt.getTime() - Date.now();
    if (timeUntilAppt < cutoffMs) {
      throw new AppError(
        "BOOK_SLOT_TAKEN",
        "Late cancellation attempt",
        `This appointment is too soon to cancel online. Please call the hospital directly (within ${windowHours}h of the appointment, cancellations must be made by phone).`,
        409,
      );
    }
  }

  // ── All checks passed — apply changes ──────────────────────────────────────
  const now = new Date();

  // Determine new paymentStatus
  const newPaymentStatus = appt.paymentStatus === "paid" ? "refund_pending" : appt.paymentStatus;

  await db
    .update(appointments)
    .set({
      status: "cancelled",
      cancelledAt: now,
      cancellationReason: reason,
      paymentStatus: newPaymentStatus ?? undefined,
      updatedAt: now,
    })
    .where(eq(appointments.id, id));

  // ── Free the slot if slot-based ─────────────────────────────────────────────
  if (appt.slotId) {
    await db
      .update(appointmentSlots)
      .set({ isBooked: false, appointmentId: null })
      .where(and(eq(appointmentSlots.id, appt.slotId), eq(appointmentSlots.appointmentId, id)));
  }

  // ── Publish CRM outbox event ────────────────────────────────────────────────
  await publishEvent("appointment.cancelled", {
    appointmentId: id,
    patientId,
    hospitalId: appt.hospitalId,
    reason,
    cancelledAt: now.toISOString(),
    refundRequired: appt.paymentStatus === "paid",
  });

  return NextResponse.json({
    data: {
      appointmentId: id,
      status: "cancelled",
      cancelledAt: now.toISOString(),
      refundPending: appt.paymentStatus === "paid",
      message: appt.paymentStatus === "paid"
        ? "Appointment cancelled. Your refund will be processed by our team within 5–7 business days."
        : "Appointment cancelled successfully.",
    },
  });
});
