/**
 * Chatbot Knowledge Base — fast structured lookup before Gemini call
 * Architecture: DB → match aliases → inject pre-defined guidance → Gemini only formats
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  chatbotKnowledge,
  type SymptomKnowledgeData,
  type ReportKnowledgeData,
  type IntentKnowledgeData,
} from "@/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────
export type KnowledgeMatch = {
  key: string;
  type: "symptom" | "report" | "intent";
  data: SymptomKnowledgeData | ReportKnowledgeData | IntentKnowledgeData;
  matchedAlias?: string;
};

// ─── Normalise for comparison ─────────────────────────────────────────────────
function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// Simple word-overlap score (Jaccard)
function overlapScore(a: string, b: string): number {
  const stopWords = new Set(["of", "and", "the", "for", "in", "by", "with", "a", "an", "to", "my", "i", "me", "have", "has", "is", "are"]);
  const words = (s: string) =>
    new Set(normalise(s).split(" ").filter(w => w.length > 2 && !stopWords.has(w)));
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  const intersection = [...wa].filter(w => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return intersection / union;
}

// ─── In-memory cache (reloaded every 10 min) ─────────────────────────────────
type CacheEntry = {
  id: string;
  type: string;
  key: string;
  aliases: string[];
  data: SymptomKnowledgeData | ReportKnowledgeData | IntentKnowledgeData;
};

let _cache: CacheEntry[] | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function getCache(): Promise<CacheEntry[]> {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL_MS) return _cache;

  const rows = await db
    .select({
      id: chatbotKnowledge.id,
      type: chatbotKnowledge.type,
      key: chatbotKnowledge.key,
      aliases: chatbotKnowledge.aliases,
      data: chatbotKnowledge.data,
    })
    .from(chatbotKnowledge)
    .where(eq(chatbotKnowledge.isActive, true));

  _cache = rows.map(r => ({
    id: r.id,
    type: r.type,
    key: r.key,
    aliases: Array.isArray(r.aliases) ? r.aliases : [],
    data: r.data as SymptomKnowledgeData | ReportKnowledgeData | IntentKnowledgeData,
  }));
  _cacheTime = now;
  return _cache;
}

export function invalidateKnowledgeCache() {
  _cache = null;
}

// ─── Core lookup ─────────────────────────────────────────────────────────────
/**
 * Find the best-matching knowledge entry for a query.
 * Returns null if no match above threshold.
 */
async function lookupAny(
  query: string,
  type: "symptom" | "report" | "intent",
  threshold = 0.3,
): Promise<KnowledgeMatch | null> {
  const cache = await getCache();
  const entries = cache.filter(e => e.type === type);
  const normQuery = normalise(query);

  let best: { entry: CacheEntry; score: number; matchedAlias?: string } | null = null;

  for (const entry of entries) {
    // Exact or substring match on key first
    const normKey = normalise(entry.key);
    if (normQuery.includes(normKey) || normKey.includes(normQuery)) {
      return { key: entry.key, type: type, data: entry.data };
    }

    // Check aliases
    for (const alias of entry.aliases) {
      const normAlias = normalise(alias);
      if (normQuery.includes(normAlias) || normAlias.includes(normQuery)) {
        return { key: entry.key, type: type, data: entry.data, matchedAlias: alias };
      }
    }

    // Fallback: word overlap score against key + all aliases
    const candidates = [entry.key, ...entry.aliases];
    let maxScore = 0;
    let bestAlias: string | undefined;
    for (const candidate of candidates) {
      const score = overlapScore(normQuery, candidate);
      if (score > maxScore) { maxScore = score; bestAlias = candidate; }
    }

    if (maxScore > (best?.score ?? 0)) {
      best = { entry, score: maxScore, matchedAlias: bestAlias };
    }
  }

  if (best && best.score >= threshold) {
    return { key: best.entry.key, type: type, data: best.entry.data, matchedAlias: best.matchedAlias };
  }

  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────
/** Look up a symptom by user query text */
export async function lookupSymptom(query: string): Promise<(KnowledgeMatch & { data: SymptomKnowledgeData }) | null> {
  const match = await lookupAny(query, "symptom");
  return match ? { ...match, data: match.data as SymptomKnowledgeData } : null;
}

/** Look up a report finding by user query text */
export async function lookupReport(query: string): Promise<(KnowledgeMatch & { data: ReportKnowledgeData }) | null> {
  const match = await lookupAny(query, "report");
  return match ? { ...match, data: match.data as ReportKnowledgeData } : null;
}

/** Look up intent routing by user query text */
export async function lookupIntent(query: string): Promise<(KnowledgeMatch & { data: IntentKnowledgeData }) | null> {
  const match = await lookupAny(query, "intent", 0.25);
  return match ? { ...match, data: match.data as IntentKnowledgeData } : null;
}

/**
 * Given a query, find the best match across symptom AND report catalogs.
 * Returns the highest-scoring match with its type.
 */
export async function lookupBestMatch(query: string): Promise<KnowledgeMatch | null> {
  const [symptomMatch, reportMatch] = await Promise.all([
    lookupAny(query, "symptom", 0.25),
    lookupAny(query, "report", 0.25),
  ]);

  if (!symptomMatch && !reportMatch) return null;
  if (symptomMatch && !reportMatch) return symptomMatch;
  if (!symptomMatch && reportMatch) return reportMatch;
  return symptomMatch; // prefer symptom match
}

/**
 * Fetch up to `limit` few-shot training examples matching language + subtype.
 * Used to give Gemini a grounded response template rather than free-form generation.
 */
export async function lookupFewShots(
  subtype: string | null,
  language: string,
  limit = 2,
): Promise<Array<{ input: string; output: string }>> {
  try {
    // Normalise language name
    const langNorm = language.charAt(0).toUpperCase() + language.slice(1).toLowerCase();

    // Try subtype match first (V4 examples have accurate subtype)
    if (subtype) {
      const rows = await db
        .select({ input: sql<string>`input`, output: sql<string>`output` })
        .from(sql`chatbot_training_examples`)
        .where(sql`lower(subtype) = lower(${subtype}) AND language = ${langNorm} AND quality_tag = 'real_world_synthetic_v4'`)
        .limit(limit) as Array<{ input: string; output: string }>;
      if (rows.length > 0) return rows;
    }

    // Fallback: language-only match
    const rows = await db
      .select({ input: sql<string>`input`, output: sql<string>`output` })
      .from(sql`chatbot_training_examples`)
      .where(sql`language = ${langNorm} AND quality_tag = 'real_world_synthetic_v4'`)
      .orderBy(sql`RANDOM()`)
      .limit(limit) as Array<{ input: string; output: string }>;
    return rows;
  } catch {
    return [];
  }
}

export function buildGuidanceBlock(match: KnowledgeMatch): string {
  if (match.type === "symptom") {
    const d = match.data as SymptomKnowledgeData;
    return [
      `[Pre-computed guidance for "${match.key}"]`,
      `Common causes: ${d.commonCauses.join(", ")}`,
      `Safe initial advice: ${d.safeInitialAdvice}`,
      `Red flags (escalate immediately if present): ${d.redFlags.join("; ")}`,
      `Likely specialist: ${d.likelySpecialty}`,
      `Urgency: ${d.urgencyPattern}`,
      `Base template: ${d.baseResponseTemplate}`,
    ].join("\n");
  }

  if (match.type === "report") {
    const d = match.data as ReportKnowledgeData;
    return [
      `[Pre-computed guidance for report finding "${match.key}"]`,
      `Likely problem: ${d.possibleProblem}`,
      `Patient-friendly meaning: ${d.patientFriendlyMeaning}`,
      `Recommended next step: ${d.nextStep}`,
      `Urgency: ${d.urgencyHint}`,
    ].join("\n");
  }

  if (match.type === "intent") {
    const d = match.data as IntentKnowledgeData;
    return [
      `[Intent routing for "${match.key}"]`,
      `Bot action: ${d.botAction}`,
      `Escalation rule: ${d.escalationRule}`,
    ].join("\n");
  }

  return "";
}
