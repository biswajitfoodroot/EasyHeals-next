/**
 * GET /api/cron/previsit-briefs — Daily cron: generate pre-visit briefs for upcoming appointments
 *
 * Triggered by Vercel Cron (see vercel.json). Runs at 06:00 UTC daily.
 * Auth: CRON_SECRET header (Vercel injects automatically)
 *
 * Logic:
 *   - Finds appointments scheduled 20-28 hours from now (next-day window)
 *   - Skips appointments where a brief already exists
 *   - Fires /api/internal/generate-brief for each (async, non-blocking)
 */

import { and, between, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { appointments, previsitBriefs } from "@/db/schema";
import { env } from "@/lib/env";

export const maxDuration = 60;

export const GET = async (req: NextRequest): Promise<NextResponse> => {
  // Vercel Cron auth
  const cronSecret = req.headers.get("authorization");
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET ?? ""}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 20 * 60 * 60 * 1000); // 20h from now
  const windowEnd = new Date(now.getTime() + 28 * 60 * 60 * 1000);   // 28h from now

  // Find upcoming appointments without a brief
  const upcoming = await db
    .select({ id: appointments.id, patientId: appointments.patientId })
    .from(appointments)
    .where(
      and(
        eq(appointments.status, "confirmed"),
        between(appointments.scheduledAt, windowStart, windowEnd),
      )
    )
    .limit(50);

  if (upcoming.length === 0) {
    return NextResponse.json({ message: "No upcoming appointments requiring briefs", count: 0 });
  }

  // Filter out appointments that already have a brief
  const existingBriefs = await db
    .select({ appointmentId: previsitBriefs.appointmentId })
    .from(previsitBriefs)
    .where(
      and(
        isNull(previsitBriefs.viewedAt), // only re-check unviewed
      )
    );

  const existingSet = new Set(existingBriefs.map((b) => b.appointmentId));
  const toGenerate = upcoming.filter((a) => !existingSet.has(a.id));

  if (toGenerate.length === 0) {
    return NextResponse.json({ message: "All upcoming appointments already have briefs", count: 0 });
  }

  // Fire-and-forget brief generation for each appointment
  let fired = 0;
  for (const appt of toGenerate) {
    if (!env.INTERNAL_API_KEY || !env.APP_BASE_URL) continue;
    void fetch(`${env.APP_BASE_URL}/api/internal/generate-brief`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": env.INTERNAL_API_KEY,
      },
      body: JSON.stringify({ appointmentId: appt.id }),
    }).catch(() => { /* non-fatal */ });
    fired++;
  }

  return NextResponse.json({
    message: `Triggered brief generation for ${fired} appointments`,
    count: fired,
  });
};
