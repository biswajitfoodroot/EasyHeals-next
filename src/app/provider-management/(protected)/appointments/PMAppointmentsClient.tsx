"use client";

/**
 * PMAppointmentsClient
 * Full-featured appointment management for Provider Management console.
 *
 * Features:
 * - Filters: hospital autocomplete, doctor (filtered by hospital), date range,
 *            appointment type, status
 * - Table: sortable columns, sticky header, vertical scroll, pagination with total
 * - Create form: hospital/doctor name autocomplete, In-Person/Audio/Video, Referred By
 * - EasyHeals Managed badge for admin-created appointments
 */

import { useEffect, useRef, useState, FormEvent } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppointmentRow {
  id: string;
  patientId: string | null;
  type: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string | null;
  patientNotes: string | null;
  sourcePlatform: string | null;
  doctorId: string | null;
  hospitalId: string | null;
  doctorName: string | null;
  hospitalName: string | null;
}

interface HospitalOption { id: string; name: string; city: string | null; }
interface DoctorOption  { id: string; fullName: string; specialization: string | null; }

type SortKey = "scheduledAt" | "createdAt" | "status" | "type" | "hospitalName" | "doctorName";
type SortDir = "asc" | "desc";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

const STATUS_COLORS: Record<string, string> = {
  requested:   "bg-yellow-100 text-yellow-800",
  confirmed:   "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed:   "bg-slate-100 text-slate-700",
  cancelled:   "bg-red-100 text-red-700",
  no_show:     "bg-orange-100 text-orange-700",
};

const TYPE_LABELS: Record<string, string> = {
  in_person:            "🏥 In-Person",
  audio_consultation:   "📞 Audio",
  video_consultation:   "🎥 Video",
  online_consultation:  "🎥 Online",
};

function fmt(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Autocomplete hook ─────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms = 300): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return dv;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AutocompleteInput<T extends { id: string }>({
  label,
  placeholder,
  value,
  onChange,
  onSelect,
  options,
  renderOption,
  required,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSelect: (item: T) => void;
  options: T[];
  renderOption: (item: T) => React.ReactNode;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-semibold text-slate-500 mb-1">{label}{required && " *"}</label>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => value.length >= 2 && setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-slate-50"
      />
      {open && options.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {options.map((item) => (
            <button
              key={item.id}
              type="button"
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-0"
              onMouseDown={(e) => { e.preventDefault(); onSelect(item); setOpen(false); }}
            >
              {renderOption(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PMAppointmentsClient() {

  // ── Table state ─────────────────────────────────────────────────────────────
  const [rows, setRows]       = useState<AppointmentRow[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("scheduledAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter]           = useState("all");
  const [typeFilter, setTypeFilter]               = useState("all");
  const [dateFrom, setDateFrom]                   = useState("");
  const [dateTo, setDateTo]                       = useState("");

  // Hospital filter autocomplete
  const [hospitalFilterText, setHospitalFilterText]   = useState("");
  const [hospitalFilterId, setHospitalFilterId]       = useState("");
  const [hospitalFilterOptions, setHospitalFilterOptions] = useState<HospitalOption[]>([]);
  const debouncedHospitalFilter = useDebounce(hospitalFilterText, 300);

  // Doctor filter autocomplete (filtered by selected hospital)
  const [doctorFilterText, setDoctorFilterText]       = useState("");
  const [doctorFilterId, setDoctorFilterId]           = useState("");
  const [doctorFilterOptions, setDoctorFilterOptions] = useState<DoctorOption[]>([]);
  const debouncedDoctorFilter = useDebounce(doctorFilterText, 300);

  // ── Create form state ────────────────────────────────────────────────────────
  const [showCreate, setShowCreate]   = useState(false);
  const [createBusy, setCreateBusy]   = useState(false);
  const [createMsg, setCreateMsg]     = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Create: hospital autocomplete
  const [hospText, setHospText]           = useState("");
  const [hospId, setHospId]               = useState("");
  const [hospOptions, setHospOptions]     = useState<HospitalOption[]>([]);
  const debouncedHosp = useDebounce(hospText, 300);

  // Create: doctor autocomplete (filtered by selected hospital)
  const [docText, setDocText]             = useState("");
  const [docId, setDocId]                 = useState("");
  const [docOptions, setDocOptions]       = useState<DoctorOption[]>([]);
  const debouncedDoc = useDebounce(docText, 300);

  // Create: referred-by autocomplete (doctors + agents by name)
  const [refText, setRefText]             = useState("");
  const [refOptions, setRefOptions]       = useState<DoctorOption[]>([]);
  const [refName, setRefName]             = useState(""); // final stored name
  const debouncedRef = useDebounce(refText, 300);

  // Create: remaining fields
  const [patientPhone, setPatientPhone]   = useState("");
  const [patientEmail, setPatientEmail]   = useState("");
  const [apptType, setApptType]           = useState<"in_person" | "audio_consultation" | "video_consultation">("in_person");
  const [scheduledAt, setScheduledAt]     = useState("");
  const [apptStatus, setApptStatus]       = useState<"confirmed" | "requested">("confirmed");
  const [notes, setNotes]                 = useState("");

  // ── Load table ───────────────────────────────────────────────────────────────
  async function loadRows(p: number) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(p * PAGE_SIZE) });
      if (statusFilter !== "all")   params.set("status", statusFilter);
      if (typeFilter !== "all")     params.set("type", typeFilter);
      if (hospitalFilterId)         params.set("hospitalId", hospitalFilterId);
      if (doctorFilterId)           params.set("doctorId", doctorFilterId);
      if (dateFrom)                 params.set("dateFrom", dateFrom);
      if (dateTo)                   params.set("dateTo", dateTo);

      const res = await fetch(`/api/admin/appointments?${params}`);
      if (res.ok) {
        const j = await res.json() as { data: AppointmentRow[]; meta: { total: number } };
        setRows(j.data ?? []);
        setTotal(j.meta?.total ?? 0);
        setPage(p);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadRows(0); }, [statusFilter, typeFilter, hospitalFilterId, doctorFilterId, dateFrom, dateTo]);

  // ── Hospital filter autocomplete ─────────────────────────────────────────────
  useEffect(() => {
    if (debouncedHospitalFilter.length < 2) { setHospitalFilterOptions([]); return; }
    fetch(`/api/admin/affiliations?searchHospitals=${encodeURIComponent(debouncedHospitalFilter)}`)
      .then((r) => r.json() as Promise<{ data?: HospitalOption[] }>)
      .then((j) => setHospitalFilterOptions(j.data ?? []))
      .catch(() => {});
  }, [debouncedHospitalFilter]);

  // ── Doctor filter autocomplete (by hospital or free text) ────────────────────
  useEffect(() => {
    if (hospitalFilterId) {
      // Load affiliated doctors for this hospital
      fetch(`/api/admin/affiliations?hospitalId=${hospitalFilterId}`)
        .then((r) => r.json() as Promise<{ data?: { doctorId: string; doctorName: string; doctorSpecialization: string | null }[] }>)
        .then((j) => setDoctorFilterOptions(
          (j.data ?? []).map((d) => ({ id: d.doctorId, fullName: d.doctorName, specialization: d.doctorSpecialization }))
        ))
        .catch(() => {});
    } else if (debouncedDoctorFilter.length >= 2) {
      fetch(`/api/admin/affiliations?searchDoctors=${encodeURIComponent(debouncedDoctorFilter)}`)
        .then((r) => r.json() as Promise<{ data?: DoctorOption[] }>)
        .then((j) => setDoctorFilterOptions(j.data ?? []))
        .catch(() => {});
    } else {
      setDoctorFilterOptions([]);
    }
  }, [hospitalFilterId, debouncedDoctorFilter]);

  // ── Create: hospital autocomplete ────────────────────────────────────────────
  useEffect(() => {
    if (debouncedHosp.length < 2) { setHospOptions([]); return; }
    fetch(`/api/admin/affiliations?searchHospitals=${encodeURIComponent(debouncedHosp)}`)
      .then((r) => r.json() as Promise<{ data?: HospitalOption[] }>)
      .then((j) => setHospOptions(j.data ?? []))
      .catch(() => {});
  }, [debouncedHosp]);

  // ── Create: doctor autocomplete (filtered by hospital or free text) ───────────
  useEffect(() => {
    if (hospId) {
      fetch(`/api/admin/affiliations?hospitalId=${hospId}`)
        .then((r) => r.json() as Promise<{ data?: { doctorId: string; doctorName: string; doctorSpecialization: string | null }[] }>)
        .then((j) => setDocOptions(
          (j.data ?? []).map((d) => ({ id: d.doctorId, fullName: d.doctorName, specialization: d.doctorSpecialization }))
        ))
        .catch(() => {});
    } else if (debouncedDoc.length >= 2) {
      fetch(`/api/admin/affiliations?searchDoctors=${encodeURIComponent(debouncedDoc)}`)
        .then((r) => r.json() as Promise<{ data?: DoctorOption[] }>)
        .then((j) => setDocOptions(j.data ?? []))
        .catch(() => {});
    } else {
      setDocOptions([]);
    }
  }, [hospId, debouncedDoc]);

  // ── Create: referred-by autocomplete ─────────────────────────────────────────
  useEffect(() => {
    if (debouncedRef.length < 2) { setRefOptions([]); return; }
    fetch(`/api/admin/affiliations?searchDoctors=${encodeURIComponent(debouncedRef)}`)
      .then((r) => r.json() as Promise<{ data?: DoctorOption[] }>)
      .then((j) => setRefOptions(j.data ?? []))
      .catch(() => {});
  }, [debouncedRef]);

  // ── Create submit ────────────────────────────────────────────────────────────
  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!hospId) { setCreateMsg({ type: "err", text: "Select a hospital from the dropdown." }); return; }
    setCreateBusy(true);
    setCreateMsg(null);
    try {
      const body: Record<string, string> = { hospitalId: hospId, type: apptType, status: apptStatus };
      if (docId)         body.doctorId       = docId;
      if (patientPhone)  body.patientPhone   = patientPhone;
      if (patientEmail)  body.patientEmail   = patientEmail;
      if (scheduledAt)   body.scheduledAt    = new Date(scheduledAt).toISOString();
      if (notes)         body.notes          = notes;
      if (refName)       body.referredByName = refName;

      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { data?: { patientName: string; hospitalName: string }; error?: { message: string } };
      if (!res.ok) {
        setCreateMsg({ type: "err", text: json.error?.message ?? "Failed to create appointment" });
      } else {
        setCreateMsg({ type: "ok", text: `Appointment created for ${json.data?.patientName ?? "patient"} at ${json.data?.hospitalName ?? "hospital"}` });
        // Reset form
        setHospText(""); setHospId(""); setDocText(""); setDocId("");
        setPatientPhone(""); setPatientEmail(""); setScheduledAt("");
        setNotes(""); setRefText(""); setRefName(""); setApptType("in_person");
        void loadRows(0);
      }
    } catch {
      setCreateMsg({ type: "err", text: "Network error. Please try again." });
    } finally {
      setCreateBusy(false);
    }
  }

  // ── Client-side sort ──────────────────────────────────────────────────────────
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const sorted = [...rows].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    return av < bv ? -dir : av > bv ? dir : 0;
  });

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-indigo-500 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Create Appointment Panel ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <button
          type="button"
          className="w-full p-4 border-b border-slate-100 bg-indigo-50/60 flex items-center justify-between text-left"
          onClick={() => { setShowCreate((v) => !v); setCreateMsg(null); }}
        >
          <div>
            <h2 className="text-sm font-bold text-slate-800">📅 Create Appointment</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Book on behalf of a patient — EasyHeals managed appointment
            </p>
          </div>
          <span className="text-slate-400 text-lg ml-4">{showCreate ? "▲" : "▼"}</span>
        </button>

        {showCreate && (
          <form onSubmit={(e) => void handleCreate(e)} className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Hospital autocomplete */}
            <AutocompleteInput<HospitalOption>
              label="Hospital"
              placeholder="Type hospital name…"
              value={hospText}
              onChange={(v) => { setHospText(v); if (!v) { setHospId(""); setDocText(""); setDocId(""); } }}
              onSelect={(h) => { setHospText(h.name); setHospId(h.id); setDocText(""); setDocId(""); }}
              options={hospOptions}
              renderOption={(h) => (
                <span>
                  <span className="font-medium">{h.name}</span>
                  {h.city && <span className="text-slate-400 text-xs ml-2">{h.city}</span>}
                </span>
              )}
              required
            />

            {/* Doctor autocomplete */}
            <AutocompleteInput<DoctorOption>
              label={hospId ? "Doctor (affiliated with selected hospital)" : "Doctor"}
              placeholder={hospId ? "Select hospital first, then pick doctor…" : "Type doctor name…"}
              value={docText}
              onChange={(v) => { setDocText(v); if (!v) setDocId(""); }}
              onSelect={(d) => { setDocText(d.fullName); setDocId(d.id); }}
              options={docOptions}
              renderOption={(d) => (
                <span>
                  <span className="font-medium">{d.fullName}</span>
                  {d.specialization && <span className="text-slate-400 text-xs ml-2">{d.specialization}</span>}
                </span>
              )}
            />

            {/* Patient phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Patient Phone <span className="font-normal text-slate-400">(+91XXXXXXXXXX)</span></label>
              <input
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="+91XXXXXXXXXX"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-slate-50"
              />
            </div>

            {/* Patient email */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Patient Email <span className="font-normal text-slate-400">(Google-auth)</span></label>
              <input
                type="email"
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
                placeholder="patient@gmail.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-slate-50"
              />
            </div>

            {/* Date & time */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Scheduled Date & Time</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-slate-50"
              />
            </div>

            {/* Type + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Type</label>
                <select
                  value={apptType}
                  onChange={(e) => setApptType(e.target.value as typeof apptType)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-slate-50"
                >
                  <option value="in_person">🏥 In-Person</option>
                  <option value="audio_consultation">📞 Audio</option>
                  <option value="video_consultation">🎥 Video</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                <select
                  value={apptStatus}
                  onChange={(e) => setApptStatus(e.target.value as typeof apptStatus)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-slate-50"
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="requested">Requested</option>
                </select>
              </div>
            </div>

            {/* Referred By */}
            <AutocompleteInput<DoctorOption>
              label="Referred By (doctor / agent)"
              placeholder="Type name to search…"
              value={refText}
              onChange={(v) => { setRefText(v); setRefName(v); }}
              onSelect={(d) => { setRefText(d.fullName); setRefName(d.fullName); }}
              options={refOptions}
              renderOption={(d) => (
                <span>
                  <span className="font-medium">{d.fullName}</span>
                  {d.specialization && <span className="text-slate-400 text-xs ml-2">{d.specialization}</span>}
                </span>
              )}
            />

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Notes <span className="font-normal text-slate-400">(optional)</span></label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for visit, symptoms…"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none resize-none bg-slate-50"
              />
            </div>

            {/* Message */}
            {createMsg && (
              <div className={`sm:col-span-2 p-3 rounded-xl text-sm ${createMsg.type === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {createMsg.text}
              </div>
            )}

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={createBusy}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {createBusy ? "Creating…" : "Create Appointment (EasyHeals Managed)"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Appointments Oversight ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

        {/* Header + filters */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-bold text-slate-800">Appointments Oversight</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {total > 0 ? `${total.toLocaleString("en-IN")} total` : "No appointments found"}
              </p>
            </div>
            <button
              onClick={() => void loadRows(page)}
              className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium"
            >
              Refresh
            </button>
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap gap-2">
            {/* Status */}
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

            {/* Type */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl outline-none"
            >
              <option value="all">All Types</option>
              <option value="in_person">🏥 In-Person</option>
              <option value="audio_consultation">📞 Audio</option>
              <option value="video_consultation">🎥 Video</option>
            </select>

            {/* Date from */}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl outline-none"
              placeholder="From date"
            />
            {/* Date to */}
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl outline-none"
              placeholder="To date"
            />
          </div>

          {/* Hospital + Doctor filter row */}
          <div className="flex flex-wrap gap-2">
            {/* Hospital filter */}
            <div className="relative min-w-[200px] flex-1">
              <input
                value={hospitalFilterText}
                onChange={(e) => {
                  setHospitalFilterText(e.target.value);
                  if (!e.target.value) { setHospitalFilterId(""); setDoctorFilterText(""); setDoctorFilterId(""); }
                }}
                placeholder="Filter by hospital…"
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl outline-none"
              />
              {hospitalFilterOptions.length > 0 && hospitalFilterText.length >= 2 && !hospitalFilterId && (
                <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {hospitalFilterOptions.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50"
                      onClick={() => { setHospitalFilterText(h.name); setHospitalFilterId(h.id); setHospitalFilterOptions([]); }}
                    >
                      <span className="font-medium">{h.name}</span>
                      {h.city && <span className="text-slate-400 text-xs ml-2">{h.city}</span>}
                    </button>
                  ))}
                </div>
              )}
              {hospitalFilterId && (
                <button
                  type="button"
                  onClick={() => { setHospitalFilterText(""); setHospitalFilterId(""); setDoctorFilterText(""); setDoctorFilterId(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
                >✕</button>
              )}
            </div>

            {/* Doctor filter */}
            <div className="relative min-w-[200px] flex-1">
              <input
                value={doctorFilterText}
                onChange={(e) => { setDoctorFilterText(e.target.value); if (!e.target.value) setDoctorFilterId(""); }}
                placeholder={hospitalFilterId ? "Filter by affiliated doctor…" : "Filter by doctor…"}
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl outline-none"
              />
              {doctorFilterOptions.length > 0 && !doctorFilterId && (
                <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {doctorFilterOptions.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50"
                      onClick={() => { setDoctorFilterText(d.fullName); setDoctorFilterId(d.id); setDoctorFilterOptions([]); }}
                    >
                      <span className="font-medium">{d.fullName}</span>
                      {d.specialization && <span className="text-slate-400 text-xs ml-2">{d.specialization}</span>}
                    </button>
                  ))}
                </div>
              )}
              {doctorFilterId && (
                <button
                  type="button"
                  onClick={() => { setDoctorFilterText(""); setDoctorFilterId(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
                >✕</button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <div className="max-h-[520px] overflow-y-auto">
            {loading ? (
              <div className="p-10 text-center text-slate-400 text-sm">Loading appointments…</div>
            ) : sorted.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm">No appointments match these filters.</div>
            ) : (
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      <button type="button" onClick={() => toggleSort("status")} className="flex items-center gap-0.5 hover:text-slate-700">
                        Status <SortIcon k="status" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      <button type="button" onClick={() => toggleSort("type")} className="flex items-center gap-0.5 hover:text-slate-700">
                        Type <SortIcon k="type" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      <button type="button" onClick={() => toggleSort("hospitalName")} className="flex items-center gap-0.5 hover:text-slate-700">
                        Hospital <SortIcon k="hospitalName" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      <button type="button" onClick={() => toggleSort("doctorName")} className="flex items-center gap-0.5 hover:text-slate-700">
                        Doctor <SortIcon k="doctorName" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      <button type="button" onClick={() => toggleSort("scheduledAt")} className="flex items-center gap-0.5 hover:text-slate-700">
                        Scheduled <SortIcon k="scheduledAt" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {a.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {TYPE_LABELS[a.type] ?? a.type}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 max-w-[180px] truncate">
                        {a.hospitalName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-[160px] truncate">
                        {a.doctorName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {fmt(a.scheduledAt)}
                      </td>
                      <td className="px-4 py-3">
                        {a.sourcePlatform === "admin" ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 whitespace-nowrap">
                            EasyHeals Managed
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">{a.sourcePlatform ?? "portal"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="p-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString("en-IN")}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => void loadRows(page - 1)}
                disabled={page === 0}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
              >
                ← Prev
              </button>
              <span className="px-3 py-1.5 text-xs text-slate-600">
                {page + 1} / {totalPages || 1}
              </span>
              <button
                onClick={() => void loadRows(page + 1)}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
