import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { contributions, hospitals } from "@/db/schema";
import { env } from "@/lib/env";
import { getGeminiClient } from "@/lib/ai/client";
import { loadThresholds } from "@/lib/outlier-config";

export type OutlierRecommendation = "auto_approve" | "pending_review" | "auto_reject";

export type OutlierScore = {
  score: number;
  flags: string[];
  confidence: number;
  recommendation: OutlierRecommendation;
};

const CITY_PHONE_HINTS: Record<string, string[]> = {
  pune: ["020", "+9120"],
  mumbai: ["022", "+9122"],
  delhi: ["011", "+9111"],
  bengaluru: ["080", "+9180"],
  chennai: ["044", "+9144"],
  hyderabad: ["040", "+9140"],
  kolkata: ["033", "+9133"],
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function matchesCityPhoneHint(city: string | null | undefined, phone: string): boolean {
  if (!city) return true;
  const hints = CITY_PHONE_HINTS[city.toLowerCase()];
  if (!hints?.length) return true;
  return hints.some((hint) => phone.includes(hint));
}

async function isSemanticallySuspicious(
  fieldChanged: string,
  oldValue: unknown,
  newValue: unknown,
  targetType: "hospital" | "doctor",
): Promise<boolean> {
  if (!env.GOOGLE_AI_API_KEY) return false;

  try {
    const model = getGeminiClient().getGenerativeModel({ model: env.GEMINI_MODEL });

    const prompt = [
      "Classify if this provider listing edit looks suspicious or implausible.",
      "Return only JSON: {\"suspicious\": true|false }.",
      `targetType: ${targetType}`,
      `fieldChanged: ${fieldChanged}`,
      `oldValue: ${JSON.stringify(oldValue)}`,
      `newValue: ${JSON.stringify(newValue)}`,
    ].join("\n");

    const response = await model.generateContent(prompt);
    const text = response.response.text().replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(text) as { suspicious?: boolean };
    return Boolean(parsed.suspicious);
  } catch {
    return false;
  }
}

export async function scoreContribution(
  fieldChanged: string,
  oldValue: unknown,
  newValue: unknown,
  trustScore: number,
  existingEntity: {
    city: string;
    name: string;
    id: string;
  },
  contributorId?: string,
  targetType: "hospital" | "doctor" = "hospital",
): Promise<OutlierScore> {
  const cfg = loadThresholds();

  let score = 0;
  const flags: string[] = [];

  const field = fieldChanged.toLowerCase();

  // Rule 1: Phone STD mismatch (landline-like updates)
  if (field.includes("phone") && typeof newValue === "string") {
    const compact = newValue.replace(/\s+/g, "");
    if (/^[0+]/.test(compact) && !matchesCityPhoneHint(existingEntity.city, compact)) {
      score += 30;
      flags.push("phone_city_mismatch");
    }
  }

  // Rule 2: Fee outlier.
  if (field.includes("fee") || field.includes("price")) {
    const fee = toNumber(newValue);
    if (fee !== null && (fee > cfg.feeOutlierMax || fee < cfg.feeOutlierMin)) {
      score += 35;
      flags.push("fee_statistical_outlier");
    }
  }

  // Rule 3: Mass edit burst by same contributor in 1 hour.
  if (contributorId) {
    const oneHourAgo = new Date(Date.now() - 3_600_000);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contributions)
      .where(
        and(
          eq(contributions.contributorId, contributorId),
          gt(contributions.createdAt, oneHourAgo),
        ),
      );

    if (Number(count) >= cfg.massEditBurstLimit) {
      score += 40;
      flags.push("mass_edit_burst");
    }
  }

  // Rule 4: Duplicate listing-like rename for hospitals.
  if (targetType === "hospital" && field.includes("name") && typeof newValue === "string") {
    const similar = await db
      .select({ id: hospitals.id, name: hospitals.name })
      .from(hospitals)
      .where(eq(hospitals.city, existingEntity.city))
      .limit(40);

    const candidate = newValue.toLowerCase();
    const duplicate = similar.some(
      (row) =>
        row.id !== existingEntity.id &&
        (row.name.toLowerCase().includes(candidate) || candidate.includes(row.name.toLowerCase())),
    );

    if (duplicate) {
      score += 60;
      flags.push("possible_duplicate_listing");
    }
  }

  // Rule 5: Semantic plausibility check with Gemini.
  if (score < cfg.autoRejectMinScore) {
    const suspicious = await isSemanticallySuspicious(fieldChanged, oldValue, newValue, targetType);
    if (suspicious) {
      score += cfg.semanticSuspiciousWeight;
      flags.push("ai_semantic_suspicious");
    }
  }

  // Trust modifier.
  if (trustScore > cfg.autoApproveMinTrust) {
    score = Math.max(0, score - 20);
    if (score === 0) {
      flags.push("trusted_contributor_bonus");
    }
  }

  let recommendation: OutlierRecommendation = "pending_review";
  if (score < cfg.autoApproveMaxScore && trustScore > cfg.autoApproveMinTrust) recommendation = "auto_approve";
  if (score >= cfg.autoRejectMinScore) recommendation = "auto_reject";

  return {
    score,
    flags,
    recommendation,
    confidence: Number((1 - Math.min(score, 100) / 100).toFixed(2)),
  };
}

