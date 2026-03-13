import { createHash } from "crypto";
import { and, asc, eq, like, or, type SQL } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctors, hospitals, searchLogs } from "@/db/schema";
import { env } from "@/lib/env";
import { extractSearchIntent } from "@/lib/gemini";

const historySchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1).max(500),
});

const requestSchema = z.object({
  query: z.string().min(2).max(240),
  city: z.string().min(2).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  history: z.array(historySchema).max(12).optional(),
});

type SearchResultItem = {
  id: string;
  type: "hospital" | "doctor";
  name: string;
  slug: string;
  city: string;
  state: string | null;
  rating: number;
  verified: boolean;
  communityVerified: boolean;
  specialties: string[];
  source: string;
  score: number;
  description: string | null;
  profileUrl: string;
  phone: string | null;
};

type AssistantResponse = {
  answer: string;
  followUps: string[];
  clarifyQuestion: string | null;
  confidenceHint: string;
};

const TERM_SYNONYMS: Record<string, string[]> = {
  cardiology: ["heart", "cardiac", "angioplasty", "bypass"],
  ortho: ["orthopaedic", "joint", "knee", "bone", "spine"],
  neurology: ["brain", "stroke", "seizure", "migraine"],
  maternity: ["pregnancy", "delivery", "gynae", "ivf"],
  oncology: ["cancer", "tumor", "chemo", "radiation"],
  diagnostic: ["lab", "scan", "mri", "ct", "xray"],
};

function normalizeSpecialties(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").slice(0, 8);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string").slice(0, 8);
      }
    } catch {
      return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8);
    }
  }

  return [];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 20);
}

function buildTerms(query: string, intent: Awaited<ReturnType<typeof extractSearchIntent>>): string[] {
  const terms = new Set<string>();

  for (const token of tokenize(query)) terms.add(token);
  for (const token of tokenize(intent.translatedQuery)) terms.add(token);
  for (const symptom of intent.symptoms) {
    for (const token of tokenize(symptom)) terms.add(token);
  }

  for (const synonym of TERM_SYNONYMS[intent.specialtyKey] ?? []) {
    terms.add(synonym.toLowerCase());
  }

  const specialtyTokens = tokenize(intent.specialty);
  for (const token of specialtyTokens) terms.add(token);

  return Array.from(terms).slice(0, 24);
}

function rankResult(
  item: {
    type: "hospital" | "doctor";
    name: string;
    city: string;
    description: string | null;
    verified: boolean;
    communityVerified: boolean;
    rating: number;
    specialties: unknown;
  },
  city: string | undefined,
  intent: Awaited<ReturnType<typeof extractSearchIntent>>,
  terms: string[],
): number {
  let score = 0;

  const specialtyText = normalizeSpecialties(item.specialties).join(" ").toLowerCase();
  const combinedText = `${item.name} ${item.city} ${item.description ?? ""} ${specialtyText}`.toLowerCase();

  const tokenHits = terms.reduce((total, token) => total + (combinedText.includes(token) ? 1 : 0), 0);
  score += Math.min(tokenHits, 9) * 0.88;

  if (item.verified) score += 2.1;
  if (item.communityVerified) score += 1.2;
  score += Math.min(item.rating, 5) * 0.55;

  if (city && item.city.toLowerCase() === city.toLowerCase()) score += 1.8;

  if (intent.specialtyKey !== "general") {
    if (
      specialtyText.includes(intent.specialty.toLowerCase()) ||
      specialtyText.includes(intent.specialtyKey.toLowerCase())
    ) {
      score += 1.7;
    }
  }

  if (
    intent.searchType === "hospital_name" &&
    item.type === "hospital" &&
    item.name.toLowerCase().includes(intent.translatedQuery.toLowerCase())
  ) {
    score += 1.5;
  }

  if (
    intent.searchType === "doctor_name" &&
    item.type === "doctor" &&
    item.name.toLowerCase().includes(intent.translatedQuery.toLowerCase())
  ) {
    score += 1.5;
  }

  return Number(score.toFixed(2));
}

function buildFallbackAssistant(
  query: string,
  cityFilter: string | undefined,
  intent: Awaited<ReturnType<typeof extractSearchIntent>>,
  resultCount: number,
): AssistantResponse {
  const cityText = cityFilter ? ` in ${cityFilter}` : "";
  const clarifyQuestion =
    !cityFilter && intent.searchType !== "doctor_name"
      ? "Which city should I prioritize for better matches?"
      : null;

  return {
    answer:
      resultCount > 0
        ? `I found ${resultCount} doctor and hospital options${cityText}. You can refine by city, budget, or verification status.`
        : `I could not find strong matches for "${query}". Try adding city, specialty, or treatment keyword.`,
    followUps: [
      cityFilter ? `${intent.specialty} near me` : `${query} in Pune`,
      `${query} only verified`,
      `${query} affordable`,
      `${query} with high rating`,
    ],
    clarifyQuestion,
    confidenceHint: intent.confidence >= 0.7 ? "high" : intent.confidence >= 0.45 ? "medium" : "low",
  };
}

function parseAssistantJson(text: string): AssistantResponse | null {
  const stripped = text.includes("```") ? text.replace(/```json|```/g, "").trim() : text.trim();

  try {
    const parsed = JSON.parse(stripped) as Partial<AssistantResponse>;
    if (!parsed.answer || !Array.isArray(parsed.followUps)) return null;

    return {
      answer: parsed.answer,
      followUps: parsed.followUps.filter((value): value is string => typeof value === "string").slice(0, 5),
      clarifyQuestion: parsed.clarifyQuestion ?? null,
      confidenceHint: ["low", "medium", "high"].includes(parsed.confidenceHint ?? "")
        ? (parsed.confidenceHint as string)
        : "medium",
    };
  } catch {
    return null;
  }
}

async function generateAssistant(params: {
  query: string;
  cityFilter: string | undefined;
  history: Array<{ role: "user" | "assistant"; text: string }>;
  intent: Awaited<ReturnType<typeof extractSearchIntent>>;
  topResults: SearchResultItem[];
}): Promise<{ assistant: AssistantResponse; model: string; degraded: boolean }> {
  const fallback = buildFallbackAssistant(
    params.query,
    params.cityFilter,
    params.intent,
    params.topResults.length,
  );

  if (!env.GOOGLE_AI_API_KEY) {
    return { assistant: fallback, model: "fallback", degraded: true };
  }

  try {
    const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
    const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL });

    const historyText = params.history.length
      ? params.history
          .slice(-6)
          .map((item) => `${item.role.toUpperCase()}: ${item.text}`)
          .join("\n")
      : "No prior context";

    const topText = params.topResults.length
      ? params.topResults
          .slice(0, 6)
          .map(
            (item) =>
              `- [${item.type}] ${item.name} (${item.city}${item.state ? `, ${item.state}` : ""}) | rating ${item.rating.toFixed(1)} | verified ${item.verified ? "yes" : "no"}`,
          )
          .join("\n")
      : "- No direct listing found";

    const prompt = [
      "You are EasyHeals conversational healthcare search assistant for India.",
      "You MUST return strict JSON only.",
      "Schema:",
      '{"answer":"...","followUps":["..."],"clarifyQuestion":"... or null","confidenceHint":"low|medium|high"}',
      "Rules:",
      "- Keep answer <= 70 words, practical and action oriented.",
      "- Give 3 to 5 follow-up prompts user can click.",
      "- If city missing and needed, set clarifyQuestion.",
      "- Never provide diagnosis, only navigation guidance.",
      `User query: ${params.query}`,
      `Detected intent: ${params.intent.specialtyKey} / ${params.intent.searchType}`,
      `Detected language: ${params.intent.language}`,
      `Detected confidence: ${params.intent.confidence}`,
      `City filter: ${params.cityFilter ?? "none"}`,
      "Conversation context:",
      historyText,
      "Top matched listings:",
      topText,
    ].join("\n");

    const response = await model.generateContent(prompt);
    const parsed = parseAssistantJson(response.response.text());

    return {
      assistant: parsed ?? fallback,
      model: parsed ? env.GEMINI_MODEL : "fallback",
      degraded: !parsed,
    };
  } catch {
    return { assistant: fallback, model: "fallback", degraded: true };
  }
}

// In-memory post-filter after the broad parallel query (generic so full row shape is preserved)
function hospitalRows_filterByIntent<T extends { city: string; name: string; description: string | null; specialties: unknown }>(
  rows: T[],
  cityFilter: string | undefined,
  _intent: Awaited<ReturnType<typeof extractSearchIntent>>,
  terms: string[],
): T[] {
  if (!cityFilter && terms.length === 0) return rows;
  return rows.filter((row) => {
    if (cityFilter && !row.city.toLowerCase().includes(cityFilter.toLowerCase())) return false;
    if (terms.length === 0) return true;
    const text = `${row.name} ${row.city} ${row.description ?? ""} ${normalizeSpecialties(row.specialties).join(" ")}`.toLowerCase();
    return terms.some((term) => text.includes(term));
  });
}

function doctorRows_filterByIntent<T extends { city: string | null; name: string; description: string | null; specialties: unknown }>(
  rows: T[],
  cityFilter: string | undefined,
  _intent: Awaited<ReturnType<typeof extractSearchIntent>>,
  terms: string[],
): T[] {
  if (!cityFilter && terms.length === 0) return rows;
  return rows.filter((row) => {
    if (cityFilter && row.city && !row.city.toLowerCase().includes(cityFilter.toLowerCase())) return false;
    if (terms.length === 0) return true;
    const text = `${row.name} ${row.city ?? ""} ${row.description ?? ""} ${normalizeSpecialties(row.specialties).join(" ")}`.toLowerCase();
    return terms.some((term) => text.includes(term));
  });
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const payload = await req.json();
    const parsed = requestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid search request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { query, city, page, limit, history = [] } = parsed.data;

    // ── Parallel: run Gemini intent extraction + broad DB queries simultaneously ──
    // Broad queries use the raw query string; intent result refines ranking in-memory.
    const broadQ = `%${query.trim()}%`;
    const broadCityFilter = city ? `%${city}%` : undefined;

    const [intent, hospitalRowsBroad, doctorRowsBroad] = await Promise.all([
      extractSearchIntent(query),
      db
        .select({
          id: hospitals.id,
          type: hospitals.type,
          name: hospitals.name,
          slug: hospitals.slug,
          city: hospitals.city,
          state: hospitals.state,
          rating: hospitals.rating,
          verified: hospitals.verified,
          communityVerified: hospitals.communityVerified,
          specialties: hospitals.specialties,
          source: hospitals.source,
          description: hospitals.description,
          phone: hospitals.phone,
        })
        .from(hospitals)
        .where(
          and(
            eq(hospitals.isActive, true),
            eq(hospitals.isPrivate, true),
            broadCityFilter ? like(hospitals.city, broadCityFilter) : undefined,
            or(
              like(hospitals.name, broadQ),
              like(hospitals.description, broadQ),
              like(hospitals.specialties, broadQ),
              like(hospitals.city, broadQ),
            ),
          ),
        )
        .orderBy(asc(hospitals.name))
        .limit(160),
      db
        .select({
          id: doctors.id,
          name: doctors.fullName,
          slug: doctors.slug,
          city: doctors.city,
          state: doctors.state,
          rating: doctors.rating,
          verified: doctors.verified,
          specialties: doctors.specialties,
          description: doctors.bio,
          phone: doctors.phone,
        })
        .from(doctors)
        .where(
          and(
            eq(doctors.isActive, true),
            broadCityFilter ? like(doctors.city, broadCityFilter) : undefined,
            or(
              like(doctors.fullName, broadQ),
              like(doctors.specialization, broadQ),
              like(doctors.specialties, broadQ),
              like(doctors.bio, broadQ),
              like(doctors.city, broadQ),
            ),
          ),
        )
        .orderBy(asc(doctors.fullName))
        .limit(160),
    ]);

    const cityFilter = city ?? intent.location ?? undefined;
    const terms = buildTerms(query, intent);

    // Re-filter broad results using intent-aware terms (city-aware, specialty-aware)
    const hospitalRows = hospitalRows_filterByIntent(hospitalRowsBroad, cityFilter, intent, terms);
    const doctorRows = doctorRows_filterByIntent(doctorRowsBroad, cityFilter, intent, terms);

    let ranked = [
      ...hospitalRows.map<SearchResultItem>((row) => ({
        id: row.id,
        type: "hospital",
        name: row.name,
        slug: row.slug,
        city: row.city,
        state: row.state,
        rating: row.rating ?? 0,
        verified: row.verified ?? false,
        communityVerified: row.communityVerified ?? false,
        specialties: normalizeSpecialties(row.specialties),
        source: row.source ?? "crowd",
        description: row.description,
        score: 0,
        profileUrl: `/hospitals/${row.slug}`,
        phone: row.phone,
      })),
      ...doctorRows.map<SearchResultItem>((row) => ({
        id: row.id,
        type: "doctor",
        name: row.name,
        slug: row.slug,
        city: row.city ?? cityFilter ?? "India",
        state: row.state,
        rating: row.rating ?? 0,
        verified: row.verified ?? false,
        communityVerified: true,
        specialties: normalizeSpecialties(row.specialties),
        source: "doctor-directory",
        description: row.description,
        score: 0,
        profileUrl: `/doctors/${row.slug}`,
        phone: row.phone,
      })),
    ].map((row) => ({
      ...row,
      score: rankResult(
        {
          type: row.type,
          name: row.name,
          city: row.city,
          description: row.description,
          verified: row.verified,
          communityVerified: row.communityVerified,
          rating: row.rating,
          specialties: row.specialties,
        },
        cityFilter,
        intent,
        terms,
      ),
    }));

    ranked.sort((a, b) => b.score - a.score || b.rating - a.rating);

    if (!ranked.length && cityFilter) {
      const cityBackfillHospitalRows = await db
        .select({
          id: hospitals.id,
          name: hospitals.name,
          slug: hospitals.slug,
          city: hospitals.city,
          state: hospitals.state,
          rating: hospitals.rating,
          verified: hospitals.verified,
          specialties: hospitals.specialties,
          source: hospitals.source,
          description: hospitals.description,
          phone: hospitals.phone,
        })
        .from(hospitals)
        .where(and(eq(hospitals.isActive, true), eq(hospitals.isPrivate, true), like(hospitals.city, `%${cityFilter}%`)))
        .orderBy(asc(hospitals.name))
        .limit(40);

      ranked = cityBackfillHospitalRows.map((row) => ({
        id: row.id,
        type: "hospital" as const,
        name: row.name,
        slug: row.slug,
        city: row.city,
        state: row.state,
        rating: row.rating ?? 0,
        verified: row.verified ?? false,
        communityVerified: true,
        specialties: normalizeSpecialties(row.specialties),
        source: row.source ?? "city-fallback",
        description: row.description,
        score: 1,
        profileUrl: `/hospitals/${row.slug}`,
        phone: row.phone,
      }));
    }

    const paged = ranked.slice((page - 1) * limit, page * limit);

    const { assistant, model, degraded } = await generateAssistant({
      query,
      cityFilter,
      history,
      intent,
      topResults: paged,
    });

    await db.insert(searchLogs).values({
      queryHash: createHash("sha256").update(query).digest("hex"),
      detectedIntent: intent.specialtyKey,
      detectedLang: intent.language,
      resultCount: paged.length,
      city: cityFilter ?? null,
    });

    return NextResponse.json({
      intent,
      assistant,
      meta: {
        model,
        degraded,
        usedHistory: history.length > 0,
        latencyMs: Date.now() - startedAt,
      },
      results: paged,
      total: ranked.length,
      page,
      limit,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Search failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

