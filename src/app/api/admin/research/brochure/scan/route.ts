import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { ensureRole } from "@/lib/rbac";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

const EXTRACTION_PROMPT = `You are a healthcare data extraction specialist. This is a scanned hospital brochure, document, or photo. Extract all structured information visible in it.

Extract and return a JSON object with this exact structure (no markdown, no extra text):
{
  "hospital": {
    "name": "string",
    "type": "hospital" | "clinic" | "nursing_home",
    "city": "string or null",
    "state": "string or null",
    "addressLine1": "string or null",
    "phone": "string or null",
    "email": "string or null",
    "website": "string or null",
    "description": "string — 2-3 sentence summary",
    "specialties": ["array of specialty strings"],
    "facilities": ["array of facility strings"],
    "workingHours": { "Monday": "9am-6pm", ... } or null,
    "accreditations": ["NABH", "JCI", etc.] or []
  },
  "doctors": [
    {
      "fullName": "string",
      "qualifications": ["MBBS", "MD", etc.],
      "specialization": "string or null",
      "yearsOfExperience": number or null,
      "consultationFee": number or null,
      "opdTiming": "string or null",
      "bio": "string or null"
    }
  ],
  "packages": [
    {
      "packageName": "string",
      "procedureName": "string or null",
      "department": "string or null",
      "priceMin": number or null,
      "priceMax": number or null,
      "lengthOfStay": "string or null",
      "inclusions": ["array of strings"] or null
    }
  ],
  "services": ["array of service/treatment strings"],
  "confidence": 0.0-1.0,
  "notes": "any important observations about data quality, readability, or completeness"
}`;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  if (!env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: "Gemini AI is not configured." }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not parse form data." }, { status: 400 });
  }

  const file = formData.get("file");
  const sourceHint = formData.get("sourceHint") as string | null;
  const cityHint = formData.get("cityHint") as string | null;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type "${file.type}". Upload a PDF or image (JPEG, PNG, WebP, HEIC).` },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max allowed: 12 MB.` },
      { status: 400 },
    );
  }

  // Convert file to base64
  const arrayBuffer = await file.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString("base64");

  const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const contextNote = [
    sourceHint ? `Source: ${sourceHint}` : null,
    cityHint ? `City context: ${cityHint}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const promptWithContext = contextNote
    ? `${contextNote}\n\n${EXTRACTION_PROMPT}`
    : EXTRACTION_PROMPT;

  try {
    const result = await model.generateContent([
      { inlineData: { data: base64Data, mimeType: file.type } },
      promptWithContext,
    ]);

    const raw = result.response.text();

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        return NextResponse.json(
          { error: "Could not parse AI response. The document may be unreadable." },
          { status: 500 },
        );
      }
      extracted = JSON.parse(match[0]);
    }

    return NextResponse.json({ data: extracted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: `Scan failed: ${msg}` }, { status: 500 });
  }
}
