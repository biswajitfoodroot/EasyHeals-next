import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { commissionEntries, hospitals, providerAgreements } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";

const PM_ROLES = ["owner", "admin", "admin_manager", "admin_editor", "operator", "coordinator"];

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth || !PM_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { agreementId, amountPaise, notes, status } = body as {
    agreementId: string;
    amountPaise: number;
    notes?: string;
    status?: string;
  };

  if (!agreementId) return NextResponse.json({ error: "agreementId required" }, { status: 400 });
  if (!amountPaise || typeof amountPaise !== "number" || amountPaise <= 0) {
    return NextResponse.json({ error: "amountPaise must be a positive number" }, { status: 400 });
  }

  // Verify agreement exists
  const [agreement] = await db
    .select({ id: providerAgreements.id, hospitalId: providerAgreements.hospitalId, doctorId: providerAgreements.doctorId })
    .from(providerAgreements)
    .where(eq(providerAgreements.id, agreementId))
    .limit(1);

  if (!agreement) return NextResponse.json({ error: "Agreement not found" }, { status: 404 });

  const validStatuses = ["pending", "confirmed", "locked"];
  const entryStatus = validStatuses.includes(status ?? "") ? status! : "pending";

  const [entry] = await db
    .insert(commissionEntries)
    .values({
      agreementId,
      hospitalId: agreement.hospitalId ?? undefined,
      doctorId: agreement.doctorId ?? undefined,
      amountPaise: Math.round(amountPaise),
      status: entryStatus,
      notes: notes ?? null,
      enteredBy: auth.userId,
    })
    .returning({ id: commissionEntries.id });

  return NextResponse.json({ ok: true, id: entry.id }, { status: 201 });
}
