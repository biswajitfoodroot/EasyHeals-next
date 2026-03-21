import { createHash } from "crypto";
import { and, asc, eq, like, or, type SQL } from "drizzle-orm";
import { getGeminiClient } from "@/lib/ai/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctors, hospitals, leads, searchLogs } from "@/db/schema";
import { env } from "@/lib/env";
import { extractSearchIntent } from "@/lib/gemini";

const historySchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1).max(500),
});

const patientContextSchema = z.object({
  name: z.string().max(80).optional(),
  age: z.string().max(10).optional(),
  sex: z.string().max(20).optional(),
  city: z.string().max(80).optional(),
  priorConditions: z.string().max(400).optional(),
  phone: z.string().max(20).optional(),
}).optional();

const requestSchema = z.object({
  query: z.string().min(2).max(240),
  city: z.string().min(2).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  history: z.array(historySchema).max(12).optional(),
  language: z.string().max(20).optional(),
  patientContext: patientContextSchema,
  mode: z.enum(["chat", "symptom", "name"]).default("chat"),
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

type PatientContextData = {
  name?: string;
  age?: string;
  sex?: string;
  city?: string;
  priorConditions?: string;
  phone?: string;
};

type AssistantResponse = {
  answer: string;
  followUps: string[];
  clarifyQuestion: string | null;
  confidenceHint: string;
  patientInfoExtracted?: PatientContextData;
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
    const parsed = JSON.parse(stripped) as Partial<AssistantResponse> & { patientInfoExtracted?: Partial<PatientContextData> };
    if (!parsed.answer || !Array.isArray(parsed.followUps)) return null;

    const pie = parsed.patientInfoExtracted;
    const patientInfoExtracted: PatientContextData | undefined =
      pie && typeof pie === "object"
        ? {
            name: typeof pie.name === "string" ? pie.name : undefined,
            age: typeof pie.age === "string" ? pie.age : undefined,
            sex: typeof pie.sex === "string" ? pie.sex : undefined,
            city: typeof pie.city === "string" ? pie.city : undefined,
            priorConditions: typeof pie.priorConditions === "string" ? pie.priorConditions : undefined,
            phone: typeof pie.phone === "string" ? pie.phone : undefined,
          }
        : undefined;

    return {
      answer: parsed.answer,
      followUps: parsed.followUps.filter((value): value is string => typeof value === "string").slice(0, 5),
      clarifyQuestion: parsed.clarifyQuestion ?? null,
      confidenceHint: ["low", "medium", "high"].includes(parsed.confidenceHint ?? "")
        ? (parsed.confidenceHint as string)
        : "medium",
      patientInfoExtracted,
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
  userLanguage?: string;
  patientContext?: PatientContextData;
  mode?: "chat" | "symptom" | "name";
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
    const model = getGeminiClient().getGenerativeModel({ model: env.GEMINI_MODEL });

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

    const responseLanguage = params.userLanguage && params.userLanguage !== "english"
      ? params.userLanguage
      : params.intent.language !== "english"
        ? params.intent.language
        : "english";

    const langInstruction = responseLanguage !== "english"
      ? `IMPORTANT: Write your entire response (answer and followUps) in ${responseLanguage}. Do not use English.`
      : "Reply in English.";

    // Summarise what we already know about the patient
    const ctx = params.patientContext ?? {};
    const knownFields = Object.entries({
      Name: ctx.name, Age: ctx.age, Sex: ctx.sex,
      City: ctx.city, "Prior conditions": ctx.priorConditions, Phone: ctx.phone,
    }).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);

    const missingIntake = [
      !ctx.name && "name",
      !ctx.age && "age",
      !ctx.sex && "gender",
      !ctx.city && "city",
      !ctx.priorConditions && "any existing medical conditions",
    ].filter(Boolean);

    const patientSummary = knownFields.length
      ? `Known patient info: ${knownFields.join(", ")}.`
      : "No patient info collected yet.";

    // Which field to ask for next (first missing one)
    const nextMissingField = missingIntake[0] ?? null;

    // Name search mode skips intake — user just wants to find a specific entity
    const intakeMode = missingIntake.length > 0 && params.mode !== "name";
    const phoneMode = !ctx.phone && missingIntake.length === 0 && params.mode !== "name";

    const modeInstruction = params.mode === "name"
      ? "You are EasyHeals AI in NAME SEARCH mode. The user is searching for a specific hospital or doctor by name. Focus on identifying the entity, sharing its location, specialties, and contact info from the listings. Skip the patient intake flow — go straight to search results."
      : params.mode === "symptom"
        ? "You are EasyHeals AI in SYMPTOM ANALYSIS mode. The user wants a detailed symptom analysis. After intake, provide thorough differential diagnosis, urgency level, recommended specialist type, and tests needed."
        : "You are EasyHeals AI in AI CHAT mode — a warm, conversational healthcare navigation assistant for India.";

    const prompt = [
      modeInstruction,
      "You MUST return ONLY valid JSON matching this schema exactly:",
      '{"answer":"string","followUps":["string"],"clarifyQuestion":"string or null","confidenceHint":"low|medium|high","patientInfoExtracted":{"name":"string or null","age":"string or null","sex":"string or null","city":"string or null","priorConditions":"string or null","phone":"string or null"}}',
      langInstruction,
      "ALWAYS extract patient details from THIS message into patientInfoExtracted. Set each field to null if not mentioned.",
      "",
      intakeMode
        ? [
            "=== INTAKE MODE — STRICT ===",
            "Patient intake is NOT complete yet. You MUST follow these rules:",
            "1. answer: Acknowledge their concern warmly in 1 sentence, then ask for ALL of the following in ONE combined question: name, age, gender, and any existing medical conditions. Make it feel like a caring intake form, not an interrogation. Keep answer under 80 words.",
            "2. clarifyQuestion: null (you already asked everything in the answer).",
            "3. followUps: Give 3-4 quick-reply options like 'I have no prior conditions', 'I have diabetes/hypertension', etc.",
            "4. DO NOT give any medical advice, diagnosis, specialist recommendations, or conditions in this response.",
          ].join("\n")
        : phoneMode
          ? [
              "=== PHONE COLLECTION MODE ===",
              "All patient info gathered. Now:",
              "1. answer: Summarize what you know and explain you will connect them with the right care (max 2 sentences).",
              "2. clarifyQuestion: Ask for their phone number to connect them with a care team.",
              "3. followUps: Give options like 'I prefer not to share', 'WhatsApp me instead', etc.",
            ].join("\n")
          : [
              "=== FULL GUIDANCE MODE ===",
              "All intake fields AND phone collected. Provide complete guidance:",
              "1. answer: Discuss possible conditions based on symptoms. Suggest specialist type and relevant tests/treatments. Name specific hospitals/doctors from listings below.",
              "2. clarifyQuestion: Ask for more symptom details if helpful.",
              "3. followUps: Give 4-5 care navigation prompts.",
            ].join("\n"),
      "",
      `User query: ${params.query}`,
      `Detected intent: ${params.intent.specialtyKey} / ${params.intent.searchType}`,
      `User selected language: ${responseLanguage}`,
      `City: ${params.cityFilter ?? "not specified"}`,
      patientSummary,
      "Conversation context:",
      historyText,
      intakeMode ? "" : "Matched EasyHeals listings (name these in your answer when relevant):",
      intakeMode ? "" : topText,
    ].filter(Boolean).join("\n");

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

    const { query, city, page, limit, history = [], language, patientContext, mode } = parsed.data;

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

    // Specialty-based fallback when romanized/non-English query produces no raw DB hits.
    // This covers cases like "Mujhe seene mein dard ho raha hai" which Gemini translates
    // to "chest pain" / "cardiology" but won't match English hospital records via LIKE.
    let effectiveHospitalRows = [...hospitalRowsBroad];
    let effectiveDoctorRows = [...doctorRowsBroad];

    if (hospitalRowsBroad.length === 0 && intent.specialtyKey !== "general") {
      const specialtyQ = `%${intent.specialty}%`;
      const specialtyKeyQ = `%${intent.specialtyKey}%`;
      const [specHospitals, specDoctors] = await Promise.all([
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
                like(hospitals.specialties, specialtyQ),
                like(hospitals.specialties, specialtyKeyQ),
                like(hospitals.description, specialtyQ),
              ),
            ),
          )
          .orderBy(asc(hospitals.rating))
          .limit(80),
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
                like(doctors.specialization, specialtyQ),
                like(doctors.specialties, specialtyQ),
              ),
            ),
          )
          .orderBy(asc(doctors.fullName))
          .limit(80),
      ]);
      effectiveHospitalRows = specHospitals;
      effectiveDoctorRows = specDoctors;
    }

    // Also try translated query if still empty
    if (effectiveHospitalRows.length === 0 && intent.translatedQuery !== query) {
      const tQ = `%${intent.translatedQuery.trim()}%`;
      const translatedHospitals = await db
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
            or(like(hospitals.name, tQ), like(hospitals.specialties, tQ), like(hospitals.description, tQ)),
          ),
        )
        .limit(60);
      if (translatedHospitals.length > 0) effectiveHospitalRows = translatedHospitals;
    }

    // Re-filter broad results using intent-aware terms (city-aware, specialty-aware)
    const hospitalRows = hospitalRows_filterByIntent(effectiveHospitalRows, cityFilter, intent, terms);
    const doctorRows = doctorRows_filterByIntent(effectiveDoctorRows, cityFilter, intent, terms);

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
      userLanguage: language,
      patientContext: patientContext ?? undefined,
      mode,
    });

    // Merge extracted patient info with what was already known
    const mergedPatientCtx: PatientContextData = { ...patientContext, ...assistant.patientInfoExtracted };

    // Auto-create lead when we have name + phone (deduplicated per session by caller)
    let leadCreated = false;
    if (
      mergedPatientCtx.phone &&
      mergedPatientCtx.name &&
      !patientContext?.phone // only create if phone is NEW this exchange
    ) {
      try {
        await db.insert(leads).values({
          fullName: mergedPatientCtx.name,
          phone: mergedPatientCtx.phone,
          city: mergedPatientCtx.city ?? cityFilter ?? null,
          medicalSummary: [
            mergedPatientCtx.priorConditions,
            `Age: ${mergedPatientCtx.age ?? "?"}`,
            `Sex: ${mergedPatientCtx.sex ?? "?"}`,
            `Query: ${query}`,
          ].filter(Boolean).join(" | "),
          source: "ai_chat",
          status: "new",
          score: 30,
        });
        leadCreated = true;
      } catch {
        // Lead creation failure is non-fatal
      }
    }

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
      patientContextUpdate: assistant.patientInfoExtracted ?? null,
      leadCreated,
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

