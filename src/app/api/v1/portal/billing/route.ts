/**
 * GET /api/v1/portal/billing
 *
 * Billing history for hospital portal.
 * Returns all appointments with payment info (consultation fees paid/pending/waived).
 *
 * In future: extend to include lab orders, surgery bookings, subscription payments.
 *
 * Auth: hospital_admin (own hospital) | admin/owner (pass ?hospitalId=)
 * Filters: ?from=YYYY-MM-DD &to=YYYY-MM-DD &status=paid|pending|waived|none &limit=50
 */

import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { appointments, doctors, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "hospital_admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);

  const hospitalId =
    auth.role === "hospital_admin"
      ? (auth.entityId ?? undefined)
      : (url.searchParams.get("hospitalId") ?? undefined);

  if (!hospitalId) {
    throw new AppError("SYS_UNHANDLED", "Missing hospitalId", "Provide ?hospitalId= param.", 400);
  }

  const limitParam = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const paymentStatusParam = url.searchParams.get("status");

  const conditions = [eq(appointments.hospitalId, hospitalId)];

  if (paymentStatusParam) {
    const statuses = paymentStatusParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (statuses.length > 0) conditions.push(inArray(appointments.paymentStatus, statuses));
  }

  if (fromParam) {
    conditions.push(gte(appointments.createdAt, new Date(fromParam)));
  }
  if (toParam) {
    const toDate = new Date(toParam);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(appointments.createdAt, toDate));
  }

  const rows = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      type: appointments.type,
      status: appointments.status,
      scheduledAt: appointments.scheduledAt,
      completedAt: appointments.completedAt,
      consultationFee: appointments.consultationFee,
      paymentStatus: appointments.paymentStatus,
      createdAt: appointments.createdAt,
      doctorId: appointments.doctorId,
      doctorName: doctors.fullName,
      hospitalName: hospitals.name,
    })
    .from(appointments)
    .leftJoin(doctors, eq(doctors.id, appointments.doctorId))
    .leftJoin(hospitals, eq(hospitals.id, appointments.hospitalId))
    .where(and(...conditions))
    .orderBy(desc(appointments.createdAt))
    .limit(limitParam);

  // Summary totals
  const paid    = rows.filter((r) => r.paymentStatus === "paid");
  const pending = rows.filter((r) => r.paymentStatus === "pending");
  const totalRevenue = paid.reduce((s, r) => s + (r.consultationFee ?? 0), 0);
  const pendingRevenue = pending.reduce((s, r) => s + (r.consultationFee ?? 0), 0);

  return NextResponse.json({
    data: rows,
    summary: {
      total: rows.length,
      paid: paid.length,
      pending: pending.length,
      totalRevenue,
      pendingRevenue,
    },
  });
});
