"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Visit {
  id: string;
  appointmentId: string | null;
  doctorId: string | null;
  hospitalId: string | null;
  diagnosis: { code?: string; label: string }[] | null;
  chiefComplaint: string | null;
  notes: string | null;
  followUpDate: string | null;
  followUpNotes: string | null;
  isTeleconsultation: boolean;
  createdAt: string | null;
}

interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  genericName?: string;
}

interface Prescription {
  id: string;
  visitId: string | null;
  doctorId: string | null;
  medicines: Medicine[] | null;
  instructions: string | null;
  validUntil: string | null;
  dispensed: boolean;
  dispensedAt: string | null;
  createdAt: string | null;
}

interface LabOrder {
  id: string;
  visitId: string | null;
  testName: string;
  labName: string | null;
  status: string;
  result: string | null;
  referenceRange: string | null;
  orderedAt: string | null;
  resultAt: string | null;
  createdAt: string | null;
}

type Tab = "visits" | "prescriptions" | "labs";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse bg-slate-200 rounded-2xl h-24" />
      ))}
    </div>
  );
}

// ── Visit Card ────────────────────────────────────────────────────────────────

function VisitCard({ visit }: { visit: Visit }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span>{visit.isTeleconsultation ? "📹" : "🏥"}</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {visit.isTeleconsultation ? "Teleconsultation" : "In-person Visit"}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-700">
            {visit.chiefComplaint ?? "Visit record"}
          </p>
          {visit.diagnosis && visit.diagnosis.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {visit.diagnosis.map((d, i) => (
                <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                  {d.code ? `${d.code}: ` : ""}{d.label}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-1">{formatDate(visit.createdAt)}</p>
        </div>
        {visit.notes && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-slate-400 hover:text-slate-600 shrink-0"
          >
            {expanded ? "▲ Less" : "▼ Notes"}
          </button>
        )}
      </div>
      {expanded && visit.notes && (
        <p className="mt-3 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 whitespace-pre-wrap">
          {visit.notes}
        </p>
      )}
      {visit.followUpDate && (
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
          Follow-up: {formatDate(visit.followUpDate)}
          {visit.followUpNotes ? ` — ${visit.followUpNotes}` : ""}
        </p>
      )}
    </div>
  );
}

// ── Prescription Card ─────────────────────────────────────────────────────────

function PrescriptionCard({ rx }: { rx: Prescription }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span>💊</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Prescription</span>
            {rx.dispensed && (
              <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full">Dispensed</span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-700">
            {rx.medicines?.length ?? 0} medicine{(rx.medicines?.length ?? 0) !== 1 ? "s" : ""}
          </p>
          {rx.validUntil && (
            <p className="text-xs text-slate-400 mt-0.5">Valid until: {formatDate(rx.validUntil)}</p>
          )}
          <p className="text-xs text-slate-400 mt-0.5">{formatDate(rx.createdAt)}</p>
        </div>
        {rx.medicines && rx.medicines.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-slate-400 hover:text-slate-600 shrink-0"
          >
            {expanded ? "▲ Hide" : "▼ Details"}
          </button>
        )}
      </div>
      {expanded && rx.medicines && (
        <div className="mt-3 space-y-2">
          {rx.medicines.map((m, i) => (
            <div key={i} className="text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              <p className="font-semibold text-slate-700">{m.name}{m.genericName ? ` (${m.genericName})` : ""}</p>
              <p className="text-slate-500">{m.dosage} · {m.frequency} · {m.duration}</p>
              {m.instructions && <p className="text-slate-400 mt-0.5">{m.instructions}</p>}
            </div>
          ))}
          {rx.instructions && (
            <p className="text-xs text-slate-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-1">
              {rx.instructions}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Lab Card ──────────────────────────────────────────────────────────────────

function LabCard({ order }: { order: LabOrder }) {
  const statusColors: Record<string, string> = {
    ordered:    "bg-amber-100 text-amber-800 border-amber-200",
    collected:  "bg-blue-100 text-blue-800 border-blue-200",
    processing: "bg-purple-100 text-purple-800 border-purple-200",
    completed:  "bg-green-100 text-green-800 border-green-200",
    cancelled:  "bg-red-100 text-red-700 border-red-200",
  };
  const cls = statusColors[order.status] ?? "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">🧪</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
              {order.status}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-700">{order.testName}</p>
          {order.labName && <p className="text-xs text-slate-500">{order.labName}</p>}
          {order.result && (
            <div className="mt-2 text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              <p className="font-semibold text-slate-600">Result: {order.result}</p>
              {order.referenceRange && (
                <p className="text-slate-400 mt-0.5">Reference: {order.referenceRange}</p>
              )}
              {order.resultAt && <p className="text-slate-400 mt-0.5">Reported: {formatDate(order.resultAt)}</p>}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-1">{formatDate(order.orderedAt ?? order.createdAt)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function RecordsClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("visits");
  const [visits, setVisits]             = useState<Visit[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [labOrders, setLabOrders]       = useState<LabOrder[]>([]);
  const [loading, setLoading]           = useState(true);
  const [emrAvailable, setEmrAvailable] = useState(true);
  const [consentNeeded, setConsentNeeded] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Check auth
      const meRes = await fetch("/api/v1/patients/me", { credentials: "include" });
      if (!meRes.ok) { router.push("/login"); return; }

      // Load all three in parallel — graceful degradation
      const [vRes, rxRes, labRes] = await Promise.allSettled([
        fetch("/api/v1/emr/visits?limit=50", { credentials: "include" }),
        fetch("/api/v1/emr/prescriptions?limit=50", { credentials: "include" }),
        fetch("/api/v1/emr/lab-orders?limit=50", { credentials: "include" }),
      ]);

      // Helper: check if response means EMR is off or consent missing
      async function handleEmrRes<T>(res: PromiseSettledResult<Response>, setter: (v: T[]) => void) {
        if (res.status === "rejected") return;
        const r = res.value;
        if (r.status === 503) { setEmrAvailable(false); return; }
        if (r.status === 403) {
          const j = await r.json().catch(() => ({})) as { error?: { code?: string } };
          if (j?.error?.code === "CONSENT_MISSING") setConsentNeeded(true);
          return;
        }
        if (r.ok) {
          const j = (await r.json()) as { data: T[] };
          setter(j.data ?? []);
        }
      }

      await handleEmrRes<Visit>(vRes, setVisits);
      await handleEmrRes<Prescription>(rxRes, setPrescriptions);
      await handleEmrRes<LabOrder>(labRes, setLabOrders);

      setLoading(false);
    }
    void load();
  }, [router]);

  const tabs: { key: Tab; label: string; icon: string; count: number }[] = [
    { key: "visits",        label: "Visits",        icon: "🩺", count: visits.length },
    { key: "prescriptions", label: "Prescriptions", icon: "💊", count: prescriptions.length },
    { key: "labs",          label: "Lab Orders",    icon: "🧪", count: labOrders.length },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-slate-800">My Health Records</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* EMR unavailable banner */}
        {!loading && !emrAvailable && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            Medical records are not yet available. Please check back after your first visit.
          </div>
        )}

        {/* Consent needed banner */}
        {!loading && consentNeeded && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
            You need to grant EMR access consent to view your medical records.
            <Link href="/dashboard/consent" className="ml-2 font-semibold underline">
              Grant access →
            </Link>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === t.key
                  ? "text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              style={activeTab === t.key ? { background: "#1B8A4A" } : {}}
            >
              <span className="hidden sm:inline">{t.icon}</span>
              {t.label}
              {t.count > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    activeTab === t.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <Skeleton />
        ) : activeTab === "visits" ? (
          visits.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <p className="text-slate-400 text-sm">No visit records found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visits.map((v) => <VisitCard key={v.id} visit={v} />)}
            </div>
          )
        ) : activeTab === "prescriptions" ? (
          prescriptions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <p className="text-slate-400 text-sm">No prescriptions found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {prescriptions.map((rx) => <PrescriptionCard key={rx.id} rx={rx} />)}
            </div>
          )
        ) : (
          labOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <p className="text-slate-400 text-sm">No lab orders found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {labOrders.map((o) => <LabCard key={o.id} order={o} />)}
            </div>
          )
        )}

        {/* Book appointment CTA */}
        <div className="pt-2">
          <Link
            href="/hospitals"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm shadow-sm transition"
            style={{ background: "#1B8A4A" }}
          >
            <span>+</span> Book New Appointment
          </Link>
        </div>
      </main>
    </div>
  );
}
