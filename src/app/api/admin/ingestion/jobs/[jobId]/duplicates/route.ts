/**
 * GET /api/admin/ingestion/jobs/[jobId]/duplicates
 *
 * Detect potential duplicate doctors and packages for a given ingestion job.
 * Returns candidates that appear to match existing records in the live DB.
 *
 * Response shape:
 *   {
 *     doctors: [{ candidateId, fullName, existingId, existingName, existingSpecialization }],
 *     packages: [{ candidateId, packageName, existingId, existingPackageName }]
 *   }
 */

import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import {
  ingestionJobs,
  ingestionHospitalCandidates,
  ingestionDoctorCandidates,
  ingestionPackageCandidates,
  hospitals,
  doctors,
  doctorHospitalAffiliations,
  hospitalListingPackages,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { normalizeCityName } from "@/lib/strings";

const SKIP_STATUSES = ["rejected", "deleted", "skipped", "applied"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const { jobId } = await params;

  // ── Load job ───────────────────────────────────────────────────────────────
  const [job] = await db.select().from(ingestionJobs).where(eq(ingestionJobs.id, jobId)).limit(1);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const jobSummary = job.summary as Record<string, unknown> | null;
  const jobTargetHospitalId = typeof jobSummary?.targetHospitalId === "string" ? jobSummary.targetHospitalId : null;

  // ── Load HC candidates for this job ────────────────────────────────────────
  const allHCs = await db.select().from(ingestionHospitalCandidates)
    .where(eq(ingestionHospitalCandidates.jobId, jobId));

  // Resolve candidateId → real hospital DB id
  const hospitalCandidateMap = new Map<string, string>();

  for (const hc of allHCs) {
    let realId: string | null = null;
    if (hc.matchHospitalId) {
      realId = hc.matchHospitalId;
    } else {
      const city = normalizeCityName(hc.city ?? "");
      const [existing] = await db.select({ id: hospitals.id }).from(hospitals)
        .where(and(eq(hospitals.name, hc.name), eq(hospitals.city, city))).limit(1);
      if (existing) realId = existing.id;
    }
    if (realId) hospitalCandidateMap.set(hc.id, realId);
  }

  // Also handle cross-job HCs (referenced by doctors but belong to other jobs)
  const [allDoctorCands, allPackageCands] = await Promise.all([
    db.select().from(ingestionDoctorCandidates).where(eq(ingestionDoctorCandidates.jobId, jobId)),
    db.select().from(ingestionPackageCandidates).where(eq(ingestionPackageCandidates.jobId, jobId)),
  ]);

  const crossJobHCIds = [
    ...allDoctorCands.map(d => d.hospitalCandidateId),
    ...allPackageCands.map(p => p.hospitalCandidateId),
  ].filter((id): id is string => !!id && !hospitalCandidateMap.has(id));
  const uniqueCrossJobIds = [...new Set(crossJobHCIds)];

  if (uniqueCrossJobIds.length > 0) {
    const extraHCs = await db.select().from(ingestionHospitalCandidates)
      .where(inArray(ingestionHospitalCandidates.id, uniqueCrossJobIds));
    for (const hc of extraHCs) {
      let realId: string | null = hc.matchHospitalId ?? null;
      if (!realId) {
        const city = normalizeCityName(hc.city ?? "");
        const [existing] = await db.select({ id: hospitals.id }).from(hospitals)
          .where(and(eq(hospitals.name, hc.name), eq(hospitals.city, city))).limit(1);
        if (existing) realId = existing.id;
      }
      if (realId) hospitalCandidateMap.set(hc.id, realId);
    }
  }

  function resolveHospitalId(candidateHCId: string | null): string | null {
    if (candidateHCId && hospitalCandidateMap.has(candidateHCId)) {
      return hospitalCandidateMap.get(candidateHCId)!;
    }
    return jobTargetHospitalId ?? null;
  }

  // ── Detect duplicate doctors ────────────────────────────────────────────────
  const doctorDuplicates: Array<{
    candidateId: string;
    fullName: string;
    specialization: string | null;
    existingId: string;
    existingName: string;
    existingSpecialization: string | null;
    hospitalId: string;
  }> = [];

  const eligibleDoctors = allDoctorCands.filter(d => !SKIP_STATUSES.includes(d.applyStatus));

  for (const candidate of eligibleDoctors) {
    // Skip if already explicitly set to update an existing doctor
    if (candidate.matchDoctorId) continue;

    const hospitalId = resolveHospitalId(candidate.hospitalCandidateId);
    if (!hospitalId) continue;

    // Check for name match — case-insensitive, normalized
    const normalized = candidate.fullName.trim().toLowerCase();

    // Look in affiliations for doctor at this hospital with matching name
    const affiliated = await db
      .select({ doctorId: doctorHospitalAffiliations.doctorId })
      .from(doctorHospitalAffiliations)
      .where(eq(doctorHospitalAffiliations.hospitalId, hospitalId));

    const affiliatedIds = affiliated.map(a => a.doctorId).filter(Boolean) as string[];
    if (affiliatedIds.length === 0) continue;

    const existingDoctors = await db
      .select({ id: doctors.id, fullName: doctors.fullName, specialization: doctors.specialization })
      .from(doctors)
      .where(inArray(doctors.id, affiliatedIds));

    for (const existing of existingDoctors) {
      if (existing.fullName.trim().toLowerCase() === normalized) {
        doctorDuplicates.push({
          candidateId: candidate.id,
          fullName: candidate.fullName,
          specialization: candidate.specialization ?? null,
          existingId: existing.id,
          existingName: existing.fullName,
          existingSpecialization: existing.specialization ?? null,
          hospitalId,
        });
        break;
      }
    }
  }

  // ── Detect duplicate packages ───────────────────────────────────────────────
  const packageDuplicates: Array<{
    candidateId: string;
    packageName: string;
    existingId: string;
    existingPackageName: string;
    existingPriceMin: number | null;
    existingPriceMax: number | null;
    hospitalId: string;
  }> = [];

  const eligiblePackages = allPackageCands.filter(p => !SKIP_STATUSES.includes(p.applyStatus));

  for (const candidate of eligiblePackages) {
    const hospitalId = resolveHospitalId(candidate.hospitalCandidateId);
    if (!hospitalId) continue;

    const normalized = candidate.packageName.trim().toLowerCase();
    const existingPkgs = await db
      .select({ id: hospitalListingPackages.id, packageName: hospitalListingPackages.packageName, priceMin: hospitalListingPackages.priceMin, priceMax: hospitalListingPackages.priceMax })
      .from(hospitalListingPackages)
      .where(eq(hospitalListingPackages.hospitalId, hospitalId));

    for (const pkg of existingPkgs) {
      if (pkg.packageName.trim().toLowerCase() === normalized) {
        packageDuplicates.push({
          candidateId: candidate.id,
          packageName: candidate.packageName,
          existingId: pkg.id,
          existingPackageName: pkg.packageName,
          existingPriceMin: pkg.priceMin,
          existingPriceMax: pkg.priceMax,
          hospitalId,
        });
        break;
      }
    }
  }

  return NextResponse.json({
    data: {
      doctors: doctorDuplicates,
      packages: packageDuplicates,
    },
  });
}
