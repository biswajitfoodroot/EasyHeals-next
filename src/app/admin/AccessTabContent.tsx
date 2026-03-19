"use client";

import React, { useState, useEffect, FormEvent } from "react";

type Me = { role: string };

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  isActive: boolean;
  createdAt: string | null;
};

type EntityOption = { id: string; name: string };

type Props = {
  me: Me;
};

const ROLE_OPTIONS = ["owner", "admin", "admin_manager", "admin_editor", "advisor", "viewer", "hospital_admin", "doctor", "receptionist"];

const ACCESS_MATRIX: {
  role: string;
  hospitalsCrud: string;
  doctorsCrud: string;
  aiResearch: string;
  brochure: string;
  userManagement: string;
  portalAccess: string;
}[] = [
  {
    role: "owner",
    hospitalsCrud: "✅ Full",
    doctorsCrud: "✅ Full",
    aiResearch: "✅ Full",
    brochure: "✅ Full",
    userManagement: "✅ Full",
    portalAccess: "❌ None",
  },
  {
    role: "admin",
    hospitalsCrud: "✅ Full",
    doctorsCrud: "✅ Full",
    aiResearch: "✅ Full",
    brochure: "✅ Full",
    userManagement: "⚠️ Limited",
    portalAccess: "❌ None",
  },
  {
    role: "advisor",
    hospitalsCrud: "⚠️ Limited",
    doctorsCrud: "⚠️ Limited",
    aiResearch: "✅ Full",
    brochure: "✅ Full",
    userManagement: "❌ None",
    portalAccess: "❌ None",
  },
  {
    role: "viewer",
    hospitalsCrud: "❌ None",
    doctorsCrud: "❌ None",
    aiResearch: "❌ None",
    brochure: "❌ None",
    userManagement: "❌ None",
    portalAccess: "❌ None",
  },
  {
    role: "hospital_admin",
    hospitalsCrud: "⚠️ Limited",
    doctorsCrud: "❌ None",
    aiResearch: "❌ None",
    brochure: "❌ None",
    userManagement: "❌ None",
    portalAccess: "✅ Full",
  },
  {
    role: "doctor",
    hospitalsCrud: "❌ None",
    doctorsCrud: "⚠️ Limited",
    aiResearch: "❌ None",
    brochure: "❌ None",
    userManagement: "❌ None",
    portalAccess: "✅ Full",
  },
];

const EMPTY_FORM = {
  fullName: "",
  email: "",
  password: "",
  roleCode: "viewer",
  entityType: "",
  entityId: "",
  isActive: true,
};

export default function AccessTabContent({ me }: Props) {
  const canManage = me.role === "owner" || me.role === "admin" || me.role === "admin_manager";

  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Entity lists for searchable dropdowns
  const [hospitalOptions, setHospitalOptions] = useState<EntityOption[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<EntityOption[]>([]);
  const [entitySearch, setEntitySearch] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
  const [addBusy, setAddBusy] = useState(false);
  const [addMsg, setAddMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Omit<typeof EMPTY_FORM, "password"> & { password?: string }>({ ...EMPTY_FORM });
  const [editBusy, setEditBusy] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadUsers() {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setUsersError(json.error ?? "Failed to load users");
        return;
      }
      const json = await res.json() as { data: UserRow[] };
      setUsers(json.data);
    } catch {
      setUsersError("Network error");
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
    void loadEntityOptions();
  }, []);

  async function loadEntityOptions() {
    try {
      const [hRes, dRes] = await Promise.all([
        fetch("/api/hospitals?limit=500&fields=id,name"),
        fetch("/api/admin/users?entityOptionsOnly=1"),
      ]);
      if (hRes.ok) {
        const hJson = await hRes.json() as { data?: { id: string; name: string }[] };
        setHospitalOptions((hJson.data ?? []).map((h) => ({ id: h.id, name: h.name })));
      }
      if (dRes.ok) {
        const dJson = await dRes.json() as { doctors?: { id: string; fullName: string }[] };
        setDoctorOptions((dJson.doctors ?? []).map((d) => ({ id: d.id, name: d.fullName })));
      }
    } catch { /* non-fatal */ }
  }

  async function handleAddUser(e: FormEvent) {
    e.preventDefault();
    setAddBusy(true);
    setAddMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: addForm.fullName,
          email: addForm.email,
          password: addForm.password,
          roleCode: addForm.roleCode,
          entityType: addForm.entityType || null,
          entityId: addForm.entityId || null,
        }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setAddMsg({ type: "error", text: json.error ?? "Failed to create user" });
      } else {
        setAddMsg({ type: "success", text: "User created successfully!" });
        setAddForm({ ...EMPTY_FORM });
        setShowAddForm(false);
        void loadUsers();
      }
    } catch {
      setAddMsg({ type: "error", text: "Network error" });
    } finally {
      setAddBusy(false);
    }
  }

  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setEditForm({
      fullName: user.fullName,
      email: user.email,
      password: "",
      roleCode: user.role,
      entityType: user.entityType ?? "",
      entityId: user.entityId ?? "",
      isActive: user.isActive,
    });
    setEditMsg(null);
  }

  async function handleEditUser(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditBusy(true);
    setEditMsg(null);
    try {
      const payload: Record<string, unknown> = {
        fullName: editForm.fullName,
        email: editForm.email,
        roleCode: editForm.roleCode,
        entityType: editForm.entityType || null,
        entityId: editForm.entityId || null,
        isActive: editForm.isActive,
      };
      if (editForm.password) payload.password = editForm.password;

      const res = await fetch(`/api/admin/users/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setEditMsg({ type: "error", text: json.error ?? "Failed to update user" });
      } else {
        setEditMsg({ type: "success", text: "User updated!" });
        setEditingId(null);
        void loadUsers();
      }
    } catch {
      setEditMsg({ type: "error", text: "Network error" });
    } finally {
      setEditBusy(false);
    }
  }

  async function handleDeleteUser(id: string) {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        void loadUsers();
      } else {
        const json = await res.json() as { error?: string };
        alert(json.error ?? "Failed to delete user");
      }
    } catch {
      alert("Network error");
    } finally {
      setDeletingId(null);
    }
  }

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case "owner": return "bg-purple-100 text-purple-700 border-purple-200";
      case "admin": return "bg-teal-100 text-teal-700 border-teal-200";
      case "advisor": return "bg-blue-100 text-blue-700 border-blue-200";
      case "viewer": return "bg-slate-100 text-slate-600 border-slate-200";
      case "hospital_admin": return "bg-amber-100 text-amber-700 border-amber-200";
      case "doctor": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default: return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* ── ACCESS MATRIX ───────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/60">
          <h2 className="text-xl font-bold text-slate-800">Access Matrix</h2>
          <p className="text-slate-500 text-sm mt-0.5">Permissions granted to each role across the system.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/40">
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Role</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Hospitals CRUD</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Doctors CRUD</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">AI Research</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Brochure</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">User Mgmt</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Portal Access</th>
              </tr>
            </thead>
            <tbody>
              {ACCESS_MATRIX.map((row, i) => (
                <tr key={row.role} className={`border-b border-slate-50 ${i % 2 === 1 ? "bg-slate-50/30" : ""}`}>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleBadgeColor(row.role)}`}>
                      {row.role}
                    </span>
                  </td>
                  <td className="text-center px-4 py-3 text-xs">{row.hospitalsCrud}</td>
                  <td className="text-center px-4 py-3 text-xs">{row.doctorsCrud}</td>
                  <td className="text-center px-4 py-3 text-xs">{row.aiResearch}</td>
                  <td className="text-center px-4 py-3 text-xs">{row.brochure}</td>
                  <td className="text-center px-4 py-3 text-xs">{row.userManagement}</td>
                  <td className="text-center px-4 py-3 text-xs">{row.portalAccess}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── USERS ───────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex justify-between items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Users</h2>
            <p className="text-slate-500 text-sm mt-0.5">Manage all user accounts and their access.</p>
          </div>
          {canManage && (
            <button
              onClick={() => { setShowAddForm(!showAddForm); setAddMsg(null); }}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span className="text-base leading-none">+</span> Add User
            </button>
          )}
        </div>

        {/* Add User Form */}
        {showAddForm && canManage && (
          <div className="p-5 border-b border-slate-100 bg-teal-50/30">
            <h3 className="text-sm font-bold text-slate-700 mb-3">New User</h3>
            <form onSubmit={handleAddUser} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Full Name</label>
                  <input
                    required
                    value={addForm.fullName}
                    onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                  <input
                    required
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="jane@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Password</label>
                  <input
                    required
                    type="password"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="Min 8 characters"
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Role</label>
                  <select
                    value={addForm.roleCode}
                    onChange={(e) => setAddForm({ ...addForm, roleCode: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Entity Type</label>
                  <select
                    value={addForm.entityType}
                    onChange={(e) => setAddForm({ ...addForm, entityType: e.target.value, entityId: "" })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  >
                    <option value="">None</option>
                    <option value="hospital">Hospital</option>
                    <option value="doctor">Doctor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Linked {addForm.entityType === "hospital" ? "Hospital" : addForm.entityType === "doctor" ? "Doctor" : "Entity"}
                  </label>
                  {addForm.entityType ? (
                    <select
                      value={addForm.entityId}
                      onChange={(e) => setAddForm({ ...addForm, entityId: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    >
                      <option value="">— select —</option>
                      {(addForm.entityType === "hospital" ? hospitalOptions : doctorOptions).map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input disabled value="" placeholder="Select entity type first" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-400 outline-none" />
                  )}
                </div>
              </div>

              {addMsg && (
                <div className={`p-2.5 rounded-xl text-xs border ${addMsg.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                  {addMsg.text}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={addBusy}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
                >
                  {addBusy ? "Creating..." : "Create User"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setAddMsg(null); }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users Table */}
        {usersLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading users...</div>
        ) : usersError ? (
          <div className="p-5 text-red-600 text-sm">{usersError}</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40">
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Email</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Linked Entity</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                  {canManage && <th className="text-center px-4 py-3 font-semibold text-slate-600">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <React.Fragment key={user.id}>
                    <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-medium text-slate-800">{user.fullName}</td>
                      <td className="px-4 py-3 text-slate-500">{user.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleBadgeColor(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {user.entityName ? (
                          <span className="text-xs">
                            <span className="text-slate-400 mr-1">{user.entityType}:</span>
                            {user.entityName}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${user.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => editingId === user.id ? setEditingId(null) : startEdit(user)}
                              className="px-3 py-1.5 text-xs font-semibold text-teal-600 border border-teal-200 hover:bg-teal-50 rounded-lg transition-colors"
                            >
                              {editingId === user.id ? "Close" : "Edit"}
                            </button>
                            {me.role === "owner" && (
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                disabled={deletingId === user.id}
                                className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {deletingId === user.id ? "..." : "Delete"}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                    {/* Inline Edit Row */}
                    {editingId === user.id && canManage && (
                      <tr className="border-b border-teal-100 bg-teal-50/20">
                        <td colSpan={canManage ? 6 : 5} className="px-5 py-4">
                          <form onSubmit={handleEditUser} className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Full Name</label>
                                <input
                                  required
                                  value={editForm.fullName}
                                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                                <input
                                  required
                                  type="email"
                                  value={editForm.email}
                                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">New Password <span className="font-normal text-slate-400">(optional)</span></label>
                                <input
                                  type="password"
                                  value={editForm.password ?? ""}
                                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                  placeholder="Leave blank to keep"
                                  minLength={8}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Role</label>
                                <select
                                  value={editForm.roleCode}
                                  onChange={(e) => setEditForm({ ...editForm, roleCode: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                >
                                  {ROLE_OPTIONS.map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Entity Type</label>
                                <select
                                  value={editForm.entityType}
                                  onChange={(e) => setEditForm({ ...editForm, entityType: e.target.value, entityId: "" })}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                >
                                  <option value="">None</option>
                                  <option value="hospital">Hospital</option>
                                  <option value="doctor">Doctor</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">
                                  Linked {editForm.entityType === "hospital" ? "Hospital" : editForm.entityType === "doctor" ? "Doctor" : "Entity"}
                                </label>
                                {editForm.entityType ? (
                                  <select
                                    value={editForm.entityId}
                                    onChange={(e) => setEditForm({ ...editForm, entityId: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                  >
                                    <option value="">— select —</option>
                                    {(editForm.entityType === "hospital" ? hospitalOptions : doctorOptions).map((opt) => (
                                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input disabled value="" placeholder="Select entity type first" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-400 outline-none" />
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editForm.isActive}
                                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                                  className="rounded"
                                />
                                Active
                              </label>
                            </div>

                            {editMsg && (
                              <div className={`p-2.5 rounded-xl text-xs border ${editMsg.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                                {editMsg.text}
                              </div>
                            )}

                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={editBusy}
                                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
                              >
                                {editBusy ? "Saving..." : "Save Changes"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl transition-colors"
                              >
                                Cancel
                              </button>
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

