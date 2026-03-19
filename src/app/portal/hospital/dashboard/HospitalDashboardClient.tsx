"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  patientId: string;
  type: "in_person" | "online_consultation";
  status: string;
  scheduledAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  patientNotes: string | null;
  hospitalName: string | null;
  createdAt: string | null;
}

interface Props {
  userFullName: string;
  userRole: string;
  hospitalId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDT(dt: string | null) {
  if (!dt) return "TBC";
  return new Date(dt).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function isToday(dt: string | null) {
  if (!dt) return false;
  const d = new Date(dt);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    requested:   "bg-amber-100 text-amber-800 border-amber-200",
    confirmed:   "bg-green-100 text-green-800 border-green-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    completed:   "bg-slate-100 text-slate-600 border-slate-200",
    cancelled:   "bg-red-100 text-red-700 border-red-200",
    no_show:     "bg-orange-100 text-orange-700 border-orange-200",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${map[status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className ?? ""}`} />;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function HospitalDashboardClient({ userFullName, userRole, hospitalId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "today" | "all">("pending");
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: "100", status: "all" });
        if (hospitalId) params.set("hospitalId", hospitalId);
        // Fetch all statuses by omitting status param (defaults to active)
        const res = await fetch(`/api/v1/portal/appointments?limit=100`, { credentials: "include" });
        if (res.status === 401 || res.status === 403) { router.push("/portal/login"); return; }
        if (res.ok) {
          const j = (await res.json()) as { data: Appointment[] };
          setAppts(j.data ?? []);
        }
      } catch { /* non-fatal */ }
      finally { setLoading(false); }
    }
    void load();
  }, [router, hospitalId]);

  async function act(id: string, action: "accept" | "reject" | "complete", reason?: string) {
    setActioning(id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/portal/appointments/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      if (res.ok) {
        const statusMap = { accept: "confirmed", reject: "cancelled", complete: "completed" };
        setAppts((prev) => prev.map((a) => a.id === id ? { ...a, status: statusMap[action] } : a));
      } else {
        const j = await res.json().catch(() => ({})) as { error?: { message?: string } };
        setError(j?.error?.message ?? "Action failed. Please try again.");
      }
    } catch { setError("Network error. Please try again."); }
    finally { setActioning(null); }
  }

  async function handleSignOut() {
    await fetch("/api/portal/logout", { method: "POST", credentials: "include" }).catch(() => {});
    router.push("/portal/login");
  }

  // Derived
  const pending   = appts.filter((a) => a.status === "requested");
  const today     = appts.filter((a) => isToday(a.scheduledAt));
  const confirmed = appts.filter((a) => a.status === "confirmed");
  const completed = appts.filter((a) => a.status === "completed");

  const displayed = activeTab === "pending" ? pending
                  : activeTab === "today"   ? today
                  : appts;

  const stats = [
    { label: "Pending Approval", value: pending.length,   icon: "⏳", hi: pending.length > 0 },
    { label: "Today",            value: today.length,     icon: "📅", hi: false },
    { label: "Confirmed",        value: confirmed.length, icon: "✅", hi: false },
    { label: "Completed",        value: completed.length, icon: "🏁", hi: false },
  ];

  const tabs: { key: typeof activeTab; label: string; count: number }[] = [
    { key: "pending", label: "Pending Approval", count: pending.length },
    { key: "today",   label: "Today",            count: today.length },
    { key: "all",     label: "All Active",       count: appts.length },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-14 lg:w-56 bg-white border-r border-slate-200 flex flex-col shrink-0 sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-3 py-4 border-b border-slate-100 flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: "#1B8A4A" }}
          >E</span>
          <span className="hidden lg:block font-bold text-slate-800 text-sm">EasyHeals</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1">
          {[
            { href: "/portal/hospital/dashboard", icon: "🏠", label: "Dashboard",    active: true },
            { href: "/portal/hospital",           icon: "🏥", label: "Edit Profile", active: false },
            { href: "/portal/schedule",           icon: "📅", label: "Schedule",     active: false },
            { href: "/portal/queue",              icon: "🎫", label: "OPD Queue",    active: false },
            { href: "/portal/staff",              icon: "👥", label: "Staff",         active: false },
            { href: "/portal/subscription",       icon: "💳", label: "Subscription", active: false },
          ].map((n) => (
            <Link
              key={n.label}
              href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                n.active ? "text-white" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
              style={n.active ? { background: "#1B8A4A" } : {}}
            >
              <span className="text-base">{n.icon}</span>
              <span className="hidden lg:block">{n.label}</span>
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: "#1B8A4A" }}
            >
              {userFullName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden lg:block min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{userFullName}</p>
              <p className="text-xs text-slate-400 capitalize">{userRole.replace("_", " ")}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="hidden lg:block mt-2 text-xs text-slate-400 hover:text-slate-600 transition w-full text-left"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Hospital Dashboard</h1>
              <p className="text-sm text-slate-400">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <Link
              href="/portal/hospital"
              className="text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
            >
              Edit Hospital Profile →
            </Link>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) =>
              loading ? (
                <Skeleton key={s.label} className="h-24" />
              ) : (
                <div
                  key={s.label}
                  className={`bg-white rounded-xl border p-4 shadow-sm ${s.hi ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}
                >
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className={`text-3xl font-bold ${s.hi ? "text-amber-700" : "text-slate-800"}`}>{s.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                </div>
              )
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === t.key ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
                style={activeTab === t.key ? { background: "#1B8A4A" } : {}}
              >
                {t.label}
                {t.count > 0 && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      activeTab === t.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Appointment list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : displayed.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <p className="text-slate-400 text-sm">
                {activeTab === "pending" ? "No pending appointments — all caught up!" :
                 activeTab === "today"   ? "No appointments scheduled for today." :
                 "No active appointments."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayed.map((appt) => {
                const isPending   = appt.status === "requested";
                const isConfirmed = appt.status === "confirmed";
                const busy        = actioning === appt.id;

                return (
                  <div key={appt.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      {/* Left */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span>{appt.type === "online_consultation" ? "📹" : "🏥"}</span>
                          <StatusBadge status={appt.status} />
                          <span className="text-xs text-slate-400">
                            {appt.type === "online_consultation" ? "Video" : "In-person"}
                          </span>
                        </div>

                        <p className="text-sm font-semibold text-slate-700">
                          Patient #{appt.patientId.slice(0, 8)}
                        </p>

                        <p className="text-xs text-slate-500 mt-0.5">
                          {appt.scheduledAt
                            ? `Scheduled: ${formatDT(appt.scheduledAt)}`
                            : `Requested: ${formatDT(appt.createdAt)}`}
                        </p>

                        {appt.patientNotes && (
                          <p className="mt-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                            {appt.patientNotes}
                          </p>
                        )}
                      </div>

                      {/* Right: actions */}
                      <div className="flex flex-col gap-2 items-end shrink-0">
                        {isPending && (
                          <>
                            <button
                              onClick={() => act(appt.id, "accept")}
                              disabled={busy}
                              className="px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 flex items-center gap-1.5 transition"
                              style={{ background: "#1B8A4A" }}
                            >
                              {busy ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "✓"}
                              Accept
                            </button>
                            <button
                              onClick={() => act(appt.id, "reject", "Provider unavailable")}
                              disabled={busy}
                              className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50 transition"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {isConfirmed && (
                          <button
                            onClick={() => act(appt.id, "complete")}
                            disabled={busy}
                            className="px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition"
                            style={{ background: "#1e40af" }}
                          >
                            Mark Complete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {[
              { href: "/portal/hospital",      icon: "✏️", label: "Edit Hospital Profile",  desc: "Update info, hours, specialties" },
              { href: "/portal/schedule",      icon: "📅", label: "Manage Schedule",        desc: "Set working hours & slot settings" },
              { href: "/portal/staff",         icon: "👥", label: "Manage Staff",            desc: "Add receptionists & billing staff" },
            ].map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:border-green-300 hover:shadow-sm transition group"
              >
                <div className="text-xl mb-2">{l.icon}</div>
                <p className="text-sm font-semibold text-slate-700 group-hover:text-green-700">{l.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{l.desc}</p>
              </Link>
            ))}
          </div>

        </div>
      </main>
    </div>
  );
}
