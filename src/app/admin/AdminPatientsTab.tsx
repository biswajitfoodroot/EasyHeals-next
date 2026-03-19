"use client";

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PatientRow {
  id: string;
  createdAt: string | null;
  documentCount: number;
  eventCount: number;
  appointmentCount: number;
}

function formatDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminPatientsTab() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    void load(0);
  }, []);

  async function load(p: number) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(p * PAGE_SIZE) });
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/admin/patients?${params}`);
      if (res.ok) {
        const j = await res.json() as { data: PatientRow[] };
        setPatients(j.data ?? []);
        setPage(p);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800">Patients</h2>
          <p className="text-xs text-slate-400 mt-0.5">Registered patients — health data stats (PHI not shown)</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void load(0); }}
            placeholder="Search by patient ID..."
            className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl outline-none w-52"
          />
          <button
            onClick={() => void load(0)}
            className="px-3 py-1.5 text-sm font-medium bg-teal-600 text-white rounded-xl hover:bg-teal-700"
          >
            Search
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading patients...</div>
        ) : patients.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No patients found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Patient ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Registered</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Documents</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Health Events</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Appointments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(p.createdAt)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{p.documentCount}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{p.eventCount}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{p.appointmentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && patients.length === PAGE_SIZE && (
        <div className="p-4 border-t border-slate-100 flex justify-between items-center">
          <button
            onClick={() => void load(page - 1)}
            disabled={page === 0}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-xs text-slate-500">Page {page + 1}</span>
          <button
            onClick={() => void load(page + 1)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg"
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}
