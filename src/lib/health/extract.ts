/**
 * Health Document Extraction — Gemini Vision
 *
 * Fetches a document from Vercel Blob and sends it to Gemini Vision
 * to extract structured health events: diagnoses, medications, labs, vitals.
 *
 * PHI SAFETY: Never log the extracted data. Callers must encrypt via encryptPHI.
 * Called exclusively from /api/internal/extract-document (async, not in upload path).
 */

import { getGeminiClient } from "@/lib/ai/client";
import { blobFetch } from "@/lib/storage/blob";
import { env } from "@/lib/env";
import type { RawHealthEvent } from "./memory-writer";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractedHealthData {
  docType: string | null;       // lab_report | prescription | discharge | imaging | other
  sourceName: string | null;    // hospital/lab name
  docDate: Date | null;         // date of the document
  title: string | null;         // inferred document title
  events: RawHealthEvent[];     // normalized health events
}

// ── Extraction Prompt ─────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a medical document parser. Extract all health information from this document.

Return ONLY valid JSON with this exact structure:
{
  "docType": "lab_report" | "prescription" | "discharge" | "imaging" | "other",
  "sourceName": "hospital or lab name, or null",
  "docDate": "YYYY-MM-DD or null",
  "title": "brief document title, or null",
  "events": [
    {
      "eventType": "vital" | "lab_result" | "diagnosis" | "medication" | "procedure",
      "eventDate": "YYYY-MM-DD",
      "data": {
        "name": "test/medicine/condition name",
        "value": "numeric value or null",
        "value2": "second value (e.g. diastolic BP) or null",
        "unit": "unit of measurement or null",
        "referenceRange": "normal range string or null",
        "status": "normal" | "high" | "low" | "abnormal" | null,
        "codes": { "icd10": "code or null", "loinc": "code or null" },
        "dosage": "dosage for medications or null",
        "frequency": "frequency for medications or null",
        "duration": "duration for medications or null",
        "notes": "any additional notes or null"
      }
    }
  ]
}

Rules:
- Extract ALL test results, diagnoses, medications, vitals, and procedures
- Use the document date for all events if individual dates are not specified
- For lab reports: each test result is a separate event with eventType "lab_result"
- For prescriptions: each medicine is a separate event with eventType "medication"
- For discharge summaries: include diagnoses, medications, procedures, and vitals
- If a field cannot be determined, use null
- Return empty events array if no health data found
- Do NOT include any explanation — return ONLY the JSON object`;

// ── Main Function ─────────────────────────────────────────────────────────────

/**
 * Fetch a document from blobUrl and extract structured health data using Gemini Vision.
 * Returns normalized events ready to be passed to writeMemoryEvents().
 */
export async function extractHealthDocument(
  blobUrl: string,
  fileType: string, // pdf | jpg | png | webp
): Promise<ExtractedHealthData> {
  if (!env.GOOGLE_AI_API_KEY) {
    return { docType: null, sourceName: null, docDate: null, title: null, events: [] };
  }

  // Fetch the document bytes (handles both Vercel Blob and local fallback URLs)
  const buffer = await blobFetch(blobUrl);
  const base64Data = buffer.toString("base64");

  // Map file type to MIME type
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  const mimeType = mimeMap[fileType.toLowerCase()] ?? "application/pdf";

  // Call Gemini Vision
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL ?? "gemini-2.5-flash" });

  const result = await model.generateContent({
    contents: [{
      role: "user",
      parts: [
        { text: EXTRACTION_PROMPT },
        { inlineData: { mimeType, data: base64Data } },
      ],
    }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1, // low temp for structured extraction
    },
  });

  const rawText = result.response.text().trim();
  let parsed: {
    docType?: string;
    sourceName?: string;
    docDate?: string;
    title?: string;
    events?: Array<{
      eventType: string;
      eventDate?: string;
      data: Record<string, unknown>;
    }>;
  };

  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { docType: null, sourceName: null, docDate: null, title: null, events: [] };
  }

  const docDate = parsed.docDate ? new Date(parsed.docDate) : null;

  const events: RawHealthEvent[] = (parsed.events ?? [])
    .filter((e) => e.eventType && e.data)
    .map((e) => ({
      eventType: e.eventType as RawHealthEvent["eventType"],
      eventDate: e.eventDate ? new Date(e.eventDate) : (docDate ?? new Date()),
      data: e.data,
    }));

  return {
    docType: parsed.docType ?? null,
    sourceName: parsed.sourceName ?? null,
    docDate,
    title: parsed.title ?? null,
    events,
  };
}
