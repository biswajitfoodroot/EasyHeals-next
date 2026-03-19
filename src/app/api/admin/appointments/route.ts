/**
 * GET /api/admin/appointments — List all appointments (admin oversight)
 *
 * Auth: admin session (owner/admin/advisor role)
 * Query: limit, offset, status
 */

import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { appointments, doctors, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
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
