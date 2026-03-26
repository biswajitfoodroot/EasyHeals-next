"use client";

import { useState, FormEvent } from "react";

type Prefs = {
  acceptsIncomingReferrals: boolean;
  defaultResponseSlaMins: number;
  referralSpecialties: string[];
  requiresPreapproval: boolean;
  acceptedReferralTypes: string[];
} | null;

type Props = {
  entityId: string;
  entityType: string;
  prefs: Prefs;
};

const SPECIALTIES = [
  "Cardiology", "Orthopedics", "Neurology", "Oncology", "Gastroenterology",
  "Nephrology", "Pulmonology", "Endocrinology", "Ophthalmology", "ENT",
  "Dermatology", "Urology", "Gynecology", "Pediatrics", "Psychiatry",
  "General Surgery", "Dental", "General Medicine",
];

const REFERRAL_TYPES = [
  { key: "doctor_to_doctor", label: "Doctor → Doctor" },
  { key: "doctor_to_hospital", label: "Doctor → Hospital" },
  { key: "procedure", label: "Procedure / Surgery" },
  { key: "diagnostics", label: "Diagnostics / Lab" },
  { key: "second_opinion", label: "Second Opinion" },
];

export default function ReferralSettingsClient({ entityId, entityType, prefs: initial }: Props) {
  const defaults = initial ?? {
    acceptsIncomingReferrals: true,
    defaultResponseSlaMins: 60,
    referralSpecialties: [],
    requiresPreapproval: false,
    acceptedReferralTypes: ["doctor_to_hospital", "procedure"],
  };

  const [form, setForm] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function toggleSpecialty(s: string) {
    setForm(p => ({
      ...p,
      referralSpecialties: p.referralSpecialties.includes(s)
        ? p.referralSpecialties.filter(x => x !== s)
        : [...p.referralSpecialties, s],
    }));
  }

  function toggleType(t: string) {
    setForm(p => ({
      ...p,
      acceptedReferralTypes: p.acceptedReferralTypes.includes(t)
        ? p.acceptedReferralTypes.filter(x => x !== t)
        : [...p.acceptedReferralTypes, t],
    }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/v1/portal/referral-settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, entityId, entityType }),
      });
      const j = await res.json() as { error?: string };
      if (!res.ok) { setMsg({ type: "err", text: j.error ?? "Failed" }); return; }
      setMsg({ type: "ok", text: "Referral settings saved." });
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Accept toggle */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input type="checkbox" className="sr-only"
              checked={form.acceptsIncomingReferrals}
              onChange={e => setForm(p => ({ ...p, acceptsIncomingReferrals: e.target.checked }))} />
            <div className={`w-11 h-6 rounded-full transition-colors ${form.acceptsIncomingReferrals ? "bg-green-500" : "bg-slate-300"}`} />
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.acceptsIncomingReferrals ? "translate-x-5" : "translate-x-0"}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Accept Incoming Referrals</p>
            <p className="text-xs text-slate-400">Allow other EasyHeals network providers to refer patients to you</p>
          </div>
        </label>
      </div>

      {form.acceptsIncomingReferrals && (
        <>
          {/* Response SLA */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Response Time SLA</label>
            <p className="text-xs text-slate-400">How quickly you commit to responding to incoming referrals</p>
            <select
              value={form.defaultResponseSlaMins}
              onChange={e => setForm(p => ({ ...p, defaultResponseSlaMins: Number(e.target.value) }))}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={240}>4 hours</option>
              <option value={480}>8 hours</option>
              <option value={1440}>24 hours</option>
            </select>
          </div>

          {/* Referral types */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Accepted Referral Types</p>
            <div className="flex flex-wrap gap-2">
              {REFERRAL_TYPES.map(t => (
                <button key={t.key} type="button" onClick={() => toggleType(t.key)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                    form.acceptedReferralTypes.includes(t.key)
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-green-400"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Specialties */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Specialties You Accept</p>
            <p className="text-xs text-slate-400">Leave empty to accept all specialties</p>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map(s => (
                <button key={s} type="button" onClick={() => toggleSpecialty(s)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                    form.referralSpecialties.includes(s)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Pre-approval */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input type="checkbox" className="sr-only"
                  checked={form.requiresPreapproval}
                  onChange={e => setForm(p => ({ ...p, requiresPreapproval: e.target.checked }))} />
                <div className={`w-11 h-6 rounded-full transition-colors ${form.requiresPreapproval ? "bg-amber-500" : "bg-slate-300"}`} />
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.requiresPreapproval ? "translate-x-5" : "translate-x-0"}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Require Pre-approval</p>
                <p className="text-xs text-slate-400">Referrers must get your confirmation before sending a patient</p>
              </div>
            </label>
          </div>
        </>
      )}

      {msg && (
        <p className={`text-xs px-3 py-2 rounded-lg border ${msg.type === "ok" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
          {msg.text}
        </p>
      )}

      <button type="submit" disabled={saving}
        className="px-5 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition"
        style={{ background: "#1B8A4A" }}>
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}
