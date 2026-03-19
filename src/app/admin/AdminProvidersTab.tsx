"use client";

import { useEffect, useState } from "react";

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
}

function formatDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminProvidersTab() {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | "hospital" | "doctor">("all");
  const [verifiedFilter, setVerifiedFilter] = useState<"all" | "unverified">("unverified");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { void load(); }, [typeFilter, verifiedFilter]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (verifiedFilter === "unverified") params.set("verified", "false");
      const res = await fetch(`/api/admin/providers?${params}`);
      if (res.ok) {
        const j = await res.json() as { data: ProviderRow[] };
        setRows(j.data ?? []);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }

  async function toggleVerify(id: string, type: "hospital" | "doctor", currentVerified: boolean) {
    setUpdatingId(id);
    setMsg(null);
    try {
      const endpoint = type === "hospital" ? `/api/admin/hospitals/${id}` : `/api/admin/doctors/${id}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVerified: !currentVerified }),
      });
      if (res.ok) {
        setRows((prev) => prev.map((r) => r.id === id ? { ...r, isVerified: !currentVerified } : r));
        setMsg(`${type === "hospital" ? "Hospital" : "Doctor"} ${!currentVerified ? "verified" : "unverified"} successfully.`);
      } else {
        setMsg("Update failed. Check admin permissions.");
      }
    } catch {
      setMsg("Network error.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-slate-800">Provider Verification</h2>
          <p className="text-xs text-slate-400 mt-0.5">Verify hospitals and doctors for patient-facing display</p>
        </div>
        <div className="flex gap-2">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl outline-none">
            <option value="all">All Types</option>
            <option value="hospital">Hospitals</option>
            <option value="doctor">Doctors</option>
          </select>
          <select value={verifiedFilter} onChange={(e) => setVerifiedFilter(e.target.value as typeof verifiedFilter)}
            className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl outline-none">
            <option value="unverified">Unverified Only</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {msg && (
        <div className="px-5 py-2 bg-green-50 text-green-700 text-sm border-b border-green-100">
          {msg}
        </div>
      )}

      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading providers...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No providers matching filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">City</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Added</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.type === "hospital" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                      {r.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{r.city ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    {r.isVerified ? (
                      <span className="text-xs font-semibold text-green-700">✓ Verified</span>
                    ) : (
                      <span className="text-xs font-semibold text-yellow-700">⏳ Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => void toggleVerify(r.id, r.type, r.isVerified ?? false)}
                      disabled={updatingId === r.id}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition disabled:opacity-60 ${
                        r.isVerified
                          ? "border-red-200 text-red-600 hover:bg-red-50"
                          : "border-green-200 text-green-700 hover:bg-green-50"
                      }`}
                    >
                      {updatingId === r.id ? "..." : r.isVerified ? "Unverify" : "Verify"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
