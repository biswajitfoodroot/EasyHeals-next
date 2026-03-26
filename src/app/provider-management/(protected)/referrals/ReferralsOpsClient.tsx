"use client";

import { useState } from "react";
import ReferralStatusBadge from "@/components/portal/referrals/ReferralStatusBadge";

type ReferralCase = {
  id: string;
  referralCode?: string | null;
  patientName?: string | null;
  patientPhone?: string | null;
  urgency: string;
  status: string;
  referralType: string;
  clinicalCategory?: string | null;
  sourceType: string;
  destinationMode: string;
  destinationCity?: string | null;
  referringOrgName?: string | null;
  createdAt: string | null;
  closedAt: string | null;
};

type Props = {
  cases: ReferralCase[];
};

const URGENCY_DOT: Record<string, string> = {
  emergency_transfer: "bg-red-500",
  urgent:             "bg-orange-400",
  priority:           "bg-amber-400",
  routine:            "bg-slate-300",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function ReferralsOpsClient({ cases }: Props) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const statusGroups = {
    all:       cases,
    active:    cases.filter(c => !["completed", "cancelled", "rejected", "expired"].includes(c.status)),
    completed: cases.filter(c => c.status === "completed"),
    pending:   cases.filter(c => ["submitted", "triaging"].includes(c.status)),
  };

  const filtered = (statusGroups[filter as keyof typeof statusGroups] ?? cases)
    .filter(c => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.patientName?.toLowerCase().includes(q) ||
        c.referralCode?.toLowerCase().includes(q) ||
        c.referringOrgName?.toLowerCase().includes(q) ||
        c.clinicalCategory?.toLowerCase().includes(q) ||
        c.destinationCity?.toLowerCase().includes(q)
      );
    });

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Referral Cases</h1>
          <p className="text-sm text-slate-400">
            {cases.length} total ·{" "}
            {cases.filter(c => ["submitted", "triaging"].includes(c.status)).length} need action ·{" "}
            {cases.filter(c => c.urgency === "emergency_transfer").length} emergencies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patient, code, org..."
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-52"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200 shadow-sm w-fit">
        {[
          { key: "all",       label: "All",       count: cases.length },
          { key: "pending",   label: "Pending",   count: statusGroups.pending.length },
          { key: "active",    label: "Active",    count: statusGroups.active.length },
          { key: "completed", label: "Completed", count: statusGroups.completed.length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              filter === key ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}
          >
            {label}
            <span className={`text-[10px] font-bold ${filter === key ? "text-indigo-200" : "text-slate-400"}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-3xl mb-2">🔀</p>
            <p className="text-slate-500 text-sm font-semibold">No referral cases found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Patient</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Specialty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">From</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Destination</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${URGENCY_DOT[c.urgency] ?? "bg-slate-300"}`} />
                      <div>
                        <p className="font-semibold text-slate-800">{c.patientName ?? "—"}</p>
                        <p className="text-[10px] font-mono text-slate-300">{c.referralCode}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ReferralStatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                    {c.clinicalCategory ?? c.referralType.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">
                    {c.referringOrgName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                    {c.destinationCity ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">
                    {fmtDate(c.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/provider-management/referrals/${c.id}`}
                      className="text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      View →
                    </a>
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
