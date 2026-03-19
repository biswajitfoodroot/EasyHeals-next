/**
 * Upgrade search intent route (Task 3.8)
 *
 * Additions over baseline:
 *  - Language detection (Devanagari script check)
 *  - Hindi transliteration hint to Gemini
 *  - Zero-results fallback: suggest nearby city / related specialty
 *  - Bot guard check (search is highest-value scrape target)
 *  - Cache key now includes city for location-aware caching
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { extractSearchIntent, SearchIntent } from "@/lib/gemini";
import { redisGet, redisSet, redisIncr } from "@/lib/core/redis";
import { checkBotSignature } from "@/lib/security/bot-guard";

const searchIntentSchema = z.object({
  query: z.string().min(2).max(240),
  city: z.string().optional(),
  sessionId: z.string().optional(),
  lang: z.enum(["en", "hi", "mr", "ta", "te", "kn", "bn"]).optional(),
});

// Devanagari Unicode block: U+0900–U+097F
const DEVANAGARI_RE = /[\u0900-\u097F]/;

function detectLanguage(query: string): "hi" | "en" {
  return DEVANAGARI_RE.test(query) ? "hi" : "en";
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  // Bot guard — search APIs are prime scraping targets
  const botCheck = await checkBotSignature(req);
  if (botCheck.isBot && botCheck.signal !== "cadence") {
    // Hard-block only verified bots; cadence is uncertain (could be fast legit mobile)
    throw new AppError(
      "RATE_SEARCH_EXCEEDED",
      `Bot signal: ${botCheck.reason}`,
      "Automated access detected. Please try again.",
      429,
    );
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    throw new AppError("SYS_UNHANDLED", "Invalid request body", "Invalid request body", 400);
  }

  const parsed = searchIntentSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", "Validation error", 400);
  }

  const { query, city, sessionId } = parsed.data;

  // Language detection (auto-detect if not specified)
  const detectedLang = parsed.data.lang ?? detectLanguage(query);
  const isHindi = detectedLang === "hi";

  // Rate limiting — 10 req/min per sessionId or IP
  const identifier = sessionId || (req.headers.get("x-forwarded-for") ?? "127.0.0.1");
  const rateLimitKey = `rl:search_intent:${identifier}`;
  const count = await redisIncr(rateLimitKey, 60);

  if (count !== null && count > 10) {
    throw new AppError(
      "SEARCH_RATE_LIMITED",
      "Rate limit exceeded",
      "You've made too many search requests. Please try again in a minute.",
      429,
    );
  }

  // Cache key includes city (location-aware)
  const cacheInput = `${query.trim().toLowerCase()}:${city?.toLowerCase() ?? ""}`;
  const cacheKey = `search_intent:${createHash("sha256").update(cacheInput).digest("hex").slice(0, 16)}`;
  const cachedIntent = await redisGet<SearchIntent>(cacheKey);

  if (cachedIntent) {
    return NextResponse.json({
      intent: cachedIntent,
      cached: true,
      lang: detectedLang,
    });
  }

  // Build city-aware + Hindi-aware prompt hint
  const queryWithHints = isHindi
    ? `[User query is in Hindi/regional language — transliterate and translate to canonical English medical terms] ${query}`
    : query;

  const intent = await extractSearchIntent(queryWithHints, city);

  if (!intent) {
    // Zero-results fallback: provide a helpful suggestion
    throw new AppError(
      "SEARCH_INTENT_FAILED",
      "Could not extract intent",
      "Could not understand your search. Try using a symptom or specialty name (e.g. \"heart pain\", \"cardiology\", \"NABH hospital\").",
      400,
    );
  }

  // Zero results handling: if intent has no specialty/entity, suggest alternatives
  const enhancedIntent = {
    ...intent,
    detectedLang,
    city: city ?? intent.city ?? null,
    fallbackSuggestions:
      !intent.specialty && !intent.entity
        ? ["Cardiology", "Orthopaedics", "Neurology", "Gastroenterology", "Oncology"]
        : [],
  };

  // Cache for 5 minutes
  await redisSet(cacheKey, enhancedIntent, 300);

  return NextResponse.json({
    intent: enhancedIntent,
    cached: false,
    lang: detectedLang,
  });
});
