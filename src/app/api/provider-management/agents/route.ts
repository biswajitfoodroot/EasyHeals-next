import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { channelPartners, channelAttributions } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";

const PM_ROLES = ["owner", "admin", "admin_manager", "operator"];

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth || !PM_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const partners = await db
    .select()
    .from(channelPartners)
    .orderBy(desc(channelPartners.createdAt))
    .limit(200);

  const attributions = await db
    .select()
    .from(channelAttributions)
    .orderBy(desc(channelAttributions.createdAt));

  // Count attributions per partner
  const attrCount: Record<string, number> = {};
  for (const a of attributions) {
    attrCount[a.partnerId] = (attrCount[a.partnerId] ?? 0) + 1;
  }

  const data = partners.map((p) => ({
    ...p,
    attributionCount: attrCount[p.id] ?? 0,
  }));

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth || !PM_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as {
    fullName?: string; phone?: string; email?: string;
    partnerType?: string; city?: string; state?: string; notes?: string;
  } | null;

  if (!body?.fullName?.trim()) {
    return NextResponse.json({ error: "fullName is required" }, { status: 400 });
  }

  const [partner] = await db.insert(channelPartners).values({
    fullName: body.fullName.trim(),
    phone: body.phone?.trim() ?? null,
    email: body.email?.trim() ?? null,
    partnerType: body.partnerType ?? "agent",
    city: body.city?.trim() ?? null,
    state: body.state?.trim() ?? null,
    notes: body.notes?.trim() ?? null,
    status: "active",
    createdByUserId: auth.userId,
  }).returning({ id: channelPartners.id });

  return NextResponse.json({ ok: true, id: partner.id }, { status: 201 });
}
