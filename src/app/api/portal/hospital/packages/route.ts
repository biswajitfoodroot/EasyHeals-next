/**
 * GET    /api/portal/hospital/packages — list hospital packages
 * POST   /api/portal/hospital/packages — create a new package
 * PATCH  /api/portal/hospital/packages?id=xxx — update package
 * DELETE /api/portal/hospital/packages?id=xxx — delete package
 */
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { hospitalListingPackages } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

async function resolveHospitalId(auth: { role: string; entityId: string | null }, req: NextRequest): Promise<string | null> {
  if (auth.role === "hospital_admin") return auth.entityId;
  const url = new URL(req.url);
  return url.searchParams.get("hospitalId") ?? auth.entityId;
}

const packageSchema = z.object({
  packageName: z.string().min(2).max(300),
  procedureName: z.string().max(300).optional().nullable(),
  department: z.string().max(200).optional().nullable(),
  priceMin: z.number().min(0).optional().nullable(),
  priceMax: z.number().min(0).optional().nullable(),
  currency: z.string().max(10).optional().default("INR"),
  inclusions: z.record(z.string(), z.unknown()).optional().nullable(),
  exclusions: z.record(z.string(), z.unknown()).optional().nullable(),
  lengthOfStay: z.string().max(100).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "hospital_admin"]);
  if (forbidden) return forbidden;

  const hospitalId = await resolveHospitalId(auth, req);
  if (!hospitalId) return NextResponse.json({ error: "No linked hospital" }, { status: 400 });
  if (auth.role === "hospital_admin" && auth.entityId !== hospitalId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db
    .select()
    .from(hospitalListingPackages)
    .where(eq(hospitalListingPackages.hospitalId, hospitalId))
    .orderBy(hospitalListingPackages.department, hospitalListingPackages.packageName);

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "hospital_admin"]);
  if (forbidden) return forbidden;

  const hospitalId = await resolveHospitalId(auth, req);
  if (!hospitalId) return NextResponse.json({ error: "No linked hospital" }, { status: 400 });
  if (auth.role === "hospital_admin" && auth.entityId !== hospitalId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as unknown;
  const parsed = packageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;
  const [created] = await db.insert(hospitalListingPackages).values({
    hospitalId,
    packageName: d.packageName,
    procedureName: d.procedureName ?? null,
    department: d.department ?? null,
    priceMin: d.priceMin ?? null,
    priceMax: d.priceMax ?? null,
    currency: d.currency ?? "INR",
    inclusions: d.inclusions ?? null,
    exclusions: d.exclusions ?? null,
    lengthOfStay: d.lengthOfStay ?? null,
    isActive: d.isActive ?? true,
    source: "portal",
  }).returning();

  await writeAuditLog({ actorUserId: auth.userId, action: "portal.hospital.package.create", entityType: "hospital", entityId: hospitalId, changes: { packageName: d.packageName } });
  return NextResponse.json({ data: created }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "hospital_admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const pkgId = url.searchParams.get("id");
  if (!pkgId) return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });

  const hospitalId = await resolveHospitalId(auth, req);
  if (!hospitalId) return NextResponse.json({ error: "No linked hospital" }, { status: 400 });

  const [existing] = await db.select({ hospitalId: hospitalListingPackages.hospitalId }).from(hospitalListingPackages).where(eq(hospitalListingPackages.id, pkgId)).limit(1);
  if (!existing) return NextResponse.json({ error: "Package not found" }, { status: 404 });
  if (auth.role === "hospital_admin" && existing.hospitalId !== hospitalId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as unknown;
  const parsed = packageSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;
  const updates: Partial<typeof hospitalListingPackages.$inferInsert> = { updatedAt: new Date() };
  if (d.packageName !== undefined) updates.packageName = d.packageName;
  if (d.procedureName !== undefined) updates.procedureName = d.procedureName;
  if (d.department !== undefined) updates.department = d.department;
  if (d.priceMin !== undefined) updates.priceMin = d.priceMin;
  if (d.priceMax !== undefined) updates.priceMax = d.priceMax;
  if (d.currency !== undefined) updates.currency = d.currency;
  if (d.inclusions !== undefined) updates.inclusions = d.inclusions;
  if (d.exclusions !== undefined) updates.exclusions = d.exclusions;
  if (d.lengthOfStay !== undefined) updates.lengthOfStay = d.lengthOfStay;
  if (d.isActive !== undefined) updates.isActive = d.isActive;

  const [updated] = await db.update(hospitalListingPackages).set(updates).where(eq(hospitalListingPackages.id, pkgId)).returning();
  await writeAuditLog({ actorUserId: auth.userId, action: "portal.hospital.package.update", entityType: "hospital", entityId: hospitalId, changes: d });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "hospital_admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const pkgId = url.searchParams.get("id");
  if (!pkgId) return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });

  const hospitalId = await resolveHospitalId(auth, req);
  if (!hospitalId) return NextResponse.json({ error: "No linked hospital" }, { status: 400 });

  const [existing] = await db.select({ hospitalId: hospitalListingPackages.hospitalId }).from(hospitalListingPackages).where(eq(hospitalListingPackages.id, pkgId)).limit(1);
  if (!existing) return NextResponse.json({ error: "Package not found" }, { status: 404 });
  if (auth.role === "hospital_admin" && existing.hospitalId !== hospitalId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(hospitalListingPackages).where(eq(hospitalListingPackages.id, pkgId));
  await writeAuditLog({ actorUserId: auth.userId, action: "portal.hospital.package.delete", entityType: "hospital", entityId: hospitalId, changes: { pkgId } });
  return NextResponse.json({ ok: true });
}
