/**
 * /api/admin/research/batch
 *
 * POST — Create a new research batch job.
 *   Body: { names: string[], city?: string, entityType?: "hospital"|"clinic"|"doctor" }
 *   Returns: { batchId, total }
 *
 * GET  — Poll batch job status.
 *   Query: ?batchId=xxx
 *   Returns: { batch: { id, status, totalCount, doneCount, failedCount, items[] } }
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { researchBatchJobs, type ResearchBatchItem } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

// ── POST — create batch ───────────────────────────────────────────────────────

const createSchema = z.object({
  names: z
    .array(z.string().min(2).max(220).trim())
    .min(1)
    .max(100)
    .transform((arr) => [...new Set(arr.filter(Boolean))]),   // deduplicate
  city: z.string().max(80).optional(),
  entityType: z.enum(["hospital", "clinic", "doctor", "unknown"]).default("hospital"),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { names, city, entityType } = parsed.data;

  const items: ResearchBatchItem[] = names.map((name) => ({
    name,
    city: city ?? null,
    type: entityType === "doctor" ? "doctor" : entityType === "clinic" ? "clinic" : "hospital",
    status: "pending",
    jobId: null,
    error: null,
  }));

  const [batch] = await db
    .insert(researchBatchJobs)
    .values({
      createdByUserId: auth.userId,
      status: "pending",
      totalCount: items.length,
      doneCount: 0,
      failedCount: 0,
      city: city ?? null,
      entityType,
      items,
      updatedAt: new Date(),
    })
    .returning();

  return NextResponse.json({ data: { batchId: batch.id, total: items.length } });
}

// ── GET — poll status ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const batchId = req.nextUrl.searchParams.get("batchId");
  if (!batchId) return NextResponse.json({ error: "batchId is required" }, { status: 400 });

  const [batch] = await db
    .select()
    .from(researchBatchJobs)
    .where(eq(researchBatchJobs.id, batchId))
    .limit(1);

  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  return NextResponse.json({ data: { batch } });
}
