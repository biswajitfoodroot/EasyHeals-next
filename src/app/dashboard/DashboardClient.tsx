"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RewardsTeaser } from "@/components/gamification/RewardsTeaser";
import { useTranslations } from "@/i18n/LocaleContext";

// ── Types ────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  type: "in_person" | "online_consultation";
  status: string;
  scheduledAt: string | null;
  doctorName: string | null;
  doctorId: string | null;
  hospitalName: string | null;
  hospitalId: string | null;
  sessionId?: string | null;
}

interface EmrVisit {
  id: string;
  visitDate: string;
}

interface Prescription {
  id: string;
}

interface LabOrder {
  id: string;
}

// ── Greeting helper ──────────────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDateTime(dt: string | null) {
  if (!dt) return "Time TBC";
  const d = new Date(dt);
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-lg ${className ?? ""}`} />;
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    requested: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-green-100 text-green-800",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-slate-100 text-slate-700",
    cancelled: "bg-red-100 text-red-700",
    no_show: "bg-orange-100 text-orange-700",
  };
  const cls = map[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {status.replace("_", " ")}
    </span>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function DashboardClient() {
  const router = useRouter();
  const { t } = useTranslations();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [emrVisits, setEmrVisits] = useState<EmrVisit[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        // Appointments (required)
        const apptRes = await fetch("/api/v1/appointments?limit=5", { credentials: "include" });
        if (apptRes.ok) {
          const j = (await apptRes.json()) as { data: Appointment[] };
          setAppointments(j.data ?? []);
        }
      } catch {
        // non-fatal
      }

      // EMR calls — graceful degradation (503 if flag OFF)
      await Promise.allSettled([
        fetch("/api/v1/emr/visits?limit=3", { credentials: "include" }).then(async (r) => {
          if (r.ok) {
            const j = (await r.json()) as { data: EmrVisit[] };
            setEmrVisits(j.data ?? []);
          }
        }),
        fetch("/api/v1/emr/prescriptions?limit=5", { credentials: "include" }).then(async (r) => {
          if (r.ok) {
            const j = (await r.json()) as { data: Prescription[] };
            setPrescriptions(j.data ?? []);
          }
        }),
        fetch("/api/v1/emr/lab-orders?limit=5", { credentials: "include" }).then(async (r) => {
          if (r.ok) {
            const j = (await r.json()) as { data: LabOrder[] };
            setLabOrders(j.data ?? []);
          }
        }),
      ]);

      setLoading(false);
    }
    void fetchAll();
  }, []);

  async function handleSignOut() {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    } finally {
      router.push("/login");
    }
  }

  // Upcoming = not completed/cancelled
  const upcoming = appointments.filter((a) => !["completed", "cancelled", "no_show"].includes(a.status));
  const nextAppt = upcoming[0] ?? null;

  const stats = [
    { label: t("dashboard.appointments"), value: appointments.length, icon: "📅" },
    { label: t("dashboard.emrVisits"), value: emrVisits.length, icon: "🩺" },
    { label: t("dashboard.labOrders"), value: labOrders.length, icon: "🧪" },
    { label: t("dashboard.prescriptions"), value: prescriptions.length, icon: "💊" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: "#1B8A4A" }}
            >
              E
            </span>
            <span className="font-bold text-slate-800">EasyHeals</span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            {t("dashboard.signOut")}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {(() => {
              const hour = new Date().getHours();
              if (hour < 12) return t("dashboard.greetingMorning");
              if (hour < 17) return t("dashboard.greetingAfternoon");
              return t("dashboard.greetingEvening");
            })()}
          </h1>
          <p className="text-slate-500 text-sm mt-1">{t("dashboard.healthSummary")}</p>
        </div>

        {/* Upcoming appointment card */}
        {loading ? (
          <Skeleton className="h-36" />
        ) : nextAppt ? (
          <div
            className="bg-white rounded-2xl border-2 p-5 shadow-sm"
            style={{ borderColor: "#1B8A4A" }}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                    {t("dashboard.nextAppointment")}
                  </span>
                  <StatusBadge status={nextAppt.status} />
                </div>
                <p className="font-semibold text-slate-800 mt-1">
                  {nextAppt.doctorName ?? "Doctor TBC"}
                </p>
                <p className="text-sm text-slate-500">{nextAppt.hospitalName ?? "Hospital TBC"}</p>
                <p className="text-sm text-slate-600 mt-1">
                  {nextAppt.type === "online_consultation" ? "Video" : "In-person"} &bull;{" "}
                  {formatDateTime(nextAppt.scheduledAt)}
                </p>
              </div>
              <div className="flex flex-col gap-2 items-end">
                {nextAppt.type === "online_consultation" && nextAppt.status === "confirmed" && nextAppt.sessionId && (
                  <Link
                    href={`/consultation/${nextAppt.sessionId}`}
                    className="px-4 py-2 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                    style={{ background: "#1B8A4A" }}
                  >
                    Join Now
                  </Link>
                )}
                <Link
                  href={`/dashboard/appointments`}
                  className="text-sm font-medium underline"
                  style={{ color: "#1B8A4A" }}
                >
                  View Details
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center">
            <p className="text-slate-400 text-sm">{t("dashboard.noAppointments")}</p>
            <Link
              href="/hospitals"
              className="mt-3 inline-block text-sm font-semibold px-4 py-2 rounded-xl text-white shadow-sm"
              style={{ background: "#1B8A4A" }}
            >
              {t("dashboard.bookAppointment")}
            </Link>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) =>
            loading ? (
              <Skeleton key={s.label} className="h-20" />
            ) : (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-2xl font-bold text-slate-800">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            )
          )}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            {t("dashboard.quickActions")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/hospitals"
              className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-green-300 transition group"
            >
              <span className="text-2xl">📅</span>
              <div>
                <p className="font-semibold text-slate-700 group-hover:text-green-700 text-sm">
                  {t("dashboard.bookAppointment")}
                </p>
                <p className="text-xs text-slate-400">{t("dashboard.findHospitals")}</p>
              </div>
            </Link>
            <Link
              href="/dashboard/records"
              className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-green-300 transition group"
            >
              <span className="text-2xl">📋</span>
              <div>
                <p className="font-semibold text-slate-700 group-hover:text-green-700 text-sm">
                  {t("dashboard.myRecords")}
                </p>
                <p className="text-xs text-slate-400">{t("dashboard.visitsAndPrescriptions")}</p>
              </div>
            </Link>
            <Link
              href="/dashboard/appointments?tab=lab"
              className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-green-300 transition group"
            >
              <span className="text-2xl">🧪</span>
              <div>
                <p className="font-semibold text-slate-700 group-hover:text-green-700 text-sm">
                  {t("dashboard.labOrders")}
                </p>
                <p className="text-xs text-slate-400">{t("dashboard.viewTestResults")}</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Health tools */}
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            {t("dashboard.healthTools")}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Link
              href="/dashboard/care-nav"
              className="flex items-center gap-3 bg-white rounded-xl border-2 border-green-200 p-4 shadow-sm hover:border-green-400 transition group"
            >
              <span className="text-2xl">🧭</span>
              <div>
                <p className="font-semibold text-slate-700 group-hover:text-green-700 text-sm">
                  {t("dashboard.symptomCheck")}
                </p>
                <p className="text-xs text-slate-400">{t("dashboard.aiTriageGuidance")}</p>
              </div>
            </Link>
            <Link
              href="/dashboard/documents"
              className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-green-300 transition group"
            >
              <span className="text-2xl">📤</span>
              <div>
                <p className="font-semibold text-slate-700 group-hover:text-green-700 text-sm">
                  {t("dashboard.uploadReport")}
                </p>
                <p className="text-xs text-slate-400">{t("dashboard.aiExtractedInsights")}</p>
              </div>
            </Link>
            <Link
              href="/dashboard/health-timeline"
              className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-green-300 transition group"
            >
              <span className="text-2xl">📈</span>
              <div>
                <p className="font-semibold text-slate-700 group-hover:text-green-700 text-sm">
                  {t("dashboard.healthTimeline")}
                </p>
                <p className="text-xs text-slate-400">{t("dashboard.yourHealthHistory")}</p>
              </div>
            </Link>
            <Link
              href="/dashboard/health-coach"
              className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-green-300 transition group"
            >
              <span className="text-2xl">🤖</span>
              <div>
                <p className="font-semibold text-slate-700 group-hover:text-green-700 text-sm">
                  {t("dashboard.askCoach")}
                </p>
                <p className="text-xs text-slate-400">{t("dashboard.aiHealthAssistant")}</p>
              </div>
            </Link>
            <Link
              href="/dashboard/privacy"
              className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-green-300 transition group"
            >
              <span className="text-2xl">🔒</span>
              <div>
                <p className="font-semibold text-slate-700 group-hover:text-green-700 text-sm">
                  {t("dashboard.privacy")}
                </p>
                <p className="text-xs text-slate-400">{t("dashboard.manageDataConsent")}</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Rewards teaser */}
        <RewardsTeaser />

        {/* Sign out */}
        <div className="pb-8">
          <button
            onClick={handleSignOut}
            className="w-full py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
          >
            {t("dashboard.signOut")}
          </button>
        </div>
      </main>
    </div>
  );
}
