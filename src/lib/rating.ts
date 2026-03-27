/**
 * Bayesian Rating Utility — pure calculation (safe to import in client components)
 *
 * Formula:
 *   effective_rating = (W × D + Σratings) / (W + N)
 *
 * Where:
 *   D = DEFAULT_RATING = 4.0   (prior belief: "probably good")
 *   W = phantom review weight  (HOSPITAL_WEIGHT=20, DOCTOR_WEIGHT=10)
 *   N = actual review count
 *   Σratings = sum of all approved ratings
 *
 * Phase 0 (N=0): blend D with Google rating if available
 * Phase 1 (N≥1): Bayesian blend, phantom weight fades as N grows
 *
 * defaultInfluencePct = W / (W + N) × 100 → shown in admin as "% default influence"
 */

export const DEFAULT_RATING = 4.0;
export const HOSPITAL_WEIGHT = 20;
export const DOCTOR_WEIGHT = 10;

export interface RatingResult {
  /** The rating to display publicly (1–5, 1 dp) */
  displayRating: number;
  /** Actual approved review count */
  reviewCount: number;
  /** Human label: "4.2 (12 reviews)" or "New" */
  label: string;
  /** How much the 4.0 default still influences the rating (0–100%) */
  defaultInfluencePct: number;
}

/**
 * Calculate the Bayesian effective rating.
 * Pure function — no DB access.
 *
 * @param reviewCount  Number of approved reviews
 * @param reviewSum    Sum of all approved ratings
 * @param googleRating Optional Google Maps rating (used only when reviewCount === 0)
 * @param weight       Phantom review weight (use HOSPITAL_WEIGHT or DOCTOR_WEIGHT)
 */
export function calculateEffectiveRating(
  reviewCount: number,
  reviewSum: number,
  googleRating: number | null | undefined,
  weight: number = HOSPITAL_WEIGHT,
): RatingResult {
  // Phase 0: no real reviews yet
  if (reviewCount === 0) {
    let displayRating: number;
    let label: string;

    if (googleRating != null && googleRating > 0) {
      // Blend 4.0 prior with Google rating (equal weight)
      displayRating = Math.round(((DEFAULT_RATING + googleRating) / 2) * 10) / 10;
      label = `${displayRating.toFixed(1)} (Google)`;
    } else {
      displayRating = DEFAULT_RATING;
      label = "New";
    }

    return {
      displayRating,
      reviewCount: 0,
      label,
      defaultInfluencePct: 100,
    };
  }

  // Phase 1+: Bayesian blend
  const effective = (weight * DEFAULT_RATING + reviewSum) / (weight + reviewCount);
  const displayRating = Math.round(effective * 10) / 10;
  const defaultInfluencePct = Math.round((weight / (weight + reviewCount)) * 100);

  const label =
    reviewCount === 1
      ? `${displayRating.toFixed(1)} (1 review)`
      : `${displayRating.toFixed(1)} (${reviewCount} reviews)`;

  return { displayRating, reviewCount, label, defaultInfluencePct };
}

/**
 * Derive displayRating from the raw DB values stored on a hospital/doctor record.
 * Use this on profile pages where you have rating + reviewCount from DB but not reviewSum.
 *
 * When reviewCount > 0, the stored `rating` is already the Bayesian effective rating.
 * When reviewCount === 0, fall back to 4.0 (or Google blend).
 */
export function displayRatingFromRecord(
  rating: number,
  reviewCount: number,
  googleRating?: number | null,
): RatingResult {
  if (reviewCount === 0) {
    return calculateEffectiveRating(0, 0, googleRating, HOSPITAL_WEIGHT);
  }
  // rating is already Bayesian-computed; re-wrap for consistent label/influencePct
  // We don't have reviewSum here so we can't re-derive influencePct exactly — use stored rating
  const label =
    reviewCount === 1
      ? `${rating.toFixed(1)} (1 review)`
      : `${rating.toFixed(1)} (${reviewCount} reviews)`;
  return {
    displayRating: rating,
    reviewCount,
    label,
    defaultInfluencePct: 0, // already blended; not meaningful without reviewSum
  };
}
