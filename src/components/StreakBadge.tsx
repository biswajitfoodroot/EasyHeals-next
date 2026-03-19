"use client";

/**
 * StreakBadge
 *
 * P2 Day 3 — Daily check-in streak display (HLD §6.2)
 *
 * Renders a compact streak counter with a flame icon.
 * Used on the patient dashboard and profile header.
 *
 * Props (all from getActorStats() response):
 *   currentStreak  — consecutive days checked in
 *   longestStreak  — all-time best
 *   totalPoints    — total redeemable points
 *   level          — current level (100pts = 1 level)
 *   onCheckin      — optional callback to trigger DAILY_CHECKIN event
 *                    (called when user clicks the badge to check in today)
 *
 * Variants:
 *   "compact"  — small inline badge (for header/nav)
 *   "card"     — full card with all stats (for dashboard)
 */

import { useState } from "react";

interface StreakBadgeProps {
  currentStreak: number;
  longestStreak?: number;
  totalPoints?: number;
  level?: number;
  variant?: "compact" | "card";
  /** If provided, clicking the badge fires DAILY_CHECKIN and calls this on success */
  onCheckin?: () => void;
  /** patientId — used internally to build the proofId */
  patientId?: string;
}

function FlameIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.5}
      className={`h-5 w-5 ${active ? "text-orange-500" : "text-gray-300"}`}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z"
      />
    </svg>
  );
}

async function postCheckin(patientId: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  try {
    const res = await fetch("/api/v1/gamification/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "DAILY_CHECKIN",
        proofId: `${patientId}:${today}`,
        proofType: "self_reported",
      }),
    });
    const data = await res.json();
    return data.awarded === true;
  } catch {
    return false;
  }
}

export function StreakBadge({
  currentStreak,
  longestStreak,
  totalPoints = 0,
  level = 1,
  variant = "compact",
  onCheckin,
  patientId,
}: StreakBadgeProps) {
  const [checking, setChecking] = useState(false);
  const [checkedInToday, setCheckedInToday] = useState(false);

  const handleCheckin = async () => {
    if (!patientId || checking || checkedInToday) return;
    setChecking(true);
    const awarded = await postCheckin(patientId);
    setChecking(false);
    if (awarded) {
      setCheckedInToday(true);
      onCheckin?.();
    }
  };

  if (variant === "compact") {
    return (
      <button
        onClick={handleCheckin}
        disabled={checking || checkedInToday || !patientId}
        className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-100 disabled:cursor-default disabled:opacity-70"
        title={`${currentStreak} day streak${longestStreak ? ` · best: ${longestStreak}` : ""}`}
      >
        <FlameIcon active={currentStreak > 0} />
        {currentStreak}
        {checking && <span className="ml-1 animate-spin">⟳</span>}
        {checkedInToday && <span className="ml-1 text-green-600">✓</span>}
      </button>
    );
  }

  // Card variant
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Your Progress</h3>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
          Level {level}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        {/* Streak */}
        <div className="rounded-lg bg-orange-50 p-3">
          <div className="flex items-center justify-center gap-1">
            <FlameIcon active={currentStreak > 0} />
            <span className="text-xl font-bold text-orange-600">{currentStreak}</span>
          </div>
          <p className="mt-1 text-xs text-orange-500">Day streak</p>
        </div>

        {/* Points */}
        <div className="rounded-lg bg-green-50 p-3">
          <div className="text-xl font-bold text-green-600">
            {totalPoints.toLocaleString("en-IN")}
          </div>
          <p className="mt-1 text-xs text-green-500">Total points</p>
        </div>

        {/* Best streak */}
        <div className="rounded-lg bg-purple-50 p-3">
          <div className="text-xl font-bold text-purple-600">{longestStreak ?? 0}</div>
          <p className="mt-1 text-xs text-purple-500">Best streak</p>
        </div>
      </div>

      {/* Check-in button */}
      {patientId && (
        <button
          onClick={handleCheckin}
          disabled={checking || checkedInToday}
          className="mt-3 w-full rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-default disabled:bg-gray-200 disabled:text-gray-400"
        >
          {checkedInToday
            ? "✓ Checked in today"
            : checking
              ? "Checking in…"
              : "Check in (+10 pts)"}
        </button>
      )}
    </div>
  );
}
