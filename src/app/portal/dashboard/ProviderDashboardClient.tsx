"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── Types ────────────────────────────────────────────────────────────────────

interface PortalAppointment {
  id: string;
  patientId: string;
  type: "in_person" | "online_consultation";
  status: string;
  scheduledAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  patientNotes: string | null;
  hospitalId: string | null;
  hospitalName: string | null;
  hospitalCity: string | null;
  slotStartsAt: string | null;
  slotEndsAt: string | null;
  sessionId?: string | null;
}

interface Props {
  userFullName: string;
  userRole: string;
  entityId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isToday(dt: string | null): boolean {
  if (!dt) return false;
  const d = new Date(dt);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-lg ${className ?? ""}`} />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    requested: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-green-100 text-green-800",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-slate-100 text-slate-600",
    cancelled: "bg-red-100 text-red-700",
  };
  const cls = map[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ── Nav link ──────────────────────────────────────────────────────────────────

function NavLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
        active
          ? "text-white"
          : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
      }`}
      style={active ? { background: "#1B8A4A" } : {}}
    >
      <span className="text-base">{icon}</span>
      <span className="hidden lg:block">{label}</span>
    </Link>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProviderDashboardClient({ userFullName, userRole, entityId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allAppointments, setAllAppointments] = useState<PortalAppointment[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/v1/portal/appointments?limit=50", {
          credentials: "include",
        });
        if (res.status === 401 || res.status === 403) {
          router.push("/portal/login");
          return;
        }
        if (res.ok) {
          const j = (await res.json()) as { data: PortalAppointment[] };
          setAllAppointments(j.data ?? []);
        }
      } catch {
        // non-fatal
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [router]);

  async function handleAccept(id: string) {
    setAcceptingId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/portal/appointments/${id}/accept`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) {
        setAllAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "confirmed" } : a))
        );
      } else {
        setActionError("Accept endpoint not yet available. Please use CRM.");
      }
    } catch {
      setActionError("Network error.");
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleStartConsult(appt: PortalAppointment) {
    if (appt.sessionId) {
      router.push(`/consultation/${appt.sessionId}`);
      return;
    }
    setStartingId(appt.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/consultations/${appt.id}/start`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const j = (await res.json()) as { data?: { sessionId?: string } };
        const sid = j.data?.sessionId;
        if (sid) {
          router.push(`/consultation/${sid}`);
        } else {
          setActionError("Session created but no sessionId returned.");
        }
      } else {
        setActionError("Could not start consultation session.");
      }
    } catch {
      setActionError("Network error starting consultation.");
    } finally {
      setStartingId(null);
    }
  }

  async function handleSignOut() {
    try {
      await fetch("/api/portal/logout", { method: "POST", credentials: "include" }).catch(() => {});
    } finally {
      router.push("/portal/login");
    }
  }

  // ── Derived stats ────────────────────────────────────────────────────────

  const todayAppts = allAppointments.filter((a) => isToday(a.scheduledAt));
  const pendingAppts = allAppointments.filter((a) => a.status === "requested");
  const todayOnline = todayAppts.filter((a) => a.type === "online_consultation");
  const todayCompleted = todayAppts.filter((a) => a.status === "completed");
  const todayPending = todayAppts.filter((a) => a.status === "requested");

  const stats = [
    { label: "Total Today", value: todayAppts.length, icon: "📅", color: "text-slate-800" },
    { label: "Online", value: todayOnline.length, icon: "📹", color: "text-blue-700" },
    {
      label: "Pending Approval",
      value: pendingAppts.length,
      icon: "⏳",
      color: pendingAppts.length > 0 ? "text-red-600" : "text-slate-800",
      highlight: pendingAppts.length > 0,
    },
    { label: "Completed", value: todayCompleted.length, icon: "✅", color: "text-green-700" },
  ];

  const navItems = [
    { href: "/portal/dashboard", icon: "🏠", label: "Dashboard", active: true },
    { href: "/portal/dashboard", icon: "📅", label: "Appointments" },
    { href: "/portal/dashboard", icon: "🗓️", label: "Schedule" },
    { href: "/portal/dashboard", icon: "👥", label: "Queue" },
    { href: "/portal/documents/shared", icon: "📂", label: "Shared Records" },
    {
      href: userRole === "hospital_admin" ? "/portal/hospital" : "/portal/doctor",
      icon: "👤",
      label: "Profile",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-14 lg:w-56 bg-white border-r border-slate-200 flex flex-col shrink-0 sticky top-0 h-screen overflow-y-auto">
        {/* Logo */}
        <div className="px-3 py-4 border-b border-slate-100 flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: "#1B8A4A" }}
          >
            E
          </span>
          <span className="hidden lg:block font-bold text-slate-800 text-sm">EasyHeals</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((n) => (
            <NavLink key={n.label} href={n.href} icon={n.icon} label={n.label} active={n.active} />
          ))}
        </nav>

        {/* User info */}
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
          {/* Date header */}
          <div>
            <h1 className="text-xl font-bold text-slate-800">{todayLabel()}</h1>
            <p className="text-sm text-slate-400">Provider Dashboard</p>
          </div>

          {/* Action error */}
          {actionError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              {actionError}
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
                  className={`bg-white rounded-xl border p-4 shadow-sm ${
                    s.highlight ? "border-red-300 bg-red-50" : "border-slate-200"
                  }`}
                >
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                </div>
              )
            )}
          </div>

          {/* Today's schedule */}
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Today&apos;s Schedule
            </h2>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : todayAppts.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-slate-300 p-6 text-center">
                <p className="text-slate-400 text-sm">No appointments scheduled for today.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                {todayAppts
                  .sort((a, b) => {
                    const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
                    const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
                    return ta - tb;
                  })
                  .map((appt) => {
                    const isOnline = appt.type === "online_consultation";
                    const isPending = appt.status === "requested";
                    const isConfirmed = appt.status === "confirmed";

                    return (
                      <div
                        key={appt.id}
                        className="flex items-center gap-3 px-4 py-3 flex-wrap sm:flex-nowrap"
                      >
                        {/* Time */}
                        <div className="w-14 shrink-0 text-center">
                          <p className="text-sm font-bold text-slate-700">
                            {formatTime(appt.scheduledAt ?? appt.slotStartsAt)}
                          </p>
                          {appt.slotEndsAt && (
                            <p className="text-xs text-slate-400">{formatTime(appt.slotEndsAt)}</p>
                          )}
                        </div>

                        {/* Type icon */}
                        <span className="text-lg shrink-0">{isOnline ? "📹" : "🏥"}</span>

                        {/* Patient ref + hospital */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate">
                            Patient #{appt.patientId.slice(0, 8)}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {appt.hospitalName ?? "—"}
                            {appt.patientNotes ? ` · ${appt.patientNotes.slice(0, 40)}` : ""}
                          </p>
                        </div>

                        {/* Status */}
                        <StatusBadge status={appt.status} />

                        {/* Action button */}
                        <div className="shrink-0">
                          {isPending && (
                            <button
                              onClick={() => handleAccept(appt.id)}
                              disabled={acceptingId === appt.id}
                              className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition disabled:opacity-50"
                              style={{ background: "#1B8A4A" }}
                            >
                              {acceptingId === appt.id ? "..." : "Accept"}
                            </button>
                          )}
                          {isOnline && isConfirmed && (
                            <button
                              onClick={() => handleStartConsult(appt)}
                              disabled={startingId === appt.id}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
                            >
                              {startingId === appt.id ? "Starting..." : "Start Consult"}
                            </button>
                          )}
                          {!isPending && !(isOnline && isConfirmed) && (
                            <span className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-100 rounded-lg">
                              View
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Pending actions panel */}
          {pendingAppts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Pending Actions
              </h2>
              <div className="bg-white rounded-xl border border-red-200 shadow-sm p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">
                    Unreviewed appointment requests
                  </span>
                  <span className="text-sm font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                    {pendingAppts.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Review and accept or decline each request from Today&apos;s Schedule above.
                </p>
              </div>
            </div>
          )}

          {/* Non-today pending (overall) */}
          {!loading && allAppointments.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                All Active Appointments
              </h2>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  {(["requested", "confirmed", "in_progress"] as const).map((s) => {
                    const count = allAppointments.filter((a) => a.status === s).length;
                    return (
                      <div key={s}>
                        <p className="text-xl font-bold text-slate-800">{count}</p>
                        <p className="text-xs text-slate-400 mt-0.5 capitalize">
                          {s.replace("_", " ")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
