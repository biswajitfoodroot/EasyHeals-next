import { and, asc, desc, eq, like, ne, or } from "drizzle-orm";

import { db } from "@/db/client";
import { doctorHospitalAffiliations, doctors, hospitals } from "@/db/schema";
import { buildDirectionsUrl, buildEmbedMapUrl, formatHospitalLocation, parseJsonRecord, parseStringArray } from "@/lib/profiles";

export async function listHospitalsDirectory(limit = 300) {
  const rows = await db
    .select({
      id: hospitals.id,
      slug: hospitals.slug,
      name: hospitals.name,
      city: hospitals.city,
      state: hospitals.state,
      specialties: hospitals.specialties,
      rating: hospitals.rating,
      verified: hospitals.verified,
      reviewCount: hospitals.reviewCount,
      description: hospitals.description,
      isPrivate: hospitals.isPrivate,
      isActive: hospitals.isActive,
    })
    .from(hospitals)
    .where(and(eq(hospitals.isActive, true), eq(hospitals.isPrivate, true), eq(hospitals.type, "hospital")))
    .orderBy(desc(hospitals.verified), desc(hospitals.rating), asc(hospitals.name))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    specialties: parseStringArray(row.specialties),
    rating: row.rating ?? 0,
    verified: Boolean(row.verified),
    reviewCount: row.reviewCount ?? 0,
  }));
}

export async function listDoctorsDirectory(limit = 400) {
  const rows = await db
    .select({
      id: doctors.id,
      slug: doctors.slug,
      fullName: doctors.fullName,
      specialization: doctors.specialization,
      city: doctors.city,
      state: doctors.state,
      specialties: doctors.specialties,
      rating: doctors.rating,
      verified: doctors.verified,
      reviewCount: doctors.reviewCount,
      yearsOfExperience: doctors.yearsOfExperience,
    })
    .from(doctors)
    .where(eq(doctors.isActive, true))
    .orderBy(desc(doctors.verified), desc(doctors.rating), asc(doctors.fullName))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    specialties: parseStringArray(row.specialties),
    rating: row.rating ?? 0,
    verified: Boolean(row.verified),
    reviewCount: row.reviewCount ?? 0,
  }));
}

export async function getHospitalProfileBySlug(slug: string) {
  const [hospital] = await db
    .select()
    .from(hospitals)
    .where(and(eq(hospitals.isActive, true), eq(hospitals.slug, slug)))
    .limit(1);

  if (!hospital) return null;

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

  return {
    hospital: {
      ...hospital,
      specialties: parseStringArray(hospital.specialties),
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
}

export async function getDoctorProfileBySlug(slug: string) {
  const [doctor] = await db
    .select()
    .from(doctors)
    .where(and(eq(doctors.isActive, true), eq(doctors.slug, slug)))
    .limit(1);

  if (!doctor) return null;

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

  return {
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
}

