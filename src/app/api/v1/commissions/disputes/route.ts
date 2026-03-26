import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";

import { db } from "@/db/client";
import { commissionEntries, commissionDisputes } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

const OPS_ROLES = ["owner", "admin", "operator"];

// GET — list disputes (ops: all; provider: their own entry disputes)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    if (OPS_ROLES.includes(auth.role)) {
      const rows = await db.select().from(commissionDisputes)
        .orderBy(desc(commissionDisputes.createdAt))
        .limit(100);
      return NextResponse.json({ data: rows });
    }

    // Provider: only disputes they raised
    const rows = await db.select().from(commissionDisputes)
      .where(eq(commissionDisputes.raisedByUserId, auth.userId))
      .orderBy(desc(commissionDisputes.createdAt))
      .limit(50);
    return NextResponse.json({ data: rows });
  } catch (e) {
    console.error("GET /api/v1/commissions/disputes", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST — provider raises a dispute on a commission entry
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as { entryId: string; reason: string };
    if (!body.entryId) return NextResponse.json({ error: "entryId required" }, { status: 400 });
    if (!body.reason?.trim()) return NextResponse.json({ error: "reason required" }, { status: 400 });

    // Verify the entry belongs to this provider
    const [entry] = await db.select().from(commissionEntries)
      .where(eq(commissionEntries.id, body.entryId))
      .limit(1);

    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    if (!OPS_ROLES.includes(auth.role)) {
      const isOwner =
        (auth.role === "hospital_admin" && entry.hospitalId === auth.entityId) ||
        (auth.role === "doctor" && entry.doctorId === auth.entityId);
      if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (["paid", "reversed"].includes(entry.status)) {
      return NextResponse.json({ error: "Cannot dispute a paid or reversed entry" }, { status: 400 });
    }

    // Check no open dispute already exists
    const [existing] = await db.select().from(commissionDisputes)
      .where(and(
        eq(commissionDisputes.entryId, body.entryId),
        eq(commissionDisputes.status, "open"),
      ))
      .limit(1);
    if (existing) {
      return NextResponse.json({ error: "An open dispute already exists for this entry" }, { status: 409 });
    }

    const now = new Date();

    // Create dispute + mark entry as disputed
    const [dispute] = await db.insert(commissionDisputes).values({
      entryId: body.entryId,
      raisedByUserId: auth.userId,
      reason: body.reason.trim(),
      status: "open",
    }).returning();

    await db.update(commissionEntries)
      .set({ status: "disputed", disputedAt: now, updatedAt: now })
      .where(eq(commissionEntries.id, body.entryId));

    return NextResponse.json({ data: dispute }, { status: 201 });
  } catch (e) {
    console.error("POST /api/v1/commissions/disputes", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
