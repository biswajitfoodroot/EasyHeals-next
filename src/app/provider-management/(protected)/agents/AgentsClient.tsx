"use client";

import { useState, FormEvent } from "react";

type Agent = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  partnerType: string;
  city: string | null;
  state: string | null;
  status: string;
  fraudFlag: boolean | null;
  notes: string | null;
  createdAt: string | null;
  attributionCount: number;
};

const TYPE_COLORS: Record<string, string> = {
  agent:               "bg-indigo-50 text-indigo-700 border-indigo-200",
  broker:              "bg-purple-50 text-purple-700 border-purple-200",
  community_referrer:  "bg-teal-50 text-teal-700 border-teal-200",
};

const STATUS_COLORS: Record<string, string> = {
  active:     "bg-green-50 text-green-700 border-green-200",
  suspended:  "bg-amber-50 text-amber-700 border-amber-200",
  terminated: "bg-red-50 text-red-700 border-red-200",
};

const EMPTY = { fullName: "", phone: "", email: "", partnerType: "agent", city: "", state: "", notes: "" };

export default function AgentsClient({ agents: initial, canManage }: {
  agents: Agent[];
  canManage: boolean;
}) {
  const [agents, setAgents] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Agent>>({});
  const [editSaving, setEditSaving] = useState(false);

  async function reload() {
    const res = await fetch("/api/provider-management/agents");
    if (res.ok) {
      const { data } = await res.json() as { data: Agent[] };
      setAgents(data);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/provider-management/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json() as { error?: string };
      if (!res.ok) { setMsg({ type: "err", text: j.error ?? "Failed" }); return; }
      setMsg({ type: "ok", text: "Agent added." });
      setForm({ ...EMPTY });
      setShowAdd(false);
      await reload();
    } finally { setSaving(false); }
  }

  async function handleEdit(id: string) {
    setEditSaving(true);
    try {
      await fetch(`/api/provider-management/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      setEditingId(null);
      await reload();
    } finally { setEditSaving(false); }
  }

  async function toggleFlag(agent: Agent) {
    await fetch(`/api/provider-management/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fraudFlag: !agent.fraudFlag }),
    });
    await reload();
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Agents", value: agents.length },
          { label: "Active", value: agents.filter(a => a.status === "active").length },
          { label: "Fraud Flagged", value: agents.filter(a => a.fraudFlag).length },
          { label: "Total Attributions", value: agents.reduce((s, a) => s + a.attributionCount, 0) },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="text-2xl font-bold text-slate-800">{c.value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Add button + form */}
      {canManage && (
        <div>
          {!showAdd ? (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition"
            >
              + Add Agent
            </button>
          ) : (
            <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-700">New Field Agent / Partner</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { key: "fullName", label: "Full Name *", placeholder: "Ramesh Kumar" },
                  { key: "phone", label: "Phone", placeholder: "+91 98765 43210" },
                  { key: "email", label: "Email", placeholder: "agent@example.com" },
                  { key: "city", label: "City", placeholder: "Patna" },
                  { key: "state", label: "State", placeholder: "Bihar" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{f.label}</label>
                    <input
                      value={(form as Record<string, string>)[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      required={f.key === "fullName"}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Partner Type</label>
                  <select value={form.partnerType} onChange={e => setForm(p => ({ ...p, partnerType: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                    <option value="agent">Agent</option>
                    <option value="broker">Broker</option>
                    <option value="community_referrer">Community Referrer</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any notes about this partner..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              {msg && (
                <p className={`text-xs px-3 py-2 rounded-lg border ${msg.type === "ok" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>{msg.text}</p>
              )}
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60">
                  {saving ? "Adding..." : "Add Agent"}
                </button>
                <button type="button" onClick={() => { setShowAdd(false); setMsg(null); }}
                  className="px-4 py-2 border border-slate-200 text-sm text-slate-600 rounded-xl hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {agents.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400 text-sm">No field agents registered yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Agent</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Type / Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Attributions</th>
                {canManage && <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agents.map(agent => (
                <>
                  <tr key={agent.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{agent.fullName}</p>
                      <p className="text-xs text-slate-400">{agent.phone ?? "—"}{agent.email ? ` · ${agent.email}` : ""}</p>
                      {agent.fraudFlag && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">FRAUD FLAG</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${TYPE_COLORS[agent.partnerType] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
                        {agent.partnerType.replace("_", " ")}
                      </span>
                      <p className="text-xs text-slate-400 mt-1">{[agent.city, agent.state].filter(Boolean).join(", ") || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[agent.status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
                        {agent.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-indigo-600">{agent.attributionCount}</span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button type="button"
                            onClick={() => { setEditingId(editingId === agent.id ? null : agent.id); setEditForm({ status: agent.status, notes: agent.notes ?? "" }); }}
                            className="text-xs font-semibold text-indigo-600 hover:underline">
                            {editingId === agent.id ? "Cancel" : "Edit"}
                          </button>
                          <button type="button" onClick={() => toggleFlag(agent)}
                            className={`text-xs font-semibold ${agent.fraudFlag ? "text-slate-400 hover:text-red-600" : "text-slate-400 hover:text-red-600"} hover:underline`}>
                            {agent.fraudFlag ? "Clear Flag" : "Flag"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                  {editingId === agent.id && (
                    <tr key={`edit-${agent.id}`} className="bg-indigo-50/30">
                      <td colSpan={canManage ? 5 : 4} className="px-4 py-3">
                        <div className="flex flex-wrap gap-3 items-end">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                            <select value={editForm.status ?? ""} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                              <option value="active">Active</option>
                              <option value="suspended">Suspended</option>
                              <option value="terminated">Terminated</option>
                            </select>
                          </div>
                          <div className="flex-1 min-w-48">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
                            <input value={(editForm.notes as string) ?? ""} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                          </div>
                          <button type="button" disabled={editSaving} onClick={() => handleEdit(agent.id)}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60">
                            {editSaving ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
