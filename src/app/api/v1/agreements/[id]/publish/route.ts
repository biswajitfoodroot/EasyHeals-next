import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { providerAgreements, agreementEvents } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!["owner", "admin", "operator"].includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const [agreement] = await db
    .select()
    .from(providerAgreements)
    .where(eq(providerAgreements.id, id))
    .limit(1);

  if (!agreement) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (agreement.status !== "draft") {
    return NextResponse.json({ error: "Only draft agreements can be published" }, { status: 400 });
  }

  const now = new Date();
  await db.update(providerAgreements)
    .set({ status: "published", publishedAt: now, updatedAt: now })
    .where(eq(providerAgreements.id, id));

  await db.insert(agreementEvents).values({
    agreementId: id,
    eventType: "published",
    actorId: auth.userId,
    actorType: "operator",
    note: "Agreement published and sent to provider.",
  });

  return NextResponse.json({ data: { success: true } });
}
