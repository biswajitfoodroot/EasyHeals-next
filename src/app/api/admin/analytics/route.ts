/**
 * Admin Analytics — Conversion Funnel
 *
 * GET /api/admin/analytics/funnel   — aggregated funnel data
 * GET /api/admin/analytics/top-performers — hospitals/doctors by conversion rate
 *
 * Auth: admin / owner role required
 * Flag: conversion_analytics
 */

import { NextRequest, NextResponse } from "next/server";
import { gte, lte, and, count, eq, sql, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { funnelEvents, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { requireFeatureFlag } from "@/lib/config/feature-flags";
import { withErrorHandler } from "@/lib/errors/app-error";

const FUNNEL_STAGES = [
  "search",
  "profile_view",
  "cta_click",
  "booking_start",
  "booking_complete",
  "review_submitted",
] as const;

export const GET = withErrorHandler(async (req: NextRequest) => {
  const flagCheck = await requireFeatureFlag("conversion_analytics");
  if (flagCheck) return flagCheck;

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const range = url.searchParams.get("range") ?? "30d";
  const type = url.searchParams.get("type") ?? "funnel"; // 'funnel' | 'top-performers'

  const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
  const days = daysMap[range] ?? 30;
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  if (type === "top-performers") {
    // Top hospitals by booking_complete events
    const rows = await db
      .select({
        entityId: funnelEvents.entityId,
        views: count(sql`CASE WHEN ${funnelEvents.eventType} = 'profile_view' THEN 1 END`).as("views"),
        bookings: count(sql`CASE WHEN ${funnelEvents.eventType} = 'booking_complete' THEN 1 END`).as("bookings"),
      })
      .from(funnelEvents)
      .where(
        and(
          eq(funnelEvents.entityType, "hospital"),
          gte(funnelEvents.createdAt, from),
        ),
      )
      .groupBy(funnelEvents.entityId)
      .orderBy(desc(count(sql`CASE WHEN ${funnelEvents.eventType} = 'booking_complete' THEN 1 END`)))
      .limit(20);

    // Enrich with hospital names
    const hospitalIds = rows.map((r) => r.entityId).filter(Boolean) as string[];
    const hospitalRows = hospitalIds.length
      ? await db
          .select({ id: hospitals.id, name: hospitals.name, slug: hospitals.slug, rating: hospitals.rating })
          .from(hospitals)
          .where(sql`${hospitals.id} IN (${sql.join(hospitalIds.map((id) => sql`${id}`), sql`, `)})`)
      : [];

    const nameMap = Object.fromEntries(hospitalRows.map((h) => [h.id, h]));

    const performers = rows.map((r) => {
      const h = r.entityId ? nameMap[r.entityId] : null;
      const views = Number(r.views);
      const bookings = Number(r.bookings);
      return {
        entityId: r.entityId,
        name: h?.name ?? "Unknown",
        slug: h?.slug,
        rating: h?.rating ?? 0,
        views,
        bookings,
        conversionRate: views > 0 ? Math.round((bookings / views) * 100) : 0,
      };
    });

    return NextResponse.json({ performers, range, days });
  }

  // Default: funnel stage counts
  const stageCounts: Record<string, number> = {};
  for (const stage of FUNNEL_STAGES) {
    const rows = await db
      .select({ total: count() })
      .from(funnelEvents)
      .where(and(eq(funnelEvents.eventType, stage), gte(funnelEvents.createdAt, from)));
    stageCounts[stage] = rows[0]?.total ?? 0;
  }

  const funnel = FUNNEL_STAGES.map((stage, i) => ({
    stage,
    count: stageCounts[stage],
    dropOff: i > 0 && stageCounts[FUNNEL_STAGES[i - 1]] > 0
      ? Math.round((1 - stageCounts[stage] / stageCounts[FUNNEL_STAGES[i - 1]]) * 100)
      : 0,
  }));

  // Unique sessions in range
  const sessionRows = await db
    .select({ total: count(sql`DISTINCT ${funnelEvents.sessionId}`) })
    .from(funnelEvents)
    .where(gte(funnelEvents.createdAt, from));

  return NextResponse.json({
    funnel,
    uniqueSessions: sessionRows[0]?.total ?? 0,
    range,
    days,
    from: from.toISOString(),
  });
});
