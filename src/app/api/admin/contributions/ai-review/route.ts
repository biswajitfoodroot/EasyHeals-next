/**
 * POST /api/admin/contributions/ai-review
 * Runs Gemini AI validation on a batch of pending contributions and returns
 * per-contribution recommendations (approve / reject / manual_review) with reasons.
 *
 * PUT /api/admin/contributions/ai-review
 * Bulk apply the AI-recommended actions (approve / reject) to contributions.
 */

import { getGeminiClient } from "@/lib/ai/client";
import { and, desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { contributions, doctors, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { env } from "@/lib/env";
import { ensureRole } from "@/lib/rbac";

type ContributionRow = typeof contributions.$inferSelect;

// ── AI review for a single contribution ──────────────────────────────────────

async function aiReviewContributions(batch: ContributionRow[]): Promise<
  Array<{
    id: string;
    recommendation: "approve" | "reject" | "manual_review";
    confidence: number;
    reason: string;
  }>
> {
  const model = getGeminiClient().getGenerativeModel({
    model: env.GEMINI_MODEL ?? "gemini-2.5-flash",
  });

  const contributionSummaries = batch.map((c) => ({
    id: c.id,
    targetType: c.targetType,
    field: c.fieldChanged,
    oldValue: c.oldValue,
    newValue: c.newValue,
    outlierScore: c.outlierScore,
    outlierFlags: c.outlierFlags,
    status: c.status,
  }));

  const prompt = `You are a healthcare data quality AI. Review these pending community contributions and decide whether to approve, reject, or flag for manual review.

For each contribution, consider:
- Is the new value plausible for a ${contributionSummaries[0]?.targetType ?? "healthcare"} entity?
- Are there outlier flags that suggest spam or misinformation?
- Does the change look like a genuine data correction?
- Phone numbers: must be valid 10-digit Indian mobile/landline
- Websites: must look like real URLs
- Specialties/qualifications: must be real medical terms

Contributions to review:
${JSON.stringify(contributionSummaries, null, 2)}

Return a JSON array with exactly ${batch.length} objects, one per contribution in the same order:
[
  {
    "id": "<contribution id>",
    "recommendation": "approve" | "reject" | "manual_review",
    "confidence": 0.0-1.0,
    "reason": "brief explanation (max 120 chars)"
  }
]

Return ONLY valid JSON, no markdown fences.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = JSON.parse(text) as Array<{
      id: string;
      recommendation: "approve" | "reject" | "manual_review";
      confidence: number;
      reason: string;
    }>;
    return parsed;
  } catch {
    // Fallback: return manual_review for all
    return batch.map((c) => ({
      id: c.id,
      recommendation: "manual_review" as const,
      confidence: 0,
      reason: "AI review unavailable — please review manually",
    }));
  }
}

// ── GET: fetch pending contributions ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const limit = Math.min(50, Number(req.nextUrl.searchParams.get("limit") ?? 30));
  const statusFilter = req.nextUrl.searchParams.get("status") ?? "pending";

  const rows = await db
    .select()
    .from(contributions)
    .where(statusFilter !== "all" ? eq(contributions.status, statusFilter) : undefined)
    .orderBy(desc(contributions.createdAt))
    .limit(limit);

  // Enrich with entity names
  const hospitalIds = [...new Set(rows.filter((r) => r.targetType === "hospital").map((r) => r.targetId))];
  const doctorIds = [...new Set(rows.filter((r) => r.targetType === "doctor").map((r) => r.targetId))];

  const [hospitalNames, doctorNames] = await Promise.all([
    hospitalIds.length
      ? db.select({ id: hospitals.id, name: hospitals.name }).from(hospitals).where(inArray(hospitals.id, hospitalIds))
      : [],
    doctorIds.length
      ? db.select({ id: doctors.id, name: doctors.fullName }).from(doctors).where(inArray(doctors.id, doctorIds))
      : [],
  ]);

  const nameMap = new Map<string, string>([
    ...hospitalNames.map((h): [string, string] => [h.id, h.name]),
    ...doctorNames.map((d): [string, string] => [d.id, d.name]),
  ]);

  const enriched = rows.map((r) => ({
    ...r,
    entityName: nameMap.get(r.targetId) ?? r.targetId,
  }));

  return NextResponse.json({ data: enriched });
}

// ── POST: AI review batch ─────────────────────────────────────────────────────

const reviewSchema = z.object({
  ids: z.array(z.string()).min(1).max(50),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const body = await req.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(contributions)
    .where(and(inArray(contributions.id, parsed.data.ids)));

  if (!rows.length) {
    return NextResponse.json({ error: "No contributions found" }, { status: 404 });
  }

  const reviews = await aiReviewContributions(rows);

  return NextResponse.json({ data: reviews });
}

// ── PUT: bulk apply AI recommendations ───────────────────────────────────────

const bulkApplySchema = z.object({
  actions: z.array(
    z.object({
      id: z.string(),
      action: z.enum(["approve", "reject"]),
    }),
  ).min(1),
});

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const body = await req.json();
  const parsed = bulkApplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  let approved = 0;
  let rejected = 0;

  for (const { id, action } of parsed.data.actions) {
    await db
      .update(contributions)
      .set({
        status: action === "approve" ? "approved" : "rejected",
        reviewedAt: new Date(),
        reviewedBy: auth.userId,
      })
      .where(eq(contributions.id, id));

    if (action === "approve") approved++;
    else rejected++;
  }

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "admin.contributions.bulk_apply",
    entityType: "contribution",
    changes: { approved, rejected, total: parsed.data.actions.length },
  });

  return NextResponse.json({ data: { approved, rejected } });
}
