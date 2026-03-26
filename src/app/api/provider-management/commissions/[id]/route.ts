import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { commissionEntries } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";

const VALID_STATUSES = ["pending", "confirmed", "locked", "paid", "disputed", "reversed"] as const;
type CommissionStatus = typeof VALID_STATUSES[number];

function isValidStatus(v: unknown): v is CommissionStatus {
  return VALID_STATUSES.includes(v as CommissionStatus);
}

const PM_ROLES = ["owner", "admin", "admin_manager", "admin_editor", "operator", "coordinator"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth || !PM_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Check entry exists
  const [existing] = await db
    .select({ id: commissionEntries.id, status: commissionEntries.status })
    .from(commissionEntries)
    .where(eq(commissionEntries.id, id))
    .limit(1);

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: Partial<{
    status: CommissionStatus;
    notes: string | null;
    paidAt: Date | null;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (body.status !== undefined) {
    if (!isValidStatus(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Valid: ${VALID_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }
    updates.status = body.status;
    // Auto-set paidAt when marking paid
    if (body.status === "paid" && !existing.status.includes("paid")) {
      updates.paidAt = new Date();
    }
    // Clear paidAt if reverting
    if (body.status !== "paid") {
      updates.paidAt = null;
    }
  }

  if (body.notes !== undefined) {
    updates.notes = body.notes ? String(body.notes) : null;
  }

  // Allow explicit paidAt override (e.g. setting the actual payment date)
  if (body.paidAt !== undefined) {
    updates.paidAt = body.paidAt ? new Date(String(body.paidAt)) : null;
  }

  await db.update(commissionEntries).set(updates).where(eq(commissionEntries.id, id));

  return NextResponse.json({ ok: true, id, updates });
}
