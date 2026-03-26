"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface VitalRow {
  id: string;
  recordedDate: string; // YYYY-MM-DD
  weight: string | null;
  bp: string | null;
  glucose: string | null;
  pulse: string | null;
  notes: string | null;
  createdAt: string | null;
}

// ── Parsing helpers ────────────────────────────────────────────────────────────

function parseNum(v: string | null): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(/[^\d.]/g, ""));
  return isNaN(n) ? null : n;
}

/** Parse systolic from "120/80" or just "120" */
function parseSystolic(bp: string | null): number | null {
  if (!bp) return null;
  const [sys] = bp.split("/");
  return parseNum(sys ?? null);
}

function parseDiastolic(bp: string | null): number | null {
  if (!bp) return null;
  const parts = bp.split("/");
  return parts[1] ? parseNum(parts[1]) : null;
}

// ── Sparkline (inline SVG, no dependencies) ───────────────────────────────────

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const pts = values.slice(-12); // last 12 readings
  if (pts.length < 2) return <div className="h-8" />;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const W = 88;
  const H = 32;
  const points = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * W;
      const y = H - 4 - ((v - min) / range) * (H - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Last point dot */}
      {(() => {
        const last = pts[pts.length - 1]!;
        const x = W;
        const y = H - 4 - ((last - min) / range) * (H - 8);
        return <circle cx={x} cy={y} r="3" fill={color} />;
      })()}
    </svg>
  );
}

// ── Trend arrow ────────────────────────────────────────────────────────────────

function Trend({ values, unit, invert = false }: { values: number[]; unit: string; invert?: boolean }) {
  if (values.length < 2) return null;
  const delta = values[values.length - 1]! - values[values.length - 2]!;
  if (Math.abs(delta) < 0.5) {
    return <span className="text-xs text-slate-400">→ stable</span>;
  }
  const up = delta > 0;
  const good = invert ? !up : up; // invert=true means lower is better (e.g., glucose, BP)
  return (
    <span className={`text-xs font-medium ${good ? "text-green-600" : "text-red-500"}`}>
      {up ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}{unit}
    </span>
  );
}

// ── Vital card ─────────────────────────────────────────────────────────────────

interface VitalCardProps {
  icon: string;
  title: string;
  latestLabel: string;
  unit: string;
  sparkValues: number[];
  sparkColor: string;
  trend: React.ReactNode;
  count: number;
  normalRange?: string;
}

function VitalCard({ icon, title, latestLabel, unit, sparkValues, sparkColor, trend, count, normalRange }: VitalCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="text-sm font-semibold text-slate-700">{title}</span>
        </div>
        {normalRange && (
          <span className="text-xs text-slate-400">Normal: {normalRange}</span>
        )}
      </div>
      {sparkValues.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No readings yet</p>
      ) : (
        <>
          <div className="flex items-end justify-between">
            <div>
              <span className="text-2xl font-bold text-slate-900">{latestLabel}</span>
              <span className="text-xs text-slate-400 ml-1">{unit}</span>
              <div className="mt-0.5">{trend}</div>
            </div>
            <Sparkline values={sparkValues} color={sparkColor} />
          </div>
          <p className="text-xs text-slate-400">{count} reading{count !== 1 ? "s" : ""} recorded</p>
        </>
      )}
    </div>
  );
}

// ── Add Reading Modal ──────────────────────────────────────────────────────────

interface AddModalProps {
  onClose: () => void;
  onSaved: () => void;
}

function AddModal({ onClose, onSaved }: AddModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState("");
  const [bp, setBp] = useState("");
  const [glucose, setGlucose] = useState("");
  const [pulse, setPulse] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!date) { setError("Date is required"); return; }
    if (!weight && !bp && !glucose && !pulse) {
      setError("Enter at least one vital reading");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/v1/patients/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordedDate: date,
          weight: weight || undefined,
          bp: bp || undefined,
          glucose: glucose || undefined,
          pulse: pulse || undefined,
          notes: notes || undefined,
        }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(json.error ?? "Failed to save"); return; }
      onSaved();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Add Vitals Reading</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Date *</label>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Blood Pressure</label>
            <input
              type="text"
              placeholder="e.g. 120/80"
              value={bp}
              onChange={(e) => setBp(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Pulse (bpm)</label>
            <input
              type="number"
              placeholder="e.g. 72"
              value={pulse}
              onChange={(e) => setPulse(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              placeholder="e.g. 72.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Blood Sugar (mg/dL)</label>
            <input
              type="number"
              placeholder="e.g. 95"
              value={glucose}
              onChange={(e) => setGlucose(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Notes (optional)</label>
          <input
            type="text"
            placeholder="e.g. after exercise, fasting"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
          style={{ background: "#1B8A4A" }}
        >
          {busy ? "Saving…" : "Save Reading"}
        </button>
      </div>
    </div>
  );
}

// ── Format helpers ─────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${day} ${months[parseInt(m ?? "1") - 1]} ${y}`;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function VitalsClient() {
  const [rows, setRows] = useState<VitalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/patients/vitals");
      const json = await res.json() as { data?: VitalRow[]; error?: string };
      if (!res.ok) { setError(json.error ?? "Failed to load vitals"); return; }
      setRows(json.data ?? []);
    } catch {
      setError("Network error loading vitals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Sorted oldest-first for sparkline (rows come newest-first from API)
  const asc = [...rows].reverse();

  const bpValues    = asc.map((r) => parseSystolic(r.bp)).filter((v): v is number => v !== null);
  const weightValues = asc.map((r) => parseNum(r.weight)).filter((v): v is number => v !== null);
  const glucoseValues = asc.map((r) => parseNum(r.glucose)).filter((v): v is number => v !== null);
  const pulseValues  = asc.map((r) => parseNum(r.pulse)).filter((v): v is number => v !== null);

  const latestBp      = rows.find((r) => r.bp)?.bp ?? null;
  const latestWeight  = rows.find((r) => r.weight);
  const latestGlucose = rows.find((r) => r.glucose);
  const latestPulse   = rows.find((r) => r.pulse);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Nav */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 text-sm">← Dashboard</Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-semibold text-slate-800">Vitals Analytics</span>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="text-sm font-semibold text-white px-4 py-2 rounded-xl"
          style={{ background: "#1B8A4A" }}
        >
          + Add Reading
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {loading && (
          <div className="text-center py-16 text-slate-400 text-sm">Loading vitals…</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <div className="text-5xl">📊</div>
            <p className="text-slate-700 font-semibold">No vitals recorded yet</p>
            <p className="text-sm text-slate-400">Track your blood pressure, weight, blood sugar, and pulse over time.</p>
            <button
              onClick={() => setAddOpen(true)}
              className="mt-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl"
              style={{ background: "#1B8A4A" }}
            >
              Record your first reading
            </button>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            {/* Vital cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <VitalCard
                icon="🩺"
                title="Blood Pressure"
                latestLabel={latestBp ?? "—"}
                unit="mmHg"
                sparkValues={bpValues}
                sparkColor="#ef4444"
                trend={<Trend values={bpValues} unit=" mmHg" invert={true} />}
                count={rows.filter((r) => r.bp).length}
                normalRange="90–120 / 60–80"
              />
              <VitalCard
                icon="⚖️"
                title="Weight"
                latestLabel={latestWeight ? (latestWeight.weight ?? "—") : "—"}
                unit="kg"
                sparkValues={weightValues}
                sparkColor="#3b82f6"
                trend={<Trend values={weightValues} unit=" kg" invert={false} />}
                count={rows.filter((r) => r.weight).length}
              />
              <VitalCard
                icon="🍬"
                title="Blood Sugar"
                latestLabel={latestGlucose ? (latestGlucose.glucose ?? "—") : "—"}
                unit="mg/dL"
                sparkValues={glucoseValues}
                sparkColor="#f59e0b"
                trend={<Trend values={glucoseValues} unit=" mg/dL" invert={true} />}
                count={rows.filter((r) => r.glucose).length}
                normalRange="70–100 (fasting)"
              />
              <VitalCard
                icon="💓"
                title="Pulse"
                latestLabel={latestPulse ? (latestPulse.pulse ?? "—") : "—"}
                unit="bpm"
                sparkValues={pulseValues}
                sparkColor="#8b5cf6"
                trend={<Trend values={pulseValues} unit=" bpm" invert={false} />}
                count={rows.filter((r) => r.pulse).length}
                normalRange="60–100"
              />
            </div>

            {/* Recent readings table */}
            <div>
              <h2 className="text-sm font-bold text-slate-700 mb-3">Recent Readings</h2>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-4 py-3 font-semibold text-slate-500">Date</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-500">BP (mmHg)</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-500">Weight (kg)</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-500">Sugar (mg/dL)</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-500">Pulse (bpm)</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-500">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 30).map((row, i) => (
                        <tr key={row.id} className={`border-b border-slate-50 ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}>
                          <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap font-medium">{fmtDate(row.recordedDate)}</td>
                          <td className="px-4 py-2.5 text-slate-600">{row.bp ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-2.5 text-slate-600">{row.weight ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-2.5 text-slate-600">{row.glucose ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-2.5 text-slate-600">{row.pulse ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-2.5 text-slate-400 max-w-[120px] truncate">{row.notes ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {addOpen && (
        <AddModal
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); void load(); }}
        />
      )}
    </div>
  );
}
