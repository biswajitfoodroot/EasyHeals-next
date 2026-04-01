/**
 * POST /api/public/track — Anonymous conversion funnel event ingestion
 *
 * No auth required. Rate-limited by IP (20 req/min).
 * Patient ID populated retroactively when session_id matches authenticated events.
 *
 * Body: { event, sessionId, entityType?, entityId?, metadata? }
 *
 * Flag: conversion_analytics (skips insert silently if OFF — still returns 200)
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/db/client";
import { funnelEvents } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { redisGet, redisSet } from "@/lib/core/redis";

const ALLOWED_EVENTS = new Set([
  "search",
  "profile_view",
  "cta_click",
  "booking_start",
  "booking_complete",
  "review_submitted",
  "care_nav_match",
  "care_nav_booked",
]);

const ALLOWED_ENTITY_TYPES = new Set(["hospital", "doctor", "treatment", "care_nav"]);

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 20 req/min per IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);
    const rateLimitKey = `funnel:rl:${ipHash}`;

    const current = await redisGet<number>(rateLimitKey).catch(() => null);
    if (current !== null && current >= 20) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }
    void redisSet(rateLimitKey, (current ?? 0) + 1, 60).catch(() => null);

    const body = await req.json().catch(() => null) as {
      event: string;
      sessionId: string;
      entityType?: string;
      entityId?: string;
      metadata?: Record<string, unknown>;
    } | null;

    if (!body?.event || !body?.sessionId) {
      return NextResponse.json({ ok: false, error: "event and sessionId required" }, { status: 400 });
    }

    if (!ALLOWED_EVENTS.has(body.event)) {
      return NextResponse.json({ ok: true }); // silently ignore unknown events
    }

    if (body.entityType && !ALLOWED_ENTITY_TYPES.has(body.entityType)) {
      return NextResponse.json({ ok: true });
    }

    // Check flag — skip write if OFF (still return 200 so clients don't need to know)
    const enabled = await isFeatureEnabled("conversion_analytics").catch(() => false);
    if (!enabled) return NextResponse.json({ ok: true });

    // Strip any PHI from metadata before storing
    const safeMeta = body.metadata
      ? Object.fromEntries(
          Object.entries(body.metadata).filter(([k]) =>
            !["phone", "email", "name", "patientId"].includes(k)
          )
        )
      : null;

    await db.insert(funnelEvents).values({
      sessionId: body.sessionId.slice(0, 64),
      eventType: body.event,
      entityType: body.entityType ?? null,
      entityId: body.entityId ?? null,
      metadata: safeMeta,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
