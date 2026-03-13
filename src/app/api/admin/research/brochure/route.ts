import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { ensureRole } from "@/lib/rbac";

const brochureSchema = z.object({
  rawText: z.string().min(20).max(60000),
  sourceHint: z.string().max(200).optional(),
  cityHint: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  if (!env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: "Gemini AI is not configured." }, { status: 503 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = brochureSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 400 });
  }

  const { rawText, sourceHint, cityHint } = parsed.data;

  const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const prompt = `You are a healthcare data extraction specialist. Extract structured information from the following brochure or document text.

Source hint: ${sourceHint ?? "unknown"}
City hint: ${cityHint ?? "unknown"}

Document content:
---
${rawText}
---

Extract and return a JSON object with this exact structure:
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
  "notes": "any important observations about the data quality or completeness"
}

Return ONLY the JSON object, no markdown, no extra text.`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        return NextResponse.json({ error: "Could not parse AI extraction response." }, { status: 500 });
      }
      extracted = JSON.parse(match[0]);
    }

    return NextResponse.json({ data: extracted });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Extraction failed: ${err.message ?? "unknown error"}` },
      { status: 500 },
    );
  }
}
