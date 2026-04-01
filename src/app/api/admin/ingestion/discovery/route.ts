import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { ingestionResearchQueue } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { getGeminiClient } from "@/lib/ai/client";
import { env } from "@/lib/env";
import { isGoogleProfileUrl } from "@/lib/ingestion";
import { ensureRole } from "@/lib/rbac";

const createQueueSchema = z.object({
  query: z.string().min(2).max(220),
  selectedResults: z.array(z.object({ title: z.string().min(1).max(220), link: z.string().url() })).min(1).max(30),
  defaultAction: z.enum(["scrape_website", "import_google_profile", "manual_verify"]).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "viewer"]);
  if (forbidden) return forbidden;

  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query || query.length < 2) {
    const queue = await db
      .select()
      .from(ingestionResearchQueue)
      .orderBy(desc(ingestionResearchQueue.createdAt))
      .limit(50);

    return NextResponse.json({ data: { query: null, results: [], queue } });
  }

  type SearchResult = { title: string; link: string; snippet: string; suggestedAction: string };
  let results: SearchResult[] = [];

  // ── Try Google Custom Search first ────────────────────────────────────────
  const hasCustomSearch = Boolean(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX);
  if (hasCustomSearch) {
    const searchUrl = new URL("https://www.googleapis.com/customsearch/v1");
    searchUrl.searchParams.set("key", process.env.GOOGLE_SEARCH_API_KEY!);
    searchUrl.searchParams.set("cx", process.env.GOOGLE_SEARCH_CX!);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("num", "8");
    searchUrl.searchParams.set("gl", "in");
    searchUrl.searchParams.set("hl", "en");

    const googleRes = await fetch(searchUrl.toString(), { cache: "no-store" });
    if (googleRes.ok) {
      const payload = (await googleRes.json()) as { items?: Array<{ title?: string; link?: string; snippet?: string }> };
      results = (payload.items ?? [])
        .map(item => ({ title: item.title?.trim() ?? "", link: item.link?.trim() ?? "", snippet: item.snippet?.trim() ?? "" }))
        .filter(item => item.title && item.link)
        .slice(0, 8)
        .map(item => ({ ...item, suggestedAction: isGoogleProfileUrl(item.link) ? "import_google_profile" : "scrape_website" }));
    }
  }

  // ── Fallback: Gemini Google Search Grounding ──────────────────────────────
  if (results.length === 0 && env.GOOGLE_AI_API_KEY) {
    try {
      const searchModel = getGeminiClient().getGenerativeModel({
        model: env.GEMINI_MODEL,
        // @ts-expect-error — googleSearch tool is valid at runtime
        tools: [{ googleSearch: {} }],
      });

      const groundResult = await searchModel.generateContent(
        `Search India healthcare: ${query}. Find hospital/clinic websites, Google Maps listings, Practo pages. List official website URLs with brief descriptions.`
      );

      const candidate = groundResult.response.candidates?.[0];
      const groundingChunks: Array<{ web?: { uri?: string; title?: string } }> =
        (candidate as { groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } })
          ?.groundingMetadata?.groundingChunks ?? [];
      const groundedText = candidate?.content?.parts?.map((p: unknown) => (p as { text?: string }).text ?? "").join("\n") ?? "";

      results = groundingChunks
        .filter(c => c.web?.uri && c.web?.title)
        .slice(0, 10)
        .map(c => {
          const link = c.web!.uri!;
          // Extract a snippet from grounded text near the URL if possible
          const snippet = groundedText.length > 0
            ? groundedText.slice(0, 600).replace(/\n+/g, " ").trim()
            : "";
          return {
            title: c.web!.title!,
            link,
            snippet,
            suggestedAction: isGoogleProfileUrl(link) ? "import_google_profile" : "scrape_website",
          };
        });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Search failed: ${msg}` }, { status: 502 });
    }
  }

  if (results.length === 0 && !hasCustomSearch && !env.GOOGLE_AI_API_KEY) {
    return NextResponse.json(
      { error: "No search backend configured. Set GOOGLE_AI_API_KEY (recommended) or GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    data: {
      query,
      results,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const payload = await req.json();
  const parsed = createQueueSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid queue payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const { query, selectedResults, defaultAction } = parsed.data;

  const inserted = await db
    .insert(ingestionResearchQueue)
    .values(
      selectedResults.map((item) => {
        const nextAction = defaultAction
          ? defaultAction
          : isGoogleProfileUrl(item.link)
            ? "import_google_profile"
            : "scrape_website";

        return {
          createdByUserId: auth.userId,
          query,
          sourceTitle: item.title,
          sourceUrl: item.link,
          sourceType: isGoogleProfileUrl(item.link) ? "google_profile" : "google_result",
          queueStatus: "queued",
          nextAction,
          taskPayload: {
            title: item.title,
            link: item.link,
          },
          updatedAt: new Date(),
        };
      }),
    )
    .returning();

  return NextResponse.json({ data: { queued: inserted.length, items: inserted } });
}
