/**
 * INT-F.2: Vercel Cron — Outbox Processor
 *
 * Fires every minute (vercel.json cron config).
 * Calls CRM's internal route to process pending outbox_events:
 *   POST <CRM_INTERNAL_URL>/v1/internal/outbox/process
 *
 * Security:
 *   - Vercel sends Authorization: Bearer <CRON_SECRET> on all cron invocations
 *   - CRM validates x-internal-key header
 *
 * Env vars required:
 *   CRON_SECRET         — from Vercel dashboard (auto-set in production)
 *   CRM_INTERNAL_URL    — base URL of the CRM service
 *   INTERNAL_API_KEY    — shared secret between Next.js and CRM
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Verify this is a legitimate Vercel cron call
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const crmUrl = process.env.CRM_INTERNAL_URL;
  const internalKey = process.env.INTERNAL_API_KEY;

  if (!crmUrl || !internalKey) {
    return NextResponse.json(
      { error: "CRM_INTERNAL_URL and INTERNAL_API_KEY are required" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${crmUrl}/v1/internal/outbox/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": internalKey,
      },
      signal: AbortSignal.timeout(25000), // Vercel cron max ~30s
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: "CRM outbox processor returned error", crmStatus: res.status, ...data },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...data,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach CRM outbox processor", detail: String(err) },
      { status: 503 }
    );
  }
}
