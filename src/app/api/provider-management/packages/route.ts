import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { packages, packageFeatures } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";

const PM_ROLES = ["owner", "admin", "admin_manager", "operator"];

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth || !PM_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pkgs = await db.select().from(packages).orderBy(packages.monthlyPrice);
  const features = await db.select().from(packageFeatures);

  const data = pkgs.map((p) => ({
    ...p,
    features: features.filter((f) => f.packageId === p.id && f.isEnabled).map((f) => f.featureKey),
  }));

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth || !PM_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as {
    code?: string; name?: string; monthlyPrice?: number; features?: string[];
  } | null;

  if (!body?.code || !body.name) {
    return NextResponse.json({ error: "code and name are required" }, { status: 400 });
  }

  // Ensure unique code
  const existing = await db.select({ id: packages.id }).from(packages).where(eq(packages.code, body.code)).limit(1);
  if (existing.length) {
    return NextResponse.json({ error: `Plan code "${body.code}" already exists` }, { status: 409 });
  }

  const [pkg] = await db.insert(packages).values({
    code: body.code.toLowerCase().replace(/\s+/g, "_"),
    name: body.name,
    monthlyPrice: body.monthlyPrice ?? 0,
    isActive: true,
  }).returning({ id: packages.id });

  // Insert features
  for (const featureKey of (body.features ?? [])) {
    if (featureKey.trim()) {
      await db.insert(packageFeatures)
        .values({ packageId: pkg.id, featureKey: featureKey.trim(), isEnabled: true })
        .onConflictDoNothing();
    }
  }

  return NextResponse.json({ ok: true, id: pkg.id }, { status: 201 });
}
