import { and, asc, desc, eq, like, ne, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctorHospitalAffiliations, doctors, hospitalListingPackages, hospitals } from "@/db/schema";

import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { buildDirectionsUrl, buildEmbedMapUrl, formatHospitalLocation, parseJsonRecord, parseStringArray } from "@/lib/profiles";
import { ensureRole } from "@/lib/rbac";
import { slugify } from "@/lib/strings";

const updateHospitalSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  city: z.string().min(2).max(80).optional(),
  state: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  addressLine1: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const entityKey = decodeURIComponent(id);

  const [hospital] = await db
    .select()
    .from(hospitals)
    .where(
      and(
        eq(hospitals.isActive, true),
        or(eq(hospitals.id, entityKey), eq(hospitals.slug, entityKey)),
      ),
    )
    .limit(1);

  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  }

  const affiliations = await db
    .select({
      affiliationId: doctorHospitalAffiliations.id,
      role: doctorHospitalAffiliations.role,
      schedule: doctorHospitalAffiliations.schedule,
      feeMin: doctorHospitalAffiliations.feeMin,
      feeMax: doctorHospitalAffiliations.feeMax,
      isPrimary: doctorHospitalAffiliations.isPrimary,
      doctorId: doctors.id,
      doctorSlug: doctors.slug,
      doctorName: doctors.fullName,
      doctorSpecialization: doctors.specialization,
      doctorSpecialties: doctors.specialties,
      doctorQualifications: doctors.qualifications,
      doctorAvatarUrl: doctors.avatarUrl,
      doctorExperience: doctors.yearsOfExperience,
      doctorRating: doctors.rating,
      doctorReviewCount: doctors.reviewCount,
      doctorVerified: doctors.verified,
    })
    .from(doctorHospitalAffiliations)
    .innerJoin(doctors, eq(doctorHospitalAffiliations.doctorId, doctors.id))
    .where(
      and(
        eq(doctorHospitalAffiliations.hospitalId, hospital.id),
        eq(doctorHospitalAffiliations.isActive, true),
        eq(doctors.isActive, true),
      ),
    )
    .orderBy(desc(doctorHospitalAffiliations.isPrimary), asc(doctors.fullName))
    .limit(100);

  const relatedRows = await db
    .select({
      id: hospitals.id,
      name: hospitals.name,
      slug: hospitals.slug,
      city: hospitals.city,
      state: hospitals.state,
      rating: hospitals.rating,
      specialties: hospitals.specialties,
      addressLine1: hospitals.addressLine1,
      latitude: hospitals.latitude,
      longitude: hospitals.longitude,
    })
    .from(hospitals)
    .where(
      and(
        eq(hospitals.isActive, true),
        eq(hospitals.isPrivate, true),
        ne(hospitals.id, hospital.id),
        or(eq(hospitals.city, hospital.city), like(hospitals.city, `%${hospital.city}%`)),
      ),
    )
    .orderBy(desc(hospitals.rating), asc(hospitals.name))
    .limit(12);

  const mainAddress = formatHospitalLocation({
    addressLine1: hospital.addressLine1,
    city: hospital.city,
    state: hospital.state,
  });

  const primarySpecialties = parseStringArray(hospital.specialties);

  const data = {
    hospital: {
      ...hospital,
      specialties: primarySpecialties,
      facilities: parseStringArray(hospital.facilities),
      photos: parseStringArray(hospital.photos, 24),
      accreditations: parseStringArray(hospital.accreditations),
      workingHours: parseJsonRecord(hospital.workingHours),
      feesRange: parseJsonRecord(hospital.feesRange),
      addressLabel: mainAddress,
      map: {
        embedUrl: buildEmbedMapUrl({
          latitude: hospital.latitude,
          longitude: hospital.longitude,
          address: mainAddress,
        }),
        directionsUrl: buildDirectionsUrl({
          latitude: hospital.latitude,
          longitude: hospital.longitude,
          address: mainAddress,
        }),
      },
    },
    doctors: affiliations.map((row) => ({
      id: row.doctorId,
      slug: row.doctorSlug,
      name: row.doctorName,
      specialization: row.doctorSpecialization,
      specialties: parseStringArray(row.doctorSpecialties),
      qualifications: parseStringArray(row.doctorQualifications),
      avatarUrl: row.doctorAvatarUrl,
      yearsOfExperience: row.doctorExperience,
      rating: row.doctorRating ?? 0,
      reviewCount: row.doctorReviewCount ?? 0,
      verified: Boolean(row.doctorVerified),
      role: row.role,
      schedule: parseJsonRecord(row.schedule),
      feeMin: row.feeMin,
      feeMax: row.feeMax,
      isPrimary: Boolean(row.isPrimary),
      profileUrl: `/doctors/${row.doctorSlug}`,
    })),
    nearbyHospitals: relatedRows.slice(0, 6).map((row) => ({
      ...row,
      rating: row.rating ?? 0,
      specialties: parseStringArray(row.specialties),
      profileUrl: `/hospitals/${row.slug}`,
      mapUrl: buildDirectionsUrl({
        latitude: row.latitude,
        longitude: row.longitude,
        address: formatHospitalLocation({ addressLine1: row.addressLine1, city: row.city, state: row.state }),
      }),
    })),
  };

  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
      },
    },
  );
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const { id } = await params;
  const payload = await req.json();
  const parsed = updateHospitalSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { ...parsed.data };

  if (parsed.data.name) {
    updateData.slug = slugify(parsed.data.name);
  }

  const [updated] = await db
    .update(hospitals)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(hospitals.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  }

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "hospital.update",
    entityType: "hospital",
    entityId: id,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    changes: parsed.data,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const { id } = await params;

  // Verify hospital exists first
  const [existing] = await db
    .select({ id: hospitals.id, name: hospitals.name })
    .from(hospitals)
    .where(eq(hospitals.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  }

  // Hard delete — remove affiliations, packages, then hospital
  await db.delete(doctorHospitalAffiliations).where(eq(doctorHospitalAffiliations.hospitalId, id));
  await db.delete(hospitalListingPackages).where(eq(hospitalListingPackages.hospitalId, id));
  await db.delete(hospitals).where(eq(hospitals.id, id));

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "hospital.delete",
    entityType: "hospital",
    entityId: id,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    changes: { deleted: true, name: existing.name },
  });

  return NextResponse.json({ ok: true });
}

