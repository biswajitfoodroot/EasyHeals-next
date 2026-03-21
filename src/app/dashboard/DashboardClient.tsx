"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// ── Types ────────────────────────────────────────────────────────────────────

type DashboardTab = "home" | "appointments" | "records" | "timeline" | "coach" | "reminders" | "profile" | "diet";

interface Appointment {
  id: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  patientNotes: string | null;
  doctorId: string | null;
  doctorName: string | null;
  hospitalId: string | null;
  hospitalName: string | null;
  hospitalCity: string | null;
  consultationFee: number | null;
  paymentStatus: string | null;
  meetingUrl: string | null;
  sessionId?: string | null;
}

interface HealthDocument {
  id: string;
  title: string | null;
  docType: string | null;
  fileType: string;
  sourceName: string | null;
  docDate: string | null;
  aiStatus: "pending" | "processing" | "done" | "failed";
  uploadedAt: string | null;
}

interface HealthEvent {
  id: string;
  eventType: string;
  eventDate: string | null;
  data: Record<string, unknown>;
}

interface PillReminder {
  id: string;
  name: string;
  dosage: string;
  times: string[]; // ["morning","afternoon","evening","night"]
  startDate: string;
  endDate?: string;
  notes?: string;
}

interface PillLog {
  reminderId: string;
  date: string; // YYYY-MM-DD
  time: string; // "morning" etc.
  taken: boolean;
}

interface VitalsEntry {
  id: string;
  date: string;
  bp?: string;
  pulse?: string;
  glucose?: string;
  weight?: string;
}

interface Caregiver {
  id: string;
  name: string;
  phone: string;
  relation: string;
}

interface TrialStatus {
  inTrial: boolean;
  trialDaysLeft: number;
  canUsePremium: boolean;
  tier: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDT(dt: string | null) {
  if (!dt) return "Time TBC";
  return new Date(dt).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const DOC_TYPE_LABELS: Record<string, string> = {
  lab_report: "Lab Report", prescription: "Prescription",
  discharge: "Discharge Summary", imaging: "Imaging / Scan", other: "Other",
};

const STATUS_COLOR: Record<string, string> = {
  requested: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-slate-100 text-slate-600 border-slate-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  no_show: "bg-orange-100 text-orange-700 border-orange-200",
};

const TIME_SLOTS = [
  { key: "morning",   label: "Morning",   time: "8:00 AM",  icon: "🌅" },
  { key: "afternoon", label: "Afternoon", time: "1:00 PM",  icon: "☀️" },
  { key: "evening",   label: "Evening",   time: "7:00 PM",  icon: "🌆" },
  { key: "night",     label: "Night",     time: "10:00 PM", icon: "🌙" },
];

// ── Shared tiny components ────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className ?? ""}`} />;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  if (type === "audio_consultation") return <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">📞 Audio</span>;
  if (type === "video_consultation" || type === "online_consultation") return <span className="text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">🎥 Video</span>;
  return <span className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">🏥 In-Person</span>;
}

function PremiumGate({ feature, desc }: { feature: string; desc?: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm bg-white/70 rounded-2xl">
      <div className="text-center max-w-xs px-6">
        <div className="text-4xl mb-3">⭐</div>
        <p className="font-bold text-slate-800 text-lg">{feature}</p>
        {desc && <p className="text-sm text-slate-500 mt-1">{desc}</p>}
        <Link href="/dashboard/upgrade"
          className="mt-4 inline-block px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm transition"
          style={{ background: "#1B8A4A" }}>
          Upgrade to Premium
        </Link>
        <p className="text-xs text-slate-400 mt-2">From ₹299/month</p>
      </div>
    </div>
  );
}

// ── LS helpers for pill reminders ─────────────────────────────────────────────

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; }
  catch { return fallback; }
}
function lsSet(key: string, val: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota */ }
}

// ── Appointments Tab ──────────────────────────────────────────────────────────

function AppointmentsTab({ appointments, loading }: { appointments: Appointment[]; loading: boolean }) {
  const [sub, setSub] = useState<"upcoming" | "past">("upcoming");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [apptDocs, setApptDocs] = useState<Record<string, HealthDocument[]>>({});
  const [docsLoading, setDocsLoading] = useState<string | null>(null);

  const upcoming = appointments.filter((a) => !["completed", "cancelled", "no_show"].includes(a.status))
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  const past = appointments.filter((a) => ["completed", "cancelled", "no_show"].includes(a.status))
    .sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""));
  const list = sub === "upcoming" ? upcoming : past;

  async function toggleExpand(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!apptDocs[id]) {
      setDocsLoading(id);
      try {
        const res = await fetch(`/api/v1/patients/documents?appointmentId=${id}`, { credentials: "include" });
        if (res.ok) {
          const j = await res.json() as { data: HealthDocument[] };
          setApptDocs((p) => ({ ...p, [id]: j.data ?? [] }));
        } else {
          setApptDocs((p) => ({ ...p, [id]: [] }));
        }
      } catch { setApptDocs((p) => ({ ...p, [id]: [] })); }
      finally { setDocsLoading(null); }
    }
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
          {(["upcoming", "past"] as const).map((t) => (
            <button key={t} onClick={() => setSub(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${sub === t ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              style={sub === t ? { background: "#1B8A4A" } : {}}>
              {t === "upcoming" ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
            </button>
          ))}
        </div>
        <Link href="/hospitals"
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition"
          style={{ background: "#1B8A4A" }}>
          + Book New Appointment
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <Sk key={i} className="h-28" />)}</div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <p className="text-3xl mb-3">{sub === "upcoming" ? "📅" : "📋"}</p>
          <p className="text-slate-500 font-medium">{sub === "upcoming" ? "No upcoming appointments" : "No past appointments"}</p>
          {sub === "upcoming" && (
            <Link href="/hospitals" className="mt-3 inline-block text-sm font-semibold px-4 py-2 rounded-xl text-white" style={{ background: "#1B8A4A" }}>
              Find a Doctor
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((appt) => {
            const isOpen = expanded === appt.id;
            const isRemote = ["audio_consultation", "video_consultation", "online_consultation"].includes(appt.type);
            const canJoin = isRemote && appt.status === "confirmed" && !!appt.meetingUrl &&
              (!appt.paymentStatus || appt.paymentStatus === "paid" || appt.paymentStatus === "waived" || appt.paymentStatus === "none");
            const needsPayment = isRemote && appt.status === "confirmed" && appt.paymentStatus === "pending";
            const docs = apptDocs[appt.id] ?? [];

            return (
              <div key={appt.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                {/* Card header — always visible */}
                <button onClick={() => void toggleExpand(appt.id)} className="w-full text-left p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <StatusBadge status={appt.status} />
                        <TypeBadge type={appt.type} />
                        {new Date(appt.scheduledAt ?? "").toDateString() === new Date().toDateString() && (
                          <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">TODAY</span>
                        )}
                      </div>
                      <p className="font-semibold text-slate-800 truncate">{appt.doctorName ?? "Doctor TBC"}</p>
                      <p className="text-sm text-slate-500">{appt.hospitalName ?? "Hospital TBC"}{appt.hospitalCity ? `, ${appt.hospitalCity}` : ""}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDT(appt.scheduledAt)}</p>
                    </div>
                    <span className="text-slate-400 text-lg shrink-0">{isOpen ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t border-slate-100 p-5 space-y-4">
                    {/* Notes & reason */}
                    {appt.patientNotes && (
                      <div className="text-xs text-slate-600 bg-slate-50 rounded-xl px-4 py-3">
                        <span className="font-semibold">Your notes:</span> {appt.patientNotes}
                      </div>
                    )}
                    {appt.cancellationReason && (
                      <div className="text-xs text-red-600 bg-red-50 rounded-xl px-4 py-3">
                        <span className="font-semibold">Cancellation reason:</span> {appt.cancellationReason}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {canJoin && (
                        <a href={appt.meetingUrl!} target="_blank" rel="noreferrer"
                          className="px-4 py-2 text-sm font-semibold text-white rounded-xl" style={{ background: "#1B8A4A" }}>
                          {appt.type === "video_consultation" ? "🎥" : "📞"} Join Session
                        </a>
                      )}
                      {needsPayment && (
                        <Link href={`/dashboard/appointments`}
                          className="px-4 py-2 text-sm font-semibold text-amber-700 border border-amber-200 bg-amber-50 rounded-xl">
                          ₹{appt.consultationFee} — Pay Now
                        </Link>
                      )}
                      {appt.status === "completed" && (
                        <Link href={`/dashboard/previsit-brief/${appt.id}`}
                          className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">
                          Pre-Visit Brief →
                        </Link>
                      )}
                    </div>

                    {/* Documents section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Visit Records</p>
                        <Link href={`/dashboard/documents?appointmentId=${appt.id}`}
                          className="text-xs font-semibold text-emerald-600 hover:underline">
                          + Upload Document
                        </Link>
                      </div>
                      {docsLoading === appt.id ? (
                        <Sk className="h-12" />
                      ) : docs.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">No documents attached to this visit yet.
                          <Link href={`/dashboard/documents?appointmentId=${appt.id}`} className="ml-1 text-emerald-600 hover:underline">Upload prescription or lab report →</Link>
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {docs.map((d) => (
                            <div key={d.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{d.title ?? "Untitled"}</p>
                                <p className="text-[10px] text-slate-400">{DOC_TYPE_LABELS[d.docType ?? ""] ?? "Document"} · {formatDate(d.docDate ?? d.uploadedAt)}</p>
                              </div>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ml-2 shrink-0 ${
                                d.aiStatus === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                d.aiStatus === "processing" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                "bg-slate-50 text-slate-600 border-slate-200"
                              }`}>{d.aiStatus === "done" ? "AI Extracted" : d.aiStatus === "processing" ? "Processing…" : "Queued"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Records Tab ───────────────────────────────────────────────────────────────

function RecordsTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<HealthDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState("other");
  const [showForm, setShowForm] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/patients/documents", { credentials: "include" });
      if (res.ok) { const j = await res.json() as { data: HealthDocument[] }; setDocs(j.data ?? []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadDocs(); }, [loadDocs]);

  async function upload() {
    if (!selectedFile) { setUploadMsg({ ok: false, text: "Pick a file first." }); return; }
    setUploading(true); setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("title", formTitle || selectedFile.name);
      fd.append("docType", formType);
      const res = await fetch("/api/v1/patients/documents", { method: "POST", body: fd, credentials: "include" });
      if (res.ok) {
        setUploadMsg({ ok: true, text: "Document uploaded. AI extraction in progress." });
        setSelectedFile(null); setFormTitle(""); setFormType("other"); setShowForm(false);
        void loadDocs();
      } else {
        const j = await res.json() as { error?: { userMessage?: string } };
        setUploadMsg({ ok: false, text: j?.error?.userMessage ?? "Upload failed." });
      }
    } catch { setUploadMsg({ ok: false, text: "Network error." }); }
    finally { setUploading(false); }
  }

  function handleFile(file: File) { setSelectedFile(file); setFormTitle(file.name.replace(/\.[^.]+$/, "")); setShowForm(true); }

  const filtered = filter === "all" ? docs : docs.filter((d) => d.docType === filter);

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer border-2 border-dashed rounded-2xl p-8 text-center transition ${dragOver ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-white hover:border-emerald-300"}`}
      >
        <p className="text-3xl mb-2">📤</p>
        <p className="font-semibold text-slate-700 text-sm">Drop prescription, lab report or scan here</p>
        <p className="text-xs text-slate-400 mt-1">or click to browse · PDF, JPG, PNG supported</p>
        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      {/* Upload form (shown after file selected) */}
      {showForm && selectedFile && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-5 space-y-3 shadow-sm">
          <p className="text-sm font-bold text-slate-700">Upload: {selectedFile.name}</p>
          {uploadMsg && (
            <p className={`text-xs p-2 rounded-lg ${uploadMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{uploadMsg.text}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Document Title</label>
              <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Document Type</label>
              <select value={formType} onChange={(e) => setFormType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800">
                {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void upload()} disabled={uploading}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
              style={{ background: "#1B8A4A" }}>
              {uploading ? "Uploading…" : "Upload Document"}
            </button>
            <button onClick={() => { setShowForm(false); setSelectedFile(null); setUploadMsg(null); }}
              className="px-4 text-sm font-semibold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {[["all", "All"], ...Object.entries(DOC_TYPE_LABELS)].map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${filter === k ? "text-white border-transparent" : "text-slate-600 border-slate-200 bg-white hover:bg-slate-50"}`}
            style={filter === k ? { background: "#1B8A4A" } : {}}>
            {v}
          </button>
        ))}
      </div>

      {/* Documents list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <Sk key={i} className="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-slate-500 font-medium">No documents yet</p>
          <p className="text-xs text-slate-400 mt-1">Upload your prescriptions, lab reports, or scans above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 hover:shadow-sm transition">
              <span className="text-2xl shrink-0">
                {d.docType === "lab_report" ? "🧪" : d.docType === "prescription" ? "💊" : d.docType === "imaging" ? "🩻" : "📄"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">{d.title ?? "Untitled"}</p>
                <p className="text-xs text-slate-400">{DOC_TYPE_LABELS[d.docType ?? ""] ?? "Document"} · {formatDate(d.docDate ?? d.uploadedAt)}</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                d.aiStatus === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                d.aiStatus === "processing" ? "bg-blue-50 text-blue-700 border-blue-200" :
                "bg-slate-50 text-slate-600 border-slate-200"
              }`}>
                {d.aiStatus === "done" ? "✓ AI Extracted" : d.aiStatus === "processing" ? "Processing…" : "Queued"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Timeline Tab ──────────────────────────────────────────────────────────────

function TimelineTab({ appointments }: { appointments: Appointment[] }) {
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const EVENT_ICONS: Record<string, string> = {
    vital: "💓", lab_result: "🧪", diagnosis: "🩺", medication: "💊",
    procedure: "🔬", device_reading: "📡",
  };
  const EVENT_COLORS: Record<string, string> = {
    vital: "text-pink-700 bg-pink-50 border-pink-200",
    lab_result: "text-purple-700 bg-purple-50 border-purple-200",
    diagnosis: "text-blue-700 bg-blue-50 border-blue-200",
    medication: "text-emerald-700 bg-emerald-50 border-emerald-200",
    procedure: "text-orange-700 bg-orange-50 border-orange-200",
    device_reading: "text-teal-700 bg-teal-50 border-teal-200",
  };

  useEffect(() => {
    fetch("/api/v1/patients/health-timeline?limit=100", { credentials: "include" })
      .then((r) => r.ok ? r.json() as Promise<{ data: HealthEvent[] }> : Promise.resolve({ data: [] }))
      .then((j) => setEvents(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Build month buckets for SVG bar chart
  const allDates = [
    ...events.map((e) => e.eventDate ?? e.data.date as string ?? null),
    ...appointments.filter((a) => a.completedAt ?? a.scheduledAt).map((a) => a.completedAt ?? a.scheduledAt),
  ].filter(Boolean) as string[];

  const buckets = new Map<string, { events: number; appts: number }>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(k, { events: 0, appts: 0 });
  }
  for (const dt of allDates) {
    const k = dt.slice(0, 7);
    if (buckets.has(k)) buckets.get(k)!.events++;
  }
  for (const a of appointments) {
    const dt = a.completedAt ?? a.scheduledAt;
    if (!dt) continue;
    const k = dt.slice(0, 7);
    if (buckets.has(k)) buckets.get(k)!.appts++;
  }
  const chartData = Array.from(buckets.entries()).map(([k, v]) => ({ k, ...v }));
  const maxVal = Math.max(1, ...chartData.map((d) => d.events));

  const filtered = filter === "all" ? events : events.filter((e) => e.eventType === filter);

  // Group by month for list
  const grouped = new Map<string, HealthEvent[]>();
  for (const e of filtered) {
    const d = e.eventDate ? new Date(e.eventDate) : null;
    const label = d ? d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "Unknown Date";
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label)!.push(e);
  }

  return (
    <div className="space-y-6">
      {/* SVG Bar Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-slate-700">12-Month Health Activity</p>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#1B8A4A", opacity: 0.7 }} /> Health Events</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block bg-amber-400" /> Appointments</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${chartData.length * 40} 160`} className="w-full" style={{ minWidth: "300px", height: "130px" }}>
            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <line key={f} x1="0" x2={chartData.length * 40} y1={120 - f * 100} y2={120 - f * 100}
                stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,4" />
            ))}
            {chartData.map(({ k, events: ev, appts }, i) => {
              const barH = ev > 0 ? Math.max(4, Math.round((ev / maxVal) * 100)) : 0;
              const cx = i * 40 + 20;
              const barX = i * 40 + 6;
              return (
                <g key={k}>
                  {barH > 0 && (
                    <rect x={barX} y={120 - barH} width={28} height={barH}
                      rx="4" fill="#1B8A4A" opacity={0.65} />
                  )}
                  {appts > 0 && (
                    <circle cx={cx} cy={Math.max(8, 120 - barH - 8)} r={5} fill="#F59E0B" />
                  )}
                  <text x={cx} y={148} textAnchor="middle" fontSize="9" fill="#94a3b8">
                    {new Date(k + "-01").toLocaleDateString("en-IN", { month: "short" })}
                  </text>
                  <text x={cx} y={158} textAnchor="middle" fontSize="8" fill="#cbd5e1">
                    {k.slice(2, 4)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {[["all", "All"], ["vital", "Vitals 💓"], ["lab_result", "Labs 🧪"], ["diagnosis", "Diagnoses 🩺"], ["medication", "Medications 💊"], ["procedure", "Procedures"]].map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${filter === k ? "text-white border-transparent" : "text-slate-600 border-slate-200 bg-white hover:bg-slate-50"}`}
            style={filter === k ? { background: "#1B8A4A" } : {}}>
            {v}
          </button>
        ))}
      </div>

      {/* Events list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <Sk key={i} className="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-3xl mb-2">📈</p>
          <p className="text-slate-500 font-medium">No health events yet</p>
          <p className="text-xs text-slate-400 mt-1">Upload reports and complete appointments to build your timeline.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([month, evts]) => (
            <div key={month}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{month}</p>
              <div className="space-y-2">
                {evts.map((e) => {
                  const parts: string[] = [];
                  if (e.data.name) parts.push(String(e.data.name));
                  if (e.data.value !== undefined) parts.push(`${e.data.value}${e.data.unit ? ` ${e.data.unit}` : ""}`);
                  if (e.data.dosage) parts.push(String(e.data.dosage));
                  if (e.data.notes) parts.push(String(e.data.notes));
                  const detail = parts.join(" · ") || "No details";
                  return (
                    <div key={e.id} className="flex items-start gap-3 bg-white rounded-xl border border-slate-200 p-3">
                      <span className={`text-sm px-2 py-1 rounded-lg border font-medium shrink-0 ${EVENT_COLORS[e.eventType] ?? "text-slate-600 bg-slate-50 border-slate-200"}`}>
                        {EVENT_ICONS[e.eventType] ?? "📌"} {e.eventType.replace(/_/g, " ")}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{detail}</p>
                        <p className="text-[10px] text-slate-400">{formatDate(e.eventDate)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AI Coach Tab ──────────────────────────────────────────────────────────────

function CoachTab({ canUsePremium }: { canUsePremium: boolean }) {
  const [mode, setMode] = useState<"chat" | "symptom">("chat");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    { role: "assistant", text: "Hello! I'm your EasyHeals AI Health Coach. I can help you understand your health reports, explain symptoms, and give personalised wellness guidance based on your records.\n\nWhat would you like to discuss today?" },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [symptoms, setSymptoms] = useState("");
  const [triageResult, setTriageResult] = useState<string | null>(null);
  const [triageLoading, setTriageLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || streaming) return;
    const userMsg = input.trim(); setInput("");
    setMessages((p) => [...p, { role: "user", text: userMsg }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/v1/patients/health-coach", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      if (!res.ok || !res.body) {
        setMessages((p) => [...p, { role: "assistant", text: "Sorry, I couldn't process that. Please try again." }]);
        return;
      }
      const reader = res.body.getReader(); const decoder = new TextDecoder();
      let partial = "";
      setMessages((p) => [...p, { role: "assistant", text: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const d = line.slice(6);
            if (d === "[DONE]") continue;
            try { partial += (JSON.parse(d) as { text: string }).text; } catch { partial += d; }
            setMessages((p) => { const n = [...p]; n[n.length - 1] = { role: "assistant", text: partial }; return n; });
          }
        }
      }
    } catch { setMessages((p) => [...p, { role: "assistant", text: "Network error. Please try again." }]); }
    finally { setStreaming(false); }
  }

  async function runTriage() {
    if (!symptoms.trim()) return;
    setTriageLoading(true); setTriageResult(null);
    try {
      const res = await fetch("/api/v1/patients/care-nav", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms }),
      });
      if (res.ok) { const j = await res.json() as { result?: string; recommendation?: string }; setTriageResult(j.result ?? j.recommendation ?? "No result."); }
      else setTriageResult("Could not analyse symptoms. Please try again.");
    } catch { setTriageResult("Network error."); }
    finally { setTriageLoading(false); }
  }

  return (
    <div className="space-y-4 relative">
      {!canUsePremium && (
        <PremiumGate
          feature="AI Health Coach"
          desc="Get personalised health guidance based on your reports, prescriptions, and medical history. Ask anything — from 'What does this lab result mean?' to 'What should I eat with diabetes?'"
        />
      )}

      {/* Mode toggle */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm w-fit">
        {(["chat", "symptom"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${mode === m ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            style={mode === m ? { background: "#1B8A4A" } : {}}>
            {m === "chat" ? "🤖 AI Health Coach Chat" : "🔍 Symptom Check"}
          </button>
        ))}
      </div>

      {/* Chat mode */}
      {mode === "chat" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" style={{ height: "500px" }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] text-sm px-4 py-2.5 rounded-2xl whitespace-pre-wrap ${m.role === "user" ? "text-white rounded-br-md" : "bg-slate-100 text-slate-800 rounded-bl-md"}`}
                  style={m.role === "user" ? { background: "#1B8A4A" } : {}}>
                  {m.text || (streaming ? <span className="inline-flex gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" /><span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0.15s" }} /><span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0.3s" }} /></span> : "")}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-slate-100 p-3 flex gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void sendMessage()}
              placeholder="Ask about your health, reports, medications…"
              disabled={streaming}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50" />
            <button onClick={() => void sendMessage()} disabled={streaming || !input.trim()}
              className="px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition"
              style={{ background: "#1B8A4A" }}>
              {streaming ? "…" : "Send"}
            </button>
          </div>
        </div>
      )}

      {/* Symptom check mode */}
      {mode === "symptom" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div>
            <p className="text-sm font-bold text-slate-700 mb-2">Describe your symptoms</p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
              ⚠️ This is for general guidance only. For emergencies, call 108 immediately.
            </p>
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="e.g. Fever for 2 days with headache and body ache, no cough. I am 45 years old, diabetic."
              rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            <button onClick={() => void runTriage()} disabled={triageLoading || !symptoms.trim()}
              className="mt-2 w-full py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition"
              style={{ background: "#1B8A4A" }}>
              {triageLoading ? "Analysing symptoms…" : "Analyse Symptoms"}
            </button>
          </div>
          {triageResult && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap">
              {triageResult}
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-slate-400 text-center">
        AI guidance is informational only. Always consult a qualified doctor for medical decisions.
      </p>
    </div>
  );
}

// ── Reminders Tab ─────────────────────────────────────────────────────────────

interface ScannedMed { name: string; dosage: string; frequency: string; duration: string; notes: string; }

function RemindersTab({ canUsePremium, appointments }: { canUsePremium: boolean; appointments: Appointment[] }) {
  const LS_LOG        = "eh_pill_log_v1";
  const LS_CAREGIVERS = "eh_caregivers_v1";

  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [pills, setPills] = useState<PillReminder[]>([]);
  const [pillLog, setPillLog] = useState<PillLog[]>([]);
  const [vitals, setVitals] = useState<VitalsEntry[]>([]);
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [pillsLoading, setPillsLoading] = useState(true);
  const [vitalsLoading, setVitalsLoading] = useState(true);
  const [showAddPill, setShowAddPill] = useState(false);
  const [showAddVital, setShowAddVital] = useState(false);
  const [showAddCaregiver, setShowAddCaregiver] = useState(false);

  // Prescription scan state
  const [scanLoading, setScanLoading] = useState(false);
  const [scannedMeds, setScannedMeds] = useState<ScannedMed[] | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedScanned, setSelectedScanned] = useState<Set<number>>(new Set());
  const scanFileRef = useRef<HTMLInputElement>(null);

  // Add pill form
  const [pName, setPName] = useState(""); const [pDosage, setPDosage] = useState("");
  const [pTimes, setPTimes] = useState<string[]>(["morning"]);
  const [pNotes, setPNotes] = useState("");

  // Vitals form
  const [vBP, setVBP] = useState(""); const [vPulse, setVPulse] = useState("");
  const [vGlucose, setVGlucose] = useState(""); const [vWeight, setVWeight] = useState("");

  // Caregiver form
  const [cgName, setCgName] = useState(""); const [cgPhone, setCgPhone] = useState("");
  const [cgRel, setCgRel] = useState("Family");

  useEffect(() => {
    // Pill log and caregivers remain local (session-scoped / device-scoped)
    setPillLog(lsGet<PillLog[]>(LS_LOG, []));
    setCaregivers(lsGet<Caregiver[]>(LS_CAREGIVERS, []));
    // Medications from API
    fetch("/api/v1/patients/medications", { credentials: "include" }).then(async (r) => {
      if (r.ok) {
        const j = await r.json() as { data?: Array<{ id: string; name: string; dosage: string | null; times: string[] | null; notes: string | null }> };
        setPills((j.data ?? []).map((m) => ({
          id: m.id, name: m.name,
          dosage: m.dosage ?? "",
          times: Array.isArray(m.times) && m.times.length > 0 ? m.times : ["morning"],
          startDate: "",
          notes: m.notes ?? "",
        })));
      }
    }).catch(() => {}).finally(() => setPillsLoading(false));
    // Vitals from API
    fetch("/api/v1/patients/vitals", { credentials: "include" }).then(async (r) => {
      if (r.ok) {
        const j = await r.json() as { data?: Array<{ id: string; recordedDate: string; bp: string | null; pulse: string | null; glucose: string | null; weight: string | null }> };
        setVitals((j.data ?? []).map((v) => ({
          id: v.id, date: v.recordedDate,
          bp: v.bp ?? undefined, pulse: v.pulse ?? undefined,
          glucose: v.glucose ?? undefined, weight: v.weight ?? undefined,
        })));
      }
    }).catch(() => {}).finally(() => setVitalsLoading(false));
  }, []);

  function toggleTaken(reminderId: string, time: string) {
    const today = todayStr();
    const existing = pillLog.find((l) => l.reminderId === reminderId && l.date === today && l.time === time);
    let newLog: PillLog[];
    if (existing) {
      newLog = pillLog.filter((l) => !(l.reminderId === reminderId && l.date === today && l.time === time));
    } else {
      newLog = [...pillLog, { reminderId, date: today, time, taken: true }];
    }
    setPillLog(newLog); lsSet(LS_LOG, newLog);
  }

  function isTaken(reminderId: string, time: string) {
    return pillLog.some((l) => l.reminderId === reminderId && l.date === todayStr() && l.time === time);
  }

  async function addPill() {
    if (!pName.trim()) return;
    try {
      const res = await fetch("/api/v1/patients/medications", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: pName.trim(), dosage: pDosage.trim() || null, times: pTimes, notes: pNotes.trim() || null }),
      });
      if (res.ok) {
        const j = await res.json() as { id?: string };
        const newPill: PillReminder = { id: j.id ?? crypto.randomUUID(), name: pName.trim(), dosage: pDosage.trim(), times: pTimes, startDate: "", notes: pNotes.trim() };
        setPills((prev) => [...prev, newPill]);
      }
    } catch { /* silent */ }
    setPName(""); setPDosage(""); setPTimes(["morning"]); setPNotes(""); setShowAddPill(false);
  }

  async function removePill(id: string) {
    setPills((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/v1/patients/medications/${id}`, { method: "DELETE", credentials: "include" }).catch(() => {});
  }

  async function addVital() {
    const payload = { recordedDate: todayStr(), bp: vBP || null, pulse: vPulse || null, glucose: vGlucose || null, weight: vWeight || null };
    try {
      const res = await fetch("/api/v1/patients/vitals", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const j = await res.json() as { id?: string };
        const v: VitalsEntry = { id: j.id ?? crypto.randomUUID(), date: todayStr(), bp: vBP || undefined, pulse: vPulse || undefined, glucose: vGlucose || undefined, weight: vWeight || undefined };
        setVitals((prev) => [v, ...prev].slice(0, 100));
      }
    } catch { /* silent */ }
    setVBP(""); setVPulse(""); setVGlucose(""); setVWeight(""); setShowAddVital(false);
  }

  function addCaregiver() {
    if (!cgName.trim() || !cgPhone.trim()) return;
    const cg: Caregiver = { id: crypto.randomUUID(), name: cgName.trim(), phone: cgPhone.trim(), relation: cgRel };
    const updated = [...caregivers, cg]; setCaregivers(updated); lsSet(LS_CAREGIVERS, updated);
    setCgName(""); setCgPhone(""); setCgRel("Family"); setShowAddCaregiver(false);
  }

  function removeCaregiver(id: string) {
    const updated = caregivers.filter((c) => c.id !== id); setCaregivers(updated); lsSet(LS_CAREGIVERS, updated);
  }

  async function handlePrescriptionScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanLoading(true); setScanError(null); setScannedMeds(null); setSelectedScanned(new Set());
    const fd = new FormData(); fd.append("file", file);
    try {
      const res = await fetch("/api/v1/patients/prescription-scan", { method: "POST", credentials: "include", body: fd });
      if (res.ok) {
        const j = await res.json() as { medications?: ScannedMed[] };
        const meds = j.medications ?? [];
        setScannedMeds(meds);
        setSelectedScanned(new Set(meds.map((_, i) => i)));
      } else {
        const j = await res.json() as { error?: string };
        setScanError(j.error ?? "Scan failed. Please try again.");
      }
    } catch { setScanError("Network error. Please try again."); }
    finally { setScanLoading(false); if (scanFileRef.current) scanFileRef.current.value = ""; }
  }

  async function addScannedMedications() {
    if (!scannedMeds) return;
    const toAdd = scannedMeds.filter((_, i) => selectedScanned.has(i));
    const added: PillReminder[] = [];
    for (const m of toAdd) {
      try {
        const notes = [m.frequency, m.duration, m.notes].filter(Boolean).join(" · ");
        const res = await fetch("/api/v1/patients/medications", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: m.name, dosage: m.dosage || null, times: ["morning"], notes: notes || null }),
        });
        if (res.ok) {
          const j = await res.json() as { id?: string };
          added.push({ id: j.id ?? crypto.randomUUID(), name: m.name, dosage: m.dosage || "", times: ["morning"], startDate: "", notes });
        }
      } catch { /* silent */ }
    }
    if (added.length > 0) setPills((prev) => [...prev, ...added]);
    setScannedMeds(null); setSelectedScanned(new Set());
  }

  const upcoming = appointments.filter((a) => ["requested", "confirmed"].includes(a.status))
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));

  return (
    <div className="space-y-6">
      {/* Simple / Advanced toggle */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm w-fit">
        {(["simple", "advanced"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${mode === m ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            style={mode === m ? { background: "#1B8A4A" } : {}}>
            {m === "simple" ? "Simple" : "Advanced"}
          </button>
        ))}
      </div>

      {/* ── Daily Pill Schedule ── */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm font-bold text-slate-700">Today's Medications</p>
          <div className="flex items-center gap-2">
            {canUsePremium && (
              <>
                <input ref={scanFileRef} type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={(e) => void handlePrescriptionScan(e)} />
                <button onClick={() => scanFileRef.current?.click()} disabled={scanLoading}
                  className="text-xs font-semibold text-purple-600 border border-purple-200 px-3 py-1 rounded-lg hover:bg-purple-50 disabled:opacity-60 flex items-center gap-1">
                  {scanLoading ? "Scanning…" : "📷 Scan Prescription"}
                </button>
              </>
            )}
            <button onClick={() => setShowAddPill(true)} className="text-xs font-semibold text-emerald-600 border border-emerald-200 px-3 py-1 rounded-lg hover:bg-emerald-50">+ Add Medication</button>
          </div>
        </div>

        {/* Prescription scan results */}
        {scanError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">{scanError}</div>
        )}
        {scannedMeds !== null && (
          <div className="border border-purple-200 rounded-xl p-4 bg-purple-50 space-y-3">
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">
              {scannedMeds.length === 0 ? "No medications detected" : `${scannedMeds.length} medication${scannedMeds.length !== 1 ? "s" : ""} found`}
            </p>
            {scannedMeds.map((m, i) => (
              <div key={i} className="flex items-start gap-3 bg-white rounded-lg border border-purple-100 p-3">
                <input type="checkbox" checked={selectedScanned.has(i)}
                  onChange={() => setSelectedScanned((prev) => {
                    const next = new Set(prev);
                    next.has(i) ? next.delete(i) : next.add(i);
                    return next;
                  })}
                  className="mt-0.5 shrink-0 accent-purple-600" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{m.name} {m.dosage && <span className="text-slate-500 font-normal">· {m.dosage}</span>}</p>
                  <p className="text-xs text-slate-500">{[m.frequency, m.duration].filter(Boolean).join(" · ")}</p>
                  {m.notes && <p className="text-xs text-slate-400 italic">{m.notes}</p>}
                </div>
              </div>
            ))}
            {scannedMeds.length > 0 && (
              <div className="flex gap-2 pt-1">
                <button onClick={addScannedMedications} disabled={selectedScanned.size === 0}
                  className="flex-1 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
                  style={{ background: "#1B8A4A" }}>
                  Add {selectedScanned.size} Selected Medication{selectedScanned.size !== 1 ? "s" : ""}
                </button>
                <button onClick={() => { setScannedMeds(null); setScanError(null); }}
                  className="px-4 text-sm font-semibold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50">
                  Dismiss
                </button>
              </div>
            )}
            {scannedMeds.length === 0 && (
              <button onClick={() => { setScannedMeds(null); setScanError(null); }}
                className="text-xs font-semibold text-slate-500 hover:underline">Dismiss</button>
            )}
          </div>
        )}

        {pills.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-3xl mb-2">💊</p>
            <p className="text-sm text-slate-500">No medications added yet</p>
            <button onClick={() => setShowAddPill(true)} className="mt-3 text-xs font-semibold text-emerald-600 hover:underline">Add your first medication →</button>
          </div>
        ) : (
          <div className="space-y-4">
            {TIME_SLOTS.map((slot) => {
              const slotPills = pills.filter((p) => p.times.includes(slot.key));
              if (slotPills.length === 0) return null;
              return (
                <div key={slot.key}>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{slot.icon} {slot.label} · {slot.time}</p>
                  <div className="space-y-2">
                    {slotPills.map((pill) => {
                      const taken = isTaken(pill.id, slot.key);
                      return (
                        <div key={pill.id + slot.key} className={`flex items-center justify-between p-3 rounded-xl border transition ${taken ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold ${taken ? "text-emerald-700 line-through" : "text-slate-800"}`}>{pill.name}</p>
                            {pill.dosage && <p className="text-xs text-slate-400">{pill.dosage}</p>}
                          </div>
                          <button
                            onClick={() => toggleTaken(pill.id, slot.key)}
                            className={`ml-3 shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition ${taken ? "bg-emerald-500 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-600"}`}>
                            {taken ? "✓ Taken" : "Mark Taken"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add pill form */}
        {showAddPill && (
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Add Medication</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-600 block mb-1">Medication Name *</label>
                <input type="text" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="e.g. Metformin"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Dosage</label>
                <input type="text" value={pDosage} onChange={(e) => setPDosage(e.target.value)} placeholder="e.g. 500mg"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Notes</label>
                <input type="text" value={pNotes} onChange={(e) => setPNotes(e.target.value)} placeholder="e.g. After meals"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">When to take</label>
              <div className="flex flex-wrap gap-2">
                {TIME_SLOTS.map((s) => (
                  <button key={s.key} type="button"
                    onClick={() => setPTimes((p) => p.includes(s.key) ? p.filter((x) => x !== s.key) : [...p, s.key])}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${pTimes.includes(s.key) ? "text-white border-transparent" : "text-slate-600 border-slate-200 bg-white"}`}
                    style={pTimes.includes(s.key) ? { background: "#1B8A4A" } : {}}>
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addPill} className="flex-1 py-2 text-sm font-semibold text-white rounded-xl" style={{ background: "#1B8A4A" }}>Save</button>
              <button onClick={() => setShowAddPill(false)} className="px-4 text-sm font-semibold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        )}
      </section>

      {/* Medications list (advanced mode) */}
      {mode === "advanced" && pills.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <p className="text-sm font-bold text-slate-700">All Medications</p>
          <div className="space-y-2">
            {pills.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{p.name} {p.dosage && <span className="text-slate-500 font-normal">· {p.dosage}</span>}</p>
                  <p className="text-xs text-slate-400">{p.times.join(", ")} · since {formatDate(p.startDate)}</p>
                  {p.notes && <p className="text-xs text-slate-400 italic">{p.notes}</p>}
                </div>
                <button onClick={() => removePill(p.id)} className="ml-3 text-xs text-red-500 hover:text-red-700 font-semibold shrink-0">Remove</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Appointment reminders */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <p className="text-sm font-bold text-slate-700">Upcoming Appointment Reminders</p>
        {upcoming.length === 0 ? (
          <p className="text-xs text-slate-400">No upcoming appointments. <Link href="/hospitals" className="text-emerald-600 font-semibold hover:underline">Book one →</Link></p>
        ) : (
          <div className="space-y-2">
            {upcoming.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{a.doctorName ?? "Doctor TBC"} · {a.hospitalName ?? ""}</p>
                  <p className="text-[10px] text-slate-400">{formatDT(a.scheduledAt)}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 ml-2">
                  ⏰ Reminder set
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Elder Care section (premium) */}
      <section className="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
        {!canUsePremium && <PremiumGate feature="Elder Care & Family Features" desc="Emergency contacts, daily check-in, vitals log, and caregiver alerts for peace of mind." />}

        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">👴</span>
          <p className="text-sm font-bold text-slate-700">Elder Care & Family Features</p>
          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">Premium</span>
        </div>

        {/* Vitals log */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Quick Vitals Log</p>
            <button onClick={() => setShowAddVital(!showAddVital)} className="text-xs font-semibold text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-50">
              + Log Today
            </button>
          </div>
          {showAddVital && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Blood Pressure", value: vBP, set: setVBP, placeholder: "e.g. 120/80" },
                  { label: "Pulse (bpm)", value: vPulse, set: setVPulse, placeholder: "e.g. 72" },
                  { label: "Blood Glucose (mg/dL)", value: vGlucose, set: setVGlucose, placeholder: "e.g. 110" },
                  { label: "Weight (kg)", value: vWeight, set: setVWeight, placeholder: "e.g. 72.5" },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">{f.label}</label>
                    <input type="text" value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={addVital} className="flex-1 py-2 text-xs font-semibold text-white rounded-lg" style={{ background: "#1B8A4A" }}>Save Vitals</button>
                <button onClick={() => setShowAddVital(false)} className="px-3 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          )}
          {vitals.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-100">{["Date","BP","Pulse","Glucose","Weight"].map((h) => <th key={h} className="text-left py-1.5 px-2 text-slate-400 font-semibold">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {vitals.slice(0, 7).map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="py-1.5 px-2 text-slate-600">{formatDate(v.date)}</td>
                      <td className="py-1.5 px-2 text-slate-600">{v.bp ?? "—"}</td>
                      <td className="py-1.5 px-2 text-slate-600">{v.pulse ?? "—"}</td>
                      <td className="py-1.5 px-2 text-slate-600">{v.glucose ?? "—"}</td>
                      <td className="py-1.5 px-2 text-slate-600">{v.weight ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Emergency contacts / Caregivers */}
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Emergency Contacts</p>
            <button onClick={() => setShowAddCaregiver(!showAddCaregiver)} className="text-xs font-semibold text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-50">+ Add</button>
          </div>
          {showAddCaregiver && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Name</label>
                  <input type="text" value={cgName} onChange={(e) => setCgName(e.target.value)} placeholder="e.g. Rahul"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Phone</label>
                  <input type="tel" value={cgPhone} onChange={(e) => setCgPhone(e.target.value)} placeholder="+91 98765 43210"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Relationship</label>
                  <select value={cgRel} onChange={(e) => setCgRel(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
                    {["Family", "Spouse", "Child", "Parent", "Sibling", "Friend", "Caregiver"].map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addCaregiver} className="flex-1 py-2 text-xs font-semibold text-white rounded-lg" style={{ background: "#1B8A4A" }}>Save Contact</button>
                <button onClick={() => setShowAddCaregiver(false)} className="px-3 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          )}
          {caregivers.length === 0 ? (
            <p className="text-xs text-slate-400">Add a family member or caregiver for emergency alerts.</p>
          ) : (
            <div className="space-y-2">
              {caregivers.map((cg) => (
                <div key={cg.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{cg.name} <span className="text-slate-400 font-normal">({cg.relation})</span></p>
                    <a href={`tel:${cg.phone}`} className="text-xs text-emerald-600 font-semibold hover:underline">{cg.phone}</a>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`tel:${cg.phone}`} className="text-xs text-white px-2.5 py-1 rounded-lg font-semibold" style={{ background: "#1B8A4A" }}>Call</a>
                    <button onClick={() => removeCaregiver(cg.id)} className="text-xs text-red-400 hover:text-red-600 font-semibold">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Daily check-in */}
        <div className="border-t border-slate-100 pt-4 space-y-2">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Daily Check-In</p>
          <p className="text-xs text-slate-500">Let your caregivers know you're doing well. Tap below to send today's check-in.</p>
          <button className="w-full py-2.5 text-sm font-semibold text-white rounded-xl flex items-center justify-center gap-2" style={{ background: "#1B8A4A" }}>
            💚 I'm doing well today
          </button>
          <p className="text-[10px] text-slate-400 text-center">Notifies your emergency contacts · Requires app for push/SMS</p>
        </div>

        {/* Elder-specific features (coming soon) */}
        <div className="border-t border-slate-100 pt-4 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">More Elder Care Features</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: "📱", label: "Fall Detection", badge: "Requires App" },
              { icon: "👨‍👩‍👧", label: "Family Health Summary", badge: "Coming Soon" },
              { icon: "🚑", label: "1-Tap Emergency SOS", badge: "Coming Soon" },
              { icon: "📊", label: "Weekly Health Report", badge: "Coming Soon" },
            ].map((f) => (
              <div key={f.label} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-lg mb-1">{f.icon}</p>
                <p className="text-xs font-semibold text-slate-700">{f.label}</p>
                <span className="text-[10px] text-slate-400">{f.badge}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Shared health profile store ───────────────────────────────────────────────

interface HealthProfile {
  height: string;
  weight: string;
  bloodGroup: string;
  conditions: string;
  allergies: string;
}

interface DietProfile {
  foodPref: "veg" | "non_veg" | "eggetarian" | "";
  foodLikes: string;
  foodDislikes: string;
}

interface FamilyMember {
  linkId: string;
  patientId: string;
  name: string;
  relation: string;
  city?: string | null;
  createdAt?: number | null;
}

interface AddressData {
  street: string;
  state: string;
  pincode: string;
  altPhone: string;
}

const LS_DIET_PROFILE = "eh_diet_profile_v1";

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab({ patientName, canUsePremium: _canUsePremium }: { patientName: string; canUsePremium: boolean }) {
  // DB fields
  const [displayName, setDisplayName] = useState(patientName);
  const [city, setCity]               = useState("");
  const [phone, setPhone]             = useState("");
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState<string | null>(null);

  // Address (API-backed)
  const [addr, setAddr] = useState<AddressData>({ street: "", state: "", pincode: "", altPhone: "" });
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [familyError, setFamilyError] = useState<string | null>(null);
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [fmName, setFmName] = useState(""); const [fmRel, setFmRel] = useState("Spouse");
  const [fmPhone, setFmPhone] = useState(""); const [fmSaving, setFmSaving] = useState(false);

  // Phone change modal
  const [changePhoneModal, setChangePhoneModal] = useState(false);
  const [cpStep, setCpStep] = useState<"request" | "verify_current" | "new_phone" | "verify_new" | "done">("request");
  const [cpOtp, setCpOtp]     = useState("");
  const [cpNewPhone, setCpNewPhone] = useState("");
  const [cpToken, setCpToken] = useState("");
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError]   = useState<string | null>(null);

  // Health profile (API-backed)
  const [hp, setHp] = useState<HealthProfile>({ height: "", weight: "", bloodGroup: "", conditions: "", allergies: "" });

  useEffect(() => {
    fetch("/api/v1/patients/me", { credentials: "include" }).then(async (r) => {
      if (r.ok) {
        const j = await r.json() as { patient?: { googleName?: string; displayAlias?: string; city?: string; phone?: string } };
        setDisplayName(j.patient?.displayAlias ?? j.patient?.googleName ?? patientName);
        setCity(j.patient?.city ?? "");
        setPhone(j.patient?.phone ?? "");
      }
    }).catch(() => {});
    fetch("/api/v1/patients/health-profile", { credentials: "include" }).then(async (r) => {
      if (r.ok) {
        const j = await r.json() as { data?: Partial<HealthProfile> };
        if (j.data) setHp({ height: j.data.height ?? "", weight: j.data.weight ?? "", bloodGroup: j.data.bloodGroup ?? "", conditions: j.data.conditions ?? "", allergies: j.data.allergies ?? "" });
      }
    }).catch(() => {});
    fetch("/api/v1/patients/address", { credentials: "include" }).then(async (r) => {
      if (r.ok) {
        const j = await r.json() as { data?: Partial<AddressData> };
        if (j.data) setAddr({ street: j.data.street ?? "", state: j.data.state ?? "", pincode: j.data.pincode ?? "", altPhone: j.data.altPhone ?? "" });
      }
    }).catch(() => {});
  }, [patientName]);

  useEffect(() => {
    if (!_canUsePremium) return;
    setFamilyLoading(true);
    fetch("/api/v1/patients/family", { credentials: "include" }).then(async (r) => {
      if (r.ok) {
        const j = await r.json() as { data?: FamilyMember[] };
        setFamily(j.data ?? []);
      }
    }).catch(() => {}).finally(() => setFamilyLoading(false));
  }, [_canUsePremium]);

  function saveHp(patch: Partial<HealthProfile>) { setHp((prev) => ({ ...prev, ...patch })); }
  function saveAddr(patch: Partial<AddressData>) { setAddr((prev) => ({ ...prev, ...patch })); }

  async function saveProfile() {
    setSaving(true); setSaveMsg(null);
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch("/api/v1/patients/me", {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayAlias: displayName.trim() || null, city: city.trim() || null }),
        }),
        fetch("/api/v1/patients/health-profile", {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(hp),
        }),
        fetch("/api/v1/patients/address", {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(addr),
        }),
      ]);
      if (r1.ok && r2.ok && r3.ok) setSaveMsg("Profile updated!");
      else setSaveMsg("Failed to save some fields. Please try again.");
    } catch { setSaveMsg("Network error."); }
    finally { setSaving(false); setTimeout(() => setSaveMsg(null), 3000); }
  }

  async function addFamily() {
    if (!fmName.trim() || !fmPhone.trim()) { setFamilyError("Name and phone number are required."); return; }
    setFmSaving(true); setFamilyError(null);
    try {
      const res = await fetch("/api/v1/patients/family", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fmName.trim(), phone: fmPhone.trim(), relation: fmRel }),
      });
      const j = await res.json() as { ok?: boolean; family?: FamilyMember; error?: string };
      if (res.ok && j.family) {
        setFamily((prev) => [...prev, j.family!]);
        setFmName(""); setFmRel("Spouse"); setFmPhone(""); setShowAddFamily(false);
      } else {
        setFamilyError(j.error ?? "Failed to add family member.");
      }
    } catch { setFamilyError("Network error."); }
    finally { setFmSaving(false); }
  }
  async function removeFamily(linkId: string) {
    try {
      const res = await fetch(`/api/v1/patients/family/${linkId}`, { method: "DELETE", credentials: "include" });
      if (res.ok) setFamily((prev) => prev.filter((m) => m.linkId !== linkId));
    } catch { /* silent fail */ }
  }

  // Phone change OTP flow
  async function cpSendOtp() {
    setCpLoading(true); setCpError(null);
    try {
      const res = await fetch("/api/v1/patients/change-phone", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "send_current_otp" }),
      });
      const j = await res.json() as { ok?: boolean; error?: string };
      if (res.ok && j.ok) setCpStep("verify_current");
      else setCpError(j.error ?? "Failed to send OTP.");
    } catch { setCpError("Network error."); }
    finally { setCpLoading(false); }
  }

  async function cpVerifyCurrent() {
    if (!cpOtp.trim()) return;
    setCpLoading(true); setCpError(null);
    try {
      const res = await fetch("/api/v1/patients/change-phone", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "verify_current_otp", otp: cpOtp.trim() }),
      });
      const j = await res.json() as { ok?: boolean; token?: string; error?: string };
      if (res.ok && j.ok) { setCpToken(j.token ?? ""); setCpStep("new_phone"); setCpOtp(""); }
      else setCpError(j.error ?? "Invalid OTP.");
    } catch { setCpError("Network error."); }
    finally { setCpLoading(false); }
  }

  async function cpSendNewOtp() {
    if (!cpNewPhone.trim()) return;
    setCpLoading(true); setCpError(null);
    try {
      const res = await fetch("/api/v1/patients/change-phone", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "send_new_otp", newPhone: cpNewPhone.trim(), token: cpToken }),
      });
      const j = await res.json() as { ok?: boolean; error?: string };
      if (res.ok && j.ok) { setCpStep("verify_new"); setCpOtp(""); }
      else setCpError(j.error ?? "Failed to send OTP to new number.");
    } catch { setCpError("Network error."); }
    finally { setCpLoading(false); }
  }

  async function cpConfirmNew() {
    if (!cpOtp.trim()) return;
    setCpLoading(true); setCpError(null);
    try {
      const res = await fetch("/api/v1/patients/change-phone", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "confirm_new_phone", otp: cpOtp.trim(), token: cpToken }),
      });
      const j = await res.json() as { ok?: boolean; error?: string };
      if (res.ok && j.ok) { setCpStep("done"); setPhone(cpNewPhone); }
      else setCpError(j.error ?? "Invalid OTP.");
    } catch { setCpError("Network error."); }
    finally { setCpLoading(false); }
  }

  function closePhoneModal() {
    setChangePhoneModal(false); setCpStep("request"); setCpOtp(""); setCpNewPhone(""); setCpToken(""); setCpError(null); setCpLoading(false);
  }

  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="space-y-6">

      {/* Personal Information */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <p className="text-sm font-bold text-slate-700">Personal Information</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Display Name</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your preferred name" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">City</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Mumbai" className={inputCls} />
          </div>
        </div>

        {/* Phone */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-600 block mb-1">Mobile Number (Primary)</label>
            <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl bg-slate-50">
              <span className="text-slate-400">📱</span>
              <span className="text-sm text-slate-700 font-medium">{phone || "—"}</span>
              <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-wider">Verified</span>
            </div>
          </div>
          <button onClick={() => setChangePhoneModal(true)}
            className="px-3 py-2 text-xs font-semibold text-emerald-600 border border-emerald-200 rounded-xl hover:bg-emerald-50 whitespace-nowrap">
            Change Number
          </button>
        </div>

        {/* Alternate phone */}
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Alternate Phone</label>
          <input type="tel" value={addr.altPhone} onChange={(e) => saveAddr({ altPhone: e.target.value })}
            placeholder="+91 98765 43210" className={inputCls} />
        </div>

        {/* Address */}
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Address / Street</label>
          <input type="text" value={addr.street} onChange={(e) => saveAddr({ street: e.target.value })}
            placeholder="e.g. 12 MG Road, Bandra West" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">State</label>
            <input type="text" value={addr.state} onChange={(e) => saveAddr({ state: e.target.value })}
              placeholder="e.g. Maharashtra" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">PIN Code</label>
            <input type="text" value={addr.pincode} onChange={(e) => saveAddr({ pincode: e.target.value })}
              placeholder="e.g. 400050" className={inputCls} />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-xs text-blue-700">
          💾 Address and alternate phone are saved locally on this device.
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => void saveProfile()} disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-60"
            style={{ background: "#1B8A4A" }}>
            {saving ? "Saving…" : "Save Name & City"}
          </button>
          {saveMsg && <p className={`text-xs font-medium ${saveMsg.includes("updated") ? "text-emerald-600" : "text-red-600"}`}>{saveMsg}</p>}
        </div>
      </section>

      {/* Health Profile */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700">Health Profile</p>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saved on device · used by Diet Plan</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {([
            { label: "Height (cm)", key: "height" as const, ph: "e.g. 170" },
            { label: "Weight (kg)", key: "weight" as const, ph: "e.g. 70" },
            { label: "Blood Group",  key: "bloodGroup" as const, ph: "e.g. B+" },
          ]).map(({ label, key, ph }) => (
            <div key={key}>
              <label className="text-xs font-semibold text-slate-600 block mb-1">{label}</label>
              <input type="text" value={hp[key]} onChange={(e) => saveHp({ [key]: e.target.value })} placeholder={ph} className={inputCls} />
            </div>
          ))}
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Medical Conditions</label>
          <input type="text" value={hp.conditions} onChange={(e) => saveHp({ conditions: e.target.value })}
            placeholder="e.g. Diabetes Type 2, Hypertension" className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Allergies / Intolerances</label>
          <input type="text" value={hp.allergies} onChange={(e) => saveHp({ allergies: e.target.value })}
            placeholder="e.g. Peanuts, Shellfish, Penicillin" className={inputCls} />
        </div>
      </section>

      {/* Family Profiles — PRO feature, max 5 */}
      <section className="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 overflow-hidden">
        {!_canUsePremium && (
          <PremiumGate
            feature="Family Profiles"
            desc="Add up to 5 family members. Each member gets their own EasyHeals account and can log in independently."
          />
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-700">Family Profiles <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded ml-1">PRO · up to 5</span></p>
            <p className="text-xs text-slate-400 mt-0.5">Each member gets their own EasyHeals account &amp; can log in with their phone</p>
          </div>
          {_canUsePremium && family.length < 5 && !showAddFamily && (
            <button onClick={() => { setShowAddFamily(true); setFamilyError(null); }} className="text-xs font-semibold text-emerald-600 border border-emerald-200 px-3 py-1 rounded-lg hover:bg-emerald-50">+ Add Member</button>
          )}
        </div>

        {familyError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{familyError}</p>}

        {_canUsePremium && familyLoading && (
          <p className="text-xs text-slate-400 text-center py-3">Loading family profiles…</p>
        )}

        {_canUsePremium && !familyLoading && family.length === 0 && !showAddFamily && (
          <div className="text-center py-4">
            <p className="text-2xl mb-1">👨‍👩‍👧‍👦</p>
            <p className="text-xs text-slate-500">No family profiles added yet. Add up to 5 members.</p>
          </div>
        )}

        {_canUsePremium && family.map((m) => (
          <div key={m.linkId} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">{m.name} <span className="text-slate-400 font-normal text-xs">· {m.relation}</span></p>
              {m.city && <p className="text-xs text-slate-400">{m.city}</p>}
              <p className="text-xs text-emerald-600 mt-0.5">✓ Has own EasyHeals account</p>
            </div>
            <button onClick={() => void removeFamily(m.linkId)} className="text-xs text-red-400 hover:text-red-600 ml-3 shrink-0">Remove</button>
          </div>
        ))}

        {_canUsePremium && showAddFamily && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs text-slate-500">A new EasyHeals account will be created for this member. They can log in using their phone number or Google.</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Name *</label>
                <input type="text" value={fmName} onChange={(e) => setFmName(e.target.value)} placeholder="e.g. Priya Sharma" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Relation</label>
                <select value={fmRel} onChange={(e) => setFmRel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {["Spouse", "Child", "Parent", "Sibling", "Grandparent", "Other"].map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-600 block mb-1">Phone Number *</label>
                <input type="tel" value={fmPhone} onChange={(e) => setFmPhone(e.target.value)} placeholder="+91 98765 43210" className={inputCls} />
                <p className="text-[10px] text-slate-400 mt-0.5">They&apos;ll use this to log in to their account</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => void addFamily()} disabled={fmSaving} className="flex-1 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-60" style={{ background: "#1B8A4A" }}>
                {fmSaving ? "Creating…" : "Create Family Profile"}
              </button>
              <button onClick={() => { setShowAddFamily(false); setFamilyError(null); }} className="px-4 text-sm font-semibold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        )}
      </section>

      {/* Phone Change Modal */}
      {changePhoneModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closePhoneModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-800">Change Phone Number</p>
              <button onClick={closePhoneModal} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>

            {cpStep === "request" && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">We&apos;ll send an OTP to your current number <strong>{phone}</strong> to verify your identity before changing.</p>
                {cpError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{cpError}</p>}
                <button onClick={() => void cpSendOtp()} disabled={cpLoading}
                  className="w-full py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60"
                  style={{ background: "#1B8A4A" }}>
                  {cpLoading ? "Sending…" : "Send OTP to Current Number"}
                </button>
              </div>
            )}

            {cpStep === "verify_current" && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">Enter the OTP sent to <strong>{phone}</strong></p>
                <input type="text" inputMode="numeric" maxLength={6} value={cpOtp} onChange={(e) => setCpOtp(e.target.value)}
                  placeholder="6-digit OTP" className={inputCls} />
                {cpError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{cpError}</p>}
                <button onClick={() => void cpVerifyCurrent()} disabled={cpLoading || cpOtp.length < 4}
                  className="w-full py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60"
                  style={{ background: "#1B8A4A" }}>
                  {cpLoading ? "Verifying…" : "Verify OTP"}
                </button>
              </div>
            )}

            {cpStep === "new_phone" && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">Identity verified! Enter your new mobile number.</p>
                <input type="tel" value={cpNewPhone} onChange={(e) => setCpNewPhone(e.target.value)}
                  placeholder="+91 98765 43210" className={inputCls} />
                {cpError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{cpError}</p>}
                <button onClick={() => void cpSendNewOtp()} disabled={cpLoading || !cpNewPhone.trim()}
                  className="w-full py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60"
                  style={{ background: "#1B8A4A" }}>
                  {cpLoading ? "Sending…" : "Send OTP to New Number"}
                </button>
              </div>
            )}

            {cpStep === "verify_new" && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">Enter the OTP sent to <strong>{cpNewPhone}</strong></p>
                <input type="text" inputMode="numeric" maxLength={6} value={cpOtp} onChange={(e) => setCpOtp(e.target.value)}
                  placeholder="6-digit OTP" className={inputCls} />
                {cpError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{cpError}</p>}
                <button onClick={() => void cpConfirmNew()} disabled={cpLoading || cpOtp.length < 4}
                  className="w-full py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60"
                  style={{ background: "#1B8A4A" }}>
                  {cpLoading ? "Updating…" : "Confirm & Update Number"}
                </button>
              </div>
            )}

            {cpStep === "done" && (
              <div className="text-center py-2 space-y-3">
                <p className="text-3xl">✅</p>
                <p className="font-bold text-slate-800">Phone updated to {cpNewPhone}</p>
                <button onClick={closePhoneModal} className="w-full py-2.5 text-sm font-semibold text-white rounded-xl" style={{ background: "#1B8A4A" }}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Diet Plan Tab ─────────────────────────────────────────────────────────────

function DietPlanTab({ canUsePremium }: { canUsePremium: boolean }) {
  const [dp, setDp] = useState<DietProfile>(() => lsGet<DietProfile>(LS_DIET_PROFILE, { foodPref: "", foodLikes: "", foodDislikes: "" }));
  const [plan, setPlan]       = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [recentVitals, setRecentVitals] = useState<VitalsEntry[]>([]);
  const [hp, setHp] = useState<HealthProfile>({ height: "", weight: "", bloodGroup: "", conditions: "", allergies: "" });

  useEffect(() => {
    fetch("/api/v1/patients/vitals", { credentials: "include" }).then(async (r) => {
      if (r.ok) {
        const j = await r.json() as { data?: Array<{ id: string; recordedDate: string; bp: string | null; pulse: string | null; glucose: string | null; weight: string | null }> };
        setRecentVitals((j.data ?? []).slice(0, 7).map((v) => ({
          id: v.id, date: v.recordedDate,
          bp: v.bp ?? undefined, pulse: v.pulse ?? undefined,
          glucose: v.glucose ?? undefined, weight: v.weight ?? undefined,
        })));
      }
    }).catch(() => {});
    fetch("/api/v1/patients/health-profile", { credentials: "include" }).then(async (r) => {
      if (r.ok) {
        const j = await r.json() as { data?: Partial<HealthProfile> };
        if (j.data) setHp({ height: j.data.height ?? "", weight: j.data.weight ?? "", bloodGroup: j.data.bloodGroup ?? "", conditions: j.data.conditions ?? "", allergies: j.data.allergies ?? "" });
      }
    }).catch(() => {});
  }, []);

  function saveDp(patch: Partial<DietProfile>) { const u = { ...dp, ...patch }; setDp(u); lsSet(LS_DIET_PROFILE, u); }

  async function generatePlan() {
    if (!canUsePremium) return;
    setLoading(true); setError(null); setPlan(null);
    try {
      const res = await fetch("/api/v1/patients/diet-plan", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...hp, ...dp, vitals: recentVitals }),
      });
      if (res.ok) { const j = await res.json() as { plan?: string }; setPlan(j.plan ?? "No plan generated."); }
      else { const j = await res.json() as { error?: string }; setError(j.error ?? "Failed to generate plan."); }
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="space-y-6">

      {/* Food Preferences */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div>
          <p className="text-sm font-bold text-slate-700">Food Preferences</p>
          <p className="text-xs text-slate-400 mt-0.5">Used to personalise your AI diet plan</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-2">Diet Type</label>
          <div className="flex flex-wrap gap-2">
            {([
              { val: "veg",        label: "🥦 Vegetarian" },
              { val: "non_veg",    label: "🍗 Non-Vegetarian" },
              { val: "eggetarian", label: "🥚 Eggetarian" },
            ] as const).map(({ val, label }) => (
              <button key={val} type="button" onClick={() => saveDp({ foodPref: val })}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${dp.foodPref === val ? "text-white border-transparent" : "text-slate-600 border-slate-200 bg-white hover:border-emerald-400"}`}
                style={dp.foodPref === val ? { background: "#1B8A4A" } : {}}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Foods I Love</label>
            <input type="text" value={dp.foodLikes} onChange={(e) => saveDp({ foodLikes: e.target.value })}
              placeholder="e.g. Rice, Dal, Idli, Dosa" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Foods I Avoid</label>
            <input type="text" value={dp.foodDislikes} onChange={(e) => saveDp({ foodDislikes: e.target.value })}
              placeholder="e.g. Spicy food, Fried items" className={inputCls} />
          </div>
        </div>
      </section>

      {/* Weekly Progress Snapshot */}
      {recentVitals.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-700">Recent Vitals (Last 7 Readings)</p>
            <span className="text-xs text-slate-400">AI will analyse these for your plan</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-slate-100">
                {["Date","Weight","BP","Glucose"].map((h) => <th key={h} className="text-left py-1.5 px-2 text-slate-400 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {recentVitals.map((v) => (
                  <tr key={v.id}>
                    <td className="py-1.5 px-2 text-slate-600">{formatDate(v.date)}</td>
                    <td className="py-1.5 px-2 text-slate-600">{v.weight ? `${v.weight} kg` : "—"}</td>
                    <td className="py-1.5 px-2 text-slate-600">{v.bp ?? "—"}</td>
                    <td className="py-1.5 px-2 text-slate-600">{v.glucose ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">Log vitals in <strong>Reminders</strong> tab to improve analysis accuracy.</p>
        </section>
      )}

      {recentVitals.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          📊 No vitals recorded yet. Log weight, glucose, and BP in the <strong>Reminders</strong> tab for AI to analyse weekly progress and improvements.
        </div>
      )}

      {/* AI Diet Plan Generation */}
      <section className="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 overflow-hidden">
        {!canUsePremium && (
          <PremiumGate
            feature="AI Diet Plan"
            desc="Get a personalised weekly diet plan with progress analysis — tailored to your health profile, vitals, and food preferences."
          />
        )}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-bold text-slate-700">AI Weekly Diet Plan + Progress Analysis</p>
            <p className="text-xs text-slate-400 mt-0.5">Gemini analyses your weekly vitals trends and generates an adaptive plan</p>
          </div>
          <button onClick={() => void generatePlan()} disabled={loading || !canUsePremium}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm disabled:opacity-60 transition"
            style={{ background: "#1B8A4A" }}>
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analysing…</>
            ) : "✨ Generate This Week's Plan"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        {plan && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Your Personalised Diet Plan</p>
              <span className="text-xs text-emerald-600">Generated {new Date().toLocaleDateString("en-IN")}</span>
            </div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{plan}</div>
          </div>
        )}

        {!plan && !loading && (
          <div className={`text-center py-8 ${!canUsePremium ? "blur-sm select-none pointer-events-none" : ""}`}>
            <p className="text-4xl mb-3">🥗</p>
            <p className="text-sm font-medium text-slate-600">Set your food preferences above, then generate your plan.</p>
            <p className="text-xs text-slate-400 mt-1">{recentVitals.length > 0 ? `AI will analyse ${recentVitals.length} recent vitals readings for progress insights.` : "Add vitals in Reminders tab for progress-aware suggestions."}</p>
          </div>
        )}
      </section>

      {/* Dietitian CTA */}
      <section className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl border border-teal-200 p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-100 border border-teal-200 flex items-center justify-center text-2xl shrink-0">🥦</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm">Need a Dietitian?</p>
            <p className="text-xs text-slate-600 mt-1">Get a 1-on-1 consultation with a certified clinical dietitian who can create a detailed, medically-tailored plan.</p>
            <a href="/doctors?specialty=dietitian"
              className="inline-block mt-3 px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition"
              style={{ background: "#1B8A4A" }}>
              Find a Dietitian →
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as DashboardTab) ?? "home";

  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [docsCount, setDocsCount] = useState(0);
  const [trial, setTrial] = useState<TrialStatus>({ inTrial: false, trialDaysLeft: 0, canUsePremium: false, tier: "free" });
  const [patientName, setPatientName] = useState("there");

  function switchTab(tab: DashboardTab) {
    setActiveTab(tab);
    router.replace(`/dashboard?tab=${tab}`, { scroll: false });
  }

  async function refreshSubscription() {
    const r = await fetch("/api/v1/patients/subscription", { credentials: "include", cache: "no-store" });
    if (r.ok) { const j = await r.json() as { data: TrialStatus }; setTrial(j.data); }
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.allSettled([
        fetch("/api/v1/appointments?limit=100", { credentials: "include" }).then(async (r) => {
          if (r.ok) { const j = await r.json() as { data: Appointment[] }; setAppointments(j.data ?? []); }
        }),
        fetch("/api/v1/patients/documents", { credentials: "include" }).then(async (r) => {
          if (r.ok) { const j = await r.json() as { data: unknown[] }; setDocsCount(j.data?.length ?? 0); }
        }),
        fetch("/api/v1/patients/subscription", { credentials: "include", cache: "no-store" }).then(async (r) => {
          if (r.ok) { const j = await r.json() as { data: TrialStatus }; setTrial(j.data); }
        }),
        fetch("/api/v1/patients/me", { credentials: "include" }).then(async (r) => {
          if (r.ok) { const j = await r.json() as { patient?: { name?: string; googleName?: string } }; setPatientName(j.patient?.googleName ?? j.patient?.name ?? "there"); }
        }),
      ]);
      setLoading(false);
    }
    void init();

    // Re-fetch subscription when user returns to this tab (e.g. after changing tier in /dev)
    const onFocus = () => void refreshSubscription();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function handleSignOut() {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    router.push("/login");
  }

  const upcoming = appointments.filter((a) => !["completed", "cancelled", "no_show"].includes(a.status));
  const nextAppt = upcoming[0] ?? null;

  const NAV_ITEMS: { tab: DashboardTab; icon: string; label: string; premium?: boolean }[] = [
    { tab: "home",         icon: "🏠", label: "Home" },
    { tab: "appointments", icon: "📅", label: "My Appointments" },
    { tab: "records",      icon: "📋", label: "My Records" },
    { tab: "timeline",     icon: "📈", label: "Health Timeline" },
    { tab: "coach",        icon: "🤖", label: "AI Health Coach", premium: true },
    { tab: "reminders",    icon: "💊", label: "Reminders",       premium: true },
    { tab: "diet",         icon: "🥗", label: "Diet Plan",        premium: true },
    { tab: "profile",      icon: "👤", label: "My Profile" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ── Sidebar ── */}
      <aside className="w-14 lg:w-60 bg-white border-r border-slate-200 flex flex-col shrink-0 sticky top-0 h-screen shadow-sm">
        {/* Logo */}
        <div className="px-3 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm" style={{ background: "#1B8A4A" }}>E</span>
          <div className="hidden lg:block">
            <p className="font-bold text-slate-800 text-sm leading-tight">EasyHeals</p>
            <p className="text-[10px] text-slate-400">Patient Dashboard</p>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((n) => (
            <button key={n.tab} onClick={() => switchTab(n.tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === n.tab ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}
              style={activeTab === n.tab ? { background: "#1B8A4A" } : {}}>
              <span className="text-base shrink-0">{n.icon}</span>
              <span className="hidden lg:flex lg:flex-1 lg:items-center lg:gap-1.5">
                {n.label}
                {n.premium && !trial.canUsePremium && (
                  <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded ml-auto">PRO</span>
                )}
              </span>
            </button>
          ))}

          <div className="pt-2 border-t border-slate-100 mt-2">
            <Link href="/dashboard/privacy"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all">
              <span className="text-base shrink-0">🔒</span>
              <span className="hidden lg:block">Privacy</span>
            </Link>
            {!trial.canUsePremium && (
              <Link href="/dashboard/upgrade"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-amber-600 hover:bg-amber-50 transition-all border border-amber-200 mt-1">
                <span className="text-base shrink-0">⭐</span>
                <span className="hidden lg:block">Upgrade</span>
              </Link>
            )}
          </div>
        </nav>

        {/* User info */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "#1B8A4A" }}>
              {patientName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden lg:block min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{patientName}</p>
              <p className="text-[10px] text-slate-400 capitalize">{trial.tier === "free" ? "Free Plan" : trial.tier}</p>
            </div>
          </div>
          <button onClick={() => void handleSignOut()} className="hidden lg:block mt-2 text-xs text-slate-400 hover:text-red-500 transition w-full text-left">
            Sign out →
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

          {/* Page title */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                {activeTab === "home"         ? `${getGreeting()}, ${patientName.split(" ")[0]}` :
                 activeTab === "appointments" ? "My Appointments" :
                 activeTab === "records"      ? "My Records" :
                 activeTab === "timeline"     ? "Health Timeline" :
                 activeTab === "coach"        ? "AI Health Coach" :
                 activeTab === "diet"         ? "Diet Plan" :
                 activeTab === "profile"      ? "My Profile" :
                 "Care Reminders"}
              </h1>
              <p className="text-sm text-slate-400">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* ── HOME TAB ── */}
          {activeTab === "home" && (
            <div className="space-y-5">
              {/* Next appointment */}
              {loading ? <Sk className="h-32" /> : nextAppt ? (
                <div className="bg-white rounded-2xl border-2 p-5 shadow-sm" style={{ borderColor: "#1B8A4A" }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Next Appointment</span>
                        <StatusBadge status={nextAppt.status} />
                      </div>
                      <p className="font-semibold text-slate-800">{nextAppt.doctorName ?? "Doctor TBC"}</p>
                      <p className="text-sm text-slate-500">{nextAppt.hospitalName ?? "Hospital TBC"}</p>
                      <p className="text-sm text-slate-600 mt-1"><TypeBadge type={nextAppt.type} /> <span className="ml-1">{formatDT(nextAppt.scheduledAt)}</span></p>
                    </div>
                    <button onClick={() => switchTab("appointments")}
                      className="text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition">
                      View All →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                  <p className="text-slate-400 text-sm mb-3">No upcoming appointments</p>
                  <Link href="/hospitals" className="text-sm font-semibold px-4 py-2 rounded-xl text-white shadow-sm" style={{ background: "#1B8A4A" }}>Book Appointment</Link>
                </div>
              )}

              {/* Quick stats */}
              {!loading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Total Appointments", value: appointments.length, icon: "📅", onClick: () => switchTab("appointments") },
                    { label: "Documents", value: docsCount, icon: "📋", onClick: () => switchTab("records") },
                    { label: "Upcoming", value: upcoming.length, icon: "✅", onClick: () => switchTab("appointments") },
                  ].map((s) => (
                    <button key={s.label} onClick={s.onClick}
                      className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-emerald-300 hover:shadow-md transition text-left">
                      <div className="text-2xl mb-1">{s.icon}</div>
                      <div className="text-3xl font-bold text-slate-800">{s.value}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* Monthly Health Synopsis (premium) */}
              <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-5 overflow-hidden">
                {!trial.canUsePremium && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm bg-white/80 rounded-2xl">
                    <div className="text-center">
                      <p className="text-xl mb-2">📊</p>
                      <p className="font-bold text-slate-800 text-sm">Monthly Health Synopsis</p>
                      <p className="text-xs text-slate-500 mt-1">AI-generated dos, don'ts & health tips</p>
                      <Link href="/dashboard/upgrade" className="mt-3 inline-block text-xs font-bold text-white px-4 py-2 rounded-xl" style={{ background: "#1B8A4A" }}>
                        Unlock with Premium
                      </Link>
                    </div>
                  </div>
                )}
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">📊 This Month's Health Tips</p>
                <div className={`space-y-2 ${!trial.canUsePremium ? "blur-sm select-none pointer-events-none" : ""}`}>
                  <div className="flex items-start gap-2"><span className="text-emerald-500 shrink-0">✓</span><p className="text-sm text-slate-700">Continue your current medication schedule — good compliance detected.</p></div>
                  <div className="flex items-start gap-2"><span className="text-emerald-500 shrink-0">✓</span><p className="text-sm text-slate-700">Your BP readings are within normal range this month.</p></div>
                  <div className="flex items-start gap-2"><span className="text-amber-500 shrink-0">⚠</span><p className="text-sm text-slate-700">Consider scheduling a follow-up lab test — last one was over 6 months ago.</p></div>
                </div>
              </div>

              {/* Health Guide teaser */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-2xl shrink-0">👩‍⚕️</div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">Dedicated EasyHeals Health Guide</p>
                    <p className="text-xs text-slate-600 mt-1">A personal health guide who manages all your health activities — appointments, medication, follow-ups, and more.</p>
                    <span className="inline-block mt-2 text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">Coming Soon — Premium Feature</span>
                  </div>
                </div>
              </div>

              {/* Quick nav cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { tab: "appointments" as DashboardTab, icon: "📅", label: "My Appointments", desc: "Book & manage visits" },
                  { tab: "records"      as DashboardTab, icon: "📋", label: "My Records",      desc: "Prescriptions, labs, scans" },
                  { tab: "timeline"     as DashboardTab, icon: "📈", label: "Health Timeline", desc: "Visual health history" },
                  { tab: "coach"        as DashboardTab, icon: "🤖", label: "AI Health Coach",  desc: "Chat & symptom check" },
                  { tab: "reminders"    as DashboardTab, icon: "💊", label: "Reminders",       desc: "Pills & appointments" },
                  { tab: "diet"         as DashboardTab, icon: "🥗", label: "Diet Plan",        desc: "AI diet & nutrition" },
                  { tab: "profile"      as DashboardTab, icon: "👤", label: "My Profile",      desc: "Personal info & family" },
                ].map((c) => (
                  <button key={c.tab} onClick={() => switchTab(c.tab)}
                    className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-emerald-300 hover:shadow-md transition text-left">
                    <span className="text-xl shrink-0">{c.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{c.label}</p>
                      <p className="text-xs text-slate-400 truncate">{c.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── OTHER TABS ── */}
          {activeTab === "appointments" && <AppointmentsTab appointments={appointments} loading={loading} />}
          {activeTab === "records"      && <RecordsTab />}
          {activeTab === "timeline"     && <TimelineTab appointments={appointments} />}
          {activeTab === "coach"        && <CoachTab canUsePremium={trial.canUsePremium} />}
          {activeTab === "diet"         && <DietPlanTab canUsePremium={trial.canUsePremium} />}
          {activeTab === "profile"      && <ProfileTab patientName={patientName} canUsePremium={trial.canUsePremium} />}
          {activeTab === "reminders"    && (
            !trial.canUsePremium ? (
              <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-8 overflow-hidden">
                <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm bg-white/80 rounded-2xl">
                  <div className="text-center">
                    <p className="text-3xl mb-3">💊</p>
                    <p className="font-bold text-slate-800">Care Reminders</p>
                    <p className="text-sm text-slate-500 mt-1 max-w-xs">Pill reminders, vitals log, caregiver alerts & elder care features require Health+ or Health Pro.</p>
                    <Link href="/dashboard/upgrade" className="mt-4 inline-block text-sm font-bold text-white px-5 py-2 rounded-xl shadow" style={{ background: "#1B8A4A" }}>
                      Upgrade to Unlock
                    </Link>
                  </div>
                </div>
                <div className="space-y-3 blur-sm pointer-events-none select-none">
                  <div className="h-12 bg-slate-100 rounded-xl" />
                  <div className="h-12 bg-slate-100 rounded-xl" />
                  <div className="h-12 bg-slate-100 rounded-xl" />
                </div>
              </div>
            ) : (
              <RemindersTab canUsePremium={trial.canUsePremium} appointments={appointments} />
            )
          )}

        </div>
      </main>
    </div>
  );
}
