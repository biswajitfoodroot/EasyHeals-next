"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProviderRow {
  id: string;
  name: string;
  type: "hospital" | "doctor";
  city: string | null;
  isActive: boolean;
  isVerified: boolean | null;
  createdAt: string | null;
  phone: string | null;
  networkTierCode: string | null;
  agreementId: string | null;
  agreementType: string | null;
  agreementStatus: string | null;
  acceptedAt: string | null;
}

const TIER_META: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  premium: { label: "Premium Partner",  color: "#7C3AED", bg: "#f5f3ff", border: "#ddd6fe", icon: "⭐" },
  partner: { label: "Verified Partner", color: "#1B8A4A", bg: "#f0fdf4", border: "#bbf7d0", icon: "✅" },
  basic:   { label: "Network Partner",  color: "#0369A1", bg: "#eff6ff", border: "#bfdbfe", icon: "🤝" },
};

function TierBadge({ tierCode }: { tierCode: string }) {
  const meta = TIER_META[tierCode] ?? TIER_META.partner!;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border"
      style={{ color: meta.color, background: meta.bg, borderColor: meta.border }}
    >
      {meta.icon} {meta.label}
    </span>
  );
}

function formatDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Network Modal ─────────────────────────────────────────────────────────────

interface NetworkModalProps {
  provider: ProviderRow;
  onClose: () => void;
  onSaved: () => void;
}

function NetworkModal({ provider, onClose, onSaved }: NetworkModalProps) {
  const [tier, setTier] = useState<"basic" | "partner" | "premium">(
    (provider.networkTierCode as "basic" | "partner" | "premium") ?? "partner"
  );
  const [agreementType, setAgreementType] = useState<"network_partnership" | "referral_only" | "destination_only">(
    (provider.agreementType as "network_partnership" | "referral_only" | "destination_only") ?? "network_partnership"
  );
  const [commissionPercent, setCommissionPercent] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!provider.networkTierCode;

  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/providers/network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: provider.id,
          entityType: provider.type,
          tierCode: tier,
          agreementType,
          notes: notes || undefined,
          commissionPercent: commissionPercent ? parseInt(commissionPercent, 10) : undefined,
        }),
      });
      const j = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(j.error ?? "Failed to save"); return; }
      onSaved();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEditing ? "Update Network Status" : "Add to EasyHeals Network"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{provider.name} · {provider.type}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {/* Tier selector */}
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">Partnership Tier *</p>
          <div className="grid grid-cols-3 gap-2">
            {(["basic", "partner", "premium"] as const).map((t) => {
              const meta = TIER_META[t]!;
              const selected = tier === t;
              return (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className="border-2 rounded-xl p-3 text-center transition"
                  style={selected
                    ? { borderColor: meta.color, background: meta.bg }
                    : { borderColor: "#e2e8f0", background: "#fff" }}
                >
                  <div className="text-xl">{meta.icon}</div>
                  <div className="text-xs font-semibold mt-1" style={{ color: selected ? meta.color : "#64748b" }}>
                    {meta.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Agreement type */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Agreement Type</label>
          <select
            value={agreementType}
            onChange={(e) => setAgreementType(e.target.value as typeof agreementType)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="network_partnership">Network Partnership</option>
            <option value="referral_only">Referral Only</option>
            <option value="destination_only">Destination Only</option>
          </select>
        </div>

        {/* Commission */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Commission % (optional)</label>
          <input
            type="number"
            min={0}
            max={100}
            placeholder="e.g. 10"
            value={commissionPercent}
            onChange={(e) => setCommissionPercent(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Notes (optional)</label>
          <textarea
            rows={2}
            placeholder="Any special terms or notes…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl bg-indigo-600 hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {busy ? "Saving…" : isEditing ? "Update" : "Add to Network"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProvidersManagementClient() {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | "hospital" | "doctor">("all");
  const [networkFilter, setNetworkFilter] = useState<"all" | "yes" | "no">("all");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [modalProvider, setModalProvider] = useState<ProviderRow | null>(null);

  useEffect(() => { void load(); }, [typeFilter, networkFilter]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (networkFilter !== "all") params.set("network", networkFilter);
      const res = await fetch(`/api/admin/providers?${params}`);
      if (res.ok) {
        const j = await res.json() as { data: ProviderRow[] };
        setRows(j.data ?? []);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }

  const visible = search.trim()
    ? rows.filter((r) =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.city ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  const networkCount = rows.filter((r) => r.networkTierCode).length;
  const verifiedCount = rows.filter((r) => r.isVerified).length;

  async function toggleVerify(r: ProviderRow) {
    setUpdatingId(r.id);
    setMsg(null);
    try {
      const endpoint = r.type === "hospital"
        ? `/api/admin/hospitals/${r.id}`
        : `/api/admin/doctors/${r.id}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVerified: !r.isVerified }),
      });
      if (res.ok) {
        setRows((prev) => prev.map((p) => p.id === r.id ? { ...p, isVerified: !r.isVerified } : p));
        setMsg({ text: `${r.name} ${!r.isVerified ? "verified" : "unverified"} successfully.`, ok: true });
      } else {
        setMsg({ text: "Update failed. Check your permissions.", ok: false });
      }
    } catch {
      setMsg({ text: "Network error.", ok: false });
    } finally {
      setUpdatingId(null);
    }
  }

  async function removeFromNetwork(r: ProviderRow) {
    if (!r.agreementId) return;
    if (!confirm(`Remove ${r.name} from EasyHeals Network?`)) return;
    setUpdatingId(r.id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/providers/network", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreementId: r.agreementId }),
      });
      const j = await res.json() as { ok?: boolean; message?: string; error?: string };
      if (res.ok) {
        setRows((prev) => prev.map((p) =>
          p.id === r.id
            ? { ...p, networkTierCode: null, agreementId: null, agreementType: null, agreementStatus: null, acceptedAt: null }
            : p
        ));
        setMsg({ text: j.message ?? "Removed from network.", ok: true });
      } else {
        setMsg({ text: j.error ?? "Failed to remove.", ok: false });
      }
    } catch {
      setMsg({ text: "Network error.", ok: false });
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <>
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Providers</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Hospitals, clinics, diagnostic labs and doctors on EasyHeals
            </p>
          </div>
          {/* Stats pills */}
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">
              {rows.length} total
            </span>
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              ✓ {verifiedCount} verified
            </span>
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200">
              🤝 {networkCount} in network
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search by name or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 w-56"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="all">All Types</option>
            <option value="hospital">Hospitals / Labs</option>
            <option value="doctor">Doctors</option>
          </select>
          <select
            value={networkFilter}
            onChange={(e) => setNetworkFilter(e.target.value as typeof networkFilter)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="all">All Providers</option>
            <option value="yes">In Network Only</option>
            <option value="no">Not in Network</option>
          </select>
        </div>

        {/* Flash message */}
        {msg && (
          <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
            msg.ok
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {msg.text}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">Loading providers…</div>
          ) : visible.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              No providers found{search ? ` for "${search}"` : ""}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">City</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Verified</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">EasyHeals Network</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Since</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 truncate max-w-[160px]">{r.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{r.id.slice(0, 8)}…</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          r.type === "hospital"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}>
                          {r.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">{r.city ?? "—"}</td>
                      <td className="px-4 py-3">
                        {r.isVerified
                          ? <span className="text-xs font-semibold text-green-700">✓ Verified</span>
                          : <span className="text-xs text-amber-600">⏳ Pending</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {r.networkTierCode
                          ? <TierBadge tierCode={r.networkTierCode} />
                          : <span className="text-xs text-slate-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">
                        {formatDate(r.acceptedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Edit profile link */}
                          <Link
                            href={`/provider-management/providers/${r.id}/edit`}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                          >
                            Edit
                          </Link>

                          {/* Verify / Unverify */}
                          <button
                            onClick={() => void toggleVerify(r)}
                            disabled={updatingId === r.id}
                            className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition disabled:opacity-60 ${
                              r.isVerified
                                ? "border-slate-200 text-slate-500 hover:bg-slate-50"
                                : "border-green-200 text-green-700 hover:bg-green-50"
                            }`}
                          >
                            {updatingId === r.id ? "…" : r.isVerified ? "Unverify" : "Verify"}
                          </button>

                          {/* Network buttons */}
                          {r.networkTierCode ? (
                            <>
                              <button
                                onClick={() => setModalProvider(r)}
                                disabled={updatingId === r.id}
                                className="text-xs font-medium px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition disabled:opacity-60"
                              >
                                Edit Tier
                              </button>
                              <button
                                onClick={() => void removeFromNetwork(r)}
                                disabled={updatingId === r.id}
                                className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-60"
                              >
                                Remove
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setModalProvider(r)}
                              disabled={updatingId === r.id}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition disabled:opacity-60"
                            >
                              + Network
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Network modal */}
      {modalProvider && (
        <NetworkModal
          provider={modalProvider}
          onClose={() => setModalProvider(null)}
          onSaved={() => {
            setModalProvider(null);
            void load();
            setMsg({ text: "Network status updated successfully.", ok: true });
          }}
        />
      )}
    </>
  );
}
