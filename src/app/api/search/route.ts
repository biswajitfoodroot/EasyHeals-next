import { createHash } from "crypto";
import { and, asc, eq, like, or, type SQL } from "drizzle-orm";
import { getGeminiClient } from "@/lib/ai/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctors, hospitals, leads, searchLogs, type SymptomKnowledgeData, type ReportKnowledgeData } from "@/db/schema";
import { env } from "@/lib/env";
import { extractSearchIntent, heuristicIntent } from "@/lib/gemini";
import { lookupBestMatch, buildGuidanceBlock, lookupFewShots, type KnowledgeMatch } from "@/lib/chatbot-knowledge";

const historySchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1).max(1000),
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

  // When user explicitly asks for a doctor/specialist, boost all doctors
  if (["doctor_name", "specialty"].includes(intent.searchType) && item.type === "doctor") {
    score += 2.5;
  }

  return Number(score.toFixed(2));
}

function buildFallbackAssistant(
  query: string,
  cityFilter: string | undefined,
  intent: Awaited<ReturnType<typeof extractSearchIntent>>,
  topResults: SearchResultItem[],
): AssistantResponse {
  const cityText = cityFilter ? ` in ${cityFilter}` : "";
  const hospitalCount = topResults.filter(r => r.type === "hospital").length;
  const doctorCount = topResults.filter(r => r.type === "doctor").length;
  const isDocSearch = ["doctor_name", "specialty"].includes(intent.searchType);

  let answer: string;
  if (topResults.length === 0) {
    answer = cityFilter
      ? `No results found for ${intent.specialty} in ${cityFilter} yet. Try a nearby city or request a callback from our team.`
      : `I could not find matches for "${intent.specialty}". Try adding a city name.`;
  } else if (isDocSearch && doctorCount === 0 && hospitalCount > 0) {
    answer = `Found ${hospitalCount} hospital${hospitalCount > 1 ? "s" : ""} offering ${intent.specialty}${cityText}. No individual specialists listed yet — contact the hospital directly or request a callback.`;
  } else if (doctorCount > 0 && hospitalCount === 0) {
    answer = `Found ${doctorCount} ${intent.specialty} specialist${doctorCount > 1 ? "s" : ""}${cityText}. Book a consultation or request a callback.`;
  } else {
    answer = `Found ${hospitalCount > 0 ? `${hospitalCount} hospital${hospitalCount > 1 ? "s" : ""}` : ""}${hospitalCount > 0 && doctorCount > 0 ? " and " : ""}${doctorCount > 0 ? `${doctorCount} specialist${doctorCount > 1 ? "s" : ""}` : ""}${cityText}.`;
  }

  const clarifyQuestion =
    !cityFilter && !["doctor_name", "hospital_name", "specialty"].includes(intent.searchType)
      ? "Which city should I prioritize for better matches?"
      : null;

  return {
    answer,
    followUps: [
      cityFilter ? `More ${intent.specialty} options` : `${intent.specialty} in Pune`,
      "Request callback from care team",
      `${intent.specialty} verified only`,
      `${intent.specialty} top rated`,
    ],
    clarifyQuestion,
    confidenceHint: intent.confidence >= 0.7 ? "high" : intent.confidence >= 0.45 ? "medium" : "low",
  };
}

/** Knowledge-aware fallback for symptom queries — provides diagnosis even without Gemini */
function buildKnowledgeFallback(
  query: string,
  knowledgeMatch: KnowledgeMatch,
  topResults: SearchResultItem[],
): AssistantResponse {
  if (knowledgeMatch.type === "symptom") {
    const d = knowledgeMatch.data as SymptomKnowledgeData;
    const causes = d.commonCauses.slice(0, 3).join(", ");
    const redFlag = d.redFlags[0] ?? "";
    const specialist = d.likelySpecialty;

    const answer = [
      `I understand you're experiencing ${knowledgeMatch.key}. Let me help.`,
      `Could be: ${causes}.`,
      redFlag ? `Seek help if: ${redFlag}.` : "",
      `Specialist: ${specialist}.`,
      d.safeInitialAdvice ? d.safeInitialAdvice : "",
    ].filter(Boolean).join(" ");

    const firstQuestion = d.keyQuestions[0] ?? "How long have you had these symptoms?";

    return {
      answer,
      followUps: [
        d.keyQuestions[1] ?? "Yes, it is getting worse",
        d.keyQuestions[2] ?? "No, it comes and goes",
        `Find ${specialist} near me`,
        "Request a callback",
      ],
      clarifyQuestion: firstQuestion,
      confidenceHint: "medium",
    };
  }

  if (knowledgeMatch.type === "report") {
    const d = knowledgeMatch.data as ReportKnowledgeData;
    return {
      answer: `${d.patientFriendlyMeaning} ${d.nextStep}`,
      followUps: ["Find a specialist", "Tell me more about this", "Request a callback", "Is this urgent?"],
      clarifyQuestion: "Do you have a recent report showing this?",
      confidenceHint: "medium",
    };
  }

  // intent type or unknown — use basic fallback
  const hospitalCount = topResults.filter(r => r.type === "hospital").length;
  const doctorCount = topResults.filter(r => r.type === "doctor").length;
  return {
    answer: `Found ${hospitalCount} hospitals and ${doctorCount} specialists that may help. Let me know your city for better matches.`,
    followUps: ["Pune", "Mumbai", "Delhi", "Bangalore"],
    clarifyQuestion: "Which city are you in?",
    confidenceHint: "low",
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

type ChatbotState =
  | "EMERGENCY"
  | "BUSINESS"
  | "SYMPTOM_GUIDANCE"
  | "DISEASE_INFO"
  | "PROCEDURE_INFO"
  | "SPECIALTY_SEARCH"
  | "SPECIALTY_SUGGESTED"
  | "LOCATION_CAPTURED"
  | "LEAD_CAPTURE";

const EMERGENCY_PATTERNS = [
  "severe chest pain", "chest pain", "chest tightness sweating",
  "difficulty breathing", "can't breathe", "cannot breathe",
  "stroke", "seizure", "unconscious", "fainting", "fainted",
  "severe bleeding", "vomiting blood", "blood in vomit",
  "suicidal", "self harm", "self-harm",
  "sudden weakness", "face droop", "slurred speech",
  "severe abdominal pain", "tight abdomen", "swollen abdomen",
  "lips turning blue", "low oxygen", "not breathing",
];

const BUSINESS_PATTERNS = [
  "tie-up", "tie up", "onboard hospital", "list hospital",
  "partner with", "i am an agent", "i am a broker",
  "hospital partnership", "register hospital", "hospital onboarding",
];

function detectEmergency(texts: string[]): boolean {
  const combined = texts.join(" ").toLowerCase();
  // Check pairs of concern first (chest pain alone is not always emergency)
  const hasChestPain = combined.includes("chest pain") || combined.includes("chest tightness");
  const hasSevere = combined.includes("severe") || combined.includes("sweating") || combined.includes("breathless");
  if (hasChestPain && hasSevere) return true;
  // Check definitive emergency patterns
  return [
    "difficulty breathing", "can't breathe", "cannot breathe",
    "stroke", "seizure", "unconscious", "fainting",
    "vomiting blood", "blood in vomit",
    "suicidal", "self harm", "self-harm",
    "sudden weakness one side", "face droop", "slurred speech",
    "lips turning blue", "low oxygen",
  ].some(p => combined.includes(p));
}

function detectBusiness(text: string): boolean {
  const lower = text.toLowerCase();
  return BUSINESS_PATTERNS.some(p => lower.includes(p));
}

const DISEASE_KEYWORDS = [
  "gallbladder", "kidney stone", "diabetes", "thyroid", "hypertension", "blood pressure",
  "cholesterol", "fatty liver", "hepatitis", "jaundice", "hernia", "appendix",
  "piles", "fistula", "fissure", "sinusitis", "tonsil", "adenoid",
  "arthritis", "spondylosis", "spondylitis", "osteoporosis",
  "epilepsy", "parkinson", "alzheimer", "migraine",
  "asthma", "copd", "bronchitis", "pneumonia", "tuberculosis", " tb ",
  "ulcer", "gastritis", "colitis", "ibs", "crohn", "celiac",
  "psoriasis", "eczema", "vitiligo", "alopecia",
  "pcod", "pcos", "endometriosis", "fibroids", "ovarian cyst",
  "cataract", "glaucoma", "retina detachment",
  "varicocele", "prostate", "bph", "kidney failure", "dialysis",
  "dengue", "malaria", "typhoid", "chikungunya",
  "cancer", "tumour", "tumor", "lymphoma", "leukemia",
];

function detectDiseaseQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return DISEASE_KEYWORDS.some(kw => lower.includes(kw));
}

function detectChatbotState(
  query: string,
  history: Array<{ role: "user" | "assistant"; text: string }>,
  ctx: PatientContextData,
  mode: string,
  intentSearchType?: string,
  intentCity?: string | null,
): ChatbotState {
  const allUserText = [query, ...history.filter(h => h.role === "user").map(h => h.text)];
  if (detectEmergency(allUserText)) return "EMERGENCY";
  if (detectBusiness(query)) return "BUSINESS";
  if (mode === "name") return "LOCATION_CAPTURED";

  const userTurnCount = history.filter(h => h.role === "user").length;
  const isSymptomQuery = intentSearchType === "symptom" || /\b(pain|fever|rash|cough|vomit|weak|breath|symptom|dard|bukhar|khansi|headache|cold|block|swelling|nausea|dizz)/i.test(query);

  // P4.4: Direct specialist / hospital / doctor search — skip symptom flow entirely.
  // "gastro in Pune", "cardiologist", "find ortho doctor" go straight to SPECIALTY_SEARCH.
  // BUT: if the query describes symptoms (even with a specialty mention), do diagnosis first.
  if (!isSymptomQuery) {
    const isDirectSearch = ["specialty", "doctor_name", "hospital_name"].includes(intentSearchType ?? "");
    if (isDirectSearch) return "SPECIALTY_SEARCH";
  }

  // Use city from patientContext OR from the query intent (e.g. "gastro in Pune")
  const hasCity = !!(ctx.city || intentCity);
  const hasPhone = !!ctx.phone;

  // Symptom queries MUST go through diagnostic rounds before routing to doctors/hospitals.
  // Only allow city-based routing after enough diagnostic turns have been completed.
  const maxDiagTurns = mode === "symptom" ? 5 : 4;
  const diagDone = userTurnCount >= maxDiagTurns;

  if (isSymptomQuery && !diagDone) {
    // Intent-based routing for disease/procedure info on first 1-2 turns
    if (userTurnCount <= 1) {
      if (intentSearchType === "treatment" || intentSearchType === "lab_test") return "PROCEDURE_INFO";
      if (intentSearchType === "general" && detectDiseaseQuery(query)) return "DISEASE_INFO";
    }
    return "SYMPTOM_GUIDANCE";
  }

  // Diagnostic rounds complete OR non-symptom query — now route by city/phone
  if (hasCity && hasPhone) return "LEAD_CAPTURE";
  if (hasCity) return "LOCATION_CAPTURED";

  // Intent-based routing for non-symptom queries
  if (userTurnCount <= 1) {
    if (intentSearchType === "treatment" || intentSearchType === "lab_test") return "PROCEDURE_INFO";
    if (intentSearchType === "general" && detectDiseaseQuery(query)) return "DISEASE_INFO";
  }

  if (diagDone) return "SPECIALTY_SUGGESTED";
  return "SYMPTOM_GUIDANCE";
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
}): Promise<{ assistant: AssistantResponse; model: string; degraded: boolean; chatbotState: ChatbotState }> {
  const ctx = params.patientContext ?? {};
  const state = detectChatbotState(
    params.query,
    params.history,
    ctx,
    params.mode ?? "chat",
    params.intent.searchType,
    params.intent.city,
  );

  const fallback = buildFallbackAssistant(params.query, params.cityFilter, params.intent, params.topResults);

  // Knowledge base lookup — ALWAYS run for symptom/diagnosis states (even without Gemini)
  const needsKnowledge = state === "SYMPTOM_GUIDANCE" || state === "EMERGENCY" || state === "DISEASE_INFO" || state === "PROCEDURE_INFO";
  console.log("[search] state:", state, "needsKnowledge:", needsKnowledge, "query:", params.query);
  const [knowledgeMatch, fewShots] = await Promise.all([
    needsKnowledge
      ? lookupBestMatch(params.query).catch(() => null)
      : Promise.resolve(null),
    (state === "SYMPTOM_GUIDANCE" || state === "DISEASE_INFO")
      ? lookupFewShots(
          params.intent.symptoms[0] ?? null,
          params.intent.language ?? "English",
          2,
        ).catch(() => [] as Array<{ input: string; output: string }>)
      : Promise.resolve([] as Array<{ input: string; output: string }>),
  ]);

  console.log("[search] knowledgeMatch:", knowledgeMatch ? `${knowledgeMatch.type}/${knowledgeMatch.key}` : "null", "hasApiKey:", !!env.GOOGLE_AI_API_KEY);

  if (!env.GOOGLE_AI_API_KEY) {
    // Use knowledge-aware fallback for symptom queries, plain fallback otherwise
    const assistant = knowledgeMatch
      ? buildKnowledgeFallback(params.query, knowledgeMatch, params.topResults)
      : fallback;
    return { assistant, model: knowledgeMatch ? "knowledge-base" : "fallback", degraded: true, chatbotState: state };
  }

  try {
    // Use faster chat model (gemini-2.0-flash) to reduce response latency
    const chatModel = env.GEMINI_CHAT_MODEL || "gemini-2.0-flash";
    const model = getGeminiClient().getGenerativeModel({
      model: chatModel,
      generationConfig: { temperature: 0, maxOutputTokens: 350 },
    });

    // Limit history to last 4 turns (8 messages) to keep prompt small
    const historyText = params.history.length
      ? params.history.slice(-4).map(h => `${h.role.toUpperCase()}: ${h.text}`).join("\n")
      : "No prior context";

    const topText = params.topResults.length
      ? params.topResults.slice(0, 6).map(r =>
          `- [${r.type}] ${r.name} (${r.city}${r.state ? `, ${r.state}` : ""}) | rating ${r.rating.toFixed(1)} | verified ${r.verified ? "yes" : "no"}`
        ).join("\n")
      : "- No direct listing found";

    const responseLanguage = params.userLanguage && params.userLanguage !== "english"
      ? params.userLanguage
      : params.intent.language !== "english" ? params.intent.language : "english";

    const langInstruction = responseLanguage !== "english"
      ? `IMPORTANT: Write your entire response in ${responseLanguage}. Do not use English.`
      : "Reply in English.";

    // Summarise known patient info — never re-ask for these
    const knownParts = Object.entries({
      Name: ctx.name, Age: ctx.age, Gender: ctx.sex,
      City: ctx.city, "Prior conditions": ctx.priorConditions,
    }).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
    const knownSummary = knownParts.length ? `Already known: ${knownParts.join(", ")}.` : "No patient info collected yet.";
    const userTurnCount = params.history.filter(h => h.role === "user").length;

    // ── State-specific instruction ───────────────────────────────────────────
    let stateInstruction: string;

    if (state === "EMERGENCY") {
      stateInstruction = [
        "=== EMERGENCY MODE ===",
        "The user's symptoms suggest a potential medical emergency. Your response MUST:",
        "1. answer: State clearly this sounds urgent and they should go to the nearest emergency department or call 112 immediately. List 2-3 specific warning signs present in their message. Keep under 60 words. Do NOT ask any questions.",
        "2. clarifyQuestion: null.",
        "3. followUps: [\"Find nearest emergency hospital\", \"Call ambulance 112\", \"What are warning signs?\"].",
        "4. Do NOT ask for name, age, city, or any demographic info.",
        "5. Do NOT delay with intake questions.",
      ].join("\n");

    } else if (state === "BUSINESS") {
      stateInstruction = [
        "=== BUSINESS / PARTNER ROUTING ===",
        "The user is asking about hospital listing, partnership, or agent/broker onboarding.",
        "1. answer: Warmly acknowledge this is for providers/partners. Mention they can list their hospital free on EasyHeals. Keep under 50 words.",
        "2. clarifyQuestion: null.",
        "3. followUps: [\"List Hospital Free\", \"Hospital partnership enquiry\", \"Agent / broker onboarding\", \"Contact EasyHeals team\"].",
      ].join("\n");

    } else if (state === "DISEASE_INFO") {
      stateInstruction = [
        "=== DISEASE INFORMATION MODE ===",
        "User is asking about a specific disease or condition (not just symptoms). Your response MUST:",
        "1. answer: (a) Explain what the condition is in 1-2 plain sentences. (b) Common symptoms as a short comma-separated list. (c) Name the specialist who handles it. (d) 1 sentence on when to seek urgent care. Under 90 words, no markdown.",
        "2. clarifyQuestion: 'Are you or a family member affected by this? Which city are you in so I can help find the right specialist?'",
        "3. followUps: ['I have this condition', 'It is for a family member', 'Need a specialist in Pune', 'Tell me about treatment options'].",
        "CRITICAL RULES:",
        "- Do NOT ask for name, age, or gender yet.",
        "- Do NOT mix symptom-guidance flow into this response.",
        "- Do NOT diagnose or prescribe.",
        knownSummary,
      ].join("\n");

    } else if (state === "PROCEDURE_INFO") {
      stateInstruction = [
        "=== PROCEDURE / TREATMENT INFORMATION MODE ===",
        "User is asking about a specific medical procedure, surgery, or treatment. Your response MUST:",
        "1. answer: (a) Briefly explain what the procedure is and when it is needed (2 sentences). (b) Name the specialist who performs it. (c) If the query mentions active or severe symptoms, add 1 red-flag sentence. Under 80 words, no markdown.",
        "2. clarifyQuestion: 'Is this for an upcoming procedure, or are you evaluating options? Which city are you in?'",
        "3. followUps: ['Doctor already recommended this', 'I am evaluating options', 'Find a hospital for this procedure', 'Just researching'].",
        "CRITICAL RULES:",
        "- Do NOT ask for full patient profile.",
        "- If active emergency symptoms are mentioned, advise urgent care immediately.",
        "- Do NOT prescribe or recommend specific drugs.",
        knownSummary,
      ].join("\n");

    } else if (state === "SPECIALTY_SEARCH") {
      const cityName = ctx.city ?? params.cityFilter ?? params.intent.city ?? null;
      const specialtyName = params.intent.specialty;
      const hospitalCount = params.topResults.filter(r => r.type === "hospital").length;
      const doctorCount = params.topResults.filter(r => r.type === "doctor").length;
      const userWantsDoctor = ["doctor_name", "specialty"].includes(params.intent.searchType) &&
        /\b(doctor|specialist|dr\.?)\b/i.test(params.query);
      stateInstruction = [
        "=== SPECIALTY SEARCH MODE ===",
        "TASK: Connect user to a specialist. DO NOT assess symptoms. DO NOT give medical advice. This is a search request.",
        `Specialty: ${specialtyName} | City: ${cityName ?? "unknown"} | Hospitals: ${hospitalCount} | Doctors: ${doctorCount}`,
        userWantsDoctor && doctorCount === 0 && hospitalCount > 0
          ? `IMPORTANT: User asked for a doctor but only hospitals were found. Be honest — say "${specialtyName} hospitals found${cityName ? ` in ${cityName}` : ""}; no individual specialists listed yet." Suggest contacting the hospital or requesting a callback.`
          : "",
        "",
        "answer — use EXACTLY one of these templates (fill in brackets, keep under 25 words):",
        cityName && (hospitalCount > 0 || doctorCount > 0)
          ? `  Template: "Found ${doctorCount > 0 ? `${doctorCount} ${specialtyName} specialist${doctorCount > 1 ? "s" : ""}` : `${hospitalCount} hospital${hospitalCount > 1 ? "s" : ""} with ${specialtyName}`} in ${cityName}. [Name 1 top result]. Book a consultation or request a callback?"`
          : cityName
          ? `  Template: "I can help find ${specialtyName} specialists in ${cityName}. Book a consultation or I can arrange a callback from our team."`
          : `  Template: "I can find ${specialtyName} specialists near you. Which city are you in?"`,
        "  Replace [Name 1 top result] with first result name from listings. No other text.",
        "",
        `clarifyQuestion: ${cityName ? '"Would you like doctor options, hospital options, or a callback from our care team?"' : '"Which city are you in? I\'ll find the best options there."'}`,
        "",
        `followUps: ${cityName
          ? `["Book appointment", "Request callback", "Show more options", "Top rated only"]`
          : '["Pune", "Mumbai", "Delhi", "Bangalore", "I\'ll search myself"]'
        }`,
        "",
        "Results to use in answer:",
        topText,
        knownSummary,
      ].join("\n");

    } else if (state === "SYMPTOM_GUIDANCE") {
      // Turn-aware: 3 diagnostic rounds before routing to city/specialist
      const diagTurn = userTurnCount; // 0 = first message, 1 = second, 2 = third, 3 = fourth

      if (diagTurn === 0) {
        // ROUND 1 — Initial overview + first clinical questions
        stateInstruction = [
          "=== SYMPTOM GUIDANCE ROUND 1 ===",
          "answer — MAX 35 words, exactly 3 lines, no other text:",
          "  Line 1: 'Could be: [2-3 causes, comma-separated]'",
          "  Line 2: 'Seek help if: [1-2 red flags only]'",
          "  Line 3: 'Specialist: [name]'",
          "  No greetings. No home care. No paragraphs. No markdown.",
          "clarifyQuestion: ONE short clinical question, max 12 words. E.g. 'Do you have pain? Any fever or nausea?'",
          "followUps: ['Yes, mild pain', 'No pain', 'Also have fever', 'No other symptoms']",
          "Do NOT ask name, age, city, or phone.",
          knownSummary,
        ].join("\n");

      } else if (diagTurn === 1) {
        // ROUND 2 — Deepen based on answers
        stateInstruction = [
          "=== DIAGNOSTIC ROUND 2 (Deepen the picture) ===",
          "The user has answered your initial questions. Now dig deeper.",
          "answer (under 60 words): Acknowledge what they said. Briefly comment on what their answers suggest (e.g. 'Pain after eating often points to gastritis or gallbladder issues'). Keep it educational, not diagnostic.",
          "DO NOT put questions in answer field.",
          "clarifyQuestion: Ask 2 more specific clinical questions to narrow down. Choose from: (a) How long has this been going on? Is it getting worse? (b) Does it happen after eating, at a specific time, or constantly? (c) Have you had any tests, scans, or blood work done recently?",
          "followUps: 4 quick replies matching the clarifyQuestion (e.g. 'More than a week', 'After meals', 'Had blood test recently', 'No tests done').",
          "Do NOT ask name, age, gender, or city.",
          knownSummary,
        ].join("\n");

      } else if (diagTurn === 2) {
        // ROUND 3 — Prescription / history + narrow possibilities
        stateInstruction = [
          "=== DIAGNOSTIC ROUND 3 (Narrow down + prescription check) ===",
          "Based on everything shared so far, start narrowing possibilities.",
          "answer (under 80 words): (a) Acknowledge their latest reply. (b) Based on all info in the conversation history, name 2-3 most likely possibilities in plain language (e.g. 'Based on what you described, this could be gastritis, IBS, or a gallbladder issue'). (c) Mention that if they have an existing prescription or test report, sharing those details can help give more specific guidance.",
          "DO NOT put questions in answer field.",
          "clarifyQuestion: Ask EITHER 'Do you have an existing prescription or test report? If yes, please describe the medication or findings.' OR a final clarifying clinical question most needed based on history.",
          "followUps: ['Yes, I have a prescription', 'Had a scan/blood test', 'No previous reports', 'Never seen a doctor for this'].",
          "Do NOT ask name, age, gender, or city.",
          knownSummary,
        ].join("\n");

      } else {
        // ROUND 4 — Summarise and route (same as SPECIALTY_SUGGESTED)
        stateInstruction = [
          "=== DIAGNOSTIC SUMMARY + ROUTING ===",
          "You have gathered enough clinical context. Now summarise and route to care.",
          "answer (under 90 words): (a) Summarise what the user has described. (b) Name the 1-2 most likely conditions based on all context. (c) Name the right specialist. (d) Give 1 red-flag sentence. (e) Say you can help find the right doctor once you know their city.",
          "clarifyQuestion: 'Which city are you in? I can help find the right specialist there.'",
          "followUps: ['Pune', 'Mumbai', 'Delhi', 'Bangalore', 'I will search myself'].",
          knownSummary,
        ].join("\n");
      }

    } else if (state === "SPECIALTY_SUGGESTED") {
      stateInstruction = [
        "=== SPECIALTY + CITY MODE ===",
        "Diagnostic context has been gathered. Now route to care.",
        "1. answer (under 80 words): (a) Briefly summarise what the conversation has established. (b) Name the right specialist and why. (c) 1 red-flag sentence. (d) Ask which city they are in.",
        "2. clarifyQuestion: \"Which city are you in? I can help find the right specialist there.\"",
        "3. followUps: [\"Pune\", \"Mumbai\", \"Delhi\", \"Bangalore\", \"I'll search myself\"].",
        "CRITICAL RULES:",
        "- Do NOT re-ask for info already provided.",
        "- If city is already known, skip asking and mention it.",
        knownSummary,
      ].join("\n");

    } else if (state === "LOCATION_CAPTURED") {
      const cityName = ctx.city ?? params.cityFilter ?? "your city";
      stateInstruction = [
        `=== CONNECTION MODE (City: ${cityName}) ===`,
        "City is known. Now connect the user to care options.",
        "1. answer: (a) Acknowledge city. (b) Confirm the relevant specialty. (c) Name 1-2 specific hospitals or doctors from the listings if available, OR say you can help find them. (d) Offer 3 options: doctor consultation, hospital options, or callback from EasyHeals. Keep under 80 words.",
        "2. clarifyQuestion: \"Would you like doctor options, hospital options, or a callback from our care team?\"",
        "3. followUps: [\"Show me doctors\", \"Show me hospitals\", \"Request a callback\", \"I'll decide later\"].",
        "4. Name listings from the matched results below when relevant:",
        topText,
        knownSummary,
      ].join("\n");

    } else { // LEAD_CAPTURE
      const cityName = ctx.city ?? params.cityFilter ?? "your city";
      stateInstruction = [
        `=== LEAD CAPTURE MODE (City: ${cityName}) ===`,
        "User wants to connect. Capture contact details.",
        "1. answer: Confirm you will connect them with the right specialist in their city. Ask for their name and phone number so the care team can reach out. Keep under 60 words.",
        "2. clarifyQuestion: \"What is your name and phone number? Our care team will contact you shortly.\"",
        "3. followUps: [\"I prefer not to share\", \"WhatsApp me instead\", \"Book online instead\", \"I'll call directly\"].",
        knownSummary,
      ].join("\n");
    }

    // ── QA guardrail ─────────────────────────────────────────────────────────
    const guardrail = [
      "RULES: No re-asking info already given. Never ask name+age+city all at once. No markdown in answer. No drug names. No certain diagnosis. Move forward on partial answers.",
      langInstruction,
    ].join(" ");

    const guidanceSection = knowledgeMatch
      ? ["\n[STRUCTURED KNOWLEDGE BASE LOOKUP — use this as your factual foundation, do NOT invent causes or red flags]", buildGuidanceBlock(knowledgeMatch), "[END KNOWLEDGE BASE]\n"].join("\n")
      : "";

    const fewShotSection = fewShots.length > 0
      ? `[TONE REF] ${fewShots.map(ex => ex.output.slice(0, 150)).join(" | ")}`
      : "";

    const prompt = [
      "You are EasyHeals AI Health Assistant — a warm, trustworthy healthcare navigation assistant for India.",
      "You MUST return ONLY valid JSON matching this schema exactly:",
      '{"answer":"string","followUps":["string"],"clarifyQuestion":"string or null","confidenceHint":"low|medium|high","patientInfoExtracted":{"name":"string or null","age":"string or null","sex":"string or null","city":"string or null","priorConditions":"string or null","phone":"string or null"}}',
      "ALWAYS extract patient details from the current message into patientInfoExtracted (null for anything not mentioned).",
      "",
      stateInstruction,
      guidanceSection,
      fewShotSection,
      guardrail,
      "",
      `User query: ${params.query}`,
      `Detected intent: ${params.intent.specialtyKey} / ${params.intent.searchType}`,
      `City filter: ${params.cityFilter ?? "not specified"}`,
      `Conversation history:`,
      historyText,
    ].join("\n");

    const response = await model.generateContent(prompt);
    const rawText = response.response.text();
    const parsed = parseAssistantJson(rawText);

    if (parsed) {
      return { assistant: parsed, model: env.GEMINI_MODEL, degraded: false, chatbotState: state };
    }

    // Gemini responded but JSON was invalid — use knowledge fallback if available
    console.warn("[search] Gemini response not valid JSON, using knowledge fallback. Raw:", rawText.slice(0, 200));
    const kbFallback = knowledgeMatch
      ? buildKnowledgeFallback(params.query, knowledgeMatch, params.topResults)
      : fallback;
    return { assistant: kbFallback, model: knowledgeMatch ? "knowledge-base" : "fallback", degraded: true, chatbotState: state };
  } catch (err) {
    console.error("[search] Gemini error:", err instanceof Error ? err.message : err);
    // Use knowledge-aware fallback when Gemini fails for symptom queries
    const assistant = knowledgeMatch
      ? buildKnowledgeFallback(params.query, knowledgeMatch, params.topResults)
      : fallback;
    return { assistant, model: knowledgeMatch ? "knowledge-base" : "fallback", degraded: true, chatbotState: state };
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

    // Sliding window: keep last 3 exchanges (6 messages), truncate long texts to avoid future 400s
    const slidingHistory = history
      .slice(-6)
      .map(h => ({ ...h, text: h.text.length > 900 ? `${h.text.slice(0, 900)}…` : h.text }));

    // ── Intent extraction: use heuristic for chat mode to avoid 2nd Gemini call ──
    // Chat mode only needs approximate intent (state machine handles routing).
    // Only use Gemini intent for direct search queries (mode=name) or first-turn search.
    const isSearchMode = mode === "name" || (mode !== "chat" && history.length === 0);

    // Extract the most meaningful search term from the query.
    // For natural-language queries like "tell me best neuro doctor in chennai",
    // use the first meaningful word (≥4 chars, not a stop word) rather than the full string
    // so it actually matches DB records.
    const STOP_WORDS = new Set(["tell", "find", "show", "best", "good", "near", "need", "want", "give", "list", "book", "search", "look", "doctor", "hospital", "clinic", "specialist"]);
    const queryWords = query.trim().toLowerCase().split(/\s+/).filter(w => w.length >= 4 && !STOP_WORDS.has(w));
    const keyTerm = queryWords[0] ?? query.trim().split(/\s+/)[0] ?? query.trim();
    const broadQ = `%${keyTerm}%`;
    const broadCityFilter = city ? `%${city}%` : undefined;

    const [intent, hospitalRowsBroad, doctorRowsBroad] = await Promise.all([
      isSearchMode ? extractSearchIntent(query) : Promise.resolve(heuristicIntent(query)),
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

    // Independent specialty fallbacks — each runs only if its own broad query was empty
    if (intent.specialtyKey !== "general") {
      const specialtyQ = `%${intent.specialty}%`;
      const specialtyKeyQ = `%${intent.specialtyKey}%`;

      const fallbackPromises: [Promise<typeof effectiveHospitalRows>, Promise<typeof effectiveDoctorRows>] = [
        hospitalRowsBroad.length === 0
          ? db
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
            .limit(80)
          : Promise.resolve(effectiveHospitalRows),

        doctorRowsBroad.length === 0
          ? db
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
                  like(doctors.specialization, specialtyKeyQ),
                  like(doctors.specialization, `%${intent.specialtyKey.slice(0, 5)}%`),
                  like(doctors.specialties, specialtyQ),
                  like(doctors.specialties, specialtyKeyQ),
                  like(doctors.bio, specialtyQ),
                ),
              ),
            )
            .orderBy(asc(doctors.fullName))
            .limit(80)
          : Promise.resolve(effectiveDoctorRows),
      ];

      const [fbHospitals, fbDoctors] = await Promise.all(fallbackPromises);
      effectiveHospitalRows = fbHospitals;
      effectiveDoctorRows = fbDoctors;
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

    const { assistant, model, degraded, chatbotState } = await generateAssistant({
      query,
      cityFilter,
      history: slidingHistory,
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
      chatbotState,
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


