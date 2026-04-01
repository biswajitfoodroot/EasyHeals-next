/**
 * GET /api/v1/patients/wearable-summary — Last 30 days of device readings
 *
 * Returns aggregated device data grouped by reading type.
 * Used by WearableTab in Health Hub to render sparklines.
 *
 * Flag: wearable_sync
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { healthMemoryEvents } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { requireFeatureFlag } from "@/lib/config/feature-flags";
import { withErrorHandler } from "@/lib/errors/app-error";
import { decryptPHI } from "@/lib/health/encryption";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const flagCheck = await requireFeatureFlag("wearable_sync");
  if (flagCheck) return flagCheck;

  const session = await requirePatientSession(req);
  const { patientId } = session;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: healthMemoryEvents.id,
      eventDate: healthMemoryEvents.eventDate,
      dataEncrypted: healthMemoryEvents.dataEncrypted,
    })
    .from(healthMemoryEvents)
    .where(
      and(
        eq(healthMemoryEvents.patientId, patientId),
        eq(healthMemoryEvents.source, "device"),
        gte(healthMemoryEvents.eventDate, thirtyDaysAgo),
        eq(healthMemoryEvents.isActive, true),
      ),
    )
    .orderBy(healthMemoryEvents.eventDate);

  // Group by reading type
  const grouped: Record<string, Array<{ date: string; value: number; unit?: string }>> = {};
  let lastSyncAt: string | null = null;

  for (const row of rows) {
    try {
      const data = decryptPHI<{ type: string; value: number; unit?: string }>(row.dataEncrypted);
      if (!grouped[data.type]) grouped[data.type] = [];
      grouped[data.type].push({
        date: row.eventDate instanceof Date ? row.eventDate.toISOString().split("T")[0] : String(row.eventDate),
        value: Number(data.value),
        unit: data.unit,
      });
      if (!lastSyncAt || (row.eventDate && row.eventDate > new Date(lastSyncAt))) {
        lastSyncAt = row.eventDate instanceof Date ? row.eventDate.toISOString() : String(row.eventDate);
      }
    } catch { /* skip corrupt entries */ }
  }

  // Build summary with latest value + 7-day sparkline (last 7 data points per type)
  const summary: Record<string, {
    latest: number;
    unit?: string;
    sparkline: number[];
    totalReadings: number;
  }> = {};

  for (const [type, points] of Object.entries(grouped)) {
    if (points.length === 0) continue;
    const latest = points[points.length - 1];
    summary[type] = {
      latest: latest.value,
      unit: latest.unit,
      sparkline: points.slice(-7).map((p) => p.value),
      totalReadings: points.length,
    };
  }

  return NextResponse.json({
    summary,
    lastSyncAt,
    totalReadings: rows.length,
    periodDays: 30,
  });
});
