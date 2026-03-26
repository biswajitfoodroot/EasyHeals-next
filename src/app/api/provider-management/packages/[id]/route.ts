import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { packages, packageFeatures } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";

const PM_ROLES = ["owner", "admin", "admin_manager", "operator"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth || !PM_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    name?: string; monthlyPrice?: number; isActive?: boolean; features?: string[];
  } | null;

  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const [existing] = await db.select({ id: packages.id }).from(packages).where(eq(packages.id, id)).limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Update package fields
  await db.update(packages).set({
    ...(body.name !== undefined && { name: body.name }),
    ...(body.monthlyPrice !== undefined && { monthlyPrice: body.monthlyPrice }),
    ...(body.isActive !== undefined && { isActive: body.isActive }),
  }).where(eq(packages.id, id));

  // Replace features if provided
  if (body.features !== undefined) {
    // Delete existing features for this package
    await db.delete(packageFeatures).where(eq(packageFeatures.packageId, id));
    // Re-insert
    for (const featureKey of body.features) {
      if (featureKey.trim()) {
        await db.insert(packageFeatures).values({
          packageId: id, featureKey: featureKey.trim(), isEnabled: true,
        }).onConflictDoNothing();
      }
    }
  }

  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth || auth.role !== "owner") {
    return NextResponse.json({ error: "Only owner can delete plans" }, { status: 403 });
  }

  const { id } = await params;
  await db.delete(packageFeatures).where(eq(packageFeatures.packageId, id));
  await db.delete(packages).where(eq(packages.id, id));

  return NextResponse.json({ ok: true });
}
