/**
 * GET /api/portal/insights — Provider self-analytics
 *
 * Hospital admin → own hospital stats (profile views, bookings, rating trends).
 * Doctor         → own doctor profile stats.
 *
 * Data sourced from funnel_events (entityId = hospitalId/doctorId).
 * No patient PII is returned — all anonymized.
 *
 * Flag: provider_insights
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { funnelEvents, hospitals, doctors, appointments } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { requireFeatureFlag } from "@/lib/config/feature-flags";
import { withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const flagCheck = await requireFeatureFlag("provider_insights");
  if (flagCheck) return flagCheck;

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const forbidden = ensureRole(auth.role, ["hospital_admin", "doctor", "owner", "admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const range = url.searchParams.get("range") ?? "30d";
  const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
  const days = daysMap[range] ?? 30;
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const isHospital = auth.role === "hospital_admin";
  const isDoctor = auth.role === "doctor";

  // Resolve entity ID from auth context
  let entityId: string | null = null;
  let entityType: "hospital" | "doctor" = "hospital";

  if (isHospital) {
    entityType = "hospital";
    entityId = auth.entityId ?? null;
  } else if (isDoctor) {
    entityType = "doctor";
    entityId = auth.entityId ?? null;
  } else {
    // Owner/admin — use query param
    entityType = (url.searchParams.get("entityType") ?? "hospital") as "hospital" | "doctor";
    entityId = url.searchParams.get("entityId") ?? null;
  }

  if (!entityId) {
    return NextResponse.json(
      { error: "Your account is not linked to a provider entity.", code: "ENTITY_NOT_FOUND" },
      { status: 400 },
    );
  }

  // Funnel metrics for this entity
  const funnelRows = await db
    .select({
      eventType: funnelEvents.eventType,
      total: count(),
    })
    .from(funnelEvents)
    .where(
      and(
        eq(funnelEvents.entityType, entityType),
        eq(funnelEvents.entityId, entityId),
        gte(funnelEvents.createdAt, from),
      ),
    )
    .groupBy(funnelEvents.eventType);

  const metrics: Record<string, number> = {};
  for (const row of funnelRows) {
    metrics[row.eventType] = row.total;
  }

  const views = metrics["profile_view"] ?? 0;
  const bookingStarts = metrics["booking_start"] ?? 0;
  const bookings = metrics["booking_complete"] ?? 0;
  const conversionRate = views > 0 ? Math.round((bookings / views) * 100) : 0;

  // Daily sparkline for last 7 days
  const sparklineRows = await db
    .select({
      day: sql<string>`strftime('%Y-%m-%d', datetime(${funnelEvents.createdAt} / 1000, 'unixepoch'))`.as("day"),
      views: count(sql`CASE WHEN ${funnelEvents.eventType} = 'profile_view' THEN 1 END`).as("views"),
      bookings: count(sql`CASE WHEN ${funnelEvents.eventType} = 'booking_complete' THEN 1 END`).as("bookings"),
    })
    .from(funnelEvents)
    .where(
      and(
        eq(funnelEvents.entityType, entityType),
        eq(funnelEvents.entityId, entityId),
        gte(funnelEvents.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      ),
    )
    .groupBy(sql`day`)
    .orderBy(sql`day`);

  // Entity details
  let name = "";
  let rating = 0;
  let reviewCount = 0;

  if (entityType === "hospital") {
    const h = await db
      .select({ name: hospitals.name, rating: hospitals.rating, reviewCount: hospitals.reviewCount })
      .from(hospitals)
      .where(eq(hospitals.id, entityId))
      .limit(1);
    if (h[0]) { name = h[0].name; rating = h[0].rating; reviewCount = h[0].reviewCount; }
  } else {
    const d = await db
      .select({ name: doctors.name })
      .from(doctors)
      .where(eq(doctors.id, entityId))
      .limit(1);
    if (d[0]) name = d[0].name ?? "";
  }

  // Appointment completion rate
  let completionRate = 0;
  try {
    const apptCol = entityType === "hospital" ? appointments.hospitalId : appointments.doctorId;
    const apptRows = await db
      .select({
        total: count(),
        completed: count(sql`CASE WHEN ${appointments.status} = 'completed' THEN 1 END`),
      })
      .from(appointments)
      .where(and(eq(apptCol, entityId), gte(appointments.createdAt, from)));

    const total = apptRows[0]?.total ?? 0;
    const completed = Number(apptRows[0]?.completed ?? 0);
    completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  } catch { /* appointments query failure is non-fatal */ }

  return NextResponse.json({
    entity: { id: entityId, type: entityType, name, rating, reviewCount },
    metrics: {
      profileViews: views,
      bookingStarts,
      bookingsCompleted: bookings,
      conversionRate,
      completionRate,
    },
    sparkline: sparklineRows.map((r) => ({
      day: r.day,
      views: Number(r.views),
      bookings: Number(r.bookings),
    })),
    range,
    days,
  });
});
