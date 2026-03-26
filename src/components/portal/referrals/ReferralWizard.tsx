"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  onClose: () => void;
  onCreated?: (id: string) => void;
};

type WizardData = {
  // Step 1: Patient
  patientName: string;
  patientPhone: string;
  // Step 2: Clinical
  clinicalCategory: string;
  suspectedCondition: string;
  urgency: string;
  clinicalNotes: string;
  referralType: string;
  // Step 3: Destination
  destinationMode: string;
  destinationOrgId: string;
  destinationOrgName: string;
  destinationCity: string;
  outstationRequired: boolean;
  accommodationRequired: boolean;
};

const INITIAL: WizardData = {
  patientName: "",
  patientPhone: "",
  clinicalCategory: "",
  suspectedCondition: "",
  urgency: "routine",
  clinicalNotes: "",
  referralType: "doctor_to_hospital",
  destinationMode: "selected_provider",
  destinationOrgId: "",
  destinationOrgName: "",
  destinationCity: "",
  outstationRequired: false,
  accommodationRequired: false,
};

const STEPS = ["Patient", "Clinical", "Destination", "Review"];

const URGENCY_OPTIONS = [
  { value: "routine",            label: "Routine",             desc: "Non-urgent, scheduled care" },
  { value: "priority",           label: "Priority",            desc: "Within 24–48 hours" },
  { value: "urgent",             label: "Urgent",              desc: "Same day attention needed" },
  { value: "emergency_transfer", label: "Emergency Transfer",  desc: "Immediate transfer required" },
];

const REFERRAL_TYPES = [
  { value: "doctor_to_hospital",  label: "Doctor → Hospital" },
  { value: "doctor_to_doctor",    label: "Doctor → Doctor" },
  { value: "procedure",           label: "Procedure / Surgery" },
  { value: "diagnostics",         label: "Diagnostics / Labs" },
  { value: "second_opinion",      label: "Second Opinion" },
];

const SPECIALTIES = [
  "Cardiology", "Orthopedics", "Neurology", "Oncology", "Gastroenterology",
  "Nephrology", "Urology", "Ophthalmology", "ENT", "Dermatology",
  "Pulmonology", "Endocrinology", "Psychiatry", "Pediatrics", "Gynecology",
  "General Surgery", "Spine", "Dental", "Fertility", "Other",
];

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            i < step
              ? "text-white"
              : i === step
              ? "text-white ring-2 ring-offset-1"
              : "bg-slate-100 text-slate-400"
          }`}
          style={i <= step ? { background: "#1B8A4A" } : {}}
          >
            {i < step ? "✓" : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`h-0.5 w-6 ${i < step ? "bg-emerald-400" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function ReferralWizard({ onClose, onCreated }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof WizardData, value: string | boolean) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function canNext() {
    if (step === 0) return data.patientName.trim().length > 0 && data.patientPhone.trim().length >= 10;
    if (step === 1) return data.clinicalCategory.trim().length > 0;
    if (step === 2) return data.destinationMode === "assisted_by_easyheals" || data.destinationCity.trim().length > 0;
    return true;
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        patientName: data.patientName,
        patientPhone: data.patientPhone,
        referralType: data.referralType,
        clinicalCategory: data.clinicalCategory,
        suspectedCondition: data.suspectedCondition || undefined,
        urgency: data.urgency,
        clinicalNotes: data.clinicalNotes || undefined,
        destinationMode: data.destinationMode,
        selectedDestinationOrgId: data.destinationOrgId || undefined,
        destinationCity: data.destinationCity || undefined,
        outstationRequired: data.outstationRequired,
        accommodationRequired: data.accommodationRequired,
      };

      const res = await fetch("/api/v1/referrals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Failed to create referral");
        return;
      }

      const { data: created } = await res.json() as { data: { id: string } };
      onCreated?.(created.id);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-800">New Referral</h2>
            <p className="text-xs text-slate-400">{STEPS[step]}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 text-xl"
          >
            ×
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 py-3 border-b border-slate-50 shrink-0">
          <StepIndicator step={step} total={STEPS.length} />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {step === 0 && (
            <>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Patient Full Name *</span>
                <input
                  type="text"
                  value={data.patientName}
                  onChange={(e) => set("patientName", e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Mobile Number *</span>
                <input
                  type="tel"
                  value={data.patientPhone}
                  onChange={(e) => set("patientPhone", e.target.value)}
                  placeholder="10-digit mobile"
                  maxLength={10}
                  className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Referral Type *</span>
                <select
                  value={data.referralType}
                  onChange={(e) => set("referralType", e.target.value)}
                  className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                >
                  {REFERRAL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-600">Clinical Category / Specialty *</span>
                <select
                  value={data.clinicalCategory}
                  onChange={(e) => set("clinicalCategory", e.target.value)}
                  className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                >
                  <option value="">Select specialty</option>
                  {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-600">Suspected Condition</span>
                <input
                  type="text"
                  value={data.suspectedCondition}
                  onChange={(e) => set("suspectedCondition", e.target.value)}
                  placeholder="e.g. Coronary Artery Disease"
                  className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </label>

              <div>
                <span className="text-xs font-medium text-slate-600 block mb-2">Urgency *</span>
                <div className="space-y-2">
                  {URGENCY_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        data.urgency === opt.value
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="urgency"
                        value={opt.value}
                        checked={data.urgency === opt.value}
                        onChange={() => set("urgency", opt.value)}
                        className="mt-0.5 accent-emerald-600"
                      />
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{opt.label}</p>
                        <p className="text-[11px] text-slate-400">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-slate-600">Clinical Notes</span>
                <textarea
                  value={data.clinicalNotes}
                  onChange={(e) => set("clinicalNotes", e.target.value)}
                  rows={3}
                  placeholder="Brief clinical summary, history, current medications..."
                  className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <span className="text-xs font-medium text-slate-600 block mb-2">Destination Mode *</span>
                <div className="space-y-2">
                  {[
                    { value: "selected_provider",    label: "I have a specific provider in mind" },
                    { value: "auto_match",            label: "Match automatically by EasyHeals" },
                    { value: "assisted_by_easyheals", label: "EasyHeals coordinator will assist" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        data.destinationMode === opt.value
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="destMode"
                        value={opt.value}
                        checked={data.destinationMode === opt.value}
                        onChange={() => set("destinationMode", opt.value)}
                        className="accent-emerald-600"
                      />
                      <p className="text-xs font-medium text-slate-700">{opt.label}</p>
                    </label>
                  ))}
                </div>
              </div>

              {data.destinationMode === "selected_provider" && (
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Hospital / Provider Name</span>
                  <input
                    type="text"
                    value={data.destinationOrgName}
                    onChange={(e) => set("destinationOrgName", e.target.value)}
                    placeholder="Name of destination hospital"
                    className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </label>
              )}

              {data.destinationMode !== "assisted_by_easyheals" && (
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Destination City *</span>
                  <input
                    type="text"
                    value={data.destinationCity}
                    onChange={(e) => set("destinationCity", e.target.value)}
                    placeholder="e.g. Mumbai"
                    className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </label>
              )}

              <div className="space-y-2">
                {[
                  { key: "outstationRequired" as const, label: "Patient requires outstation travel" },
                  { key: "accommodationRequired" as const, label: "Accommodation assistance needed" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data[key] as boolean}
                      onChange={(e) => set(key, e.target.checked)}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <span className="text-xs text-slate-600">{label}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Review your referral</h3>

              {[
                { label: "Patient", value: `${data.patientName} · ${data.patientPhone}` },
                { label: "Type", value: REFERRAL_TYPES.find(t => t.value === data.referralType)?.label ?? data.referralType },
                { label: "Specialty", value: data.clinicalCategory },
                { label: "Urgency", value: URGENCY_OPTIONS.find(u => u.value === data.urgency)?.label ?? data.urgency },
                { label: "Destination", value: data.destinationMode === "assisted_by_easyheals"
                    ? "EasyHeals coordinator will assist"
                    : [data.destinationOrgName, data.destinationCity].filter(Boolean).join(", ") || "Not specified" },
                ...(data.clinicalNotes ? [{ label: "Notes", value: data.clinicalNotes }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className="text-sm text-slate-700 mt-0.5">{value}</p>
                </div>
              ))}

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-700">
                  By submitting, you confirm that patient consent has been obtained per DPDP Act 2023.
                </p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="px-5 py-2 bg-red-50 border-t border-red-100 text-xs text-red-600 shrink-0">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-3 shrink-0">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              disabled={loading}
              className="text-sm text-slate-500 px-4 py-2 rounded-xl hover:bg-slate-100 transition"
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-slate-400 px-4 py-2 rounded-xl hover:bg-slate-100 transition"
            >
              Cancel
            </button>
          )}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="text-sm font-semibold px-5 py-2 rounded-xl text-white transition active:scale-95 disabled:opacity-40"
              style={{ background: "#1B8A4A" }}
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={loading}
              className="flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-xl text-white transition active:scale-95 disabled:opacity-50"
              style={{ background: "#1B8A4A" }}
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Submit Referral
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
