"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

type Row = {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  changes: unknown;
  createdAt: string | null;
};

const ACTION_COLORS: Record<string, string> = {
  create:    "bg-green-50 text-green-700 border-green-200",
  update:    "bg-blue-50 text-blue-700 border-blue-200",
  delete:    "bg-red-50 text-red-700 border-red-200",
  approve:   "bg-teal-50 text-teal-700 border-teal-200",
  reject:    "bg-orange-50 text-orange-700 border-orange-200",
  login:     "bg-slate-50 text-slate-600 border-slate-200",
};

function actionColor(action: string) {
  for (const [k, v] of Object.entries(ACTION_COLORS)) {
    if (action.includes(k)) return v;
  }
  return "bg-indigo-50 text-indigo-700 border-indigo-200";
}

function fmtTs(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ChangesCell({ changes }: { changes: unknown }) {
  if (!changes) return <span className="text-slate-300 text-xs">—</span>;
  const str = typeof changes === "string" ? changes : JSON.stringify(changes, null, 2);
  if (str.length < 120) {
    return <span className="text-xs font-mono text-slate-500">{str}</span>;
  }
  return (
    <details className="cursor-pointer">
      <summary className="text-xs text-indigo-600 font-semibold">View changes</summary>
      <pre className="text-[10px] font-mono text-slate-500 mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap">{str}</pre>
    </details>
  );
}

export default function PMauditLogClient({
  rows,
  entityTypes,
  initialFilters,
}: {
  rows: Row[];
  entityTypes: string[];
  initialFilters: { entity: string; action: string; from: string; to: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState(initialFilters);

  function apply(next: typeof filters) {
    setFilters(next);
    const sp = new URLSearchParams();
    if (next.entity !== "all") sp.set("entity", next.entity);
    if (next.action) sp.set("action", next.action);
    if (next.from) sp.set("from", next.from);
    if (next.to) sp.set("to", next.to);
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  function reset() {
    apply({ entity: "all", action: "", from: "", to: "" });
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Entity Type</label>
          <select value={filters.entity}
            onChange={e => apply({ ...filters, entity: e.target.value })}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="all">All</option>
            {entityTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Action contains</label>
          <input value={filters.action}
            onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
            onBlur={() => apply(filters)}
            onKeyDown={e => e.key === "Enter" && apply(filters)}
            placeholder="e.g. commission, referral..."
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-400 w-44" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">From</label>
          <input type="date" value={filters.from}
            onChange={e => apply({ ...filters, from: e.target.value })}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">To</label>
          <input type="date" value={filters.to}
            onChange={e => apply({ ...filters, to: e.target.value })}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        {(filters.entity !== "all" || filters.action || filters.from || filters.to) && (
          <button type="button" onClick={reset}
            className="px-3 py-2 border border-slate-200 text-sm text-slate-500 rounded-xl hover:bg-slate-50">
            Clear
          </button>
        )}
        {isPending && <span className="text-xs text-slate-400 self-center">Loading...</span>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700">{rows.length} entries</p>
          <p className="text-xs text-slate-400">Most recent first · max 200</p>
        </div>
        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-400">No audit log entries found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">When</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Entity</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Changes</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {fmtTs(row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-slate-700">{row.actorName ?? "System"}</p>
                      {row.actorRole && (
                        <p className="text-[10px] text-slate-400 capitalize">{row.actorRole}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${actionColor(row.action)}`}>
                        {row.action.replace(/^(portal\.|admin\.|pm\.)/, "")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-600 capitalize">{row.entityType}</p>
                      {row.entityId && (
                        <p className="text-[10px] font-mono text-slate-400">{row.entityId.slice(0, 12)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs hidden lg:table-cell">
                      <ChangesCell changes={row.changes} />
                    </td>
                    <td className="px-4 py-3 text-[10px] font-mono text-slate-400 hidden xl:table-cell">
                      {row.ipAddress ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
