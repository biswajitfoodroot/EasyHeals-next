"use client";

import { FormEvent, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

export type BookingHospital = { id: string; name: string; city?: string | null };
export type BookingDoctor   = { id: string; name: string; specialty?: string | null; avatarUrl?: string | null };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-selected hospital. If omitted and doctorHospitals has >1 entry, hospital selection step shows. */
  hospitalId?: string;
  hospitalName?: string;
  doctorId?: string;
  doctorName?: string;
  /** All hospitals the doctor is affiliated with. Enables multi-hospital selection (doctor booking path). */
  doctorHospitals?: BookingHospital[];
  /** All doctors at this hospital. Enables department → doctor selection (hospital booking path). */
  hospitalDoctors?: BookingDoctor[];
};

type AuthState = "loading" | "logged_in" | "guest";
type ApptType  = "in_person" | "audio_consultation" | "video_consultation";

const TYPE_OPTIONS: { value: ApptType; icon: string; label: string; desc: string }[] = [
  { value: "in_person",          icon: "🏥", label: "In-Person",   desc: "Visit the hospital or clinic" },
  { value: "audio_consultation", icon: "📞", label: "Audio Call",  desc: "Phone or audio consultation" },
  { value: "video_consultation", icon: "🎥", label: "Video Call",  desc: "Face-to-face video session" },
];

export default function AuthBookingModal({
  isOpen, onClose,
  hospitalId: hospitalIdProp, hospitalName: hospitalNameProp,
  doctorId: doctorIdProp, doctorName: doctorNameProp,
  doctorHospitals, hospitalDoctors,
}: Props) {
  const router = useRouter();

  // ── Doctor booking path: choose which hospital ──────────────────────────────
  const needsHospitalPick = !hospitalIdProp && doctorHospitals && doctorHospitals.length > 1;
  const [selectedHospital, setSelectedHospital] = useState<BookingHospital | null>(
    hospitalIdProp
      ? { id: hospitalIdProp, name: hospitalNameProp ?? "" }
      : (doctorHospitals?.length === 1 ? doctorHospitals[0] : null),
  );
  const hospitalId   = selectedHospital?.id   ?? hospitalIdProp   ?? "";
  const hospitalName = selectedHospital?.name ?? hospitalNameProp;

  // ── Hospital booking path: choose department → doctor ───────────────────────
  // hasDoctorList is true whenever hospitalDoctors prop is explicitly passed (even if empty),
  // meaning we are on a hospital page and MUST pick a doctor before booking.
  const hasDoctorList = !doctorIdProp && hospitalDoctors !== undefined;

  const departments = useMemo(() => {
    if (!hospitalDoctors) return [];
    const seen = new Set<string>();
    const depts: string[] = [];
    for (const d of hospitalDoctors) {
      const dept = d.specialty ?? "General";
      if (!seen.has(dept)) { seen.add(dept); depts.push(dept); }
    }
    return depts;
  }, [hospitalDoctors]);

  const [selectedDept,   setSelectedDept]   = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<BookingDoctor | null>(null);

  const filteredDoctors = useMemo(() => {
    if (!hospitalDoctors || !selectedDept) return [];
    return hospitalDoctors.filter((d) => (d.specialty ?? "General") === selectedDept);
  }, [hospitalDoctors, selectedDept]);

  // Final doctor id / name (either prop or chosen from list)
  const doctorId   = selectedDoctor?.id   ?? doctorIdProp;
  const doctorName = selectedDoctor?.name ?? doctorNameProp;

  // ── Auth & booking state ────────────────────────────────────────────────────
  const [authState,    setAuthState]    = useState<AuthState>("loading");
  const [apptType,     setApptType]     = useState<ApptType>("in_person");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("09:00");
  const [notes,        setNotes]        = useState("");
  const [status,       setStatus]       = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg,     setErrorMsg]     = useState("");
  const [appointmentId, setAppointmentId] = useState<string | null>(null);

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
    setPreferredTime("09:00");
    setNotes("");
    setApptType("in_person");
    setAppointmentId(null);
    setSelectedDept(null);
    setSelectedDoctor(null);
    if (!hospitalIdProp) setSelectedHospital(doctorHospitals?.length === 1 ? doctorHospitals[0] : null);
    onClose();
  }

  const isRemote = apptType !== "in_person";

  // Whether we still need to pick a department/doctor (hospital booking path)
  const needsDoctorPick = hasDoctorList && !selectedDoctor;

  // Whether to show the booking form
  const showBookingForm = (!needsHospitalPick || selectedHospital) && !needsDoctorPick;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      let scheduledAt: string | undefined;
      if (preferredDate) {
        scheduledAt = new Date(`${preferredDate}T${preferredTime}:00`).toISOString();
      }
      const res = await fetch("/api/v1/appointments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId,
          doctorId: doctorId || undefined,
          type: apptType,
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
      setAppointmentId(json.data?.appointmentId ?? null);
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
        <div className="px-6 py-4 flex justify-between items-start" style={{ background: "#1B8A4A" }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-green-200">EasyHeals</p>
            <h2 className="text-white text-lg font-bold mt-0.5">
              {doctorName
                ? `Book with Dr. ${doctorName.replace(/^Dr\.?\s*/i, "")}`
                : "Book Appointment"}
            </h2>
            {hospitalName && <p className="text-sm mt-0.5 text-green-100">{hospitalName}</p>}
          </div>
          <button onClick={handleClose} className="text-white/70 hover:text-white text-2xl leading-none mt-1">×</button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">

          {/* ── Step 1 (doctor path): Pick hospital ──────────────────────────── */}
          {needsHospitalPick && !selectedHospital && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-gray-800">Choose a Location</p>
              <p className="text-xs text-gray-500">
                Dr. {doctorName ? doctorName.replace(/^Dr\.?\s*/i, "") : "this doctor"} practises at multiple hospitals. Where would you like to book?
              </p>
              <div className="space-y-2">
                {doctorHospitals!.map((h) => (
                  <button key={h.id} type="button"
                    onClick={() => setSelectedHospital(h)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-slate-200 hover:border-green-500 hover:bg-green-50 transition text-left">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{h.name}</p>
                      {h.city && <p className="text-xs text-gray-500">{h.city}</p>}
                    </div>
                    <span className="text-green-600 text-lg">→</span>
                  </button>
                ))}
              </div>
              <button onClick={handleClose} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          )}

          {/* ── Step 1 (hospital path): Pick department ───────────────────────── */}
          {hasDoctorList && !selectedDept && (!needsHospitalPick || selectedHospital) && (
            <div className="space-y-3">
              {departments.length === 0 ? (
                /* No affiliated doctors yet */
                <div className="text-center py-6 space-y-3">
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-3xl">🏥</div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">No Doctors Available Yet</p>
                    <p className="text-xs text-gray-500 mt-1">
                      This hospital has not yet listed affiliated doctors on EasyHeals.
                      Please call the hospital directly or check back soon.
                    </p>
                  </div>
                  <button onClick={handleClose}
                    className="w-full py-2.5 text-white font-semibold rounded-xl text-sm"
                    style={{ background: "#1B8A4A" }}>
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-bold text-gray-800">Select Department</p>
                  <p className="text-xs text-gray-500">Which department would you like to visit?</p>
                  <div className="space-y-2">
                    {departments.map((dept) => {
                      const count = (hospitalDoctors ?? []).filter((d) => (d.specialty ?? "General") === dept).length;
                      return (
                        <button key={dept} type="button"
                          onClick={() => setSelectedDept(dept)}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-slate-200 hover:border-green-500 hover:bg-green-50 transition text-left">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{dept}</p>
                            <p className="text-xs text-gray-500">{count} doctor{count !== 1 ? "s" : ""} available</p>
                          </div>
                          <span className="text-green-600 text-lg">→</span>
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={handleClose} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                </>
              )}
            </div>
          )}

          {/* ── Step 2 (hospital path): Pick doctor within department ─────────── */}
          {hasDoctorList && selectedDept && !selectedDoctor && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedDept(null)} className="text-green-600 hover:text-green-800 text-sm font-semibold">← Back</button>
                <p className="text-sm font-bold text-gray-800">{selectedDept} — Choose Doctor</p>
              </div>
              <div className="space-y-2">
                {filteredDoctors.map((d) => (
                  <button key={d.id} type="button"
                    onClick={() => setSelectedDoctor(d)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-slate-200 hover:border-green-500 hover:bg-green-50 transition text-left">
                    <div className="w-10 h-10 rounded-full bg-green-50 border border-green-100 flex items-center justify-center shrink-0 text-lg">
                      {d.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.avatarUrl} alt={d.name} className="w-10 h-10 rounded-full object-cover" />
                      ) : "👨‍⚕️"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Dr. {d.name.replace(/^Dr\.?\s*/i, "")}</p>
                      {d.specialty && <p className="text-xs text-gray-500">{d.specialty}</p>}
                    </div>
                    <span className="text-green-600 text-lg ml-auto">→</span>
                  </button>
                ))}
              </div>
              <button onClick={handleClose} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          )}

          {/* ── Booking flow ─────────────────────────────────────────────────── */}
          {showBookingForm && (<>

          {/* Loading auth */}
          {authState === "loading" && (
            <div className="flex justify-center py-8">
              <span className="w-6 h-6 border-2 border-slate-200 border-t-green-600 rounded-full animate-spin" />
            </div>
          )}

          {/* Guest — must log in */}
          {authState === "guest" && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-green-50">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B8A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Login to Book</h3>
              <p className="text-sm text-gray-600 mt-2 mb-6">Please verify your phone number to book an appointment.</p>
              <button
                onClick={() => router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)}
                className="w-full py-3 text-white font-semibold rounded-xl text-sm"
                style={{ background: "#1B8A4A" }}
              >
                Login with OTP
              </button>
              <button onClick={handleClose} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 mt-2">Cancel</button>
            </div>
          )}

          {/* Success */}
          {authState === "logged_in" && status === "success" && (
            <div className="text-center py-4 space-y-3">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Appointment Requested!</h3>
              {isRemote ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                  <p className="font-semibold mb-0.5">Next step: Payment</p>
                  <p>The hospital will review and set a consultation fee. You&apos;ll receive a payment link once confirmed.</p>
                </div>
              ) : (
                <p className="text-sm text-gray-600">The hospital will confirm your appointment shortly.</p>
              )}
              <button
                onClick={() => { handleClose(); router.push("/dashboard/appointments"); }}
                className="w-full py-2.5 text-white font-semibold rounded-xl text-sm"
                style={{ background: "#1B8A4A" }}
              >
                View My Appointments
              </button>
            </div>
          )}

          {/* Booking form */}
          {authState === "logged_in" && status !== "success" && (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">

              {/* Selected doctor chip (hospital path) */}
              {selectedDoctor && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                  <span className="text-lg">👨‍⚕️</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-green-900">Dr. {selectedDoctor.name.replace(/^Dr\.?\s*/i, "")}</p>
                    {selectedDoctor.specialty && <p className="text-xs text-green-700">{selectedDoctor.specialty}</p>}
                  </div>
                  <button type="button" onClick={() => setSelectedDoctor(null)}
                    className="text-xs text-green-600 hover:text-green-800 font-semibold shrink-0">Change</button>
                </div>
              )}

              {/* Error */}
              {status === "error" && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
                  {errorMsg}
                </div>
              )}

              {/* Type selector */}
              <div>
                <p className="text-sm font-bold text-gray-800 mb-2">Appointment Type</p>
                <div className="grid grid-cols-3 gap-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setApptType(opt.value)}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 text-center transition-all ${
                        apptType === opt.value
                          ? "border-green-600 bg-green-50"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <span className="text-xl mb-1">{opt.icon}</span>
                      <span className={`text-xs font-bold ${apptType === opt.value ? "text-green-700" : "text-gray-700"}`}>
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-gray-500 mt-0.5 leading-tight">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Remote consultation info */}
              {isRemote && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
                  <p className="font-bold text-blue-800 mb-0.5">
                    {apptType === "video_consultation" ? "🎥 Video Consultation" : "📞 Audio Consultation"}
                  </p>
                  <p className="text-blue-700 text-xs">
                    The hospital will set the consultation fee and share a meeting link once your request is accepted.
                    {apptType === "video_consultation" && " Your documents can be shared during the session."}
                  </p>
                </div>
              )}

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1.5">Preferred Date</label>
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1.5">Preferred Time</label>
                  <input
                    type="time"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1.5">
                  {isRemote ? "Reason / Symptoms" : "Symptoms / Notes"}
                  <span className="font-normal text-gray-500 ml-1">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isRemote ? "Describe your reason for consultation..." : "Describe your symptoms or reason for visit..."}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white resize-none"
                />
              </div>

              <p className="text-xs text-gray-500">
                By booking, you consent to EasyHeals processing your appointment request.
              </p>

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full py-3 text-white font-bold rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: "#1B8A4A" }}
              >
                {status === "loading" ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Booking...
                  </>
                ) : `Request ${TYPE_OPTIONS.find(t => t.value === apptType)?.label ?? "Appointment"}`}
              </button>
            </form>
          )}

          </>)} {/* end booking flow conditional */}
        </div>
      </div>
    </div>
  );
}
