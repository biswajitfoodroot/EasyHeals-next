"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  hospitalId: string;
  hospitalName?: string;
  doctorId?: string;
  doctorName?: string;
};

type AuthState = "loading" | "logged_in" | "guest";

export default function AuthBookingModal({
  isOpen,
  onClose,
  hospitalId,
  hospitalName,
  doctorId,
  doctorName,
}: Props) {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/v1/patients/me", { credentials: "include" })
      .then((r) => setAuthState(r.ok ? "logged_in" : "guest"))
      .catch(() => setAuthState("guest"));
  }, [isOpen]);

  if (!isOpen) return null;

  function handleClose() {
    setStatus("idle");
    setErrorMsg("");
    setPreferredDate("");
    setNotes("");
    onClose();
  }

  function handleLoginRedirect() {
    const currentPath = window.location.pathname;
    router.push(`/login?next=${encodeURIComponent(currentPath)}`);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const scheduledAt = preferredDate
        ? new Date(preferredDate + "T09:00:00").toISOString()
        : undefined;

      const res = await fetch("/api/v1/appointments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId,
          doctorId: doctorId || undefined,
          type: "in_person",
          scheduledAt,
          patientNotes: notes || undefined,
          consentGranted: true,
        }),
      });

      const json = await res.json().catch(() => ({})) as {
        data?: { appointmentId: string };
        error?: { message: string };
      };

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(json?.error?.message ?? "Booking failed. Please try again.");
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please check your connection.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex justify-between items-start"
          style={{ background: "#1B8A4A" }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#a7f3c9" }}>
              EasyHeals
            </p>
            <h2 className="text-white text-lg font-bold mt-0.5">
              {doctorName ? `Book with Dr. ${doctorName.replace(/^Dr\.?\s*/i, "")}` : "Book Appointment"}
            </h2>
            {hospitalName && <p className="text-sm mt-0.5" style={{ color: "#d1fae5" }}>{hospitalName}</p>}
          </div>
          <button onClick={handleClose} className="text-white/70 hover:text-white text-2xl leading-none mt-1">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {authState === "loading" && (
            <div className="flex justify-center py-8">
              <span className="w-6 h-6 border-2 border-slate-200 border-t-green-600 rounded-full animate-spin" />
            </div>
          )}

          {authState === "guest" && (
            <div className="text-center py-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "#f0fdf4" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B8A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800">Login to Book</h3>
              <p className="text-sm text-slate-500 mt-2 mb-6">
                Please verify your phone number to book an appointment. It only takes 30 seconds.
              </p>
              <button
                onClick={handleLoginRedirect}
                className="w-full py-3 text-white font-semibold rounded-xl text-sm"
                style={{ background: "#1B8A4A" }}
              >
                Login with OTP
              </button>
              <button
                onClick={handleClose}
                className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 mt-2"
              >
                Cancel
              </button>
            </div>
          )}

          {authState === "logged_in" && status === "success" && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800">Appointment Requested!</h3>
              <p className="text-slate-500 text-sm mt-2 mb-4">
                Your appointment request has been sent. The hospital will confirm shortly.
              </p>
              <button
                onClick={() => { handleClose(); router.push("/dashboard/appointments"); }}
                className="w-full py-2.5 text-white font-semibold rounded-xl text-sm"
                style={{ background: "#1B8A4A" }}
              >
                View My Appointments
              </button>
            </div>
          )}

          {authState === "logged_in" && status !== "success" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {status === "error" && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Preferred Date (optional)
                </label>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none bg-slate-50"
                  style={{ "--tw-ring-color": "#1B8A4A" } as React.CSSProperties}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Symptoms / Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe your symptoms or reason for visit..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none bg-slate-50 resize-none"
                />
              </div>

              <p className="text-xs text-slate-400">
                By booking, you consent to EasyHeals processing your appointment request.
              </p>

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full py-3 text-white font-semibold rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: "#1B8A4A" }}
              >
                {status === "loading" ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Booking...
                  </>
                ) : "Confirm Appointment Request"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
