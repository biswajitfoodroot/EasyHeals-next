/**
 * src/app/api/admin/ingestion/jobs/[jobId]/apply/route.ts
 *
 * POST /api/admin/ingestion/jobs/[jobId]/apply
 * "Publish ALL Approved to Core" — writes approved candidates to the real tables.
 *
 * What this does:
 *  1. Hospital: CREATE new OR UPDATE existing (targeted/matched)
 *     - Multi-branch: same chain name in different cities = separate rows
 *     - Slug is name + city, so Manipal Pune and Manipal Mumbai are distinct
 *  2. Doctors: CREATE new OR UPDATE existing + upsert affiliation to hospital
 *     - City-scoped matching prevents cross-branch false links
 *  3. Services: append to hospitals.facilities array (deduplicated)
 *  4. Packages: upsert to hospital_listing_packages
 *  5. Procedure costs: upsert to hospital_listing_packages with source="cost_data"
 *  6. Mark all applied candidates + job as "applied"
 */

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import {
  ingestionJobs,
  ingestionHospitalCandidates,
  ingestionDoctorCandidates,
  ingestionServiceCandidates,
  ingestionPackageCandidates,
  hospitals,
  doctors,
  doctorHospitalAffiliations,
  hospitalListingPackages,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim().slice(0, 80);
}

export async function POST(req: NextRequest, { params }: { params: { jobId: string } }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const { jobId } = params;

  // ── Load job ───────────────────────────────────────────────────────────────
  const [job] = await db.select().from(ingestionJobs).where(eq(ingestionJobs.id, jobId)).limit(1);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status === "applied") return NextResponse.json({ error: "Job already applied." }, { status: 409 });

  // ── Load all APPROVED candidates ───────────────────────────────────────────
  const [approvedHospitals, approvedDoctors, approvedServices, allPackages] = await Promise.all([
    db.select().from(ingestionHospitalCandidates).where(and(eq(ingestionHospitalCandidates.jobId, jobId), eq(ingestionHospitalCandidates.applyStatus, "approved"))),
    db.select().from(ingestionDoctorCandidates).where(and(eq(ingestionDoctorCandidates.jobId, jobId), eq(ingestionDoctorCandidates.applyStatus, "approved"))),
    db.select().from(ingestionServiceCandidates).where(and(eq(ingestionServiceCandidates.jobId, jobId), eq(ingestionServiceCandidates.applyStatus, "approved"))),
    db.select().from(ingestionPackageCandidates).where(and(eq(ingestionPackageCandidates.jobId, jobId), eq(ingestionPackageCandidates.applyStatus, "approved"))),
  ]);

  // Separate packages from procedure costs (procedure costs have rawPayload.type = "procedure_cost")
  const approvedPackages = allPackages.filter(p => {
    const raw = p.rawPayload as Record<string, unknown> | null;
    return !raw?.type || raw.type !== "procedure_cost";
  });
  const approvedProcedureCosts = allPackages.filter(p => {
    const raw = p.rawPayload as Record<string, unknown> | null;
    return raw?.type === "procedure_cost";
  });

  let hospitalsApplied = 0;
  let doctorsApplied = 0;
  let affiliationsApplied = 0;
  let packagesApplied = 0;
  let servicesApplied = 0;
  let procedureCostsApplied = 0;

  // Map from candidateHospitalCandidateId → real DB hospitalId
  const hospitalIdMap = new Map<string, string>();

  // Job-level targetHospitalId (from Scrape Now with a target set)
  const jobSummary = job.summary as Record<string, unknown> | null;
  const jobTargetHospitalId = typeof jobSummary?.targetHospitalId === "string" ? jobSummary.targetHospitalId : null;
  const jobTargetCity = typeof jobSummary?.targetCity === "string" ? jobSummary.targetCity : null;

  // Resolve real hospitalId for a candidate's hospital FK
  function resolveHospitalId(candidateHospitalCandidateId: string | null): string | null {
    if (candidateHospitalCandidateId && hospitalIdMap.has(candidateHospitalCandidateId)) {
      return hospitalIdMap.get(candidateHospitalCandidateId)!;
    }
    return jobTargetHospitalId ?? null;
  }

  // ── 1. Apply hospital candidates ───────────────────────────────────────────
  for (const candidate of approvedHospitals) {
    try {
      let realHospitalId: string;

      if (candidate.matchHospitalId) {
        // ── UPDATE existing hospital branch ────────────────────────────────
        // Only update fields that have new data — don't overwrite with nulls
        const updateSet: Record<string, unknown> = { updatedAt: new Date() };
        if (candidate.phone) updateSet.phone = candidate.phone;
        if (candidate.contactNumbers?.length) updateSet.phones = candidate.contactNumbers;
        if (candidate.email) updateSet.email = candidate.email;
        if (candidate.website) updateSet.website = candidate.website;
        if (candidate.description) updateSet.description = candidate.description;
        if (candidate.addressLine1) updateSet.addressLine1 = candidate.addressLine1;
        if (candidate.addressData) updateSet.address = candidate.addressData;
        if (candidate.latitude) updateSet.latitude = candidate.latitude;
        if (candidate.longitude) updateSet.longitude = candidate.longitude;
        if (candidate.operatingHours) updateSet.workingHours = candidate.operatingHours;
        if (candidate.specialties?.length) updateSet.specialties = candidate.specialties;
        // Merge facilities (keyFacilities → facilities column)
        if (candidate.keyFacilities?.length) updateSet.facilities = candidate.keyFacilities;

        await db.update(hospitals).set(updateSet as Parameters<typeof db.update>[0] & object).where(eq(hospitals.id, candidate.matchHospitalId));
        realHospitalId = candidate.matchHospitalId;
        hospitalsApplied++;
      } else {
        // ── CREATE new hospital branch ─────────────────────────────────────
        // MULTI-BRANCH: slug = nameSlug + citySlug, so Manipal Pune and
        // Manipal Mumbai are separate rows. Pre-check both unique constraints
        // (slug AND city+name) to avoid SQLite constraint errors.
        const citySlug = slugify(candidate.city ?? job.targetCity ?? "india");
        const nameSlug = slugify(candidate.name);
        const slug = `${nameSlug}-${citySlug}`.slice(0, 110);
        const candidateCity = candidate.city ?? job.targetCity ?? "Unknown";

        // Check if a matching hospital already exists (by slug OR city+name)
        const [existingBySlug] = await db.select({ id: hospitals.id })
          .from(hospitals).where(eq(hospitals.slug, slug)).limit(1);
        const [existingByCityName] = !existingBySlug
          ? await db.select({ id: hospitals.id }).from(hospitals)
              .where(and(eq(hospitals.city, candidateCity), eq(hospitals.name, candidate.name))).limit(1)
          : [existingBySlug];

        if (existingBySlug || existingByCityName) {
          // Already exists — update it
          const existId = (existingBySlug ?? existingByCityName).id;
          const patchSet: Record<string, unknown> = { updatedAt: new Date() };
          if (candidate.phone) patchSet.phone = candidate.phone;
          if (candidate.contactNumbers?.length) patchSet.phones = candidate.contactNumbers;
          if (candidate.email) patchSet.email = candidate.email;
          if (candidate.website) patchSet.website = candidate.website;
          if (candidate.description) patchSet.description = candidate.description;
          if (candidate.specialties?.length) patchSet.specialties = candidate.specialties;
          if (candidate.keyFacilities?.length) patchSet.facilities = candidate.keyFacilities;
          if (candidate.operatingHours) patchSet.workingHours = candidate.operatingHours;
          await db.update(hospitals).set(patchSet as Parameters<typeof db.update>[0] & object).where(eq(hospitals.id, existId));
          realHospitalId = existId;
        } else {
          // New hospital branch — insert
          const [newHospital] = await db.insert(hospitals).values({
            name: candidate.name,
            slug,
            type: "hospital",
            isPrivate: true,
            city: candidateCity,
            state: candidate.state ?? null,
            country: candidate.country ?? "India",
            addressLine1: candidate.addressLine1 ?? null,
            address: candidate.addressData ?? null,
            phone: candidate.phone ?? null,
            phones: candidate.contactNumbers ?? [],
            email: candidate.email ?? null,
            website: candidate.website ?? null,
            description: candidate.description ?? null,
            specialties: candidate.specialties ?? [],
            facilities: candidate.keyFacilities ?? [],
            accreditations: [],
            latitude: candidate.latitude ?? null,
            longitude: candidate.longitude ?? null,
            workingHours: candidate.operatingHours ?? null,
            source: "admin_ingestion",
            verified: false,
            isActive: true,
            updatedAt: new Date(),
          }).returning();
          realHospitalId = newHospital.id;
        }
        hospitalsApplied++;
      }

      hospitalIdMap.set(candidate.id, realHospitalId);

      await db.update(ingestionHospitalCandidates)
        .set({ applyStatus: "applied", reviewStatus: "applied", updatedAt: new Date() })
        .where(eq(ingestionHospitalCandidates.id, candidate.id));
    } catch (e) {
      console.error("[apply] Hospital failed:", (e as Error).message);
    }
  }

  // ── 2. Apply doctor candidates ─────────────────────────────────────────────
  for (const candidate of approvedDoctors) {
    try {
      const hospitalId = resolveHospitalId(candidate.hospitalCandidateId);
      let realDoctorId: string;

      if (candidate.matchDoctorId) {
        // ── UPDATE existing doctor record ──────────────────────────────────
        const updateSet: Record<string, unknown> = { updatedAt: new Date() };
        if (candidate.specialization) updateSet.specialization = candidate.specialization;
        if (candidate.phone) updateSet.phone = candidate.phone;
        if (candidate.email) updateSet.email = candidate.email;
        if (candidate.consultationFee) updateSet.consultationFee = candidate.consultationFee;
        if (candidate.feeMin) updateSet.feeMin = candidate.feeMin;
        if (candidate.feeMax) updateSet.feeMax = candidate.feeMax;
        if (candidate.yearsOfExperience) updateSet.yearsOfExperience = candidate.yearsOfExperience;
        if (candidate.qualifications?.length) updateSet.qualifications = candidate.qualifications;
        if (candidate.languages?.length) updateSet.languages = candidate.languages;

        await db.update(doctors).set(updateSet as Parameters<typeof db.update>[0] & object).where(eq(doctors.id, candidate.matchDoctorId));
        realDoctorId = candidate.matchDoctorId;
      } else {
        // ── CREATE new doctor ──────────────────────────────────────────────
        const baseSlug = slugify(candidate.fullName);
        const suffix = Date.now().toString(36).slice(-4);
        const slug = `${baseSlug}-${suffix}`.slice(0, 110);

        const [newDoctor] = await db.insert(doctors).values({
          fullName: candidate.fullName,
          slug,
          hospitalId: hospitalId ?? null,
          specialization: candidate.specialization ?? null,
          qualifications: candidate.qualifications ?? [],
          languages: candidate.languages ?? [],
          phone: candidate.phone ?? null,
          email: candidate.email ?? null,
          yearsOfExperience: candidate.yearsOfExperience ?? null,
          consultationFee: candidate.consultationFee ?? null,
          feeMin: candidate.feeMin ?? null,
          feeMax: candidate.feeMax ?? null,
          consultationHours: candidate.schedule ?? null,
          city: candidate.hospitalCandidateId
            ? (approvedHospitals.find(h => h.id === candidate.hospitalCandidateId)?.city ?? jobTargetCity ?? null)
            : jobTargetCity ?? null,
          verified: false,
          isActive: true,
          updatedAt: new Date(),
        }).returning();

        realDoctorId = newDoctor.id;
      }

      doctorsApplied++;

      // ── Upsert doctor ↔ hospital affiliation ────────────────────────────
      // This is the interlinking: doctor → hospital → branch
      if (hospitalId) {
        await db.insert(doctorHospitalAffiliations).values({
          doctorId: realDoctorId,
          hospitalId,
          role: "Consultant",
          schedule: candidate.schedule ?? null,
          feeMin: candidate.feeMin ?? null,
          feeMax: candidate.feeMax ?? null,
          isPrimary: !candidate.matchDoctorId, // new doctors get primary affiliation
          source: "admin_ingestion",
          isActive: true,
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: [doctorHospitalAffiliations.doctorId, doctorHospitalAffiliations.hospitalId],
          set: {
            schedule: candidate.schedule ?? undefined,
            feeMin: candidate.feeMin ?? undefined,
            feeMax: candidate.feeMax ?? undefined,
            updatedAt: new Date(),
          },
        });
        affiliationsApplied++;
      }

      await db.update(ingestionDoctorCandidates)
        .set({ applyStatus: "applied", reviewStatus: "applied", updatedAt: new Date() })
        .where(eq(ingestionDoctorCandidates.id, candidate.id));
    } catch (e) {
      console.error("[apply] Doctor failed:", (e as Error).message);
    }
  }

  // ── 3. Services → append to hospitals.facilities ───────────────────────────
  for (const candidate of approvedServices) {
    try {
      const hospitalId = resolveHospitalId(candidate.hospitalCandidateId);
      if (hospitalId) {
        const [existing] = await db.select({ facilities: hospitals.facilities }).from(hospitals).where(eq(hospitals.id, hospitalId)).limit(1);
        if (existing) {
          const current = existing.facilities ?? [];
          if (!current.includes(candidate.serviceName)) {
            await db.update(hospitals).set({ facilities: [...current, candidate.serviceName], updatedAt: new Date() }).where(eq(hospitals.id, hospitalId));
          }
          servicesApplied++;
        }
      }
      await db.update(ingestionServiceCandidates)
        .set({ applyStatus: "applied", reviewStatus: "applied", updatedAt: new Date() })
        .where(eq(ingestionServiceCandidates.id, candidate.id));
    } catch (e) {
      console.error("[apply] Service failed:", (e as Error).message);
    }
  }

  // ── 4. Packages → hospital_listing_packages ────────────────────────────────
  for (const candidate of approvedPackages) {
    try {
      const hospitalId = resolveHospitalId(candidate.hospitalCandidateId);
      if (hospitalId) {
        await db.insert(hospitalListingPackages).values({
          hospitalId,
          packageName: candidate.packageName,
          procedureName: candidate.procedureName ?? null,
          department: candidate.department ?? null,
          priceMin: candidate.priceMin ?? null,
          priceMax: candidate.priceMax ?? null,
          currency: candidate.currency ?? "INR",
          inclusions: candidate.inclusions ?? null,
          exclusions: candidate.exclusions ?? null,
          lengthOfStay: candidate.lengthOfStay ?? null,
          source: "admin_ingestion",
          isActive: true,
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: [hospitalListingPackages.hospitalId, hospitalListingPackages.packageName],
          set: { priceMin: candidate.priceMin ?? undefined, priceMax: candidate.priceMax ?? undefined, department: candidate.department ?? undefined, updatedAt: new Date() },
        });
        packagesApplied++;
      }
      await db.update(ingestionPackageCandidates)
        .set({ applyStatus: "applied", reviewStatus: "applied", updatedAt: new Date() })
        .where(eq(ingestionPackageCandidates.id, candidate.id));
    } catch (e) {
      console.error("[apply] Package failed:", (e as Error).message);
    }
  }

  // ── 5. Procedure costs → hospital_listing_packages (source=cost_data) ──────
  // Stored separately so the frontend can do cross-hospital cost comparison
  for (const candidate of approvedProcedureCosts) {
    try {
      const hospitalId = resolveHospitalId(candidate.hospitalCandidateId);
      if (hospitalId && (candidate.priceMin !== null || candidate.priceMax !== null)) {
        await db.insert(hospitalListingPackages).values({
          hospitalId,
          packageName: candidate.packageName,
          procedureName: candidate.procedureName ?? candidate.packageName,
          department: candidate.department ?? null,
          priceMin: candidate.priceMin ?? null,
          priceMax: candidate.priceMax ?? null,
          currency: candidate.currency ?? "INR",
          inclusions: null,
          exclusions: null,
          lengthOfStay: null,
          source: "cost_data",
          isActive: true,
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: [hospitalListingPackages.hospitalId, hospitalListingPackages.packageName],
          set: { priceMin: candidate.priceMin ?? undefined, priceMax: candidate.priceMax ?? undefined, updatedAt: new Date() },
        });
        procedureCostsApplied++;
      }
      await db.update(ingestionPackageCandidates)
        .set({ applyStatus: "applied", reviewStatus: "applied", updatedAt: new Date() })
        .where(eq(ingestionPackageCandidates.id, candidate.id));
    } catch (e) {
      console.error("[apply] ProcedureCost failed:", (e as Error).message);
    }
  }

  // ── Mark job applied ───────────────────────────────────────────────────────
  await db.update(ingestionJobs)
    .set({ status: "applied", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(ingestionJobs.id, jobId));

  return NextResponse.json({
    data: {
      hospitalsApplied,
      doctorsApplied,
      affiliationsApplied,
      packagesApplied,
      servicesApplied,
      procedureCostsApplied,
    },
  });
}
