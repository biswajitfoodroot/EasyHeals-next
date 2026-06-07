/**
 * POST /api/admin/contributions/ai-review
 * Validates pending contributions using Gemini 2.5 Flash with Google Search grounding.
 * The model searches public sources (Google Business Profile, Justdial, Practo, NMC, etc.)
 * for each entity before deciding approve / reject / manual_review, and suggests a
 * revisedValue when the submitted value needs normalisation.
 *
 * PUT /api/admin/contributions/ai-review
 * Bulk apply the AI-recommended actions. Accepts an optional overrideValue per action
 * (admin-edited string) that takes precedence over the stored contribution value.
 */

import { getGeminiClient } from "@/lib/ai/client";
import { and, desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { contributions, doctors, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { env } from "@/lib/env";
import { ensureRole } from "@/lib/rbac";

type ContributionRow = typeof contributions.$inferSelect;

// ── AI review for a single contribution ──────────────────────────────────────

type AIReviewResult = {
  id: string;
  recommendation: "approve" | "reject" | "manual_review";
  confidence: number;
  reason: string;
  revisedValue: string | null;
};

async function aiReviewContributions(batch: ContributionRow[]): Promise<AIReviewResult[]> {
  // Enrich batch with entity name + city so the model knows what to search for
  const hospitalIds = [...new Set(batch.filter((c) => c.targetType === "hospital").map((c) => c.targetId))];
  const doctorIds   = [...new Set(batch.filter((c) => c.targetType === "doctor").map((c) => c.targetId))];

  const [hospRows, docRows] = await Promise.all([
    hospitalIds.length
      ? db.select({ id: hospitals.id, name: hospitals.name, city: hospitals.city }).from(hospitals).where(inArray(hospitals.id, hospitalIds))
      : [],
    doctorIds.length
      ? db.select({ id: doctors.id, name: doctors.fullName, city: doctors.city }).from(doctors).where(inArray(doctors.id, doctorIds))
      : [],
  ]);

  const entityMap = new Map<string, { name: string; city: string }>([
    ...hospRows.map((h): [string, { name: string; city: string }] => [h.id, { name: h.name, city: h.city }]),
    ...docRows.map((d): [string, { name: string; city: string }]  => [d.id, { name: d.name, city: d.city ?? "India" }]),
  ]);

  // Google Search grounding: model searches the web mid-generation to verify values
  // against official websites, Google Business Profiles, Justdial, Practo, NMC, etc.
  const model = getGeminiClient().getGenerativeModel({
    model: env.GEMINI_MODEL ?? "gemini-2.5-flash",
    // @ts-expect-error — googleSearch tool is a valid Gemini built-in tool not yet typed in the SDK
    tools: [{ googleSearch: {} }],
  });

  const contributionSummaries = batch.map((c) => {
    const entity = entityMap.get(c.targetId);
    return {
      id: c.id,
      entityName: entity?.name ?? "Unknown",
      entityCity: entity?.city ?? "India",
      targetType: c.targetType,
      field: c.fieldChanged,
      submittedValue: c.newValue,
      outlierScore: c.outlierScore,
      outlierFlags: c.outlierFlags,
    };
  });

  const prompt = `You are a healthcare data quality AI reviewing community contributions for Indian hospitals and doctors on EasyHeals.

For each contribution, use Google Search to look up the entity by name and city and validate the submitted value against publicly available sources (official website, Google Business Profile, Justdial, Practo, NMC registry, hospital directories, etc.).

Instructions per contribution:
1. Search for the entity to find its ground truth contact details / services
2. Compare the submitted value against what public sources show
3. Set recommendation:
   - "approve" — value matches or is consistent with public sources, or is plausible and unverifiable
   - "reject" — value contradicts public sources, looks like spam, or is clearly wrong
   - "manual_review" — public sources give conflicting information or the entity couldn't be found
4. Set revisedValue to a corrected/normalised string if the submitted value needs fixing, null otherwise:
   - phone: normalise to "+91 XXXXX XXXXX" or "0XX-XXXXXXXX"
   - website: ensure https:// prefix; use the URL found online if submitted one is wrong
   - email: lowercase, trim; use domain that matches official website
   - address: clean capitalisation and spacing; use the address from Google Maps if different
   - specialties/facilities/qualifications/languages: fix spelling, capitalise, comma-separated
   - workinghours/consultationhours: "Mon–Sat 9 am – 6 pm" format

Contributions to validate:
${JSON.stringify(contributionSummaries, null, 2)}

Return ONLY a raw JSON array with exactly ${batch.length} objects in the same order. No markdown fences, no citation markers like [1], no surrounding text:
[{"id":"...","recommendation":"approve"|"reject"|"manual_review","confidence":0.0-1.0,"reason":"what you found online and your decision (max 150 chars)","revisedValue":"corrected string or null"}]`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    // Strip any citation markers ([1], [2] etc.) that grounding may embed in string values
    const cleaned = raw.replace(/\[\d+\]/g, "").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as AIReviewResult[];
    return parsed;
  } catch {
    return batch.map((c) => ({
      id: c.id,
      recommendation: "manual_review" as const,
      confidence: 0,
      reason: "AI review unavailable — please review manually",
      revisedValue: null,
    }));
  }
}

// ── GET: fetch pending contributions ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const limit = Math.min(50, Number(req.nextUrl.searchParams.get("limit") ?? 30));
  const statusFilter = req.nextUrl.searchParams.get("status") ?? "pending";

  const rows = await db
    .select()
    .from(contributions)
    .where(statusFilter !== "all" ? eq(contributions.status, statusFilter) : undefined)
    .orderBy(desc(contributions.createdAt))
    .limit(limit);

  // Enrich with entity names
  const hospitalIds = [...new Set(rows.filter((r) => r.targetType === "hospital").map((r) => r.targetId))];
  const doctorIds = [...new Set(rows.filter((r) => r.targetType === "doctor").map((r) => r.targetId))];

  const [hospitalNames, doctorNames] = await Promise.all([
    hospitalIds.length
      ? db.select({ id: hospitals.id, name: hospitals.name }).from(hospitals).where(inArray(hospitals.id, hospitalIds))
      : [],
    doctorIds.length
      ? db.select({ id: doctors.id, name: doctors.fullName }).from(doctors).where(inArray(doctors.id, doctorIds))
      : [],
  ]);

  const nameMap = new Map<string, string>([
    ...hospitalNames.map((h): [string, string] => [h.id, h.name]),
    ...doctorNames.map((d): [string, string] => [d.id, d.name]),
  ]);

  const enriched = rows.map((r) => ({
    ...r,
    entityName: nameMap.get(r.targetId) ?? r.targetId,
  }));

  return NextResponse.json({ data: enriched });
}

// ── POST: AI review batch ─────────────────────────────────────────────────────

const reviewSchema = z.object({
  ids: z.array(z.string()).min(1).max(50),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const body = await req.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(contributions)
    .where(and(inArray(contributions.id, parsed.data.ids)));

  if (!rows.length) {
    return NextResponse.json({ error: "No contributions found" }, { status: 404 });
  }

  const reviews = await aiReviewContributions(rows);

  return NextResponse.json({ data: reviews });
}

// ── Array fields that must be merged (appended) instead of overwritten ────────

const ARRAY_FIELDS_HOSPITAL = new Set(["specialties", "facilities"]);
const ARRAY_FIELDS_DOCTOR   = new Set(["specialties", "qualifications", "languages"]);

function dedupeStrings(arr: unknown[]): string[] {
  return [...new Set(arr.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((s) => s.trim()))];
}

type MergeResult = {
  merged: Record<string, unknown>;
  before: Record<string, unknown>;
};

async function mergeHospitalArrayFields(
  targetId: string,
  patch: Record<string, unknown>,
): Promise<MergeResult> {
  const arrKeys = Object.keys(patch).filter((k) => ARRAY_FIELDS_HOSPITAL.has(k) && Array.isArray(patch[k]));
  if (!arrKeys.length) return { merged: patch, before: {} };
  const [row] = await db
    .select({ specialties: hospitals.specialties, facilities: hospitals.facilities })
    .from(hospitals)
    .where(eq(hospitals.id, targetId))
    .limit(1);
  if (!row) return { merged: patch, before: {} };
  const merged = { ...patch };
  const before: Record<string, unknown> = {};
  for (const k of arrKeys) {
    const existing = (row[k as keyof typeof row] as string[] | null) ?? [];
    before[k] = existing;
    merged[k] = dedupeStrings([...existing, ...(patch[k] as unknown[])]);
  }
  return { merged, before };
}

async function mergeDoctorArrayFields(
  targetId: string,
  patch: Record<string, unknown>,
): Promise<MergeResult> {
  const arrKeys = Object.keys(patch).filter((k) => ARRAY_FIELDS_DOCTOR.has(k) && Array.isArray(patch[k]));
  if (!arrKeys.length) return { merged: patch, before: {} };
  const [row] = await db
    .select({ specialties: doctors.specialties, qualifications: doctors.qualifications, languages: doctors.languages })
    .from(doctors)
    .where(eq(doctors.id, targetId))
    .limit(1);
  if (!row) return { merged: patch, before: {} };
  const merged = { ...patch };
  const before: Record<string, unknown> = {};
  for (const k of arrKeys) {
    const existing = (row[k as keyof typeof row] as string[] | null) ?? [];
    before[k] = existing;
    merged[k] = dedupeStrings([...existing, ...(patch[k] as unknown[])]);
  }
  return { merged, before };
}

// ── Field resolvers for applying approved contributions ───────────────────────

// Build a DB patch from the stored contribution newValue (wrapped scalar or array).
function resolveHospitalPatch(field: string, rawValue: Record<string, unknown>): Record<string, unknown> | null {
  const f = field.toLowerCase();
  if (["phone", "email", "website"].includes(f)) {
    const v = typeof rawValue.value === "string" ? rawValue.value.trim() : null;
    return v ? { [f]: v } : null;
  }
  if (f === "address") {
    const v = typeof rawValue.value === "string" ? rawValue.value.trim() : null;
    return v ? { addressLine1: v } : null;
  }
  // Return incoming array as-is; merging with existing happens in the apply loop.
  if (f === "specialties") return Array.isArray(rawValue) ? { specialties: rawValue } : null;
  if (f === "facilities")  return Array.isArray(rawValue) ? { facilities: rawValue }  : null;
  if (f === "workinghours") {
    if (typeof rawValue.value === "string") return { workingHours: rawValue.value };
    if (typeof rawValue === "object" && !Array.isArray(rawValue)) return { workingHours: rawValue };
    return null;
  }
  return null;
}

function resolveDoctorPatch(field: string, rawValue: Record<string, unknown>): Record<string, unknown> | null {
  const f = field.toLowerCase();
  // Return incoming array as-is; merging with existing happens in the apply loop.
  if (f === "specialties")    return Array.isArray(rawValue) ? { specialties: rawValue }    : null;
  if (f === "qualifications") return Array.isArray(rawValue) ? { qualifications: rawValue } : null;
  if (f === "languages")      return Array.isArray(rawValue) ? { languages: rawValue }      : null;
  if (f === "consultationhours") {
    if (typeof rawValue.value === "string") return { consultationHours: rawValue.value };
    if (typeof rawValue === "object" && !Array.isArray(rawValue)) return { consultationHours: rawValue };
    return null;
  }
  return null;
}

// Build a DB patch from a plain-string override value typed by the admin.
// For array fields the override is treated as additional items to append.
function resolveHospitalPatchFromOverride(field: string, override: string): Record<string, unknown> | null {
  const f = field.toLowerCase();
  const v = override.trim();
  if (!v) return null;
  if (["phone", "email", "website"].includes(f)) return { [f]: v };
  if (f === "address") return { addressLine1: v };
  if (f === "specialties") return { specialties: v.split(",").map((s) => s.trim()).filter(Boolean) };
  if (f === "facilities")  return { facilities:  v.split(",").map((s) => s.trim()).filter(Boolean) };
  if (f === "workinghours") return { workingHours: v };
  return null;
}

function resolveDoctorPatchFromOverride(field: string, override: string): Record<string, unknown> | null {
  const f = field.toLowerCase();
  const v = override.trim();
  if (!v) return null;
  if (f === "specialties")    return { specialties:    v.split(",").map((s) => s.trim()).filter(Boolean) };
  if (f === "qualifications") return { qualifications: v.split(",").map((s) => s.trim()).filter(Boolean) };
  if (f === "languages")      return { languages:      v.split(",").map((s) => s.trim()).filter(Boolean) };
  if (f === "consultationhours") return { consultationHours: v };
  return null;
}

// ── PUT: bulk apply AI recommendations ───────────────────────────────────────

const bulkApplySchema = z.object({
  actions: z.array(
    z.object({
      id: z.string(),
      action: z.enum(["approve", "reject"]),
      overrideValue: z.string().optional(), // admin-edited value; takes precedence over stored newValue
    }),
  ).min(1),
});

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const body = await req.json();
  const parsed = bulkApplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  let approved = 0;
  let rejected = 0;
  let applied = 0;
  const appliedChanges: Array<{ fieldChanged: string; targetId: string; targetType: string }> = [];

  for (const { id, action, overrideValue } of parsed.data.actions) {
    // Fetch contribution details to get fieldChanged, newValue, targetType, targetId
    const contribution = await db
      .select()
      .from(contributions)
      .where(eq(contributions.id, id))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!contribution) {
      continue;
    }

    // Update contribution status
    await db
      .update(contributions)
      .set({
        status: action === "approve" ? "approved" : "rejected",
        reviewedAt: new Date(),
        reviewedBy: auth.userId,
      })
      .where(eq(contributions.id, id));

    if (action === "approve") {
      approved++;

      if (contribution.fieldChanged && contribution.targetType && contribution.targetId) {
        try {
          // overrideValue (admin-edited string) takes precedence over stored newValue
          const patch =
            overrideValue !== undefined
              ? contribution.targetType === "hospital"
                ? resolveHospitalPatchFromOverride(contribution.fieldChanged, overrideValue)
                : resolveDoctorPatchFromOverride(contribution.fieldChanged, overrideValue)
              : contribution.targetType === "hospital"
                ? resolveHospitalPatch(contribution.fieldChanged, contribution.newValue as Record<string, unknown>)
                : resolveDoctorPatch(contribution.fieldChanged, contribution.newValue as Record<string, unknown>);

          if (patch) {
            let effectiveOldValue: Record<string, unknown> = {};
            let effectiveNewValue: Record<string, unknown> = patch;

            if (contribution.targetType === "hospital") {
              const { merged, before } = await mergeHospitalArrayFields(contribution.targetId, patch);
              effectiveOldValue = before;
              effectiveNewValue = merged;
              await db
                .update(hospitals)
                .set({ ...merged, updatedAt: new Date() })
                .where(eq(hospitals.id, contribution.targetId));
            } else {
              const { merged, before } = await mergeDoctorArrayFields(contribution.targetId, patch);
              effectiveOldValue = before;
              effectiveNewValue = merged;
              await db
                .update(doctors)
                .set({ ...merged, updatedAt: new Date() })
                .where(eq(doctors.id, contribution.targetId));
            }

            // Stamp the contribution with the values that were actually applied so the
            // Edits history panel shows the true before/after state.
            await db
              .update(contributions)
              .set({
                oldValue: effectiveOldValue as Record<string, unknown>,
                newValue: effectiveNewValue as Record<string, unknown>,
              })
              .where(eq(contributions.id, id));
            applied++;
            appliedChanges.push({
              fieldChanged: contribution.fieldChanged,
              targetId: contribution.targetId,
              targetType: contribution.targetType,
            });
          }
        } catch (err) {
          console.error(
            `Failed to apply contribution ${id} to ${contribution.targetType} ${contribution.targetId}:`,
            err,
          );
        }
      }
    } else {
      rejected++;
    }
  }

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "admin.contributions.bulk_apply",
    entityType: "contribution",
    changes: { approved, rejected, applied, total: parsed.data.actions.length, appliedChanges },
  });

  return NextResponse.json({ data: { approved, rejected, applied } });
}
