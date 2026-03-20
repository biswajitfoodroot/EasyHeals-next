"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type MainTab = "today" | "appointments" | "patients";

interface Appointment {
  id: string;
  patientId: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  patientNotes: string | null;
  hospitalName: string | null;
  hospitalCity: string | null;
  createdAt: string | null;
  consultationFee: number | null;
  paymentStatus: string | null;
  meetingUrl: string | null;
}

interface PatientRow {
  patientId: string;
  displayAlias: string;
  city: string | null;
  lastApptAt: string | null;
  lastApptStatus: string;
  lastDoctorName: string | null;
  lastHospitalName: string | null;
  appointmentCount: number;
  consultationTypes: string[];
}

interface AccessGrant {
  id: string;
  grantedToUserId: string;
  grantedToName: string | null;
  grantedToEmail: string | null;
  accessLevel: string;
  expiresAt: string | null;
}

interface Props {
  userFullName: string;
  userRole: string;
  doctorId?: string;
  doctorName?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDT(dt: string | null) {
  if (!dt) return "TBC";
  return new Date(dt).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function isToday(dt: string | null) {
  if (!dt) return false;
  return new Date(dt).toDateString() === new Date().toDateString();
}

function isFuture(dt: string | null) {
  if (!dt) return false;
  return new Date(dt) > new Date();
}

// ── Badges ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    requested:   "bg-amber-100 text-amber-800 border-amber-200",
    confirmed:   "bg-emerald-100 text-emerald-800 border-emerald-200",
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

function TypeBadge({ type }: { type: string }) {
  if (type === "audio_consultation") return <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">📞 Audio</span>;
  if (type === "video_consultation" || type === "online_consultation") return <span className="text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">🎥 Video</span>;
  return <span className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">🏥 In-Person</span>;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className ?? ""}`} />;
}

// ── Access Grant Modal ────────────────────────────────────────────────────────

function AccessGrantModal({
  patient,
  grants,
  onClose,
  onGrant,
  onRevoke,
}: {
  patient: PatientRow;
  grants: AccessGrant[];
  onClose: () => void;
  onGrant: (grantedToUserId: string, level: string, days?: number) => Promise<void>;
  onRevoke: (grantedToUserId: string) => Promise<void>;
}) {
  const [staffUserId, setStaffUserId] = useState("");
  const [level, setLevel] = useState<"full" | "metadata">("full");
  const [days, setDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function doGrant() {
    if (!staffUserId.trim()) { setMsg("Enter the staff user ID."); return; }
    setSaving(true);
    try {
      await onGrant(staffUserId.trim(), level, days ? parseInt(days) : undefined);
      setStaffUserId(""); setMsg(null);
    } catch { setMsg("Failed to grant access."); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Manage Access</h2>
            <p className="text-xs text-slate-500">{patient.displayAlias}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Existing grants */}
          {grants.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Active Access Grants</p>
              <div className="space-y-2">
                {grants.map((g) => (
                  <div key={g.id} className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{g.grantedToName ?? g.grantedToUserId}</p>
                      <p className="text-xs text-slate-500">{g.grantedToEmail} · {g.accessLevel} access{g.expiresAt ? ` · expires ${formatDate(g.expiresAt)}` : " · indefinite"}</p>
                    </div>
                    <button
                      onClick={() => void onRevoke(g.grantedToUserId)}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold transition"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grant new access */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Grant Access to Staff</p>
            {msg && <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{msg}</p>}

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Staff User ID</label>
              <input
                type="text" placeholder="User UUID from admin panel"
                value={staffUserId}
                onChange={(e) => setStaffUserId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-600 block mb-1">Access Level</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as "full" | "metadata")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="full">Full (records + documents)</option>
                  <option value="metadata">Metadata only (name, last visit)</option>
                </select>
              </div>
              <div className="w-32">
                <label className="text-xs font-semibold text-slate-600 block mb-1">Expires (days)</label>
                <input
                  type="number" min="1" max="365" placeholder="∞"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              onClick={() => void doGrant()}
              disabled={saving}
              className="w-full py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition"
              style={{ background: "#1B8A4A" }}
            >
              {saving ? "Granting…" : "Grant Access"}
            </button>

            <p className="text-xs text-slate-400 text-center">
              Staff with metadata access see: alias, last appointment date, department, doctor visited.
              <br />Staff with full access additionally see: documents, lab reports, prescriptions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function DoctorDashboardClient({ userFullName, userRole, doctorId, doctorName }: Props) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<MainTab>("today");
  const [error, setError] = useState<string | null>(null);

  // Appointment state
  const [apptLoading, setApptLoading] = useState(false);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [apptFilter, setApptFilter] = useState<"all" | "requested" | "confirmed" | "completed">("all");
  const [actioning, setActioning] = useState<string | null>(null);

  // Patient state
  const [patientLoading, setPatientLoading] = useState(false);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null);
  const [patientGrants, setPatientGrants] = useState<AccessGrant[]>([]);

  // ── Data loaders ─────────────────────────────────────────────────────────

  const loadAppointments = useCallback(async () => {
    setApptLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (doctorId) params.set("doctorId", doctorId);
      // Include all statuses
      const res = await fetch(`/api/v1/portal/appointments?${params}&status=requested,confirmed,in_progress,completed,cancelled`, { credentials: "include" });
      if (res.status === 401 || res.status === 403) { router.push("/portal/login"); return; }
      if (res.ok) {
        const j = await res.json() as { data: Appointment[] };
        setAppts(j.data ?? []);
      }
    } catch { /* non-fatal */ }
    finally { setApptLoading(false); }
  }, [router, doctorId]);

  const loadPatients = useCallback(async () => {
    if (!doctorId) return;
    setPatientLoading(true);
    try {
      const res = await fetch(`/api/v1/portal/patients?doctorId=${doctorId}&limit=100`, { credentials: "include" });
      if (res.ok) {
        const j = await res.json() as { data: PatientRow[] };
        setPatients(j.data ?? []);
      }
    } finally { setPatientLoading(false); }
  }, [doctorId]);

  useEffect(() => {
    if (activeTab === "today" || activeTab === "appointments") void loadAppointments();
    if (activeTab === "patients") void loadPatients();
  }, [activeTab, loadAppointments, loadPatients]);

  // ── Appointment actions ───────────────────────────────────────────────────

  async function act(id: string, action: "accept" | "reject" | "complete", reason?: string) {
    setActioning(id); setError(null);
    try {
      const res = await fetch(`/api/v1/portal/appointments/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      if (res.ok) {
        const statusMap: Record<string, string> = { accept: "confirmed", reject: "cancelled", complete: "completed" };
        setAppts((p) => p.map((a) => a.id === id ? { ...a, status: statusMap[action] ?? a.status } : a));
      } else {
        const j = await res.json().catch(() => ({})) as { error?: { message?: string } };
        setError(j?.error?.message ?? "Action failed.");
      }
    } catch { setError("Network error."); }
    finally { setActioning(null); }
  }

  // ── Access control ────────────────────────────────────────────────────────

  async function openAccessModal(patient: PatientRow) {
    setSelectedPatient(patient);
    try {
      const res = await fetch(`/api/v1/portal/patients/access?patientId=${patient.patientId}`, { credentials: "include" });
      if (res.ok) {
        const j = await res.json() as { data: AccessGrant[] };
        setPatientGrants(j.data ?? []);
      }
    } catch { /* non-fatal */ }
  }

  async function grantAccess(grantedToUserId: string, accessLevel: string, expiresInDays?: number) {
    if (!selectedPatient) return;
    const res = await fetch("/api/v1/portal/patients/access", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: selectedPatient.patientId, grantedToUserId, accessLevel, expiresInDays }),
    });
    if (!res.ok) throw new Error("Failed");
    // Refresh grants
    const res2 = await fetch(`/api/v1/portal/patients/access?patientId=${selectedPatient.patientId}`, { credentials: "include" });
    if (res2.ok) { const j = await res2.json() as { data: AccessGrant[] }; setPatientGrants(j.data ?? []); }
  }

  async function revokeAccess(grantedToUserId: string) {
    if (!selectedPatient) return;
    await fetch(`/api/v1/portal/patients/access?patientId=${selectedPatient.patientId}&grantedToUserId=${grantedToUserId}`, {
      method: "DELETE", credentials: "include",
    });
    setPatientGrants((p) => p.filter((g) => g.grantedToUserId !== grantedToUserId));
  }

  async function handleSignOut() {
    await fetch("/api/portal/logout", { method: "POST", credentials: "include" }).catch(() => {});
    router.push("/portal/login");
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const todayAppts = appts.filter((a) => isToday(a.scheduledAt));
  const upcomingAppts = appts.filter((a) => ["requested", "confirmed"].includes(a.status) && isFuture(a.scheduledAt ?? a.createdAt));
  const pendingAppts = appts.filter((a) => a.status === "requested");

  const apptDisplayed =
    apptFilter === "requested"  ? appts.filter((a) => a.status === "requested") :
    apptFilter === "confirmed"  ? appts.filter((a) => a.status === "confirmed") :
    apptFilter === "completed"  ? appts.filter((a) => a.status === "completed") :
    appts;

  const stats = [
    { label: "Today",    value: todayAppts.length,   icon: "📅", hi: todayAppts.length > 0 },
    { label: "Pending",  value: pendingAppts.length,  icon: "⏳", hi: pendingAppts.length > 0 },
    { label: "Upcoming", value: upcomingAppts.length, icon: "✅", hi: false },
    { label: "Patients", value: patients.length,      icon: "👥", hi: false },
  ];

  const navItems: { tab: MainTab; icon: string; label: string }[] = [
    { tab: "today",        icon: "📅", label: "Today's Schedule" },
    { tab: "appointments", icon: "📋", label: "All Appointments" },
    { tab: "patients",     icon: "👥", label: "My Patients" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-14 lg:w-60 bg-white border-r border-slate-200 flex flex-col shrink-0 sticky top-0 h-screen shadow-sm">
        <div className="px-3 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm" style={{ background: "#1B8A4A" }}>
            {userFullName.charAt(0)}
          </span>
          <div className="hidden lg:block min-w-0">
            <p className="font-bold text-slate-800 text-sm leading-tight truncate">{doctorName ?? userFullName}</p>
            <p className="text-[10px] text-slate-400">Doctor Portal</p>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map((n) => (
            <button key={n.tab}
              onClick={() => setActiveTab(n.tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === n.tab ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}
              style={activeTab === n.tab ? { background: "#1B8A4A" } : {}}
            >
              <span className="text-base shrink-0">{n.icon}</span>
              <span className="hidden lg:block">{n.label}</span>
            </button>
          ))}

          <div className="pt-2 border-t border-slate-100 mt-2 space-y-0.5">
            {[
              { href: "/portal/doctor",    icon: "✏️", label: "Edit Profile" },
              { href: "/portal/schedule",  icon: "📆", label: "Schedule" },
            ].map((n) => (
              <Link key={n.label} href={n.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all">
                <span className="text-base shrink-0">{n.icon}</span>
                <span className="hidden lg:block">{n.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "#1B8A4A" }}>
              {userFullName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden lg:block min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{userFullName}</p>
              <p className="text-[10px] text-slate-400 capitalize">{userRole.replace("_", " ")}</p>
            </div>
          </div>
          <button onClick={() => void handleSignOut()} className="hidden lg:block mt-2 text-xs text-slate-400 hover:text-red-500 transition w-full text-left">Sign out →</button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                {activeTab === "today"        ? "Today's Schedule" :
                 activeTab === "appointments" ? "All Appointments" :
                 "My Patients"}
              </h1>
              <p className="text-sm text-slate-400">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <Link href="/portal/doctor"
              className="text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition">
              Edit Profile →
            </Link>
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label}
                className={`bg-white rounded-xl border p-4 shadow-sm ${s.hi ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}>
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className={`text-3xl font-bold ${s.hi ? "text-emerald-700" : "text-slate-800"}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── TODAY TAB ─────────────────────────────────────────────────────── */}
          {activeTab === "today" && (
            <div className="space-y-4">
              {apptLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
              ) : todayAppts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                  <p className="text-4xl mb-3">🌅</p>
                  <p className="text-slate-500 font-medium">No appointments today</p>
                  <p className="text-sm text-slate-400 mt-1">Your day is clear. Appointments will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{todayAppts.length} appointment{todayAppts.length !== 1 ? "s" : ""} today</p>
                  {todayAppts.map((appt) => (
                    <AppointmentCard key={appt.id} appt={appt} actioning={actioning} onAct={(id, action) => void act(id, action)} />
                  ))}
                </div>
              )}

              {/* Upcoming preview */}
              {upcomingAppts.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <p className="text-sm font-bold text-slate-700 mb-3">📋 Coming Up ({upcomingAppts.length})</p>
                  <div className="space-y-2">
                    {upcomingAppts.slice(0, 3).map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                        <div>
                          <p className="text-xs font-semibold text-slate-700">Patient #{a.patientId.slice(0, 6)}</p>
                          <p className="text-[10px] text-slate-400">{formatDT(a.scheduledAt)}</p>
                        </div>
                        <div className="flex gap-2">
                          <StatusBadge status={a.status} />
                          <TypeBadge type={a.type} />
                        </div>
                      </div>
                    ))}
                    {upcomingAppts.length > 3 && (
                      <button onClick={() => setActiveTab("appointments")} className="text-xs text-emerald-600 font-semibold hover:underline mt-1">
                        View all {upcomingAppts.length} →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ALL APPOINTMENTS TAB ──────────────────────────────────────────── */}
          {activeTab === "appointments" && (
            <div className="space-y-4">
              {/* Filter bar */}
              <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                {([
                  { key: "all",       label: "All",       count: appts.length },
                  { key: "requested", label: "Pending",   count: appts.filter((a) => a.status === "requested").length },
                  { key: "confirmed", label: "Confirmed", count: appts.filter((a) => a.status === "confirmed").length },
                  { key: "completed", label: "Completed", count: appts.filter((a) => a.status === "completed").length },
                ] as const).map((t) => (
                  <button key={t.key} onClick={() => setApptFilter(t.key)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${apptFilter === t.key ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    style={apptFilter === t.key ? { background: "#1B8A4A" } : {}}>
                    {t.label}
                    {t.count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${apptFilter === t.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"}`}>{t.count}</span>}
                  </button>
                ))}
              </div>

              {apptLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
              ) : apptDisplayed.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                  <p className="text-4xl mb-3">📋</p>
                  <p className="text-slate-500 font-medium">No appointments in this view</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {apptDisplayed.map((appt) => (
                    <AppointmentCard key={appt.id} appt={appt} actioning={actioning} onAct={(id, action) => void act(id, action)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── PATIENTS TAB ──────────────────────────────────────────────────── */}
          {activeTab === "patients" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800">
                <strong>Your patients:</strong> As the treating doctor, you have full access to all records for these patients.
                You can also grant staff limited or full access to specific patients.
              </div>

              {patientLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
              ) : patients.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                  <p className="text-4xl mb-3">👥</p>
                  <p className="text-slate-500 font-medium">No patient history yet</p>
                  <p className="text-sm text-slate-400 mt-1">Patients appear here after their first appointment with you.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["Patient", "Last Visit", "Visits", "Consultation Types", "Actions"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {patients.map((p) => (
                        <tr key={p.patientId} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800 text-xs">{p.displayAlias}</p>
                            {p.city && <p className="text-[10px] text-slate-400">{p.city}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {formatDate(p.lastApptAt)}
                            <div className="mt-0.5"><StatusBadge status={p.lastApptStatus} /></div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 text-center font-semibold">{p.appointmentCount}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {p.consultationTypes.slice(0, 2).map((t) => <TypeBadge key={t} type={t} />)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => void openAccessModal(p)}
                              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-50"
                            >
                              Manage Access
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Access control explainer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold text-slate-700 mb-2">🔒 Staff See (Metadata)</p>
                  <ul className="text-xs text-slate-500 space-y-1">
                    <li>• Patient alias (anonymized)</li>
                    <li>• Last appointment date</li>
                    <li>• Department visited</li>
                    <li>• Treating doctor name</li>
                    <li>• Consultation type (in-person/video)</li>
                  </ul>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold text-slate-700 mb-2">🔓 Doctor / Granted Full Access</p>
                  <ul className="text-xs text-slate-500 space-y-1">
                    <li>• All metadata above</li>
                    <li>• Lab reports &amp; test results</li>
                    <li>• Prescriptions</li>
                    <li>• Uploaded health documents</li>
                    <li>• Complete appointment history</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Access modal */}
      {selectedPatient && (
        <AccessGrantModal
          patient={selectedPatient}
          grants={patientGrants}
          onClose={() => { setSelectedPatient(null); setPatientGrants([]); }}
          onGrant={grantAccess}
          onRevoke={revokeAccess}
        />
      )}
    </div>
  );
}

// ── Appointment Card (shared) ─────────────────────────────────────────────────

function AppointmentCard({
  appt,
  actioning,
  onAct,
}: {
  appt: Appointment;
  actioning: string | null;
  onAct: (id: string, action: "accept" | "reject" | "complete") => void;
}) {
  const isPending   = appt.status === "requested";
  const isConfirmed = appt.status === "confirmed";
  const busy        = actioning === appt.id;
  const isRemote    = appt.type !== "in_person";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <StatusBadge status={appt.status} />
            <TypeBadge type={appt.type} />
            {isToday(appt.scheduledAt) && (
              <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">TODAY</span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-700">Patient #{appt.patientId.slice(0, 8)}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {appt.scheduledAt ? `Scheduled: ${formatDT(appt.scheduledAt)}` : `Requested: ${formatDT(appt.createdAt)}`}
          </p>
          {appt.hospitalName && (
            <p className="text-xs text-slate-400 mt-0.5">🏥 {appt.hospitalName}</p>
          )}
          {appt.patientNotes && (
            <p className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              💬 {appt.patientNotes}
            </p>
          )}
          {isConfirmed && isRemote && appt.meetingUrl && (
            <a href={appt.meetingUrl} target="_blank" rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg"
              style={{ background: "#1B8A4A" }}>
              {appt.type === "video_consultation" ? "🎥" : "📞"} Join Session →
            </a>
          )}
        </div>

        <div className="flex flex-col gap-2 items-end shrink-0">
          {isPending && (
            <>
              <button onClick={() => onAct(appt.id, "accept")} disabled={busy}
                className="px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 flex items-center gap-1.5 transition"
                style={{ background: "#1B8A4A" }}>
                {busy ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "✓"} Accept
              </button>
              <button onClick={() => onAct(appt.id, "reject")} disabled={busy}
                className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50 transition">
                Decline
              </button>
            </>
          )}
          {isConfirmed && (
            <button onClick={() => onAct(appt.id, "complete")} disabled={busy}
              className="px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition"
              style={{ background: "#1e40af" }}>
              Mark Complete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
