/**
 * src/app/api/admin/ingestion/jobs/route.ts
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
} from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import {
  fetchWebsiteSource,
  extractStructuredFromSources,
  fetchGoogleProfileData,
  googleSearchSnippets,
  isGoogleProfileUrl,
  type WebsiteSourceResult,
} from "@/lib/ingestion";
import { ensureRole } from "@/lib/rbac";

// ─── Schemas ───────────────────────────────────────────────────────────────────

// Shape sent by "Scrape Now" button: { sourceUrl, hospitalName?, city?, searchQuery? }
const directScrapeSchema = z.object({
  sourceUrl: z.string().url("sourceUrl must be a valid URL"),
  hospitalName: z.string().max(220).optional(),
  city: z.string().max(100).optional(),
  searchQuery: z.string().max(220).optional(),
  targetHospitalId: z.string().optional(),
});

// Legacy discovery queue shape: { query, selectedResults[] }
const createQueueSchema = z.object({
  query: z.string().min(2).max(220),
  selectedResults: z
    .array(z.object({ title: z.string().min(1).max(220), link: z.string().url() }))
    .min(1)
    .max(30),
  defaultAction: z.enum(["scrape_website", "import_google_profile", "manual_verify"]).optional(),
});

// ─── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "viewer"]);
  if (forbidden) return forbidden;

  // Single job details — called by loadJobDetails(jobId) in the UI
  const jobId = req.nextUrl.searchParams.get("jobId")?.trim();
  if (jobId) {
    const [job] = await db
      .select()
      .from(ingestionJobs)
      .where(eq(ingestionJobs.id, jobId))
      .limit(1);

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const [sources, hospitalCandidates, doctorCandidates, serviceCandidates, packageCandidates, fieldConfidences] =
      await Promise.all([
        db.select().from(ingestionSources).where(eq(ingestionSources.jobId, jobId)),
        db.select().from(ingestionHospitalCandidates).where(eq(ingestionHospitalCandidates.jobId, jobId)),
        db.select().from(ingestionDoctorCandidates).where(eq(ingestionDoctorCandidates.jobId, jobId)),
        db.select().from(ingestionServiceCandidates).where(eq(ingestionServiceCandidates.jobId, jobId)),
        db.select().from(ingestionPackageCandidates).where(eq(ingestionPackageCandidates.jobId, jobId)),
        db.select().from(ingestionFieldConfidences).where(eq(ingestionFieldConfidences.jobId, jobId)),
      ]);

    return NextResponse.json({
      data: { job, sources, hospitalCandidates, doctorCandidates, serviceCandidates, packageCandidates, fieldConfidences },
    });
  }

  // List recent jobs — called by loadRecentJobs() in the UI
  const jobs = await db
    .select()
    .from(ingestionJobs)
    .orderBy(desc(ingestionJobs.createdAt))
    .limit(20);

  return NextResponse.json({ data: { jobs } });
}

// ─── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Route A: direct URL scrape — "Scrape Now" button
  const directParsed = directScrapeSchema.safeParse(body);
  if (directParsed.success) return handleDirectScrape(auth, directParsed.data);

  // Route B: legacy queue creation — discovery panel
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

async function handleDirectScrape(
  auth: { userId: string },
  data: z.infer<typeof directScrapeSchema>,
) {
  const { sourceUrl, hospitalName, city, searchQuery, targetHospitalId } = data;
  const hints = {
    hospitalName: hospitalName || searchQuery || undefined,
    city: city || undefined,
    targetHospitalId,
  };

  try {
    // ── Google Maps / Business Profile path ───────────────────────────────
    if (isGoogleProfileUrl(sourceUrl)) {
      const profile = await fetchGoogleProfileData({
        sourceUrl,
        hospitalName: hints.hospitalName,
        city: hints.city,
      });

      if (!profile) {
        return NextResponse.json(
          { error: "Google Profile fetch returned no data.", code: "GOOGLE_PROFILE_EMPTY", retryable: true },
          { status: 422 },
        );
      }

      const extracted = await extractStructuredFromSources({
        websiteUrl: profile.website ?? sourceUrl,
        websiteText: [profile.name, profile.formattedAddress, profile.openingHours.join(", ")]
          .filter(Boolean)
          .join("\n"),
        searchSnippets: [],
        hints,
        googleProfile: profile,
        crawledPages: [],
      });

      const job = await saveJobAndCandidates(auth.userId, sourceUrl, hints, extracted, {
        mode: "google_profile",
        pagesVisited: 0,
        warnings: [],
        blockedStatus: null,
      });

      return NextResponse.json({
        data: {
          jobId: job.id,
          summary: {
            doctorsFound: extracted.doctors.length,
            servicesFound: extracted.services.length,
            packagesFound: extracted.packages.length,
            confidence: extracted.confidence,
            warnings: [],
          },
        },
      });
    }

    // ── Website scrape path ────────────────────────────────────────────────
    let sourceResult: WebsiteSourceResult;
    try {
      sourceResult = await fetchWebsiteSource(sourceUrl);
    } catch (err) {
      const e = err as Record<string, unknown>;
      return NextResponse.json(
        {
          error: "Website fetch failed",
          message: err instanceof Error ? err.message : "Could not access the website.",
          code: typeof e.code === "string" ? e.code : "WEBSITE_FETCH_FAILED",
          hint: typeof e.hint === "string" ? e.hint : "Check the URL is correct and publicly reachable.",
          retryable: typeof e.retryable === "boolean" ? e.retryable : false,
        },
        { status: 422 },
      );
    }

    // Optional Google Profile enrichment
    let googleProfile = null;
    if (hints.hospitalName) {
      googleProfile = await fetchGoogleProfileData({
        sourceUrl,
        hospitalName: hints.hospitalName,
        city: hints.city,
      }).catch(() => null);
    }

    // 3-pass AI extraction
    const extracted = await extractStructuredFromSources({
      websiteUrl: sourceUrl,
      websiteText: sourceResult.text,
      searchSnippets: [],
      hints,
      googleProfile,
      crawledPages: sourceResult.crawledPages,
    });

    const job = await saveJobAndCandidates(auth.userId, sourceUrl, hints, extracted, {
      mode: sourceResult.mode,
      pagesVisited: sourceResult.crawledPages.length + 1,
      warnings: sourceResult.warnings,
      blockedStatus: sourceResult.blockedStatus,
    });

    return NextResponse.json({
      data: {
        jobId: job.id,
        summary: {
          pagesScraped: sourceResult.crawledPages.length + 1,
          doctorsFound: extracted.doctors.length,
          servicesFound: extracted.services.length,
          packagesFound: extracted.packages.length,
          confidence: extracted.confidence,
          notes: extracted.notes,
          warnings: sourceResult.warnings,
        },
      },
    });
  } catch (err) {
    console.error("[ingestion/jobs POST]", err);
    return NextResponse.json(
      { error: "Internal server error.", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HANDLER B — Legacy queue creation
// ═══════════════════════════════════════════════════════════════════════════════

async function handleQueueCreate(
  auth: { userId: string },
  data: z.infer<typeof createQueueSchema>,
) {
  const { query, selectedResults, defaultAction } = data;

  const inserted = await db
    .insert(ingestionResearchQueue)
    .values(
      selectedResults.map((item) => {
        const nextAction = defaultAction
          ? defaultAction
          : isGoogleProfileUrl(item.link)
            ? "import_google_profile"
            : "scrape_website";
        return {
          createdByUserId: auth.userId,
          query,
          sourceTitle: item.title,
          sourceUrl: item.link,
          sourceType: isGoogleProfileUrl(item.link) ? "google_profile" : "google_result",
          queueStatus: "queued",
          nextAction,
          taskPayload: { title: item.title, link: item.link },
          updatedAt: new Date(),
        };
      }),
    )
    .returning();

  return NextResponse.json({ data: { queued: inserted.length, items: inserted } });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DB PERSISTENCE — exact column names from schema.ts
// ═══════════════════════════════════════════════════════════════════════════════

async function saveJobAndCandidates(
  userId: string,
  sourceUrl: string,
  hints: { hospitalName?: string; city?: string; targetHospitalId?: string },
  extracted: Awaited<ReturnType<typeof extractStructuredFromSources>>,
  crawlMeta: { mode: string; pagesVisited: number; warnings: string[]; blockedStatus: number | null },
) {
  const h = extracted.hospital;

  // ── ingestion_jobs ────────────────────────────────────────────────────────
  const [job] = await db
    .insert(ingestionJobs)
    .values({
      requestedByUserId: userId,          // schema: requested_by_user_id
      status: "done",
      sourceUrl,
      searchQuery: hints.hospitalName ?? null,
      targetCity: hints.city ?? null,
      runMode: "website_only",
      summary: {
        pagesVisited: crawlMeta.pagesVisited,
        fetchMode: crawlMeta.mode,
        warnings: crawlMeta.warnings,
        blockedStatus: crawlMeta.blockedStatus,
        doctorsFound: extracted.doctors.length,
        servicesFound: extracted.services.length,
        packagesFound: extracted.packages.length,
        confidence: extracted.confidence,
        notes: extracted.notes,
      },
      startedAt: new Date(),
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // ── ingestion_sources ─────────────────────────────────────────────────────
  await db
    .insert(ingestionSources)
    .values({
      jobId: job.id,
      sourceType: isGoogleProfileUrl(sourceUrl) ? "google_profile" : "website",
      sourceUrl,
      title: h.name ?? sourceUrl,
      snippet: h.description?.slice(0, 300) ?? null,
      rawContent: null,
      structuredPayload: null,
      confidence: extracted.confidence,
    })
    .catch(() => null); // non-fatal

  // ── ingestion_hospital_candidates ─────────────────────────────────────────
  const [hospitalCandidate] = await db
    .insert(ingestionHospitalCandidates)
    .values({
      jobId: job.id,
      name: h.name,
      normalizedName: h.name.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim(),
      city: h.city ?? null,
      state: h.state ?? null,
      country: h.country ?? "India",
      addressLine1: h.addressLine1 ?? null,
      addressData: h.addressData ?? null,
      phone: h.phone ?? null,
      contactNumbers: h.contactNumbers ?? [],
      whatsapp: h.whatsapp ?? null,
      email: h.email ?? null,
      website: h.website ?? null,
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
      outlierFlags: [],
      rawPayload: null,
      aiConfidence: extracted.confidence,
      matchHospitalId: hints.targetHospitalId || null,
      mergeAction: hints.targetHospitalId ? "update" : "review",
      applyStatus: "draft",
      reviewStatus: "draft",
      updatedAt: new Date(),
    })
    .returning()
    .catch((e: Error) => {
      console.warn("[ingestion] hospitalCandidates insert failed:", e.message);
      return [];
    });

  const hospitalCandidateId = hospitalCandidate?.id ?? null;

  // ── ingestion_doctor_candidates ───────────────────────────────────────────
  if (extracted.doctors.length > 0) {
    await db
      .insert(ingestionDoctorCandidates)
      .values(
        extracted.doctors.map((doc) => ({
          jobId: job.id,
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
          outlierFlags: [],
          rawPayload: null,
          aiConfidence: extracted.confidence,
          matchDoctorId: null,
          mergeAction: "review",
          applyStatus: "draft",
          reviewStatus: "draft",
          updatedAt: new Date(),
        })),
      )
      .catch((e: Error) => console.warn("[ingestion] doctorCandidates insert failed:", e.message));
  }

  // ── ingestion_service_candidates ──────────────────────────────────────────
  if (extracted.services.length > 0) {
    await db
      .insert(ingestionServiceCandidates)
      .values(
        extracted.services.map((svc) => ({
          jobId: job.id,
          hospitalCandidateId,
          serviceName: svc.name,
          category: svc.category ?? null,
          description: svc.description ?? null,
          sourceLinks: [],
          outlierFlags: [],
          rawPayload: null,
          aiConfidence: extracted.confidence,
          mergeAction: "review",
          applyStatus: "draft",
          reviewStatus: "draft",
          updatedAt: new Date(),
        })),
      )
      .catch((e: Error) => console.warn("[ingestion] serviceCandidates insert failed:", e.message));
  }

  // ── ingestion_package_candidates ──────────────────────────────────────────
  if (extracted.packages.length > 0) {
    await db
      .insert(ingestionPackageCandidates)
      .values(
        extracted.packages.map((pkg) => ({
          jobId: job.id,
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
          outlierFlags: [],
          rawPayload: null,
          aiConfidence: extracted.confidence,
          mergeAction: "review",
          applyStatus: "draft",
          reviewStatus: "draft",
          updatedAt: new Date(),
        })),
      )
      .catch((e: Error) => console.warn("[ingestion] packageCandidates insert failed:", e.message));
  }

  // ── ingestion_field_confidences ───────────────────────────────────────────
  if (extracted.fieldConfidences.length > 0) {
    await db
      .insert(ingestionFieldConfidences)
      .values(
        extracted.fieldConfidences.slice(0, 500).map((fc) => ({
          jobId: job.id,
          entityType: fc.entityType,
          entityId: fc.entityRef,           // schema uses entityId not entityRef
          fieldKey: fc.fieldKey,
          confidence: fc.confidence,
          sourceType: fc.sourceType ?? "ai_extracted",
          sourceUrl: fc.sourceUrl ?? sourceUrl,
          extractedValue: fc.extractedValue ?? null,
        })),
      )
      .catch((e: Error) => console.warn("[ingestion] fieldConfidences insert failed:", e.message));
  }

  return job;
}