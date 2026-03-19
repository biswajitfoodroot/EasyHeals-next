"use client";

/**
 * ConsultationRoomCard
 *
 * P3 Day 3 — Online consultation room entry card (HLD §5.7).
 *
 * When isEnabled=false (feature flag video_consultation=OFF): "Coming soon" placeholder.
 * When isEnabled=true: shows session-aware join/start button.
 *
 * Session states:
 *   null/undefined      — no session yet (doctor: "Start Session", patient: "Waiting for doctor")
 *   scheduled           — session created but not active (patient: "Join Waiting Room")
 *   active              — live session (all: green "Join Now")
 *   ended               — "Consultation Completed"
 *
 * Props:
 *   appointmentId  — used to start a new session (POST /api/v1/consultations/{id}/start)
 *   sessionId      — if session already exists (navigate to /consultation/{sessionId})
 *   sessionStatus  — scheduled | active | ended | null
 *   role           — "patient" | "doctor" | "staff"
 *   isEnabled      — video_consultation feature flag (server-resolved)
 *   scheduledAt    — appointment time
 *   doctorName     — shown in header
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ConsultationRoomCardProps {
  appointmentId: string;
  sessionId?: string | null;
  sessionStatus?: "scheduled" | "active" | "ended" | null;
  role?: "patient" | "doctor" | "staff";
  roomUrl?: string | null; // legacy: direct URL fallback
  isEnabled?: boolean;
  scheduledAt?: Date | string | null;
  doctorName?: string | null;
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-8 w-8 text-gray-300"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
      />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        d="M15.75 10.5 20.47 5.75A.75.75 0 0 1 21.75 6v12a.75.75 0 0 1-1.28.53l-4.72-4.75M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
      />
    </svg>
  );
}

function formatDate(dt: Date | string | null | undefined): string {
  if (!dt) return "—";
  const d = typeof dt === "string" ? new Date(dt) : dt;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Locked state (default — feature_flag: consultation_room = OFF) ──────────

function LockedState({
  scheduledAt,
  doctorName,
}: {
  scheduledAt?: Date | string | null;
  doctorName?: string | null;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
      <LockIcon />
      <h3 className="mt-3 text-sm font-semibold text-gray-500">Online Consultation</h3>
      <p className="mt-1 text-xs text-gray-400">
        Video consultation rooms are coming soon.
      </p>

      {(scheduledAt || doctorName) && (
        <div className="mt-4 w-full rounded-lg bg-white p-3 text-left shadow-sm">
          {doctorName && (
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">Doctor:</span> {doctorName}
            </p>
          )}
          {scheduledAt && (
            <p className="mt-1 text-xs text-gray-500">
              <span className="font-medium text-gray-700">Scheduled:</span>{" "}
              {formatDate(scheduledAt)}
            </p>
          )}
        </div>
      )}

      <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
        ⏳ Available in the next update
      </span>
    </div>
  );
}

// ── Active state (P3 activation — feature_flag: video_consultation = ON) ────

function ActiveState({
  appointmentId,
  sessionId,
  sessionStatus,
  role,
  roomUrl,
  scheduledAt,
  doctorName,
}: {
  appointmentId: string;
  sessionId?: string | null;
  sessionStatus?: "scheduled" | "active" | "ended" | null;
  role?: "patient" | "doctor" | "staff";
  roomUrl?: string | null;
  scheduledAt?: Date | string | null;
  doctorName?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDoctor = role === "doctor" || role === "staff";
  const isActive = sessionStatus === "active";

  if (sessionStatus === "ended") {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-green-600 mb-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-medium">Consultation Completed</p>
        </div>
        <p className="text-xs text-gray-400">This online consultation has ended.</p>
      </div>
    );
  }

  const handleJoin = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isDoctor && !sessionId) {
        const res = await fetch(`/api/v1/consultations/${appointmentId}/start`, { method: "POST" });
        const json = await res.json();
        if (!res.ok) { setError(json?.error?.message ?? "Failed to start."); return; }
        router.push(`/consultation/${json.data.sessionId}`);
        return;
      }
      if (sessionId) {
        router.push(`/consultation/${sessionId}`);
        return;
      }
      // Fallback: legacy roomUrl
      if (roomUrl) { window.open(roomUrl, "_blank"); return; }
      setError("Consultation room not ready yet. Please wait for the doctor.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const buttonLabel = loading
    ? "Connecting..."
    : isActive
      ? "Join Now"
      : isDoctor && !sessionId
        ? "Start Session"
        : "Join Waiting Room";

  const canJoin = isDoctor || !!sessionId || !!roomUrl;

  return (
    <div className={`rounded-xl border bg-white shadow-sm ${isActive ? "border-green-300" : "border-blue-100"}`}>
      <div className={`border-b px-4 py-3 ${isActive ? "border-green-50" : "border-blue-50"}`}>
        <div className="flex items-center gap-2">
          {isActive ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          ) : (
            <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
          )}
          <h3 className="text-sm font-semibold text-gray-800">Online Consultation</h3>
          {isActive && <span className="text-xs text-green-600 font-medium">• Live</span>}
        </div>
        {doctorName && <p className="mt-0.5 text-xs text-gray-500">with {doctorName}</p>}
      </div>

      <div className="p-4">
        {scheduledAt && (
          <p className="mb-3 text-xs text-gray-400">{formatDate(scheduledAt)}</p>
        )}

        {error && (
          <p className="mb-3 text-xs text-red-500 bg-red-50 rounded px-3 py-2">{error}</p>
        )}

        <button
          onClick={handleJoin}
          disabled={loading || !canJoin}
          className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isActive ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          <VideoIcon />
          {buttonLabel}
        </button>

        {!canJoin && (
          <p className="mt-2 text-center text-xs text-gray-400">
            Waiting for the doctor to open the room...
          </p>
        )}

        <p className="mt-2 text-center text-xs text-gray-400">
          Powered by Jitsi Meet · end-to-end encrypted
        </p>
      </div>
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────────────────────

export function ConsultationRoomCard({
  appointmentId,
  sessionId,
  sessionStatus,
  role = "patient",
  roomUrl,
  isEnabled = false,
  scheduledAt,
  doctorName,
}: ConsultationRoomCardProps) {
  if (!isEnabled) {
    return <LockedState scheduledAt={scheduledAt} doctorName={doctorName} />;
  }

  return (
    <ActiveState
      appointmentId={appointmentId}
      sessionId={sessionId}
      sessionStatus={sessionStatus}
      role={role}
      roomUrl={roomUrl}
      scheduledAt={scheduledAt}
      doctorName={doctorName}
    />
  );
}
