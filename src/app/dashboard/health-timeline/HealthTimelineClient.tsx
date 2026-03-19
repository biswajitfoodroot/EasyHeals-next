"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface HealthEvent {
  id: string;
  source: string;
  sourceRefId: string | null;
  eventType: "vital" | "lab_result" | "diagnosis" | "medication" | "procedure" | "device_reading";
  eventDate: string | null;
  createdAt: string | null;
  data: Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  vital: "Vital",
  lab_result: "Lab Result",
  diagnosis: "Diagnosis",
  medication: "Medication",
  procedure: "Procedure",
  device_reading: "Device Reading",
};

const EVENT_TYPE_ICONS: Record<string, string> = {
  vital: "💓",
  lab_result: "🧪",
  diagnosis: "🩺",
  medication: "💊",
  procedure: "🔬",
  device_reading: "📡",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  vital: "bg-pink-50 text-pink-700 border-pink-200",
  lab_result: "bg-purple-50 text-purple-700 border-purple-200",
  diagnosis: "bg-blue-50 text-blue-700 border-blue-200",
  medication: "bg-green-50 text-green-700 border-green-200",
  procedure: "bg-orange-50 text-orange-700 border-orange-200",
  device_reading: "bg-teal-50 text-teal-700 border-teal-200",
};

const SOURCE_LABELS: Record<string, string> = {
  document: "Uploaded Document",
  abha: "ABHA / Ayushman",
  emr_visit: "EMR Visit",
  prescription: "Prescription",
  lab_report: "Lab Report",
  device: "Wearable Device",
  self_report: "Self Reported",
};

const ALL_TYPES = Object.keys(EVENT_TYPE_LABELS);

function formatDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatEventData(data: Record<string, unknown>): string {
  const parts: string[] = [];
  if (data.name) parts.push(String(data.name));
  if (data.value !== undefined && data.value !== null) {
    parts.push(`${data.value}${data.unit ? ` ${data.unit}` : ""}`);
  }
  if (data.dosage) parts.push(String(data.dosage));
  if (data.frequency) parts.push(String(data.frequency));
  if (data.notes) parts.push(String(data.notes));
  return parts.join(" · ") || "No details";
}

function groupEventsByMonth(events: HealthEvent[]): [string, HealthEvent[]][] {
  const map = new Map<string, HealthEvent[]>();
  for (const e of events) {
    const d = e.eventDate ? new Date(e.eventDate) : null;
    const key = d
      ? d.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
      : "Unknown Date";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return [...map.entries()];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HealthTimelineClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get("type") ?? "");
  const [exporting, setExporting] = useState(false);

  const LIMIT = 50;

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    const currentOffset = reset ? 0 : offset;
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(currentOffset) });
      if (typeFilter) params.set("type", typeFilter);
      const sourceId = searchParams.get("source");
      if (sourceId) params.set("sourceId", sourceId);

      const res = await fetch(`/api/v1/patients/health-timeline?${params}`, { credentials: "include" });
      if (res.status === 401 || res.status === 403) { router.push("/login"); return; }
      if (res.status === 503) {
        // Feature flag OFF — show empty state gracefully
        setEvents([]);
        return;
      }
      if (res.ok) {
        const j = await res.json() as { data: HealthEvent[]; meta: { count: number } };
        const newEvents = j.data;
        if (reset) {
          setEvents(newEvents);
          setOffset(newEvents.length);
        } else {
          setEvents((prev) => [...prev, ...newEvents]);
          setOffset((prev) => prev + newEvents.length);
        }
        setHasMore(newEvents.length === LIMIT);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [offset, typeFilter, searchParams, router]);

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/v1/patients/health-export", { credentials: "include" });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `health-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* non-fatal */ }
    finally { setExporting(false); }
  }

  const grouped = groupEventsByMonth(events);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 text-sm">← Dashboard</Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-semibold text-slate-800">Health Timeline</span>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          {exporting ? "Exporting..." : "⬇ Export JSON"}
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Health Timeline</h1>
            <p className="text-sm text-slate-400">AI-extracted health events from your uploaded documents.</p>
          </div>
          <Link
            href="/dashboard/documents"
            className="px-4 py-2 text-sm font-semibold text-white rounded-xl"
            style={{ background: "#1B8A4A" }}
          >
            + Upload Document
          </Link>
        </div>

        {/* Type filter pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTypeFilter("")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${typeFilter === "" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
          >
            All
          </button>
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t === typeFilter ? "" : t)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${typeFilter === t ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
            >
              {EVENT_TYPE_ICONS[t]} {EVENT_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && events.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse bg-slate-200 rounded-2xl h-16" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && events.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-sm font-semibold text-slate-600">No health events yet</p>
            <p className="text-xs text-slate-400 mt-1">Upload a lab report or prescription to see your health data here.</p>
            <Link
              href="/dashboard/documents"
              className="mt-4 inline-block px-4 py-2 text-sm font-semibold text-white rounded-xl"
              style={{ background: "#1B8A4A" }}
            >
              Upload Document
            </Link>
          </div>
        )}

        {/* Timeline grouped by month */}
        {grouped.map(([month, monthEvents]) => (
          <div key={month}>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{month}</h2>
            <div className="relative pl-5">
              {/* Vertical line */}
              <div className="absolute left-1.5 top-0 bottom-0 w-px bg-slate-200" />

              <div className="space-y-3">
                {monthEvents.map((event) => (
                  <div key={event.id} className="relative">
                    {/* Dot on line */}
                    <div className="absolute -left-3.5 top-4 w-3 h-3 rounded-full border-2 border-white bg-slate-300" />

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${EVENT_TYPE_COLORS[event.eventType] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                              {EVENT_TYPE_ICONS[event.eventType]} {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
                            </span>
                            <span className="text-xs text-slate-400">{SOURCE_LABELS[event.source] ?? event.source}</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-800">
                            {(event.data.name as string) ?? EVENT_TYPE_LABELS[event.eventType]}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">{formatEventData(event.data)}</p>
                        </div>
                        <div className="text-xs text-slate-400 shrink-0">{formatDate(event.eventDate)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Load more */}
        {hasMore && !loading && (
          <button
            onClick={() => void load(false)}
            className="w-full py-3 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
          >
            Load more
          </button>
        )}

        {loading && events.length > 0 && (
          <div className="text-center text-sm text-slate-400">Loading...</div>
        )}

        {/* Privacy note */}
        <div className="bg-blue-50 rounded-2xl p-4">
          <p className="text-xs text-blue-700">
            <span className="font-semibold">Your data is encrypted.</span>{" "}
            All health events are stored with AES-256 encryption. You can export or delete your data at any time.{" "}
            <Link href="/dashboard/privacy" className="underline font-semibold">Manage privacy →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
