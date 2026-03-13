"use client";

import { FormEvent, useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  hospitalId?: string;
  hospitalName?: string;
  doctorName?: string;
  source?: string;
};

type FormState = {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  preferredDate: string;
  timeSlot: string;
  notes: string;
};

const TIME_SLOTS = ["Morning (8am–12pm)", "Afternoon (12pm–4pm)", "Evening (4pm–8pm)"];

export default function AppointmentModal({
  isOpen,
  onClose,
  hospitalId,
  hospitalName,
  doctorName,
  source = "web_booking",
}: Props) {
  const [form, setForm] = useState<FormState>({
    fullName: "",
    phone: "",
    email: "",
    city: "",
    preferredDate: "",
    timeSlot: TIME_SLOTS[0],
    notes: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const summary = [
      doctorName ? `Doctor: ${doctorName}` : null,
      hospitalName ? `Hospital: ${hospitalName}` : null,
      form.preferredDate ? `Preferred date: ${form.preferredDate}` : null,
      `Time: ${form.timeSlot}`,
      form.notes ? `Notes: ${form.notes}` : null,
    ]
      .filter(Boolean)
      .join(". ");

    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          email: form.email || undefined,
          city: form.city || undefined,
          medicalSummary: summary,
          hospitalId: hospitalId || undefined,
          source,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Booking failed. Please try again.");
      }

      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message ?? "Something went wrong.");
    }
  }

  function handleClose() {
    setStatus("idle");
    setForm({ fullName: "", phone: "", email: "", city: "", preferredDate: "", timeSlot: TIME_SLOTS[0], notes: "" });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-500 px-6 py-4 flex justify-between items-start">
          <div>
            <p className="text-teal-200 text-xs font-semibold uppercase tracking-wider">EasyHeals</p>
            <h2 className="text-white text-lg font-bold mt-0.5">
              {doctorName ? `Book with Dr. ${doctorName.replace(/^Dr\.?\s*/i, "")}` : "Book Appointment"}
            </h2>
            {hospitalName && <p className="text-teal-100 text-sm mt-0.5">{hospitalName}</p>}
          </div>
          <button onClick={handleClose} className="text-white/70 hover:text-white text-2xl leading-none mt-1">×</button>
        </div>

        {/* Body */}
        <div className="p-6">
          {status === "success" ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800">Request Sent!</h3>
              <p className="text-slate-500 text-sm mt-2">
                We've received your appointment request. The hospital or doctor's team will contact you shortly on <span className="font-medium text-slate-700">{form.phone}</span>.
              </p>
              <button
                onClick={handleClose}
                className="mt-6 w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              {status === "error" && (
                <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Full Name *</label>
                  <input
                    required
                    value={form.fullName}
                    onChange={set("fullName")}
                    placeholder="Your full name"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Phone *</label>
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={set("phone")}
                    placeholder="+91 XXXXX XXXXX"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">City</label>
                  <input
                    value={form.city}
                    onChange={set("city")}
                    placeholder="Your city"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Preferred Date</label>
                  <input
                    type="date"
                    value={form.preferredDate}
                    onChange={set("preferredDate")}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Time Slot</label>
                  <select
                    value={form.timeSlot}
                    onChange={set("timeSlot")}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50"
                  >
                    {TIME_SLOTS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    placeholder="you@example.com (optional)"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={set("notes")}
                    placeholder="Symptoms, concerns, or any other details..."
                    rows={2}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50 resize-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              >
                {status === "loading" ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
                ) : "Confirm Appointment Request"}
              </button>
              <p className="text-center text-xs text-slate-400 mt-2">
                Free service · No registration required · Team will call you back
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
