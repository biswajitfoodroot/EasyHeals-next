"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BriefData {
  summary?: string;
  activeConditions?: string[];
  currentMedications?: string[];
  recentLabsHighlights?: string[];
  vitalsHighlights?: string[];
  reasonForVisit?: string;
  questionsForDoctor?: string[];
  redFlags?: string[];
}

interface BriefResponse {
  id: string;
  appointmentId: string | null;
  generatedAt: string | null;
  viewedAt: string | null;
  brief: BriefData;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PrevisitBriefClient({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [briefRes, setBriefRes] = useState<BriefResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Find brief by appointment ID via the appointments endpoint
        const res = await fetch(`/api/v1/appointments/${appointmentId}/brief`, { credentials: "include" });
        if (res.status === 401) { router.push("/login"); return; }
        if (res.status === 404) { setError("No pre-visit brief has been generated for this appointment yet."); return; }
        if (!res.ok) { setError("Failed to load brief."); return; }
        const j = await res.json() as { data: BriefResponse };
        setBriefRes(j.data);
      } catch {
        setError("Network error loading brief.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [appointmentId, router]);

  function Section({ title, items, icon, color }: { title: string; items: string[] | undefined; icon: string; color: string }) {
    if (!items?.length) return null;
    return (
      <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{icon}</span>
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        </div>
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className={`mt-0.5 text-xs font-bold px-1.5 py-0.5 rounded ${color}`}>{i + 1}</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard/appointments" className="text-slate-400 hover:text-slate-700 text-sm">← Appointments</Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-800">Pre-Visit Brief</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-800">Pre-Visit Brief</h1>
          <p className="text-sm text-slate-400 mt-1">AI-generated summary of your health to prepare for your appointment.</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-slate-200 rounded-2xl h-24" />
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm font-semibold text-slate-600">{error}</p>
            <p className="text-xs text-slate-400 mt-1">Briefs are generated 24 hours before your appointment.</p>
            <Link
              href="/dashboard/documents"
              className="mt-4 inline-block px-4 py-2 text-sm font-semibold text-white rounded-xl"
              style={{ background: "#1B8A4A" }}
            >
              Upload Health Documents
            </Link>
          </div>
        )}

        {/* Brief content */}
        {briefRes && !loading && (
          <>
            {/* Summary */}
            {briefRes.brief.summary && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📊</span>
                  <h2 className="text-sm font-bold text-slate-800">Health Summary</h2>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{briefRes.brief.summary}</p>
              </div>
            )}

            {/* Red flags — shown prominently if present */}
            {briefRes.brief.redFlags && briefRes.brief.redFlags.length > 0 && (
              <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">⚠️</span>
                  <h2 className="text-sm font-bold text-red-800">Important — Mention to Your Doctor</h2>
                </div>
                <ul className="space-y-1.5">
                  {briefRes.brief.redFlags.map((flag, i) => (
                    <li key={i} className="text-sm text-red-700">• {flag}</li>
                  ))}
                </ul>
              </div>
            )}

            <Section title="Reason for Visit" items={briefRes.brief.reasonForVisit ? [briefRes.brief.reasonForVisit] : []} icon="🩺" color="bg-blue-100 text-blue-700" />
            <Section title="Active Conditions" items={briefRes.brief.activeConditions} icon="📋" color="bg-blue-100 text-blue-700" />
            <Section title="Current Medications" items={briefRes.brief.currentMedications} icon="💊" color="bg-green-100 text-green-700" />
            <Section title="Recent Lab Highlights" items={briefRes.brief.recentLabsHighlights} icon="🧪" color="bg-purple-100 text-purple-700" />
            <Section title="Vitals" items={briefRes.brief.vitalsHighlights} icon="💓" color="bg-pink-100 text-pink-700" />
            <Section title="Questions to Ask Your Doctor" items={briefRes.brief.questionsForDoctor} icon="❓" color="bg-yellow-100 text-yellow-700" />

            {/* Footer */}
            <div className="bg-blue-50 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-lg">ℹ️</span>
              <div>
                <p className="text-xs text-blue-700">
                  <span className="font-semibold">This is an AI-generated summary</span> based on your uploaded health documents.
                  Always share your complete history with your doctor. Generated {briefRes.generatedAt ? new Date(briefRes.generatedAt).toLocaleDateString("en-IN") : "recently"}.
                </p>
                <Link href="/dashboard/health-coach" className="text-xs text-blue-700 underline font-semibold mt-1 block">
                  Ask the AI Health Coach questions before your visit →
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
