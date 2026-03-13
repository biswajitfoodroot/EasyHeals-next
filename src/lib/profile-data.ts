import { and, asc, desc, eq, like, ne, or } from "drizzle-orm";

import { db } from "@/db/client";
import { doctorHospitalAffiliations, doctors, hospitalListingPackages, hospitals, taxonomyNodes } from "@/db/schema";
import { enrichDoctorProfile } from "@/lib/doctor-enrich";
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
    .where(and(eq(hospitals.isActive, true), eq(hospitals.isPrivate, true)))
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

  const packagesRows = await db
    .select({
      id: hospitalListingPackages.id,
      packageName: hospitalListingPackages.packageName,
      procedureName: hospitalListingPackages.procedureName,
      department: hospitalListingPackages.department,
      priceMin: hospitalListingPackages.priceMin,
      priceMax: hospitalListingPackages.priceMax,
      currency: hospitalListingPackages.currency,
      lengthOfStay: hospitalListingPackages.lengthOfStay,
      inclusions: hospitalListingPackages.inclusions,
    })
    .from(hospitalListingPackages)
    .where(and(eq(hospitalListingPackages.hospitalId, hospital.id), eq(hospitalListingPackages.isActive, true)))
    .orderBy(asc(hospitalListingPackages.packageName))
    .limit(50);

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
    packages: packagesRows.map((row) => ({
      id: row.id,
      packageName: row.packageName,
      procedureName: row.procedureName,
      department: row.department,
      priceMin: row.priceMin,
      priceMax: row.priceMax,
      currency: row.currency,
      lengthOfStay: row.lengthOfStay,
      inclusions: Array.isArray((row.inclusions as unknown)) ? (row.inclusions as unknown as string[]) : [],
    })),
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

  // First-time visit: auto-enrich from AI (Google Search Grounding via Gemini)
  // Subsequent visits use cached data from the DB (aiEnrichedAt is set)
  if (!doctor.aiEnrichedAt) {
    await enrichDoctorProfile(doctor.id, doctor.fullName, doctor.city);
    // Refetch to get updated fields (bio, qualifications, aiReviewSummary, etc.)
    const [enriched] = await db.select().from(doctors).where(eq(doctors.id, doctor.id)).limit(1);
    if (enriched) Object.assign(doctor, enriched);
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

export async function getTreatmentProfileBySlug(slug: string) {
  const [node] = await db
    .select()
    .from(taxonomyNodes)
    .where(and(eq(taxonomyNodes.slug, slug), eq(taxonomyNodes.isActive, true)))
    .limit(1);

  if (!node) return null;

  const [allHospitals, allDoctors] = await Promise.all([
    db
      .select({
        id: hospitals.id,
        slug: hospitals.slug,
        name: hospitals.name,
        city: hospitals.city,
        state: hospitals.state,
        rating: hospitals.rating,
        reviewCount: hospitals.reviewCount,
        specialties: hospitals.specialties,
        addressLine1: hospitals.addressLine1,
        latitude: hospitals.latitude,
        longitude: hospitals.longitude,
        verified: hospitals.verified,
      })
      .from(hospitals)
      .where(and(eq(hospitals.isActive, true), eq(hospitals.isPrivate, true)))
      .orderBy(desc(hospitals.verified), desc(hospitals.rating), asc(hospitals.name))
      .limit(300),
    db
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
        yearsOfExperience: doctors.yearsOfExperience,
        consultationFee: doctors.consultationFee,
      })
      .from(doctors)
      .where(eq(doctors.isActive, true))
      .orderBy(desc(doctors.verified), desc(doctors.rating), asc(doctors.fullName))
      .limit(300),
  ]);

  const title = node.title.toLowerCase();

  const relatedHospitals = allHospitals
    .filter((h) =>
      parseStringArray(h.specialties).some((s) => s.toLowerCase().includes(title) || title.includes(s.toLowerCase())),
    )
    .slice(0, 12)
    .map((h) => ({
      id: h.id,
      slug: h.slug,
      name: h.name,
      city: h.city,
      state: h.state,
      rating: h.rating ?? 0,
      reviewCount: h.reviewCount ?? 0,
      specialties: parseStringArray(h.specialties),
      verified: Boolean(h.verified),
      profileUrl: `/hospitals/${h.slug}`,
      directionsUrl: buildDirectionsUrl({
        latitude: h.latitude,
        longitude: h.longitude,
        address: formatHospitalLocation({ addressLine1: h.addressLine1, city: h.city, state: h.state }),
      }),
    }));

  const relatedDoctors = allDoctors
    .filter((d) => {
      const spec = (d.specialization ?? "").toLowerCase();
      const specs = parseStringArray(d.specialties).map((s) => s.toLowerCase());
      return spec.includes(title) || title.includes(spec) || specs.some((s) => s.includes(title) || title.includes(s));
    })
    .slice(0, 12)
    .map((d) => ({
      id: d.id,
      slug: d.slug,
      fullName: d.fullName,
      specialization: d.specialization,
      specialties: parseStringArray(d.specialties),
      city: d.city,
      state: d.state,
      rating: d.rating ?? 0,
      reviewCount: d.reviewCount ?? 0,
      verified: Boolean(d.verified),
      yearsOfExperience: d.yearsOfExperience,
      consultationFee: d.consultationFee,
      profileUrl: `/doctors/${d.slug}`,
    }));

  return {
    treatment: {
      id: node.id,
      slug: node.slug,
      title: node.title,
      type: node.type,
      description: node.description,
    },
    relatedHospitals,
    relatedDoctors,
  };
}

export async function listAllSlugs() {
  const [hospitalSlugs, doctorSlugs, treatmentSlugs] = await Promise.all([
    db.select({ slug: hospitals.slug }).from(hospitals).where(and(eq(hospitals.isActive, true), eq(hospitals.isPrivate, true))),
    db.select({ slug: doctors.slug }).from(doctors).where(eq(doctors.isActive, true)),
    db.select({ slug: taxonomyNodes.slug }).from(taxonomyNodes).where(eq(taxonomyNodes.isActive, true)),
  ]);
  return {
    hospitals: hospitalSlugs.map((r) => r.slug),
    doctors: doctorSlugs.map((r) => r.slug),
    treatments: treatmentSlugs.map((r) => r.slug),
  };
}
