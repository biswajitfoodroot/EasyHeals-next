"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HospitalData = Record<string, unknown>;
type Me = { role: string; userId: string };

type ContribRow = {
  id: string;
  source: "contribution" | "audit";
  when: string;
  actorName: string | null;
  actorAvatar: string | null;
  action: string;
  fieldChanged: string | null;
  oldValue: unknown;
  newValue: unknown;
  outlierScore: number | null;
  outlierFlags: string[];
  status: string;
  rejectReason: string | null;
  changes: unknown;
};

type Tab = "overview" | "edits" | "audit";

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const color =
    score < 30 ? "bg-emerald-100 text-emerald-700" :
    score < 70 ? "bg-amber-100 text-amber-700" :
    "bg-red-100 text-red-700";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${color}`} title="Outlier score">
      {score}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
    applied: "bg-blue-100 text-blue-700",
    "crowd.edit.auto_approve": "bg-emerald-100 text-emerald-700",
    "crowd.edit.pending_review": "bg-amber-100 text-amber-700",
    "crowd.edit.auto_reject": "bg-red-100 text-red-700",
  };
  const label = status.replace("crowd.edit.", "").replace(/_/g, " ");
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold capitalize ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {label}
    </span>
  );
}

function diffDisplay(oldVal: unknown, newVal: unknown, field: string | null) {
  const fmt = (v: unknown) => {
    if (v === null || v === undefined) return <em className="text-slate-400">empty</em>;
    if (typeof v === "object") return <code className="text-xs">{JSON.stringify(v)}</code>;
    return <span>{String(v)}</span>;
  };
  if (!field) return null;
  return (
    <div className="text-xs mt-1 flex items-center gap-1 flex-wrap">
      <span className="font-semibold text-slate-500">{field}:</span>
      <span className="line-through text-red-400">{fmt(oldVal)}</span>
      <span className="text-slate-400">→</span>
      <span className="text-emerald-600 font-medium">{fmt(newVal)}</span>
    </div>
  );
}

function EditHistoryTable({ hospitalId, canAct }: { hospitalId: string; canAct: boolean }) {
  const [rows, setRows] = useState<ContribRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit-log?entityId=${hospitalId}&limit=100`);
      const data = (await res.json()) as { data: ContribRow[] };
      setRows(data.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [hospitalId]);

  async function act(id: string, action: "approve" | "reject") {
    const res = await fetch("/api/admin/contributions/ai-review", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actions: [{ id, action }] }),
    });
    if (res.ok) {
      setToast(`Edit ${action}d.`);
      void load();
      setTimeout(() => setToast(null), 2500);
    }
  }

  if (loading) return <p className="text-sm text-slate-400 py-6 text-center">Loading edit history…</p>;
  if (!rows.length) return <p className="text-sm text-slate-400 py-6 text-center">No edits recorded for this hospital yet.</p>;

  return (
    <div>
      {toast ? (
        <div className="mb-3 px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
          {toast}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400 font-semibold">
              <th className="pb-2 pr-3">When</th>
              <th className="pb-2 pr-3">Who</th>
              <th className="pb-2 pr-3">Change</th>
              <th className="pb-2 pr-3">Risk</th>
              <th className="pb-2 pr-3">Status</th>
              {canAct ? <th className="pb-2">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="py-2 pr-3 whitespace-nowrap text-slate-400 text-xs">
                  {new Date(row.when).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-1.5">
                    {row.actorAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.actorAvatar} alt="" className="w-5 h-5 rounded-full" />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                        {row.actorName?.charAt(0) ?? "?"}
                      </span>
                    )}
                    <span className="text-xs text-slate-600 font-medium truncate max-w-[100px]">
                      {row.actorName ?? "Unknown"}
                    </span>
                  </div>
                </td>
                <td className="py-2 pr-3 max-w-xs">
                  <span className="text-xs font-mono text-slate-700">{row.action}</span>
                  {diffDisplay(row.oldValue, row.newValue, row.fieldChanged)}
                  {row.outlierFlags?.length ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {row.outlierFlags.map((f) => (
                        <span key={f} className="px-1.5 py-0.5 rounded bg-orange-50 border border-orange-200 text-[10px] text-orange-700 font-mono">
                          {f}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </td>
                <td className="py-2 pr-3">
                  <ScoreBadge score={row.outlierScore} />
                </td>
                <td className="py-2 pr-3">
                  <StatusBadge status={row.status} />
                </td>
                {canAct ? (
                  <td className="py-2">
                    {row.status === "pending" && row.source === "contribution" ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => void act(row.id, "approve")}
                          className="px-2 py-1 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={() => void act(row.id, "reject")}
                          className="px-2 py-1 rounded bg-red-500 text-white text-xs font-bold hover:bg-red-600"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OverviewPanel({ hospital, canEdit }: { hospital: HospitalData; canEdit: boolean }) {
  const [form, setForm] = useState<Record<string, string>>({
    phone: String(hospital.phone ?? ""),
    email: String(hospital.email ?? ""),
    website: String(hospital.website ?? ""),
    addressLine1: String(hospital.addressLine1 ?? ""),
    description: String(hospital.description ?? ""),
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/portal/hospital?hospitalId=${String(hospital.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: form.phone || null,
          email: form.email || null,
          website: form.website || null,
          addressLine1: form.addressLine1 || null,
          description: form.description || null,
        }),
      });
      if (res.ok) setMsg({ type: "success", text: "Hospital updated." });
      else {
        const d = (await res.json()) as { error?: string };
        setMsg({ type: "error", text: d.error ?? "Update failed." });
      }
    } finally {
      setBusy(false);
    }
  }

  const fields: { key: string; label: string; type?: string }[] = [
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email", type: "email" },
    { key: "website", label: "Website", type: "url" },
    { key: "addressLine1", label: "Address" },
  ];

  return (
    <div className="space-y-4">
      {/* Status row */}
      <div className="flex flex-wrap gap-3 text-sm">
        {[
          { label: "Type", value: String(hospital.type ?? "hospital") },
          { label: "City", value: String(hospital.city ?? "") },
          { label: "Package", value: String(hospital.packageTier ?? "free") },
          { label: "Status", value: String(hospital.regStatus ?? "active") },
          { label: "Verified", value: hospital.verified ? "✅ Yes" : "❌ No" },
          { label: "Claimed", value: hospital.claimed ? "✅ Yes" : "❌ No" },
        ].map(({ label, value }) => (
          <div key={label} className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-center">
            <p className="text-xs text-slate-400 font-semibold">{label}</p>
            <p className="text-sm font-bold text-slate-700">{value}</p>
          </div>
        ))}
      </div>

      {msg ? (
        <div className={`px-4 py-2 rounded-lg text-sm font-semibold ${msg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg.text}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map(({ key, label, type }) => (
          <div key={key}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
            <input
              type={type ?? "text"}
              value={form[key]}
              disabled={!canEdit}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
            />
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
        <textarea
          rows={3}
          value={form.description}
          disabled={!canEdit}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60 resize-none"
        />
      </div>

      {canEdit ? (
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="px-5 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save Changes"}
        </button>
      ) : null}

      <div className="pt-2 border-t border-slate-100">
        <p className="text-xs text-slate-400">
          Hospital ID: <code className="font-mono">{String(hospital.id)}</code> ·{" "}
          <Link href={`/hospital/${String(hospital.slug)}`} className="text-teal-600 hover:underline" target="_blank">
            View public page →
          </Link>
        </p>
      </div>
    </div>
  );
}

export function HospitalAdminClient({ hospital, me }: { hospital: HospitalData; me: Me }) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const canEdit = me.role === "owner" || me.role === "admin";
  const canAct = me.role === "owner" || me.role === "admin";

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "🏥" },
    { key: "edits", label: "Edit History", icon: "✏️" },
    { key: "audit", label: "Audit Trail", icon: "📋" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
            <Link href="/admin" className="hover:text-teal-600">Admin</Link>
            <span>/</span>
            <Link href="/admin?tab=hospitals" className="hover:text-teal-600">Hospitals</Link>
            <span>/</span>
            <span className="text-slate-600 font-medium">{String(hospital.name)}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{String(hospital.name)}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{String(hospital.city ?? "")} · {String(hospital.type ?? "hospital")}</p>
        </div>
      </div>

      {/* Tab bar */}
      <nav className="flex gap-1 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === t.key
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        {activeTab === "overview" ? (
          <OverviewPanel hospital={hospital} canEdit={canEdit} />
        ) : activeTab === "edits" ? (
          <EditHistoryTable hospitalId={String(hospital.id)} canAct={canAct} />
        ) : (
          <EditHistoryTable hospitalId={String(hospital.id)} canAct={false} />
        )}
      </div>
    </div>
  );
}
