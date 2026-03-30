import { getGeminiClient } from "@/lib/ai/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { ingestionResearchQueue } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { isGoogleProfileUrl } from "@/lib/ingestion";
import { ensureRole } from "@/lib/rbac";

const agentSchema = z.object({
  query: z.string().min(3).max(500),
  city: z.string().max(80).optional(),
  autoQueue: z.boolean().default(false),
});

export type AgentEntity = {
  name: string;
  type: "hospital" | "clinic" | "doctor" | "unknown";
  city: string | null;
  website: string | null;
  phone: string | null;
  snippet: string;
  sourceUrl: string | null;
};

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

  const parsed = agentSchema.safeParse(payload);
  if (!parsed.success) {
    // Build a user-friendly error message
    let errorMsg = "Please check your input:";
    const errors = parsed.error.flatten().fieldErrors;
    
    if (errors.query) {
      errorMsg += " Research query must be between 3-500 characters.";
    }
    if (errors.city) {
      errorMsg += " City name must be under 80 characters.";
    }
    
    return NextResponse.json(
      { error: errorMsg, details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { query, city, autoQueue } = parsed.data;
  const locationHint = city ? ` in ${city}` : " in India";

  // ── Step 1: Gemini with Google Search Grounding ──────────────────────────
  const searchModel = getGeminiClient().getGenerativeModel({
    model: env.GEMINI_MODEL,
    // @ts-expect-error — googleSearch tool is valid at runtime
    tools: [{ googleSearch: {} }],
  });

  const searchPrompt = `Research the following healthcare query${locationHint}: "${query}"

COMPREHENSIVE RESEARCH INSTRUCTIONS — follow each step:

1. Find all hospitals/clinics matching this query in the specified location. For each:
   - Official website (home, About, Departments, Doctors pages)
   - Google Maps listing: full address, PIN code, phone, rating, review count, working hours
   - Practo.com listing: search practo.com for this hospital — get ALL affiliated doctors with specialization, qualifications, consultation fee, OPD timings

2. For EVERY specialty department found at each hospital (Cardiology, Orthopaedics, Neurology, Oncology, Gastroenterology, ENT, Urology, Gynaecology, Neurosurgery, Pulmonology, Dermatology, Psychiatry, Nephrology, Neonatology, Transplant, etc.):
   - Find the specific doctors: full name, qualifications (MBBS/MD/MS/DM/MCh/DNB), years of experience, consultation fee
   - Search "[hospital name] [specialty] doctors" explicitly if the main page doesn't list them

3. Treatment prices: search "[hospital name] [procedure] cost/price" for key procedures — knee replacement, hip replacement, angioplasty, bypass surgery, IVF, cataract, appendectomy, hernia, kidney stone, dialysis

4. Additional sources: JustDial, Sulekha, Credihealth, GoMedii for any doctor or price data not found above

5. Patient reviews: recent Google reviews and Practo reviews — sentiments on doctor quality, infrastructure, cleanliness, waiting time

Return an EXHAUSTIVE summary: every hospital with specialties AND every doctor name organized by specialty, complete contact details, all prices found.`;

  let searchResult;
  try {
    searchResult = await searchModel.generateContent(searchPrompt);
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    return NextResponse.json({ error: `Gemini search failed: ${msg}` }, { status: 502 });
  }

  const candidate = searchResult.response.candidates?.[0];
  const groundedText = candidate?.content?.parts?.map((p: any) => p.text ?? "").join("\n") ?? "";
  const groundingChunks: Array<{ web?: { uri?: string; title?: string } }> =
    (candidate as any)?.groundingMetadata?.groundingChunks ?? [];

  // ── Step 2: Extract structured entities from grounded text ───────────────
  const extractModel = getGeminiClient().getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const extractPrompt = `Based on the following research about healthcare providers, extract structured entity data.

Research Content:
${groundedText}

Source URLs found:
${groundingChunks.map((c, i) => `[${i}] ${c.web?.title ?? ""}: ${c.web?.uri ?? ""}`).join("\n")}

Extract a JSON array of entities. Each entity must have:
{
  "name": "string — name of hospital, clinic, or doctor",
  "type": "hospital" | "clinic" | "doctor" | "unknown",
  "city": "string or null",
  "website": "string URL or null",
  "phone": "string or null",
  "snippet": "1-2 sentence description of specialties or services",
  "sourceUrl": "string URL from the source list or null"
}

Return ONLY the JSON array, no other text.`;

  let entities: AgentEntity[] = [];
  try {
    const extractResult = await extractModel.generateContent(extractPrompt);
    const raw = extractResult.response.text();
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      entities = JSON.parse(match[0]) as AgentEntity[];
    }
  } catch {
    // Fall back to using grounding chunks directly
    entities = groundingChunks
      .filter((c) => c.web?.uri)
      .map((c) => ({
        name: c.web?.title ?? "Unknown",
        type: "unknown" as const,
        city: city ?? null,
        website: c.web?.uri ?? null,
        phone: null,
        snippet: "",
        sourceUrl: c.web?.uri ?? null,
      }));
  }

  // ── Step 3: Optionally queue discovered URLs ─────────────────────────────
  let queuedItems: Array<{ id: string; sourceUrl: string; sourceTitle: string | null }> = [];

  if (autoQueue) {
    const urlsToQueue = entities
      .filter((e) => e.website)
      .map((e) => ({
        createdByUserId: auth.userId,
        query,
        sourceTitle: e.name,
        sourceUrl: e.website!,
        sourceType: isGoogleProfileUrl(e.website!) ? "google_profile" : "website",
        queueStatus: "queued" as const,
        nextAction: isGoogleProfileUrl(e.website!) ? "import_google_profile" : "scrape_website",
        taskPayload: { name: e.name, city: e.city },
        updatedAt: new Date(),
      }));

    if (urlsToQueue.length > 0) {
      const inserted = await db.insert(ingestionResearchQueue).values(urlsToQueue).returning();
      queuedItems = inserted.map((r) => ({
        id: r.id,
        sourceUrl: r.sourceUrl,
        sourceTitle: r.sourceTitle,
      }));
    }
  }

  return NextResponse.json({
    data: {
      query,
      groundedSummary: groundedText.slice(0, 2000),
      entities,
      queuedCount: queuedItems.length,
      queuedItems,
    },
  });
}
