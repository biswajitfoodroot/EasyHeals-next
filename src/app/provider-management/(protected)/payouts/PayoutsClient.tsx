"use client";

import { useState, useMemo } from "react";

type CommissionRow = {
  id: string;
  amountPaise: number;
  status: string;
  notes: string | null;
  createdAt: string | null;
  paidAt: string | null;
  hospitalName: string | null;
  hospitalId: string | null;
};

const STATUS_ORDER = ["pending", "confirmed", "locked", "paid", "disputed", "reversed"];

const STATUS_COLORS: Record<string, string> = {
  pending:  "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  locked:   "bg-indigo-50 text-indigo-700 border-indigo-200",
  paid:     "bg-green-50 text-green-700 border-green-200",
  disputed: "bg-red-50 text-red-700 border-red-200",
  reversed: "bg-slate-100 text-slate-500 border-slate-200",
};

function formatInr(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function PayoutsClient({ entries }: { entries: CommissionRow[] }) {
  const [rows, setRows] = useState(entries);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>("pending");
  const [saving, setSaving] = useState<string | null>(null); // row id being saved
  const [bulkSaving, setBulkSaving] = useState(false);

  const filtered = useMemo(
    () => rows.filter((r) => filter === "all" || r.status === filter),
    [rows, filter],
  );

  const visibleIds = useMemo(() => new Set(filtered.map((r) => r.id)), [filtered]);
  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  async function updateStatus(id: string, status: string) {
    setSaving(id);
    try {
      const res = await fetch(`/api/provider-management/commissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, status, paidAt: status === "paid" ? new Date().toISOString() : r.paidAt }
              : r,
          ),
        );
      }
    } finally {
      setSaving(null);
    }
  }

  async function bulkMarkPaid() {
    const ids = [...selected].filter((id) => visibleIds.has(id));
    if (!ids.length) return;
    setBulkSaving(true);
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/provider-management/commissions/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "paid" }),
          }),
        ),
      );
      setRows((prev) =>
        prev.map((r) =>
          ids.includes(r.id) ? { ...r, status: "paid", paidAt: new Date().toISOString() } : r,
        ),
      );
      setSelected(new Set());
    } finally {
      setBulkSaving(false);
    }
  }

  function exportCsv() {
    const toExport = filtered.filter((r) => selected.has(r.id));
    if (!toExport.length) return;
    const header = ["ID", "Hospital", "Amount (INR)", "Status", "Notes", "Created", "Paid At"];
    const csvRows = toExport.map((r) => [
      r.id,
      r.hospitalName ?? r.hospitalId ?? "",
      (r.amountPaise / 100).toFixed(2),
      r.status,
      (r.notes ?? "").replace(/,/g, ";"),
      r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : "",
      r.paidAt ? new Date(r.paidAt).toLocaleDateString("en-IN") : "",
    ]);
    const csv = [header, ...csvRows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commissions-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pendingTotal = rows
    .filter((r) => r.status === "pending" || r.status === "confirmed" || r.status === "locked")
    .reduce((s, r) => s + r.amountPaise, 0);

  const paidTotal = rows
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + r.amountPaise, 0);

  const selectedTotal = filtered
    .filter((r) => selected.has(r.id))
    .reduce((s, r) => s + r.amountPaise, 0);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Payout Management</h1>
          <p className="text-sm text-slate-400">Review, approve and export commission payouts</p>
        </div>
        <a href="/provider-management/commissions/new"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition">
          + Log Commission
        </a>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Pending / Locked", value: formatInr(pendingTotal), color: "text-amber-700" },
          { label: "Paid (all time)", value: formatInr(paidTotal), color: "text-green-700" },
          { label: "Total entries", value: rows.length.toString(), color: "text-slate-800" },
          { label: "Selected", value: selected.size ? `${selected.size} · ${formatInr(selectedTotal)}` : "—", color: "text-indigo-700" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Status filter tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {["all", "pending", "confirmed", "locked", "paid", "disputed"].map((s) => (
            <button key={s}
              onClick={() => { setFilter(s); setSelected(new Set()); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                filter === s
                  ? "bg-indigo-600 text-white"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              {s} {s !== "all" ? `(${rows.filter((r) => r.status === s).length})` : ""}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {selected.size > 0 && (
          <>
            <button onClick={() => void exportCsv()}
              className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition">
              Export CSV ({selected.size})
            </button>
            {filter !== "paid" && (
              <button onClick={() => void bulkMarkPaid()} disabled={bulkSaving}
                className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition disabled:opacity-50">
                {bulkSaving ? "Marking paid…" : `Mark paid (${selected.size})`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400 text-sm">No commission entries for "{filter}" filter.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Hospital</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Notes</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={row.id} className={`hover:bg-slate-50 ${selected.has(row.id) ? "bg-indigo-50/50" : ""}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {row.hospitalName ?? (row.hospitalId ? row.hospitalId.slice(0, 12) + "…" : "—")}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{formatInr(row.amountPaise)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[row.status] ?? STATUS_COLORS.pending}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell max-w-xs truncate">
                    {row.notes ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">
                    {row.createdAt ? new Date(row.createdAt).toLocaleDateString("en-IN") : "—"}
                    {row.paidAt && (
                      <span className="ml-1 text-green-600 text-[10px]">
                        · paid {new Date(row.paidAt).toLocaleDateString("en-IN")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {saving === row.id ? (
                      <span className="text-xs text-slate-400">Saving…</span>
                    ) : (
                      <div className="flex gap-1 justify-end">
                        {row.status === "pending" && (
                          <button onClick={() => void updateStatus(row.id, "confirmed")}
                            className="text-xs font-semibold text-blue-600 hover:underline">
                            Confirm
                          </button>
                        )}
                        {row.status === "confirmed" && (
                          <button onClick={() => void updateStatus(row.id, "locked")}
                            className="text-xs font-semibold text-indigo-600 hover:underline">
                            Lock
                          </button>
                        )}
                        {(row.status === "pending" || row.status === "confirmed" || row.status === "locked") && (
                          <button onClick={() => void updateStatus(row.id, "paid")}
                            className="text-xs font-semibold text-green-600 hover:underline">
                            Mark Paid
                          </button>
                        )}
                        {row.status !== "disputed" && row.status !== "reversed" && row.status !== "paid" && (
                          <button onClick={() => void updateStatus(row.id, "disputed")}
                            className="text-xs font-semibold text-red-500 hover:underline">
                            Dispute
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
