import { and, asc, desc, eq, like, ne, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { doctorHospitalAffiliations, doctors, hospitals } from "@/db/schema";
import { buildDirectionsUrl, parseJsonRecord, parseStringArray, formatHospitalLocation } from "@/lib/profiles";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const key = decodeURIComponent(slug);

  const [doctor] = await db
    .select()
    .from(doctors)
    .where(
      and(
        eq(doctors.isActive, true),
        or(eq(doctors.id, key), eq(doctors.slug, key)),
      ),
    )
    .limit(1);

  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  const affiliationRows = await db
    .select({
      affiliationId: doctorHospitalAffiliations.id,
      role: doctorHospitalAffiliations.role,
      schedule: doctorHospitalAffiliations.schedule,
      feeMin: doctorHospitalAffiliations.feeMin,
      feeMax: doctorHospitalAffiliations.feeMax,
      isPrimary: doctorHospitalAffiliations.isPrimary,
      hospitalId: hospitals.id,
      hospitalSlug: hospitals.slug,
      hospitalName: hospitals.name,
      hospitalCity: hospitals.city,
      hospitalState: hospitals.state,
      hospitalAddressLine1: hospitals.addressLine1,
      hospitalPhone: hospitals.phone,
      hospitalRating: hospitals.rating,
      hospitalReviewCount: hospitals.reviewCount,
      hospitalSpecialties: hospitals.specialties,
      hospitalVerified: hospitals.verified,
      latitude: hospitals.latitude,
      longitude: hospitals.longitude,
    })
    .from(doctorHospitalAffiliations)
    .innerJoin(hospitals, eq(doctorHospitalAffiliations.hospitalId, hospitals.id))
    .where(
      and(
        eq(doctorHospitalAffiliations.doctorId, doctor.id),
        eq(doctorHospitalAffiliations.isActive, true),
        eq(hospitals.isActive, true),
      ),
    )
    .orderBy(desc(doctorHospitalAffiliations.isPrimary), desc(hospitals.rating), asc(hospitals.name))
    .limit(100);

  const cityHint = doctor.city ?? affiliationRows[0]?.hospitalCity ?? null;

  const nearbyDoctors = cityHint
    ? await db
        .select({
          id: doctors.id,
          slug: doctors.slug,
          fullName: doctors.fullName,
          specialization: doctors.specialization,
          specialties: doctors.specialties,
          city: doctors.city,
          state: doctors.state,
          rating: doctors.rating,
          reviewCount: doctors.reviewCount,
          verified: doctors.verified,
        })
        .from(doctors)
        .where(
          and(
            eq(doctors.isActive, true),
            ne(doctors.id, doctor.id),
            or(eq(doctors.city, cityHint), like(doctors.city, `%${cityHint}%`)),
          ),
        )
        .orderBy(desc(doctors.rating), asc(doctors.fullName))
        .limit(8)
    : [];

  const data = {
    doctor: {
      ...doctor,
      specialties: parseStringArray(doctor.specialties),
      qualifications: parseStringArray(doctor.qualifications),
      languages: parseStringArray(doctor.languages),
      consultationHours: parseJsonRecord(doctor.consultationHours),
      locationLabel: [doctor.city, doctor.state].filter(Boolean).join(", "),
    },
    affiliations: affiliationRows.map((row) => ({
      affiliationId: row.affiliationId,
      role: row.role,
      schedule: parseJsonRecord(row.schedule),
      feeMin: row.feeMin,
      feeMax: row.feeMax,
      isPrimary: Boolean(row.isPrimary),
      hospital: {
        id: row.hospitalId,
        slug: row.hospitalSlug,
        name: row.hospitalName,
        city: row.hospitalCity,
        state: row.hospitalState,
        phone: row.hospitalPhone,
        rating: row.hospitalRating ?? 0,
        reviewCount: row.hospitalReviewCount ?? 0,
        verified: Boolean(row.hospitalVerified),
        specialties: parseStringArray(row.hospitalSpecialties),
        profileUrl: `/hospitals/${row.hospitalSlug}`,
        directionsUrl: buildDirectionsUrl({
          latitude: row.latitude,
          longitude: row.longitude,
          address: formatHospitalLocation({
            addressLine1: row.hospitalAddressLine1,
            city: row.hospitalCity,
            state: row.hospitalState,
          }),
        }),
      },
    })),
    nearbyDoctors: nearbyDoctors.map((row) => ({
      id: row.id,
      slug: row.slug,
      fullName: row.fullName,
      specialization: row.specialization,
      specialties: parseStringArray(row.specialties),
      city: row.city,
      state: row.state,
      rating: row.rating ?? 0,
      reviewCount: row.reviewCount ?? 0,
      verified: Boolean(row.verified),
      profileUrl: `/doctors/${row.slug}`,
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
