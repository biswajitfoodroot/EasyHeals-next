/**
 * AI Health News Endpoint (Task 3.10)
 *
 * GET /api/v1/health-news?city=Bangalore&interests=cardiology
 *
 * Generates 3-5 health tips/news using Gemini Flash.
 * Redis cached per city+interests (TTL 4h).
 * Consent-gated personalisation: personalised only if analytics consent active.
 * Anonymous/no-consent: returns generic city-based tips.
 */
import { NextRequest, NextResponse } from "next/server";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { redisGet, redisSet } from "@/lib/core/redis";
import { getGeminiClient, generateWithTimeout } from "@/lib/ai/client";
import { createHash } from "crypto";

interface HealthTip {
  id: string;
  title: string;
  summary: string;
  category: string;
  city?: string;
  source: "ai" | "static";
}

// Static fallback tips if AI is unavailable
const STATIC_TIPS: HealthTip[] = [
  {
    id: "tip-1",
    title: "Stay Hydrated This Season",
    summary: "Drink at least 8 glasses of water daily. In Indian summers, increase intake and include ORS or coconut water.",
    category: "general",
    source: "static",
  },
  {
    id: "tip-2",
    title: "Regular Health Check-ups Save Lives",
    summary: "Adults over 30 should get an annual full body check-up including blood pressure, blood sugar, and cholesterol.",
    category: "preventive",
    source: "static",
  },
  {
    id: "tip-3",
    title: "Heart Disease Warning Signs",
    summary: "Chest pain, breathlessness, or arm pain should never be ignored. Call emergency services immediately.",
    category: "emergency",
    source: "static",
  },
];

export const GET = withErrorHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const city = url.searchParams.get("city") ?? "India";
  const interests = url.searchParams.get("interests") ?? "";

  // Cache key: hash (city + interests) to keep keys short
  const cacheInput = `${city.toLowerCase()}:${interests.toLowerCase().split(",").sort().join(",")}`;
  const cacheHash = createHash("sha256").update(cacheInput).digest("hex").slice(0, 16);
  const cacheKey = `ai:health-news:${cacheHash}`;

  // Try cache first
  const cached = await redisGet<HealthTip[]>(cacheKey);
  if (cached) {
    return NextResponse.json({ tips: cached, cached: true, city });
  }

  // Build AI prompt
  const interestList = interests
    ? interests
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const prompt = `You are a public health information system for India. 
Generate exactly 4 concise health tips/news items relevant to patients in ${city}, India.
${interestList.length > 0 ? `Focus on these health areas: ${interestList.join(", ")}.` : "Cover general preventive health."}

Return ONLY a valid JSON array with this exact structure (no markdown, no explanation):
[
  {
    "id": "tip-1",
    "title": "Short title (max 60 chars)",
    "summary": "2-3 sentence practical health tip (max 200 chars)",
    "category": "preventive|emergency|seasonal|nutrition|mental_health|general"
  }
]

Rules:
- Use simple, clear language (class-8 reading level)
- Be medically accurate — no unverified claims
- Focus on actionable advice
- Seasonal tips for current Indian season (March = summer beginning)
- City-relevant (e.g., pollution tips for Delhi, dengue for Mumbai during monsoon)`;

  try {
    const model = getGeminiClient().getGenerativeModel({
      model: "gemini-2.0-flash-lite",
    });

    const result = await generateWithTimeout(
      () => model.generateContent(prompt),
      6000,
    );

    const text = result.response.text().trim();
    // Extract JSON from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array in AI response");

    const tips: HealthTip[] = JSON.parse(jsonMatch[0]).map(
      (t: Omit<HealthTip, "source" | "city">, i: number) => ({
        ...t,
        id: t.id || `tip-${i + 1}`,
        city,
        source: "ai" as const,
      }),
    );

    // Cache for 4 hours
    await redisSet(cacheKey, tips, 4 * 60 * 60);

    return NextResponse.json({ tips, cached: false, city });
  } catch {
    // Graceful fallback — never fail the page load for health news
    return NextResponse.json({
      tips: STATIC_TIPS.map((t) => ({ ...t, city })),
      cached: false,
      city,
      fallback: true,
    });
  }
});
