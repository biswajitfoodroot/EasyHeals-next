import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { hospitals, packages, hospitalSubscriptions } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";

const PM_ROLES = ["owner", "admin", "admin_manager", "admin_editor", "operator"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth || !PM_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    name?: string; city?: string; state?: string | null;
    phone?: string | null; email?: string | null; website?: string | null;
    description?: string | null; isActive?: boolean; verified?: boolean;
    packageTier?: string; regStatus?: string;
    contactPerson?: string | null; contactPhone?: string | null; contactEmail?: string | null;
    addressLine1?: string | null;
  } | null;

  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const [existing] = await db
    .select({ id: hospitals.id })
    .from(hospitals)
    .where(eq(hospitals.id, id))
    .limit(1);

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.update(hospitals).set({
    ...(body.name !== undefined && { name: body.name }),
    ...(body.city !== undefined && { city: body.city }),
    ...(body.state !== undefined && { state: body.state }),
    ...(body.phone !== undefined && { phone: body.phone }),
    ...(body.email !== undefined && { email: body.email }),
    ...(body.website !== undefined && { website: body.website }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.isActive !== undefined && { isActive: body.isActive }),
    ...(body.verified !== undefined && { verified: body.verified }),
    ...(body.packageTier !== undefined && { packageTier: body.packageTier }),
    ...(body.regStatus !== undefined && { regStatus: body.regStatus }),
    ...(body.contactPerson !== undefined && { contactPerson: body.contactPerson }),
    ...(body.contactPhone !== undefined && { contactPhone: body.contactPhone }),
    ...(body.contactEmail !== undefined && { contactEmail: body.contactEmail }),
    ...(body.addressLine1 !== undefined && { addressLine1: body.addressLine1 }),
    updatedAt: new Date(),
  }).where(eq(hospitals.id, id));

  // Sync hospitalSubscriptions when packageTier changes
  if (body.packageTier !== undefined) {
    try {
      const [pkg] = await db
        .select({ id: packages.id })
        .from(packages)
        .where(eq(packages.code, body.packageTier))
        .limit(1);

      if (pkg) {
        const [existingSub] = await db
          .select({ id: hospitalSubscriptions.id })
          .from(hospitalSubscriptions)
          .where(eq(hospitalSubscriptions.hospitalId, id))
          .limit(1);

        if (existingSub) {
          await db.update(hospitalSubscriptions)
            .set({ packageId: pkg.id, status: "active" })
            .where(eq(hospitalSubscriptions.id, existingSub.id));
        } else {
          await db.insert(hospitalSubscriptions).values({
            hospitalId: id,
            packageId: pkg.id,
            status: "active",
            startsAt: new Date(),
          });
        }
      }
    } catch {
      // Non-fatal: subscription sync is best-effort
    }
  }

  return NextResponse.json({ ok: true, id });
}
