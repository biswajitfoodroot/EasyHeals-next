/**
 * src/app/api/admin/ingestion/jobs/route.ts
 *
 * GET  ?jobId=   → full job details with all candidate tables
 * GET  (no id)   → list recent 20 jobs
 * POST { sourceUrl, ... }                    → direct URL scrape ("Scrape Now")
 * POST { query, selectedResults[] }          → queue discovery results
 */

import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import {
  ingestionJobs,
  ingestionSources,
  ingestionHospitalCandidates,
  ingestionDoctorCandidates,
  ingestionServiceCandidates,
  ingestionPackageCandidates,
  ingestionFieldConfidences,
  ingestionResearchQueue,
  doctors,
  hospitals,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  fetchWebsiteSource,
  extractStructuredFromSources,
  fetchGoogleProfileData,
  isGoogleProfileUrl,
  chooseBestDoctorMatch,
  IngestionProgress,
  CrawledPage,
  type WebsiteSourceResult,
} from "@/lib/ingestion";
import { ensureRole } from "@/lib/rbac";

// ─── Schemas ───────────────────────────────────────────────────────────────────

const directScrapeSchema = z.object({
  sourceUrl: z.string().url("sourceUrl must be a valid URL"),
  hospitalName: z.string().max(220).optional(),
  city: z.string().max(100).optional(),
  searchQuery: z.string().max(220).optional(),
  // When provided: doctors/services appended to this hospital branch
  targetHospitalId: z.string().optional(),
});

const createQueueSchema = z.object({
  query: z.string().min(2).max(220),
  selectedResults: z.array(z.object({ title: z.string().min(1).max(220), link: z.string().url() })).min(1).max(30),
  defaultAction: z.enum(["scrape_website", "import_google_profile", "manual_verify"]).optional(),
});

// ─── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "viewer"]);
  if (forbidden) return forbidden;

  const jobId = req.nextUrl.searchParams.get("jobId")?.trim();

  try {
    if (jobId) {
      const [job] = await db.select().from(ingestionJobs).where(eq(ingestionJobs.id, jobId)).limit(1);
      if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

      const [sources, hospitalCandidatesRaw, doctorCandidatesRaw, serviceCandidates, packageCandidates, fieldConfidences] =
        await Promise.all([
          db.select().from(ingestionSources).where(eq(ingestionSources.jobId, jobId)),
          db
            .select()
            .from(ingestionHospitalCandidates)
            .leftJoin(hospitals, eq(ingestionHospitalCandidates.matchHospitalId, hospitals.id))
            .where(eq(ingestionHospitalCandidates.jobId, jobId)),
          db
            .select()
            .from(ingestionDoctorCandidates)
            .leftJoin(doctors, eq(ingestionDoctorCandidates.matchDoctorId, doctors.id))
            .where(eq(ingestionDoctorCandidates.jobId, jobId)),
          db.select().from(ingestionServiceCandidates).where(eq(ingestionServiceCandidates.jobId, jobId)),
          db.select().from(ingestionPackageCandidates).where(eq(ingestionPackageCandidates.jobId, jobId)),
          db.select().from(ingestionFieldConfidences).where(eq(ingestionFieldConfidences.jobId, jobId)),
        ]);

      // Flatten candidates for simpler frontend consumption
      const flattenedHospitals = hospitalCandidatesRaw.map((row) => ({
        ...row.ingestion_hospital_candidates,
        matchHospitalName: row.hospitals?.name,
      }));
      const flattenedDoctors = doctorCandidatesRaw.map((row) => ({
        ...row.ingestion_doctor_candidates,
        matchDoctorName: row.doctors?.fullName,
      }));

      return NextResponse.json({
        data: {
          job,
          sources,
          hospitalCandidates: flattenedHospitals,
          doctorCandidates: flattenedDoctors,
          serviceCandidates,
          packageCandidates,
          fieldConfidences,
        },
      });
    }

    const jobs = await db.select().from(ingestionJobs).orderBy(desc(ingestionJobs.createdAt)).limit(20);
    return NextResponse.json({ data: { jobs } });
  } catch (err: any) {
    console.error("INGESTION_GET_ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

// ─── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const directParsed = directScrapeSchema.safeParse(body);
  if (directParsed.success) return handleDirectScrape(auth, directParsed.data);

  const queueParsed = createQueueSchema.safeParse(body);
  if (queueParsed.success) return handleQueueCreate(auth, queueParsed.data);

  return NextResponse.json(
    { error: "Invalid payload", hint: "Send { sourceUrl } for direct scraping or { query, selectedResults[] } for queue creation." },
    { status: 400 },
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HANDLER A — Direct URL scrape
// ═══════════════════════════════════════════════════════════════════════════════

async function handleDirectScrape(auth: { userId: string }, data: z.infer<typeof directScrapeSchema>) {
  const { sourceUrl, hospitalName, city, searchQuery, targetHospitalId } = data;
  const hints = {
    hospitalName: hospitalName || searchQuery || undefined,
    city: city || undefined,
    targetHospitalId: targetHospitalId || undefined,
  };

  const isTargeted = Boolean(targetHospitalId);

  // 1. Initial Job record
  const [job] = await db.insert(ingestionJobs).values({
    requestedByUserId: auth.userId,
    status: "collecting_sources",
    sourceUrl,
    searchQuery: hints.hospitalName ?? null,
    targetCity: hints.city ?? null,
    runMode: isTargeted ? "targeted_update" : "website_only",
    summary: {
      targetHospitalId: hints.targetHospitalId ?? null,
      currentTask: "Initializing...",
      percent: 0,
      warnings: [],
    },
    startedAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  const jobId = job.id;

  // Progress callback for DB updates
  const onProgress = async (p: IngestionProgress) => {
    console.log(`[Job ${jobId}] ${p.stage}: ${p.message} (${p.percent ?? 0}%)`);
    await db.update(ingestionJobs).set({
      status: p.stage === 'finished' ? 'done' : p.stage,
      summary: {
        ...(job.summary as any),
        currentTask: p.message,
        percent: p.percent ?? (p.stage === 'fetching' ? 10 : p.stage === 'extracting' ? 80 : 100),
      },
      updatedAt: new Date(),
    }).where(eq(ingestionJobs.id, jobId));

    // Checkpoint: Save individual pages as they come
    if (p.stage === 'fetching' && p.data?.page) {
      const pg = p.data.page as CrawledPage;
      await db.insert(ingestionSources).values({
        jobId,
        sourceType: "website",
        sourceUrl: pg.url,
        title: pg.url,
        rawContent: pg.text,
        confidence: 1.0,
      }).onConflictDoUpdate({
        target: [ingestionSources.jobId, ingestionSources.sourceUrl],
        set: { rawContent: pg.text, updatedAt: new Date() }
      }).catch(() => null);
    }
  };

  try {
    // ── Google Maps path ──────────────────────────────────────────────────
    if (isGoogleProfileUrl(sourceUrl)) {
      await onProgress({ stage: 'fetching', message: "Fetching Google Profile...", percent: 20 });
      const profile = await fetchGoogleProfileData({ sourceUrl, hospitalName: hints.hospitalName, city: hints.city });
      if (!profile) {
        return NextResponse.json({ error: "Google Profile fetch returned no data.", code: "GOOGLE_PROFILE_EMPTY", retryable: true }, { status: 422 });
      }

      const extracted = await extractStructuredFromSources({
        websiteUrl: profile.website ?? sourceUrl,
        websiteText: [profile.name, profile.formattedAddress, profile.openingHours.join(", ")].filter(Boolean).join("\n"),
        searchSnippets: [], hints, googleProfile: profile, crawledPages: [],
        onProgress,
      });

      const finalJob = await saveJobAndCandidates(auth.userId, sourceUrl, hints, extracted, { mode: "google_profile", pagesVisited: 0, warnings: [], blockedStatus: null }, jobId);
      return NextResponse.json({ data: { jobId: finalJob.id, summary: finalJob.summary } });
    }

    // ── Website scrape path ────────────────────────────────────────────────
    const useBrowserAutomation = env.ENABLE_BROWSER_AUTOMATION === "true";
    const sourceResult = await fetchWebsiteSource(sourceUrl, { useBrowserAutomation, onProgress });

    let googleProfile = null;
    if (hints.hospitalName) {
      googleProfile = await fetchGoogleProfileData({ sourceUrl, hospitalName: hints.hospitalName, city: hints.city }).catch(() => null);
    }

    const extracted = await extractStructuredFromSources({
      websiteUrl: sourceUrl,
      websiteText: sourceResult.text,
      searchSnippets: [],
      hints,
      googleProfile,
      crawledPages: sourceResult.crawledPages,
      onProgress,
    });

    const finalJob = await saveJobAndCandidates(auth.userId, sourceUrl, hints, extracted, {
      mode: sourceResult.mode,
      pagesVisited: sourceResult.crawledPages.length + 1,
      warnings: sourceResult.warnings,
      blockedStatus: sourceResult.blockedStatus,
    }, jobId);

    return NextResponse.json({
      data: {
        jobId: finalJob.id,
        summary: finalJob.summary,
      },
    });
  } catch (err) {
    console.error(`[Job ${jobId}] Failed:`, err);
    await db.update(ingestionJobs).set({
      status: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
      updatedAt: new Date(),
    }).where(eq(ingestionJobs.id, jobId));

    return NextResponse.json({ error: "Scrape failed", message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HANDLER B — Queue creation
// ═══════════════════════════════════════════════════════════════════════════════

async function handleQueueCreate(auth: { userId: string }, data: z.infer<typeof createQueueSchema>) {
  const { query, selectedResults, defaultAction } = data;
  const inserted = await db.insert(ingestionResearchQueue).values(
    selectedResults.map(item => {
      const nextAction = defaultAction ?? (isGoogleProfileUrl(item.link) ? "import_google_profile" : "scrape_website");
      return { createdByUserId: auth.userId, query, sourceTitle: item.title, sourceUrl: item.link, sourceType: isGoogleProfileUrl(item.link) ? "google_profile" : "google_result", queueStatus: "queued", nextAction, taskPayload: { title: item.title, link: item.link }, updatedAt: new Date() };
    }),
  ).returning();
  return NextResponse.json({ data: { queued: inserted.length, items: inserted } });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DB PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

async function saveJobAndCandidates(
  userId: string,
  sourceUrl: string,
  hints: { hospitalName?: string; city?: string; targetHospitalId?: string },
  extracted: Awaited<ReturnType<typeof extractStructuredFromSources>>,
  crawlMeta: { mode: string; pagesVisited: number; warnings: string[]; blockedStatus: number | null },
  existingJobId?: string,
) {
  const h = extracted.hospital;
  const isTargeted = Boolean(hints.targetHospitalId);

  // ── Pre-fetch existing doctors for matching (targeted mode only) ──────────
  let existingDoctors: Array<{ id: string; fullName: string; city: string | null }> = [];
  if (hints.targetHospitalId) {
    existingDoctors = await db
      .select({ id: doctors.id, fullName: doctors.fullName, city: doctors.city })
      .from(doctors)
      .where(eq(doctors.hospitalId, hints.targetHospitalId))
      .catch(() => []);
  }

  const jobValues = {
    requestedByUserId: userId,
    status: "done",
    sourceUrl,
    searchQuery: hints.hospitalName ?? null,
    targetCity: hints.city ?? null,
    runMode: isTargeted ? "targeted_update" : "website_only",
    summary: {
      targetHospitalId: hints.targetHospitalId ?? null,
      pagesVisited: crawlMeta.pagesVisited,
      fetchMode: crawlMeta.mode,
      warnings: crawlMeta.warnings,
      blockedStatus: crawlMeta.blockedStatus,
      doctorsFound: extracted.doctors.length,
      servicesFound: extracted.services.length,
      packagesFound: extracted.packages.length,
      procedureCostsFound: extracted.procedureCosts.length,
      confidence: extracted.confidence,
      notes: extracted.notes,
    },
    startedAt: new Date(),
    completedAt: new Date(),
    updatedAt: new Date(),
  };

  let jobId = existingJobId;
  let jobObj: any;

  if (jobId) {
    await db.update(ingestionJobs).set(jobValues).where(eq(ingestionJobs.id, jobId));
    const [row] = await db.select().from(ingestionJobs).where(eq(ingestionJobs.id, jobId)).limit(1);
    jobObj = row;
  } else {
    const [row] = await db.insert(ingestionJobs).values(jobValues).returning();
    jobObj = row;
    jobId = row.id;
  }

  // ── Source record ──────────────────────────────────────────────────────────
  await db.insert(ingestionSources).values({
    jobId: jobId!,
    sourceType: isGoogleProfileUrl(sourceUrl) ? "google_profile" : "website",
    sourceUrl,
    title: h.name ?? sourceUrl,
    snippet: h.description?.slice(0, 300) ?? null,
    rawContent: null,
    structuredPayload: null,
    confidence: extracted.confidence,
  }).catch(() => null);

  // ── Hospital candidate ─────────────────────────────────────────────────────
  const [hospitalCandidate] = await db.insert(ingestionHospitalCandidates).values({
    jobId: jobId!,
    name: h.name,
    normalizedName: h.name.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim(),
    city: h.city ?? hints.city ?? null,
    state: h.state ?? null,
    country: h.country ?? "India",
    addressLine1: h.addressLine1 ?? null,
    addressData: h.addressData ?? null,
    phone: h.phone ?? null,
    contactNumbers: h.contactNumbers ?? [],
    whatsapp: h.whatsapp ?? null,
    email: h.email ?? null,
    website: h.website ?? sourceUrl,
    socialLinks: h.socialLinks ?? null,
    operatingHours: h.operatingHours ?? null,
    departments: h.departments ?? [],
    majorServices: h.majorServices ?? [],
    keyFacilities: h.keyFacilities ?? [],
    uniqueOfferings: h.uniqueOfferings ?? [],
    specialties: h.specialties ?? [],
    services: h.services ?? [],
    description: h.description ?? null,
    rating: h.rating ?? null,
    reviewCount: h.reviewCount ?? null,
    latitude: h.latitude ?? null,
    longitude: h.longitude ?? null,
    sourceLinks: h.sourceLinks ?? [],
    outlierFlags: [] as string[],
    rawPayload: null,
    aiConfidence: extracted.confidence,
    // KEY: if targeted, immediately set matchHospitalId + mergeAction = "update"
    matchHospitalId: hints.targetHospitalId ?? null,
    mergeAction: isTargeted ? "update" : "review",
    applyStatus: "draft" as const,
    reviewStatus: "draft" as const,
    updatedAt: new Date(),
  }).returning().catch((e: Error) => {
    console.warn("[ingestion] hospitalCandidates insert:", e.message);
    return [];
  });

  const hospitalCandidateId = (hospitalCandidate as { id: string } | undefined)?.id ?? null;

  // ── Doctor candidates — with DB match resolution ───────────────────────────
  // ROOT CAUSE FIX: existing code set matchDoctorId = null always.
  // Now: in targeted mode, look up existing doctors at that hospital branch.
  if (extracted.doctors.length > 0) {
    const doctorRows = extracted.doctors.map(doc => {
      const matchResult = existingDoctors.length > 0
        ? chooseBestDoctorMatch({
          candidateName: doc.fullName,
          candidateCity: hints.city ?? null,
          options: existingDoctors,
        })
        : { action: "create" as const, matchDoctorId: null, confidence: 0.5, reason: "No existing doctors to match." };

      return {
        jobId: jobId!,
        hospitalCandidateId,
        fullName: doc.fullName,
        normalizedName: doc.fullName.toLowerCase().replace(/[^a-z0-9]/g, " ").trim(),
        specialization: doc.specialization ?? null,
        qualifications: doc.qualifications ?? [],
        languages: doc.languages ?? [],
        phone: doc.phone ?? null,
        email: doc.email ?? null,
        yearsOfExperience: doc.yearsOfExperience ?? null,
        feeMin: doc.feeMin ?? null,
        feeMax: doc.feeMax ?? null,
        consultationFee: doc.consultationFee ?? null,
        consultationDays: doc.consultationDays ?? [],
        opdTiming: doc.opdTiming ?? null,
        schedule: doc.schedule ?? null,
        outlierFlags: [] as string[],
        rawPayload: null,
        aiConfidence: extracted.confidence,
        // Now correctly set
        matchDoctorId: matchResult.matchDoctorId ?? null,
        mergeAction: matchResult.action === "update" ? "update" : "review",
        applyStatus: "draft" as const,
        reviewStatus: "draft" as const,
        updatedAt: new Date(),
      };
    });

    await db.insert(ingestionDoctorCandidates).values(doctorRows)
      .catch((e: Error) => console.warn("[ingestion] doctorCandidates insert:", e.message));
  }

  // ── Service candidates ─────────────────────────────────────────────────────
  if (extracted.services.length > 0) {
    await db.insert(ingestionServiceCandidates).values(
      extracted.services.map(svc => ({
        jobId: jobId!,
        hospitalCandidateId,
        serviceName: svc.name,
        category: svc.category ?? null,
        description: svc.description ?? null,
        sourceLinks: [] as string[],
        outlierFlags: [] as string[],
        rawPayload: null,
        aiConfidence: extracted.confidence,
        mergeAction: "review",
        applyStatus: "draft" as const,
        reviewStatus: "draft" as const,
        updatedAt: new Date(),
      })),
    ).catch((e: Error) => console.warn("[ingestion] serviceCandidates insert:", e.message));
  }

  // ── Package candidates ─────────────────────────────────────────────────────
  if (extracted.packages.length > 0) {
    await db.insert(ingestionPackageCandidates).values(
      extracted.packages.map(pkg => ({
        jobId: jobId!,
        hospitalCandidateId,
        packageName: pkg.packageName,
        procedureName: pkg.procedureName ?? null,
        department: pkg.department ?? null,
        priceMin: pkg.priceMin ?? null,
        priceMax: pkg.priceMax ?? null,
        currency: pkg.currency ?? "INR",
        inclusions: pkg.inclusions ?? null,
        exclusions: pkg.exclusions ?? null,
        lengthOfStay: pkg.lengthOfStay ?? null,
        outlierFlags: [] as string[],
        rawPayload: null,
        aiConfidence: extracted.confidence,
        mergeAction: "review",
        applyStatus: "draft" as const,
        reviewStatus: "draft" as const,
        updatedAt: new Date(),
      })),
    ).catch((e: Error) => console.warn("[ingestion] packageCandidates insert:", e.message));
  }

  // ── Procedure cost candidates → stored as packages with a cost_comparison flag ──
  // procedureCosts are stored alongside packages (same table) but with a
  // procedureName and no packageName bundle. The apply route will write them
  // to hospital_listing_packages with source = "cost_data".
  if (extracted.procedureCosts.length > 0) {
    await db.insert(ingestionPackageCandidates).values(
      extracted.procedureCosts
        .filter(pc => pc.priceMin !== null || pc.priceMax !== null) // only store if we have a price
        .map(pc => ({
          jobId: jobId!,
          hospitalCandidateId,
          packageName: pc.procedureName,   // stored as packageName for table compat
          procedureName: pc.procedureName,
          department: pc.department ?? null,
          priceMin: pc.priceMin ?? null,
          priceMax: pc.priceMax ?? null,
          currency: pc.currency ?? "INR",
          inclusions: null,
          exclusions: null,
          lengthOfStay: null,
          outlierFlags: [] as string[],
          rawPayload: { type: "procedure_cost", notes: pc.notes } as Record<string, unknown>,
          aiConfidence: extracted.confidence * 0.85, // slightly lower confidence for cost data
          mergeAction: "review",
          applyStatus: "draft" as const,
          reviewStatus: "draft" as const,
          updatedAt: new Date(),
        })),
    ).catch((e: Error) => console.warn("[ingestion] procedureCosts insert:", e.message));
  }

  // ── Field confidences ──────────────────────────────────────────────────────
  if (extracted.fieldConfidences.length > 0) {
    await db.insert(ingestionFieldConfidences).values(
      extracted.fieldConfidences.slice(0, 500).map(fc => ({
        jobId: jobId!,
        entityType: fc.entityType,
        entityId: fc.entityRef,
        fieldKey: fc.fieldKey,
        confidence: fc.confidence,
        sourceType: fc.sourceType ?? "ai_extracted",
        sourceUrl: fc.sourceUrl ?? sourceUrl,
        extractedValue: fc.extractedValue ?? null,
      })),
    ).catch((e: Error) => console.warn("[ingestion] fieldConfidences insert:", e.message));
  }

  return jobObj;
}
