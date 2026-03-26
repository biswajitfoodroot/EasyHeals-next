import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { referralCases, referralCaseEvents, referralDocuments } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

const OPS_ROLES = ["owner", "admin", "operator", "coordinator"];

function canViewCase(auth: { role: string; entityId?: string | null }, c: typeof referralCases.$inferSelect) {
  if (OPS_ROLES.includes(auth.role)) return true;
  if (auth.role === "hospital_admin" && auth.entityId) {
    return c.referringOrganizationId === auth.entityId || c.selectedDestinationOrgId === auth.entityId;
  }
  if (auth.role === "doctor" && auth.entityId) {
    return c.referringProviderId === auth.entityId || c.selectedDestinationProviderId === auth.entityId;
  }
  return false;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [caseRow] = await db.select().from(referralCases).where(eq(referralCases.id, id)).limit(1);
  if (!caseRow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canViewCase(auth, caseRow)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const events = await db.select().from(referralCaseEvents)
    .where(eq(referralCaseEvents.referralCaseId, id))
    .orderBy(referralCaseEvents.createdAt);

  const documents = await db.select().from(referralDocuments)
    .where(eq(referralDocuments.referralCaseId, id));

  return NextResponse.json({ data: { ...caseRow, events, documents } });
}
