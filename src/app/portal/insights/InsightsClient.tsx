"use client";

/**
 * InsightsClient — Provider self-analytics dashboard
 *
 * Metrics row: Profile Views | Booking Rate | Avg Rating | Completion Rate
 * 7-day sparkline: views and bookings over time (inline SVG)
 * Range picker: last 7d / 30d / 90d
 * All data from /api/portal/insights (flag: provider_insights)
 */

import { useState, useEffect } from "react";
import Link from "next/link";

interface SparklinePoint {
  day: string;
  views: number;
  bookings: number;
}

interface InsightsData {
  entity: { id: string; type: string; name: string; rating: number; reviewCount: number };
  metrics: {
    profileViews: number;
    bookingStarts: number;
    bookingsCompleted: number;
    conversionRate: number;
    completionRate: number;
  };
  sparkline: SparklinePoint[];
  range: string;
  days: number;
}

// ── Inline sparkline ─────────────────────────────────────────────────────────

function Spark({ points, key: dataKey, color }: { points: SparklinePoint[]; key: never; dataKey: "views" | "bookings"; color: string }) {
  const values = points.map((p) => p[dataKey]);
  if (values.length < 2) return <div style={{ height: 40 }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 120, H = 40, PAD = 3;
  const pts = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return `${x},${y}`;
  });
  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, suffix, color }: { label: string; value: number; suffix?: string; color: string }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 14,
      padding: "16px 18px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
      flex: 1,
      minWidth: 130,
    }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>
        {value.toLocaleString()}{suffix && <span style={{ fontSize: 14, fontWeight: 500, color: "#94a3b8" }}>{suffix}</span>}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function InsightsClient() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState("30d");

  useEffect(() => {
    setLoading(true);
    void fetch(`/api/portal/insights?range=${range}`, { credentials: "include" })
      .then(async (r) => {
        if (r.status === 423) { setError("Provider Insights is coming soon. Contact support to enable early access."); return; }
        if (r.status === 400) { setError("Your account is not linked to a hospital or doctor profile."); return; }
        if (!r.ok) { setError("Failed to load insights."); return; }
        setData(await r.json() as InsightsData);
      })
      .catch(() => setError("Network error. Please try again."))
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <div style={{ minHeight: "100dvh", background: "#f8fafc", paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 960, margin: "0 auto" }}>
          <Link href="/portal" style={{ color: "#64748b", fontSize: 13, textDecoration: "none" }}>← Portal</Link>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>My Insights</h1>
            {data && <div style={{ fontSize: 12, color: "#64748b" }}>{data.entity.name}</div>}
          </div>

          {/* Range picker */}
          <div style={{ display: "flex", gap: 4 }}>
            {["7d", "30d", "90d"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: "1.5px solid",
                  borderColor: range === r ? "#0f766e" : "#e2e8f0",
                  background: range === r ? "#f0fdfa" : "#fff",
                  color: range === r ? "#0f766e" : "#64748b",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 16px" }}>
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 80, background: "#e2e8f0", borderRadius: 14, animation: "pulse 1.5s infinite" }} />
            ))}
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
          </div>
        )}

        {error && !loading && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "16px 20px", color: "#b91c1c", fontSize: 14 }}>
            {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* Metrics row */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
              <MetricCard label="Profile Views" value={data.metrics.profileViews} color="#3b82f6" />
              <MetricCard label="Bookings" value={data.metrics.bookingsCompleted} color="#10b981" />
              <MetricCard label="Conversion" value={data.metrics.conversionRate} suffix="%" color="#6366f1" />
              {data.entity.type === "hospital" && (
                <MetricCard label="Avg Rating" value={data.entity.rating} suffix="★" color="#f59e0b" />
              )}
              <MetricCard label="Completion" value={data.metrics.completionRate} suffix="%" color="#0f766e" />
            </div>

            {/* Sparklines */}
            {data.sparkline.length > 1 && (
              <div style={{ background: "#fff", borderRadius: 16, padding: "18px 20px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 16 }}>7-Day Trend</div>
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600, marginBottom: 6 }}>Profile Views</div>
                    {/* @ts-expect-error key prop handled by React */}
                    <Spark points={data.sparkline} dataKey="views" color="#3b82f6" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#10b981", fontWeight: 600, marginBottom: 6 }}>Bookings</div>
                    {/* @ts-expect-error key prop handled by React */}
                    <Spark points={data.sparkline} dataKey="bookings" color="#10b981" />
                  </div>
                </div>
                {/* Day labels */}
                <div style={{ display: "flex", gap: 0, marginTop: 6 }}>
                  {data.sparkline.map((p) => (
                    <div key={p.day} style={{ flex: 1, fontSize: 9, color: "#94a3b8", textAlign: "center" }}>
                      {new Date(p.day).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info note */}
            <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
              Data shows last {data.days} days · Analytics are anonymized — no patient PII shown
            </div>
          </>
        )}
      </div>
    </div>
  );
}
