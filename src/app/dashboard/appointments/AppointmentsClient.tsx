"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BottomSheet } from "@/components/BottomSheet";

// ── Types ────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  type: "in_person" | "audio_consultation" | "video_consultation" | "online_consultation";
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
  // local UI state augmentation
  _refundPending?: boolean;
}

type Tab = "upcoming" | "past" | "cancelled";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(dt: string | null) {
  if (!dt) return "Time TBC";
  const d = new Date(dt);
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    requested: "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed: "bg-green-100 text-green-800 border-green-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-slate-100 text-slate-700 border-slate-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
    no_show: "bg-orange-100 text-orange-700 border-orange-200",
  };
  return map[status] ?? "bg-slate-100 text-slate-600 border-slate-200";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor(status)}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  if (type === "audio_consultation") {
    return <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">📞 Audio</span>;
  }
  if (type === "video_consultation" || type === "online_consultation") {
    return <span className="text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">🎥 Video</span>;
  }
  return <span className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">🏥 In-Person</span>;
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse bg-slate-200 rounded-2xl h-28" />
      ))}
    </div>
  );
}

// ── Pre-Visit Brief Sheet ─────────────────────────────────────────────────────

interface BriefData {
  summary?: string;
  activeConditions?: string[];
  currentMedications?: string[];
  recentLabsHighlights?: string[];
  vitalsHighlights?: string[];
  reasonForVisit?: string;
  questionsForDoctor?: string[];
  redFlags?: string[];
}

function PreVisitBriefSheet({ appointmentId, open, onClose }: { appointmentId: string; open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || brief || loading) return;
    setLoading(true);
    fetch(`/api/v1/patients/previsit-briefs?appointmentId=${appointmentId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { data?: Array<{ brief: BriefData }> }) => {
        const b = d.data?.[0]?.brief;
        if (b) setBrief(b);
        else setError("Pre-visit brief not ready yet. It will be generated 24h before your appointment.");
      })
      .catch(() => setError("Failed to load brief. Please try again."))
      .finally(() => setLoading(false));
  }, [open, appointmentId, brief, loading]);

  return (
    <BottomSheet open={open} onClose={onClose} title="Pre-Visit Brief" subtitle="AI-generated health summary for your doctor">
      <div style={{ padding: "0 20px 24px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: 14 }}>
            Loading your health brief...
          </div>
        )}
        {error && !loading && (
          <div style={{ padding: "12px 16px", background: "#fef3c7", borderRadius: 10, color: "#92400e", fontSize: 13, lineHeight: 1.5 }}>
            {error}
          </div>
        )}
        {brief && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {brief.summary && (
              <BriefSection title="Health Summary" emoji="📋" content={[brief.summary]} isSummary />
            )}
            {(brief.redFlags?.length ?? 0) > 0 && (
              <BriefSection title="Important Flags" emoji="🚨" content={brief.redFlags!} urgent />
            )}
            {(brief.activeConditions?.length ?? 0) > 0 && (
              <BriefSection title="Active Conditions" emoji="🏥" content={brief.activeConditions!} />
            )}
            {(brief.currentMedications?.length ?? 0) > 0 && (
              <BriefSection title="Current Medications" emoji="💊" content={brief.currentMedications!} />
            )}
            {(brief.recentLabsHighlights?.length ?? 0) > 0 && (
              <BriefSection title="Recent Lab Highlights" emoji="🧪" content={brief.recentLabsHighlights!} />
            )}
            {(brief.vitalsHighlights?.length ?? 0) > 0 && (
              <BriefSection title="Recent Vitals" emoji="💗" content={brief.vitalsHighlights!} />
            )}
            {brief.reasonForVisit && (
              <BriefSection title="Reason for Visit" emoji="📝" content={[brief.reasonForVisit]} isSummary />
            )}
            {(brief.questionsForDoctor?.length ?? 0) > 0 && (
              <BriefSection title="Questions to Ask" emoji="❓" content={brief.questionsForDoctor!} />
            )}
            <div style={{ padding: "10px 14px", background: "#f0fdf4", borderRadius: 10, fontSize: 12, color: "#15803d" }}>
              ✓ This brief is shared with your doctor automatically before your visit.
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

function BriefSection({ title, emoji, content, isSummary, urgent }: {
  title: string; emoji: string; content: string[]; isSummary?: boolean; urgent?: boolean;
}) {
  return (
    <div style={{
      background: urgent ? "#fff1f2" : "#f8fafc",
      borderRadius: 12,
      padding: "12px 14px",
      border: urgent ? "1px solid #fecdd3" : "1px solid #f1f5f9",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: urgent ? "#be123c" : "#0f172a", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <span>{emoji}</span> {title}
      </div>
      {isSummary ? (
        <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0 }}>{content[0]}</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          {content.map((item, i) => (
            <li key={i} style={{ fontSize: 13, color: urgent ? "#9f1239" : "#374151", marginBottom: 3, lineHeight: 1.5 }}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Appointment card ──────────────────────────────────────────────────────────

function AppointmentCard({
  appt,
  onCancel,
  onModify,
  onPay,
  cancelling,
  modifying,
  paying,
}: {
  appt: Appointment;
  onCancel: (id: string, reason: string) => void;
  onModify: (id: string, scheduledAt: string, notes: string) => void;
  onPay: (id: string) => void;
  cancelling: string | null;
  modifying: string | null;
  paying: string | null;
}) {
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [rescheduleNotes, setRescheduleNotes] = useState(appt.patientNotes ?? "");
  const [showBrief, setShowBrief] = useState(false);
  const isRemote = appt.type === "audio_consultation" || appt.type === "video_consultation" || appt.type === "online_consultation";
  const isConfirmed = appt.status === "confirmed";
  const isUpcoming = ["requested", "confirmed", "in_progress"].includes(appt.status);
  // canJoin: paid, waived, or no payment configured (legacy "none" treated as free)
  const canJoin = isRemote && isConfirmed && !!appt.meetingUrl &&
    (appt.paymentStatus === "paid" || appt.paymentStatus === "waived" || appt.paymentStatus === "none" || !appt.paymentStatus);
  // needsPayment: ONLY when hospital explicitly set a fee > 0 (paymentStatus = "pending")
  const needsPayment = isRemote && isConfirmed && appt.paymentStatus === "pending";

  function typeLabel(type: string) {
    if (type === "audio_consultation") return "Audio Consultation";
    if (type === "video_consultation" || type === "online_consultation") return "Video Consultation";
    return "In-person Visit";
  }

  return (
    <div id={`appt-${appt.id}`} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 transition-colors">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {/* Left: info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <StatusBadge status={appt.status} />
            <TypeBadge type={appt.type} />
          </div>
          <p className="font-semibold text-slate-800 truncate">
            {appt.doctorName ?? "Doctor TBC"}
          </p>
          <p className="text-sm text-slate-500">
            {appt.hospitalName ?? "Hospital TBC"}
            {appt.hospitalCity ? `, ${appt.hospitalCity}` : ""}
          </p>
          <p className="text-sm text-slate-600 mt-1">
            {typeLabel(appt.type)} &bull; {formatDateTime(appt.scheduledAt)}
          </p>
          {appt.cancellationReason && (
            <p className="mt-1 text-xs text-red-500">Reason: {appt.cancellationReason}</p>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex flex-col gap-2 items-end shrink-0">
          {canJoin && appt.meetingUrl && (
            <a
              href={appt.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 text-white text-sm font-semibold rounded-xl shadow-sm transition inline-flex items-center gap-1.5"
              style={{ background: "#1B8A4A" }}
            >
              {appt.type === "video_consultation" || appt.type === "online_consultation" ? "🎥" : "📞"} Join Session
            </a>
          )}
          {/* Reschedule — only for requested status */}
          {appt.status === "requested" && !showCancelForm && (
            <button
              onClick={() => { setShowReschedule((v) => !v); }}
              disabled={modifying === appt.id}
              className="text-xs text-blue-500 hover:text-blue-700 transition disabled:opacity-50"
            >
              {showReschedule ? "Close" : "Reschedule"}
            </button>
          )}
          {isUpcoming && !showReschedule && (
            <button
              onClick={() => { setShowCancelForm((v) => !v); setCancelReason(""); }}
              disabled={cancelling === appt.id}
              className="text-xs text-red-500 hover:text-red-700 transition disabled:opacity-50"
            >
              {cancelling === appt.id ? "Cancelling..." : (showCancelForm ? "Keep" : "Cancel")}
            </button>
          )}
        </div>
      </div>

      {/* ── Cancel reason form ── */}
      {showCancelForm && isUpcoming && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
          <p className="text-xs font-semibold text-red-700">Why are you cancelling?</p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Please provide a reason (e.g. schedule conflict, feeling better)..."
            rows={2}
            className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 bg-white resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowCancelForm(false)}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
            >Keep Appointment</button>
            <button
              onClick={() => { onCancel(appt.id, cancelReason); setShowCancelForm(false); }}
              disabled={!cancelReason.trim() || cancelling === appt.id}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50 transition"
            >
              {cancelling === appt.id ? "Cancelling..." : "Confirm Cancel"}
            </button>
          </div>
        </div>
      )}

      {/* ── Reschedule form ── */}
      {showReschedule && appt.status === "requested" && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
          <p className="text-xs font-semibold text-blue-700">Choose a new date & time</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                min={new Date(Date.now() + 3600000).toISOString().split("T")[0]}
                className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Time</label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Updated notes (optional)</label>
            <textarea
              value={rescheduleNotes}
              onChange={(e) => setRescheduleNotes(e.target.value)}
              rows={2}
              placeholder="Any additional info for the hospital..."
              className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowReschedule(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
            <button
              onClick={() => {
                if (!newDate) return;
                const iso = new Date(`${newDate}T${newTime}:00`).toISOString();
                onModify(appt.id, iso, rescheduleNotes);
                setShowReschedule(false);
              }}
              disabled={!newDate || modifying === appt.id}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition"
            >
              {modifying === appt.id ? "Saving..." : "Confirm Reschedule"}
            </button>
          </div>
        </div>
      )}

      {/* ── Refund pending badge ── */}
      {appt._refundPending && (
        <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-800 font-medium">
          💰 Refund pending — our team will process your refund within 5–7 business days.
        </div>
      )}

      {/* Payment banner for pending remote consultations */}
      {needsPayment && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-amber-800">Payment Required</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Consultation fee:{" "}
              {appt.consultationFee != null ? (
                <span className="font-bold">₹{appt.consultationFee}</span>
              ) : "Set by hospital"}
            </p>
          </div>
          <button
            onClick={() => onPay(appt.id)}
            disabled={paying === appt.id}
            className="px-4 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-60 flex items-center gap-2 shrink-0"
            style={{ background: "#d97706" }}
          >
            {paying === appt.id ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : "Pay Now"}
          </button>
        </div>
      )}

      {/* Paid/waived confirmation for remote appointments */}
      {isRemote && isConfirmed && appt.paymentStatus === "paid" && (
        <div className="p-2.5 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 font-medium">
          ✅ Payment confirmed{appt.consultationFee ? ` — ₹${appt.consultationFee}` : ""}. Use the Join Session button to connect.
        </div>
      )}
      {isRemote && isConfirmed && appt.paymentStatus === "waived" && (
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-medium">
          Free consultation. Use the Join Session button to connect.
        </div>
      )}

      {/* Pre-Visit Brief — only for confirmed upcoming appointments */}
      {isConfirmed && isUpcoming && (
        <button
          onClick={() => setShowBrief(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-teal-50 border border-teal-200 rounded-xl text-sm font-medium text-teal-800 transition hover:bg-teal-100"
        >
          <span>📋</span>
          <span className="flex-1 text-left">View Pre-Visit Brief</span>
          <svg className="w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {showBrief && (
        <PreVisitBriefSheet
          appointmentId={appt.id}
          open={showBrief}
          onClose={() => setShowBrief(false)}
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AppointmentsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("id");
  const [loading, setLoading] = useState(true);
  const [appointmentsList, setAppointmentsList] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [modifying, setModifying] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/v1/appointments", { credentials: "include" });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.ok) {
          const j = (await res.json()) as { data: Appointment[] };
          setAppointmentsList(j.data ?? []);
        }
      } catch {
        setError("Failed to load appointments. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [router]);

  useEffect(() => {
    if (!loading && highlightId && appointmentsList.length > 0) {
      // Find the tab the highlighted appointment belongs to and switch if needed
      const appt = appointmentsList.find(a => a.id === highlightId);
      if (appt) {
        if (appt.status === "cancelled") setActiveTab("cancelled");
        else if (["completed", "no_show"].includes(appt.status)) setActiveTab("past");
        else setActiveTab("upcoming");

        // Wait for render, then scroll
        setTimeout(() => {
          const el = document.getElementById(`appt-${highlightId}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("ring-2", "ring-emerald-500", "bg-emerald-50/30");
            setTimeout(() => el.classList.remove("ring-2", "ring-emerald-500", "bg-emerald-50/30"), 2000);
          }
        }, 100);
      }
    }
  }, [loading, highlightId, appointmentsList]);

  async function handleCancel(id: string, reason: string) {
    setCancelling(id);
    try {
      const res = await fetch(`/api/v1/appointments/${id}/cancel`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json().catch(() => ({}) as { data?: { refundPending?: boolean }; error?: { message?: string } });
      if (res.ok) {
        setAppointmentsList((prev) =>
          prev.map((a) =>
            a.id === id
              ? { ...a, status: "cancelled", _refundPending: json.data?.refundPending ?? false }
              : a
          )
        );
      } else {
        setError(json.error?.message ?? "Could not cancel. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCancelling(null);
    }
  }

  async function handleModify(id: string, scheduledAt: string, patientNotes: string) {
    setModifying(id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/appointments/${id}/modify`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt, patientNotes: patientNotes || undefined }),
      });
      const json = await res.json().catch(() => ({}) as { data?: { scheduledAt?: string }; error?: { message?: string } });
      if (res.ok) {
        setAppointmentsList((prev) =>
          prev.map((a) =>
            a.id === id
              ? { ...a, scheduledAt: json.data?.scheduledAt ?? scheduledAt, status: "requested", patientNotes }
              : a
          )
        );
      } else {
        setError(json.error?.message ?? "Could not reschedule. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setModifying(null);
    }
  }

  async function handlePay(id: string) {
    setPaying(id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/portal/appointments/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay" }),
      });
      if (res.ok) {
        setAppointmentsList((prev) =>
          prev.map((a) => (a.id === id ? { ...a, paymentStatus: "paid" } : a))
        );
      } else {
        const j = await res.json().catch(() => ({})) as { error?: { message?: string } };
        setError(j?.error?.message ?? "Payment failed. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPaying(null);
    }
  }

  // Filter by tab
  const upcomingStatuses = ["requested", "confirmed", "in_progress"];
  const pastStatuses = ["completed", "no_show"];

  const filtered = appointmentsList.filter((a) => {
    if (activeTab === "upcoming") return upcomingStatuses.includes(a.status);
    if (activeTab === "past") return pastStatuses.includes(a.status);
    if (activeTab === "cancelled") return a.status === "cancelled";
    return false;
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "upcoming", label: "Upcoming" },
    { key: "past", label: "Past" },
    { key: "cancelled", label: "Cancelled" },
  ];

  const emptyMessages: Record<Tab, string> = {
    upcoming: "No upcoming appointments. Book one below.",
    past: "No past appointments yet.",
    cancelled: "No cancelled appointments.",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-slate-800">My Appointments</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === t.key
                  ? "text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              style={activeTab === t.key ? { background: "#1B8A4A" } : {}}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Appointment list */}
        {loading ? (
          <Skeleton />
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <p className="text-slate-400 text-sm">{emptyMessages[activeTab]}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((a) => (
              <AppointmentCard
                key={a.id}
                appt={a}
                onCancel={handleCancel}
                onModify={handleModify}
                onPay={handlePay}
                cancelling={cancelling}
                modifying={modifying}
                paying={paying}
              />
            ))}
          </div>
        )}

        {/* Book new */}
        <div className="pt-2">
          <Link
            href="/hospitals"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm shadow-sm transition"
            style={{ background: "#1B8A4A" }}
          >
            <span>+</span> Book New Appointment
          </Link>
        </div>
      </main>
    </div>
  );
}
