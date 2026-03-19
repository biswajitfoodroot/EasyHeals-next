/**
 * Health Memory Writer — writeMemoryEvents()
 *
 * Normalizes health events from any source into health_memory_events table.
 * All data is AES-256-GCM encrypted before insert (encryptPHI).
 * Called by: document extractor, ABHA importer, EMR bridge (future).
 *
 * PHI SAFETY: Never log the `data` field or the encrypted ciphertext.
 */

import { db } from "@/db/client";
import { healthMemoryEvents } from "@/db/schema";
import { encryptPHI } from "./encryption";

export type HealthEventSource =
  | "emr_visit"
  | "prescription"
  | "lab_report"
  | "device"
  | "document"
  | "self_report"
  | "abha";

export type HealthEventType =
  | "vital"
  | "lab_result"
  | "diagnosis"
  | "medication"
  | "procedure"
  | "device_reading";

export interface RawHealthEvent {
  eventType: HealthEventType;
  eventDate: Date;
  sourceRefId?: string;
  data: Record<string, unknown>; // e.g. { name, value, unit, codes, notes, ... }
}

/**
 * Insert one or more health events for a patient.
 * Each event's `data` is encrypted with encryptPHI before insert.
 *
 * @param patientId  Patient UUID
 * @param source     Origin of the events (document, abha, emr_visit, etc.)
 * @param events     Array of raw events to persist
 */
export async function writeMemoryEvents(
  patientId: string,
  source: HealthEventSource,
  events: RawHealthEvent[],
): Promise<void> {
  if (events.length === 0) return;

  const rows = events.map((e) => ({
    patientId,
    source,
    sourceRefId: e.sourceRefId ?? null,
    eventType: e.eventType,
    eventDate: e.eventDate,
    dataEncrypted: encryptPHI(e.data),
    isActive: true,
  }));

  // Insert in batches of 50 to avoid SQLite param limit
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(healthMemoryEvents).values(rows.slice(i, i + BATCH));
  }
}
