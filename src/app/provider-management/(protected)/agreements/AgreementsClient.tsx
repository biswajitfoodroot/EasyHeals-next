"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Agreement = {
  id: string;
  status: string;
  agreementType: string;
  tierCode?: string | null;
  entityType: string;
  termsVersion: string;
  providerName: string;
  hospitalId?: string | null;
  doctorId?: string | null;
  publishedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectionReason?: string | null;
  expiresAt: string | null;
  createdAt: string | null;
};

type Props = {
  agreements: Agreement[];
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  draft:       { label: "Draft",       cls: "bg-slate-100 text-slate-500 border-slate-200" },
  published:   { label: "Published",   cls: "bg-blue-50 text-blue-600 border-blue-200" },
  accepted:    { label: "Accepted",    cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected:    { label: "Rejected",    cls: "bg-red-50 text-red-600 border-red-200" },
  expired:     { label: "Expired",     cls: "bg-orange-50 text-orange-600 border-orange-200" },
  terminated:  { label: "Terminated",  cls: "bg-slate-100 text-slate-400 border-slate-200" },
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AgreementsClient({ agreements: initial }: Props) {
  const router = useRouter();
  const [agreements, setAgreements] = useState(initial);
  const [filter, setFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const filtered = filter === "all" ? agreements : agreements.filter(a => a.status === filter);

  async function publishAgreement(id: string) {
    if (!confirm("Publish this agreement? The provider will be notified and can accept or reject.")) return;
    setActionLoading(id);
    const res = await fetch(`/api/v1/agreements/${id}/publish`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      setAgreements(prev => prev.map(a => a.id === id ? { ...a, status: "published", publishedAt: new Date() } : a));
    }
    setActionLoading(null);
  }

  async function terminateAgreement(id: string) {
    const reason = prompt("Reason for termination (optional):");
    setActionLoading(id);
    const res = await fetch(`/api/v1/agreements/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "terminated", notes: reason ?? undefined }),
    });
    if (res.ok) {
      setAgreements(prev => prev.map(a => a.id === id ? { ...a, status: "terminated" } : a));
    }
    setActionLoading(null);
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Provider Agreements</h1>
          <p className="text-sm text-slate-400">
            {agreements.filter(a => a.status === "accepted").length} active ·{" "}
            {agreements.filter(a => a.status === "published").length} awaiting acceptance ·{" "}
            {agreements.filter(a => a.status === "draft").length} drafts
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition"
        >
          + New Agreement
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200 shadow-sm w-fit">
        {["all", "draft", "published", "accepted", "rejected"].map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
              filter === f ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}
          >
            {f}
            {f !== "all" && (
              <span className={`ml-1.5 ${filter === f ? "text-indigo-200" : "text-slate-400"}`}>
                {agreements.filter(a => a.status === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-slate-500 font-semibold">No agreements found</p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-3 text-sm font-semibold text-indigo-600 hover:underline"
            >
              Create first agreement →
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Provider</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Published</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Accepted</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(a => {
                const cfg = STATUS_CFG[a.status] ?? STATUS_CFG.draft;
                const isLoading = actionLoading === a.id;
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{a.providerName}</p>
                      <p className="text-xs text-slate-400 capitalize">{a.entityType}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                      {a.status === "rejected" && a.rejectionReason && (
                        <p className="text-[10px] text-red-400 mt-0.5 max-w-xs truncate">{a.rejectionReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 capitalize hidden sm:table-cell">
                      {a.agreementType.replace(/_/g, " ")}
                      {a.tierCode && <span className="ml-1 text-xs text-indigo-500">({a.tierCode})</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">
                      {fmtDate(a.publishedAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                      {fmtDate(a.acceptedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {a.status === "draft" && (
                          <button
                            type="button"
                            onClick={() => void publishAgreement(a.id)}
                            disabled={isLoading}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50"
                          >
                            {isLoading ? "..." : "Publish"}
                          </button>
                        )}
                        {["accepted", "published"].includes(a.status) && (
                          <button
                            type="button"
                            onClick={() => void terminateAgreement(a.id)}
                            disabled={isLoading}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition disabled:opacity-50"
                          >
                            {isLoading ? "..." : "Terminate"}
                          </button>
                        )}
                        <a
                          href={`/provider-management/agreements/${a.id}`}
                          className="text-xs font-semibold text-indigo-600 hover:underline"
                        >
                          View →
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateAgreementModal
          onClose={() => setShowCreate(false)}
          onCreated={(a) => {
            setAgreements(prev => [{ ...a, publishedAt: null, acceptedAt: null, rejectedAt: null, expiresAt: null, createdAt: new Date() }, ...prev]);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

// ── Create Agreement Modal ─────────────────────────────────────────────────────

function CreateAgreementModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (a: Agreement) => void;
}) {
  const [form, setForm] = useState({
    entityType: "hospital",
    entityId: "",
    agreementType: "network_partnership",
    tierCode: "partner",
    termsVersion: "v1",
    customTerms: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!form.entityId.trim()) {
      setError("Hospital / Doctor ID is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        entityType: form.entityType,
        ...(form.entityType === "hospital" ? { hospitalId: form.entityId } : { doctorId: form.entityId }),
        agreementType: form.agreementType,
        tierCode: form.tierCode || undefined,
        termsVersion: form.termsVersion,
        customTerms: form.customTerms || undefined,
        notes: form.notes || undefined,
      };
      const res = await fetch("/api/v1/agreements", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Failed to create");
        return;
      }
      const { data } = await res.json() as { data: Agreement };
      onCreated(data);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="flex-1 text-base font-bold text-slate-800">New Agreement Draft</h2>
          <button type="button" onClick={onClose} className="text-slate-400 text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">×</button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Provider Type</span>
            <select
              value={form.entityType}
              onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))}
              className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            >
              <option value="hospital">Hospital</option>
              <option value="doctor">Doctor (Solo)</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">
              {form.entityType === "hospital" ? "Hospital ID" : "Doctor ID"}
            </span>
            <input
              type="text"
              value={form.entityId}
              onChange={e => setForm(f => ({ ...f, entityId: e.target.value }))}
              placeholder="UUID from the database"
              className="mt-1 w-full text-sm font-mono border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Agreement Type</span>
              <select
                value={form.agreementType}
                onChange={e => setForm(f => ({ ...f, agreementType: e.target.value }))}
                className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              >
                <option value="network_partnership">Network Partnership</option>
                <option value="referral_only">Referral Only</option>
                <option value="destination_only">Destination Only</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Tier</span>
              <select
                value={form.tierCode}
                onChange={e => setForm(f => ({ ...f, tierCode: e.target.value }))}
                className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              >
                <option value="basic">Basic</option>
                <option value="partner">Partner</option>
                <option value="premium">Premium</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">Custom Terms (optional)</span>
            <textarea
              value={form.customTerms}
              onChange={e => setForm(f => ({ ...f, customTerms: e.target.value }))}
              rows={3}
              placeholder="Any custom clauses or overrides for this specific provider..."
              className="mt-1 w-full text-xs border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">Internal Notes (optional)</span>
            <input
              type="text"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Ops-only notes"
              className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </label>
        </div>

        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition">Cancel</button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-40"
          >
            {loading ? "Creating..." : "Create Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
