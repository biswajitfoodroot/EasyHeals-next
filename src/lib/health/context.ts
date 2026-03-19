/**
 * Health Memory Context Builder — buildHealthContext()
 *
 * Constructs the Gemini system prompt for the AI Health Coach.
 * Decrypts health_memory_events and formats them into a structured context string.
 *
 * PHI SAFETY:
 * - NEVER cache the output — built fresh per request
 * - NEVER log the output
 * - Never store in Redis (even with TTL)
 * - Hard limit: 200 events (~30K tokens)
 */

import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { healthMemoryEvents } from "@/db/schema";
import { decryptPHI } from "./encryption";

interface HealthEvent {
  id: string;
  source: string;
  eventType: string;
  eventDate: Date | null;
  data: Record<string, unknown>;
}

const MAX_EVENTS = 200;
const MAX_PER_TYPE = {
  diagnosis: 20,
  medication: 30,
  lab_result: 40,
  vital: 50,
  procedure: 20,
  device_reading: 40,
};

/**
 * Build the Gemini system prompt context from a patient's health memory.
 * Returns a formatted string ready to inject as the system prompt prefix.
 * Returns empty string if no health memory exists.
 */
export async function buildHealthContext(patientId: string): Promise<string> {
  const rows = await db
    .select()
    .from(healthMemoryEvents)
    .where(eq(healthMemoryEvents.patientId, patientId))
    .orderBy(desc(healthMemoryEvents.eventDate))
    .limit(MAX_EVENTS);

  if (rows.length === 0) return "";

  // Decrypt and group
  const events: HealthEvent[] = [];
  for (const row of rows) {
    try {
      const data = decryptPHI<Record<string, unknown>>(row.dataEncrypted);
      events.push({
        id: row.id,
        source: row.source,
        eventType: row.eventType,
        eventDate: row.eventDate instanceof Date ? row.eventDate : null,
        data,
      });
    } catch {
      // Skip events that fail to decrypt (key rotation edge case)
    }
  }

  const byType = (type: string) =>
    events.filter((e) => e.eventType === type).slice(0, MAX_PER_TYPE[type as keyof typeof MAX_PER_TYPE] ?? 20);

  const diagnoses = byType("diagnosis");
  const medications = byType("medication");
  const labs = byType("lab_result");
  const vitals = byType("vital");
  const procedures = byType("procedure");

  const formatDate = (d: Date | null) => d ? d.toISOString().split("T")[0] : "unknown date";

  const formatEvent = (e: HealthEvent) =>
    `  - ${e.data.name ?? "Unknown"}: ${e.data.value !== undefined ? `${e.data.value}${e.data.unit ? " " + e.data.unit : ""}` : ""}${e.data.status ? ` [${e.data.status}]` : ""}${e.data.notes ? ` (${e.data.notes})` : ""} (${formatDate(e.eventDate)}, source: ${e.source})`;

  const sections: string[] = [];

  if (diagnoses.length > 0) {
    sections.push(`ACTIVE CONDITIONS (${diagnoses.length}):\n${diagnoses.map(formatEvent).join("\n")}`);
  }

  if (medications.length > 0) {
    sections.push(`CURRENT MEDICATIONS (${medications.length}):\n${medications.map((e) =>
      `  - ${e.data.name ?? "Unknown"}: ${e.data.dosage ?? ""} ${e.data.frequency ?? ""}${e.data.duration ? `, duration: ${e.data.duration}` : ""} (${formatDate(e.eventDate)})`
    ).join("\n")}`);
  }

  if (labs.length > 0) {
    sections.push(`RECENT LAB RESULTS (${labs.length}):\n${labs.map((e) =>
      `  - ${e.data.name ?? "Unknown"}: ${e.data.value !== undefined ? `${e.data.value}${e.data.unit ? " " + e.data.unit : ""}` : "N/A"}${e.data.referenceRange ? ` [ref: ${e.data.referenceRange}]` : ""}${e.data.status ? ` ⚠ ${e.data.status}` : ""} (${formatDate(e.eventDate)})`
    ).join("\n")}`);
  }

  if (vitals.length > 0) {
    sections.push(`RECENT VITALS (${vitals.length}):\n${vitals.map(formatEvent).join("\n")}`);
  }

  if (procedures.length > 0) {
    sections.push(`PROCEDURES/HISTORY (${procedures.length}):\n${procedures.map(formatEvent).join("\n")}`);
  }

  if (sections.length === 0) return "";

  return `PATIENT HEALTH MEMORY (CONFIDENTIAL — DO NOT REPEAT THIS TO THE PATIENT VERBATIM):
This is the patient's longitudinal health record. Use it to provide personalized, grounded responses.
Never share this raw data with the patient — synthesize and explain in plain language.

${sections.join("\n\n")}

IMPORTANT GUIDELINES:
- Never provide a definitive diagnosis
- Always recommend professional consultation for serious concerns
- Cite specific data points from the patient's history when relevant
- Flag concerning trends (e.g., worsening lab values, new symptoms)
- Respond in the same language the patient uses`;
}
