/**
 * POST /api/v1/patients/prescription-scan — AI Prescription Reader
 *
 * Accepts a prescription image (base64) or PDF and uses Gemini vision
 * to extract medication details (name, dosage, frequency, duration).
 *
 * Auth:    eh_patient_session cookie
 * Premium: requirePremiumAccess (trial or paid subscription)
 *
 * Body (multipart/form-data):
 *   file: image (jpg/png/webp) or PDF — max 10 MB
 *
 * Response:
 *   { medications: Array<{ name, dosage, frequency, duration, notes }> }
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePatientSession } from "@/lib/core/patient-session";
import { requirePremiumAccess } from "@/lib/core/patient-trial";
import { withErrorHandler } from "@/lib/errors/app-error";
import { getGeminiClient, generateWithTimeout } from "@/lib/ai/client";
import { env } from "@/lib/env";

export const maxDuration = 30;

const ALLOWED_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "application/pdf",
];

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

interface ExtractedMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes: string;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);
  await requirePremiumAccess(session.patientId);

  // Parse multipart
  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Please upload a valid image or PDF." }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Please upload a prescription image or PDF." }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Upload a JPG, PNG, WebP image or PDF." }, { status: 400 });
  }

  const arrayBuf = await file.arrayBuffer();
  if (arrayBuf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Maximum file size is 10 MB." }, { status: 400 });
  }

  const base64Data = Buffer.from(arrayBuf).toString("base64");

  const prompt = `You are a medical data extraction assistant. Carefully read this prescription image and extract all medications.

For EACH medication found, provide a JSON object with these exact fields:
- name: medication name (generic or brand)
- dosage: strength/dose (e.g. "500mg", "10mg/5ml")
- frequency: how often (e.g. "Once daily", "Twice daily", "TID - three times a day")
- duration: how long to take (e.g. "7 days", "1 month", "Ongoing", "As needed")
- notes: special instructions (e.g. "After meals", "At bedtime", "Avoid sunlight")

Return ONLY a valid JSON array like:
[
  { "name": "...", "dosage": "...", "frequency": "...", "duration": "...", "notes": "..." }
]

If you cannot read the prescription or find no medications, return an empty array [].
Do not include any text before or after the JSON array.`;

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL });

  const result = await generateWithTimeout(
    () => model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "application/pdf", data: base64Data } },
    ]),
    25_000,
  );

  const raw = result.response.text().trim();

  // Parse JSON — strip markdown fences if present
  let medications: ExtractedMedication[] = [];
  try {
    const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    medications = JSON.parse(jsonStr) as ExtractedMedication[];
    if (!Array.isArray(medications)) medications = [];
  } catch {
    // If parsing fails, return empty (don't crash)
    medications = [];
  }

  return NextResponse.json({ medications });
});
