import { and, asc, like, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/ai/client";
import { z } from "zod";

import { db } from "@/db/client";
import { hospitals, taxonomyNodes } from "@/db/schema";
import { env } from "@/lib/env";

const requestSchema = z.object({
  query: z.string().min(2).max(200),
  city: z.string().max(80).optional(),
  mode: z.enum(["all", "treatment", "hospital", "doctor", "symptom", "specialty"]).default("all"),
});

type AiPayload = {
  answer: string;
  suggestions: string[];
  highlights: string[];
};

function safeParseJson(text: string): AiPayload | null {
  const stripped = text.trim();
  const jsonCandidate = stripped.includes("```")
    ? stripped.replace(/```json|```/g, "").trim()
    : stripped;

  try {
    const parsed = JSON.parse(jsonCandidate) as AiPayload;
    if (!parsed?.answer || !Array.isArray(parsed?.suggestions)) {
      return null;
    }

    return {
      answer: parsed.answer,
      suggestions: parsed.suggestions.slice(0, 6),
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.slice(0, 4) : [],
    };
  } catch {
    return null;
  }
}

async function fetchContext(query: string, city?: string, mode?: string) {
  const normalized = `%${query.trim()}%`;

  const hospitalFilters = [];
  if (city) hospitalFilters.push(like(hospitals.city, city));
  hospitalFilters.push(or(like(hospitals.name, normalized), like(hospitals.city, normalized)));

  const hospitalRows = await db
    .select({
      id: hospitals.id,
      name: hospitals.name,
      slug: hospitals.slug,
      city: hospitals.city,
      state: hospitals.state,
    })
    .from(hospitals)
    .where(and(...hospitalFilters))
    .orderBy(asc(hospitals.name))
    .limit(8);

  const taxonomyType =
    mode === "all" || mode === "hospital" || mode === "doctor"
      ? undefined
      : mode === "specialty"
        ? "specialty"
        : mode;

  const taxonomyRows = await db
    .select({
      id: taxonomyNodes.id,
      title: taxonomyNodes.title,
      slug: taxonomyNodes.slug,
      type: taxonomyNodes.type,
    })
    .from(taxonomyNodes)
    .where(
      and(
        taxonomyType ? like(taxonomyNodes.type, taxonomyType) : undefined,
        or(like(taxonomyNodes.title, normalized), like(taxonomyNodes.description, normalized)),
      ),
    )
    .orderBy(asc(taxonomyNodes.title))
    .limit(10);

  return { hospitalRows, taxonomyRows };
}

async function runGemini(query: string, mode: string, city: string | undefined, context: Awaited<ReturnType<typeof fetchContext>>) {
  if (!env.GEMINI_API_KEY) {
    return null;
  }

  const model = getGeminiClient().getGenerativeModel({ model: env.GEMINI_MODEL });

  const prompt = `
You are EasyHeals AI Search Assistant.

User query: ${query}
Search mode: ${mode}
City: ${city ?? "Not specified"}

Candidate hospitals:
${context.hospitalRows.map((h) => `- ${h.name} (${h.city}${h.state ? `, ${h.state}` : ""})`).join("\n") || "- none"}

Candidate taxonomy:
${context.taxonomyRows.map((t) => `- ${t.title} [${t.type}]`).join("\n") || "- none"}

Respond ONLY as valid JSON with this schema:
{
  "answer": "short helpful answer in <= 120 words",
  "suggestions": ["next query 1", "next query 2", "next query 3"],
  "highlights": ["key point 1", "key point 2", "key point 3"]
}
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return safeParseJson(text);
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const parsed = requestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid search request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { query, city, mode } = parsed.data;
    const context = await fetchContext(query, city, mode);
    const aiResult = await runGemini(query, mode, city, context);

    const fallback: AiPayload = {
      answer: `Here are matched options for "${query}". Refine by city or mode for sharper results.`,
      suggestions: [
        `${query} in Pune`,
        `${query} by top specialty`,
        `${query} with low waiting time`,
      ],
      highlights: [
        `${context.hospitalRows.length} hospital matches`,
        `${context.taxonomyRows.length} category matches`,
      ],
    };

    return NextResponse.json({
      data: {
        response: aiResult ?? fallback,
        hospitals: context.hospitalRows,
        taxonomy: context.taxonomyRows,
        model: aiResult ? env.GEMINI_MODEL : "fallback",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Search failed", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
