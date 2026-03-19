"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Badge {
  badgeId: string;
  earnedAt: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  tier: string | null;
}

interface PointEvent {
  id: string;
  eventType: string;
  points: number;
  createdAt: string | null;
}

interface RewardsData {
  totalPoints: number;
  lifetimePoints: number;
  currentStreak: number;
  longestStreak: number;
  cityRank: number | null;
  badges: Badge[];
  recentEvents: PointEvent[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  PROFILE_COMPLETED: "Profile Completed",
  CONSENT_GRANTED: "Consent Granted",
  NEWS_READ_5: "Read 5 Health Articles",
  DAILY_CHECKIN: "Daily Check-in",
  PROFILE_PHOTO_ADDED: "Profile Photo Added",
  SHARE_PROFILE: "Shared Profile",
  APPOINTMENT_COMPLETED: "Appointment Completed",
  REVIEW_SUBMITTED: "Review Submitted",
  DOCUMENT_UPLOADED: "Health Document Uploaded",
};

const TIER_COLORS: Record<string, string> = {
  bronze: "bg-amber-100 text-amber-800 border-amber-200",
  silver: "bg-slate-100 text-slate-700 border-slate-200",
  gold: "bg-yellow-100 text-yellow-800 border-yellow-200",
  platinum: "bg-blue-100 text-blue-800 border-blue-200",
};

function formatDate(dt: string | null) {
  if (!dt) return "";
  return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const HOW_TO_EARN = [
  { label: "Complete your profile", points: 50, icon: "👤", done: false },
  { label: "Grant health data consent", points: 10, icon: "✅", done: false },
  { label: "Upload a health document", points: 20, icon: "📄", done: false },
  { label: "Daily check-in", points: 10, icon: "🔥", done: false },
  { label: "Read 5 health articles (weekly)", points: 30, icon: "📰", done: false },
  { label: "Book & complete an appointment", points: 100, icon: "🏥", done: false },
  { label: "Submit a review", points: 25, icon: "⭐", done: false },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function RewardsClient() {
  const router = useRouter();
  const [data, setData] = useState<RewardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinMsg, setCheckinMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/patients/rewards", { credentials: "include" });
        if (res.status === 401) { router.push("/login"); return; }
        if (res.ok) {
          const j = await res.json() as { data: RewardsData };
          setData(j.data);
        }
      } catch { /* non-fatal */ }
      finally { setLoading(false); }
    }
    void load();
  }, [router]);

  async function handleDailyCheckin() {
    setCheckinLoading(true);
    setCheckinMsg(null);
    try {
      // Need patientId for proofId — fetch from me endpoint or store in context
      const meRes = await fetch("/api/v1/patients/me", { credentials: "include" });
      if (!meRes.ok) { setCheckinMsg("Please log in to check in."); return; }
      const meJ = await meRes.json() as { data: { id: string } };
      const patientId = meJ.data.id;

      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/v1/gamification/event", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "DAILY_CHECKIN",
          proofId: `${patientId}:${today}`,
          proofType: "self_reported",
        }),
      });
      const j = await res.json() as { awarded?: boolean; reason?: string; points?: number; stats?: { totalPoints?: number } };
      if (j.awarded) {
        setCheckinMsg(`✓ +${j.points ?? 10} points! Streak going strong.`);
        setData((prev) => prev ? { ...prev, totalPoints: j.stats?.totalPoints ?? prev.totalPoints, currentStreak: prev.currentStreak + 1 } : prev);
      } else {
        setCheckinMsg(j.reason === "duplicate" ? "Already checked in today! Come back tomorrow." : "Check-in not counted today.");
      }
    } catch {
      setCheckinMsg("Check-in failed. Please try again.");
    } finally {
      setCheckinLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 text-sm">← Dashboard</Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-800">Rewards & Points</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-800">Your Rewards</h1>
          <p className="text-sm text-slate-400 mt-1">Earn points for every health action. Redeem for discounts and perks.</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="animate-pulse bg-slate-200 rounded-2xl h-24" />)}
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                <div className="text-3xl font-black text-slate-800">{data?.totalPoints ?? 0}</div>
                <div className="text-xs font-semibold text-slate-500 mt-1">Points Balance</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                <div className="text-3xl font-black text-orange-500">🔥 {data?.currentStreak ?? 0}</div>
                <div className="text-xs font-semibold text-slate-500 mt-1">Day Streak</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                <div className="text-3xl font-black text-slate-800">{data?.badges.length ?? 0}</div>
                <div className="text-xs font-semibold text-slate-500 mt-1">Badges Earned</div>
              </div>
            </div>

            {/* Daily check-in CTA */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-lg">Daily Check-in</p>
                  <p className="text-green-100 text-sm">+10 points every day. Don't break your streak!</p>
                  {checkinMsg && <p className="text-sm mt-1 font-semibold text-white">{checkinMsg}</p>}
                </div>
                <button
                  onClick={() => void handleDailyCheckin()}
                  disabled={checkinLoading}
                  className="shrink-0 px-5 py-2.5 bg-white text-green-700 font-bold text-sm rounded-xl shadow hover:bg-green-50 disabled:opacity-60 transition"
                >
                  {checkinLoading ? "..." : "Check In"}
                </button>
              </div>
            </div>

            {/* Badges */}
            {data && data.badges.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-800 mb-3">Your Badges</h2>
                <div className="flex flex-wrap gap-2">
                  {data.badges.map((b) => (
                    <div key={b.badgeId} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${TIER_COLORS[b.tier ?? "bronze"] ?? "bg-slate-100 text-slate-600"}`}>
                      <span>{b.icon ?? "🏅"}</span>
                      <span>{b.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* How to earn */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-bold text-slate-800 mb-3">How to Earn Points</h2>
              <div className="space-y-2">
                {HOW_TO_EARN.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{item.icon}</span>
                      <span className="text-sm text-slate-700">{item.label}</span>
                    </div>
                    <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">+{item.points} pts</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent activity */}
            {data && data.recentEvents.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-800 mb-3">Recent Activity</h2>
                <div className="space-y-2">
                  {data.recentEvents.map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-slate-700">{EVENT_TYPE_LABELS[e.eventType] ?? e.eventType}</span>
                        <span className="text-xs text-slate-400 ml-2">{formatDate(e.createdAt)}</span>
                      </div>
                      <span className="text-green-700 font-bold">+{e.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lifetime points + CTA */}
            <div className="bg-blue-50 rounded-2xl p-4">
              <p className="text-xs text-blue-700">
                <span className="font-semibold">Lifetime points earned: {data?.lifetimePoints ?? 0}</span>
                {" · "}
                Redeem rewards coming soon.{" "}
                <Link href="/dashboard/documents" className="underline font-semibold">Upload a health document</Link> to earn points now.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
