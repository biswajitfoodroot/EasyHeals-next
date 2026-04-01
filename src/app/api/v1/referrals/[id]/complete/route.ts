import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { referralCases, referralCaseEvents } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  const [caseRow] = await db.select().from(referralCases).where(eq(referralCases.id, id)).limit(1);
  if (!caseRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canComplete =
    ["owner", "admin", "operator"].includes(auth.role) ||
    (auth.role === "hospital_admin" && (
      caseRow.referringOrganizationId === auth.entityId ||
      caseRow.selectedDestinationOrgId === auth.entityId
    )) ||
    (auth.role === "doctor" && (
      caseRow.referringProviderId === auth.entityId ||
      caseRow.selectedDestinationProviderId === auth.entityId
    ));

  if (!canComplete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  await db.update(referralCases)
    .set({ status: "completed", closedAt: now, updatedAt: now })
    .where(eq(referralCases.id, id));

  await db.insert(referralCaseEvents).values({
    referralCaseId: id,
    eventType: "completed",
    createdByActorType: auth.role,
    createdByActorId: auth.userId,
    note: "Referral case marked as completed.",
  });

  return NextResponse.json({ data: { success: true, status: "completed" } });
}
