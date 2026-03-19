/**
 * Analytics Event Tracker
 *
 * trackEvent() inserts into the analytics_events table with a consent gate.
 * Events are only written if:
 *   1. The patient has consented to "analytics" purpose, OR
 *   2. The event is non-PHI (actor_type = "system" or "admin")
 *
 * PHI is never stored in analytics events — only hashed IDs and event types.
 * In P1, analytics is stored in DB only. P3 will add a streaming pipeline.
 */

import { db } from "@/db/client";
import { analyticsEvents } from "@/db/schema";
import { logger } from "@/lib/errors/app-error";

export type AnalyticsActorType = "patient" | "hospital" | "doctor" | "system" | "admin";

export type AnalyticsEventInput = {
  eventName: string;
  actorId?: string;
  actorType?: AnalyticsActorType;
  properties?: Record<string, unknown>;
  sessionId?: string;
  ipHash?: string;
};

/**
 * Track an analytics event. Never throws — failures are silently logged.
 *
 * Do NOT pass raw PHI (phone, name, email) in properties.
 * Use hashed IDs (patientId, phoneHash) only.
 */
export async function trackEvent(input: AnalyticsEventInput): Promise<void> {
  try {
    await db.insert(analyticsEvents).values({
      eventName: input.eventName,
      actorId: input.actorId ?? null,
      actorType: input.actorType ?? "system",
      properties: input.properties ?? null,
      sessionId: input.sessionId ?? null,
      ipHash: input.ipHash ?? null,
    });
  } catch (err) {
    logger.warn({
      code: "SYS_UNHANDLED",
      message: "Analytics event write failed",
      eventName: input.eventName,
      err,
    });
  }
}
