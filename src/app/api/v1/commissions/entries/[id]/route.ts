import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/db/client";
import { commissionEntries, providerAgreements } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

const OPS_ROLES = ["owner", "admin", "operator"];

// GET — single entry detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [entry] = await db.select().from(commissionEntries)
    .where(eq(commissionEntries.id, id))
    .limit(1);

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Access control
  if (!OPS_ROLES.includes(auth.role)) {
    const allowed =
      (auth.role === "hospital_admin" && entry.hospitalId === auth.entityId) ||
      (auth.role === "doctor" && entry.doctorId === auth.entityId);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data: entry });
}

// PATCH — ops updates a pending entry (amount, notes) before locking
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth || !OPS_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const [entry] = await db.select().from(commissionEntries)
    .where(eq(commissionEntries.id, id))
    .limit(1);

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["pending", "confirmed"].includes(entry.status)) {
    return NextResponse.json({ error: "Cannot edit a locked or paid entry" }, { status: 400 });
  }

  const body = await req.json() as {
    amountPaise?: number;
    notes?: string;
    status?: "pending" | "confirmed";
  };

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.amountPaise !== undefined) {
    if (body.amountPaise <= 0) return NextResponse.json({ error: "amountPaise must be positive" }, { status: 400 });
    updates.amountPaise = body.amountPaise;
  }
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.status && ["pending", "confirmed"].includes(body.status)) {
    updates.status = body.status;
  }

  const [updated] = await db.update(commissionEntries)
    .set(updates)
    .where(eq(commissionEntries.id, id))
    .returning();

  return NextResponse.json({ data: updated });
}

// POST — action dispatch: lock | notify | dispute | reverse
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [entry] = await db.select().from(commissionEntries)
    .where(eq(commissionEntries.id, id))
    .limit(1);

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as { action: string; reason?: string };
  const now = new Date();

  switch (body.action) {
    case "lock": {
      if (!OPS_ROLES.includes(auth.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (entry.status !== "confirmed") {
        return NextResponse.json({ error: "Only confirmed entries can be locked" }, { status: 400 });
      }
      const [updated] = await db.update(commissionEntries)
        .set({ status: "locked", lockedAt: now, updatedAt: now })
        .where(eq(commissionEntries.id, id))
        .returning();
      return NextResponse.json({ data: updated });
    }

    case "notify": {
      // Mark that provider was notified of the entry
      if (!OPS_ROLES.includes(auth.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const [updated] = await db.update(commissionEntries)
        .set({ notifiedAt: now, updatedAt: now })
        .where(eq(commissionEntries.id, id))
        .returning();
      return NextResponse.json({ data: updated });
    }

    case "provider_accept": {
      // Provider acknowledges the locked amount
      const isProvider =
        (auth.role === "hospital_admin" && entry.hospitalId === auth.entityId) ||
        (auth.role === "doctor" && entry.doctorId === auth.entityId);
      if (!isProvider) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (entry.status !== "locked") {
        return NextResponse.json({ error: "Entry is not locked yet" }, { status: 400 });
      }
      const [updated] = await db.update(commissionEntries)
        .set({ providerAcceptedAt: now, updatedAt: now })
        .where(eq(commissionEntries.id, id))
        .returning();
      return NextResponse.json({ data: updated });
    }

    case "mark_paid": {
      if (!OPS_ROLES.includes(auth.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!["locked", "confirmed"].includes(entry.status)) {
        return NextResponse.json({ error: "Entry cannot be marked paid in current status" }, { status: 400 });
      }
      const [updated] = await db.update(commissionEntries)
        .set({ status: "paid", updatedAt: now })
        .where(eq(commissionEntries.id, id))
        .returning();
      return NextResponse.json({ data: updated });
    }

    case "reverse": {
      if (!OPS_ROLES.includes(auth.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (entry.status === "paid") {
        return NextResponse.json({ error: "Paid entries cannot be reversed" }, { status: 400 });
      }
      const [updated] = await db.update(commissionEntries)
        .set({ status: "reversed", notes: body.reason ? `[Reversed] ${body.reason}` : "[Reversed]", updatedAt: now })
        .where(eq(commissionEntries.id, id))
        .returning();
      return NextResponse.json({ data: updated });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
