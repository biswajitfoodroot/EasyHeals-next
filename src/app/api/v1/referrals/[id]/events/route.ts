import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { referralCases, referralCaseEvents } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

// POST — add a note/event to a referral case
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [caseRow] = await db.select().from(referralCases).where(eq(referralCases.id, id)).limit(1);
  if (!caseRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Any involved party can add notes
  const canAct =
    ["owner", "admin", "operator", "coordinator"].includes(auth.role) ||
    (auth.role === "hospital_admin" && auth.entityId && (
      caseRow.referringOrganizationId === auth.entityId ||
      caseRow.selectedDestinationOrgId === auth.entityId
    )) ||
    (auth.role === "doctor" && auth.entityId && (
      caseRow.referringProviderId === auth.entityId ||
      caseRow.selectedDestinationProviderId === auth.entityId
    ));

  if (!canAct) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as { note: string; eventType?: string };
  if (!body.note?.trim()) {
    return NextResponse.json({ error: "note is required" }, { status: 400 });
  }

  const [event] = await db.insert(referralCaseEvents).values({
    referralCaseId: id,
    eventType: body.eventType ?? "note_added",
    createdByActorType: auth.role,
    createdByActorId: auth.userId,
    note: body.note.trim(),
  }).returning();

  return NextResponse.json({ data: event }, { status: 201 });
}
