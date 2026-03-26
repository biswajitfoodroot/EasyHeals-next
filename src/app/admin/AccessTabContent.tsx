"use client";

import React, { useState, useEffect, useCallback, FormEvent } from "react";

type Me = { role: string };
type Level = "full" | "limited" | "none";

type RolePermRow = {
  role: string;
  hospitals: Level;
  doctors: Level;
  aiResearch: Level;
  providerMgmt: Level;
  userMgmt: Level;
  portal: Level;
};

type UserRow = {
  id: string; fullName: string; email: string; role: string;
  entityType: string | null; entityId: string | null; entityName: string | null;
  isActive: boolean; createdAt: string | null;
};

type EntityOption = { id: string; name: string };
type Props = { me: Me };

// ── Constants ─────────────────────────────────────────────────────────────────

type Plane = "admin" | "provider_mgmt" | "portal";

const ROLE_PLANE: Record<string, Plane> = {
  owner: "admin", admin: "admin", admin_manager: "admin",
  admin_editor: "admin", advisor: "admin", viewer: "admin",
  operator: "provider_mgmt", coordinator: "provider_mgmt",
  hospital_admin: "portal", doctor: "portal", receptionist: "portal",
};

const PLANE_LABELS: Record<Plane, string> = {
  admin: "Admin / CMS", provider_mgmt: "Provider Mgmt", portal: "Provider Portal",
};

const PLANE_COLORS: Record<Plane, string> = {
  admin: "bg-teal-50 text-teal-700 border-teal-200",
  provider_mgmt: "bg-indigo-50 text-indigo-700 border-indigo-200",
  portal: "bg-green-50 text-green-700 border-green-200",
};

const COLS: { key: keyof Omit<RolePermRow, "role">; label: string; highlight?: boolean }[] = [
  { key: "hospitals",    label: "Hospitals" },
  { key: "doctors",      label: "Doctors" },
  { key: "aiResearch",   label: "AI Research" },
  { key: "providerMgmt", label: "Provider Mgmt", highlight: true },
  { key: "userMgmt",     label: "User Mgmt" },
  { key: "portal",       label: "Portal" },
];

const LEVEL_CYCLE: Level[] = ["none", "full", "limited"];

const ROLE_ORDER = [
  "owner", "admin", "admin_manager", "admin_editor", "advisor", "viewer",
  "operator", "coordinator",
  "hospital_admin", "doctor", "receptionist",
];

const EMPTY_FORM = {
  fullName: "", email: "", password: "",
  roleCode: "viewer", entityType: "", entityId: "", isActive: true,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function PermCheckbox({ level, onChange, disabled }: { level: Level; onChange: (l: Level) => void; disabled: boolean }) {
  function cycle() {
    if (disabled) return;
    const idx = LEVEL_CYCLE.indexOf(level);
    onChange(LEVEL_CYCLE[(idx + 1) % LEVEL_CYCLE.length]);
  }

  if (level === "full") return (
    <button onClick={cycle} disabled={disabled} title="Full access — click to change"
      className={`flex flex-col items-center gap-0.5 group ${disabled ? "cursor-default" : "cursor-pointer"}`}>
      <span className={`flex items-center justify-center w-7 h-7 rounded-lg bg-green-500 shadow-sm transition-all ${!disabled ? "group-hover:bg-green-600 group-hover:scale-105" : ""}`}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
      <span className="text-[10px] font-semibold text-green-700">Full</span>
    </button>
  );

  if (level === "limited") return (
    <button onClick={cycle} disabled={disabled} title="Limited access — click to change"
      className={`flex flex-col items-center gap-0.5 group ${disabled ? "cursor-default" : "cursor-pointer"}`}>
      <span className={`flex items-center justify-center w-7 h-7 rounded-lg bg-amber-400 shadow-sm transition-all ${!disabled ? "group-hover:bg-amber-500 group-hover:scale-105" : ""}`}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7H11" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </span>
      <span className="text-[10px] font-semibold text-amber-600">Limited</span>
    </button>
  );

  return (
    <button onClick={cycle} disabled={disabled} title="No access — click to grant"
      className={`flex flex-col items-center gap-0.5 group ${disabled ? "cursor-default" : "cursor-pointer"}`}>
      <span className={`flex items-center justify-center w-7 h-7 rounded-lg border-2 border-slate-200 bg-white transition-all ${!disabled ? "group-hover:border-slate-400 group-hover:scale-105" : ""}`}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 3L9 9M9 3L3 9" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </span>
      <span className="text-[10px] font-semibold text-slate-300">None</span>
    </button>
  );
}

function roleBadgeColor(role: string) {
  const plane = ROLE_PLANE[role];
  if (role === "owner") return "bg-purple-100 text-purple-700 border-purple-200";
  if (role === "admin") return "bg-teal-100 text-teal-700 border-teal-200";
  if (plane === "provider_mgmt") return "bg-indigo-100 text-indigo-700 border-indigo-200";
  if (plane === "portal") return "bg-green-100 text-green-700 border-green-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AccessTabContent({ me }: Props) {
  const canManage = me.role === "owner" || me.role === "admin" || me.role === "admin_manager";
  const canEditPerms = me.role === "owner" || me.role === "admin";

  // ── Permission matrix state ──────────────────────────────────────────────
  const [perms, setPerms] = useState<Record<string, RolePermRow>>({});
  const [permsLoading, setPermsLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saveMsg, setSaveMsg] = useState<Record<string, "saved" | "error">>({});

  // ── Users state ──────────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [hospitalOptions, setHospitalOptions] = useState<EntityOption[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<EntityOption[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
  const [addBusy, setAddBusy] = useState(false);
  const [addMsg, setAddMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Omit<typeof EMPTY_FORM, "password"> & { password?: string }>({ ...EMPTY_FORM });
  const [editBusy, setEditBusy] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [planeFilter, setPlaneFilter] = useState<Plane | "all">("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // ── Load permissions ─────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/role-permissions");
        if (res.ok) {
          const j = await res.json() as { data: RolePermRow[] };
          const map: Record<string, RolePermRow> = {};
          j.data.forEach((r) => { map[r.role] = r; });
          setPerms(map);
        }
      } finally { setPermsLoading(false); }
    })();
    void loadUsers();
    void loadEntityOptions();
  }, []);

  // ── Permission change — auto-save ────────────────────────────────────────
  const changeLevel = useCallback(async (role: string, col: keyof Omit<RolePermRow, "role">, level: Level) => {
    const updated = { ...perms[role], [col]: level };
    setPerms((p) => ({ ...p, [role]: updated }));
    setSaving((s) => ({ ...s, [role]: true }));
    setSaveMsg((m) => { const n = { ...m }; delete n[role]; return n; });

    try {
      const res = await fetch("/api/admin/role-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          hospitals: updated.hospitals,
          doctors: updated.doctors,
          aiResearch: updated.aiResearch,
          providerMgmt: updated.providerMgmt,
          userMgmt: updated.userMgmt,
          portal: updated.portal,
        }),
      });
      setSaveMsg((m) => ({ ...m, [role]: res.ok ? "saved" : "error" }));
      setTimeout(() => setSaveMsg((m) => { const n = { ...m }; delete n[role]; return n; }), 2000);
    } catch {
      setSaveMsg((m) => ({ ...m, [role]: "error" }));
    } finally {
      setSaving((s) => ({ ...s, [role]: false }));
    }
  }, [perms]);

  // ── Users CRUD ───────────────────────────────────────────────────────────
  async function loadUsers() {
    setUsersLoading(true); setUsersError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) { const j = await res.json() as { error?: string }; setUsersError(j.error ?? "Failed"); return; }
      const j = await res.json() as { data: UserRow[] };
      setUsers(j.data);
    } catch { setUsersError("Network error"); }
    finally { setUsersLoading(false); }
  }

  async function loadEntityOptions() {
    try {
      const [hRes, dRes] = await Promise.all([
        fetch("/api/hospitals?limit=500&fields=id,name"),
        fetch("/api/admin/users?entityOptionsOnly=1"),
      ]);
      if (hRes.ok) { const j = await hRes.json() as { data?: { id: string; name: string }[] }; setHospitalOptions((j.data ?? []).map((h) => ({ id: h.id, name: h.name }))); }
      if (dRes.ok) { const j = await dRes.json() as { doctors?: { id: string; fullName: string }[] }; setDoctorOptions((j.doctors ?? []).map((d) => ({ id: d.id, name: d.fullName }))); }
    } catch { /* non-fatal */ }
  }

  async function handleAddUser(e: FormEvent) {
    e.preventDefault(); setAddBusy(true); setAddMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: addForm.fullName, email: addForm.email, password: addForm.password, roleCode: addForm.roleCode, entityType: addForm.entityType || null, entityId: addForm.entityId || null }),
      });
      const j = await res.json() as { error?: string };
      if (!res.ok) { setAddMsg({ type: "error", text: j.error ?? "Failed" }); }
      else { setAddMsg({ type: "success", text: "User created!" }); setAddForm({ ...EMPTY_FORM }); setShowAddForm(false); void loadUsers(); }
    } catch { setAddMsg({ type: "error", text: "Network error" }); }
    finally { setAddBusy(false); }
  }

  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setEditForm({ fullName: user.fullName, email: user.email, password: "", roleCode: user.role, entityType: user.entityType ?? "", entityId: user.entityId ?? "", isActive: user.isActive });
    setEditMsg(null);
  }

  async function handleEditUser(e: FormEvent) {
    e.preventDefault(); if (!editingId) return;
    setEditBusy(true); setEditMsg(null);
    try {
      const payload: Record<string, unknown> = { fullName: editForm.fullName, email: editForm.email, roleCode: editForm.roleCode, entityType: editForm.entityType || null, entityId: editForm.entityId || null, isActive: editForm.isActive };
      if (editForm.password) payload.password = editForm.password;
      const res = await fetch(`/api/admin/users/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json() as { error?: string };
      if (!res.ok) { setEditMsg({ type: "error", text: j.error ?? "Failed" }); }
      else { setEditMsg({ type: "success", text: "Saved!" }); setEditingId(null); void loadUsers(); }
    } catch { setEditMsg({ type: "error", text: "Network error" }); }
    finally { setEditBusy(false); }
  }

  async function handleDeleteUser(id: string) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (res.ok) { void loadUsers(); }
      else { const j = await res.json() as { error?: string }; alert(j.error ?? "Failed"); }
    } catch { alert("Network error"); }
    finally { setDeletingId(null); }
  }

  const filteredUsers = users.filter((u) => {
    if (planeFilter !== "all" && ROLE_PLANE[u.role] !== planeFilter) return false;
    if (statusFilter === "active" && !u.isActive) return false;
    if (statusFilter === "inactive" && u.isActive) return false;
    if (search) { const q = search.toLowerCase(); return u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q); }
    return true;
  });

  const planeCounts = { all: users.length, admin: 0, provider_mgmt: 0, portal: 0 };
  users.forEach((u) => { const p = ROLE_PLANE[u.role]; if (p) planeCounts[p]++; });

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── ACCESS MATRIX ─────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Access Matrix</h2>
              <p className="text-slate-500 text-sm mt-0.5">
                {canEditPerms
                  ? "Click any checkbox to toggle Full → Limited → None. Changes save instantly."
                  : "Permissions granted to each role across all three planes."}
              </p>
            </div>
            {canEditPerms && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold shrink-0">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Editing enabled
              </span>
            )}
          </div>
          {/* Plane legend */}
          <div className="flex flex-wrap gap-2 mt-3">
            {(Object.entries(PLANE_LABELS) as [Plane, string][]).map(([p, label]) => (
              <span key={p} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${PLANE_COLORS[p]}`}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "currentColor" }} />
                {label}
              </span>
            ))}
            <span className="ml-auto inline-flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1"><span className="inline-block w-3.5 h-3.5 rounded bg-green-500" /> Full</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3.5 h-3.5 rounded bg-amber-400" /> Limited</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3.5 h-3.5 rounded border-2 border-slate-200" /> None</span>
            </span>
          </div>
        </div>

        {permsLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading permissions...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40">
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 w-44">Role</th>
                  {COLS.map((c) => (
                    <th key={c.key} className={`text-center px-3 py-3 font-semibold text-sm ${c.highlight ? "text-indigo-600" : "text-slate-600"}`}>{c.label}</th>
                  ))}
                  <th className="w-16 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {ROLE_ORDER.map((role, i) => {
                  const row = perms[role];
                  const plane = ROLE_PLANE[role] as Plane;
                  const groupBorder = i > 0 && ROLE_PLANE[ROLE_ORDER[i - 1]] !== plane ? "border-t-2 border-slate-200" : "";
                  const isSaving = saving[role];
                  const msg = saveMsg[role];
                  if (!row) return null;
                  return (
                    <tr key={role} className={`border-b border-slate-50 hover:bg-slate-50/40 transition-colors ${groupBorder}`}>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border w-fit ${roleBadgeColor(role)}`}>{role}</span>
                          <span className={`text-[11px] font-medium ${PLANE_COLORS[plane].split(" ")[1]}`}>{PLANE_LABELS[plane]}</span>
                        </div>
                      </td>
                      {COLS.map((c) => (
                        <td key={c.key} className={`text-center px-3 py-3 ${c.highlight ? "bg-indigo-50/30" : ""}`}>
                          <PermCheckbox
                            level={row[c.key] as Level}
                            onChange={(l) => void changeLevel(role, c.key, l)}
                            disabled={!canEditPerms}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center w-16">
                        {isSaving && <span className="text-xs text-slate-400 animate-pulse">Saving…</span>}
                        {!isSaving && msg === "saved" && <span className="text-xs text-green-600 font-semibold">✓ Saved</span>}
                        {!isSaving && msg === "error" && <span className="text-xs text-red-500">Error</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── USERS ─────────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex justify-between items-start gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Users</h2>
            <p className="text-slate-500 text-sm mt-0.5">Manage user accounts and their plane access.</p>
          </div>
          {canManage && (
            <button onClick={() => { setShowAddForm(!showAddForm); setAddMsg(null); }} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm flex items-center gap-1.5 shrink-0">
              <span className="text-base leading-none">+</span> Add User
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-slate-100 bg-white flex flex-wrap gap-3 items-center">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {([["all", "All"], ["admin", "Admin / CMS"], ["provider_mgmt", "Provider Mgmt"], ["portal", "Portal"]] as [Plane | "all", string][]).map(([key, label]) => (
              <button key={key} onClick={() => setPlaneFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  planeFilter === key
                    ? key === "admin" ? "bg-teal-600 text-white"
                    : key === "provider_mgmt" ? "bg-indigo-600 text-white"
                    : key === "portal" ? "bg-green-600 text-white"
                    : "bg-white text-slate-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}>
                {label}
                <span className={`ml-1.5 text-xs ${planeFilter === key ? "opacity-80" : "text-slate-400"}`}>
                  {key === "all" ? planeCounts.all : planeCounts[key as Plane]}
                </span>
              </button>
            ))}
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 bg-white outline-none focus:ring-2 focus:ring-teal-500">
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, role…" className="flex-1 min-w-40 px-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white outline-none focus:ring-2 focus:ring-teal-500" />
        </div>

        {/* Add User Form */}
        {showAddForm && canManage && (
          <div className="p-5 border-b border-slate-100 bg-teal-50/30">
            <h3 className="text-sm font-bold text-slate-700 mb-3">New User</h3>
            <form onSubmit={handleAddUser} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div><label className="block text-xs font-semibold text-slate-500 mb-1">Full Name</label><input required value={addForm.fullName} onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Jane Doe" /></div>
                <div><label className="block text-xs font-semibold text-slate-500 mb-1">Email</label><input required type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none" placeholder="jane@example.com" /></div>
                <div><label className="block text-xs font-semibold text-slate-500 mb-1">Password</label><input required type="password" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Min 8 characters" minLength={8} /></div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Role</label>
                  <select value={addForm.roleCode} onChange={(e) => setAddForm({ ...addForm, roleCode: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                    <optgroup label="Admin / CMS">{["owner","admin","admin_manager","admin_editor","advisor","viewer"].map((r) => <option key={r} value={r}>{r}</option>)}</optgroup>
                    <optgroup label="Provider Management">{["operator","coordinator"].map((r) => <option key={r} value={r}>{r}</option>)}</optgroup>
                    <optgroup label="Provider Portal">{["hospital_admin","doctor","receptionist"].map((r) => <option key={r} value={r}>{r}</option>)}</optgroup>
                  </select>
                  {addForm.roleCode && ROLE_PLANE[addForm.roleCode] && <p className="text-xs mt-1 text-slate-400">Plane: <span className="font-medium">{PLANE_LABELS[ROLE_PLANE[addForm.roleCode]]}</span></p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Entity Type</label>
                  <select value={addForm.entityType} onChange={(e) => setAddForm({ ...addForm, entityType: e.target.value, entityId: "" })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                    <option value="">None</option><option value="hospital">Hospital</option><option value="doctor">Doctor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Linked {addForm.entityType === "hospital" ? "Hospital" : addForm.entityType === "doctor" ? "Doctor" : "Entity"}</label>
                  {addForm.entityType ? (
                    <select value={addForm.entityId} onChange={(e) => setAddForm({ ...addForm, entityId: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                      <option value="">— select —</option>
                      {(addForm.entityType === "hospital" ? hospitalOptions : doctorOptions).map((opt) => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                    </select>
                  ) : <input disabled value="" placeholder="Select entity type first" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-400 outline-none" />}
                </div>
              </div>
              {addMsg && <div className={`p-2.5 rounded-xl text-xs border ${addMsg.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>{addMsg.text}</div>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={addBusy} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl disabled:opacity-60">{addBusy ? "Creating..." : "Create User"}</button>
                <button type="button" onClick={() => { setShowAddForm(false); setAddMsg(null); }} className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Users Table */}
        {usersLoading ? <div className="p-8 text-center text-slate-400 text-sm">Loading users...</div>
          : usersError ? <div className="p-5 text-red-600 text-sm">{usersError}</div>
          : filteredUsers.length === 0 ? <div className="p-8 text-center text-slate-400 text-sm">{users.length === 0 ? "No users found." : "No users match the current filters."}</div>
          : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40">
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Email</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Role / Plane</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Linked Entity</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                  {canManage && <th className="text-center px-4 py-3 font-semibold text-slate-600">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <React.Fragment key={user.id}>
                    <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-medium text-slate-800">{user.fullName}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{user.email}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleBadgeColor(user.role)}`}>{user.role}</span>
                          {ROLE_PLANE[user.role] && <span className={`text-[11px] font-medium ${PLANE_COLORS[ROLE_PLANE[user.role]].split(" ")[1]}`}>{PLANE_LABELS[ROLE_PLANE[user.role]]}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{user.entityName ? <span className="text-xs"><span className="text-slate-400 mr-1">{user.entityType}:</span>{user.entityName}</span> : <span className="text-slate-300 text-xs">—</span>}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${user.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>{user.isActive ? "Active" : "Inactive"}</span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => editingId === user.id ? setEditingId(null) : startEdit(user)} className="px-3 py-1.5 text-xs font-semibold text-teal-600 border border-teal-200 hover:bg-teal-50 rounded-lg">{editingId === user.id ? "Close" : "Edit"}</button>
                            {me.role === "owner" && <button onClick={() => handleDeleteUser(user.id)} disabled={deletingId === user.id} className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 rounded-lg disabled:opacity-50">{deletingId === user.id ? "..." : "Delete"}</button>}
                          </div>
                        </td>
                      )}
                    </tr>
                    {editingId === user.id && canManage && (
                      <tr className="border-b border-teal-100 bg-teal-50/20">
                        <td colSpan={canManage ? 6 : 5} className="px-5 py-4">
                          <form onSubmit={handleEditUser} className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div><label className="block text-xs font-semibold text-slate-500 mb-1">Full Name</label><input required value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none" /></div>
                              <div><label className="block text-xs font-semibold text-slate-500 mb-1">Email</label><input required type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none" /></div>
                              <div><label className="block text-xs font-semibold text-slate-500 mb-1">New Password <span className="font-normal text-slate-400">(optional)</span></label><input type="password" value={editForm.password ?? ""} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Leave blank to keep" minLength={8} /></div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Role</label>
                                <select value={editForm.roleCode} onChange={(e) => setEditForm({ ...editForm, roleCode: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                                  <optgroup label="Admin / CMS">{["owner","admin","admin_manager","admin_editor","advisor","viewer"].map((r) => <option key={r} value={r}>{r}</option>)}</optgroup>
                                  <optgroup label="Provider Management">{["operator","coordinator"].map((r) => <option key={r} value={r}>{r}</option>)}</optgroup>
                                  <optgroup label="Provider Portal">{["hospital_admin","doctor","receptionist"].map((r) => <option key={r} value={r}>{r}</option>)}</optgroup>
                                </select>
                                {editForm.roleCode && ROLE_PLANE[editForm.roleCode] && <p className="text-xs mt-1 text-slate-400">Plane: <span className="font-medium">{PLANE_LABELS[ROLE_PLANE[editForm.roleCode]]}</span></p>}
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Entity Type</label>
                                <select value={editForm.entityType} onChange={(e) => setEditForm({ ...editForm, entityType: e.target.value, entityId: "" })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                                  <option value="">None</option><option value="hospital">Hospital</option><option value="doctor">Doctor</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Linked {editForm.entityType === "hospital" ? "Hospital" : editForm.entityType === "doctor" ? "Doctor" : "Entity"}</label>
                                {editForm.entityType ? (
                                  <select value={editForm.entityId} onChange={(e) => setEditForm({ ...editForm, entityId: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                                    <option value="">— select —</option>
                                    {(editForm.entityType === "hospital" ? hospitalOptions : doctorOptions).map((opt) => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                  </select>
                                ) : <input disabled value="" placeholder="No entity required" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-400 outline-none" />}
                              </div>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                              <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} className="rounded" />
                              Active
                            </label>
                            {editMsg && <div className={`p-2.5 rounded-xl text-xs border ${editMsg.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>{editMsg.text}</div>}
                            <div className="flex gap-2">
                              <button type="submit" disabled={editBusy} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl disabled:opacity-60">{editBusy ? "Saving..." : "Save Changes"}</button>
                              <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl">Cancel</button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
