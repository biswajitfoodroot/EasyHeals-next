/**
 * GET  /api/admin/appointments — List appointments with rich filters
 * POST /api/admin/appointments — Admin creates appointment for a patient
 *
 * Auth: admin session (owner/admin/advisor/admin_manager/hospital_admin)
 *
 * GET query params:
 *   limit, offset, status, hospitalId, doctorId, dateFrom, dateTo, type
 *
 * POST body:
 *   hospitalId, doctorId?, patientPhone?, patientEmail?,
 *   type, scheduledAt?, notes?, status, referredByName?
 */

import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { appointments, doctors, hospitals, patients } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { withErrorHandler, AppError } from "@/lib/errors/app-error";
import { hashPhone } from "@/lib/security/encryption";

// ── POST ─────────────────────────────────────────────────────────────────────

const createSchema = z.object({
  hospitalId: z.string().uuid(),
  doctorId: z.string().uuid().optional(),
  patientPhone: z.string().optional(),
  patientEmail: z.string().email().optional(),
  type: z.enum(["in_person", "audio_consultation", "video_consultation", "online_consultation"]).default("in_person"),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(["requested", "confirmed"]).default("confirmed"),
  referredByName: z.string().max(200).optional(), // doctor name / agent name for reference
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "admin_manager", "hospital_admin"]);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  if (!body) throw new AppError("SYS_UNHANDLED", "Invalid body", "Invalid request body", 400);

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Validation error", 400);
  }

  const { hospitalId, doctorId, patientPhone, patientEmail, type, scheduledAt, notes, status, referredByName } = parsed.data;

  if (!patientPhone && !patientEmail) {
    throw new AppError("SYS_UNHANDLED", "Missing patient", "Provide patientPhone or patientEmail", 400);
  }

  // Verify hospital
  const hospRows = await db.select({ id: hospitals.id, name: hospitals.name, isActive: hospitals.isActive })
    .from(hospitals).where(eq(hospitals.id, hospitalId)).limit(1);
  if (!hospRows.length || !hospRows[0].isActive) {
    throw new AppError("DB_NOT_FOUND", "Hospital not found", "Hospital not found or inactive", 404);
  }

  // Build full notes string (include referredBy if provided)
  const fullNotes = [
    referredByName ? `Referred by: ${referredByName}` : null,
    notes ?? null,
  ].filter(Boolean).join("\n") || null;

  // Look up patient
  const conditions = [];
  if (patientPhone) {
    try {
      const hash = hashPhone(patientPhone);
      conditions.push(eq(patients.phoneHash, hash));
    } catch {
      throw new AppError("SYS_UNHANDLED", "Phone hash error", "PHONE_SALT not configured on server", 500);
    }
  }
  if (patientEmail) {
    conditions.push(eq(patients.googleEmail, patientEmail));
  }

  const patientRows = await db.select({ id: patients.id, googleName: patients.googleName })
    .from(patients)
    .where(conditions.length === 1 ? conditions[0] : or(...conditions))
    .limit(1);

  if (!patientRows.length) {
    throw new AppError("DB_NOT_FOUND", "Patient not found",
      "No patient account found with that phone/email. They must sign up on EasyHeals first.", 404);
  }

  const [newAppt] = await db
    .insert(appointments)
    .values({
      patientId: patientRows[0].id,
      hospitalId,
      doctorId: doctorId ?? null,
      type,
      status,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      patientNotes: fullNotes,
      sourcePlatform: "admin",
    })
    .returning({ id: appointments.id });

  return NextResponse.json({
    data: {
      appointmentId: newAppt.id,
      patientId: patientRows[0].id,
      patientName: patientRows[0].googleName ?? "Patient",
      hospitalName: hospRows[0].name,
      status,
    },
  }, { status: 201 });
});

// ── GET ──────────────────────────────────────────────────────────────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "admin_manager", "hospital_admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const limit  = Math.min(parseInt(url.searchParams.get("limit")  ?? "25", 10), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0",  10), 0);

  const statusFilter     = url.searchParams.get("status");
  const hospitalIdFilter = url.searchParams.get("hospitalId");
  const doctorIdFilter   = url.searchParams.get("doctorId");
  const typeFilter       = url.searchParams.get("type");
  const dateFrom         = url.searchParams.get("dateFrom"); // ISO date string
  const dateTo           = url.searchParams.get("dateTo");   // ISO date string

  const conditions = [];

  if (statusFilter && statusFilter !== "all") {
    conditions.push(eq(appointments.status, statusFilter));
  }
  if (hospitalIdFilter) {
    conditions.push(eq(appointments.hospitalId, hospitalIdFilter));
  }
  if (doctorIdFilter) {
    conditions.push(eq(appointments.doctorId, doctorIdFilter));
  }
  if (typeFilter && typeFilter !== "all") {
    conditions.push(eq(appointments.type, typeFilter));
  }
  if (dateFrom) {
    conditions.push(gte(appointments.scheduledAt, new Date(dateFrom)));
  }
  if (dateTo) {
    // Include the full end day
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(appointments.scheduledAt, end));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Total count for pagination
  const countResult = await db
    .select({ total: sql<number>`count(*)` })
    .from(appointments)
    .where(where);
  const total = countResult[0]?.total ?? 0;

  const rows = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      type: appointments.type,
      status: appointments.status,
      scheduledAt: appointments.scheduledAt,
      createdAt: appointments.createdAt,
      patientNotes: appointments.patientNotes,
      sourcePlatform: appointments.sourcePlatform,
      doctorId: appointments.doctorId,
      hospitalId: appointments.hospitalId,
      doctorName: doctors.fullName,
      hospitalName: hospitals.name,
    })
    .from(appointments)
    .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
    .leftJoin(hospitals, eq(appointments.hospitalId, hospitals.id))
    .where(where)
    .orderBy(desc(appointments.scheduledAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ data: rows, meta: { limit, offset, total, count: rows.length } });
});
