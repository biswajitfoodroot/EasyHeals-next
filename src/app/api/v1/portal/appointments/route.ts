/**
 * GET /api/v1/portal/appointments
 *
 * P2 Day 2 — Doctor portal: view scheduled appointments.
 *
 * Returns the doctor's upcoming + recent appointments.
 * Patient PII is deliberately excluded (DPDP compliance):
 *   - patientId exposed (internal ref only)
 *   - No phone, no full name — doctor contacts patient via hospital CRM
 *
 * Auth: admin/owner/advisor (all patients) OR doctor (own appointments only)
 * Query params:
 *   ?status=requested|confirmed|in_progress|completed|cancelled|no_show  (default: all active)
 *   ?limit=20 (max 100)
 *   ?hospitalId=uuid  (filter to a specific hospital; optional for admin)
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { appointments, appointmentSlots, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";

const ACTIVE_STATUSES = ["requested", "confirmed", "in_progress"] as const;

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "doctor", "hospital_admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const limitParam = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100);

  // hospital_admin: scoped to their hospital; others can pass hospitalId param
  const hospitalIdParam =
    auth.role === "hospital_admin"
      ? (auth.entityId ?? undefined)
      : (url.searchParams.get("hospitalId") ?? undefined);

  // doctor: scoped to their own appointments
  let doctorId: string | null = null;
  if (auth.role === "doctor") {
    if (!auth.entityId) {
      throw new AppError("DB_NOT_FOUND", "No linked doctor", "Your account is not linked to a doctor profile.", 400);
    }
    doctorId = auth.entityId;
  } else if (auth.role !== "hospital_admin") {
    doctorId = url.searchParams.get("doctorId") ?? null;
  }

  // Build status filter
  const statusFilter = statusParam
    ? [statusParam]
    : [...ACTIVE_STATUSES];

  // Build where conditions
  const conditions = [inArray(appointments.status, statusFilter)];
  if (doctorId) conditions.push(eq(appointments.doctorId, doctorId));
  if (hospitalIdParam) conditions.push(eq(appointments.hospitalId, hospitalIdParam));

  const rows = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,  // internal ref — no raw PII
      type: appointments.type,
      status: appointments.status,
      scheduledAt: appointments.scheduledAt,
      confirmedAt: appointments.confirmedAt,
      completedAt: appointments.completedAt,
      cancelledAt: appointments.cancelledAt,
      cancellationReason: appointments.cancellationReason,
      patientNotes: appointments.patientNotes,
      sourcePlatform: appointments.sourcePlatform,
      createdAt: appointments.createdAt,
      // Hospital info
      hospitalId: hospitals.id,
      hospitalName: hospitals.name,
      hospitalCity: hospitals.city,
      // Slot info
      slotStartsAt: appointmentSlots.startsAt,
      slotEndsAt: appointmentSlots.endsAt,
    })
    .from(appointments)
    .leftJoin(hospitals, eq(hospitals.id, appointments.hospitalId))
    .leftJoin(appointmentSlots, eq(appointmentSlots.id, appointments.slotId))
    .where(and(...conditions))
    .orderBy(desc(appointments.scheduledAt))
    .limit(limitParam);

  return NextResponse.json({
    data: rows,
    total: rows.length,
    filters: { status: statusFilter, doctorId, hospitalId: hospitalIdParam },
  });
});
