"use client";

import { useState } from "react";

type Perms = {
  id: string;
  userId: string;
  canViewKpis: boolean | null;
  canViewProviders: boolean | null;
  canEditProviders: boolean | null;
  canViewAgreements: boolean | null;
  canEditAgreements: boolean | null;
  canViewKyc: boolean | null;
  canApproveKyc: boolean | null;
  canViewUsers: boolean | null;
  canManageUsers: boolean | null;
  notes: string | null;
};

type Coordinator = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean | null;
  createdAt: string | null;
  permissions: Perms;
};

type UserOption = { id: string; fullName: string; email: string };

const PERM_FLAGS: { key: keyof Omit<Perms, "id" | "userId" | "notes">; label: string; description: string }[] = [
  { key: "canViewKpis",        label: "View Dashboard KPIs",     description: "Access to PM dashboard overview" },
  { key: "canViewProviders",   label: "View Providers",          description: "See provider list and details" },
  { key: "canEditProviders",   label: "Edit Providers",          description: "Update provider info and status" },
  { key: "canViewAgreements",  label: "View Agreements",         description: "See agreement details and status" },
  { key: "canEditAgreements",  label: "Edit Agreements",         description: "Create/update agreements" },
  { key: "canViewKyc",         label: "View KYC",                description: "See KYC pipeline" },
  { key: "canApproveKyc",      label: "Approve KYC",             description: "Approve or reject KYC requests" },
  { key: "canViewUsers",       label: "View Users",              description: "See user list" },
  { key: "canManageUsers",     label: "Manage Users",            description: "Create and edit users" },
];

function PermRow({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0 cursor-pointer">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <button type="button" onClick={() => onChange(!value)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors mt-0.5 ${value ? "bg-indigo-600" : "bg-slate-200"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </label>
  );
}

export default function CoordinatorsClient({ coordinators: initial, allUsers }: {
  coordinators: Coordinator[];
  allUsers: UserOption[];
}) {
  const [coordinators, setCoordinators] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<Partial<Perms>>({});
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // New coordinator form
  const [showAdd, setShowAdd] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [adding, setAdding] = useState(false);

  const existingIds = new Set(coordinators.map(c => c.id));
  const availableUsers = allUsers.filter(u => !existingIds.has(u.id));

  function startEdit(coord: Coordinator) {
    setEditingId(coord.id);
    setEditPerms({ ...coord.permissions });
    setEditNotes(coord.permissions.notes ?? "");
  }

  async function handleSave(userId: string) {
    setSaving(true);
    try {
      await fetch("/api/provider-management/coordinators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...editPerms, notes: editNotes }),
      });
      setEditingId(null);
      // Refresh
      const res = await fetch("/api/provider-management/coordinators");
      if (res.ok) {
        const { data } = await res.json() as { data: (UserOption & { permissions: Perms | null; isActive: boolean | null; createdAt: string | null})[] };
        setCoordinators(data.filter(u => u.permissions !== null) as Coordinator[]);
      }
    } finally { setSaving(false); }
  }

  async function handleAdd() {
    if (!selectedUserId) return;
    setAdding(true);
    try {
      await fetch("/api/provider-management/coordinators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      setShowAdd(false);
      setSelectedUserId("");
      const res = await fetch("/api/provider-management/coordinators");
      if (res.ok) {
        const { data } = await res.json() as { data: (UserOption & { permissions: Perms | null; isActive: boolean | null; createdAt: string | null})[] };
        setCoordinators(data.filter(u => u.permissions !== null) as Coordinator[]);
      }
    } finally { setAdding(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition">
          + Assign Coordinator
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Select User</label>
            <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="">— choose user —</option>
              {availableUsers.map(u => (
                <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
              ))}
            </select>
          </div>
          <button type="button" disabled={!selectedUserId || adding} onClick={handleAdd}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60">
            {adding ? "Assigning..." : "Assign"}
          </button>
          <button type="button" onClick={() => setShowAdd(false)}
            className="px-4 py-2 border border-slate-200 text-sm text-slate-600 rounded-xl">Cancel</button>
        </div>
      )}

      {coordinators.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm">No coordinators assigned yet.</p>
          <p className="text-xs text-slate-300 mt-1">Use "Assign Coordinator" to configure access for a user.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {coordinators.map(coord => (
            <div key={coord.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
                <div>
                  <p className="font-semibold text-slate-800">{coord.fullName}</p>
                  <p className="text-xs text-slate-400">{coord.email}</p>
                </div>
                <button type="button"
                  onClick={() => editingId === coord.id ? setEditingId(null) : startEdit(coord)}
                  className="text-xs font-semibold text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50">
                  {editingId === coord.id ? "Cancel" : "Edit Permissions"}
                </button>
              </div>

              {editingId !== coord.id ? (
                /* Read-only permission summary */
                <div className="px-5 py-3 flex flex-wrap gap-2">
                  {PERM_FLAGS.map(f => {
                    const val = coord.permissions[f.key] as boolean | null;
                    if (!val) return null;
                    return (
                      <span key={f.key} className="text-xs font-medium px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                        {f.label}
                      </span>
                    );
                  })}
                  {PERM_FLAGS.every(f => !coord.permissions[f.key]) && (
                    <span className="text-xs text-slate-400">No permissions assigned</span>
                  )}
                  {coord.permissions.notes && (
                    <span className="text-xs text-slate-400 w-full mt-1">Note: {coord.permissions.notes}</span>
                  )}
                </div>
              ) : (
                /* Edit mode */
                <div className="px-5 py-4 space-y-1">
                  {PERM_FLAGS.map(f => (
                    <PermRow
                      key={f.key}
                      label={f.label}
                      description={f.description}
                      value={!!(editPerms as Record<string, boolean | null>)[f.key]}
                      onChange={v => setEditPerms(p => ({ ...p, [f.key]: v }))}
                    />
                  ))}
                  <div className="pt-3">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Admin Notes</label>
                    <input value={editNotes} onChange={e => setEditNotes(e.target.value)}
                      placeholder="Optional notes about this coordinator's access..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                  <div className="pt-3">
                    <button type="button" disabled={saving} onClick={() => handleSave(coord.id)}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60">
                      {saving ? "Saving..." : "Save Permissions"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
