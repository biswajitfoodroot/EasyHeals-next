/**
 * GET /api/portal/analytics
 *
 * P2 Day 4 — Provider analytics read-only portal view (HLD §4.3)
 *
 * ⚡ CRM already has a full Recharts analytics dashboard (provider analytics).
 * This route exposes the same shared-DB data as a read-only JSON API for
 * the Next.js portal — no separate analytics store needed.
 *
 * Auth: admin/owner/advisor (all hospitals) OR hospital_admin (own hospital only)
 * Gate: provider_analytics feature flag (P2 — OFF by default)
 *
 * Returns:
 *   - appointments summary: total, by status, by type, by day (last 30d)
 *   - leads summary: total, by status, by source_platform (last 30d)
 *   - top doctors by appointment count (for admin/advisor)
 *   - slot utilisation: booked vs total slots (last 7d)
 *
 * Query params:
 *   ?hospitalId=uuid   (required for hospital_admin; optional for admin/advisor)
 *   ?days=30           (lookback window; max 90)
 *
 * DPDP:
 *   - No patient PII returned — counts only, aggregated per day
 *   - Doctor names are returned (internal staff data, not patient PII)
 */

import { and, count, eq, gte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { appointments, appointmentSlots, leads, doctors } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { getFeatureFlag } from "@/lib/config/feature-flags";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest) => {
  // Feature flag gate
  const enabled = await getFeatureFlag("provider_analytics");
  if (!enabled) {
    throw new AppError("SYS_CONFIG_MISSING", "Analytics not available", "Provider analytics is not yet enabled.", 503);
  }

  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "hospital_admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const days = Math.min(parseInt(url.searchParams.get("days") ?? "30", 10) || 30, 90);

  // Resolve hospitalId
  let hospitalId: string | null = null;
  if (auth.role === "hospital_admin") {
    if (!auth.entityId) {
      throw new AppError("DB_NOT_FOUND", "No linked hospital", "Your account is not linked to a hospital.", 400);
    }
    hospitalId = auth.entityId;
  } else {
    hospitalId = url.searchParams.get("hospitalId") ?? null;
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // ── 1. Appointments by status ──────────────────────────────────────────
  const apptConditions = [gte(appointments.createdAt, since)];
  if (hospitalId) apptConditions.push(eq(appointments.hospitalId, hospitalId));

  const apptRows = await db
    .select({
      status: appointments.status,
      type: appointments.type,
      count: count(),
    })
    .from(appointments)
    .where(and(...apptConditions))
    .groupBy(appointments.status, appointments.type);

  const appointmentsByStatus: Record<string, number> = {};
  const appointmentsByType: Record<string, number> = {};
  let totalAppointments = 0;

  for (const row of apptRows) {
    appointmentsByStatus[row.status] = (appointmentsByStatus[row.status] ?? 0) + row.count;
    appointmentsByType[row.type] = (appointmentsByType[row.type] ?? 0) + row.count;
    totalAppointments += row.count;
  }

  // ── 2. Appointments per day (last N days) ─────────────────────────────
  const apptPerDayRows = await db
    .select({
      day: sql<string>`strftime('%Y-%m-%d', datetime(${appointments.createdAt} / 1000, 'unixepoch'))`.as("day"),
      count: count(),
    })
    .from(appointments)
    .where(and(...apptConditions))
    .groupBy(sql`day`)
    .orderBy(sql`day`);

  const appointmentsPerDay = apptPerDayRows.map((r) => ({ date: r.day, count: r.count }));

  // ── 3. Leads by status and source (last N days) ───────────────────────
  const leadsConditions = [gte(leads.createdAt, since)];
  if (hospitalId) leadsConditions.push(eq(leads.hospitalId, hospitalId));

  const leadRows = await db
    .select({
      status: leads.status,
      sourcePlatform: leads.sourcePlatform,
      count: count(),
    })
    .from(leads)
    .where(and(...leadsConditions))
    .groupBy(leads.status, leads.sourcePlatform);

  const leadsByStatus: Record<string, number> = {};
  const leadsBySource: Record<string, number> = {};
  let totalLeads = 0;

  for (const row of leadRows) {
    leadsByStatus[row.status] = (leadsByStatus[row.status] ?? 0) + row.count;
    const src = row.sourcePlatform ?? "crm";
    leadsBySource[src] = (leadsBySource[src] ?? 0) + row.count;
    totalLeads += row.count;
  }

  // ── 4. Top doctors by appointment count ───────────────────────────────
  let topDoctors: { doctorId: string; name: string; count: number }[] = [];
  // Only for admin/advisor (hospital_admin sees their own hospital's doctors)
  if (auth.role !== "hospital_admin" || hospitalId) {
    const doctorConditions = [gte(appointments.createdAt, since)];
    if (hospitalId) doctorConditions.push(eq(appointments.hospitalId, hospitalId));

    const doctorRows = await db
      .select({
        doctorId: appointments.doctorId,
        name: doctors.fullName,
        count: count(),
      })
      .from(appointments)
      .leftJoin(doctors, eq(doctors.id, appointments.doctorId))
      .where(and(...doctorConditions, sql`${appointments.doctorId} IS NOT NULL`))
      .groupBy(appointments.doctorId, doctors.fullName)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    topDoctors = doctorRows
      .filter((r) => r.doctorId)
      .map((r) => ({
        doctorId: r.doctorId!,
        name: r.name ?? "Unknown",
        count: r.count,
      }));
  }

  // ── 5. Slot utilisation (last 7 days) ─────────────────────────────────
  const slotSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const slotConditions = [gte(appointmentSlots.startsAt, slotSince)];
  if (hospitalId) slotConditions.push(eq(appointmentSlots.hospitalId, hospitalId));

  const slotRows = await db
    .select({
      isBooked: appointmentSlots.isBooked,
      count: count(),
    })
    .from(appointmentSlots)
    .where(and(...slotConditions))
    .groupBy(appointmentSlots.isBooked);

  let totalSlots = 0;
  let bookedSlots = 0;
  for (const row of slotRows) {
    totalSlots += row.count;
    if (row.isBooked) bookedSlots += row.count;
  }

  const slotUtilisation = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0;

  return NextResponse.json({
    data: {
      period: { days, since: since.toISOString() },
      hospitalId: hospitalId ?? "all",
      appointments: {
        total: totalAppointments,
        byStatus: appointmentsByStatus,
        byType: appointmentsByType,
        perDay: appointmentsPerDay,
      },
      leads: {
        total: totalLeads,
        byStatus: leadsByStatus,
        bySource: leadsBySource,
      },
      topDoctors,
      slots: {
        total: totalSlots,
        booked: bookedSlots,
        utilisationPercent: slotUtilisation,
      },
    },
  });
});
