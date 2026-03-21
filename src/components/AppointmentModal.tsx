"use client";

/**
 * AppointmentModal — Smart booking modal with two paths:
 *
 * PATH A (authenticated patient — has eh_patient_session cookie):
 *   → POST /api/v1/appointments   (real appointment, DB-persisted, consent-gated)
 *   → Fields: type, date, time, notes, consent checkbox
 *
 * PATH B (public visitor — no session):
 *   → POST /api/book              (lead capture, team calls back)
 *   → Fields: fullName, phone, email, city, date, time slot, notes
 *
 * Doctor with multiple hospitals → step 0: hospital selection
 */

import { FormEvent, useEffect, useState } from "react";

export type BookingHospital = { id: string; name: string; city?: string | null };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  hospitalId?: string;
  hospitalName?: string;
  doctorId?: string;
  doctorName?: string;
  /** Pass multiple hospitals when doctor is affiliated with more than one */
  doctorHospitals?: BookingHospital[];
  source?: string;
};

type Step = "hospital_select" | "form" | "success";
type ConsultType = "in_person" | "audio_consultation" | "video_consultation";

const CONSULT_TYPES: { value: ConsultType; icon: string; label: string }[] = [
  { value: "in_person",           icon: "🏥", label: "In Person" },
  { value: "audio_consultation",  icon: "📞", label: "Audio Call" },
  { value: "video_consultation",  icon: "📹", label: "Video Call" },
];

export default function AppointmentModal({
  isOpen,
  onClose,
  hospitalId,
  hospitalName,
  doctorId,
  doctorName,
  doctorHospitals,
  source = "web_booking",
}: Props) {

  // ── Session detection ──────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // ── Selected hospital (resolved from prop or step-0 pick) ─────────────────
  const [selHospitalId,   setSelHospitalId]   = useState(hospitalId ?? "");
  const [selHospitalName, setSelHospitalName] = useState(hospitalName ?? "");

  // ── Step ──────────────────────────────────────────────────────────────────
  const needsHospitalPick = !hospitalId && doctorHospitals && doctorHospitals.length > 1;
  const [step, setStep] = useState<Step>(needsHospitalPick ? "hospital_select" : "form");

  // ── Authenticated form state ───────────────────────────────────────────────
  const [consultType, setConsultType] = useState<ConsultType>("in_person");
  const [apptDate,    setApptDate]    = useState("");
  const [apptTime,    setApptTime]    = useState("10:00");
  const [notes,       setNotes]       = useState("");
  const [consent,     setConsent]     = useState(false);

  // ── Public lead form state ─────────────────────────────────────────────────
  const [fullName,  setFullName]  = useState("");
  const [phone,     setPhone]     = useState("");
  const [email,     setEmail]     = useState("");
  const [city,      setCity]      = useState("");
  const [timeSlot,  setTimeSlot]  = useState("Morning (8am–12pm)");

  // ── UI state ──────────────────────────────────────────────────────────────
  const [loading,  setLoading]  = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ── On open: detect session + reset ───────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setStep(!hospitalId && doctorHospitals && doctorHospitals.length > 1 ? "hospital_select" : "form");
    setSelHospitalId(hospitalId ?? "");
    setSelHospitalName(hospitalName ?? "");
    setErrorMsg("");
    setLoading(false);
    setConsent(false);

    fetch("/api/v1/patients/me", { credentials: "include" })
      .then((r) => setIsAuthenticated(r.ok))
      .catch(() => setIsAuthenticated(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Submit: authenticated path ─────────────────────────────────────────────
  async function submitAuthenticated() {
    if (!consent)       { setErrorMsg("Please accept the consent checkbox to continue."); return; }
    if (!apptDate)      { setErrorMsg("Please select a date for the appointment."); return; }
    if (!selHospitalId) { setErrorMsg("Please select a hospital."); return; }

    setLoading(true);
    setErrorMsg("");

    const scheduledAt = new Date(`${apptDate}T${apptTime}:00`).toISOString();

    try {
      const res = await fetch("/api/v1/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          hospitalId: selHospitalId,
          doctorId: doctorId ?? undefined,
          type: consultType,
          scheduledAt,
          patientNotes: notes || undefined,
          consentGranted: true,
        }),
      });

      const data = await res.json() as { data?: unknown; userMessage?: string; error?: string };
      if (!res.ok) throw new Error(data.userMessage ?? data.error ?? `Booking failed (${res.status})`);
      setStep("success");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // ── Submit: public lead path ───────────────────────────────────────────────
  async function submitLead(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const summary = [
      doctorName      ? `Doctor: ${doctorName}`       : null,
      selHospitalName ? `Hospital: ${selHospitalName}` : null,
      apptDate        ? `Preferred date: ${apptDate}` : null,
      `Time: ${timeSlot}`,
      notes           ? `Notes: ${notes}`             : null,
    ].filter(Boolean).join(". ");

    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          email: email || undefined,
          city: city || undefined,
          medicalSummary: summary,
          hospitalId: selHospitalId || undefined,
          source,
        }),
      });

      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Booking failed. Please try again.");
      setStep("success");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const displayHospital = selHospitalName || hospitalName;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="px-6 py-4 flex justify-between items-start"
          style={{ background: "linear-gradient(135deg, #1B8A4A 0%, #0f6635 100%)" }}
        >
          <div>
            <p className="text-emerald-200 text-xs font-semibold uppercase tracking-wider">EasyHeals</p>
            <h2 className="text-white text-lg font-bold mt-0.5">
              {doctorName
                ? `Book with Dr. ${doctorName.replace(/^Dr\.?\s*/i, "")}`
                : "Book Appointment"}
            </h2>
            {displayHospital && <p className="text-emerald-100 text-sm mt-0.5">{displayHospital}</p>}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none mt-1">×</button>
        </div>

        <div className="p-6">

          {/* ── STEP 0: Hospital selection ── */}
          {step === "hospital_select" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700 mb-2">
                Dr. {doctorName?.replace(/^Dr\.?\s*/i, "")} practices at multiple locations. Where would you like to book?
              </p>
              {doctorHospitals?.map((h) => (
                <button
                  key={h.id}
                  onClick={() => { setSelHospitalId(h.id); setSelHospitalName(h.name); setStep("form"); }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-left transition group"
                >
                  <span className="text-2xl shrink-0">🏥</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 group-hover:text-emerald-700 truncate">{h.name}</p>
                    {h.city && <p className="text-xs text-slate-500">{h.city}</p>}
                  </div>
                  <span className="ml-auto text-slate-300 group-hover:text-emerald-500 shrink-0">→</span>
                </button>
              ))}
            </div>
          )}

          {/* ── SUCCESS ── */}
          {step === "success" && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800">Appointment Requested!</h3>
              <p className="text-slate-500 text-sm mt-2 max-w-xs mx-auto">
                {isAuthenticated
                  ? "Your appointment has been submitted. The hospital will confirm your slot shortly."
                  : `Request received. The team will contact you on ${phone} to confirm.`}
              </p>
              {displayHospital && <p className="text-xs text-slate-400 mt-1">at {displayHospital}</p>}
              <button
                onClick={onClose}
                className="mt-6 w-full py-2.5 text-white font-semibold rounded-xl transition"
                style={{ background: "#1B8A4A" }}
              >
                Done
              </button>
            </div>
          )}

          {/* ── BOOKING FORM ── */}
          {step === "form" && (
            <>
              {errorMsg && (
                <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{errorMsg}</div>
              )}

              {isAuthenticated === null ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  <span className="inline-block w-5 h-5 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin mr-2 align-middle" />
                  Checking session…
                </div>

              ) : isAuthenticated ? (
                /* PATH A: Logged-in patient */
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">Appointment Type</p>
                    <div className="grid grid-cols-3 gap-2">
                      {CONSULT_TYPES.map(({ value, icon, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setConsultType(value)}
                          className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition flex flex-col items-center gap-1 ${
                            consultType === value
                              ? "border-emerald-500 text-white"
                              : "border-slate-200 text-slate-600 hover:border-emerald-300 bg-slate-50"
                          }`}
                          style={consultType === value ? { background: "#1B8A4A" } : {}}
                        >
                          <span className="text-lg">{icon}</span>
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Date *</label>
                      <input
                        type="date"
                        value={apptDate}
                        onChange={(e) => setApptDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Time</label>
                      <input
                        type="time"
                        value={apptTime}
                        onChange={(e) => setApptTime(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Notes for doctor</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Symptoms, concerns, or specific questions…"
                      rows={2}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50 resize-none"
                    />
                  </div>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 accent-emerald-600"
                    />
                    <span className="text-xs text-slate-600">
                      I consent to EasyHeals sharing my appointment details with the selected hospital/doctor for my care.
                    </span>
                  </label>

                  <button
                    onClick={() => void submitAuthenticated()}
                    disabled={loading}
                    className="w-full py-3 text-white font-bold rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: "#1B8A4A" }}
                  >
                    {loading
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Booking…</>
                      : "Confirm Appointment"}
                  </button>
                </div>

              ) : (
                /* PATH B: Public visitor */
                <form onSubmit={(e) => void submitLead(e)} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Full Name *</label>
                      <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Phone *</label>
                      <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50 font-mono" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">City</label>
                      <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Your city"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Preferred Date</label>
                      <input type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} min={new Date().toISOString().split("T")[0]}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Time Slot</label>
                      <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50">
                        {["Morning (8am–12pm)", "Afternoon (12pm–4pm)", "Evening (4pm–8pm)"].map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Notes</label>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Symptoms or concerns…" rows={2}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50 resize-none" />
                    </div>
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full py-3 text-white font-bold rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: "#1B8A4A" }}>
                    {loading
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</>
                      : "Request Appointment"}
                  </button>
                  <p className="text-center text-xs text-slate-400">Free · No registration needed · We will call you back</p>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
