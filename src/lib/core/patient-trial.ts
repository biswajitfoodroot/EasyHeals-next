/**
 * Patient Trial & Subscription Gate
 *
 * Free trial: 21 days from first premium feature use (trialStartedAt).
 * After trial expires → require Health+ (₹299/mo) or Health Pro (₹599/mo).
 *
 * Tiers:
 *   free        — basic browsing + appointments only
 *   health_plus — document upload, AI extraction, 50 coach messages/mo, 2 device syncs
 *   health_pro  — everything unlimited + family profiles + PDF export
 *
 * DPDP Note: PHI remains AES-256-GCM encrypted regardless of tier.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { patients } from "@/db/schema";
import { AppError } from "@/lib/errors/app-error";

export const TRIAL_DAYS = 21;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type SubscriptionTier = "free" | "health_plus" | "health_pro";

export interface TierStatus {
  tier: SubscriptionTier;
  inTrial: boolean;
  trialDaysLeft: number;     // 0 if not in trial or expired
  trialStartedAt: Date | null;
  subscriptionExpiresAt: Date | null;
  canUsePremium: boolean;    // true if trial active OR paid sub active
}

/**
 * Returns the current tier/trial status for a patient.
 * Does NOT auto-start the trial — call startTrialIfNew() for that.
 */
export async function getTierStatus(patientId: string): Promise<TierStatus> {
  const [row] = await db
    .select({
      subscriptionTier: patients.subscriptionTier,
      trialStartedAt: patients.trialStartedAt,
      subscriptionExpiresAt: patients.subscriptionExpiresAt,
    })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!row) throw new AppError("AUTH_FORBIDDEN", "Patient not found", "Account not found.", 404);

  const tier = (row.subscriptionTier ?? "free") as SubscriptionTier;
  const now = Date.now();

  // Check paid subscription (health_plus or health_pro with valid expiry)
  const subExpiry = row.subscriptionExpiresAt;
  const hasPaidSub = (tier === "health_plus" || tier === "health_pro") && subExpiry && subExpiry.getTime() > now;

  // Check trial
  const trialStart = row.trialStartedAt;
  let inTrial = false;
  let trialDaysLeft = 0;

  if (trialStart) {
    const elapsed = now - trialStart.getTime();
    const daysLeft = Math.max(0, TRIAL_DAYS - Math.floor(elapsed / MS_PER_DAY));
    inTrial = daysLeft > 0;
    trialDaysLeft = daysLeft;
  }

  return {
    tier,
    inTrial,
    trialDaysLeft,
    trialStartedAt: trialStart ?? null,
    subscriptionExpiresAt: subExpiry ?? null,
    canUsePremium: hasPaidSub || inTrial,
  };
}

/**
 * Starts the 21-day trial on first premium feature use.
 * Idempotent — only sets trialStartedAt if it's null.
 */
export async function startTrialIfNew(patientId: string): Promise<void> {
  const [row] = await db
    .select({ trialStartedAt: patients.trialStartedAt })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!row?.trialStartedAt) {
    await db
      .update(patients)
      .set({ trialStartedAt: new Date() })
      .where(eq(patients.id, patientId));
  }
}

/**
 * Asserts patient can use a premium feature.
 * Auto-starts trial on first use. Throws 402 if trial expired and no subscription.
 */
export async function requirePremiumAccess(patientId: string): Promise<TierStatus> {
  await startTrialIfNew(patientId);
  const status = await getTierStatus(patientId);

  if (!status.canUsePremium) {
    throw new AppError(
      "SUBSCRIPTION_REQUIRED",
      "Trial expired",
      "Your 21-day free trial has ended. Upgrade to Health+ to continue.",
      402,
    );
  }

  return status;
}
