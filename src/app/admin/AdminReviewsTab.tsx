"use client";

/**
 * Admin Reviews Moderation Tab
 *
 * - Lists pending reviews (hospital + doctor)
 * - Shows rating, entity name, reviewer details
 * - Approve / Reject with optional moderation note
 * - After approve: shows new Bayesian effective rating + defaultInfluence %
 */
import { useEffect, useState } from "react";
import { calculateEffectiveRating, HOSPITAL_WEIGHT, DOCTOR_WEIGHT } from "@/lib/rating";

interface ReviewRow {
  id: string;
  entityType: string;
  entityId: string;
  entityName?: string | null;
  patientName: string | null;
  patientPhone: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  visitDate: string | null;
  status: string;
  createdAt: string | null;
}

interface ModerateResult {
  reviewId: string;
  newStatus: string;
  entityRating: {
    displayRating: number;
    reviewCount: number;
    label: string;
    defaultInfluencePct: number;
  } | null;
}

export function AdminReviewsTab() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [entityFilter, setEntityFilter] = useState<"all" | "hospital" | "doctor">("all");
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [moderating, setModerating] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ModerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadReviews() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter === "pending") {
        params.set("pending", "1");
      } else {
        params.set("status", filter);
      }
      if (entityFilter !== "all") {
        params.set("entityType", entityFilter);
      }
      const res = await fetch(`/api/admin/reviews?${params}`);
      const json = await res.json() as { data?: ReviewRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      const rows = json.data ?? [];
      setReviews(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReviews();
  }, [filter, entityFilter]);

  async function moderate(id: string, status: "approved" | "rejected") {
    setModerating(id);
    setLastResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, moderationNote: noteMap[id] ?? "" }),
      });
      const json = await res.json() as { ok?: boolean; error?: string; reviewId?: string; newStatus?: string; entityRating?: ModerateResult["entityRating"] };
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setLastResult({ reviewId: id, newStatus: status, entityRating: json.entityRating ?? null });
      // Remove from list
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setModerating(null);
    }
  }

  const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Patient Reviews</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Moderate reviews and monitor Bayesian rating updates
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
                filter === s ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(["all", "hospital", "doctor"] as const).map((et) => (
            <button
              key={et}
              onClick={() => setEntityFilter(et)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
                entityFilter === et ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {et === "all" ? "All" : et === "hospital" ? "Hospitals" : "Doctors"}
            </button>
          ))}
        </div>
        <button
          onClick={() => void loadReviews()}
          className="ml-auto px-3 py-1.5 text-sm bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 font-medium"
        >
          Refresh
        </button>
      </div>

      {/* Last moderation result */}
      {lastResult && (
        <div className={`rounded-xl p-4 border text-sm ${
          lastResult.newStatus === "approved"
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-slate-50 border-slate-200 text-slate-600"
        }`}>
          {lastResult.newStatus === "approved" ? (
            <>
              <strong>Review approved.</strong>
              {lastResult.entityRating && (
                <span className="ml-2">
                  New rating: <strong>{lastResult.entityRating.displayRating.toFixed(1)}</strong>
                  {" "}({lastResult.entityRating.reviewCount} review{lastResult.entityRating.reviewCount !== 1 ? "s" : ""})
                  — default still influences <strong>{lastResult.entityRating.defaultInfluencePct}%</strong>
                </span>
              )}
            </>
          ) : (
            <strong>Review rejected.</strong>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          No {filter} reviews
          {entityFilter !== "all" ? ` for ${entityFilter}s` : ""}.
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const weight = review.entityType === "hospital" ? HOSPITAL_WEIGHT : DOCTOR_WEIGHT;
            // Preview what rating would look like if approved (rough estimate — no sum data here)
            const isModerating = moderating === review.id;

            return (
              <div key={review.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        review.entityType === "hospital"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-purple-50 text-purple-700"
                      }`}>
                        {review.entityType === "hospital" ? "🏥 Hospital" : "👨‍⚕️ Doctor"}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">{review.entityName ?? review.entityId.slice(0, 8) + '…'}</span>
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      By <strong className="text-slate-700">{review.patientName ?? "Anonymous"}</strong>
                      {review.patientPhone && <span className="ml-2 text-slate-400">{review.patientPhone}</span>}
                      {review.visitDate && (
                        <span className="ml-2 text-slate-400">
                          visited {new Date(review.visitDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl text-yellow-500">{stars(review.rating)}</div>
                    <div className="text-sm font-bold text-slate-700">{review.rating.toFixed(1)} / 5</div>
                    <div className="text-xs text-slate-400">W={weight} default weight</div>
                  </div>
                </div>

                {/* Content */}
                {review.title && (
                  <p className="font-semibold text-slate-800">{review.title}</p>
                )}
                {review.body && (
                  <p className="text-sm text-slate-600 leading-relaxed">{review.body}</p>
                )}

                {/* Submitted */}
                {review.createdAt && (
                  <p className="text-xs text-slate-400">
                    Submitted {new Date(review.createdAt).toLocaleString("en-IN")}
                  </p>
                )}

                {/* Moderation controls (pending only) */}
                {review.status === "pending" && (
                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <input
                      type="text"
                      placeholder="Moderation note (optional)"
                      value={noteMap[review.id] ?? ""}
                      onChange={(e) => setNoteMap((prev) => ({ ...prev, [review.id]: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => void moderate(review.id, "approved")}
                        disabled={isModerating}
                        className="flex-1 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {isModerating ? "…" : "Approve"}
                      </button>
                      <button
                        onClick={() => void moderate(review.id, "rejected")}
                        disabled={isModerating}
                        className="flex-1 py-2 bg-rose-100 text-rose-700 text-sm font-semibold rounded-lg hover:bg-rose-200 disabled:opacity-50"
                      >
                        {isModerating ? "…" : "Reject"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Already moderated badge */}
                {review.status !== "pending" && (
                  <div className={`text-xs font-semibold px-2 py-1 rounded-full w-fit ${
                    review.status === "approved"
                      ? "bg-green-50 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    {review.status === "approved" ? "Approved" : "Rejected"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Rating algorithm info */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm text-slate-600 space-y-1">
        <p className="font-semibold text-slate-800">Bayesian Rating Algorithm</p>
        <p>
          <code className="text-xs bg-white px-1 py-0.5 rounded border border-slate-200">
            effective = (W × 4.0 + Σratings) / (W + N)
          </code>
        </p>
        <p>Hospitals: W={HOSPITAL_WEIGHT} phantom reviews &nbsp;|&nbsp; Doctors: W={DOCTOR_WEIGHT} phantom reviews</p>
        <p className="text-slate-500">
          Default influence fades as real reviews accumulate.
          At N=0 the display rating is 4.0 (or blended with Google rating if available).
        </p>
      </div>
    </div>
  );
}
