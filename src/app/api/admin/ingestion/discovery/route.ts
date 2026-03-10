import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { ingestionResearchQueue } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { googleSearchSnippets, isGoogleProfileUrl } from "@/lib/ingestion";
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

  const results = await googleSearchSnippets(query);

  return NextResponse.json({
    data: {
      query,
      results: results.map((item) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        suggestedAction: isGoogleProfileUrl(item.link) ? "import_google_profile" : "scrape_website",
      })),
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
