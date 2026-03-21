"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "appointments" | "doctors" | "patients" | "billing" | "staff";

interface Appointment {
  id: string;
  patientId: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  patientNotes: string | null;
  hospitalName: string | null;
  createdAt: string | null;
  consultationFee: number | null;
  paymentStatus: string | null;
  meetingUrl: string | null;
}

interface DoctorAffiliate {
  affiliationId: string;
  doctorId: string;
  fullName: string;
  specialization: string | null;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  yearsOfExperience: number | null;
  role: string;
  feeMin: number | null;
  feeMax: number | null;
  isPrimary: boolean;
  verified: boolean;
  isActive: boolean;
}

interface PatientRow {
  patientId: string;
  displayAlias: string;
  city: string | null;
  lastApptAt: string | null;
  lastApptStatus: string;
  lastDoctorName: string | null;
  appointmentCount: number;
  consultationTypes: string[];
  treatingDoctors: string[];
}

interface BillingRow {
  id: string;
  patientId: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  completedAt: string | null;
  consultationFee: number | null;
  paymentStatus: string | null;
  createdAt: string | null;
  doctorName: string | null;
}

interface BillingSummary {
  total: number;
  paid: number;
  pending: number;
  totalRevenue: number;
  pendingRevenue: number;
}

interface SearchDoctor {
  id: string;
  fullName: string;
  specialization: string | null;
  phone: string | null;
  city: string | null;
  yearsOfExperience: number | null;
  verified: boolean;
}

interface Props {
  userFullName: string;
  userRole: string;
  hospitalId?: string;
  hospitalName?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDT(dt: string | null) {
  if (!dt) return "TBC";
  return new Date(dt).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function isToday(dt: string | null) {
  if (!dt) return false;
  const d = new Date(dt), n = new Date();
  return d.toDateString() === n.toDateString();
}

// ── Badges ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    requested:   "bg-amber-100 text-amber-800 border-amber-200",
    confirmed:   "bg-emerald-100 text-emerald-800 border-emerald-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    completed:   "bg-slate-100 text-slate-600 border-slate-200",
    cancelled:   "bg-red-100 text-red-700 border-red-200",
    no_show:     "bg-orange-100 text-orange-700 border-orange-200",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${map[status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  if (type === "audio_consultation") return <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">📞 Audio</span>;
  if (type === "video_consultation" || type === "online_consultation") return <span className="text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">🎥 Video</span>;
  return <span className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">🏥 In-Person</span>;
}

function PaymentBadge({ status, fee }: { status: string | null; fee: number | null }) {
  if (!status || status === "none") return null;
  if (status === "paid") return <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">✅ Paid{fee ? ` ₹${fee}` : ""}</span>;
  if (status === "pending") return <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⏳ Payment pending{fee ? ` ₹${fee}` : ""}</span>;
  if (status === "waived") return <span className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">Free</span>;
  return null;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className ?? ""}`} />;
}

// ── Appointment Card ──────────────────────────────────────────────────────────

function AppointmentCard({
  appt,
  actioning,
  acceptFees,
  acceptUrls,
  onAccept,
  onAct,
  onFeeChange,
  onUrlChange,
}: {
  appt: Appointment;
  actioning: string | null;
  acceptFees: Record<string, string>;
  acceptUrls: Record<string, string>;
  onAccept: (id: string, type: string) => void;
  onAct: (id: string, action: "reject" | "complete", reason?: string) => void;
  onFeeChange: (id: string, val: string) => void;
  onUrlChange: (id: string, val: string) => void;
}) {
  const isPending   = appt.status === "requested";
  const isConfirmed = appt.status === "confirmed";
  const busy        = actioning === appt.id;
  const isRemote    = appt.type === "audio_consultation" || appt.type === "video_consultation" || appt.type === "online_consultation";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <StatusBadge status={appt.status} />
            <TypeBadge type={appt.type} />
            <PaymentBadge status={appt.paymentStatus} fee={appt.consultationFee} />
            {isToday(appt.scheduledAt) && (
              <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">TODAY</span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-700">Patient #{appt.patientId.slice(0, 8)}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {appt.scheduledAt ? `Scheduled: ${formatDT(appt.scheduledAt)}` : `Requested: ${formatDT(appt.createdAt)}`}
          </p>
          {appt.patientNotes && (
            <p className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              💬 {appt.patientNotes}
            </p>
          )}
          {isConfirmed && isRemote && appt.meetingUrl && (
            <a href={appt.meetingUrl} target="_blank" rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg"
              style={{ background: "#1B8A4A" }}>
              {appt.type === "video_consultation" ? "🎥" : "📞"} Start Session →
            </a>
          )}
        </div>

        <div className="flex flex-col gap-2 items-end shrink-0">
          {isPending && (
            <>
              {isRemote && (
                <div className="space-y-1.5 w-44">
                  <input
                    type="number" min="0"
                    placeholder="Fee (₹) — 0 for free"
                    value={acceptFees[appt.id] ?? ""}
                    onChange={(e) => onFeeChange(appt.id, e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <input
                    type="url"
                    placeholder="Meeting link (optional)"
                    value={acceptUrls[appt.id] ?? ""}
                    onChange={(e) => onUrlChange(appt.id, e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              )}
              <button
                onClick={() => onAccept(appt.id, appt.type)}
                disabled={busy}
                className="px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 flex items-center gap-1.5 transition"
                style={{ background: "#1B8A4A" }}
              >
                {busy ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "✓"}
                Accept{isRemote ? " & Set Fee" : ""}
              </button>
              <button
                onClick={() => onAct(appt.id, "reject", "Provider unavailable")}
                disabled={busy}
                className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50 transition"
              >
                Reject
              </button>
            </>
          )}
          {isConfirmed && (
            <button
              onClick={() => onAct(appt.id, "complete")}
              disabled={busy}
              className="px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition"
              style={{ background: "#1e40af" }}
            >
              Mark Complete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Specialty options (common Indian medical specializations) ─────────────────

const SPECIALTIES = [
  "General Physician", "Cardiologist", "Orthopaedic Surgeon", "Neurologist",
  "Gynaecologist", "Paediatrician", "Dermatologist", "Psychiatrist",
  "Endocrinologist", "Gastroenterologist", "Pulmonologist", "Nephrologist",
  "Urologist", "Oncologist", "Ophthalmologist", "ENT Specialist",
  "Diabetologist", "Rheumatologist", "Haematologist", "Radiologist",
  "Anaesthesiologist", "General Surgeon", "Plastic Surgeon", "Dental Surgeon",
  "Physiotherapist", "Nutritionist / Dietitian", "Ayurvedic Practitioner",
  "Homeopath", "Pathologist",
];

// ── Add Doctor Modal ──────────────────────────────────────────────────────────

function AddDoctorModal({ hospitalId, onClose, onDone }: {
  hospitalId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"search" | "create">("search");

  // Search filters
  const [filterName,     setFilterName]     = useState("");
  const [filterPhone,    setFilterPhone]    = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("");
  const [filterCity,     setFilterCity]     = useState("");
  const [results,        setResults]        = useState<SearchDoctor[]>([]);
  const [searching,      setSearching]      = useState(false);
  const [hasSearched,    setHasSearched]    = useState(false);

  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState<string | null>(null);

  // Link affiliation options
  const [linkRole,    setLinkRole]    = useState("Visiting Consultant");
  const [linkFeeMin,  setLinkFeeMin]  = useState("");
  const [linkFeeMax,  setLinkFeeMax]  = useState("");

  // Create form
  const [form, setForm] = useState({
    fullName: "", specialization: "", phone: "", email: "",
    role: "Visiting Consultant", yearsOfExperience: "",
    feeMin: "", feeMax: "",
  });

  async function doSearch() {
    if (!filterName && !filterPhone && !filterSpecialty && !filterCity) return;
    setSearching(true); setHasSearched(true);
    try {
      const params = new URLSearchParams({ hospitalId });
      if (filterName)      params.set("name",      filterName);
      if (filterPhone)     params.set("phone",     filterPhone);
      if (filterSpecialty) params.set("specialty", filterSpecialty);
      if (filterCity)      params.set("city",      filterCity);
      const res = await fetch(`/api/v1/portal/doctors?${params}`, { credentials: "include" });
      const j = await res.json() as { data: SearchDoctor[] };
      setResults(j.data ?? []);
    } finally { setSearching(false); }
  }

  function clearFilters() {
    setFilterName(""); setFilterPhone(""); setFilterSpecialty(""); setFilterCity("");
    setResults([]); setHasSearched(false);
  }

  async function linkDoctor(doctorId: string) {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { action: "link", doctorId, role: linkRole };
      if (linkFeeMin) body.feeMin = parseFloat(linkFeeMin);
      if (linkFeeMax) body.feeMax = parseFloat(linkFeeMax);
      const res = await fetch(`/api/v1/portal/doctors?hospitalId=${hospitalId}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) { onDone(); onClose(); }
      else { const j = await res.json() as { error?: { userMessage?: string } }; setMsg(j?.error?.userMessage ?? "Failed to link doctor."); }
    } finally { setSaving(false); }
  }

  async function createDoctor() {
    if (!form.fullName) { setMsg("Full name is required."); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { action: "create", ...form };
      if (form.yearsOfExperience) body.yearsOfExperience = parseInt(form.yearsOfExperience);
      if (form.feeMin)            body.feeMin = parseFloat(form.feeMin);
      if (form.feeMax)            body.feeMax = parseFloat(form.feeMax);
      const res = await fetch(`/api/v1/portal/doctors?hospitalId=${hospitalId}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) { onDone(); onClose(); }
      else { const j = await res.json() as { error?: { userMessage?: string } }; setMsg(j?.error?.userMessage ?? "Failed to create doctor."); }
    } finally { setSaving(false); }
  }

  const hasFilters = filterName || filterPhone || filterSpecialty || filterCity;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold text-slate-800">Add Doctor to Hospital</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
            {(["search", "create"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setMsg(null); }}
                className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition ${mode === m ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>
                {m === "search" ? "🔍 Link Existing Doctor" : "➕ Create New Doctor"}
              </button>
            ))}
          </div>

          {msg && <p className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl">{msg}</p>}

          {mode === "search" ? (
            <div className="space-y-4">
              {/* Multi-field filter panel */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Search Filters</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Doctor Name</label>
                    <input
                      type="text" placeholder="e.g. Dr. Priya"
                      value={filterName}
                      onChange={(e) => setFilterName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void doSearch()}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Phone Number</label>
                    <input
                      type="tel" placeholder="e.g. 98765"
                      value={filterPhone}
                      onChange={(e) => setFilterPhone(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void doSearch()}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Specialty</label>
                    <select
                      value={filterSpecialty}
                      onChange={(e) => setFilterSpecialty(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Any specialty</option>
                      {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">City / Location</label>
                    <input
                      type="text" placeholder="e.g. Mumbai"
                      value={filterCity}
                      onChange={(e) => setFilterCity(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void doSearch()}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void doSearch()}
                    disabled={!hasFilters || searching}
                    className="flex-1 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-40 transition flex items-center justify-center gap-2"
                    style={{ background: "#1B8A4A" }}
                  >
                    {searching ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "🔍"}
                    Search
                  </button>
                  {hasFilters && (
                    <button onClick={clearFilters}
                      className="px-4 py-2 text-sm font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Affiliation options (role + fees) */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Affiliation Details</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Role</label>
                    <input type="text" value={linkRole} onChange={(e) => setLinkRole(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Fee Min (₹)</label>
                    <input type="number" min="0" value={linkFeeMin} onChange={(e) => setLinkFeeMin(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Fee Max (₹)</label>
                    <input type="number" min="0" value={linkFeeMax} onChange={(e) => setLinkFeeMax(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">An invitation will be sent to the doctor to accept this affiliation.</p>
              </div>

              {/* Results */}
              {hasSearched && (
                <div className="space-y-2">
                  {results.length === 0 && !searching ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-slate-500">No matching doctors found.</p>
                      <button onClick={() => setMode("create")}
                        className="mt-2 text-xs text-emerald-600 font-semibold hover:underline">
                        Create a new doctor profile instead →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{results.length} result{results.length !== 1 ? "s" : ""}</p>
                      {results.map((d) => (
                        <div key={d.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-emerald-300 transition">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-800">{d.fullName}</p>
                              {d.verified && <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">✓ Verified</span>}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{d.specialization ?? "General"}{d.city ? ` · ${d.city}` : ""}{d.yearsOfExperience ? ` · ${d.yearsOfExperience}y exp` : ""}</p>
                            {d.phone && <p className="text-xs text-slate-400">{d.phone}</p>}
                          </div>
                          <button
                            onClick={() => void linkDoctor(d.id)}
                            disabled={saving}
                            className="ml-3 shrink-0 px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50 transition"
                            style={{ background: "#1B8A4A" }}
                          >
                            Invite
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Creating a new doctor profile will link them to your hospital immediately.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Full Name *</label>
                  <input type="text" placeholder="Dr. Priya Sharma"
                    value={form.fullName}
                    onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Specialization</label>
                  <select
                    value={form.specialization}
                    onChange={(e) => setForm((p) => ({ ...p, specialization: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select specialty</option>
                    {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {[
                  { label: "Phone", key: "phone", type: "tel", placeholder: "+91 98765 43210" },
                  { label: "Email", key: "email", type: "email", placeholder: "doctor@hospital.com" },
                  { label: "Role at Hospital", key: "role", type: "text", placeholder: "Visiting Consultant" },
                  { label: "Years of Experience", key: "yearsOfExperience", type: "number", placeholder: "e.g. 10" },
                  { label: "Consultation Fee Min (₹)", key: "feeMin", type: "number", placeholder: "0" },
                  { label: "Consultation Fee Max (₹)", key: "feeMax", type: "number", placeholder: "500" },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">{f.label}</label>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={form[f.key as keyof typeof form]}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => void createDoctor()}
                disabled={saving}
                className="w-full py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition"
                style={{ background: "#1B8A4A" }}
              >
                {saving ? "Creating…" : "Create & Link Doctor"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function HospitalDashboardClient({ userFullName, userRole, hospitalId, hospitalName }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) ?? "appointments";

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [error, setError] = useState<string | null>(null);

  // Appointment state
  const [apptLoading, setApptLoading] = useState(false);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [apptFilter, setApptFilter] = useState<"pending" | "today" | "confirmed" | "all">("pending");
  const [actioning, setActioning] = useState<string | null>(null);
  const [acceptFees, setAcceptFees] = useState<Record<string, string>>({});
  const [acceptUrls, setAcceptUrls] = useState<Record<string, string>>({});

  // Doctor state
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctors, setDoctors] = useState<DoctorAffiliate[]>([]);
  const [showAddDoctor, setShowAddDoctor] = useState(false);

  // Patient state
  const [patientLoading, setPatientLoading] = useState(false);
  const [patients, setPatients] = useState<PatientRow[]>([]);

  // Billing state
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingRows, setBillingRows] = useState<BillingRow[]>([]);
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
  const [billingFilter, setBillingFilter] = useState<string>("all");

  // ── Data loaders ─────────────────────────────────────────────────────────

  const loadAppointments = useCallback(async () => {
    setApptLoading(true);
    try {
      const res = await fetch("/api/v1/portal/appointments?limit=100", { credentials: "include" });
      if (res.status === 401 || res.status === 403) { router.push("/portal/login"); return; }
      if (res.ok) {
        const j = await res.json() as { data: Appointment[] };
        setAppts(j.data ?? []);
      }
    } catch { /* non-fatal */ }
    finally { setApptLoading(false); }
  }, [router]);

  const loadDoctors = useCallback(async () => {
    if (!hospitalId) return;
    setDoctorLoading(true);
    try {
      const res = await fetch(`/api/v1/portal/doctors?hospitalId=${hospitalId}`, { credentials: "include" });
      if (res.ok) {
        const j = await res.json() as { data: DoctorAffiliate[] };
        setDoctors(j.data ?? []);
      }
    } finally { setDoctorLoading(false); }
  }, [hospitalId]);

  const loadPatients = useCallback(async () => {
    if (!hospitalId) return;
    setPatientLoading(true);
    try {
      const res = await fetch(`/api/v1/portal/patients?hospitalId=${hospitalId}&limit=100`, { credentials: "include" });
      if (res.ok) {
        const j = await res.json() as { data: PatientRow[] };
        setPatients(j.data ?? []);
      }
    } finally { setPatientLoading(false); }
  }, [hospitalId]);

  const loadBilling = useCallback(async (statusFilter?: string) => {
    if (!hospitalId) return;
    setBillingLoading(true);
    try {
      const params = new URLSearchParams({ hospitalId, limit: "100" });
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/v1/portal/billing?${params}`, { credentials: "include" });
      if (res.ok) {
        const j = await res.json() as { data: BillingRow[]; summary: BillingSummary };
        setBillingRows(j.data ?? []);
        setBillingSummary(j.summary ?? null);
      }
    } finally { setBillingLoading(false); }
  }, [hospitalId]);

  // Load on tab switch
  useEffect(() => {
    if (activeTab === "appointments") void loadAppointments();
    if (activeTab === "doctors")      void loadDoctors();
    if (activeTab === "patients")     void loadPatients();
    if (activeTab === "billing")      void loadBilling();
  }, [activeTab, loadAppointments, loadDoctors, loadPatients, loadBilling]);

  // ── Appointment actions ───────────────────────────────────────────────────

  async function act(id: string, action: "reject" | "complete", reason?: string) {
    setActioning(id); setError(null);
    try {
      const res = await fetch(`/api/v1/portal/appointments/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      if (res.ok) {
        const statusMap: Record<string, string> = { reject: "cancelled", complete: "completed" };
        setAppts((p) => p.map((a) => a.id === id ? { ...a, status: statusMap[action] ?? a.status } : a));
      } else {
        const j = await res.json().catch(() => ({})) as { error?: { message?: string } };
        setError(j?.error?.message ?? "Action failed.");
      }
    } catch { setError("Network error."); }
    finally { setActioning(null); }
  }

  async function acceptAppointment(id: string, type: string) {
    setActioning(id); setError(null);
    const isRemote = type !== "in_person";
    const feeStr = acceptFees[id];
    const url = acceptUrls[id];
    const body: Record<string, unknown> = { action: "accept" };
    if (isRemote && feeStr !== undefined) body.consultationFee = parseFloat(feeStr) || 0;
    if (url) body.meetingUrl = url;
    try {
      const res = await fetch(`/api/v1/portal/appointments/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const j = await res.json() as { data?: { meetingUrl?: string } };
        const fee = feeStr ? parseFloat(feeStr) : null;
        setAppts((p) => p.map((a) => a.id === id ? {
          ...a, status: "confirmed",
          consultationFee: fee,
          paymentStatus: fee && fee > 0 ? "pending" : (isRemote ? "waived" : "none"),
          meetingUrl: j.data?.meetingUrl ?? url ?? null,
        } : a));
      } else {
        const j = await res.json().catch(() => ({})) as { error?: { message?: string } };
        setError(j?.error?.message ?? "Action failed.");
      }
    } catch { setError("Network error."); }
    finally { setActioning(null); }
  }

  async function removeDoctor(doctorId: string) {
    if (!hospitalId) return;
    if (!confirm("Remove this doctor from your hospital?")) return;
    try {
      const res = await fetch(`/api/v1/portal/doctors?hospitalId=${hospitalId}&doctorId=${doctorId}`, {
        method: "DELETE", credentials: "include",
      });
      if (res.ok) setDoctors((p) => p.filter((d) => d.doctorId !== doctorId));
    } catch { /* non-fatal */ }
  }

  async function handleSignOut() {
    await fetch("/api/portal/logout", { method: "POST", credentials: "include" }).catch(() => {});
    router.push("/portal/login");
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const pending   = appts.filter((a) => a.status === "requested");
  const todayList = appts.filter((a) => isToday(a.scheduledAt));
  const confirmed = appts.filter((a) => a.status === "confirmed");

  const displayed =
    apptFilter === "pending"   ? pending :
    apptFilter === "today"     ? todayList :
    apptFilter === "confirmed" ? confirmed :
    appts;

  const stats = [
    { label: "Pending",   value: pending.length,   icon: "⏳", hi: pending.length > 0 },
    { label: "Today",     value: todayList.length,  icon: "📅", hi: false },
    { label: "Confirmed", value: confirmed.length,  icon: "✅", hi: false },
    { label: "Doctors",   value: doctors.length,    icon: "👨‍⚕️", hi: false },
  ];

  const navItems = [
    { tab: "appointments" as Tab, icon: "📅", label: "Appointments", badge: pending.length > 0 ? pending.length : null },
    { tab: "doctors"      as Tab, icon: "👨‍⚕️", label: "Doctors", badge: null },
    { tab: "patients"     as Tab, icon: "🧑‍🤝‍🧑", label: "Patients", badge: null },
    { tab: "billing"      as Tab, icon: "💰", label: "Billing", badge: null },
    { tab: "staff"        as Tab, icon: "👥", label: "Staff", badge: null },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-14 lg:w-60 bg-white border-r border-slate-200 flex flex-col shrink-0 sticky top-0 h-screen shadow-sm">
        <div className="px-3 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm" style={{ background: "#1B8A4A" }}>E</span>
          <div className="hidden lg:block min-w-0">
            <p className="font-bold text-slate-800 text-sm leading-tight truncate">EasyHeals</p>
            <p className="text-[10px] text-slate-400 truncate">{hospitalName ?? "Hospital Portal"}</p>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map((n) => (
            <button key={n.tab}
              onClick={() => setActiveTab(n.tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === n.tab ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}
              style={activeTab === n.tab ? { background: "#1B8A4A" } : {}}
            >
              <span className="text-base shrink-0">{n.icon}</span>
              <span className="hidden lg:block flex-1 text-left">{n.label}</span>
              {n.badge !== null && n.badge !== undefined && n.badge > 0 && (
                <span className={`hidden lg:flex w-5 h-5 rounded-full text-[10px] font-bold items-center justify-center ${activeTab === n.tab ? "bg-white/20 text-white" : "bg-amber-500 text-white"}`}>
                  {n.badge}
                </span>
              )}
            </button>
          ))}

          <div className="pt-2 border-t border-slate-100 mt-2 space-y-0.5">
            {[
              { href: "/portal/hospital",     icon: "✏️", label: "Edit Profile" },
              { href: "/portal/schedule",     icon: "📆", label: "Schedule" },
              { href: "/portal/queue",        icon: "🎫", label: "OPD Queue" },
              { href: "/portal/subscription", icon: "💳", label: "Subscription" },
              { href: "/portal/account",      icon: "👤", label: "My Account" },
            ].map((n) => (
              <Link key={n.label} href={n.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all">
                <span className="text-base shrink-0">{n.icon}</span>
                <span className="hidden lg:block">{n.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "#1B8A4A" }}>
              {userFullName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden lg:block min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{userFullName}</p>
              <p className="text-[10px] text-slate-400 capitalize">{userRole.replace("_", " ")}</p>
            </div>
          </div>
          <button onClick={() => void handleSignOut()} className="hidden lg:block mt-2 text-xs text-slate-400 hover:text-red-500 transition w-full text-left">Sign out →</button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                {activeTab === "appointments" ? "Appointments" :
                 activeTab === "doctors"      ? "Doctors" :
                 activeTab === "patients"     ? "Patient History" :
                 activeTab === "billing"      ? "Billing History" :
                 "Staff Management"}
              </h1>
              <p className="text-sm text-slate-400">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            {activeTab === "doctors" && (
              <button
                onClick={() => setShowAddDoctor(true)}
                className="text-sm font-semibold px-4 py-2 rounded-xl text-white shadow-sm transition"
                style={{ background: "#1B8A4A" }}
              >
                + Add Doctor
              </button>
            )}
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}

          {/* Stats row — always visible */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className={`bg-white rounded-xl border p-4 shadow-sm ${s.hi ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className={`text-3xl font-bold ${s.hi ? "text-amber-700" : "text-slate-800"}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── APPOINTMENTS TAB ──────────────────────────────────────────────── */}
          {activeTab === "appointments" && (
            <div className="space-y-4">
              {/* Filter bar */}
              <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                {([
                  { key: "pending",   label: "Pending Approval", count: pending.length },
                  { key: "today",     label: "Today",            count: todayList.length },
                  { key: "confirmed", label: "Confirmed",        count: confirmed.length },
                  { key: "all",       label: "All",              count: appts.length },
                ] as const).map((t) => (
                  <button key={t.key} onClick={() => setApptFilter(t.key)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${apptFilter === t.key ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    style={apptFilter === t.key ? { background: "#1B8A4A" } : {}}>
                    {t.label}
                    {t.count > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${apptFilter === t.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"}`}>{t.count}</span>
                    )}
                  </button>
                ))}
              </div>

              {apptLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
              ) : displayed.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                  <p className="text-4xl mb-3">📋</p>
                  <p className="text-slate-500 font-medium">No appointments in this view</p>
                  <p className="text-sm text-slate-400 mt-1">New appointment requests will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayed.map((appt) => (
                    <AppointmentCard
                      key={appt.id} appt={appt} actioning={actioning}
                      acceptFees={acceptFees} acceptUrls={acceptUrls}
                      onAccept={(id, type) => void acceptAppointment(id, type)}
                      onAct={(id, action, reason) => void act(id, action, reason)}
                      onFeeChange={(id, val) => setAcceptFees((p) => ({ ...p, [id]: val }))}
                      onUrlChange={(id, val) => setAcceptUrls((p) => ({ ...p, [id]: val }))}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── DOCTORS TAB ───────────────────────────────────────────────────── */}
          {activeTab === "doctors" && (
            <div className="space-y-4">
              {doctorLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
              ) : doctors.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                  <p className="text-4xl mb-3">👨‍⚕️</p>
                  <p className="text-slate-500 font-medium">No doctors added yet</p>
                  <p className="text-sm text-slate-400 mt-1">Add doctors to manage their appointments and schedules.</p>
                  <button
                    onClick={() => setShowAddDoctor(true)}
                    className="mt-4 px-5 py-2 text-sm font-semibold text-white rounded-xl"
                    style={{ background: "#1B8A4A" }}
                  >
                    + Add First Doctor
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {doctors.map((d) => (
                    <div key={d.doctorId} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-xl font-bold text-emerald-700 shrink-0">
                        {d.fullName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-slate-800">{d.fullName}</p>
                          {d.verified && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">✓ Verified</span>}
                          {d.isPrimary && <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">Primary</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{d.specialization ?? "General"} · {d.role}</p>
                        {(d.feeMin || d.feeMax) && (
                          <p className="text-xs text-slate-600 mt-1">
                            Fee: ₹{d.feeMin ?? 0}{d.feeMax ? ` – ₹${d.feeMax}` : "+"}
                          </p>
                        )}
                        {(d.phone || d.email) && (
                          <p className="text-xs text-slate-400 mt-1 truncate">{d.phone ?? d.email}</p>
                        )}
                      </div>
                      <button
                        onClick={() => void removeDoctor(d.doctorId)}
                        className="text-xs text-red-400 hover:text-red-600 transition shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── PATIENTS TAB ──────────────────────────────────────────────────── */}
          {activeTab === "patients" && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                <strong>Privacy note:</strong> Patient names are anonymised per DPDP Act 2023. You see a display alias only. Full records are accessible to treating doctors.
              </div>

              {patientLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
              ) : patients.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                  <p className="text-4xl mb-3">🧑‍🤝‍🧑</p>
                  <p className="text-slate-500 font-medium">No patient history yet</p>
                  <p className="text-sm text-slate-400 mt-1">Completed appointments will appear here.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["Patient", "Last Visit", "Doctor", "Visits", "Type"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {patients.map((p) => (
                        <tr key={p.patientId} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800 text-xs">{p.displayAlias}</p>
                            {p.city && <p className="text-[10px] text-slate-400">{p.city}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {formatDate(p.lastApptAt)}
                            <div className="mt-0.5"><StatusBadge status={p.lastApptStatus} /></div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">{p.lastDoctorName ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-slate-600 text-center">{p.appointmentCount}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {p.consultationTypes.slice(0, 2).map((t) => <TypeBadge key={t} type={t} />)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── BILLING TAB ───────────────────────────────────────────────────── */}
          {activeTab === "billing" && (
            <div className="space-y-4">
              {/* Summary cards */}
              {billingSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Billing Records", value: billingSummary.total,                                      icon: "📋", cls: "" },
                    { label: "Revenue Collected",     value: `₹${billingSummary.totalRevenue.toLocaleString("en-IN")}`, icon: "💚", cls: "border-emerald-200 bg-emerald-50" },
                    { label: "Pending Collection",    value: `₹${billingSummary.pendingRevenue.toLocaleString("en-IN")}`, icon: "⏳", cls: billingSummary.pendingRevenue > 0 ? "border-amber-200 bg-amber-50" : "" },
                    { label: "Paid Appointments",     value: billingSummary.paid,                                       icon: "✅", cls: "" },
                  ].map((s) => (
                    <div key={s.label} className={`bg-white rounded-xl border p-4 shadow-sm ${s.cls || "border-slate-200"}`}>
                      <div className="text-2xl mb-1">{s.icon}</div>
                      <div className="text-xl font-bold text-slate-800">{s.value}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Filter */}
              <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                {(["all", "paid", "pending", "waived", "none"] as const).map((f) => (
                  <button key={f} onClick={() => { setBillingFilter(f); void loadBilling(f === "all" ? undefined : f); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${billingFilter === f ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    style={billingFilter === f ? { background: "#1B8A4A" } : {}}>
                    {f === "all" ? "All" : f === "paid" ? "Paid" : f === "pending" ? "Pending" : f === "waived" ? "Waived/Free" : "Not Required"}
                  </button>
                ))}
              </div>

              {billingLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
              ) : billingRows.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                  <p className="text-4xl mb-3">💰</p>
                  <p className="text-slate-500 font-medium">No billing records yet</p>
                  <p className="text-sm text-slate-400 mt-1">Completed appointments with fees will appear here.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["Patient", "Doctor", "Type", "Date", "Fee", "Payment"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {billingRows.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3 text-xs text-slate-600">#{r.patientId.slice(0, 6)}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{r.doctorName ?? "—"}</td>
                          <td className="px-4 py-3"><TypeBadge type={r.type} /></td>
                          <td className="px-4 py-3 text-xs text-slate-600">{formatDate(r.scheduledAt ?? r.createdAt)}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-800">
                            {r.consultationFee ? `₹${r.consultationFee.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="px-4 py-3"><PaymentBadge status={r.paymentStatus} fee={r.consultationFee} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-xs text-slate-400 text-center">
                Showing consultation fees only. Lab orders and surgery billing coming in a future update.
              </p>
            </div>
          )}

          {/* ── STAFF TAB ─────────────────────────────────────────────────────── */}
          {activeTab === "staff" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
              <p className="text-4xl mb-3">👥</p>
              <p className="text-slate-600 font-semibold">Staff Management</p>
              <p className="text-sm text-slate-400 mt-1 mb-4">Add and manage receptionists, billing staff, and coordinators.</p>
              <Link href="/portal/staff"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl"
                style={{ background: "#1B8A4A" }}
              >
                Manage Staff →
              </Link>
            </div>
          )}

        </div>
      </main>

      {/* Add Doctor Modal */}
      {showAddDoctor && hospitalId && (
        <AddDoctorModal
          hospitalId={hospitalId}
          onClose={() => setShowAddDoctor(false)}
          onDone={() => void loadDoctors()}
        />
      )}
    </div>
  );
}
