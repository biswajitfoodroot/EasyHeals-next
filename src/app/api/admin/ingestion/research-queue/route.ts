import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { ingestionResearchQueue } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

const updateSchema = z.object({
  id: z.string().min(8),
  queueStatus: z.enum(["queued", "processing", "completed", "failed", "manual_verify"]).optional(),
  nextAction: z.enum(["scrape_website", "import_google_profile", "manual_verify"]).optional(),
  linkedJobId: z.string().optional(),
  failureReason: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "viewer"]);
  if (forbidden) return forbidden;

  const rows = await db
    .select()
    .from(ingestionResearchQueue)
    .orderBy(desc(ingestionResearchQueue.createdAt))
    .limit(120);

  return NextResponse.json({ data: { rows } });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const payload = await req.json();
  const parsed = updateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid queue update", details: parsed.error.flatten() }, { status: 400 });
  }

  const { id, queueStatus, nextAction, linkedJobId, failureReason } = parsed.data;

  const [updated] = await db
    .update(ingestionResearchQueue)
    .set({
      queueStatus,
      nextAction,
      linkedJobId,
      failureReason,
      updatedAt: new Date(),
    })
    .where(eq(ingestionResearchQueue.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
  }

  return NextResponse.json({ data: updated });
}
