"use client";

/**
 * LeaderboardWidget
 *
 * P2 Day 3 — City leaderboard display (HLD §6.2)
 *
 * Fetches top patients by points for a given city and renders a compact
 * ranked list. Used on city landing pages and the patient dashboard.
 *
 * Props:
 *   city         — city slug (e.g. "mumbai") — matches patients.city
 *   limit        — number of entries to show (default 10, max 50)
 *   showTitle    — whether to render the "Top Patients in {city}" heading
 *   highlightId  — patientId of the current viewer (highlights their row)
 *
 * Data: fetched client-side via GET /api/v1/leaderboard/:city
 * Cache: the API caches results for 1h in Redis
 *
 * Privacy: API returns only displayAlias — no phone or full name.
 */

import { useEffect, useState } from "react";

interface LeaderboardEntry {
  rank: number;
  displayAlias: string;
  totalPoints: number;
  level: number;
  city: string;
}

interface ApiResponse {
  data: LeaderboardEntry[];
  city: string;
  total: number;
  cachedAt: string;
  fromCache: boolean;
}

interface LeaderboardWidgetProps {
  city: string;
  limit?: number;
  showTitle?: boolean;
  /** patientId — highlights the viewer's own row if they appear in the list */
  highlightAlias?: string;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function LeaderboardWidget({
  city,
  limit = 10,
  showTitle = true,
  highlightAlias,
}: LeaderboardWidgetProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!city) return;
    setLoading(true);
    setError(null);

    fetch(`/api/v1/leaderboard/${encodeURIComponent(city)}?limit=${limit}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ApiResponse>;
      })
      .then((data) => setEntries(data.data))
      .catch((err) => setError(err.message ?? "Failed to load leaderboard"))
      .finally(() => setLoading(false));
  }, [city, limit]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        {Array.from({ length: Math.min(limit, 5) }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-6 rounded bg-gray-200" />
            <div className="h-4 flex-1 rounded bg-gray-200" />
            <div className="h-4 w-12 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
        Could not load leaderboard.
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-4 text-center text-sm text-gray-400">
        No rankings yet for {city}. Be the first!
      </div>
    );
  }

  const cityLabel = city.charAt(0).toUpperCase() + city.slice(1);

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      {showTitle && (
        <div className="border-b border-gray-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-800">
            Top Patients in {cityLabel}
          </h3>
        </div>
      )}

      <ul className="divide-y divide-gray-50">
        {entries.map((entry) => {
          const isHighlighted = highlightAlias && entry.displayAlias === highlightAlias;
          return (
            <li
              key={entry.rank}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isHighlighted ? "bg-green-50" : "hover:bg-gray-50"
              }`}
            >
              {/* Rank */}
              <span className="w-6 text-center text-base">
                {MEDAL[entry.rank] ?? (
                  <span className="text-xs text-gray-400">#{entry.rank}</span>
                )}
              </span>

              {/* Alias + level */}
              <div className="min-w-0 flex-1">
                <span
                  className={`truncate font-medium ${
                    isHighlighted ? "text-green-700" : "text-gray-800"
                  }`}
                >
                  {entry.displayAlias}
                </span>
                <span className="ml-2 rounded-full bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-600">
                  Lv {entry.level}
                </span>
              </div>

              {/* Points */}
              <span className="tabular-nums text-xs font-semibold text-gray-500">
                {entry.totalPoints.toLocaleString("en-IN")} pts
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
