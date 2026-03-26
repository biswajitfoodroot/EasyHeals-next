import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { commissionDisputes, commissionEntries } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

const OPS_ROLES = ["owner", "admin", "operator"];

// PATCH — ops updates dispute status (under_review | resolved | closed)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth || !OPS_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const [dispute] = await db.select().from(commissionDisputes)
    .where(eq(commissionDisputes.id, id))
    .limit(1);
  if (!dispute) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as {
    status?: "under_review" | "resolved" | "closed";
    resolution?: string;
  };

  const now = new Date();
  const updates: Record<string, unknown> = {};

  if (body.status) updates.status = body.status;
  if (body.resolution) updates.resolution = body.resolution;
  if (body.status === "resolved" || body.status === "closed") {
    updates.resolvedByUserId = auth.userId;
    updates.resolvedAt = now;
  }

  const [updated] = await db.update(commissionDisputes)
    .set(updates)
    .where(eq(commissionDisputes.id, id))
    .returning();

  // If resolved, move commission entry back to confirmed
  if (body.status === "resolved" && dispute.entryId) {
    await db.update(commissionEntries)
      .set({ status: "confirmed", updatedAt: now })
      .where(eq(commissionEntries.id, dispute.entryId));
  }

  return NextResponse.json({ data: updated });
}
