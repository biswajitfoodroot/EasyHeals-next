/**
 * Rating server utilities — DB access.
 * Server-only: do NOT import from client components.
 */
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { doctors, hospitals } from "@/db/schema";
import { calculateEffectiveRating, DOCTOR_WEIGHT, HOSPITAL_WEIGHT } from "./rating";
import type { RatingResult } from "./rating";

export type { RatingResult };

/**
 * Recalculate and persist the Bayesian rating after a review is approved.
 * Pass the full set of approved ratings for accuracy.
 */
export async function onNewReview(
  entityType: "hospital" | "doctor",
  entityId: string,
  approvedReviewCount: number,
  approvedReviewSum: number,
): Promise<RatingResult> {
  const weight = entityType === "hospital" ? HOSPITAL_WEIGHT : DOCTOR_WEIGHT;

  // Read current google rating for phase-0 blend
  let googleRating: number | null = null;
  if (entityType === "hospital") {
    const [h] = await db
      .select({ googleRating: hospitals.googleRating })
      .from(hospitals)
      .where(eq(hospitals.id, entityId))
      .limit(1);
    googleRating = h?.googleRating ?? null;
  } else {
    const [d] = await db
      .select({ googleRating: doctors.googleRating })
      .from(doctors)
      .where(eq(doctors.id, entityId))
      .limit(1);
    googleRating = d?.googleRating ?? null;
  }

  const result = calculateEffectiveRating(
    approvedReviewCount,
    approvedReviewSum,
    googleRating,
    weight,
  );

  // Persist to DB
  if (entityType === "hospital") {
    await db
      .update(hospitals)
      .set({
        rating: result.displayRating,
        reviewCount: approvedReviewCount,
        reviewSum: approvedReviewSum,
        updatedAt: new Date(),
      })
      .where(eq(hospitals.id, entityId));
  } else {
    await db
      .update(doctors)
      .set({
        rating: result.displayRating,
        reviewCount: approvedReviewCount,
        reviewSum: approvedReviewSum,
        updatedAt: new Date(),
      })
      .where(eq(doctors.id, entityId));
  }

  return result;
}
