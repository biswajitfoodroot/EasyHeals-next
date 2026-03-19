"use client";

import { useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type UrgencyLevel = "emergency" | "urgent" | "routine" | "self_care";

interface TriageResult {
  urgency: UrgencyLevel;
  urgencyLabel: string;
  urgencyColor: "red" | "orange" | "yellow" | "green";
  urgencyIcon: string;
  specialists: Array<{ specialty: string; reason: string }>;
  redFlags: string[];
  selfCare: string[];
  disclaimer: string;
}

// ── Urgency UI config ─────────────────────────────────────────────────────────

const URGENCY_STYLES: Record<UrgencyLevel, { bg: string; border: string; text: string; badge: string }> = {
  emergency: {
    bg: "bg-red-50",
    border: "border-red-400",
    text: "text-red-800",
    badge: "bg-red-500 text-white",
  },
  urgent: {
    bg: "bg-orange-50",
    border: "border-orange-400",
    text: "text-orange-800",
    badge: "bg-orange-500 text-white",
  },
  routine: {
    bg: "bg-yellow-50",
    border: "border-yellow-400",
    text: "text-yellow-800",
    badge: "bg-yellow-500 text-white",
  },
  self_care: {
    bg: "bg-green-50",
    border: "border-green-400",
    text: "text-green-800",
    badge: "bg-green-500 text-white",
  },
};

// ── Symptom suggestions ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Chest pain and shortness of breath",
  "High fever for 3 days",
  "Severe headache with stiff neck",
  "Knee pain while walking",
  "Persistent cough for 2 weeks",
  "Nausea and stomach ache",
  "Mild cold and runny nose",
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function CareNavClient() {
  const [symptoms, setSymptoms] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!symptoms.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/v1/care-nav/triage", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms: symptoms.trim(),
          age: age ? Number(age) : undefined,
          gender: gender || undefined,
        }),
      });

      const j = (await res.json()) as { data?: TriageResult; error?: { message: string } };

      if (!res.ok || j.error) {
        setError(j.error?.message ?? "Triage failed. Please try again.");
        return;
      }

      setResult(j.data ?? null);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError(null);
    setSymptoms("");
  }

  const styles = result ? URGENCY_STYLES[result.urgency] : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Nav */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 text-sm">← Dashboard</Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-800">Care Navigator</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Hero */}
        <div className="text-center">
          <div className="text-5xl mb-3">🧭</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Symptom Triage</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Describe what you&apos;re feeling. Our AI will assess the urgency and suggest the right care pathway.
          </p>
        </div>

        {/* Emergency banner */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 text-center">
          <strong>Emergency?</strong> If you have chest pain, difficulty breathing, or feel faint — call{" "}
          <a href="tel:102" className="font-bold underline">102 (Ambulance)</a> or go to the nearest ER immediately.
        </div>

        {/* Form */}
        {!result && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Describe your symptoms *
              </label>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="e.g. I have been having chest pain for the last hour along with shortness of breath..."
                rows={4}
                maxLength={1000}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
              />
              <p className="text-xs text-slate-400 text-right mt-1">{symptoms.length}/1000</p>
            </div>

            {/* Suggestions */}
            <div>
              <p className="text-xs text-slate-400 mb-2">Common examples:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSymptoms(s)}
                    className="text-xs bg-slate-100 hover:bg-green-50 hover:text-green-700 text-slate-600 px-3 py-1.5 rounded-full transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Age (optional)</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 45"
                  min={1}
                  max={120}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Gender (optional)</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !symptoms.trim()}
              className="w-full py-3 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "#1B8A4A" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Analysing symptoms...
                </span>
              ) : "Get Triage Guidance"}
            </button>
          </form>
        )}

        {/* Result */}
        {result && styles && (
          <div className="space-y-4">

            {/* Urgency card */}
            <div className={`${styles.bg} border-2 ${styles.border} rounded-2xl p-6`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{result.urgencyIcon}</span>
                <div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${styles.badge}`}>
                    {result.urgency.replace("_", " ").toUpperCase()}
                  </span>
                  <p className={`text-xl font-bold mt-1 ${styles.text}`}>{result.urgencyLabel}</p>
                </div>
              </div>
              {result.urgency === "emergency" && (
                <div className="mt-3 flex gap-3">
                  <a
                    href="tel:102"
                    className="flex-1 py-2.5 text-center bg-red-600 text-white text-sm font-bold rounded-xl"
                  >
                    📞 Call 102 (Ambulance)
                  </a>
                  <Link
                    href="/hospitals"
                    className="flex-1 py-2.5 text-center bg-white border-2 border-red-400 text-red-700 text-sm font-bold rounded-xl"
                  >
                    Find ER Nearby
                  </Link>
                </div>
              )}
              {(result.urgency === "urgent" || result.urgency === "routine") && (
                <div className="mt-3">
                  <Link
                    href="/hospitals"
                    className="block py-2.5 text-center text-white text-sm font-bold rounded-xl"
                    style={{ background: "#1B8A4A" }}
                  >
                    Book Appointment Now
                  </Link>
                </div>
              )}
            </div>

            {/* Red flags */}
            {result.redFlags.length > 0 && (
              <div className="bg-white border border-orange-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-orange-800 mb-3">⚠️ Watch for these warning signs</h3>
                <ul className="space-y-1.5">
                  {result.redFlags.map((flag, i) => (
                    <li key={i} className="text-sm text-slate-700 flex gap-2">
                      <span className="text-orange-500 mt-0.5">•</span>
                      {flag}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-orange-700 mt-3 font-medium">
                  If any of these appear, seek emergency care immediately.
                </p>
              </div>
            )}

            {/* Specialists */}
            {result.specialists.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-3">👨‍⚕️ Recommended Specialists</h3>
                <div className="space-y-3">
                  {result.specialists.map((s, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: "#1B8A4A" }}
                      >
                        {s.specialty.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-800">{s.specialty}</p>
                        <p className="text-xs text-slate-500">{s.reason}</p>
                      </div>
                      <Link
                        href={`/hospitals?q=${encodeURIComponent(s.specialty)}`}
                        className="text-xs font-medium text-green-700 hover:underline flex-shrink-0"
                      >
                        Find →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Self care tips */}
            {result.selfCare.length > 0 && (
              <div className="bg-white border border-green-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-green-800 mb-3">🏠 Home Care Tips</h3>
                <ul className="space-y-1.5">
                  {result.selfCare.map((tip, i) => (
                    <li key={i} className="text-sm text-slate-700 flex gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Disclaimer */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700 text-center">
              {result.disclaimer}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleReset}
                className="py-3 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Check Again
              </button>
              <Link
                href="/dashboard/health-coach"
                className="py-3 text-center text-white rounded-xl text-sm font-semibold transition"
                style={{ background: "#1B8A4A" }}
              >
                Ask AI Coach
              </Link>
            </div>
          </div>
        )}

        {/* Info footer */}
        <div className="text-center text-xs text-slate-400 pb-6">
          Powered by Gemini AI · Not a substitute for professional medical advice
        </div>

      </div>
    </div>
  );
}
