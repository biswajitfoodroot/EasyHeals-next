"use client";

/**
 * DEV TESTING PANEL — /dev
 *
 * Only works in development (NODE_ENV !== production).
 * Use this to test premium tiers, portal user assignments, feature flags, etc.
 * without going through Razorpay or real auth flows.
 */

import { useEffect, useState, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = "patients" | "users" | "flags" | "hospitals" | "doctors";

interface Patient {
  id: string;
  googleEmail: string | null;
  googleName: string | null;
  displayAlias: string | null;
  subscriptionTier: string | null;
  subscriptionExpiresAt: number | null;
  trialStartedAt: number | null;
  createdAt: number | null;
}

interface PortalUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  entityType: string | null;
  entityId: string | null;
  isActive: boolean;
  createdAt: number | null;
}

interface FeatureFlag {
  key: string;
  enabled: boolean;
  updatedAt: number | null;
}

interface Hospital {
  id: string;
  name: string;
  city: string | null;
  isActive: boolean;
}

interface Doctor {
  id: string;
  fullName: string;
  specialization: string | null;
  city: string | null;
  isActive: boolean;
  hospitalId: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dt(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Sk({ w }: { w?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded h-4 ${w ?? "w-full"}`} />;
}

function Tag({ label, color }: { label: string; color: "green" | "amber" | "blue" | "slate" | "purple" | "red" }) {
  const cls = {
    green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber:  "bg-amber-50 text-amber-700 border-amber-200",
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    slate:  "bg-slate-50 text-slate-600 border-slate-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    red:    "bg-red-50 text-red-700 border-red-200",
  }[color];
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

function tierColor(tier: string | null): "green" | "amber" | "purple" | "slate" {
  if (tier === "health_pro")  return "purple";
  if (tier === "health_plus") return "green";
  if (tier === "free")        return "slate";
  return "amber";
}

const TIERS = ["free", "trial", "health_plus", "health_pro"] as const;
const ROLES = ["owner", "admin", "advisor", "viewer", "hospital_admin", "doctor", "receptionist", "contributor"] as const;

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  trial: "Reset Trial",
  health_plus: "Health+",
  health_pro: "Health Pro",
};

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold border ${ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
      {ok ? "✓" : "✕"} {msg}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DevPage() {
  const [tab, setTab] = useState<Tab>("patients");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // Current logged-in patient session
  const [currentPatientId, setCurrentPatientId] = useState<string | null>(null);
  const [subStatus, setSubStatus] = useState<Record<string, unknown> | null>(null);
  const [subLoading, setSubLoading] = useState(false);

  // Edit states for users panel
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editEntityType, setEditEntityType] = useState("");
  const [editEntityId, setEditEntityId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingUser, setSavingUser] = useState(false);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function api(url: string) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(await r.text());
    return r.json() as Promise<{ data: unknown[] }>;
  }

  async function post(body: Record<string, unknown>) {
    const r = await fetch("/api/dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json() as { ok?: boolean; error?: string };
    if (!j.ok) throw new Error(j.error ?? "Failed");
    return j;
  }

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    try {
      const j = await api(`/api/dev?section=${t}`);
      if (t === "patients")  setPatients(j.data as Patient[]);
      if (t === "users")     setUsers(j.data as PortalUser[]);
      if (t === "flags")     setFlags(j.data as FeatureFlag[]);
      if (t === "hospitals") setHospitals(j.data as Hospital[]);
      if (t === "doctors")   setDoctors(j.data as Doctor[]);
    } catch (e) {
      showToast(String(e), false);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(tab); }, [tab, load]);

  // Detect which patient is currently logged in + fetch live subscription status
  useEffect(() => {
    fetch("/api/v1/patients/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (j?.patient?.id) setCurrentPatientId(j.patient.id); })
      .catch(() => null);
  }, []);

  async function checkSubStatus() {
    setSubLoading(true);
    try {
      const r = await fetch("/api/v1/patients/subscription", { credentials: "include" });
      const j = await r.json() as { data?: Record<string, unknown> };
      setSubStatus(j.data ?? { error: "No data field in response", raw: j });
    } catch (e) {
      setSubStatus({ error: String(e) });
    } finally { setSubLoading(false); }
  }

  async function setTier(patientId: string, tier: string) {
    try {
      await post({ action: "set_patient_tier", patientId, tier });
      showToast(`Tier set to ${tier}`, true);
      setPatients((p) => p.map((pt) => pt.id === patientId ? {
        ...pt,
        subscriptionTier: tier === "trial" ? "free" : tier,
        subscriptionExpiresAt: (tier === "free" || tier === "trial") ? null : Date.now() + 365 * 86400000,
        trialStartedAt: tier === "free" ? null : tier === "trial" ? Date.now() : pt.trialStartedAt,
      } : pt));
    } catch (e) { showToast(String(e), false); }
  }

  async function toggleFlag(key: string, current: boolean) {
    try {
      await post({ action: "toggle_flag", key, enabled: !current });
      setFlags((f) => f.map((fl) => fl.key === key ? { ...fl, enabled: !current } : fl));
      showToast(`Flag '${key}' → ${!current ? "ON" : "OFF"}`, true);
    } catch (e) { showToast(String(e), false); }
  }

  async function enableAllFlags() {
    try {
      await post({ action: "enable_all_flags" });
      showToast("All core flags enabled", true);
      void load("flags");
    } catch (e) { showToast(String(e), false); }
  }

  function startEditUser(u: PortalUser) {
    setEditingUser(u.id);
    setEditRole(u.role);
    setEditEntityType(u.entityType ?? "");
    setEditEntityId(u.entityId ?? "");
    setNewPassword("");
  }

  async function saveUser(userId: string) {
    setSavingUser(true);
    try {
      await post({
        action: "set_user_entity",
        userId,
        role: editRole,
        entityType: editEntityType || null,
        entityId: editEntityId || null,
      });
      if (newPassword.length >= 4) {
        await post({ action: "set_user_password", userId, password: newPassword });
        showToast("User & password updated", true);
      } else {
        showToast("User updated", true);
      }
      setEditingUser(null);
      void load("users");
    } catch (e) { showToast(String(e), false); }
    finally { setSavingUser(false); }
  }

  const NAV: { tab: Tab; icon: string; label: string }[] = [
    { tab: "patients",  icon: "👤", label: "Patients" },
    { tab: "users",     icon: "🧑‍💼", label: "Portal Users" },
    { tab: "flags",     icon: "🚩", label: "Feature Flags" },
    { tab: "hospitals", icon: "🏥", label: "Hospitals" },
    { tab: "doctors",   icon: "👨‍⚕️", label: "Doctors" },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-mono text-sm">
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-amber-400 font-bold text-lg">⚗</span>
          <span className="font-bold text-slate-100">EasyHeals Dev Testing Panel</span>
          <span className="text-[10px] font-bold text-red-400 bg-red-900/40 border border-red-700 px-2 py-0.5 rounded-full">DEV ONLY — NOT FOR PRODUCTION</span>
        </div>
        <div className="flex gap-2 text-xs text-slate-400">
          <span>NODE_ENV: development</span>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar nav */}
        <aside className="w-48 bg-slate-800 border-r border-slate-700 min-h-screen p-3 space-y-1">
          {NAV.map((n) => (
            <button key={n.tab} onClick={() => setTab(n.tab)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${tab === n.tab ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-slate-400 hover:bg-slate-700 hover:text-slate-200"}`}>
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}

          <div className="pt-3 border-t border-slate-700">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-2 mb-2">Quick links</p>
            {[
              { href: "/dev",                    label: "↺ Reload" },
              { href: "/portal/login",           label: "Portal Login" },
              { href: "/login",                  label: "Patient Login" },
              { href: "/admin",                  label: "Admin Panel" },
              { href: "/portal/hospital/dashboard", label: "Hospital Portal" },
              { href: "/portal/doctor/dashboard",   label: "Doctor Portal" },
              { href: "/dashboard",              label: "Patient Dashboard" },
            ].map((l) => (
              <a key={l.href} href={l.href}
                className="flex items-center px-2 py-1.5 text-xs text-slate-400 hover:text-amber-400 transition rounded">
                {l.label} →
              </a>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 overflow-x-auto">

          {/* ── PATIENTS ── */}
          {tab === "patients" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-200">Patients <span className="text-slate-500 font-normal text-xs">({patients.length})</span></h2>
                <p className="text-xs text-slate-500">Set subscription tier for testing premium features</p>
              </div>

              {/* Current patient session banner */}
              {currentPatientId ? (
                <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-emerald-400 font-bold">● Active session:</span>
                    <span className="font-mono text-emerald-300">{currentPatientId}</span>
                    <span className="text-emerald-400">
                      {(() => {
                        const p = patients.find((p) => p.id === currentPatientId);
                        return p ? `| ${p.googleEmail ?? p.googleName ?? "no email"} | tier: ${p.subscriptionTier ?? "free"}` : "";
                      })()}
                    </span>
                    <button onClick={() => void checkSubStatus()}
                      disabled={subLoading}
                      className="ml-auto px-3 py-1 rounded-lg text-[10px] font-bold bg-emerald-800/50 border border-emerald-600/40 text-emerald-300 hover:border-emerald-400 transition disabled:opacity-50">
                      {subLoading ? "Checking…" : "Check Live Subscription API →"}
                    </button>
                  </div>
                  {subStatus && (
                    <div className={`rounded-lg px-3 py-2 text-[11px] font-mono border ${(subStatus.canUsePremium as boolean) ? "bg-emerald-950 border-emerald-600 text-emerald-300" : "bg-red-950 border-red-700 text-red-300"}`}>
                      {(subStatus.canUsePremium as boolean)
                        ? "✓ canUsePremium: TRUE — dashboard should show premium features"
                        : "✗ canUsePremium: FALSE — dashboard is locked"}
                      <pre className="mt-1 text-[10px] text-slate-400 whitespace-pre-wrap">{JSON.stringify(subStatus, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-400">
                  <span className="text-slate-500">○ No patient session — go to</span>
                  <a href="/login" className="text-amber-400 hover:underline">/login</a>
                  <span className="text-slate-500">to authenticate as a patient first.</span>
                </div>
              )}

              {/* Bulk upgrade strip */}
              <div className="flex items-center gap-2 bg-slate-800 rounded-xl p-3 border border-slate-700">
                <span className="text-xs text-slate-400">Bulk set all patients:</span>
                {TIERS.map((t) => (
                  <button key={t} onClick={() => patients.forEach((p) => void setTier(p.id, t))}
                    className="px-3 py-1 rounded-lg text-xs font-bold border transition bg-slate-700 border-slate-600 text-slate-200 hover:border-amber-500 hover:text-amber-400">
                    {TIER_LABELS[t]}
                  </button>
                ))}
              </div>

              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full">
                  <thead className="border-b border-slate-700">
                    <tr>
                      {["ID", "Name / Email", "Alias", "Current Tier", "Trial Started", "Sub Expires", "Set Tier"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {loading ? (
                      [1,2,3].map((i) => (
                        <tr key={i}><td colSpan={7} className="px-4 py-3"><Sk /></td></tr>
                      ))
                    ) : patients.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">No patients in DB yet. Register via /login.</td></tr>
                    ) : patients.map((p) => {
                      const isMe = p.id === currentPatientId;
                      return (
                      <tr key={p.id} className={`transition ${isMe ? "bg-emerald-900/20 ring-1 ring-inset ring-emerald-500/40" : "hover:bg-slate-700/30"}`}>
                        <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">
                          {p.id.slice(0, 8)}…
                          {isMe && <span className="ml-1 text-[9px] font-bold text-emerald-400 bg-emerald-900/40 border border-emerald-600/50 px-1 py-0.5 rounded">YOU</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-semibold text-slate-200">{p.googleName ?? "—"}</p>
                          <p className="text-[10px] text-slate-400">{p.googleEmail ?? "no email"}</p>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{p.displayAlias ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <Tag label={p.subscriptionTier ?? "free"} color={tierColor(p.subscriptionTier)} />
                        </td>
                        <td className="px-4 py-2.5 text-[10px] text-slate-400">{dt(p.trialStartedAt)}</td>
                        <td className="px-4 py-2.5 text-[10px] text-slate-400">{dt(p.subscriptionExpiresAt)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1 flex-wrap">
                            {TIERS.map((t) => (
                              <button key={t} onClick={() => void setTier(p.id, t)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                  (p.subscriptionTier === t || (t === "free" && !p.subscriptionTier))
                                    ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                                    : "bg-slate-700 text-slate-300 border-slate-600 hover:border-amber-400 hover:text-amber-400"
                                }`}>
                                {TIER_LABELS[t]}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── PORTAL USERS ── */}
          {tab === "users" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-200">Portal Users <span className="text-slate-500 font-normal text-xs">({users.length})</span></h2>
                <p className="text-xs text-slate-500">Set role, link to hospital/doctor, reset password</p>
              </div>

              <div className="space-y-3">
                {loading ? (
                  [1,2,3].map((i) => <div key={i} className="bg-slate-800 rounded-xl border border-slate-700 p-4"><Sk /></div>)
                ) : users.length === 0 ? (
                  <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center text-slate-500">
                    No portal users. Create one via the admin panel.
                  </div>
                ) : users.map((u) => (
                  <div key={u.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                    {editingUser === u.id ? (
                      /* Edit mode */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-200">{u.email}</p>
                          <button onClick={() => setEditingUser(null)} className="text-xs text-slate-400 hover:text-slate-200">✕ Cancel</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Role</label>
                            <select value={editRole} onChange={(e) => setEditRole(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500">
                              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Entity Type</label>
                            <select value={editEntityType} onChange={(e) => setEditEntityType(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500">
                              <option value="">none</option>
                              <option value="hospital">hospital</option>
                              <option value="doctor">doctor</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Entity ID</label>
                            <input type="text" value={editEntityId} onChange={(e) => setEditEntityId(e.target.value)}
                              placeholder="hospital/doctor UUID"
                              className="w-full px-2.5 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-500 font-mono" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">New Password <span className="text-slate-500">(optional)</span></label>
                            <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="min 4 chars"
                              className="w-full px-2.5 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-500" />
                          </div>
                        </div>

                        {/* Hospital / Doctor quick-pick helpers */}
                        {editEntityType === "hospital" && hospitals.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Quick pick hospital →</p>
                            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                              {hospitals.map((h) => (
                                <button key={h.id} onClick={() => setEditEntityId(h.id)}
                                  className={`px-2 py-0.5 rounded text-[10px] border transition ${editEntityId === h.id ? "bg-amber-500/20 text-amber-400 border-amber-500/40" : "bg-slate-700 text-slate-300 border-slate-600 hover:border-amber-400"}`}>
                                  {h.name} {h.city ? `(${h.city})` : ""}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {editEntityType === "doctor" && doctors.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Quick pick doctor →</p>
                            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                              {doctors.map((d) => (
                                <button key={d.id} onClick={() => setEditEntityId(d.id)}
                                  className={`px-2 py-0.5 rounded text-[10px] border transition ${editEntityId === d.id ? "bg-amber-500/20 text-amber-400 border-amber-500/40" : "bg-slate-700 text-slate-300 border-slate-600 hover:border-amber-400"}`}>
                                  {d.fullName} {d.specialization ? `· ${d.specialization}` : ""}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <button onClick={() => void saveUser(u.id)} disabled={savingUser}
                          className="px-4 py-2 text-xs font-bold text-slate-900 bg-amber-400 rounded-lg hover:bg-amber-300 disabled:opacity-50 transition">
                          {savingUser ? "Saving…" : "Save Changes"}
                        </button>
                      </div>
                    ) : (
                      /* View mode */
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-xs font-bold text-slate-200">{u.email}</p>
                            <Tag label={u.role} color={
                              u.role === "owner" ? "red" :
                              u.role === "admin" ? "amber" :
                              u.role === "hospital_admin" ? "blue" :
                              u.role === "doctor" ? "green" : "slate"
                            } />
                            {!u.isActive && <Tag label="Inactive" color="red" />}
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {u.fullName ?? "No name"} &nbsp;·&nbsp;
                            {u.entityType
                              ? <span className="text-amber-400">{u.entityType}: <span className="font-mono">{u.entityId?.slice(0, 12)}…</span></span>
                              : <span>No entity linked</span>}
                          </p>
                        </div>
                        <button onClick={() => { startEditUser(u); if (hospitals.length === 0) void load("hospitals"); if (doctors.length === 0) void load("doctors"); }}
                          className="px-3 py-1.5 text-xs font-bold text-amber-400 border border-amber-500/40 rounded-lg hover:bg-amber-500/10 transition shrink-0">
                          Edit →
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── FEATURE FLAGS ── */}
          {tab === "flags" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-200">Feature Flags <span className="text-slate-500 font-normal text-xs">({flags.length})</span></h2>
                <button onClick={() => void enableAllFlags()}
                  className="px-3 py-1.5 text-xs font-bold text-slate-900 bg-amber-400 rounded-lg hover:bg-amber-300 transition">
                  ⚡ Enable All Core Flags
                </button>
              </div>

              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full">
                  <thead className="border-b border-slate-700">
                    <tr>
                      {["Flag Key", "Status", "Last Updated", "Toggle"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {loading ? (
                      [1,2,3].map((i) => <tr key={i}><td colSpan={4} className="px-4 py-3"><Sk /></td></tr>)
                    ) : flags.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                          No flags in DB. Click "Enable All Core Flags" to seed them.
                        </td>
                      </tr>
                    ) : flags.map((f) => (
                      <tr key={f.key} className="hover:bg-slate-700/30 transition">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-300">{f.key}</td>
                        <td className="px-4 py-2.5">
                          {f.enabled
                            ? <Tag label="ON" color="green" />
                            : <Tag label="OFF" color="red" />}
                        </td>
                        <td className="px-4 py-2.5 text-[10px] text-slate-400">{dt(f.updatedAt)}</td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => void toggleFlag(f.key, f.enabled)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors border ${f.enabled ? "bg-emerald-500 border-emerald-400" : "bg-slate-600 border-slate-500"}`}>
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${f.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* New flag */}
              <NewFlagForm onDone={() => void load("flags")} showToast={showToast} />
            </div>
          )}

          {/* ── HOSPITALS ── */}
          {tab === "hospitals" && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-200">Hospitals <span className="text-slate-500 font-normal text-xs">({hospitals.length})</span></h2>
              <p className="text-xs text-slate-500 mb-2">Copy an ID then go to Portal Users tab to link a hospital_admin user to it.</p>
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full">
                  <thead className="border-b border-slate-700">
                    <tr>
                      {["ID", "Name", "City", "Active"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {loading ? (
                      [1,2,3].map((i) => <tr key={i}><td colSpan={4} className="px-4 py-3"><Sk /></td></tr>)
                    ) : hospitals.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No hospitals. Add via admin panel.</td></tr>
                    ) : hospitals.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-700/30 transition">
                        <td className="px-4 py-2.5">
                          <button onClick={() => { void navigator.clipboard.writeText(h.id); showToast("ID copied", true); }}
                            className="font-mono text-[10px] text-amber-400 hover:underline text-left">
                            {h.id.slice(0, 16)}… <span className="text-slate-500">⎘</span>
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-200 font-semibold">{h.name}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{h.city ?? "—"}</td>
                        <td className="px-4 py-2.5">{h.isActive ? <Tag label="Active" color="green" /> : <Tag label="Inactive" color="red" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── DOCTORS ── */}
          {tab === "doctors" && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-200">Doctors <span className="text-slate-500 font-normal text-xs">({doctors.length})</span></h2>
              <p className="text-xs text-slate-500 mb-2">Copy an ID then go to Portal Users tab to link a doctor user to it.</p>
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full">
                  <thead className="border-b border-slate-700">
                    <tr>
                      {["ID", "Name", "Specialization", "City", "Active"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {loading ? (
                      [1,2,3].map((i) => <tr key={i}><td colSpan={5} className="px-4 py-3"><Sk /></td></tr>)
                    ) : doctors.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No doctors. Add via admin panel or hospital portal.</td></tr>
                    ) : doctors.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-700/30 transition">
                        <td className="px-4 py-2.5">
                          <button onClick={() => { void navigator.clipboard.writeText(d.id); showToast("ID copied", true); }}
                            className="font-mono text-[10px] text-amber-400 hover:underline text-left">
                            {d.id.slice(0, 16)}… <span className="text-slate-500">⎘</span>
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-200 font-semibold">{d.fullName}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{d.specialization ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{d.city ?? "—"}</td>
                        <td className="px-4 py-2.5">{d.isActive ? <Tag label="Active" color="green" /> : <Tag label="Inactive" color="red" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

// ── New Flag Form ─────────────────────────────────────────────────────────────

function NewFlagForm({ onDone, showToast }: { onDone: () => void; showToast: (m: string, ok: boolean) => void }) {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  async function create(enabled: boolean) {
    if (!key.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/dev", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_flag", key: key.trim(), enabled }),
      });
      showToast(`Flag '${key.trim()}' created (${enabled ? "ON" : "OFF"})`, true);
      setKey(""); onDone();
    } catch (e) { showToast(String(e), false); }
    finally { setSaving(false); }
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Create / Update Flag</p>
      <div className="flex gap-2">
        <input type="text" value={key} onChange={(e) => setKey(e.target.value)}
          placeholder="flag_key e.g. appointment_booking"
          className="flex-1 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-500" />
        <button onClick={() => void create(true)} disabled={saving || !key.trim()}
          className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition">
          Enable
        </button>
        <button onClick={() => void create(false)} disabled={saving || !key.trim()}
          className="px-3 py-1.5 text-xs font-bold bg-red-700 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition">
          Disable
        </button>
      </div>
    </div>
  );
}
