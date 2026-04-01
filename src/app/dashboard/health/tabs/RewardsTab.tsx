"use client";

/**
 * RewardsTab — Gamification Rewards Page
 *
 * Shows: points balance, level progress, streak, city leaderboard, how-to-earn.
 * Daily check-in button awards +10 points.
 * Mobile-first card layout.
 */

import { useState, useEffect, useCallback } from "react";

interface RewardsData {
  totalPoints: number;
  lifetimePoints: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  rank: number | null;
  leaderboard: Array<{ alias: string; points: number; isYou: boolean }>;
  checkedInToday: boolean;
}

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500];

function levelProgress(points: number, level: number) {
  const current = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const next = LEVEL_THRESHOLDS[level] ?? current + 1000;
  const progress = Math.min(100, Math.round(((points - current) / (next - current)) * 100));
  return { progress, pointsToNext: Math.max(0, next - points), nextLevel: level + 1 };
}

interface ReferralStats {
  code: string | null;
  referralUrl: string | null;
  stats: { totalClicks: number; totalConversions: number; pointsAwarded: number } | null;
}

export function RewardsTab() {
  const [data, setData] = useState<RewardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInMsg, setCheckInMsg] = useState<string | null>(null);
  const [referral, setReferral] = useState<ReferralStats | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void fetch("/api/v1/gamification/summary", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { data?: RewardsData }) => { if (d.data) setData(d.data); })
      .catch(() => null)
      .finally(() => setLoading(false));

    // Load referral stats (non-blocking — flag may be OFF, returns 423 silently)
    void fetch("/api/v1/patients/referral", { credentials: "include" })
      .then((r) => r.ok ? r.json() as Promise<ReferralStats> : null)
      .then((d) => { if (d) setReferral(d); })
      .catch(() => null);
  }, []);

  const generateCode = useCallback(async () => {
    setGeneratingCode(true);
    try {
      const res = await fetch("/api/v1/patients/referral", { method: "POST", credentials: "include" });
      if (res.ok) {
        const d = await res.json() as ReferralStats;
        setReferral(d);
      }
    } catch { /* non-fatal */ } finally {
      setGeneratingCode(false);
    }
  }, []);

  const copyLink = useCallback(() => {
    if (!referral?.referralUrl) return;
    void navigator.clipboard.writeText(referral.referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [referral]);

  async function dailyCheckIn() {
    if (checkingIn || data?.checkedInToday) return;
    setCheckingIn(true);
    try {
      const res = await fetch("/api/v1/gamification/checkin", {
        method: "POST",
        credentials: "include",
      });
      const d = await res.json();
      if (res.ok) {
        setCheckInMsg(`+${d.data?.points ?? 10} points earned! Keep it up!`);
        setData((prev) => prev ? { ...prev, checkedInToday: true, totalPoints: prev.totalPoints + (d.data?.points ?? 10) } : prev);
      } else {
        setCheckInMsg(d.error ?? "Already checked in today");
      }
    } catch {
      setCheckInMsg("Try again later");
    } finally {
      setCheckingIn(false);
    }
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading rewards...</div>;
  }

  if (!data) {
    return (
      <div style={{ padding: "0 16px" }}>
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🏆</div>
          <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>Earn Health Points</div>
          <div style={{ fontSize: 14, color: "#64748b" }}>Complete profile, upload documents, and book appointments to earn points.</div>
        </div>
      </div>
    );
  }

  const { progress, pointsToNext } = levelProgress(data.totalPoints, data.level);

  return (
    <div style={{ padding: "0 16px" }}>
      {/* Level + points card */}
      <div style={{
        background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 14,
        color: "#fff",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 2 }}>LEVEL {data.level}</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{data.totalPoints.toLocaleString()} pts</div>
          </div>
          <div style={{ fontSize: 40 }}>🏆</div>
        </div>

        {/* Progress bar */}
        <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 8, height: 8, marginBottom: 6 }}>
          <div style={{
            width: `${progress}%`,
            height: "100%",
            background: "#fff",
            borderRadius: 8,
            transition: "width 0.5s ease",
          }} />
        </div>
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          {pointsToNext} pts to Level {data.level + 1}
        </div>
      </div>

      {/* Streak + Check-in */}
      <div style={{
        background: "#fff",
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        border: "1px solid #f1f5f9",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Current streak</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>
              🔥 {data.currentStreak} day{data.currentStreak !== 1 ? "s" : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Longest</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#64748b" }}>{data.longestStreak} days</div>
          </div>
        </div>

        {checkInMsg && (
          <div style={{ fontSize: 13, color: "#047857", background: "#f0fdf4", padding: "6px 10px", borderRadius: 8, marginBottom: 10 }}>
            {checkInMsg}
          </div>
        )}

        <button
          onClick={dailyCheckIn}
          disabled={data.checkedInToday || checkingIn}
          style={{
            width: "100%",
            padding: "12px",
            background: data.checkedInToday ? "#f1f5f9" : "#0f766e",
            color: data.checkedInToday ? "#94a3b8" : "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: data.checkedInToday ? "not-allowed" : "pointer",
          }}
        >
          {data.checkedInToday ? "✓ Checked in today" : checkingIn ? "Checking in..." : "Daily Check-in (+10 pts)"}
        </button>
      </div>

      {/* Leaderboard */}
      {data.leaderboard.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #f1f5f9", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 12 }}>🏙 City Leaderboard</div>
          {data.leaderboard.map((entry, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                borderTop: idx > 0 ? "1px solid #f8fafc" : "none",
                background: entry.isYou ? "#f0fdf4" : "transparent",
                borderRadius: 8,
                paddingLeft: entry.isYou ? 8 : 0,
                paddingRight: entry.isYou ? 8 : 0,
              }}
            >
              <span style={{ width: 24, fontSize: idx < 3 ? 18 : 13, textAlign: "center" }}>
                {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
              </span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: entry.isYou ? 700 : 400, color: entry.isYou ? "#0f766e" : "#374151" }}>
                {entry.alias} {entry.isYou && "(You)"}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>
                {entry.points.toLocaleString()} pts
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Referral card — only shown when referral_engine flag returns data */}
      {referral !== null && (
        <div style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
          borderRadius: 16,
          padding: "18px 20px",
          marginBottom: 16,
          color: "#fff",
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>👥 Refer a Friend — earn 200 pts</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 14 }}>
            Your friend gets 1 free week of Health+. You earn 200 points per conversion.
          </div>

          {referral.code ? (
            <>
              {referral.stats && (
                <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                  {[
                    { label: "Clicks", val: referral.stats.totalClicks },
                    { label: "Friends joined", val: referral.stats.totalConversions },
                    { label: "Points earned", val: referral.stats.pointsAwarded },
                  ].map((s) => (
                    <div key={s.label} style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{s.val}</div>
                      <div style={{ fontSize: 10, opacity: 0.75 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <div style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  fontFamily: "monospace",
                  letterSpacing: "0.05em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {referral.referralUrl}
                </div>
                <button
                  type="button"
                  onClick={copyLink}
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "1.5px solid rgba(255,255,255,0.5)",
                    borderRadius: 8,
                    padding: "8px 14px",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    flexShrink: 0,
                  }}
                >
                  {copied ? "✅ Copied!" : "📋 Copy"}
                </button>
              </div>

              {/* WhatsApp share */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Join EasyHeals and get 1 week free! ${referral.referralUrl ?? ""}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  marginTop: 10,
                  background: "#25D366",
                  borderRadius: 8,
                  padding: "9px 14px",
                  textDecoration: "none",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <span>📲</span> Share on WhatsApp
              </a>
            </>
          ) : (
            <button
              type="button"
              disabled={generatingCode}
              onClick={() => void generateCode()}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "1.5px solid rgba(255,255,255,0.5)",
                borderRadius: 10,
                padding: "10px 20px",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: generatingCode ? "wait" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {generatingCode ? "Generating…" : "Generate My Referral Link"}
            </button>
          )}
        </div>
      )}

      {/* How to earn */}
      <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #f1f5f9", marginBottom: 80 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 12 }}>How to earn points</div>
        {[
          { emoji: "✅", action: "Complete your profile", points: "+50" },
          { emoji: "📄", action: "Upload a document", points: "+30" },
          { emoji: "📅", action: "Book an appointment", points: "+20" },
          { emoji: "💬", action: "Use Health Coach", points: "+10" },
          { emoji: "🔥", action: "Daily check-in", points: "+10" },
          { emoji: "👥", action: "Refer a friend", points: "+200" },
        ].map((item) => (
          <div key={item.action} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 18, width: 24 }}>{item.emoji}</span>
            <span style={{ flex: 1, fontSize: 13, color: "#374151" }}>{item.action}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0f766e" }}>{item.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
