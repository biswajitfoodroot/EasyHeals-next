import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { referralCases, referralCaseEvents } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!["hospital_admin", "doctor", "owner", "admin", "operator"].includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const [caseRow] = await db.select().from(referralCases).where(eq(referralCases.id, id)).limit(1);
  if (!caseRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { reason?: string };
  const now = new Date();

  await db.update(referralCases)
    .set({ status: "rejected", statusReason: body.reason ?? null, updatedAt: now })
    .where(eq(referralCases.id, id));

  await db.insert(referralCaseEvents).values({
    referralCaseId: id,
    eventType: "rejected",
    createdByActorType: auth.role,
    createdByActorId: auth.userId,
    note: body.reason ? `Rejected: ${body.reason}` : "Referral rejected.",
  });

  return NextResponse.json({ data: { success: true, status: "rejected" } });
}
