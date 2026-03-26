import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { providerReferralPreferences } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

const PROVIDER_ROLES = ["hospital_admin", "doctor"];

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth || !PROVIDER_ROLES.includes(auth.role) || !auth.entityId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [prefs] = await db
    .select()
    .from(providerReferralPreferences)
    .where(eq(providerReferralPreferences.entityId, auth.entityId))
    .limit(1);

  return NextResponse.json({ data: prefs ?? null });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth || !PROVIDER_ROLES.includes(auth.role) || !auth.entityId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as {
    acceptsIncomingReferrals?: boolean;
    defaultResponseSlaMins?: number;
    referralSpecialties?: string[];
    requiresPreapproval?: boolean;
    acceptedReferralTypes?: string[];
  } | null;

  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const entityId = auth.entityId;
  const entityType = auth.role === "doctor" ? "doctor" : "hospital";

  const [existing] = await db
    .select({ id: providerReferralPreferences.id })
    .from(providerReferralPreferences)
    .where(eq(providerReferralPreferences.entityId, entityId))
    .limit(1);

  const values = {
    acceptsIncomingReferrals: body.acceptsIncomingReferrals ?? true,
    defaultResponseSlaMins: body.defaultResponseSlaMins ?? 60,
    referralSpecialties: body.referralSpecialties ? JSON.stringify(body.referralSpecialties) : null,
    requiresPreapproval: body.requiresPreapproval ?? false,
    acceptedReferralTypes: body.acceptedReferralTypes ? JSON.stringify(body.acceptedReferralTypes) : null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(providerReferralPreferences).set(values).where(eq(providerReferralPreferences.entityId, entityId));
  } else {
    await db.insert(providerReferralPreferences).values({ entityId, entityType, ...values });
  }

  return NextResponse.json({ ok: true });
}
