import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import {
  doctorHospitalAffiliations,
  doctors,
  hospitals,
  hospitalListingPackages,
  ingestionDoctorCandidates,
  ingestionHospitalCandidates,
  ingestionJobs,
  ingestionPackageCandidates,
  ingestionServiceCandidates,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { parseStringArray } from "@/lib/profiles";
import { ensureRole } from "@/lib/rbac";
import { slugify } from "@/lib/strings";

type Params = { params: Promise<{ jobId: string }> };

function mergeUnique(input: unknown, additions: string[]): string[] {
  const existing = parseStringArray(input, 80);
  const set = new Set([...existing, ...additions.map((item) => item.trim()).filter(Boolean)]);
  return Array.from(set).slice(0, 80);
}

function shouldSkipCandidate(status: string, reviewStatus: string | null): boolean {
  return ["rejected", "deleted", "skipped", "applied"].includes(status) ||
    ["rejected", "deleted"].includes(reviewStatus ?? "")
    ? true
    : false;
}

async function ensureHospitalSlug(baseName: string): Promise<string> {
  const base = slugify(baseName);
  let slug = base;
  let counter = 1;

  while (true) {
    const existing = await db.select({ id: hospitals.id }).from(hospitals).where(eq(hospitals.slug, slug)).limit(1);
    if (!existing.length) return slug;
    counter += 1;
    slug = `${base}-${counter}`;
  }
}

async function ensureDoctorSlug(baseName: string): Promise<string> {
  const base = slugify(baseName);
  let slug = base;
  let counter = 1;

  while (true) {
    const existing = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.slug, slug)).limit(1);
    if (!existing.length) return slug;
    counter += 1;
    slug = `${base}-${counter}`;
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const { jobId } = await params;

  const [job] = await db.select().from(ingestionJobs).where(eq(ingestionJobs.id, jobId)).limit(1);
  if (!job) {
    return NextResponse.json({ error: "Ingestion job not found" }, { status: 404 });
  }

  const [hospitalCandidates, doctorCandidates, serviceCandidates, packageCandidates] = await Promise.all([
    db.select().from(ingestionHospitalCandidates).where(eq(ingestionHospitalCandidates.jobId, jobId)),
    db.select().from(ingestionDoctorCandidates).where(eq(ingestionDoctorCandidates.jobId, jobId)),
    db.select().from(ingestionServiceCandidates).where(eq(ingestionServiceCandidates.jobId, jobId)),
    db.select().from(ingestionPackageCandidates).where(eq(ingestionPackageCandidates.jobId, jobId)),
  ]);

  const candidateHospitalMap = new Map<string, string>();
  let hospitalsApplied = 0;
  let doctorsApplied = 0;
  let affiliationsApplied = 0;
  let packagesApplied = 0;

  for (const candidate of hospitalCandidates) {
    if (candidate.mergeAction === "skip" || shouldSkipCandidate(candidate.applyStatus, candidate.reviewStatus)) {
      await db
        .update(ingestionHospitalCandidates)
        .set({ applyStatus: "skipped", updatedAt: new Date() })
        .where(eq(ingestionHospitalCandidates.id, candidate.id));
      continue;
    }

    const servicesForCandidate = serviceCandidates
      .filter((item) => item.hospitalCandidateId === candidate.id && !shouldSkipCandidate(item.applyStatus, item.reviewStatus))
      .map((item) => item.serviceName)
      .filter(Boolean);

    const packageRowsForCandidate = packageCandidates.filter(
      (item) => item.hospitalCandidateId === candidate.id && !shouldSkipCandidate(item.applyStatus, item.reviewStatus),
    );

    const specialties = mergeUnique(candidate.specialties, [
      ...parseStringArray(candidate.departments, 40),
      ...servicesForCandidate,
    ]);

    const facilities = mergeUnique(candidate.services, [
      ...parseStringArray(candidate.keyFacilities, 40),
      ...servicesForCandidate,
    ]);

    const packageMin = packageRowsForCandidate
      .map((item) => item.priceMin)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const packageMax = packageRowsForCandidate
      .map((item) => item.priceMax)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    const feesRange =
      packageMin.length || packageMax.length
        ? {
            min: packageMin.length ? Math.min(...packageMin) : null,
            max: packageMax.length ? Math.max(...packageMax) : packageMin.length ? Math.max(...packageMin) : null,
            currency: "INR",
          }
        : null;

    let hospitalId = candidate.matchHospitalId ?? null;

    if (candidate.mergeAction === "update" && hospitalId) {
      const [updated] = await db
        .update(hospitals)
        .set({
          name: candidate.name,
          city: candidate.city ?? undefined,
          state: candidate.state ?? undefined,
          country: candidate.country ?? "India",
          addressLine1: candidate.addressLine1 ?? undefined,
          address: candidate.addressData ?? undefined,
          phone: candidate.phone ?? undefined,
          phones: mergeUnique(candidate.contactNumbers, candidate.phone ? [candidate.phone] : []),
          email: candidate.email ?? undefined,
          website: candidate.website ?? undefined,
          description: candidate.description ?? undefined,
          specialties,
          facilities,
          workingHours: candidate.operatingHours ?? undefined,
          feesRange: feesRange ?? undefined,
          rating: candidate.rating ?? undefined,
          reviewCount: candidate.reviewCount ?? undefined,
          latitude: candidate.latitude ?? undefined,
          longitude: candidate.longitude ?? undefined,
          source: "admin_ingestion",
          updatedAt: new Date(),
          isPrivate: true,
        })
        .where(eq(hospitals.id, hospitalId))
        .returning({ id: hospitals.id });

      if (!updated) {
        hospitalId = null;
      }
    }

    if (!hospitalId) {
      const slug = await ensureHospitalSlug(`${candidate.name}-${candidate.city ?? "india"}`);
      const [created] = await db
        .insert(hospitals)
        .values({
          name: candidate.name,
          slug,
          type: "hospital",
          isPrivate: true,
          city: candidate.city ?? "Unknown",
          state: candidate.state,
          country: candidate.country ?? "India",
          addressLine1: candidate.addressLine1,
          address: candidate.addressData,
          phone: candidate.phone,
          phones: mergeUnique(candidate.contactNumbers, candidate.phone ? [candidate.phone] : []),
          email: candidate.email,
          website: candidate.website,
          description: candidate.description,
          specialties,
          facilities,
          workingHours: candidate.operatingHours,
          feesRange,
          rating: candidate.rating ?? 0,
          reviewCount: candidate.reviewCount ?? 0,
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          source: "admin_ingestion",
          verified: false,
          communityVerified: true,
          regStatus: "pending",
          packageTier: "free",
          updatedAt: new Date(),
        })
        .returning({ id: hospitals.id });

      hospitalId = created.id;
    }

    for (const pkg of packageRowsForCandidate) {
      await db
        .insert(hospitalListingPackages)
        .values({
          hospitalId,
          packageName: pkg.packageName,
          procedureName: pkg.procedureName,
          department: pkg.department,
          priceMin: pkg.priceMin,
          priceMax: pkg.priceMax,
          currency: pkg.currency ?? "INR",
          inclusions: pkg.inclusions,
          exclusions: pkg.exclusions,
          lengthOfStay: pkg.lengthOfStay,
          source: "admin_ingestion",
          isActive: true,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [hospitalListingPackages.hospitalId, hospitalListingPackages.packageName],
          set: {
            procedureName: pkg.procedureName,
            department: pkg.department,
            priceMin: pkg.priceMin,
            priceMax: pkg.priceMax,
            currency: pkg.currency ?? "INR",
            inclusions: pkg.inclusions,
            exclusions: pkg.exclusions,
            lengthOfStay: pkg.lengthOfStay,
            source: "admin_ingestion",
            isActive: true,
            updatedAt: new Date(),
          },
        });

      packagesApplied += 1;

      await db
        .update(ingestionPackageCandidates)
        .set({ applyStatus: "applied", reviewStatus: "published", updatedAt: new Date() })
        .where(eq(ingestionPackageCandidates.id, pkg.id));
    }

    candidateHospitalMap.set(candidate.id, hospitalId);
    hospitalsApplied += 1;

    await db
      .update(ingestionHospitalCandidates)
      .set({ applyStatus: "applied", reviewStatus: "published", matchHospitalId: hospitalId, updatedAt: new Date() })
      .where(eq(ingestionHospitalCandidates.id, candidate.id));

    for (const service of serviceCandidates.filter((item) => item.hospitalCandidateId === candidate.id)) {
      if (shouldSkipCandidate(service.applyStatus, service.reviewStatus)) {
        await db
          .update(ingestionServiceCandidates)
          .set({ applyStatus: "skipped", updatedAt: new Date() })
          .where(eq(ingestionServiceCandidates.id, service.id));
      } else {
        await db
          .update(ingestionServiceCandidates)
          .set({ applyStatus: "applied", reviewStatus: "published", updatedAt: new Date() })
          .where(eq(ingestionServiceCandidates.id, service.id));
      }
    }
  }

  for (const candidate of doctorCandidates) {
    if (candidate.mergeAction === "skip" || shouldSkipCandidate(candidate.applyStatus, candidate.reviewStatus)) {
      await db
        .update(ingestionDoctorCandidates)
        .set({ applyStatus: "skipped", updatedAt: new Date() })
        .where(eq(ingestionDoctorCandidates.id, candidate.id));
      continue;
    }

    const cityHint = hospitalCandidates.find((item) => item.id === candidate.hospitalCandidateId)?.city ?? null;

    let doctorId = candidate.matchDoctorId ?? null;

    if (candidate.mergeAction === "update" && doctorId) {
      const [updated] = await db
        .update(doctors)
        .set({
          fullName: candidate.fullName,
          specialization: candidate.specialization,
          qualifications: candidate.qualifications,
          languages: candidate.languages,
          phone: candidate.phone,
          email: candidate.email,
          yearsOfExperience: candidate.yearsOfExperience,
          feeMin: candidate.feeMin,
          feeMax: candidate.feeMax,
          consultationFee: candidate.consultationFee ?? candidate.feeMin ?? candidate.feeMax ?? undefined,
          consultationHours: candidate.schedule,
          city: cityHint,
          updatedAt: new Date(),
          isActive: true,
        })
        .where(eq(doctors.id, doctorId))
        .returning({ id: doctors.id });

      if (!updated) {
        doctorId = null;
      }
    }

    if (!doctorId) {
      const slug = await ensureDoctorSlug(`${candidate.fullName}-${cityHint ?? "india"}`);

      const [created] = await db
        .insert(doctors)
        .values({
          fullName: candidate.fullName,
          slug,
          specialization: candidate.specialization,
          specialties: candidate.specialization ? [candidate.specialization] : [],
          qualifications: candidate.qualifications,
          languages: candidate.languages,
          phone: candidate.phone,
          email: candidate.email,
          yearsOfExperience: candidate.yearsOfExperience,
          consultationFee: candidate.consultationFee ?? candidate.feeMin ?? candidate.feeMax ?? null,
          feeMin: candidate.feeMin,
          feeMax: candidate.feeMax,
          consultationHours: candidate.schedule,
          city: cityHint,
          rating: 0,
          reviewCount: 0,
          verified: false,
          bio: null,
          isActive: true,
          updatedAt: new Date(),
        })
        .returning({ id: doctors.id });

      doctorId = created.id;
    }

    doctorsApplied += 1;

    await db
      .update(ingestionDoctorCandidates)
      .set({ applyStatus: "applied", reviewStatus: "published", matchDoctorId: doctorId, updatedAt: new Date() })
      .where(eq(ingestionDoctorCandidates.id, candidate.id));

    const candidateHospitalId = candidate.hospitalCandidateId
      ? candidateHospitalMap.get(candidate.hospitalCandidateId)
      : null;

    if (candidateHospitalId) {
      await db
        .insert(doctorHospitalAffiliations)
        .values({
          doctorId,
          hospitalId: candidateHospitalId,
          role: "Consultant",
          schedule: candidate.schedule,
          feeMin: candidate.feeMin,
          feeMax: candidate.feeMax,
          isPrimary: false,
          source: "admin_ingestion",
          isActive: true,
          deletedAt: null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [doctorHospitalAffiliations.doctorId, doctorHospitalAffiliations.hospitalId],
          set: {
            role: "Consultant",
            schedule: candidate.schedule,
            feeMin: candidate.feeMin,
            feeMax: candidate.feeMax,
            source: "admin_ingestion",
            isActive: true,
            deletedAt: null,
            updatedAt: new Date(),
          },
        });

      affiliationsApplied += 1;
    }
  }

  await db
    .update(ingestionJobs)
    .set({
      status: "applied",
      summary: {
        hospitalsApplied,
        doctorsApplied,
        affiliationsApplied,
        packagesApplied,
      },
      updatedAt: new Date(),
      completedAt: new Date(),
    })
    .where(eq(ingestionJobs.id, jobId));

  return NextResponse.json({
    data: {
      jobId,
      hospitalsApplied,
      doctorsApplied,
      affiliationsApplied,
      packagesApplied,
    },
  });
}
