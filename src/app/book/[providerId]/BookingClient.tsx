"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Provider {
  id: string;
  name: string;
  type: "hospital" | "doctor";
  city: string | null;
  specialization?: string | null;
  address?: string | null;
  phone?: string | null;
  fees?: number | null;
}

interface Slot {
  id: string;
  startsAt: string;
  endsAt: string;
  doctorId: string | null;
  hospitalId: string | null;
  isAvailable: boolean;
}

type Step = 1 | 2 | 3 | 4;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function getNext7Days(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BookingClient({ providerId }: { providerId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>(1);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loadingProvider, setLoadingProvider] = useState(true);

  // Step 2 — slot selection
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  // Step 3 — appointment type + notes
  const [apptType, setApptType] = useState<"in_person" | "online_consultation">("in_person");
  const [notes, setNotes] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);

  // Step 4 — confirmation
  const [booking, setBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ appointmentId: string } | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const days = getNext7Days();
  const providerType = searchParams.get("type") as "hospital" | "doctor" | null ?? "hospital";

  useEffect(() => {
    void loadProvider();
  }, [providerId]);

  useEffect(() => {
    if (step === 2) void loadSlots(selectedDate);
  }, [step, selectedDate]);

  async function loadProvider() {
    setLoadingProvider(true);
    try {
      const endpoint = providerType === "doctor"
        ? `/api/v1/providers/doctors/${providerId}`
        : `/api/v1/providers/hospitals/${providerId}`;
      const res = await fetch(endpoint, { credentials: "include" });
      if (res.ok) {
        const j = await res.json() as { data: Provider };
        setProvider(j.data);
      } else {
        // Fallback: try the public hospital profile
        const fallback = await fetch(`/api/public/hospitals/${providerId}`);
        if (fallback.ok) {
          const j = await fallback.json() as { data: Provider };
          setProvider(j.data);
        }
      }
    } catch { /* non-fatal */ }
    finally { setLoadingProvider(false); }
  }

  async function loadSlots(date: Date) {
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlotId(null);
    try {
      const dateStr = date.toISOString().slice(0, 10);
      const params = new URLSearchParams({ date: dateStr });
      if (providerType === "doctor") params.set("doctorId", providerId);
      else params.set("hospitalId", providerId);

      const res = await fetch(`/api/v1/slots?${params}`, { credentials: "include" });
      if (res.ok) {
        const j = await res.json() as { data: Slot[] };
        setSlots(j.data ?? []);
      }
    } catch { /* non-fatal */ }
    finally { setLoadingSlots(false); }
  }

  async function handleBook() {
    setBooking(true);
    setBookingError(null);
    try {
      const selectedSlot = slots.find((s) => s.id === selectedSlotId);
      const res = await fetch("/api/v1/appointments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: apptType,
          slotId: selectedSlotId,
          doctorId: providerType === "doctor" ? providerId : selectedSlot?.doctorId ?? null,
          hospitalId: providerType === "hospital" ? providerId : selectedSlot?.hospitalId ?? null,
          patientNotes: notes.trim() || null,
          scheduledAt: selectedSlot?.startsAt ?? selectedDate.toISOString(),
          consentGiven: consentChecked,
        }),
      });

      const j = await res.json() as { data?: { id: string }; error?: string };
      if (!res.ok) {
        if (res.status === 401) { router.push("/login"); return; }
        setBookingError(j.error ?? "Booking failed. Please try again.");
        return;
      }
      setBookingResult({ appointmentId: j.data!.id });
      setStep(4);
    } catch {
      setBookingError("Network error. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  // ── Step indicators ────────────────────────────────────────────────────────

  const STEPS = ["Provider", "Select Slot", "Confirm", "Done"];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        {step > 1 && step < 4 ? (
          <button onClick={() => setStep((s) => (s - 1) as Step)} className="text-slate-400 hover:text-slate-700 text-sm">
            ← Back
          </button>
        ) : (
          <Link href="/hospitals" className="text-slate-400 hover:text-slate-700 text-sm">← Search</Link>
        )}
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-800">Book Appointment</span>
      </div>

      {/* Step progress */}
      <div className="bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          {STEPS.map((label, i) => {
            const stepNum = (i + 1) as Step;
            const active = step === stepNum;
            const done = step > stepNum;
            return (
              <div key={label} className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${done ? "bg-green-500 text-white" : active ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {done ? "✓" : stepNum}
                </div>
                <span className={`text-xs font-medium ${active ? "text-slate-800" : "text-slate-400"}`}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">

        {/* ── STEP 1: Provider overview ─────────────────────────────────── */}
        {step === 1 && (
          <>
            {loadingProvider ? (
              <div className="animate-pulse bg-slate-200 rounded-2xl h-32" />
            ) : provider ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                    {providerType === "doctor" ? "👨‍⚕️" : "🏥"}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base font-bold text-slate-800">{provider.name}</h2>
                    {provider.specialization && <p className="text-sm text-slate-500">{provider.specialization}</p>}
                    {provider.city && <p className="text-xs text-slate-400 mt-1">📍 {provider.city}</p>}
                    {provider.fees && <p className="text-sm font-semibold text-green-700 mt-2">Consultation Fee: ₹{provider.fees}</p>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <p className="text-sm text-slate-600 font-semibold">Provider ID: {providerId}</p>
                <p className="text-xs text-slate-400 mt-1">Loading provider details...</p>
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Appointment Type</label>
              <div className="grid grid-cols-2 gap-3">
                {(["in_person", "online_consultation"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setApptType(t)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition ${apptType === t ? "border-green-500 bg-green-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                  >
                    <span className="text-2xl">{t === "in_person" ? "🏥" : "🎥"}</span>
                    <span className="text-xs font-semibold text-slate-700">{t === "in_person" ? "In-Person" : "Video Consult"}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-3 text-sm font-bold text-white rounded-2xl"
              style={{ background: "#1B8A4A" }}
            >
              Select Date & Time →
            </button>
          </>
        )}

        {/* ── STEP 2: Slot selection ────────────────────────────────────── */}
        {step === 2 && (
          <>
            {/* Date picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Select Date</label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {days.map((d) => {
                  const active = d.toDateString() === selectedDate.toDateString();
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => setSelectedDate(d)}
                      className={`shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border-2 transition ${active ? "border-green-500 bg-green-50" : "border-slate-200 bg-white"}`}
                    >
                      <span className="text-xs text-slate-500">{d.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                      <span className="text-base font-bold text-slate-800">{d.getDate()}</span>
                      <span className="text-xs text-slate-400">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slot grid */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Available Slots</label>
              {loadingSlots ? (
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="animate-pulse bg-slate-200 rounded-xl h-12" />)}
                </div>
              ) : slots.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                  <p className="text-sm text-slate-500">No slots available for this date.</p>
                  <p className="text-xs text-slate-400 mt-1">Try another date or contact the provider.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.filter((s) => s.isAvailable).map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`py-2.5 text-xs font-semibold rounded-xl border-2 transition ${selectedSlotId === slot.id ? "border-green-500 bg-green-50 text-green-700" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}
                    >
                      {formatTime(slot.startsAt)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setStep(3)}
              disabled={!selectedSlotId && slots.length > 0}
              className="w-full py-3 text-sm font-bold text-white rounded-2xl disabled:opacity-50"
              style={{ background: "#1B8A4A" }}
            >
              {slots.length === 0 ? "Continue Without Slot →" : "Confirm Slot →"}
            </button>
          </>
        )}

        {/* ── STEP 3: Confirm + notes ───────────────────────────────────── */}
        {step === 3 && (
          <>
            {/* Summary card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-800">Booking Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Provider</span>
                  <span className="font-medium text-slate-800">{provider?.name ?? providerId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="font-medium text-slate-800">{apptType === "in_person" ? "In-Person" : "Video Consult"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date</span>
                  <span className="font-medium text-slate-800">{formatDate(selectedDate.toISOString())}</span>
                </div>
                {selectedSlotId && slots.find((s) => s.id === selectedSlotId) && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Time</span>
                    <span className="font-medium text-slate-800">{formatTime(slots.find((s) => s.id === selectedSlotId)!.startsAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Reason for visit (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe your symptoms or reason for the appointment..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none"
              />
            </div>

            {/* Consent */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-green-600"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                I consent to share my contact information with the healthcare provider for appointment coordination, under the{" "}
                <Link href="/privacy" className="underline text-green-700">EasyHeals Privacy Policy</Link> and DPDP Act 2023.
              </span>
            </label>

            {bookingError && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">{bookingError}</div>
            )}

            <button
              onClick={() => void handleBook()}
              disabled={booking || !consentChecked}
              className="w-full py-3 text-sm font-bold text-white rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "#1B8A4A" }}
            >
              {booking ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Booking...</>
              ) : "Confirm Booking"}
            </button>
          </>
        )}

        {/* ── STEP 4: Success ───────────────────────────────────────────── */}
        {step === 4 && bookingResult && (
          <div className="text-center space-y-5 py-8">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-4xl mx-auto">✅</div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Appointment Requested!</h2>
              <p className="text-sm text-slate-500 mt-1">You'll receive a confirmation once the provider confirms your slot.</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Appointment ID</span>
                <span className="font-mono text-xs text-slate-600">{bookingResult.appointmentId.slice(0, 8)}…</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className="text-yellow-700 font-semibold bg-yellow-50 px-2 py-0.5 rounded-full text-xs">Requested</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                href="/dashboard/appointments"
                className="w-full py-3 text-sm font-bold text-white rounded-2xl text-center"
                style={{ background: "#1B8A4A" }}
              >
                View My Appointments
              </Link>
              <Link
                href={`/dashboard/previsit-brief/${bookingResult.appointmentId}`}
                className="w-full py-3 text-sm font-medium text-slate-600 border border-slate-200 rounded-2xl text-center hover:bg-slate-50"
              >
                View Pre-Visit Brief (when ready)
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
