import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, sum } from "drizzle-orm";

import { db } from "@/db/client";
import { commissionEntries, providerAgreements } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

const OPS_ROLES = ["owner", "admin", "operator"];

// GET — list commission entries. Provider gets their own; ops get all.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(req.url);
  const referralCaseId = searchParams.get("caseId");

  try {
    if (OPS_ROLES.includes(auth.role)) {
      let q = db.select().from(commissionEntries);
      if (referralCaseId) q = q.where(eq(commissionEntries.referralCaseId, referralCaseId)) as typeof q;
      const rows = await q.orderBy(desc(commissionEntries.createdAt)).limit(100);
      return NextResponse.json({ data: rows });
    }

    // Provider: own hospital or doctor entries
    if (auth.role === "hospital_admin" && auth.entityId) {
      const rows = await db.select().from(commissionEntries)
        .where(and(
          eq(commissionEntries.hospitalId, auth.entityId),
          ...(referralCaseId ? [eq(commissionEntries.referralCaseId, referralCaseId)] : []),
        ))
        .orderBy(desc(commissionEntries.createdAt))
        .limit(100);
      return NextResponse.json({ data: rows });
    }

    if (auth.role === "doctor" && auth.entityId) {
      const rows = await db.select().from(commissionEntries)
        .where(and(
          eq(commissionEntries.doctorId, auth.entityId),
          ...(referralCaseId ? [eq(commissionEntries.referralCaseId, referralCaseId)] : []),
        ))
        .orderBy(desc(commissionEntries.createdAt))
        .limit(100);
      return NextResponse.json({ data: rows });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (e) {
    console.error("GET /api/v1/commissions/entries", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST — operator creates a commission entry for a closed case
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!OPS_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      agreementId: string;
      hospitalId?: string;
      doctorId?: string;
      referralCaseId?: string;
      appointmentId?: string;
      amountPaise: number;
      notes?: string;
    };

    if (!body.agreementId) return NextResponse.json({ error: "agreementId required" }, { status: 400 });
    if (!body.amountPaise || body.amountPaise <= 0) {
      return NextResponse.json({ error: "amountPaise must be positive" }, { status: 400 });
    }

    const [entry] = await db.insert(commissionEntries).values({
      agreementId: body.agreementId,
      hospitalId: body.hospitalId,
      doctorId: body.doctorId,
      referralCaseId: body.referralCaseId,
      appointmentId: body.appointmentId,
      amountPaise: body.amountPaise,
      status: "pending",
      notes: body.notes,
      enteredBy: auth.userId,
    }).returning();

    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (e) {
    console.error("POST /api/v1/commissions/entries", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
