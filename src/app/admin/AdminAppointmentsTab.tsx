"use client";

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppointmentRow {
  id: string;
  patientId: string | null;
  type: string;
  status: string;
  scheduledAt: string | null;
  doctorName: string | null;
  hospitalName: string | null;
  createdAt: string | null;
  hasDocuments: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-orange-100 text-orange-700",
};

function formatDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminAppointmentsTab() {
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  useEffect(() => { void load(0); }, [statusFilter]);

  async function load(p: number) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(p * PAGE_SIZE) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/appointments?${params}`);
      if (res.ok) {
        const j = await res.json() as { data: AppointmentRow[] };
        setRows(j.data ?? []);
        setPage(p);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-slate-800">Appointments Oversight</h2>
          <p className="text-xs text-slate-400 mt-0.5">All platform appointments across hospitals and doctors</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="requested">Requested</option>
          <option value="confirmed">Confirmed</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading appointments...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No appointments found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Doctor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Hospital</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Scheduled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {a.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{a.type === "online_consultation" ? "🎥 Online" : "🏥 In-person"}</td>
                  <td className="px-4 py-3 text-slate-700">{a.doctorName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{a.hospitalName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(a.scheduledAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && rows.length === PAGE_SIZE && (
        <div className="p-4 border-t border-slate-100 flex justify-between items-center">
          <button onClick={() => void load(page - 1)} disabled={page === 0}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40">
            ← Previous
          </button>
          <span className="text-xs text-slate-500">Page {page + 1}</span>
          <button onClick={() => void load(page + 1)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg">
            Next →
          </button>
        </div>
      )}
    </section>
  );
}
