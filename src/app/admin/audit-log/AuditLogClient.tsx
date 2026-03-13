"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { UnifiedLogEntry } from "@/app/api/admin/audit-log/route";

type Me = { role: string; userId: string };

type Stats = {
  total: number;
  autoApproved: number;
  pending: number;
  rejected: number;
  highRisk: number;
};

type Filters = {
  dateFrom: string;
  dateTo: string;
  entityType: string;
  status: string;
  minScore: string;
};

const DEFAULT_FILTERS: Filters = {
  dateFrom: "",
  dateTo: "",
  entityType: "all",
  status: "all",
  minScore: "",
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-300 text-xs">—</span>;
  const cls =
    score < 30 ? "bg-emerald-100 text-emerald-700" :
    score < 70 ? "bg-amber-100 text-amber-700" :
    "bg-red-100 text-red-700";
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${cls}`}>{score}</span>;
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
    <span className={`px-2 py-0.5 rounded text-xs font-bold capitalize ${map[status] ?? "bg-slate-100 text-slate-500"}`}>
      {label}
    </span>
  );
}

function DiffCell({ row }: { row: UnifiedLogEntry }) {
  const fmt = (v: unknown): string => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  if (row.source === "contribution" && row.fieldChanged) {
    return (
      <div>
        <p className="text-xs font-semibold text-slate-600 mb-0.5">{row.fieldChanged}</p>
        <p className="text-xs">
          <span className="line-through text-red-400 mr-1">{fmt(row.oldValue)}</span>
          <span className="text-slate-400 mr-1">→</span>
          <span className="text-emerald-600 font-medium">{fmt(row.newValue)}</span>
        </p>
        {(row.outlierFlags ?? []).length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-1">
            {row.outlierFlags.map((f) => (
              <span key={f} className="px-1 py-0.5 rounded bg-orange-50 border border-orange-100 text-[10px] font-mono text-orange-600">
                {f}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <span className="text-xs font-mono text-slate-500">
      {row.action.replace("portal.", "").replace("admin.", "").replace("crowd.", "")}
    </span>
  );
}

export function AuditLogClient({ me }: { me: Me }) {
  const canAct = me.role === "owner" || me.role === "admin";

  const [rows, setRows] = useState<UnifiedLogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [aiReviews, setAiReviews] = useState<Map<string, { recommendation: string; confidence: number; reason: string }>>(new Map());
  const [reviewLoading, setReviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (f: Filters) => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (f.dateFrom) sp.set("dateFrom", f.dateFrom);
      if (f.dateTo) sp.set("dateTo", f.dateTo);
      if (f.entityType !== "all") sp.set("entityType", f.entityType);
      if (f.status !== "all") sp.set("status", f.status);
      if (f.minScore) sp.set("minScore", f.minScore);
      sp.set("limit", "150");

      const res = await fetch(`/api/admin/audit-log?${sp.toString()}`);
      const data = (await res.json()) as { data: UnifiedLogEntry[]; stats: Stats };
      setRows(data.data ?? []);
      setStats(data.stats ?? null);
      setSelected(new Set());
      setAiReviews(new Map());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void load(filters), 300);
  }, [filters, load]);

  async function runAiSearch() {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiSummary(null);
    try {
      const res = await fetch("/api/admin/audit-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: aiQuery }),
      });
      const data = (await res.json()) as {
        filters?: Partial<Filters>;
        summary?: string;
      };
      if (data.filters) {
        setFilters((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(data.filters ?? {}).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])
          ),
        }));
      }
      setAiSummary(data.summary ?? null);
    } finally {
      setAiLoading(false);
    }
  }

  async function runAiReview() {
    const pendingIds =
      selected.size > 0
        ? [...selected].filter((id) => rows.find((r) => r.id === id)?.status === "pending")
        : rows.filter((r) => r.status === "pending" && r.source === "contribution").map((r) => r.id);

    if (!pendingIds.length) { showToast("No pending contributions to review."); return; }

    setReviewLoading(true);
    try {
      const res = await fetch("/api/admin/contributions/ai-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pendingIds.slice(0, 30) }),
      });
      const data = (await res.json()) as { data: Array<{ id: string; recommendation: string; confidence: number; reason: string }> };
      const map = new Map<string, { recommendation: string; confidence: number; reason: string }>();
      for (const r of data.data ?? []) map.set(r.id, r);
      setAiReviews(map);
    } finally {
      setReviewLoading(false);
    }
  }

  async function applyAiDecisions() {
    const actions: Array<{ id: string; action: "approve" | "reject" }> = [];
    for (const [id, review] of aiReviews) {
      if (review.recommendation === "manual_review") continue;
      actions.push({ id, action: review.recommendation as "approve" | "reject" });
    }
    if (!actions.length) { showToast("No AI decisions to apply."); return; }

    setApplying(true);
    try {
      const res = await fetch("/api/admin/contributions/ai-review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions }),
      });
      const data = (await res.json()) as { data: { approved: number; rejected: number } };
      showToast(`Applied: ${data.data.approved} approved, ${data.data.rejected} rejected.`);
      void load(filters);
    } finally {
      setApplying(false);
    }
  }

  async function actSingle(id: string, action: "approve" | "reject") {
    const res = await fetch("/api/admin/contributions/ai-review", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actions: [{ id, action }] }),
    });
    if (res.ok) {
      showToast(`Edit ${action}d.`);
      void load(filters);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pendingCount = rows.filter((r) => r.status === "pending" && r.source === "contribution").length;
  const reviewedCount = aiReviews.size;
  const autoApproveCount = [...aiReviews.values()].filter((r) => r.recommendation === "approve").length;
  const autoRejectCount = [...aiReviews.values()].filter((r) => r.recommendation === "reject").length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Audit Log</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          All community edits, portal updates, and admin actions — searchable by AI.
        </p>
      </div>

      {/* Toast */}
      {toast ? (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-lg">
          {toast}
        </div>
      ) : null}

      {/* Stats bar */}
      {stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total Edits", value: stats.total, color: "text-slate-800" },
            { label: "Auto-approved", value: stats.autoApproved, color: "text-emerald-600" },
            { label: "Pending", value: stats.pending, color: "text-amber-600" },
            { label: "Rejected", value: stats.rejected, color: "text-red-600" },
            { label: "High Risk (≥70)", value: stats.highRisk, color: "text-red-700" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-sm">
              <p className={`text-xl font-black ${color}`}>{value}</p>
              <p className="text-xs text-slate-400 font-semibold">{label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* AI Search */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">AI Natural Language Search</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void runAiSearch()}
            placeholder='e.g. "suspicious phone changes last 7 days" or "pending doctor edits this month"'
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
          />
          <button
            type="button"
            onClick={() => void runAiSearch()}
            disabled={aiLoading}
            className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-50"
          >
            {aiLoading ? "…" : "Search"}
          </button>
          {Object.values(filters).some((v) => v !== "" && v !== "all") ? (
            <button
              type="button"
              onClick={() => { setFilters(DEFAULT_FILTERS); setAiSummary(null); }}
              className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200"
            >
              Clear
            </button>
          ) : null}
        </div>
        {aiSummary ? (
          <p className="mt-2 text-sm text-teal-700 font-medium">
            🤖 {aiSummary}
          </p>
        ) : null}
      </div>

      {/* Manual filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Filter</p>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-semibold">From</label>
            <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-semibold">To</label>
            <input type="date" value={filters.dateTo} onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          {[
            { label: "Entity", key: "entityType", options: ["all", "hospital", "doctor"] },
            { label: "Status", key: "status", options: ["all", "pending", "approved", "rejected"] },
          ].map(({ label, key, options }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 font-semibold">{label}</label>
              <select
                value={filters[key as keyof Filters]}
                onChange={(e) => setFilters((p) => ({ ...p, [key]: e.target.value }))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              >
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-semibold">Min Risk Score</label>
            <input type="number" min={0} max={100} value={filters.minScore}
              onChange={(e) => setFilters((p) => ({ ...p, minScore: e.target.value }))}
              placeholder="e.g. 30"
              className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
        </div>
      </div>

      {/* Bulk AI review toolbar */}
      {canAct && pendingCount > 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-amber-800">
            {pendingCount} pending contribution{pendingCount !== 1 ? "s" : ""} need review
          </span>
          <button
            type="button"
            onClick={() => void runAiReview()}
            disabled={reviewLoading}
            className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-50"
          >
            {reviewLoading ? "AI reviewing…" : "🤖 AI Review All Pending"}
          </button>
          {reviewedCount > 0 ? (
            <>
              <span className="text-sm text-slate-600">
                AI: <span className="text-emerald-600 font-bold">{autoApproveCount} approve</span>,{" "}
                <span className="text-red-600 font-bold">{autoRejectCount} reject</span>,{" "}
                <span className="text-amber-600 font-bold">{reviewedCount - autoApproveCount - autoRejectCount} manual</span>
              </span>
              <button
                type="button"
                onClick={() => void applyAiDecisions()}
                disabled={applying}
                className="px-4 py-1.5 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-50"
              >
                {applying ? "Applying…" : "▶ Apply AI Decisions"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Results table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700">
            {loading ? "Loading…" : `${rows.length} entries`}
          </p>
          {selected.size > 0 ? (
            <p className="text-xs text-teal-600 font-semibold">{selected.size} selected</p>
          ) : null}
        </div>

        {loading ? (
          <div className="divide-y divide-slate-50">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-5 py-4 animate-pulse flex gap-4">
                <div className="h-4 w-24 bg-slate-100 rounded" />
                <div className="h-4 w-32 bg-slate-100 rounded" />
                <div className="h-4 flex-1 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">No entries found for selected filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400 font-bold uppercase tracking-wide">
                  {canAct ? <th className="px-4 py-3 w-8"><input type="checkbox" onChange={(e) => {
                    if (e.target.checked) setSelected(new Set(rows.filter(r => r.status === "pending" && r.source === "contribution").map(r => r.id)));
                    else setSelected(new Set());
                  }} /></th> : null}
                  <th className="px-4 py-3 w-32">When</th>
                  <th className="px-4 py-3 w-36">Who</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Change</th>
                  <th className="px-4 py-3 w-16">Risk</th>
                  <th className="px-4 py-3 w-24">Status</th>
                  {canAct ? <th className="px-4 py-3 w-32">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((row) => {
                  const review = aiReviews.get(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/60 ${selected.has(row.id) ? "bg-teal-50/40" : ""}`}
                    >
                      {canAct ? (
                        <td className="px-4 py-3">
                          {row.status === "pending" && row.source === "contribution" ? (
                            <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} />
                          ) : null}
                        </td>
                      ) : null}
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">
                        {new Date(row.when).toLocaleString("en-IN", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {row.actorAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={row.actorAvatar} alt="" className="w-6 h-6 rounded-full" />
                          ) : (
                            <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                              {row.actorName?.charAt(0)?.toUpperCase() ?? "?"}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700 truncate max-w-[100px]">
                              {row.actorName ?? "System"}
                            </p>
                            <p className="text-[10px] text-slate-400 capitalize">{row.actorRole ?? ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-xs font-medium text-slate-700 truncate max-w-[160px]">
                            {row.entityName ?? row.entityId ?? "—"}
                          </p>
                          <p className="text-[10px] text-slate-400 capitalize">{row.entityType}</p>
                          {row.entityId ? (
                            <Link
                              href={`/admin/hospital/${row.entityId}`}
                              className="text-[10px] text-teal-600 hover:underline"
                            >
                              view →
                            </Link>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <DiffCell row={row} />
                        {review ? (
                          <div className="mt-1 flex items-center gap-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              review.recommendation === "approve" ? "bg-emerald-100 text-emerald-700" :
                              review.recommendation === "reject" ? "bg-red-100 text-red-700" :
                              "bg-amber-100 text-amber-700"
                            }`}>
                              AI: {review.recommendation} ({Math.round(review.confidence * 100)}%)
                            </span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[140px]" title={review.reason}>
                              {review.reason}
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={row.outlierScore} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      {canAct ? (
                        <td className="px-4 py-3">
                          {row.status === "pending" && row.source === "contribution" ? (
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => void actSingle(row.id, "approve")}
                                className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                                title="Approve"
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => void actSingle(row.id, "reject")}
                                className="px-2 py-1 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600"
                                title="Reject"
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
