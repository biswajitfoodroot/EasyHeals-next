"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── Types ────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  type: "in_person" | "online_consultation";
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
  sessionId?: string | null;
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

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse bg-slate-200 rounded-2xl h-28" />
      ))}
    </div>
  );
}

// ── Appointment card ──────────────────────────────────────────────────────────

function AppointmentCard({
  appt,
  onCancel,
  cancelling,
}: {
  appt: Appointment;
  onCancel: (id: string) => void;
  cancelling: string | null;
}) {
  const isOnline = appt.type === "online_consultation";
  const isConfirmed = appt.status === "confirmed";
  const isUpcoming = ["requested", "confirmed", "in_progress"].includes(appt.status);
  const canJoin = isOnline && isConfirmed && !!appt.sessionId;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {/* Left: info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-base">{isOnline ? "📹" : "🏥"}</span>
            <StatusBadge status={appt.status} />
          </div>
          <p className="font-semibold text-slate-800 truncate">
            {appt.doctorName ?? "Doctor TBC"}
          </p>
          <p className="text-sm text-slate-500">
            {appt.hospitalName ?? "Hospital TBC"}
            {appt.hospitalCity ? `, ${appt.hospitalCity}` : ""}
          </p>
          <p className="text-sm text-slate-600 mt-1">
            {isOnline ? "Video Consultation" : "In-person Visit"} &bull;{" "}
            {formatDateTime(appt.scheduledAt)}
          </p>
          {appt.cancellationReason && (
            <p className="mt-1 text-xs text-red-500">Reason: {appt.cancellationReason}</p>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex flex-col gap-2 items-end shrink-0">
          {canJoin && (
            <Link
              href={`/consultation/${appt.sessionId}`}
              className="px-4 py-2 text-white text-sm font-semibold rounded-xl shadow-sm transition"
              style={{ background: "#1B8A4A" }}
            >
              Join Now
            </Link>
          )}
          <Link
            href={`/dashboard/appointments`}
            className="text-xs font-medium underline text-slate-500 hover:text-slate-700"
          >
            View Details
          </Link>
          {isUpcoming && (
            <button
              onClick={() => onCancel(appt.id)}
              disabled={cancelling === appt.id}
              className="text-xs text-red-500 hover:text-red-700 transition disabled:opacity-50"
            >
              {cancelling === appt.id ? "Cancelling..." : "Cancel"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AppointmentsClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [cancelling, setCancelling] = useState<string | null>(null);
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
          setAppointments(j.data ?? []);
        }
      } catch {
        setError("Failed to load appointments. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [router]);

  async function handleCancel(id: string) {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    setCancelling(id);
    try {
      const res = await fetch(`/api/v1/appointments/${id}/cancel`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Patient cancelled" }),
      });
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a))
        );
      } else {
        alert("Could not cancel. Please try again.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setCancelling(null);
    }
  }

  // Filter by tab
  const upcomingStatuses = ["requested", "confirmed", "in_progress"];
  const pastStatuses = ["completed", "no_show"];

  const filtered = appointments.filter((a) => {
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
                cancelling={cancelling}
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
