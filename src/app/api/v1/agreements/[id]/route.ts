import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/db/client";
import { providerAgreements, agreementEvents } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

const OPS_ROLES = ["owner", "admin", "operator"];

// GET — agreement detail
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [agreement] = await db
    .select()
    .from(providerAgreements)
    .where(eq(providerAgreements.id, id))
    .limit(1);

  if (!agreement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Providers can only see their own published/accepted agreement
  if (!OPS_ROLES.includes(auth.role)) {
    const isOwner =
      (auth.role === "hospital_admin" && agreement.hospitalId === auth.entityId) ||
      (auth.role === "doctor" && agreement.doctorId === auth.entityId);
    if (!isOwner || !["published", "accepted", "rejected"].includes(agreement.status)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const events = await db
    .select()
    .from(agreementEvents)
    .where(eq(agreementEvents.agreementId, id))
    .orderBy(agreementEvents.createdAt);

  return NextResponse.json({ data: { ...agreement, events } });
}

// PATCH — update draft fields (ops only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth || !OPS_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const [agreement] = await db
    .select()
    .from(providerAgreements)
    .where(eq(providerAgreements.id, id))
    .limit(1);

  if (!agreement) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["draft"].includes(agreement.status)) {
    return NextResponse.json({ error: "Only draft agreements can be edited" }, { status: 400 });
  }

  const body = await req.json() as Record<string, unknown>;
  const allowed = ["customTerms", "termsVersion", "tierCode", "commissionPercent",
    "commissionFlat", "revenueShareNotes", "expiresAt", "notes", "agreementType"];
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const [updated] = await db
    .update(providerAgreements)
    .set(patch)
    .where(eq(providerAgreements.id, id))
    .returning();

  return NextResponse.json({ data: updated });
}
