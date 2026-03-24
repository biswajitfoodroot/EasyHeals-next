import { NextRequest, NextResponse } from "next/server";

import { getGeminiClient } from "@/lib/ai/client";
import { requireAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { ensureRole } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  if (!env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: "Gemini AI is not configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { slug, title, type, existingDescription } = body as {
    slug?: string;
    title?: string;
    type?: string;
    existingDescription?: string;
  };

  if (!slug || !title || !type) {
    return NextResponse.json({ error: "slug, title, and type are required" }, { status: 400 });
  }

  const model = getGeminiClient().getGenerativeModel({
    model: env.GEMINI_MODEL ?? "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  const prompt = `You are a medical content writer for EasyHeals, an Indian healthcare platform.
Generate structured patient-friendly content for: "${title}" (type: ${type}, slug: ${slug})
${existingDescription ? `Existing description: ${existingDescription}` : ""}

Return ONLY valid JSON matching this schema exactly:
{ description, causes, possibleProblems, homeCare, whenToVisit, nextSteps, relatedProcedures (array of strings), seoTitle, seoDescription, seoKeywords (array of strings), names: { hi, mr, ta, bn, ml, kn, te, ar, si } }

STRICT FORMATTING RULES — follow exactly:
- ALL text fields: PLAIN TEXT only. No markdown, no asterisks, no bold, no bullet symbols, no hyphens as bullets.
- BREVITY: Every text field must be a concise synopsis — maximum 2 short sentences or a comma-separated list of 4-5 key points. Never more than 5 lines of text per field.
- description: 1-2 sentences, plain synopsis of what it is.
- causes / possibleProblems: comma-separated list of 4-5 key reasons/conditions (e.g. "Blocked arteries, chest pain, heart attack risk, diabetes complications").
- nextSteps / whenToVisit / homeCare: 2-3 short actionable sentences maximum.
- relatedProcedures: array of 3-6 procedure/test name strings only (no descriptions).
- seoTitle: under 65 chars.
- seoDescription: under 130 chars, plain synopsis.
- names: translated name only (1-3 words per language, not a sentence).
- India-specific, patient-friendly language.
- For specialties: fill possibleProblems, homeCare, whenToVisit — leave causes and nextSteps as empty strings "".
- For treatments/procedures: fill causes and nextSteps — leave possibleProblems, homeCare, whenToVisit as empty strings "".`;

  let content: Record<string, unknown>;
  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    // Strip markdown code fences if present
    const jsonText = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    content = JSON.parse(jsonText) as Record<string, unknown>;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `AI generation failed: ${msg}` }, { status: 502 });
  }

  return NextResponse.json({ content });
}
