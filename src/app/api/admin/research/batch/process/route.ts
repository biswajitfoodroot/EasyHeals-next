/**
 * POST /api/admin/research/batch/process
 *
 * Processes the next N pending items in a research batch job.
 * Called repeatedly by the UI until all items are done.
 *
 * Body: { batchId: string, size?: number (default 3) }
 * Returns: { processed, remaining, items: ResearchBatchItem[], batchStatus }
 *
 * Each call picks `size` pending items, runs 2-pass Gemini research on each
 * concurrently, then updates the batch job record in DB.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { researchBatchJobs, type ResearchBatchItem } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { getGeminiClient } from "@/lib/ai/client";
import { DEEP_RESEARCH_SYSTEM, DISCOVERY_SYSTEM, saveDeepProfileToCandidates, toNum, classifyInput, validateDiscoveredEntities, MAX_DISCOVERY_ENTITIES, MAX_CONCURRENCY } from "@/lib/ai/deep-research";
import { discoverHospitalPricing } from "@/lib/ingestion";
import { env } from "@/lib/env";

const bodySchema = z.object({
  batchId: z.string().min(1),
  size: z.number().int().min(1).max(5).default(3),
});

/** Broadens a discovery query to a wider geography (district → state).
 *  "Top 5 hospitals in Paschim Medinipur, West Bengal" → "Top 5 hospitals in West Bengal"
 *  Returns null if query cannot be broadened.
 */
function broadenQuery(query: string): string | null {
  const m = query.match(/^(.*\bin\s+)([^,]+),\s*(.+)$/i);
  if (m) return `${m[1]}${m[3]}`;
  return null;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  if (!env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: "Gemini AI is not configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { batchId, size } = parsed.data;
  const userId = auth.userId;

  // Load batch job
  const [batch] = await db
    .select()
    .from(researchBatchJobs)
    .where(eq(researchBatchJobs.id, batchId))
    .limit(1);

  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const items: ResearchBatchItem[] = Array.isArray(batch.items) ? batch.items : [];

  // Pick next N pending items
  const pendingIndices: number[] = [];
  for (let i = 0; i < items.length && pendingIndices.length < size; i++) {
    if (items[i].status === "pending") pendingIndices.push(i);
  }

  if (pendingIndices.length === 0) {
    // Nothing left to process
    const allDone = items.every(it => it.status === "done" || it.status === "failed");
    return NextResponse.json({
      data: {
        processed: 0,
        remaining: 0,
        items: [],
        batchStatus: allDone ? batch.status : "done",
      },
    });
  }

  // Mark selected items as "processing"
  for (const idx of pendingIndices) {
    items[idx] = { ...items[idx], status: "processing" };
  }

  await db.update(researchBatchJobs)
    .set({ status: "running", items, updatedAt: new Date() })
    .where(eq(researchBatchJobs.id, batchId));

  /** Try parsing JSON from raw model output with multiple fallback strategies */
  function tryParseProfileJson(raw: string): Record<string, unknown> {
    // Try 1: direct parse (responseMimeType: json returns clean JSON)
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch { /* fall through */ }
    // Try 2: strip markdown fences then parse
    try {
      const stripped = raw.replace(/^```(?:json)?\r?\n?/, "").replace(/\r?\n?```$/, "").trim();
      return JSON.parse(stripped) as Record<string, unknown>;
    } catch { /* fall through */ }
    // Try 3: regex extract first top-level JSON object
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]) as Record<string, unknown>; } catch { /* fall through */ }
    }
    // Try 4: attempt to fix truncated JSON by adding closing braces
    if (raw.includes('"hospital"')) {
      let attempt = raw.trim();
      // Count unmatched braces
      let open = 0;
      for (const ch of attempt) { if (ch === '{') open++; else if (ch === '}') open--; }
      if (open > 0) {
        attempt += '}'.repeat(open);
        try { return JSON.parse(attempt) as Record<string, unknown>; } catch { /* fall through */ }
      }
    }
    return {};
  }

  /** Check if a profile has meaningful data worth saving */
  function hasMinimumData(profile: Record<string, unknown>): boolean {
    const h = (profile.hospital ?? {}) as Record<string, unknown>;
    const hasHospitalData = !!(h.name || h.phone || h.website || h.city || h.addressLine1);
    const hasDoctors = Array.isArray(profile.doctors) && profile.doctors.length > 0;
    const hasPackages = Array.isArray(profile.packages) && profile.packages.length > 0;
    const hasProcedureCosts = Array.isArray(profile.procedureCosts) && profile.procedureCosts.length > 0;
    const hasSpecialties = Array.isArray(profile.specialtyAudit) && profile.specialtyAudit.some((s: any) => s.status === "available");
    const hasServices = Array.isArray(profile.services) && profile.services.length > 0;
    // At minimum, we need hospital identifying data AND at least one data dimension
    return hasHospitalData && (hasDoctors || hasPackages || hasProcedureCosts || hasSpecialties || hasServices);
  }

  // Helper to run Pass 2 and Pass 3 for a specific named provider
  async function runDeepResearchPass(entityName: string, cityHint?: string) {
    const searchModel = getGeminiClient().getGenerativeModel({
      model: env.GEMINI_MODEL,
      // @ts-expect-error — googleSearch is valid at runtime
      tools: [{ googleSearch: {} }],
    });

    const locationHint = cityHint ? ` in ${cityHint}` : " in India";
    const searchResult = await searchModel.generateContent(
      `Research "${entityName}"${locationHint} comprehensively for EasyHeals India database.

MANDATORY RESEARCH STEPS — execute each one:

1. Official website: find and read the Departments page, Doctors/Specialists page, and Pricing/Packages page
2. Google Maps / Google Business Profile: full address with PIN code, all phone numbers, rating, review count, working hours
3. Practo.com: search practo.com for "${entityName}" — extract the COMPLETE list of affiliated doctors:
   - For each doctor: full name, specialization, qualifications (MBBS/MD/MS/DM/MCh/DNB), experience, consultation fee, OPD timing
   - Group doctors by specialty department
4. For each specialty available (Cardiology, Orthopaedics, Neurology, Oncology, Gastroenterology, ENT, Urology, Gynaecology, Neurosurgery, Pulmonology, Nephrology, Dermatology, Psychiatry, Neonatology, Bariatric, Transplant Surgery, Spine Surgery, etc.):
   - Search "[specialty] doctors at ${entityName}" to find specialists not listed on main pages
   - Note all doctor names, qualifications, and fees for that specialty
5. Treatment cost research — search explicitly for:
   - "[entityName] knee replacement cost", "angioplasty price", "IVF cost", "cataract surgery price", "appendectomy charges", "dialysis per session"
   - Credihealth / GoMedii / hospital pricing pages
6. Accreditations: NABH, NABL, JCI, ISO certifications
7. JustDial / Sulekha: additional doctor listings, alternate phone numbers
8. Patient reviews (Google + Practo): overall sentiment, doctor quality, infrastructure ratings

Compile ALL findings: every doctor by specialty, every price, complete address, all phone numbers, reviews summary.`
    );

    const candidate = searchResult.response.candidates?.[0];
    const groundedText = candidate?.content?.parts?.map((p: any) => p.text ?? "").join("\n") ?? "";
    const chunks: Array<{ web?: { uri?: string; title?: string } }> =
      (candidate as any)?.groundingMetadata?.groundingChunks ?? [];
    const sourceUrls = chunks.filter(c => c.web?.uri).map(c => ({ url: c.web!.uri!, title: c.web?.title ?? "" }));

    // Validate grounded text is substantial before proceeding
    if (groundedText.trim().length < 100) {
      console.warn(`[BatchProcess] Search returned minimal content for "${entityName}" (${groundedText.length} chars). Skipping extraction.`);
      // Still save a minimal record so the job exists, but mark as low confidence
      const jobId = await saveDeepProfileToCandidates(
        userId, entityName, cityHint ?? undefined,
        sourceUrls[0]?.url ?? "https://unknown.example",
        groundedText.slice(0, 400),
        { hospital: { name: entityName, city: cityHint }, doctors: [], packages: [], procedureCosts: [], specialtyAudit: [], overallConfidence: 0.15 },
        batchId,
      );
      return { jobId, specialtyCount: 0, doctorCount: 0, priceCount: 0, confidence: 0.15 };
    }

    // ── Pass 2: Structured extraction with INCREASED token limit ───────────
    const MAX_EXTRACT_ATTEMPTS = 2;
    let profile: Record<string, unknown> = {};
    let extractionSucceeded = false;

    for (let attempt = 1; attempt <= MAX_EXTRACT_ATTEMPTS; attempt++) {
      try {
        const extractModel = getGeminiClient().getGenerativeModel({
          model: env.GEMINI_MODEL,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: attempt === 1 ? 0.05 : 0.1,
            // Increased from 16384 to 32768 to prevent mid-JSON truncation
            // for complex hospitals with many doctors and specialties
            maxOutputTokens: 32768,
          },
          systemInstruction: DEEP_RESEARCH_SYSTEM,
        });

        // On retry, use a more focused prompt to get at least core data
        const extractPrompt = attempt === 1
          ? `Hospital/Provider: "${entityName}"${locationHint}\n\nGROUNDED TEXT:\n${groundedText}\n\nSOURCES:\n${sourceUrls.slice(0, 10).map((s, j) => `[${j + 1}] ${s.title}: ${s.url}`).join("\n")}\n\nExtract the complete structured profile. The provider name is "${entityName}" — use the exact real name as found in sources.`
          : `Hospital/Provider: "${entityName}"${locationHint}\n\nGROUNDED TEXT (extract ALL available data):\n${groundedText.slice(0, 40000)}\n\nFOCUS on extracting: hospital name, city, address, phone, specialties, doctor names with specializations, and any treatment prices. Return the COMPLETE JSON profile structure as specified.`;

        const extractResult = await extractModel.generateContent(extractPrompt);
        const raw = extractResult.response.text().trim();

        if (!raw || raw.length < 10) {
          console.warn(`[BatchProcess] Attempt ${attempt}: Empty extraction response for "${entityName}"`);
          continue;
        }

        const parsed = tryParseProfileJson(raw);

        // Validate parsed result has real content
        if (parsed.hospital || parsed.doctors || parsed.specialtyAudit) {
          profile = parsed;
          extractionSucceeded = true;
          if (attempt > 1) {
            console.log(`[BatchProcess] Retry ${attempt} succeeded for "${entityName}"`);
          }
          break;
        } else {
          console.warn(`[BatchProcess] Attempt ${attempt}: Parsed JSON for "${entityName}" has no hospital/doctors/specialties. Raw length: ${raw.length}`);
        }
      } catch (extractErr) {
        console.error(`[BatchProcess] Attempt ${attempt} extraction error for "${entityName}":`, extractErr);
        // On first failure, wait briefly before retry to avoid rate limit issues
        if (attempt < MAX_EXTRACT_ATTEMPTS) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }

    if (!extractionSucceeded) {
      console.warn(`[BatchProcess] All extraction attempts failed for "${entityName}". Saving with grounded text only.`);
    }

    const h = (profile.hospital ?? {}) as Record<string, unknown>;
    const officialUrl = h.website ? String(h.website) : (sourceUrls[0]?.url ?? "https://unknown.example");

    const doctors = Array.isArray(profile.doctors) ? profile.doctors : [];
    let procedureCosts = Array.isArray(profile.procedureCosts) ? profile.procedureCosts : [];
    let packages = Array.isArray(profile.packages) ? profile.packages : [];
    const specialtyAudit = Array.isArray(profile.specialtyAudit) ? profile.specialtyAudit as any[] : [];

    // Pass 3: Pricing enrichment (only if deep research found < 5 prices)
    if (procedureCosts.length + packages.length < 5 && (h.name || entityName) && (h.city || cityHint)) {
      try {
        const pricing = await discoverHospitalPricing(String(h.name || entityName), String(h.city || cityHint));
        for (const pkg of pricing.packages) {
          packages.push({ ...pkg, priceType: "city-range", priceSource: "estimated" });
        }
        for (const cost of pricing.costs) {
          procedureCosts.push({ ...cost, priceType: "market-estimated", priceSource: "estimated" });
        }
        profile.packages = packages;
        profile.procedureCosts = procedureCosts;
      } catch (err) {
        console.error(`[DeepResearch] Pricing discovery failed for ${h.name || entityName}:`, err);
      }
    }

    // Ensure hospital has at least the entity name and city hint
    if (!h.name) {
      (profile.hospital as Record<string, unknown> | undefined) ??= {};
      (profile.hospital as Record<string, unknown>).name = entityName;
    }
    if (!h.city && cityHint) {
      (profile.hospital as Record<string, unknown>).city = cityHint;
    }

    // Calculate real confidence based on extraction quality
    const rawConfidence = toNum(profile.overallConfidence) ?? 0.6;
    const dataQuality = hasMinimumData(profile);
    // Downgrade confidence if extraction didn't succeed or data is minimal
    const adjustedConfidence = !extractionSucceeded ? Math.min(rawConfidence, 0.3)
      : !dataQuality ? Math.min(rawConfidence, 0.4)
      : rawConfidence;
    profile.overallConfidence = adjustedConfidence;

    const jobId = await saveDeepProfileToCandidates(
      userId,
      entityName,
      cityHint ?? undefined,
      officialUrl,
      groundedText.slice(0, 2000),
      profile,
      batchId,
    );

    return {
      jobId: dataQuality ? jobId : null,
      jobIdAlways: jobId,
      specialtyCount: specialtyAudit.filter((s: any) => s.status === "available").length,
      doctorCount: doctors.length,
      priceCount: procedureCosts.length + packages.length,
      confidence: adjustedConfidence,
      extractionSucceeded,
    };
  }

  // Process sequentially within each batch to avoid Gemini rate limits
  // (each item makes 2-3 API calls; running 3 concurrently means 6-9 simultaneous calls)
  const settled = await Promise.allSettled(
    pendingIndices.map(async (idx) => {
      const item = items[idx];
      const intent = classifyInput(item.name);
      
      if (intent === "discovery_search") {
        // ── Pass 1: Discovery grounding ──────────────────────────────────────
        const discoverModel = getGeminiClient().getGenerativeModel({
          model: env.GEMINI_MODEL,
          // @ts-expect-error — googleSearch is valid at runtime
          tools: [{ googleSearch: {} }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
          systemInstruction: DISCOVERY_SYSTEM,
        });

        async function runDiscovery(query: string) {
          const result = await discoverModel.generateContent(
            `Find healthcare providers matching this query: "${query}"`
          );
          const raw = result.response.text();
          const match = raw.match(/\{[\s\S]*\}/);
          if (!match) return [];
          try { return JSON.parse(match[0]).entities || []; } catch { return []; }
        }

        let rawEntities = await runDiscovery(item.name);

        // ── Validation layer ─────────────────────────────────────────────────
        let validEntities = validateDiscoveredEntities(rawEntities);

        // ── Fallback if < 3 found: broaden geography and retry once ──────────
        if (validEntities.length < 3) {
          const broadened = broadenQuery(item.name);
          if (broadened) {
            console.log(`[BatchProcess] Fallback: only ${validEntities.length} found, retrying with: "${broadened}"`);
            const retryEntities = await runDiscovery(broadened);
            // Merge with original, re-validate (dedup handles overlap)
            const merged = [...rawEntities, ...retryEntities];
            validEntities = validateDiscoveredEntities(merged);
          }
          if (validEntities.length < 2) {
            console.log(`[BatchProcess] Limited results (${validEntities.length}) for: "${item.name}"`);
          }
        }

        // Cap at MAX_DISCOVERY_ENTITIES (already done by validateDiscoveredEntities)
        // ── Sequential research with brief delays between calls ────────────
        const discoveredEntities: Array<{ jobId: string; name: string; city: string | null; confidence: number }> = [];
        let totalSpecialtyCount = 0;
        let totalDoctorCount = 0;
        let totalPriceCount = 0;

        for (let i = 0; i < validEntities.length; i += MAX_CONCURRENCY) {
          const batch = validEntities.slice(i, i + MAX_CONCURRENCY);
          await Promise.allSettled(
            batch.map(async (ent) => {
              try {
                const res = await runDeepResearchPass(ent.name, ent.city || item.city || undefined);
                discoveredEntities.push({
                  jobId: res.jobId ?? res.jobIdAlways ?? "error",
                  name: ent.name,
                  city: ent.city || item.city || null,
                  confidence: res.confidence,
                });
                totalSpecialtyCount += res.specialtyCount;
                totalDoctorCount += res.doctorCount;
                totalPriceCount += res.priceCount;
              } catch (err) {
                console.error(`[BatchProcess] Deep research failed for "${ent.name}":`, err);
              }
            })
          );
          // Brief delay between batches to avoid rate-limiting
          if (i + MAX_CONCURRENCY < validEntities.length) {
            await new Promise(r => setTimeout(r, 500));
          }
        }

        // ── Aggregate results ─────────────────────────────────────────────────
        const avgConfidence = discoveredEntities.length > 0
          ? discoveredEntities.reduce((sum, e) => sum + e.confidence, 0) / discoveredEntities.length
          : 0.6;

        const limitNote = validEntities.length === 0
          ? "limited results found"
          : validEntities.length < 3
            ? `limited results found (${validEntities.length})`
            : undefined;

        return {
          idx,
          isDiscovery: true,
          discoveredCount: discoveredEntities.length,
          discoveredEntities,
          specialtyCount: totalSpecialtyCount,
          doctorCount: totalDoctorCount,
          priceCount: totalPriceCount,
          confidence: avgConfidence,
          error: limitNote ?? null,
        };
      } else {
        const res = await runDeepResearchPass(item.name, item.city || undefined);
        return {
          idx,
          isDiscovery: false,
          ...res
        };
      }
    })
  );

  // Merge results back into items array
  let doneDelta = 0;
  let failedDelta = 0;

  for (let k = 0; k < settled.length; k++) {
    const idx = pendingIndices[k];
    const result = settled[k];
    if (result.status === "fulfilled") {
      const v = result.value;
      if (v.isDiscovery) {
        items[idx] = {
          ...items[idx],
          status: "done",
          discoveredCount: v.discoveredCount,
          discoveredEntities: v.discoveredEntities,
          specialtyCount: v.specialtyCount,
          doctorCount: v.doctorCount,
          priceCount: v.priceCount,
          confidence: v.confidence,
          error: v.error ?? null,
        };
      } else {
        const hasData = (v.specialtyCount ?? 0) + (v.doctorCount ?? 0) + (v.priceCount ?? 0) > 0;
        items[idx] = {
          ...items[idx],
          status: "done",
          // Only expose jobId for items with meaningful data (prevents saving empty profiles)
          jobId: (v as any).jobId ?? (v as any).jobIdAlways ?? null,
          specialtyCount: v.specialtyCount,
          doctorCount: v.doctorCount,
          priceCount: v.priceCount,
          confidence: v.confidence,
          error: !hasData && !(v as any).extractionSucceeded
            ? "AI extraction returned no structured data — try researching individually or check entity name"
            : null,
        };
      }
      doneDelta++;
    } else {
      items[idx] = {
        ...items[idx],
        status: "failed",
        error: String((result as PromiseRejectedResult).reason ?? "Research failed"),
      };
      failedDelta++;
    }
  }

  const newDoneCount = (batch.doneCount ?? 0) + doneDelta;
  const newFailedCount = (batch.failedCount ?? 0) + failedDelta;
  const remaining = items.filter(it => it.status === "pending").length;
  const allFinished = remaining === 0 && items.every(it => it.status !== "processing");

  const newStatus =
    allFinished
      ? newFailedCount > 0
        ? "partial_failure"
        : "done"
      : "running";

  await db.update(researchBatchJobs)
    .set({
      status: newStatus,
      doneCount: newDoneCount,
      failedCount: newFailedCount,
      items,
      updatedAt: new Date(),
    })
    .where(eq(researchBatchJobs.id, batchId));

  const processedItems = pendingIndices.map(idx => items[idx]);

  return NextResponse.json({
    data: {
      processed: pendingIndices.length,
      remaining,
      items: processedItems,
      batchStatus: newStatus,
    },
  });
}
