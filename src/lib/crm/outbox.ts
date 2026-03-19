/**
 * CRM Event Outbox
 *
 * publishEvent() inserts an event into the outbox_events table for
 * reliable async delivery to CRM webhooks / integrations.
 *
 * Outbox pattern guarantees at-least-once delivery even if the downstream
 * consumer is temporarily unavailable. A background worker (P2) will pick up
 * rows with status='pending' and deliver them.
 *
 * P1 usage: lead.created, lead.status_changed, patient.registered
 * P2 usage: appointment.booked, appointment.cancelled, broadcast.sent
 */

import { db } from "@/db/client";
import { outboxEvents } from "@/db/schema";
import { logger } from "@/lib/errors/app-error";

export type CrmTopic =
  | "lead.created"
  | "lead.status_changed"
  | "lead.assigned"
  | "patient.registered"
  | "patient.consent_granted"
  | "patient.consent_revoked"
  | "appointment.booked"
  | "appointment.cancelled"
  | "appointment.completed"
  | "appointment.created"
  | "broadcast.sent"
  | "membership.activated";

export type OutboxPayload = Record<string, unknown>;

/**
 * Insert an event into the CRM outbox for async delivery.
 *
 * This function never throws — failures are logged but do not affect
 * the calling transaction. Outbox writes should be best-effort.
 */
export async function publishEvent(
  topic: CrmTopic,
  payload: OutboxPayload,
): Promise<void> {
  try {
    await db.insert(outboxEvents).values({
      topic,
      payload: payload as Record<string, unknown>,
      status: "pending",
      availableAt: new Date(), // available immediately
    });
  } catch (err) {
    // Non-fatal — log and continue. A missing outbox event is recoverable;
    // failing the lead/appointment write is not.
    logger.error({
      code: "CRM_WEBHOOK_FAILED",
      message: "Failed to insert outbox event",
      topic,
      err,
    });
  }
}
