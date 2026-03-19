"use client";

import { useEffect, useState, FormEvent } from "react";

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

// ── Create appointment form state ─────────────────────────────────────────────

interface CreateForm {
  hospitalId: string;
  doctorId: string;
  patientPhone: string;
  patientEmail: string;
  type: "in_person" | "online_consultation";
  scheduledAt: string;
  notes: string;
  status: "requested" | "confirmed";
}

const EMPTY_FORM: CreateForm = {
  hospitalId: "",
  doctorId: "",
  patientPhone: "",
  patientEmail: "",
  type: "in_person",
  scheduledAt: "",
  notes: "",
  status: "confirmed",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminAppointmentsTab() {
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  // Create appointment state
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [createBusy, setCreateBusy] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => { void load(0); }, [statusFilter]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateBusy(true);
    setCreateMsg(null);
    try {
      const body: Record<string, string> = { hospitalId: form.hospitalId, type: form.type, status: form.status };
      if (form.doctorId) body.doctorId = form.doctorId;
      if (form.patientPhone) body.patientPhone = form.patientPhone;
      if (form.patientEmail) body.patientEmail = form.patientEmail;
      if (form.scheduledAt) body.scheduledAt = new Date(form.scheduledAt).toISOString();
      if (form.notes) body.notes = form.notes;

      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { data?: { appointmentId: string; patientName: string; hospitalName: string }; error?: { message: string } };
      if (!res.ok) {
        setCreateMsg({ type: "err", text: json.error?.message ?? "Failed to create appointment" });
      } else {
        setCreateMsg({ type: "ok", text: `Appointment created for ${json.data?.patientName ?? "patient"} at ${json.data?.hospitalName ?? "hospital"}` });
        setForm(EMPTY_FORM);
        void load(0);
      }
    } catch {
      setCreateMsg({ type: "err", text: "Network error. Please try again." });
    } finally {
      setCreateBusy(false);
    }
  }

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
    <section className="space-y-4">

      {/* ── Create Appointment Panel ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div
          className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between cursor-pointer"
          onClick={() => { setShowCreate((v) => !v); setCreateMsg(null); }}
        >
          <div>
            <h2 className="text-sm font-bold text-slate-800">📅 Create Appointment</h2>
            <p className="text-xs text-slate-400 mt-0.5">Book on behalf of a patient — lookup by phone or email</p>
          </div>
          <span className="text-slate-400 text-lg">{showCreate ? "▲" : "▼"}</span>
        </div>

        {showCreate && (
          <form onSubmit={(e) => void handleCreate(e)} className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Hospital UUID *</label>
              <input required value={form.hospitalId}
                onChange={(e) => setForm({ ...form, hospitalId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none font-mono bg-slate-50"
                placeholder="Hospital UUID" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Doctor UUID <span className="font-normal text-slate-400">(optional)</span></label>
              <input value={form.doctorId}
                onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none font-mono bg-slate-50"
                placeholder="Doctor UUID (optional)" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Patient Phone <span className="font-normal text-slate-400">(E.164: +919876543210)</span></label>
              <input value={form.patientPhone}
                onChange={(e) => setForm({ ...form, patientPhone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none font-mono bg-slate-50"
                placeholder="+91XXXXXXXXXX" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Patient Email <span className="font-normal text-slate-400">(Google-auth patients)</span></label>
              <input type="email" value={form.patientEmail}
                onChange={(e) => setForm({ ...form, patientEmail: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50"
                placeholder="patient@gmail.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Scheduled Date & Time</label>
              <input type="datetime-local" value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "in_person" | "online_consultation" })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50">
                  <option value="in_person">In Person</option>
                  <option value="online_consultation">Online</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "requested" | "confirmed" })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50">
                  <option value="confirmed">Confirmed</option>
                  <option value="requested">Requested</option>
                </select>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Notes <span className="font-normal text-slate-400">(optional)</span></label>
              <textarea rows={2} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none bg-slate-50"
                placeholder="Reason for visit, symptoms..." />
            </div>
            {createMsg && (
              <div className={`sm:col-span-2 p-3 rounded-xl text-sm ${createMsg.type === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {createMsg.text}
              </div>
            )}
            <div className="sm:col-span-2">
              <button type="submit" disabled={createBusy}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
                {createBusy ? "Creating..." : "Create Appointment"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Appointments List ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
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
      </div>
    </section>
  );
}
