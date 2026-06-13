/**
 * PATCH /api/v1/appointments/[id]/modify
 *
 * Patient reschedules their own appointment (requested status only).
 *
 * Allowed changes: scheduledAt, patientNotes, slotId
 * NOT allowed:     hospitalId, doctorId, type (must cancel + rebook)
 *
 * Validation chain:
 *  1. requirePatientSession — valid auth cookie
 *  2. Appointment must exist
 *  3. Ownership — patientId === session.patientId
 *  4. Status guard — only "requested" is modifiable by patient
 *  5. At least one of scheduledAt or patientNotes must be provided
 *  6. If scheduledAt provided: must be ≥1h in the future
 *  7. If new slotId provided: must exist, belong to same hospital, and be unbooked
 *
 * Side-effects (on success):
 *  - Updates appointment fields; resets status to "requested" (hospital must re-confirm)
 *  - If slotId changed: frees old slot, marks new slot booked
 *  - publishEvent("appointment.booked") with action="modified" → CRM outbox
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { appointments, appointmentSlots } from "@/db/schema";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { requirePatientSession } from "@/lib/core/patient-session";
import { publishEvent } from "@/lib/crm/outbox";

const modifySchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  patientNotes: z.string().max(1000).optional(),
  slotId: z.string().uuid().optional(),
}).refine(
  (data) => data.scheduledAt !== undefined || data.patientNotes !== undefined,
  { message: "At least one of scheduledAt or patientNotes must be provided." },
);

const MIN_RESCHEDULE_HOURS = 1;

export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requirePatientSession(req);
  const { patientId } = session;
  const { id } = await ctx.params;

  // ── Parse body ─────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => null);
  const parsed = modifySchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Validation error",
      parsed.error.issues[0]?.message ?? "Invalid modification data",
      400,
    );
  }
  const { scheduledAt, patientNotes, slotId: newSlotId } = parsed.data;

  // ── Fetch appointment ──────────────────────────────────────────────────────
  const rows = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      hospitalId: appointments.hospitalId,
      status: appointments.status,
      slotId: appointments.slotId,
    })
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);

  // ── Check 2: exists ─────────────────────────────────────────────────────────
  if (!rows.length) {
    throw new AppError("DB_NOT_FOUND", "Appointment not found", "Appointment not found.", 404);
  }
  const appt = rows[0];

  // ── Check 3: ownership ──────────────────────────────────────────────────────
  if (appt.patientId !== patientId) {
    throw new AppError("AUTH_FORBIDDEN", "Not your appointment", "You are not authorised to modify this appointment.", 403);
  }

  // ── Check 4: status guard (only "requested" is modifiable by patient) ───────
  if (appt.status !== "requested") {
    throw new AppError(
      "BOOK_HOSPITAL_CLOSED",
      `Cannot modify appointment in status: ${appt.status}`,
      "Only pending (requested) appointments can be modified. Confirmed appointments must be cancelled and rebooked.",
      409,
    );
  }

  // ── Check 6: scheduledAt must be ≥1h in the future ─────────────────────────
  if (scheduledAt) {
    const newDate = new Date(scheduledAt);
    const minFutureMs = MIN_RESCHEDULE_HOURS * 60 * 60 * 1000;
    if (newDate.getTime() - Date.now() < minFutureMs) {
      throw new AppError(
        "VALIDATION_ERROR",
        "scheduledAt too soon",
        `New appointment time must be at least ${MIN_RESCHEDULE_HOURS} hour(s) in the future.`,
        400,
      );
    }
  }

  // ── Check 7: validate new slot if provided ──────────────────────────────────
  if (newSlotId && newSlotId !== appt.slotId) {
    const slotRows = await db
      .select({
        id: appointmentSlots.id,
        hospitalId: appointmentSlots.hospitalId,
        isBooked: appointmentSlots.isBooked,
        startsAt: appointmentSlots.startsAt,
      })
      .from(appointmentSlots)
      .where(eq(appointmentSlots.id, newSlotId))
      .limit(1);

    if (!slotRows.length) {
      throw new AppError("DB_NOT_FOUND", "Slot not found", "The selected time slot does not exist.", 404);
    }
    if (slotRows[0].hospitalId !== appt.hospitalId) {
      throw new AppError("VALIDATION_ERROR", "Slot hospital mismatch", "The selected slot does not belong to the same hospital.", 400);
    }
    if (slotRows[0].isBooked) {
      throw new AppError("BOOK_SLOT_TAKEN", "Slot already booked", "This time slot is no longer available. Please choose another.", 409);
    }
  }

  // ── All checks passed — apply changes ──────────────────────────────────────
  const now = new Date();
  const resolvedScheduledAt = scheduledAt ? new Date(scheduledAt) : undefined;

  await db
    .update(appointments)
    .set({
      ...(resolvedScheduledAt !== undefined && { scheduledAt: resolvedScheduledAt }),
      ...(patientNotes !== undefined && { patientNotes }),
      ...(newSlotId !== undefined && { slotId: newSlotId }),
      // Reset to requested so hospital must re-confirm the new time
      status: "requested",
      updatedAt: now,
    })
    .where(eq(appointments.id, id));

  // ── Swap slots if slot-based and changed ────────────────────────────────────
  if (newSlotId && newSlotId !== appt.slotId) {
    // Free old slot
    if (appt.slotId) {
      await db
        .update(appointmentSlots)
        .set({ isBooked: false, appointmentId: null })
        .where(and(eq(appointmentSlots.id, appt.slotId), eq(appointmentSlots.appointmentId, id)));
    }
    // Reserve new slot
    await db
      .update(appointmentSlots)
      .set({ isBooked: true, appointmentId: id })
      .where(eq(appointmentSlots.id, newSlotId));
  }

  // ── Publish CRM outbox event ────────────────────────────────────────────────
  await publishEvent("appointment.booked", {
    appointmentId: id,
    patientId,
    hospitalId: appt.hospitalId,
    action: "modified",
    scheduledAt: resolvedScheduledAt?.toISOString() ?? null,
    modifiedAt: now.toISOString(),
  });

  return NextResponse.json({
    data: {
      appointmentId: id,
      status: "requested",
      scheduledAt: resolvedScheduledAt?.toISOString() ?? null,
      message: "Appointment updated successfully. The hospital will re-confirm your new time.",
    },
  });
});
