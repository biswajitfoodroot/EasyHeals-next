"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { WearableTab } from "./health/tabs/WearableTab";
import { RewardsTab } from "./health/tabs/RewardsTab";

// ── Types ────────────────────────────────────────────────────────────────────

type DashboardTab = "home" | "appointments" | "records" | "coach" | "reminders" | "wearable" | "rewards" | "profile" | "diet";

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
  source?: string;
  sourceRefId?: string | null;
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
                                d.aiStatus === "failed" ? "bg-red-50 text-red-600 border-red-200" :
                                "bg-amber-50 text-amber-700 border-amber-200"
                              }`}>{d.aiStatus === "done" ? "AI Extracted" : d.aiStatus === "processing" ? "Processing…" : d.aiStatus === "failed" ? "Scan Failed" : "Pending AI Scan"}</span>
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

// ── Health Records Tab (combined Documents + Progress) ───────────────────────

function RecordsTab({ appointments }: { appointments: Appointment[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subTab, setSubTab] = useState<"documents" | "progress">("documents");
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
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);
  // Expandable document AI extractions
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [docEvents, setDocEvents] = useState<Record<string, HealthEvent[]>>({});
  const [docEventsLoading, setDocEventsLoading] = useState<string | null>(null);
  // Timeline (Progress sub-tab)
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [timelineFilter, setTimelineFilter] = useState("all");

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

  const loadDocs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/v1/patients/documents", { credentials: "include" });
      if (res.ok) { const j = await res.json() as { data: HealthDocument[] }; setDocs(j.data ?? []); }
    } finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { void loadDocs(); }, [loadDocs]);

  // Load timeline events
  useEffect(() => {
    fetch("/api/v1/patients/health-timeline?limit=200", { credentials: "include" })
      .then((r) => r.ok ? r.json() as Promise<{ data: HealthEvent[] }> : Promise.resolve({ data: [] }))
      .then((j) => setEvents(j.data ?? []))
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  // Poll silently every 5 s while any document is pending/processing
  useEffect(() => {
    const inFlight = docs.some((d) => d.aiStatus === "pending" || d.aiStatus === "processing");
    if (!inFlight) return;
    const timer = setInterval(() => { void loadDocs(true); }, 5000);
    return () => clearInterval(timer);
  }, [docs, loadDocs]);

  async function loadDocEvents(docId: string) {
    if (docEvents[docId]) return; // already cached
    setDocEventsLoading(docId);
    try {
      const res = await fetch(`/api/v1/patients/health-timeline?sourceId=${docId}&limit=50`, { credentials: "include" });
      if (res.ok) {
        const j = await res.json() as { data: HealthEvent[] };
        setDocEvents((prev) => ({ ...prev, [docId]: j.data ?? [] }));
      }
    } finally { setDocEventsLoading(null); }
  }

  function toggleDocExpand(docId: string) {
    if (expandedDocId === docId) {
      setExpandedDocId(null);
    } else {
      setExpandedDocId(docId);
      void loadDocEvents(docId);
    }
  }

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

  async function deleteDoc(documentId: string) {
    setDeletingDocId(documentId);
    try {
      await fetch(`/api/v1/patients/documents/${documentId}`, { method: "DELETE", credentials: "include" });
      setDocs((prev) => prev.filter((d) => d.id !== documentId));
    } finally { setDeletingDocId(null); setConfirmDeleteDocId(null); }
  }

  async function retryAiScan(documentId: string) {
    await fetch("/api/v1/patients/documents/retry-scan", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    void loadDocs(true);
  }

  function handleFile(file: File) {
    setSelectedFile(file);
    setFormTitle(file.name.replace(/\.[^.]+$/, ""));
    const lower = file.name.toLowerCase();
    if (lower.includes("lab") || lower.includes("blood") || lower.includes("report") || lower.includes("cbc") || lower.includes("lft") || lower.includes("kft")) {
      setFormType("lab_report");
    } else if (lower.includes("prescription") || lower.includes("rx") || lower.includes("medicine")) {
      setFormType("prescription");
    } else if (lower.includes("discharge") || lower.includes("summary")) {
      setFormType("discharge");
    } else if (lower.includes("xray") || lower.includes("mri") || lower.includes("ct") || lower.includes("scan") || lower.includes("ultrasound") || lower.includes("echo") || file.type.startsWith("image/")) {
      setFormType("imaging");
    } else {
      setFormType("other");
    }
    setShowForm(true);
  }

  const filtered = filter === "all" ? docs : docs.filter((d) => d.docType === filter);

  // ── Timeline progress chart data ──
  const allDates = [
    ...events.map((e) => e.eventDate ?? null),
    ...appointments.filter((a) => a.completedAt ?? a.scheduledAt).map((a) => a.completedAt ?? a.scheduledAt),
  ].filter(Boolean) as string[];

  const buckets = new Map<string, { events: number; appts: number }>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(k, { events: 0, appts: 0 });
  }
  for (const dt of allDates) { const k = dt.slice(0, 7); if (buckets.has(k)) buckets.get(k)!.events++; }
  for (const a of appointments) {
    const dt = a.completedAt ?? a.scheduledAt; if (!dt) continue;
    const k = dt.slice(0, 7); if (buckets.has(k)) buckets.get(k)!.appts++;
  }
  const chartData = Array.from(buckets.entries()).map(([k, v]) => ({ k, ...v }));
  const maxVal = Math.max(1, ...chartData.map((d) => d.events));

  const timelineFiltered = timelineFilter === "all" ? events : events.filter((e) => e.eventType === timelineFilter);
  const grouped = new Map<string, HealthEvent[]>();
  for (const e of timelineFiltered) {
    const d = e.eventDate ? new Date(e.eventDate) : null;
    const label = d ? d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "Unknown Date";
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label)!.push(e);
  }

  return (
    <div className="space-y-4">
      {/* Sub-tab toggle */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
        {([["documents", "📋 Documents"], ["progress", "📈 Health Progress"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition ${subTab === key ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            style={subTab === key ? { background: "#1B8A4A" } : {}}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══════ DOCUMENTS SUB-TAB ═══════ */}
      {subTab === "documents" && (
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

          {/* Upload panel */}
          {showForm && selectedFile && (
            <div className="bg-white rounded-2xl border border-emerald-200 shadow-md overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 border-b border-emerald-100">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg shrink-0">{selectedFile.type === "application/pdf" ? "📄" : "🖼️"}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-emerald-800 truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-emerald-600">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
                <button onClick={() => { setShowForm(false); setSelectedFile(null); setUploadMsg(null); }}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none shrink-0 ml-2">✕</button>
              </div>
              <div className="p-4 space-y-4">
                {uploadMsg && (
                  <p className={`text-xs p-2.5 rounded-xl ${uploadMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{uploadMsg.text}</p>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1.5">Document Name</label>
                  <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Blood Test – March 2026"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 text-slate-800" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-2">Document Type</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                      <button key={k} onClick={() => setFormType(k)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${formType === k ? "text-white border-transparent" : "text-slate-600 border-slate-200 bg-white hover:bg-slate-50"}`}
                        style={formType === k ? { background: "#1B8A4A" } : {}}>{v}</button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => void upload()} disabled={uploading}
                    className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: "#1B8A4A" }}>
                    {uploading ? (<><span className="animate-spin text-sm">⏳</span> Uploading…</>) : (<>📤 Upload</>)}
                  </button>
                  <button onClick={() => { setShowForm(false); setSelectedFile(null); setUploadMsg(null); }}
                    className="px-4 text-sm font-semibold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
                </div>
                <p className="text-[10px] text-slate-400 text-center">By uploading, you consent to AI-assisted extraction of health data.</p>
              </div>
            </div>
          )}

          {/* Filter pills */}
          <div className="flex gap-2 flex-wrap">
            {[["all", "All"], ...Object.entries(DOC_TYPE_LABELS)].map(([k, v]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${filter === k ? "text-white border-transparent" : "text-slate-600 border-slate-200 bg-white hover:bg-slate-50"}`}
                style={filter === k ? { background: "#1B8A4A" } : {}}>{v}</button>
            ))}
          </div>

          {/* Documents list — expandable cards with AI extractions */}
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
              {filtered.map((d) => {
                const isExpanded = expandedDocId === d.id;
                const evts = docEvents[d.id];
                const evtsLoading = docEventsLoading === d.id;
                return (
                  <div key={d.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-sm transition">
                    {/* Document header — clickable to expand */}
                    <button onClick={() => d.aiStatus === "done" ? toggleDocExpand(d.id) : undefined}
                      className={`w-full p-4 flex items-start gap-3 text-left ${d.aiStatus === "done" ? "cursor-pointer" : "cursor-default"}`}>
                      <span className="text-2xl shrink-0 mt-0.5">
                        {d.docType === "lab_report" ? "🧪" : d.docType === "prescription" ? "💊" : d.docType === "imaging" ? "🩻" : "📄"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{d.title ?? "Untitled"}</p>
                        <p className="text-xs text-slate-400">{DOC_TYPE_LABELS[d.docType ?? ""] ?? "Document"} · {formatDate(d.docDate ?? d.uploadedAt)}</p>
                        {(d.aiStatus === "pending" || d.aiStatus === "processing") && (
                          <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
                            <span className="animate-spin inline-block">⏳</span> AI is reading your document…
                          </p>
                        )}
                        {d.aiStatus === "failed" && (
                          <button onClick={(e) => { e.stopPropagation(); void retryAiScan(d.id); }}
                            className="text-[10px] text-red-600 hover:text-red-800 mt-0.5 underline">Retry AI scan →</button>
                        )}
                        {d.aiStatus === "done" && (
                          <p className="text-[10px] text-emerald-600 mt-0.5">{isExpanded ? "▼ Hide AI analysis" : "▶ View AI analysis"}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          d.aiStatus === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          d.aiStatus === "processing" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          d.aiStatus === "failed" ? "bg-red-50 text-red-600 border-red-200" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {d.aiStatus === "done" ? "✓ AI Extracted" : d.aiStatus === "processing" ? "Processing…" : d.aiStatus === "failed" ? "Scan Failed" : "Pending"}
                        </span>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <a href={`/api/v1/patients/documents/${d.id}/download`} download
                            className="text-[10px] text-emerald-600 hover:text-emerald-800 transition font-medium">📥 Download</a>
                          {confirmDeleteDocId === d.id ? (
                            <>
                              <button onClick={() => void deleteDoc(d.id)} disabled={deletingDocId === d.id}
                                className="text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-lg disabled:opacity-50">
                                {deletingDocId === d.id ? "…" : "Delete"}
                              </button>
                              <button onClick={() => setConfirmDeleteDocId(null)}
                                className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 px-1.5 py-0.5 border border-slate-200 rounded-lg">Cancel</button>
                            </>
                          ) : (
                            <button onClick={() => setConfirmDeleteDocId(d.id)}
                              className="text-[10px] text-slate-400 hover:text-red-500 transition">🗑 Delete</button>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Expanded AI extraction panel */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">AI-Extracted Health Data</p>
                        {evtsLoading ? (
                          <p className="text-xs text-slate-400 py-2">Loading extracted data…</p>
                        ) : !evts || evts.length === 0 ? (
                          <p className="text-xs text-slate-400 py-2">No health events were extracted from this document.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {evts.map((e) => {
                              const parts: string[] = [];
                              if (e.data.name) parts.push(String(e.data.name));
                              if (e.data.value !== undefined) {
                                let val = `${e.data.value}`;
                                if (e.data.unit) val += ` ${e.data.unit}`;
                                parts.push(val);
                              }
                              if (e.data.dosage) parts.push(String(e.data.dosage));
                              if (e.data.status && e.data.status !== "normal") parts.push(`(${String(e.data.status)})`);
                              const line = parts.join(" · ") || "—";
                              const isAbnormal = e.data.status === "high" || e.data.status === "low" || e.data.status === "abnormal";
                              return (
                                <div key={e.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${isAbnormal ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
                                  <span className={`px-1.5 py-0.5 rounded border font-medium shrink-0 ${EVENT_COLORS[e.eventType] ?? "text-slate-600 bg-slate-50 border-slate-200"}`}>
                                    {EVENT_ICONS[e.eventType] ?? "📌"} {e.eventType.replace(/_/g, " ")}
                                  </span>
                                  <span className={`flex-1 ${isAbnormal ? "text-amber-800 font-semibold" : "text-slate-700"}`}>{line}</span>
                                  {isAbnormal && <span className="text-amber-600 font-bold shrink-0">⚠</span>}
                                </div>
                              );
                            })}
                            <p className="text-[10px] text-slate-400 mt-1">{evts.length} item{evts.length > 1 ? "s" : ""} extracted · added to your Health Progress timeline</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════ HEALTH PROGRESS SUB-TAB ═══════ */}
      {subTab === "progress" && (
        <div className="space-y-6">
          {/* 12-Month Activity Chart */}
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
                      {barH > 0 && <rect x={barX} y={120 - barH} width={28} height={barH} rx="4" fill="#1B8A4A" opacity={0.65} />}
                      {appts > 0 && <circle cx={cx} cy={Math.max(8, 120 - barH - 8)} r={5} fill="#F59E0B" />}
                      <text x={cx} y={148} textAnchor="middle" fontSize="9" fill="#94a3b8">
                        {new Date(k + "-01").toLocaleDateString("en-IN", { month: "short" })}
                      </text>
                      <text x={cx} y={158} textAnchor="middle" fontSize="8" fill="#cbd5e1">{k.slice(2, 4)}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-2xl font-bold text-slate-800">{docs.length}</p>
              <p className="text-[10px] text-slate-500 font-semibold">Documents</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-2xl font-bold text-slate-800">{events.length}</p>
              <p className="text-[10px] text-slate-500 font-semibold">Health Events</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-2xl font-bold text-slate-800">{appointments.filter((a) => a.status === "completed").length}</p>
              <p className="text-[10px] text-slate-500 font-semibold">Appointments</p>
            </div>
          </div>

          {/* Timeline filter pills */}
          <div className="flex gap-2 flex-wrap">
            {[["all", "All"], ["vital", "Vitals 💓"], ["lab_result", "Labs 🧪"], ["diagnosis", "Diagnoses 🩺"], ["medication", "Medications 💊"], ["procedure", "Procedures"]].map(([k, v]) => (
              <button key={k} onClick={() => setTimelineFilter(k)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${timelineFilter === k ? "text-white border-transparent" : "text-slate-600 border-slate-200 bg-white hover:bg-slate-50"}`}
                style={timelineFilter === k ? { background: "#1B8A4A" } : {}}>{v}</button>
            ))}
          </div>

          {/* Events list */}
          {eventsLoading ? (
            <div className="space-y-3">{[1,2,3].map((i) => <Sk key={i} className="h-16" />)}</div>
          ) : timelineFiltered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <p className="text-3xl mb-2">📈</p>
              <p className="text-slate-500 font-medium">No health events yet</p>
              <p className="text-xs text-slate-400 mt-1">Upload reports and complete appointments to build your timeline.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(grouped.entries()).map(([month, evts]) => {
                // Group events by source document
                const docGroups: { key: string; type: string; date: string | null; source: string; events: HealthEvent[] }[] = [];
                const docMap = new Map<string, number>();
                for (const e of evts) {
                  const groupKey = (e.sourceRefId && e.sourceRefId !== "self") ? `${e.sourceRefId}` : `single_${e.id}`;
                  if (docMap.has(groupKey)) { docGroups[docMap.get(groupKey)!].events.push(e); }
                  else { docMap.set(groupKey, docGroups.length); docGroups.push({ key: groupKey, type: e.eventType, date: e.eventDate, source: e.source ?? "self_report", events: [e] }); }
                }
                return (
                  <div key={month}>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{month}</p>
                    <div className="space-y-2">
                      {docGroups.map((group) => {
                        const isSingle = group.events.length === 1;
                        const sourceLabel = group.source === "document_scan" ? "Uploaded Report"
                          : group.source === "self_report" ? "Manual Entry"
                          : group.source === "appointment" ? "Appointment"
                          : group.source.replace(/_/g, " ");

                        if (isSingle) {
                          const e = group.events[0];
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
                        }

                        // Grouped card — multiple readings from same document
                        return (
                          <div key={group.key} className="bg-white rounded-xl border border-slate-200 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-sm px-2 py-1 rounded-lg border font-medium shrink-0 ${EVENT_COLORS[group.type] ?? "text-slate-600 bg-slate-50 border-slate-200"}`}>
                                {EVENT_ICONS[group.type] ?? "📌"} {group.type.replace(/_/g, " ")}
                              </span>
                              <span className="text-xs font-semibold text-slate-700">{sourceLabel}</span>
                              <span className="text-[10px] text-slate-400 ml-auto">{formatDate(group.date)}</span>
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">{group.events.length} items</span>
                            </div>
                            <div className="space-y-1 ml-1 border-l-2 border-slate-100 pl-3">
                              {group.events.map((e) => {
                                const parts: string[] = [];
                                if (e.data.name) parts.push(String(e.data.name));
                                if (e.data.value !== undefined) parts.push(`${e.data.value}${e.data.unit ? ` ${e.data.unit}` : ""}`);
                                if (e.data.dosage) parts.push(String(e.data.dosage));
                                const line = parts.join(" · ") || "—";
                                return <p key={e.id} className="text-xs text-slate-600 py-0.5">{line}</p>;
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AI Care Navigator Tab (Chat + Symptom Triage + Provider Matching) ────────

type UrgencyLevel = "emergency" | "urgent" | "routine" | "self_care";

interface TriageResult {
  urgency: UrgencyLevel;
  urgencyLabel: string;
  urgencyColor: "red" | "orange" | "yellow" | "green";
  urgencyIcon: string;
  specialists: Array<{ specialty: string; reason: string }>;
  redFlags: string[];
  selfCare: string[];
  disclaimer: string;
}

interface ProviderMatch {
  hospitalId: string;
  hospitalName: string;
  hospitalSlug: string;
  specialties: string[];
  matchReason: string;
  score: number;
  rating: number;
  city: string;
  estimatedFee?: string;
  verified: boolean;
}

const URGENCY_STYLES: Record<UrgencyLevel, { bg: string; border: string; text: string; badge: string }> = {
  emergency: { bg: "bg-red-50", border: "border-red-400", text: "text-red-800", badge: "bg-red-500 text-white" },
  urgent:    { bg: "bg-orange-50", border: "border-orange-400", text: "text-orange-800", badge: "bg-orange-500 text-white" },
  routine:   { bg: "bg-yellow-50", border: "border-yellow-400", text: "text-yellow-800", badge: "bg-yellow-500 text-white" },
  self_care: { bg: "bg-green-50", border: "border-green-400", text: "text-green-800", badge: "bg-green-500 text-white" },
};

const SYMPTOM_SUGGESTIONS = [
  "Chest pain and shortness of breath",
  "High fever for 3 days",
  "Severe headache with stiff neck",
  "Knee pain while walking",
  "Persistent cough for 2 weeks",
  "Nausea and stomach ache",
  "Mild cold and runny nose",
];

interface ConversationMeta { id: string; title: string | null; lastMessageAt: string | null }

function CoachTab({ canUsePremium, lang = "en" }: { canUsePremium: boolean; lang?: string }) {
  const [mode, setMode] = useState<"chat" | "symptom" | "history">("chat");

  // ── Chat state ──
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    { role: "assistant", text: "Hello! I'm your EasyHeals AI Health Coach. I can analyse your health records, explain symptoms, find the right specialist, and give personalised guidance.\n\nWhat would you like to discuss today?" },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [convoLoading, setConvoLoading] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // ── Triage state ──
  const [symptoms, setSymptoms] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [matches, setMatches] = useState<ProviderMatch[] | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);

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
        body: JSON.stringify({ message: userMsg, conversationId }),
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
            try {
              const parsed = JSON.parse(d) as { text?: string; conversationId?: string };
              if (parsed.conversationId) setConversationId(parsed.conversationId);
              if (parsed.text) { partial += parsed.text; }
            } catch { partial += d; }
            setMessages((p) => { const n = [...p]; n[n.length - 1] = { role: "assistant", text: partial }; return n; });
          }
        }
      }
    } catch { setMessages((p) => [...p, { role: "assistant", text: "Network error. Please try again." }]); }
    finally { setStreaming(false); }
  }

  function loadConversations() {
    setConvoLoading(true);
    fetch("/api/v1/patients/health-coach/conversations", { credentials: "include" })
      .then(async (r) => { if (r.ok) { const j = await r.json() as { data?: ConversationMeta[] }; setConversations(j.data ?? []); } })
      .catch(() => {})
      .finally(() => setConvoLoading(false));
  }

  function startNewChat() {
    setConversationId(null);
    setMessages([{ role: "assistant", text: "Hello! I'm your EasyHeals AI Health Coach. Ask me anything about your health records, symptoms, or wellness.\n\nWhat would you like to discuss?" }]);
    setMode("chat");
  }

  function saveAnalysis() {
    const assistantMessages = messages.filter((m) => m.role === "assistant" && m.text.length > 50);
    if (assistantMessages.length === 0) return;
    const content = assistantMessages.map((m) => m.text).join("\n\n---\n\n");
    const blob = new Blob([`EasyHeals AI Health Coach Analysis\nDate: ${new Date().toLocaleDateString("en-IN")}\n\n${content}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-coach-analysis-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setSavedMsg("Analysis saved!");
    setTimeout(() => setSavedMsg(null), 2500);
  }

  async function runTriage(e: React.FormEvent) {
    e.preventDefault();
    if (!symptoms.trim()) return;
    setTriageLoading(true); setTriageError(null); setTriageResult(null); setMatches(null);
    try {
      const res = await fetch("/api/v1/care-nav/triage", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms: symptoms.trim(), age: age ? Number(age) : undefined, gender: gender || undefined }),
      });
      const j = await res.json() as { data?: TriageResult; error?: { message: string } };
      if (!res.ok || j.error) { setTriageError(j.error?.message ?? "Triage failed. Please try again."); return; }
      setTriageResult(j.data ?? null);
    } catch { setTriageError("Network error. Please check your connection."); }
    finally { setTriageLoading(false); }
  }

  function handleTriageReset() {
    setTriageResult(null); setTriageError(null); setMatches(null); setSymptoms(""); setAge(""); setGender("");
  }

  async function handleFindProviders() {
    if (!symptoms.trim()) return;
    setMatchLoading(true);
    try {
      const res = await fetch("/api/v1/care-nav/match", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms: symptoms.trim() }),
      });
      if (res.ok) { const j = await res.json() as { matches: ProviderMatch[] }; setMatches(j.matches ?? []); }
    } catch { /* non-fatal */ }
    finally { setMatchLoading(false); }
  }

  const urgStyles = triageResult ? URGENCY_STYLES[triageResult.urgency] : null;

  return (
    <div className="space-y-4 relative">
      {!canUsePremium && (
        <PremiumGate
          feature="AI Care Navigator"
          desc="Get personalised health guidance, symptom triage with urgency assessment, specialist recommendations, and provider matching — powered by AI."
        />
      )}

      {/* Mode toggle */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
        {(["chat", "symptom", "history"] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); if (m === "history") loadConversations(); }}
            className={`flex-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${mode === m ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            style={mode === m ? { background: "#1B8A4A" } : {}}>
            {m === "chat" ? "💬 Coach" : m === "symptom" ? "🧭 Triage" : "📜 History"}
          </button>
        ))}
      </div>

      {/* ═══════ CHAT MODE ═══════ */}
      {mode === "chat" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" style={{ height: "500px" }}>
          {/* Chat toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50">
            <button onClick={startNewChat} className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition">+ New Chat</button>
            <div className="flex items-center gap-2">
              {savedMsg && <span className="text-xs text-emerald-600 font-medium">{savedMsg}</span>}
              {messages.filter((m) => m.role === "assistant").length > 1 && (
                <button onClick={saveAnalysis} className="text-xs font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 px-2 py-1 rounded-lg transition">📥 Save Analysis</button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] text-sm px-4 py-2.5 rounded-2xl ${m.role === "user" ? "text-white rounded-br-md whitespace-pre-wrap" : "bg-slate-100 text-slate-800 rounded-bl-md"}`}
                  style={m.role === "user" ? { background: "#1B8A4A" } : {}}>
                  {m.text ? (m.role === "assistant" ? <CoachMarkdown text={m.text} /> : m.text) : (streaming ? <span className="inline-flex gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" /><span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0.15s" }} /><span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0.3s" }} /></span> : "")}
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

      {/* ═══════ SYMPTOM TRIAGE MODE ═══════ */}
      {mode === "symptom" && (
        <div className="space-y-4">
          {/* Emergency banner */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 text-center">
            <strong>Emergency?</strong> If you have chest pain, difficulty breathing, or feel faint — call{" "}
            <a href="tel:102" className="font-bold underline">102 (Ambulance)</a> or go to the nearest ER immediately.
          </div>

          {/* Triage form — shown before result */}
          {!triageResult && (
            <form onSubmit={runTriage} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Describe your symptoms *</label>
                <textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="e.g. I have been having chest pain for the last hour along with shortness of breath..."
                  rows={4} maxLength={1000}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
                <p className="text-xs text-slate-400 text-right mt-1">{symptoms.length}/1000</p>
              </div>

              {/* Suggestions */}
              <div>
                <p className="text-xs text-slate-400 mb-2">Common examples:</p>
                <div className="flex flex-wrap gap-2">
                  {SYMPTOM_SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => setSymptoms(s)}
                      className="text-xs bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 px-3 py-1.5 rounded-full transition">{s}</button>
                  ))}
                </div>
              </div>

              {/* Optional fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Age (optional)</label>
                  <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 45" min={1} max={120}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Gender (optional)</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {triageError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{triageError}</div>
              )}

              <button type="submit" disabled={triageLoading || !symptoms.trim()}
                className="w-full py-3 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "#1B8A4A" }}>
                {triageLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Analysing symptoms...
                  </span>
                ) : "Get Triage Guidance"}
              </button>
            </form>
          )}

          {/* Triage results */}
          {triageResult && urgStyles && (
            <div className="space-y-4">
              {/* Urgency card */}
              <div className={`${urgStyles.bg} border-2 ${urgStyles.border} rounded-2xl p-6`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-4xl">{triageResult.urgencyIcon}</span>
                  <div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${urgStyles.badge}`}>
                      {triageResult.urgency.replace("_", " ").toUpperCase()}
                    </span>
                    <p className={`text-xl font-bold mt-1 ${urgStyles.text}`}>{triageResult.urgencyLabel}</p>
                  </div>
                </div>
                {triageResult.urgency === "emergency" && (
                  <div className="mt-3 flex gap-3">
                    <a href="tel:102" className="flex-1 py-2.5 text-center bg-red-600 text-white text-sm font-bold rounded-xl">
                      Call 102 (Ambulance)
                    </a>
                    <Link href="/hospitals"
                      className="flex-1 py-2.5 text-center bg-white border-2 border-red-400 text-red-700 text-sm font-bold rounded-xl">
                      Find ER Nearby
                    </Link>
                  </div>
                )}
                {(triageResult.urgency === "urgent" || triageResult.urgency === "routine") && (
                  <div className="mt-3">
                    <Link href="/hospitals" className="block py-2.5 text-center text-white text-sm font-bold rounded-xl" style={{ background: "#1B8A4A" }}>
                      Book Appointment Now
                    </Link>
                  </div>
                )}
              </div>

              {/* Red flags */}
              {triageResult.redFlags.length > 0 && (
                <div className="bg-white border border-orange-200 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-orange-800 mb-3">Warning signs to watch for</h3>
                  <ul className="space-y-1.5">
                    {triageResult.redFlags.map((flag, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2">
                        <span className="text-orange-500 mt-0.5">•</span>{flag}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-orange-700 mt-3 font-medium">If any of these appear, seek emergency care immediately.</p>
                </div>
              )}

              {/* Specialists */}
              {triageResult.specialists.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-800 mb-3">Recommended Specialists</h3>
                  <div className="space-y-3">
                    {triageResult.specialists.map((s, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: "#1B8A4A" }}>
                          {s.specialty.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-800">{s.specialty}</p>
                          <p className="text-xs text-slate-500">{s.reason}</p>
                        </div>
                        <Link href={`/hospitals?q=${encodeURIComponent(s.specialty)}`}
                          className="text-xs font-medium text-green-700 hover:underline flex-shrink-0">Find →</Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Self care tips */}
              {triageResult.selfCare.length > 0 && (
                <div className="bg-white border border-green-200 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-green-800 mb-3">Home Care Tips</h3>
                  <ul className="space-y-1.5">
                    {triageResult.selfCare.map((tip, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>{tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disclaimer */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700 text-center">
                {triageResult.disclaimer}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleTriageReset}
                  className="py-3 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                  Check Again
                </button>
                <button onClick={() => setMode("chat")}
                  className="py-3 text-white rounded-xl text-sm font-semibold transition" style={{ background: "#1B8A4A" }}>
                  Ask AI Coach
                </button>
              </div>

              {/* Find Providers */}
              {triageResult.urgency !== "emergency" && (
                <button onClick={() => void handleFindProviders()} disabled={matchLoading}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition text-white"
                  style={{ background: "#1e40af", opacity: matchLoading ? 0.7 : 1 }}>
                  {matchLoading ? "Finding providers…" : "Find Matching Providers"}
                </button>
              )}

              {/* Provider match results */}
              {matches !== null && (
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">
                    {matches.length > 0 ? `${matches.length} matching providers found` : "No providers found. Try a different city."}
                  </p>
                  <div className="space-y-2">
                    {matches.slice(0, 5).map((m) => (
                      <div key={m.hospitalId} className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex gap-3 items-start">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">
                            {m.hospitalName}
                            {m.verified && <span className="ml-1.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 py-px">✓ Verified</span>}
                          </p>
                          <p className="text-xs text-slate-500">{m.matchReason} · {m.city}</p>
                          <div className="flex gap-2 text-xs mt-1">
                            {m.rating > 0 && <span className="text-amber-500">★ {m.rating.toFixed(1)}</span>}
                            {m.estimatedFee && <span className="text-slate-400">{m.estimatedFee}</span>}
                          </div>
                        </div>
                        <Link href={`/hospitals/${m.hospitalSlug}`}
                          className="shrink-0 px-3 py-1.5 text-xs font-semibold text-white rounded-lg" style={{ background: "#1B8A4A" }}>
                          Book
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════ HISTORY MODE ═══════ */}
      {mode === "history" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-700">Conversation History</p>
            <button onClick={startNewChat} className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg" style={{ background: "#1B8A4A" }}>+ New Chat</button>
          </div>
          <div className="p-4">
            {convoLoading ? (
              <p className="text-sm text-slate-400 text-center py-8">Loading conversations...</p>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">💬</p>
                <p className="text-sm text-slate-500 font-medium">No conversations yet</p>
                <p className="text-xs text-slate-400 mt-1">Start chatting with your AI Health Coach to see your history here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((c) => (
                  <button key={c.id} onClick={() => { setConversationId(c.id); setMode("chat"); }}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition">
                    <p className="text-sm font-semibold text-slate-700 truncate">{c.title ?? "Untitled conversation"}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <MedicalDisclaimer lang={lang} />
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
  const [savedPrescriptions, setSavedPrescriptions] = useState<HealthDocument[]>([]);
  const [showPrescriptionPicker, setShowPrescriptionPicker] = useState(false);

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
    // Load saved prescriptions for "pick from saved" feature
    fetch("/api/v1/patients/documents", { credentials: "include" }).then(async (r) => {
      if (r.ok) {
        const j = await r.json() as { data?: HealthDocument[] };
        setSavedPrescriptions((j.data ?? []).filter((d) => d.docType === "prescription"));
      }
    }).catch(() => {});
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

  async function handleSavedPrescriptionScan(documentId: string) {
    setShowPrescriptionPicker(false);
    setScanLoading(true); setScanError(null); setScannedMeds(null); setSelectedScanned(new Set());
    try {
      const res = await fetch(`/api/v1/patients/prescription-scan?documentId=${encodeURIComponent(documentId)}`, {
        method: "POST", credentials: "include",
      });
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
    finally { setScanLoading(false); }
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
      {/* Today's Pills / My Plan toggle */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm w-fit">
        <button onClick={() => setMode("simple")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${mode === "simple" ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          style={mode === "simple" ? { background: "#1B8A4A" } : {}}>
          💊 Today's Pills
        </button>
        <button onClick={() => setMode("advanced")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${mode === "advanced" ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          style={mode === "advanced" ? { background: "#1B8A4A" } : {}}>
          📋 My Plan
        </button>
      </div>

      {/* ── Daily Pill Schedule ── */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm font-bold text-slate-700">
            {mode === "simple" ? "Today's Pills" : "Medication Plan"}
          </p>
          <div className="flex items-center gap-2">
            {mode === "advanced" && canUsePremium && (
              <>
                <input ref={scanFileRef} type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={(e) => void handlePrescriptionScan(e)} />
                <button onClick={() => scanFileRef.current?.click()} disabled={scanLoading}
                  className="text-xs font-semibold text-purple-600 border border-purple-200 px-3 py-1 rounded-lg hover:bg-purple-50 disabled:opacity-60 flex items-center gap-1">
                  {scanLoading ? "Scanning…" : "📷 Scan New"}
                </button>
                {savedPrescriptions.length > 0 && (
                  <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setShowPrescriptionPicker(false); }}>
                    <button
                      onClick={() => setShowPrescriptionPicker((p) => !p)}
                      disabled={scanLoading}
                      className="text-xs font-semibold text-indigo-600 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50 disabled:opacity-60 flex items-center gap-1"
                    >
                      📋 From Saved
                    </button>
                    {showPrescriptionPicker && (
                      <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-xl shadow-lg min-w-[220px] py-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase px-3 pt-2 pb-1">Saved Prescriptions</p>
                        {savedPrescriptions.map((doc) => (
                          <button
                            key={doc.id}
                            onClick={() => void handleSavedPrescriptionScan(doc.id)}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 first:border-0"
                          >
                            <span className="text-base shrink-0">📄</span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{doc.title ?? "Prescription"}</p>
                              <p className="text-[10px] text-slate-400">{formatDate(doc.docDate ?? doc.uploadedAt)}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            {mode === "advanced" && (
              <button onClick={() => setShowAddPill(true)} className="text-xs font-semibold text-emerald-600 border border-emerald-200 px-3 py-1 rounded-lg hover:bg-emerald-50">+ Add Medication</button>
            )}
          </div>
        </div>

        {/* Prescription scan results — My Plan mode only */}
        {mode === "advanced" && scanError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">{scanError}</div>
        )}
        {mode === "advanced" && scannedMeds !== null && (
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
            <button onClick={() => { setMode("advanced"); setShowAddPill(true); }}
              className="mt-3 text-xs font-semibold text-emerald-600 hover:underline">
              Add your first medication →
            </button>
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
                          <div className="flex items-center gap-2 ml-3 shrink-0">
                            <button
                              onClick={() => toggleTaken(pill.id, slot.key)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${taken ? "bg-emerald-500 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-600"}`}>
                              {taken ? "✓ Taken" : "Mark Taken"}
                            </button>
                            <button onClick={() => void removePill(pill.id)}
                              className="text-slate-300 hover:text-red-500 transition text-base leading-none" title="Remove medication">
                              🗑
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add pill form — My Plan mode only */}
        {mode === "advanced" && showAddPill && (
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

      {/* All Medications list */}
      {pills.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <p className="text-sm font-bold text-slate-700">All Medications ({pills.length})</p>
          <div className="space-y-2">
            {pills.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{p.name} {p.dosage && <span className="text-slate-500 font-normal">· {p.dosage}</span>}</p>
                  <p className="text-xs text-slate-400">{p.times.join(", ")}{p.notes ? ` · ${p.notes}` : ""}</p>
                </div>
                <button onClick={() => void removePill(p.id)} className="ml-3 text-xs text-red-500 hover:text-red-700 font-semibold shrink-0">Remove</button>
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
  goal: "lose_weight" | "gain_weight" | "maintain" | "manage_diabetes" | "manage_bp" | "fitness" | "";
  goalWeight: string;
  age: string;
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "";
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

const LS_DIET_PROFILE    = "eh_diet_profile_v1";
const LS_PREFERRED_LANG  = "eh_preferred_lang_v1";

// ── Medical Disclaimer ────────────────────────────────────────────────────────

const DISCLAIMER_LANGS: Record<string, { name: string; text: string }> = {
  en: { name: "English",    text: "This information is indicative only and not a substitute for professional medical advice. All AI-generated results, plans, and trends must be verified by a qualified healthcare practitioner before taking any action." },
  hi: { name: "हिन्दी",     text: "यह जानकारी केवल सांकेतिक है और पेशेवर चिकित्सा सलाह का विकल्प नहीं है। सभी AI-जनित परिणाम, योजनाएँ और ट्रेंड किसी योग्य स्वास्थ्य विशेषज्ञ द्वारा सत्यापित किए जाने चाहिए।" },
  bn: { name: "বাংলা",      text: "এই তথ্য শুধুমাত্র ইঙ্গিতমূলক এবং পেশাদার চিকিৎসা পরামর্শের বিকল্প নয়। সমস্ত AI-উৎপন্ন ফলাফল যেকোনো পদক্ষেপ নেওয়ার আগে একজন যোগ্য চিকিৎসক দ্বারা যাচাই করা উচিত।" },
  mr: { name: "मराठी",      text: "ही माहिती केवळ सांकेतिक आहे आणि व्यावसायिक वैद्यकीय सल्ल्याचा पर्याय नाही। सर्व AI-निर्मित परिणाम कोणतीही कारवाई करण्यापूर्वी पात्र वैद्यकीय व्यावसायिकाने सत्यापित केले पाहिजेत।" },
  ta: { name: "தமிழ்",     text: "இந்த தகவல் குறிப்பீட்டு மட்டுமே மற்றும் தொழில்முறை மருத்துவ ஆலோசனைக்கு மாற்றாக இல்லை. அனைத்து AI முடிவுகளும் ஒரு தகுதிவாய்ந்த மருத்துவரால் சரிபார்க்கப்பட வேண்டும்।" },
  te: { name: "తెలుగు",    text: "ఈ సమాచారం సూచనాత్మకమైనది మాత్రమే మరియు వృత్తిపరమైన వైద్య సలహాకు ప్రత్యామ్నాయం కాదు. అన్ని AI ఫలితాలు అర్హత కలిగిన వైద్యుడిచే ధృవీకరించబడాలి।" },
  kn: { name: "ಕನ್ನಡ",    text: "ಈ ಮಾಹಿತಿ ಕೇವಲ ಸಾಂಕೇತಿಕವಾಗಿದೆ ಮತ್ತು ವೃತ್ತಿಪರ ವೈದ್ಯಕೀಯ ಸಲಹೆಗೆ ಬದಲಿ ಅಲ್ಲ. ಎಲ್ಲಾ AI ಫಲಿತಾಂಶಗಳನ್ನು ಅರ್ಹ ವೈದ್ಯರಿಂದ ಪರಿಶೀಲಿಸಬೇಕು।" },
};

function MedicalDisclaimer({ lang = "en" }: { lang?: string }) {
  const selected = DISCLAIMER_LANGS[lang] ?? DISCLAIMER_LANGS.en;
  const english  = DISCLAIMER_LANGS.en;
  const showBoth = lang !== "en" && selected;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
        ⚕️ Medical Disclaimer
      </p>
      {showBoth && (
        <p className="text-xs text-slate-600 leading-relaxed">
          <span className="font-semibold">{selected.name}:</span> {selected.text}
        </p>
      )}
      <p className="text-xs text-slate-600 leading-relaxed">
        {showBoth && <span className="font-semibold">English: </span>}
        {english.text}
      </p>
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab({ patientName, canUsePremium: _canUsePremium, lang = "en", onLangChange }: { patientName: string; canUsePremium: boolean; lang?: string; onLangChange?: (l: string) => void }) {
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
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
          <span className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-base">👤</span>
          <p className="text-sm font-bold text-slate-700">Personal Information</p>
        </div>

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
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-base">🩺</span>
            <p className="text-sm font-bold text-slate-700">Health Profile</p>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Used by Diet Plan</span>
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
        <div className="flex items-center gap-3 pt-1">
          <button onClick={saveProfile} disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-60"
            style={{ background: "#1B8A4A" }}>
            {saving ? "Saving…" : "Save Health Profile"}
          </button>
          {saveMsg && <p className={`text-xs font-medium ${saveMsg.includes("updated") ? "text-emerald-600" : "text-red-600"}`}>{saveMsg}</p>}
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

      {/* ── Language Preference ── */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div>
          <p className="text-sm font-bold text-slate-700">Language Preference</p>
          <p className="text-xs text-slate-400 mt-0.5">Disclaimers and guidance will also appear in your chosen language</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(DISCLAIMER_LANGS).map(([code, { name }]) => (
            <button key={code} onClick={() => onLangChange?.(code)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${lang === code ? "text-white border-transparent" : "text-slate-600 border-slate-200 bg-white hover:border-emerald-400"}`}
              style={lang === code ? { background: "#1B8A4A" } : {}}>
              {name}
            </button>
          ))}
        </div>
        <MedicalDisclaimer lang={lang} />
      </section>

      {/* ── ABHA Integration (stub — P5) ── */}
      <AbhaCard />

      {/* ── Smart Reminders (P6) ── */}
      <SmartRemindersSection />

    </div>
  );
}

// ── Smart Reminders section (P6) — shown in ProfileTab when smart_reminders flag is ON ──

interface ReminderItem {
  id: string;
  reminderType: string;
  title: string;
  body?: string;
  scheduleCron: string | null;
  channel: string;
  isActive: boolean;
  isAiGenerated: boolean;
}

function SmartRemindersSection() {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", reminderType: "medication", channel: "whatsapp", scheduleCron: "0 8 * * *" });

  useEffect(() => {
    // Only fetch if flag is on (will get 423 if off — treat as hidden)
    fetch("/api/v1/patients/reminders", { credentials: "include" })
      .then((r) => {
        if (r.status === 423) return null; // flag off — hide section
        setVisible(true);
        return r.json() as Promise<{ reminders: ReminderItem[] }>;
      })
      .then((d) => { if (d?.reminders) setReminders(d.reminders); })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  async function addReminder() {
    if (!form.title.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/v1/patients/reminders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const refetch = await fetch("/api/v1/patients/reminders", { credentials: "include" });
        const d = await refetch.json() as { reminders: ReminderItem[] };
        setReminders(d.reminders ?? []);
        setForm((prev) => ({ ...prev, title: "" }));
      }
    } catch { /* non-fatal */ } finally { setAdding(false); }
  }

  async function toggleReminder(id: string, isActive: boolean) {
    await fetch("/api/v1/patients/reminders", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    }).catch(() => null);
    setReminders((prev) => prev.map((r) => r.id === id ? { ...r, isActive: !isActive } : r));
  }

  if (!visible || loading) return null;

  return (
    <section style={{ borderTop: "1px solid #E8F0EB", paddingTop: 20, marginTop: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#1A2B23", marginBottom: 12 }}>
        🔔 Smart Reminders
      </div>

      {/* Add new reminder */}
      <div style={{ background: "#F4FAF6", borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Reminder title (e.g. Take Metformin)"
            style={{ flex: 1, minWidth: 180, border: "1.5px solid #D0E4D8", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", outline: "none" }}
          />
          <select
            value={form.reminderType}
            onChange={(e) => setForm((f) => ({ ...f, reminderType: e.target.value }))}
            style={{ border: "1.5px solid #D0E4D8", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", background: "#fff" }}
          >
            <option value="medication">Medication</option>
            <option value="appointment">Appointment</option>
            <option value="checkin">Check-in</option>
            <option value="lab_followup">Lab Follow-up</option>
          </select>
          <select
            value={form.channel}
            onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
            style={{ border: "1.5px solid #D0E4D8", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", background: "#fff" }}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="push">Push</option>
            <option value="both">Both</option>
          </select>
        </div>
        <button
          type="button"
          disabled={adding || !form.title.trim()}
          onClick={() => void addReminder()}
          style={{ background: "#1B8A4A", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: adding ? "wait" : "pointer", fontFamily: "inherit" }}
        >
          {adding ? "Adding…" : "+ Add Reminder"}
        </button>
      </div>

      {/* Reminder list */}
      {reminders.length === 0 ? (
        <div style={{ fontSize: 13, color: "#8FA39A", textAlign: "center", padding: "12px 0" }}>
          No reminders yet. Add one above or let AI suggest based on your health records.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {reminders.map((r) => (
            <div
              key={r.id}
              style={{
                background: "#fff",
                border: "1px solid #E8F0EB",
                borderRadius: 10,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                opacity: r.isActive ? 1 : 0.5,
              }}
            >
              <span style={{ fontSize: 18 }}>
                {r.reminderType === "medication" ? "💊" : r.reminderType === "appointment" ? "📅" : r.reminderType === "lab_followup" ? "🧪" : "🔔"}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1A2B23" }}>{r.title}</div>
                <div style={{ fontSize: 11, color: "#8FA39A" }}>
                  via {r.channel}{r.isAiGenerated ? " · AI suggested" : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void toggleReminder(r.id, r.isActive)}
                style={{
                  border: "none",
                  borderRadius: 20,
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: r.isActive ? "#E6F5EC" : "#F1F5F9",
                  color: r.isActive ? "#1B8A4A" : "#94a3b8",
                }}
              >
                {r.isActive ? "On" : "Off"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── ABHA Card (P5 stub — full linking in P6) ──────────────────────────────────

function AbhaCard() {
  const [abhaId, setAbhaId] = useState<string | null>(null);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]  = useState(false);
  const [msg, setMsg]        = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/patients/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { patient?: { abhaId?: string | null } }) => {
        setAbhaId(d.patient?.abhaId ?? null);
        setInput(d.patient?.abhaId ?? "");
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  async function saveAbha() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/v1/patients/me", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abhaId: trimmed }),
      });
      if (res.ok) { setAbhaId(trimmed); setMsg("ABHA ID saved!"); }
      else { const d = await res.json() as { error?: string }; setMsg(d.error ?? "Failed to save."); }
    } catch { setMsg("Network error."); }
    finally { setSaving(false); setTimeout(() => setMsg(null), 3000); }
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-700">ABHA Health ID</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Link your Ayushman Bharat Health Account to share records with government hospitals and insurance providers.
          </p>
        </div>
        <span className="flex-shrink-0 text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
          Beta
        </span>
      </div>

      {loading ? (
        <div className="h-10 animate-pulse bg-slate-100 rounded-xl" />
      ) : abhaId ? (
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
          <span className="text-green-600 text-lg">✓</span>
          <div>
            <p className="text-xs text-green-700 font-semibold">Linked</p>
            <p className="text-sm font-mono text-slate-800">{abhaId}</p>
          </div>
          <button
            onClick={() => { setAbhaId(null); setInput(""); }}
            className="ml-auto text-xs text-red-400 hover:text-red-600 transition"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="14-digit ABHA number (e.g. 1234-5678-9012-34)"
            className="flex-1 text-sm px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-emerald-400 transition"
          />
          <button
            onClick={() => void saveAbha()}
            disabled={!input.trim() || saving}
            className="px-4 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition"
            style={{ background: "#1B8A4A" }}
          >
            {saving ? "Saving…" : "Link"}
          </button>
        </div>
      )}

      {msg && (
        <p className={`text-xs font-medium ${msg.includes("saved") ? "text-green-700" : "text-red-600"}`}>
          {msg}
        </p>
      )}

      <p className="text-xs text-slate-400">
        Full ABHA integration with NHA Health Locker coming in a future update.
      </p>
    </section>
  );
}

// ── Diet Plan Markdown Renderer ──────────────────────────────────────────────

function DietPlanMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="text-sm text-slate-700 leading-relaxed space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;

        // H2: ## or **SECTION** style headers
        if (trimmed.startsWith("## ")) {
          return <h3 key={i} className="text-base font-bold text-slate-800 mt-4 mb-1 border-b border-emerald-200 pb-1">{renderInline(trimmed.slice(3))}</h3>;
        }
        // H3: ### headers
        if (trimmed.startsWith("### ")) {
          return <h4 key={i} className="text-sm font-bold text-emerald-700 mt-3 mb-0.5">{renderInline(trimmed.slice(4))}</h4>;
        }
        // H1: # (rare but handle)
        if (trimmed.startsWith("# ")) {
          return <h2 key={i} className="text-lg font-bold text-slate-900 mt-4 mb-1">{renderInline(trimmed.slice(2))}</h2>;
        }
        // Bold-only lines (e.g. **Day 1 — Monday**)
        if (/^\*\*.+\*\*$/.test(trimmed)) {
          return <p key={i} className="font-bold text-slate-800 mt-3 mb-0.5">{renderInline(trimmed)}</p>;
        }
        // Bullet points
        if (/^[-•*]\s/.test(trimmed)) {
          return <div key={i} className="flex gap-2 pl-2"><span className="text-emerald-500 shrink-0">•</span><span>{renderInline(trimmed.replace(/^[-•*]\s+/, ""))}</span></div>;
        }
        // Numbered list
        if (/^\d+[.)]\s/.test(trimmed)) {
          const num = trimmed.match(/^(\d+)[.)]\s/)?.[1] ?? "";
          const rest = trimmed.replace(/^\d+[.)]\s+/, "");
          return <div key={i} className="flex gap-2 pl-2"><span className="text-emerald-600 font-semibold shrink-0 w-5 text-right">{num}.</span><span>{renderInline(rest)}</span></div>;
        }
        // Regular paragraph
        return <p key={i}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}

/** Render inline markdown: **bold**, *italic* */
function renderInline(text: string) {
  // Split on **bold** and *italic*
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Coach Markdown Renderer (for AI chat bubbles) ───────────────────────────

function CoachMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1.5" />;
        if (trimmed.startsWith("### ")) {
          return <p key={i} className="font-bold text-emerald-800 mt-2 mb-0.5 text-[13px]">{renderInline(trimmed.slice(4))}</p>;
        }
        if (trimmed.startsWith("## ")) {
          return <p key={i} className="font-bold text-slate-900 mt-2 mb-0.5 text-[13px] border-b border-slate-200 pb-0.5">{renderInline(trimmed.slice(3))}</p>;
        }
        if (/^\*\*.+\*\*$/.test(trimmed)) {
          return <p key={i} className="font-bold text-slate-800 mt-2 mb-0.5">{renderInline(trimmed)}</p>;
        }
        if (/^[-•*]\s/.test(trimmed)) {
          return <div key={i} className="flex gap-1.5 pl-1 mb-0.5"><span className="text-emerald-600 shrink-0">•</span><span>{renderInline(trimmed.replace(/^[-•*]\s+/, ""))}</span></div>;
        }
        if (/^\d+[.)]\s/.test(trimmed)) {
          const num = trimmed.match(/^(\d+)[.)]\s/)?.[1] ?? "";
          const rest = trimmed.replace(/^\d+[.)]\s+/, "");
          return <div key={i} className="flex gap-1.5 pl-1 mb-0.5"><span className="text-emerald-700 font-semibold shrink-0 w-4 text-right">{num}.</span><span>{renderInline(rest)}</span></div>;
        }
        return <p key={i}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}

const LS_DIET_PLAN = "eh_diet_plan_v1";

// ── Diet Plan Tab ─────────────────────────────────────────────────────────────

function DietPlanTab({ canUsePremium, lang = "en" }: { canUsePremium: boolean; lang?: string }) {
  const EMPTY_DP: DietProfile = { foodPref: "", foodLikes: "", foodDislikes: "", goal: "", goalWeight: "", age: "", activityLevel: "" };
  const [dp, setDp] = useState<DietProfile>(() => lsGet<DietProfile>(LS_DIET_PROFILE, EMPTY_DP));
  const [plan, setPlan]       = useState<string | null>(() => lsGet<{ plan: string; date: string } | null>(LS_DIET_PLAN, null)?.plan ?? null);
  const [planDate, setPlanDate] = useState<string | null>(() => lsGet<{ plan: string; date: string } | null>(LS_DIET_PLAN, null)?.date ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [recentVitals, setRecentVitals] = useState<VitalsEntry[]>([]);
  const [hp, setHp] = useState<HealthProfile>({ height: "", weight: "", bloodGroup: "", conditions: "", allergies: "" });

  useEffect(() => {
    fetch("/api/v1/patients/vitals", { credentials: "include" }).then(async (r) => {
      if (r.ok) {
        const j = await r.json() as { data?: Array<{ id: string; recordedDate: string; bp: string | null; pulse: string | null; glucose: string | null; weight: string | null }> };
        setRecentVitals((j.data ?? []).slice(0, 10).map((v) => ({
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

  async function saveProfile() {
    setSaving(true); setSaved(false);
    try {
      await fetch("/api/v1/patients/health-profile", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ height: hp.height || null, weight: hp.weight || null, bloodGroup: hp.bloodGroup || null, conditions: hp.conditions || null, allergies: hp.allergies || null }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }

  async function generatePlan() {
    if (!canUsePremium) return;
    setLoading(true); setError(null); setPlan(null);
    try {
      const res = await fetch("/api/v1/patients/diet-plan", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...hp, ...dp, vitals: recentVitals }),
      });
      if (res.ok) {
        const j = await res.json() as { plan?: string };
        const p = j.plan ?? "No plan generated.";
        const d = new Date().toISOString();
        setPlan(p); setPlanDate(d);
        lsSet(LS_DIET_PLAN, { plan: p, date: d });
      }
      else { const j = await res.json() as { error?: string }; setError(j.error ?? "Failed to generate plan."); }
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  // ── Progress helpers ──────────────────────────────────────────────────────
  function calcBmi() {
    const h = parseFloat(hp.height);
    const w = parseFloat(hp.weight || (recentVitals.find(v => v.weight)?.weight ?? ""));
    if (!h || !w) return null;
    return w / ((h / 100) ** 2);
  }

  function bmiLabel(bmi: number) {
    if (bmi < 18.5) return { label: "Underweight", color: "text-blue-600 bg-blue-50 border-blue-200" };
    if (bmi < 25)   return { label: "Normal",       color: "text-emerald-600 bg-emerald-50 border-emerald-200" };
    if (bmi < 30)   return { label: "Overweight",   color: "text-amber-600 bg-amber-50 border-amber-200" };
    return               { label: "Obese",          color: "text-red-600 bg-red-50 border-red-200" };
  }

  function weightTrend() {
    const vals = recentVitals.map(v => v.weight ? parseFloat(v.weight) : NaN).filter(n => !isNaN(n));
    if (vals.length < 2) return null;
    const diff = vals[0] - vals[1];
    if (Math.abs(diff) < 0.3) return { icon: "→", label: "Stable", diff: 0, goodFor: ["maintain"] };
    if (diff < 0) return { icon: "↘", label: `−${Math.abs(diff).toFixed(1)} kg`, diff, goodFor: ["lose_weight"] };
    return { icon: "↗", label: `+${diff.toFixed(1)} kg`, diff, goodFor: ["gain_weight", "fitness"] };
  }

  function bpTrend() {
    const vals = recentVitals.map(v => {
      const m = v.bp?.match(/^(\d+)/); return m ? parseInt(m[1]) : NaN;
    }).filter(n => !isNaN(n));
    if (vals.length < 2) return null;
    const diff = vals[0] - vals[1];
    if (Math.abs(diff) < 3) return { icon: "→", label: "Stable", systolic: vals[0], ok: vals[0] < 130 };
    if (diff < 0) return { icon: "↘", label: `${vals[0]} mmHg ↓`, systolic: vals[0], ok: true };
    return { icon: "↗", label: `${vals[0]} mmHg ↑`, systolic: vals[0], ok: vals[0] < 130 };
  }

  function glucoseTrend() {
    const vals = recentVitals.map(v => v.glucose ? parseFloat(v.glucose) : NaN).filter(n => !isNaN(n));
    if (vals.length < 2) return null;
    const diff = vals[0] - vals[1];
    if (Math.abs(diff) < 5) return { icon: "→", label: "Stable", value: vals[0], ok: vals[0] < 140 };
    if (diff < 0) return { icon: "↘", label: `${vals[0]} mg/dL ↓`, value: vals[0], ok: true };
    return { icon: "↗", label: `${vals[0]} mg/dL ↑`, value: vals[0], ok: vals[0] < 140 };
  }

  const bmi = calcBmi();
  const wt = weightTrend(); const bp = bpTrend(); const gl = glucoseTrend();
  const isOnTrack = (t: { goodFor?: string[]; ok?: boolean } | null) => {
    if (!t) return null;
    if ("goodFor" in t && dp.goal) return (t.goodFor ?? []).includes(dp.goal);
    if ("ok" in t) return t.ok ?? true;
    return null;
  };

  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500";

  const GOALS = [
    { val: "lose_weight", label: "🎯 Lose Weight" },
    { val: "gain_weight", label: "💪 Gain Weight" },
    { val: "maintain",    label: "⚖️ Maintain Weight" },
    { val: "manage_diabetes", label: "🩸 Manage Diabetes" },
    { val: "manage_bp",   label: "❤️ Manage BP" },
    { val: "fitness",     label: "🏃 General Fitness" },
  ] as const;

  const ACTIVITY = [
    { val: "sedentary", label: "🛋️ Sedentary" },
    { val: "light",     label: "🚶 Light" },
    { val: "moderate",  label: "🚴 Moderate" },
    { val: "active",    label: "🏋️ Active" },
  ] as const;

  return (
    <div className="space-y-6">

      {/* ── Health Profile & Goals ── */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-700">Health Profile & Goals</p>
            <p className="text-xs text-slate-400 mt-0.5">Used to personalise your AI diet plan</p>
          </div>
          <button onClick={() => void saveProfile()} disabled={saving}
            className="text-xs font-semibold text-white px-3 py-1.5 rounded-xl disabled:opacity-50"
            style={{ background: "#1B8A4A" }}>
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save Profile"}
          </button>
        </div>

        {/* Body measurements */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Height (cm)", value: hp.height, set: (v: string) => setHp(p => ({ ...p, height: v })), placeholder: "e.g. 168" },
            { label: "Current Weight (kg)", value: hp.weight, set: (v: string) => setHp(p => ({ ...p, weight: v })), placeholder: "e.g. 72" },
            { label: "Goal Weight (kg)", value: dp.goalWeight, set: (v: string) => saveDp({ goalWeight: v }), placeholder: "e.g. 65" },
            { label: "Age", value: dp.age, set: (v: string) => saveDp({ age: v }), placeholder: "e.g. 34" },
          ].map((f) => (
            <div key={f.label}>
              <label className="text-xs font-semibold text-slate-500 block mb-1">{f.label}</label>
              <input type="text" value={f.value} onChange={(e) => f.set(e.target.value)}
                placeholder={f.placeholder} className={inputCls} />
            </div>
          ))}
        </div>

        {/* Goal */}
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-2">Health Goal</label>
          <div className="flex flex-wrap gap-2">
            {GOALS.map(({ val, label }) => (
              <button key={val} type="button" onClick={() => saveDp({ goal: val })}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${dp.goal === val ? "text-white border-transparent" : "text-slate-600 border-slate-200 bg-white hover:border-emerald-400"}`}
                style={dp.goal === val ? { background: "#1B8A4A" } : {}}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Activity level */}
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-2">Activity Level</label>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY.map(({ val, label }) => (
              <button key={val} type="button" onClick={() => saveDp({ activityLevel: val })}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${dp.activityLevel === val ? "text-white border-transparent" : "text-slate-600 border-slate-200 bg-white hover:border-emerald-400"}`}
                style={dp.activityLevel === val ? { background: "#1B8A4A" } : {}}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Medical details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Blood Group</label>
            <select value={hp.bloodGroup} onChange={(e) => setHp(p => ({ ...p, bloodGroup: e.target.value }))} className={inputCls}>
              <option value="">Select</option>
              {["A+","A−","B+","B−","AB+","AB−","O+","O−"].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Medical Conditions</label>
            <input type="text" value={hp.conditions} onChange={(e) => setHp(p => ({ ...p, conditions: e.target.value }))}
              placeholder="e.g. Diabetes, Hypertension" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Allergies</label>
            <input type="text" value={hp.allergies} onChange={(e) => setHp(p => ({ ...p, allergies: e.target.value }))}
              placeholder="e.g. Peanuts, Lactose" className={inputCls} />
          </div>
        </div>

        {/* BMI card */}
        {bmi && (() => { const bl = bmiLabel(bmi); return (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold ${bl.color}`}>
            <span className="text-2xl">⚖️</span>
            <div>
              <span className="font-bold">BMI: {bmi.toFixed(1)}</span>
              <span className="mx-2">·</span>
              <span>{bl.label}</span>
            </div>
            {dp.goalWeight && hp.height && (() => {
              const h = parseFloat(hp.height); const gw = parseFloat(dp.goalWeight);
              const goalBmi = gw / ((h / 100) ** 2);
              return <span className="ml-auto text-xs font-normal opacity-70">Goal BMI: {goalBmi.toFixed(1)}</span>;
            })()}
          </div>
        ); })()}
      </section>

      {/* ── Food Preferences ── */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div>
          <p className="text-sm font-bold text-slate-700">Food Preferences</p>
          <p className="text-xs text-slate-400 mt-0.5">Helps AI pick the right foods for your culture and taste</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-2">Diet Type</label>
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
            <label className="text-xs font-semibold text-slate-500 block mb-1">Foods I Love</label>
            <input type="text" value={dp.foodLikes} onChange={(e) => saveDp({ foodLikes: e.target.value })}
              placeholder="e.g. Rice, Dal, Idli, Dosa" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Foods I Avoid</label>
            <input type="text" value={dp.foodDislikes} onChange={(e) => saveDp({ foodDislikes: e.target.value })}
              placeholder="e.g. Spicy food, Fried items" className={inputCls} />
          </div>
        </div>
      </section>

      {/* ── Weekly Progress & Direction ── */}
      {recentVitals.length > 0 ? (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-700">Weekly Progress</p>
            <span className="text-xs text-slate-400">{recentVitals.length} readings logged</span>
          </div>

          {/* Trend cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Weight", trend: wt, icon: "⚖️", unit: "kg" },
              { label: "Blood Pressure", trend: bp, icon: "🫀", unit: "" },
              { label: "Glucose", trend: gl, icon: "🩸", unit: "" },
            ].map(({ label, trend, icon }) => {
              const onTrack = isOnTrack(trend);
              return (
                <div key={label} className={`rounded-xl border p-3 text-center ${
                  onTrack === true ? "bg-emerald-50 border-emerald-200" :
                  onTrack === false ? "bg-red-50 border-red-200" :
                  "bg-slate-50 border-slate-200"
                }`}>
                  <p className="text-lg mb-0.5">{icon}</p>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
                  {trend ? (
                    <>
                      <p className={`text-xl font-bold mt-1 ${onTrack === true ? "text-emerald-600" : onTrack === false ? "text-red-500" : "text-slate-600"}`}>
                        {trend.icon}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{"label" in trend ? trend.label : ""}</p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 mt-2">Need 2+ readings</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Direction summary */}
          {dp.goal && (wt || bp || gl) && (() => {
            const wtOk = isOnTrack(wt); const bpOk = isOnTrack(bp); const glOk = isOnTrack(gl);
            const positives = [wtOk, bpOk, glOk].filter(x => x === true).length;
            const negatives = [wtOk, bpOk, glOk].filter(x => x === false).length;
            const GOAL_LABELS: Record<string, string> = { lose_weight: "weight loss", gain_weight: "weight gain", maintain: "maintenance", manage_diabetes: "diabetes management", manage_bp: "BP management", fitness: "fitness" };
            return (
              <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
                positives > negatives ? "bg-emerald-50 border-emerald-200" :
                negatives > positives ? "bg-red-50 border-red-200" :
                "bg-amber-50 border-amber-200"
              }`}>
                <span className="text-2xl">{positives > negatives ? "🎉" : negatives > positives ? "⚠️" : "📊"}</span>
                <div>
                  <p className="text-xs font-bold text-slate-700">
                    {positives > negatives ? "You're on track!" : negatives > positives ? "Needs attention" : "Mixed signals"}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {positives > negatives
                      ? `Your trends support your ${GOAL_LABELS[dp.goal] ?? "goal"}. Keep it up!`
                      : negatives > positives
                      ? `Some metrics are moving against your ${GOAL_LABELS[dp.goal] ?? "goal"}. Generate a new plan below.`
                      : "Log more vitals for a clearer direction."}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Vitals table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-slate-100">
                {["Date","Weight","BP","Glucose","Pulse"].map((h) => <th key={h} className="text-left py-1.5 px-2 text-slate-400 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {recentVitals.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-slate-600">{formatDate(v.date)}</td>
                    <td className="py-1.5 px-2 text-slate-600">{v.weight ? `${v.weight} kg` : "—"}</td>
                    <td className="py-1.5 px-2 text-slate-600">{v.bp ?? "—"}</td>
                    <td className="py-1.5 px-2 text-slate-600">{v.glucose ?? "—"}</td>
                    <td className="py-1.5 px-2 text-slate-600">{v.pulse ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-400">Log vitals weekly in the <strong>Reminders → Elder Care</strong> section for trend tracking.</p>
          <MedicalDisclaimer lang={lang} />
        </section>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          📊 No vitals recorded yet. Log weight, glucose, and BP weekly in the <strong>Reminders</strong> tab to see your progress direction here.
        </div>
      )}

      {/* ── AI Diet Plan ── */}
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
            <p className="text-xs text-slate-400 mt-0.5">Gemini analyses your vitals trends and generates an adaptive weekly plan</p>
          </div>
          <button onClick={() => void generatePlan()} disabled={loading || !canUsePremium}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm disabled:opacity-60 transition"
            style={{ background: "#1B8A4A" }}>
            {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analysing…</> : "✨ Generate This Week's Plan"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        {plan ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Your Personalised Diet Plan</p>
              <span className="text-xs text-emerald-600">Generated {planDate ? new Date(planDate).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN")}</span>
            </div>
            <DietPlanMarkdown text={plan} />
            <MedicalDisclaimer lang={lang} />
          </div>
        ) : !loading && (
          <div className={`text-center py-8 ${!canUsePremium ? "blur-sm select-none pointer-events-none" : ""}`}>
            <p className="text-4xl mb-3">🥗</p>
            <p className="text-sm font-medium text-slate-600">Complete your health profile above, then generate your plan.</p>
            <p className="text-xs text-slate-400 mt-1">{recentVitals.length > 0 ? `AI will analyse ${recentVitals.length} vitals readings for progress-aware suggestions.` : "Add vitals in Reminders tab for progress-aware diet advice."}</p>
          </div>
        )}
      </section>

      {/* ── Dietitian CTA ── */}
      <section className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl border border-teal-200 p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-100 border border-teal-200 flex items-center justify-center text-2xl shrink-0">🥦</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm">Need a Dietitian?</p>
            <p className="text-xs text-slate-600 mt-1">Get a 1-on-1 consultation with a certified clinical dietitian for a medically-tailored plan.</p>
            <a href="/doctors?specialty=dietitian" className="inline-block mt-3 px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm" style={{ background: "#1B8A4A" }}>
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
  const [preferredLang, setPreferredLang] = useState<string>(() => lsGet<string>(LS_PREFERRED_LANG, "en"));

  function changeLang(lang: string) { setPreferredLang(lang); lsSet(LS_PREFERRED_LANG, lang); }

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
    { tab: "records",      icon: "📋", label: "Health Records" },
    { tab: "coach",        icon: "🤖", label: "AI Health Coach",   premium: true },
    { tab: "wearable",     icon: "⌚", label: "Wearable Devices" },
    { tab: "rewards",      icon: "🏆", label: "Rewards" },
    { tab: "reminders",    icon: "💊", label: "Reminders",       premium: true },
    { tab: "diet",         icon: "🥗", label: "Diet Plan",        premium: true },
    { tab: "profile",      icon: "👤", label: "My Profile" },
  ];

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden">
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

        <nav className="flex-1 p-2 pb-20 md:pb-2 space-y-0.5 overflow-y-auto">
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
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-6">

          {/* Page title + language toggle */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                {activeTab === "home"         ? `${getGreeting()}, ${patientName.split(" ")[0]}` :
                 activeTab === "appointments" ? "My Appointments" :
                 activeTab === "records"      ? "Health Records" :
                 activeTab === "coach"        ? "AI Health Coach" :
                 activeTab === "wearable"     ? "Wearable Devices" :
                 activeTab === "rewards"      ? "Rewards" :
                 activeTab === "diet"         ? "Diet Plan" :
                 activeTab === "profile"      ? "My Profile" :
                 "Care Reminders"}
              </h1>
              <p className="text-sm text-slate-400">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            {/* Language toggle — always visible on mobile */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
              {[
                { code: "en", label: "EN" },
                { code: "hi", label: "हि" },
              ].map(({ code, label }) => (
                <button key={code} onClick={() => changeLang(code)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${preferredLang === code ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  style={preferredLang === code ? { background: "#1B8A4A" } : {}}>
                  {label}
                </button>
              ))}
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
                  { tab: "records"      as DashboardTab, icon: "📋", label: "Health Records",  desc: "Documents, labs & progress" },
                  { tab: "coach"        as DashboardTab, icon: "🤖", label: "AI Health Coach", desc: "Chat, analysis & triage" },
                  { tab: "wearable"     as DashboardTab, icon: "⌚", label: "Wearable Devices", desc: "Sync health data" },
                  { tab: "rewards"      as DashboardTab, icon: "🏆", label: "Rewards",          desc: "Points, streaks & referrals" },
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
          {activeTab === "records"      && <RecordsTab appointments={appointments} />}
          {activeTab === "coach"        && <CoachTab canUsePremium={trial.canUsePremium} lang={preferredLang} />}
          {activeTab === "wearable"     && <WearableTab />}
          {activeTab === "rewards"      && <RewardsTab />}
          {activeTab === "diet"         && <DietPlanTab canUsePremium={trial.canUsePremium} lang={preferredLang} />}
          {activeTab === "profile"      && <ProfileTab patientName={patientName} canUsePremium={trial.canUsePremium} lang={preferredLang} onLangChange={changeLang} />}
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
