"use client";

import { useState } from "react";

type Sub = {
  id: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  hospitalName: string | null;
  hospitalCity: string | null;
  hospitalId: string;
  packageName: string | null;
  packageCode: string | null;
  monthlyPrice: number | null;
};

type Package = { id: string; code: string; name: string; monthlyPrice: number };

const PLAN_CODES = ["free", "pro", "business", "enterprise"];

export default function SubscriptionsClient({
  subs: initialSubs,
  packages,
  hasPackages,
}: {
  subs: Sub[];
  packages: Package[];
  hasPackages: boolean;
}) {
  const [subs, setSubs] = useState(initialSubs);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [assignTarget, setAssignTarget] = useState<string | null>(null); // hospitalId
  const [assignForm, setAssignForm] = useState({ packageCode: "free", durationDays: "365" });
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState("");

  async function seedPackages() {
    setSeeding(true);
    setSeedMsg("");
    try {
      const res = await fetch("/api/provider-management/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_packages" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSeedMsg(`Seeded: ${(data.seeded as string[]).join(", ")}. Refresh to see plans in portal.`);
    } catch (err) {
      setSeedMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setSeeding(false);
    }
  }

  async function assignPlan(hospitalId: string) {
    setAssigning(true);
    setAssignMsg("");
    try {
      const res = await fetch("/api/provider-management/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_plan",
          hospitalId,
          packageCode: assignForm.packageCode,
          durationDays: parseInt(assignForm.durationDays) || 365,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setAssignMsg(`Assigned ${data.packageName as string} to hospital.`);
      setAssignTarget(null);
      // Refresh data
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setAssignMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setAssigning(false);
    }
  }

  const STATUS_COLORS: Record<string, string> = {
    active:    "bg-green-50 text-green-700 border-green-200",
    trial:     "bg-amber-50 text-amber-700 border-amber-200",
    expired:   "bg-slate-100 text-slate-500 border-slate-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className="space-y-6">
      {/* Seed packages banner */}
      {!hasPackages && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-amber-800">Subscription plans not seeded</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Providers see "No plans available" in their portal. Seed default plans to activate subscriptions.
            </p>
          </div>
          <button onClick={() => void seedPackages()} disabled={seeding}
            className="shrink-0 px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 transition disabled:opacity-50">
            {seeding ? "Seeding…" : "Seed Default Plans"}
          </button>
        </div>
      )}

      {seedMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-sm text-green-700">
          {seedMsg}
        </div>
      )}

      {hasPackages && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-700">Plans available: {packages.map(p => p.name).join(", ")}</p>
            <p className="text-xs text-slate-400 mt-0.5">Hospitals see these in their portal subscription page.</p>
          </div>
          <button onClick={() => void seedPackages()} disabled={seeding}
            className="shrink-0 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition disabled:opacity-50">
            {seeding ? "Updating…" : "Resync Plans"}
          </button>
        </div>
      )}

      {/* Assign plan modal */}
      {assignTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800">Assign Subscription Plan</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Plan</label>
              <select value={assignForm.packageCode}
                onChange={(e) => setAssignForm((f) => ({ ...f, packageCode: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                {(hasPackages ? packages : PLAN_CODES.map(c => ({ id: c, code: c, name: c.charAt(0).toUpperCase() + c.slice(1), monthlyPrice: 0 }))).map((p) => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Duration (days)</label>
              <input type="number" min="1" value={assignForm.durationDays}
                onChange={(e) => setAssignForm((f) => ({ ...f, durationDays: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
              <p className="text-xs text-slate-400 mt-0.5">365 = 1 year. Leave blank or 0 for perpetual.</p>
            </div>

            {assignMsg && (
              <p className="text-sm text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">{assignMsg}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={() => void assignPlan(assignTarget)} disabled={assigning}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition disabled:opacity-50">
                {assigning ? "Assigning…" : "Assign Plan"}
              </button>
              <button onClick={() => { setAssignTarget(null); setAssignMsg(""); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscriptions table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {subs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-slate-400 text-sm">No hospital subscriptions yet.</p>
            <p className="text-xs text-slate-400">Use the "Assign Plan" button on a provider to add their first subscription.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Hospital</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">City</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Price</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Expires</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subs.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {s.hospitalName ?? s.hospitalId.slice(0, 10) + "…"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{s.hospitalCity ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{s.packageName ?? s.packageCode ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {s.monthlyPrice ? `₹${s.monthlyPrice.toLocaleString("en-IN")}/mo` : "Free"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[s.status] ?? STATUS_COLORS.expired}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">
                    {s.endsAt ? new Date(s.endsAt).toLocaleDateString("en-IN") : "Perpetual"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setAssignTarget(s.hospitalId); setAssignMsg(""); }}
                      className="text-xs font-semibold text-indigo-600 hover:underline">
                      Change Plan
                    </button>
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
