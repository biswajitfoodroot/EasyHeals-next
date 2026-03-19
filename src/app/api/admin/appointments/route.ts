/**
 * GET  /api/admin/appointments — List all appointments (admin oversight)
 * POST /api/admin/appointments — Admin/hospital creates appointment for a patient (by email or phone)
 *
 * Auth: admin session (owner/admin/advisor/hospital_admin role)
 * Query: limit, offset, status
 */

import { and, desc, eq, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { appointments, doctors, hospitals, patients } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { withErrorHandler, AppError } from "@/lib/errors/app-error";
import { hashPhone } from "@/lib/security/encryption";

// ── POST /api/admin/appointments — admin/hospital creates appointment for patient ──

const createSchema = z.object({
  hospitalId: z.string().uuid(),
  doctorId: z.string().uuid().optional(),
  patientPhone: z.string().optional(), // E.164 e.g. +919876543210
  patientEmail: z.string().email().optional(),
  type: z.enum(["in_person", "online_consultation"]).default("in_person"),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(["requested", "confirmed"]).default("confirmed"),
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

  const { hospitalId, doctorId, patientPhone, patientEmail, type, scheduledAt, notes, status } = parsed.data;

  if (!patientPhone && !patientEmail) {
    throw new AppError("SYS_UNHANDLED", "Missing patient", "Provide patientPhone or patientEmail", 400);
  }

  // Verify hospital exists and is active
  const hospRows = await db.select({ id: hospitals.id, name: hospitals.name, isActive: hospitals.isActive })
    .from(hospitals).where(eq(hospitals.id, hospitalId)).limit(1);
  if (!hospRows.length || !hospRows[0].isActive) {
    throw new AppError("DB_NOT_FOUND", "Hospital not found", "Hospital not found or inactive", 404);
  }

  // Look up patient by phone hash or google email
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

  const patientId = patientRows[0].id;

  const [newAppt] = await db
    .insert(appointments)
    .values({
      patientId,
      hospitalId,
      doctorId: doctorId ?? null,
      type,
      status,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      patientNotes: notes ?? null,
      sourcePlatform: "admin",
    })
    .returning({ id: appointments.id });

  return NextResponse.json({
    data: {
      appointmentId: newAppt.id,
      patientId,
      patientName: patientRows[0].googleName ?? "Patient",
      hospitalName: hospRows[0].name,
      status,
    },
  }, { status: 201 });
});

// ── GET /api/admin/appointments ───────────────────────────────────────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "admin_manager", "hospital_admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "25", 10), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10), 0);
  const statusFilter = url.searchParams.get("status");

  const conditions = statusFilter
    ? [eq(appointments.status, statusFilter)]
    : [];

  const rows = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      type: appointments.type,
      status: appointments.status,
      scheduledAt: appointments.scheduledAt,
      createdAt: appointments.createdAt,
      doctorName: doctors.name,
      hospitalName: hospitals.name,
    })
    .from(appointments)
    .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
    .leftJoin(hospitals, eq(appointments.hospitalId, hospitals.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(appointments.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ data: rows, meta: { limit, offset, count: rows.length } });
});
