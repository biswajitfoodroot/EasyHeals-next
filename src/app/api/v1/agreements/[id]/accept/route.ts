import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { providerAgreements, agreementEvents } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!["hospital_admin", "doctor"].includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const [agreement] = await db
    .select()
    .from(providerAgreements)
    .where(eq(providerAgreements.id, id))
    .limit(1);

  if (!agreement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify the provider owns this agreement
  const isOwner =
    (auth.role === "hospital_admin" && agreement.hospitalId === auth.entityId) ||
    (auth.role === "doctor" && agreement.doctorId === auth.entityId);

  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (agreement.status !== "published") {
    return NextResponse.json({ error: "Agreement is not in publishable state" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const now = new Date();

  await db.update(providerAgreements)
    .set({
      status: "accepted",
      acceptedAt: now,
      acceptedByUserId: auth.userId,
      acceptedIp: ip,
      updatedAt: now,
    })
    .where(eq(providerAgreements.id, id));

  await db.insert(agreementEvents).values({
    agreementId: id,
    eventType: "accepted",
    actorId: auth.userId,
    actorType: "provider",
    note: "Provider accepted the agreement.",
  });

  return NextResponse.json({ data: { success: true, status: "accepted" } });
}
