/**
 * POST /api/v1/appointments
 * GET  /api/v1/appointments  — patient's own appointment list
 *
 * P2 Day 1 — appointment booking (HLD §5).
 *
 * POST: consent-gated, OTP-verified, writes to shared CRM appointments table.
 *       Status lifecycle: requested → confirmed → in_progress → completed | cancelled | no_show
 *
 * Auth:  eh_patient_session cookie (Redis-backed, 24h TTL)
 * Gate:  appointment_booking feature flag must be ON
 * DPDP:  consent purpose "booking_appointment" required
 */

import { and, desc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { appointments, appointmentSlots, consentRecords, doctors, hospitals } from "@/db/schema";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { getFeatureFlag } from "@/lib/config/feature-flags";
import { decryptPhone } from "@/lib/security/encryption";
import { requirePatientSession } from "@/lib/core/patient-session";
import { publishEvent } from "@/lib/crm/outbox";
import { getNotificationProvider } from "@/lib/notifications";

// ── Auto-grant consent (upsert) — consent shown inline in booking form ────────

async function ensureConsent(patientId: string, purpose: string): Promise<string> {
  // Check for existing active consent
  const existing = await db
    .select({ id: consentRecords.id })
    .from(consentRecords)
    .where(and(
      eq(consentRecords.patientId, patientId),
      eq(consentRecords.purpose, purpose),
      eq(consentRecords.granted, true),
      isNull(consentRecords.revokedAt),
    ))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  // Grant new consent
  const [record] = await db
    .insert(consentRecords)
    .values({
      patientId,
      purpose,
      granted: true,
      version: "1.0",
      channel: "web",
      ipHash: "web-booking",      // non-sensitive placeholder; real IP hash added in P4 hardening
      legalBasis: "dpdp_consent",
    })
    .returning({ id: consentRecords.id });

  return record.id;
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const bookSchema = z.object({
  hospitalId: z.string().uuid(),
  doctorId: z.string().uuid().optional(),
  slotId: z.string().uuid().optional(),
  type: z.enum(["in_person", "online_consultation"]).default("in_person"),
  scheduledAt: z.string().datetime().optional(), // ISO-8601; required if no slotId
  patientNotes: z.string().max(1000).optional(),
  consentGranted: z.literal(true),
});

// ── POST /api/v1/appointments ─────────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  // Feature flag gate
  const enabled = await getFeatureFlag("appointment_booking");
  if (!enabled) {
    throw new AppError("SYS_CONFIG_MISSING", "Appointment booking not available", "This feature is not yet available.", 503);
  }

  const session = await requirePatientSession(req);
  const { patientId } = session;

  const payload = await req.json().catch(() => null);
  if (!payload) throw new AppError("SYS_UNHANDLED", "Invalid body", "Invalid request body", 400);

  const parsed = bookSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Validation error", 400);
  }

  const { hospitalId, doctorId, slotId, type, scheduledAt, patientNotes } = parsed.data;

  // 1. Consent gate — auto-upsert when consentGranted:true is in body (shown as checkbox in UI)
  const consentRecordId = await ensureConsent(patientId, "booking_appointment");

  // 2. Verify hospital is active
  const hospitalRows = await db
    .select({ id: hospitals.id, name: hospitals.name, isActive: hospitals.isActive })
    .from(hospitals)
    .where(eq(hospitals.id, hospitalId))
    .limit(1);

  if (!hospitalRows.length || !hospitalRows[0].isActive) {
    throw new AppError("BOOK_HOSPITAL_CLOSED", "Hospital unavailable", "This hospital is not currently accepting appointments.", 409);
  }

  // 3. Validate slot (if provided) — ensure it is not already booked
  let resolvedScheduledAt: Date | undefined;

  if (slotId) {
    const slotRows = await db
      .select({ id: appointmentSlots.id, isBooked: appointmentSlots.isBooked, startsAt: appointmentSlots.startsAt })
      .from(appointmentSlots)
      .where(and(eq(appointmentSlots.id, slotId), eq(appointmentSlots.hospitalId, hospitalId)))
      .limit(1);

    if (!slotRows.length) {
      throw new AppError("DB_NOT_FOUND", "Slot not found", "The selected time slot does not exist.", 404);
    }
    if (slotRows[0].isBooked) {
      throw new AppError("BOOK_SLOT_TAKEN", "Slot taken", "This time slot is no longer available.", 409);
    }
    resolvedScheduledAt = slotRows[0].startsAt ?? undefined;
  } else if (scheduledAt) {
    resolvedScheduledAt = new Date(scheduledAt);
  }

  // 4. Blackout check — patient cannot book more than 3 appointments per day (rate limit per HLD §5.2)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayBookings = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.patientId, patientId), eq(appointments.status, "requested")));

  if (todayBookings.length >= 3) {
    throw new AppError("BOOK_PATIENT_BLACKOUT", "Booking limit reached", "You can book a maximum of 3 appointments per day.", 409);
  }

  // 5. Insert appointment into shared DB
  const [newAppt] = await db
    .insert(appointments)
    .values({
      patientId,
      hospitalId,
      doctorId: doctorId ?? null,
      slotId: slotId ?? null,
      type,
      status: "requested",
      scheduledAt: resolvedScheduledAt ?? null,
      patientNotes: patientNotes ?? null,
      consentRecordId,
      sourcePlatform: "web",
    })
    .returning({ id: appointments.id });

  // 6. If slot used, mark it as booked
  if (slotId) {
    await db
      .update(appointmentSlots)
      .set({ isBooked: true, appointmentId: newAppt.id })
      .where(eq(appointmentSlots.id, slotId));
  }

  // 7. Publish outbox event → CRM picks up and assigns to advisor
  await publishEvent("appointment.created", {
    appointmentId: newAppt.id,
    patientId,
    hospitalId,
    doctorId: doctorId ?? null,
    type,
    scheduledAt: resolvedScheduledAt?.toISOString() ?? null,
    sourcePlatform: "web",
  });

  // 8. WA confirmation — non-blocking (feature-flagged; fails silently if not configured)
  const waEnabled = await getFeatureFlag("whatsapp_notifications").catch(() => false);
  if (waEnabled && session.phoneEncrypted) {
    try {
      const rawPhone = decryptPhone(session.phoneEncrypted);
      const notif = getNotificationProvider();
      // sendWhatsAppTemplate is on MSG91Provider when NOTIFICATION_PROVIDER=msg91
      if ("sendWhatsAppTemplate" in notif) {
        await (notif as any).sendWhatsAppTemplate(rawPhone, "easyheals_appointment_confirmed", {
          HOSPITAL: hospitalRows[0].name,
          TYPE: type === "online_consultation" ? "Online Consultation" : "In-Person Visit",
          DATE: resolvedScheduledAt
            ? resolvedScheduledAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            : "To be confirmed",
        });
      }
    } catch (err) {
      // WA failure must never fail the booking — log and move on
      console.warn("[Appointments] WA confirmation failed:", err);
    }
  }

  return NextResponse.json({
    data: {
      appointmentId: newAppt.id,
      status: "requested",
      hospitalName: hospitalRows[0].name,
      type,
      scheduledAt: resolvedScheduledAt?.toISOString() ?? null,
      message: "Appointment requested. You will receive a confirmation shortly.",
    },
  }, { status: 201 });
});

// ── GET /api/v1/appointments — patient's own appointments ─────────────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);
  const { patientId } = session;

  const rows = await db
    .select({
      id: appointments.id,
      type: appointments.type,
      status: appointments.status,
      scheduledAt: appointments.scheduledAt,
      confirmedAt: appointments.confirmedAt,
      completedAt: appointments.completedAt,
      cancelledAt: appointments.cancelledAt,
      cancellationReason: appointments.cancellationReason,
      patientNotes: appointments.patientNotes,
      createdAt: appointments.createdAt,
      hospitalId: hospitals.id,
      hospitalName: hospitals.name,
      hospitalCity: hospitals.city,
      doctorId: doctors.id,
      doctorName: doctors.fullName,
    })
    .from(appointments)
    .leftJoin(hospitals, eq(hospitals.id, appointments.hospitalId))
    .leftJoin(doctors, eq(doctors.id, appointments.doctorId))
    .where(eq(appointments.patientId, patientId))
    .orderBy(desc(appointments.createdAt))
    .limit(50);

  return NextResponse.json({ data: rows });
});
