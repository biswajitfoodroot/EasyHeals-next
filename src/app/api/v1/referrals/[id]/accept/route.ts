import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { referralCases, referralCaseEvents } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth || !["hospital_admin", "doctor"].includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const [caseRow] = await db.select().from(referralCases).where(eq(referralCases.id, id)).limit(1);
  if (!caseRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the destination provider can accept
  const isDestination =
    (auth.role === "hospital_admin" && caseRow.selectedDestinationOrgId === auth.entityId) ||
    (auth.role === "doctor" && caseRow.selectedDestinationProviderId === auth.entityId);

  if (!isDestination) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["submitted", "triaging", "destination_suggested"].includes(caseRow.status)) {
    return NextResponse.json({ error: "Case cannot be accepted in current status" }, { status: 400 });
  }

  const now = new Date();
  await db.update(referralCases)
    .set({ status: "accepted", updatedAt: now })
    .where(eq(referralCases.id, id));

  await db.insert(referralCaseEvents).values({
    referralCaseId: id,
    eventType: "accepted",
    createdByActorType: auth.role,
    createdByActorId: auth.userId,
    note: "Destination provider accepted the referral.",
  });

  return NextResponse.json({ data: { success: true, status: "accepted" } });
}
