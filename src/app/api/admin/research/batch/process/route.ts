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

    const extractModel = getGeminiClient().getGenerativeModel({
      model: env.GEMINI_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.05,
        maxOutputTokens: 16384,
      },
      systemInstruction: DEEP_RESEARCH_SYSTEM,
    });

    const extractResult = await extractModel.generateContent(
      `Hospital/Provider: "${entityName}"${locationHint}

GROUNDED TEXT:
${groundedText}

SOURCES:
${sourceUrls.slice(0, 10).map((s, j) => `[${j + 1}] ${s.title}: ${s.url}`).join("\n")}

Extract the complete structured profile. The provider name is "${entityName}" — use the exact real name as found in sources.`
    );

    const raw = extractResult.response.text();
    const match = raw.match(/\{[\s\S]*\}/);
    let profile: Record<string, unknown> = {};
    if (match) {
      try {
        profile = JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        try {
          const hospitalMatch = match[0].match(/"hospital"\s*:\s*\{[^}]*\}/);
          if (hospitalMatch) profile = JSON.parse(`{${hospitalMatch[0]}}`) as Record<string, unknown>;
        } catch { /* empty */ }
      }
    }

    const h = (profile.hospital ?? {}) as Record<string, unknown>;
    const officialUrl = h.website ? String(h.website) : (sourceUrls[0]?.url ?? "https://unknown.example");

    const doctors = Array.isArray(profile.doctors) ? profile.doctors : [];
    const procedureCosts = Array.isArray(profile.procedureCosts) ? profile.procedureCosts : [];
    const packages = Array.isArray(profile.packages) ? profile.packages : [];
    const specialtyAudit = Array.isArray(profile.specialtyAudit) ? profile.specialtyAudit as any[] : [];

    // Pass 3: Pricing enrichment (only if deep research found < 5 prices)
    if (procedureCosts.length + packages.length < 5 && h.name && (h.city || cityHint)) {
      try {
        const pricing = await discoverHospitalPricing(String(h.name), String(h.city || cityHint));
        for (const pkg of pricing.packages) {
          packages.push({ ...pkg, priceType: "city-range", priceSource: "estimated" });
        }
        for (const cost of pricing.costs) {
          procedureCosts.push({ ...cost, priceType: "market-estimated", priceSource: "estimated" });
        }
        profile.packages = packages;
        profile.procedureCosts = procedureCosts;
      } catch (err) {
        console.error(`[DeepResearch] Pricing discovery failed for ${h.name}:`, err);
      }
    }

    const jobId = await saveDeepProfileToCandidates(
      userId,
      entityName,
      cityHint ?? undefined,
      officialUrl,
      groundedText.slice(0, 400),
      profile,
      batchId,
    );

    return {
      jobId,
      specialtyCount: specialtyAudit.filter((s: any) => s.status === "available").length,
      doctorCount: doctors.length,
      priceCount: procedureCosts.length + packages.length,
      confidence: toNum(profile.overallConfidence) ?? 0.6,
    };
  }

  // Process concurrently
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
        // ── Parallel research: max MAX_CONCURRENCY at a time ──────────────────
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
                  jobId: res.jobId,
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
        items[idx] = {
          ...items[idx],
          status: "done",
          jobId: (v as any).jobId ?? null,
          specialtyCount: v.specialtyCount,
          doctorCount: v.doctorCount,
          priceCount: v.priceCount,
          confidence: v.confidence,
          error: null,
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
