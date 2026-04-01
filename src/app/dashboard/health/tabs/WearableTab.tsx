"use client";

/**
 * WearableTab — P6 Wearable Integration (Phase A: file import)
 *
 * - Import button → JSON/file picker → POST /api/v1/patients/wearable-import
 * - Sync status card: last sync, total readings
 * - 7-day sparkline for steps, heart rate, glucose
 * - "Pair Device" placeholder for Phase B (native mobile SDK)
 *
 * Flag: wearable_sync
 */

import { useState, useEffect, useRef } from "react";

interface TypeSummary {
  latest: number;
  unit?: string;
  sparkline: number[];
  totalReadings: number;
}

interface WearableSummary {
  summary: Record<string, TypeSummary>;
  lastSyncAt: string | null;
  totalReadings: number;
  periodDays: number;
}

const TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  steps:          { label: "Steps",       icon: "🚶", color: "#3b82f6" },
  heart_rate:     { label: "Heart Rate",  icon: "❤️", color: "#ef4444" },
  blood_glucose:  { label: "Glucose",     icon: "🩸", color: "#f59e0b" },
  weight:         { label: "Weight",      icon: "⚖️", color: "#8b5cf6" },
  sleep:          { label: "Sleep",       icon: "😴", color: "#0f766e" },
  blood_pressure: { label: "BP",          icon: "💓", color: "#ec4899" },
  spo2:           { label: "SpO2",        icon: "🫁", color: "#06b6d4" },
};

// ── Inline SVG sparkline ────────────────────────────────────────────────────────

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div style={{ height: 36 }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 80, H = 36, PAD = 2;
  const pts = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return `${x},${y}`;
  });
  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function WearableTab() {
  const [summary, setSummary] = useState<WearableSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; message: string } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetch("/api/v1/patients/wearable-summary", { credentials: "include" })
      .then((r) => r.ok ? r.json() as Promise<WearableSummary> : null)
      .then((data) => setSummary(data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    setImportError(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text) as unknown;

      const res = await fetch("/api/v1/patients/wearable-import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });

      const data = await res.json() as { imported: number; message: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImportResult(data);

      // Refresh summary
      const sumRes = await fetch("/api/v1/patients/wearable-summary", { credentials: "include" });
      if (sumRes.ok) setSummary(await sumRes.json() as WearableSummary);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "0 16px" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 80, background: "#e2e8f0", borderRadius: 12, marginBottom: 12, animation: "pulse 1.5s infinite" }} />
        ))}
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      </div>
    );
  }

  const typeEntries = Object.entries(summary?.summary ?? {});

  return (
    <div style={{ padding: "0 16px" }}>

      {/* Import card */}
      <div style={{
        background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
        borderRadius: 16,
        padding: "18px 20px",
        marginBottom: 16,
        color: "#fff",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 28 }}>⌚</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Connect Wearable Data</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Import from Google Health Connect or Apple Health
            </div>
          </div>
        </div>

        {summary?.lastSyncAt && (
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
            Last sync: {new Date(summary.lastSyncAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            {" · "}{summary.totalReadings} total readings
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".json,.xml"
          style={{ display: "none" }}
          onChange={(e) => void handleFileChange(e)}
        />
        <button
          type="button"
          disabled={importing}
          onClick={() => fileRef.current?.click()}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "1.5px solid rgba(255,255,255,0.5)",
            borderRadius: 10,
            padding: "9px 18px",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: importing ? "wait" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {importing ? "Importing…" : "📂 Import JSON Export"}
        </button>

        {/* Result / Error */}
        {importResult && (
          <div style={{ marginTop: 10, fontSize: 13, background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px" }}>
            ✅ {importResult.message}
          </div>
        )}
        {importError && (
          <div style={{ marginTop: 10, fontSize: 13, background: "rgba(239,68,68,0.25)", borderRadius: 8, padding: "8px 12px" }}>
            ❌ {importError}
          </div>
        )}
      </div>

      {/* Reading cards */}
      {typeEntries.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {typeEntries.map(([type, data]) => {
            const meta = TYPE_LABELS[type] ?? { label: type, icon: "📊", color: "#64748b" };
            return (
              <div
                key={type}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: "14px 14px 10px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>{meta.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>{meta.label}</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>
                  {data.latest.toLocaleString()}
                  {data.unit && <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 3 }}>{data.unit}</span>}
                </div>
                <Sparkline values={data.sparkline} color={meta.color} />
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                  {data.totalReadings} readings · 7-day trend
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "32px 20px", color: "#94a3b8" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 14 }}>No device data yet. Import your wearable export above.</div>
        </div>
      )}

      {/* Phase B placeholder */}
      <div style={{
        background: "#f8fafc",
        border: "1.5px dashed #cbd5e1",
        borderRadius: 14,
        padding: "16px 18px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <span style={{ fontSize: 28 }}>📱</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#334155", marginBottom: 2 }}>Pair Device (Coming Soon)</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Live sync via Google Health Connect &amp; Apple HealthKit available in the EasyHeals mobile app.
          </div>
        </div>
      </div>
    </div>
  );
}
