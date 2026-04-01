"use client";

/**
 * TimelineTab — Health Memory Timeline
 *
 * Lists all health events grouped by month, color-coded by type.
 * Mobile: vertical card list with sticky month headers.
 * Abnormal values flagged with amber indicator.
 * FAB (bottom-right) opens AddEventSheet.
 */

import { useState, useEffect } from "react";
import { BottomSheet } from "@/components/BottomSheet";

interface HealthEvent {
  id: string;
  eventType: string;
  eventDate: string | null;
  source: string;
  data: {
    name?: string;
    value?: unknown;
    value2?: unknown;
    unit?: string;
    status?: string;
    dosage?: string;
    frequency?: string;
    notes?: string;
  };
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  lab_result:     { label: "Lab",         color: "#0369a1", bg: "#e0f2fe", emoji: "🧪" },
  vital:          { label: "Vital",       color: "#047857", bg: "#d1fae5", emoji: "💗" },
  diagnosis:      { label: "Condition",   color: "#b45309", bg: "#fef3c7", emoji: "🏥" },
  medication:     { label: "Medication",  color: "#7c3aed", bg: "#ede9fe", emoji: "💊" },
  procedure:      { label: "Procedure",   color: "#be123c", bg: "#ffe4e6", emoji: "⚕️" },
  device_reading: { label: "Device",      color: "#1d4ed8", bg: "#dbeafe", emoji: "📱" },
};

function EventCard({ event }: { event: HealthEvent }) {
  const cfg = TYPE_CONFIG[event.eventType] ?? { label: "Other", color: "#475569", bg: "#f1f5f9", emoji: "📌" };
  const isAbnormal = event.data.status === "high" || event.data.status === "low" || event.data.status === "abnormal";
  const dateStr = event.eventDate ? new Date(event.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";

  let valueStr = "";
  if (event.data.value !== undefined && event.data.value !== null) {
    valueStr = `${event.data.value}${event.data.unit ? " " + event.data.unit : ""}`;
    if (event.data.value2 !== undefined && event.data.value2 !== null) {
      valueStr += `/${event.data.value2}`;
    }
  } else if (event.data.dosage) {
    valueStr = `${event.data.dosage}${event.data.frequency ? " · " + event.data.frequency : ""}`;
  }

  return (
    <div style={{
      background: "#fff",
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 8,
      border: isAbnormal ? "1.5px solid #fbbf24" : "1px solid #f1f5f9",
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
    }}>
      {/* Type badge */}
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: cfg.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
        flexShrink: 0,
      }}>
        {cfg.emoji}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {event.data.name ?? cfg.label}
          </span>
          {isAbnormal && (
            <span style={{ fontSize: 11, background: "#fef3c7", color: "#b45309", padding: "1px 6px", borderRadius: 4, flexShrink: 0, fontWeight: 600 }}>
              ⚠ Abnormal
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {valueStr && (
            <span style={{ fontSize: 13, color: isAbnormal ? "#b45309" : "#374151", fontWeight: 500 }}>
              {valueStr}
            </span>
          )}
          {dateStr && (
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{dateStr}</span>
          )}
          <span style={{ fontSize: 11, color: "#cbd5e1", background: "#f8fafc", padding: "1px 6px", borderRadius: 4 }}>
            {cfg.label}
          </span>
        </div>
        {event.data.notes && (
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{event.data.notes}</div>
        )}
      </div>
    </div>
  );
}

export function TimelineTab() {
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/v1/patients/health-timeline", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { data?: HealthEvent[]; error?: string }) => {
        if (d.data) setEvents(d.data);
        else setError(d.error ?? "Failed to load timeline");
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  const FILTERS = [
    { key: "all",       label: "All" },
    { key: "lab_result", label: "Labs" },
    { key: "vital",     label: "Vitals" },
    { key: "diagnosis", label: "Conditions" },
    { key: "medication", label: "Medications" },
  ];

  const filtered = filter === "all" ? events : events.filter((e) => e.eventType === filter);

  // Group by month
  const byMonth: Record<string, HealthEvent[]> = {};
  for (const evt of filtered) {
    const monthKey = evt.eventDate
      ? new Date(evt.eventDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
      : "Unknown Date";
    if (!byMonth[monthKey]) byMonth[monthKey] = [];
    byMonth[monthKey].push(evt);
  }

  return (
    <div style={{ padding: "0 16px", position: "relative" }}>
      {/* Filter chips */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 2, scrollbarWidth: "none" }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              flexShrink: 0,
              padding: "5px 12px",
              borderRadius: 16,
              border: "1px solid",
              borderColor: filter === f.key ? "#0f766e" : "#e2e8f0",
              background: filter === f.key ? "#f0fdf4" : "#fff",
              color: filter === f.key ? "#0f766e" : "#475569",
              fontSize: 12,
              fontWeight: filter === f.key ? 600 : 400,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading your health timeline...</div>
      )}

      {error && (
        <div style={{ padding: 16, background: "#fef2f2", borderRadius: 10, color: "#ef4444", fontSize: 14 }}>
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>No health events yet</div>
          <div style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>
            Upload a lab report or add an event manually to start building your health timeline
          </div>
          <button
            onClick={() => setShowAddSheet(true)}
            style={{
              padding: "12px 24px",
              background: "#0f766e",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Add Event
          </button>
        </div>
      )}

      {Object.entries(byMonth).map(([month, monthEvents]) => (
        <div key={month}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 16 }}>
            {month}
          </div>
          {monthEvents.map((evt) => <EventCard key={evt.id} event={evt} />)}
        </div>
      ))}

      {/* FAB — Add event */}
      {!loading && (
        <button
          onClick={() => setShowAddSheet(true)}
          aria-label="Add health event"
          style={{
            position: "fixed",
            bottom: 88,
            right: 20,
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "#0f766e",
            color: "#fff",
            border: "none",
            fontSize: 24,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(15,118,110,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          +
        </button>
      )}

      {/* Add Event Sheet */}
      <BottomSheet open={showAddSheet} onClose={() => setShowAddSheet(false)} title="Add Health Event">
        <AddEventForm onSuccess={() => { setShowAddSheet(false); window.location.reload(); }} />
      </BottomSheet>
    </div>
  );
}

function AddEventForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ eventType: "vital", name: "", value: "", unit: "", notes: "", eventDate: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Event name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/patients/health-timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          eventType: form.eventType,
          eventDate: form.eventDate || new Date().toISOString().split("T")[0],
          data: { name: form.name, value: form.value, unit: form.unit, notes: form.notes },
          source: "self_report",
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to save event");
        return;
      }
      onSuccess();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    border: "1.5px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 15,
    outline: "none",
    color: "#0f172a",
    background: "#fff",
    boxSizing: "border-box",
    marginBottom: 12,
  };

  return (
    <form onSubmit={submit} style={{ padding: 20 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Type</label>
      <select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })} style={{ ...inputStyle }}>
        <option value="vital">Vital Sign (BP, pulse, weight...)</option>
        <option value="lab_result">Lab Result</option>
        <option value="diagnosis">Diagnosis / Condition</option>
        <option value="medication">Medication</option>
        <option value="procedure">Procedure / Surgery</option>
      </select>

      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Name *</label>
      <input
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder='e.g. "Blood Pressure" or "Metformin"'
        style={inputStyle}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Value</label>
          <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="120/80" style={{ ...inputStyle, marginBottom: 0 }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Unit</label>
          <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="mmHg / mg/dL" style={{ ...inputStyle, marginBottom: 0 }} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Date</label>
        <input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} style={inputStyle} />
      </div>

      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Notes (optional)</label>
      <textarea
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
        placeholder="Any additional context..."
        rows={2}
        style={{ ...inputStyle, resize: "vertical" }}
      />

      {error && (
        <div style={{ padding: "8px 12px", background: "#fef2f2", borderRadius: 8, color: "#ef4444", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{
          width: "100%",
          padding: "14px",
          background: saving ? "#94a3b8" : "#0f766e",
          color: "#fff",
          border: "none",
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving..." : "Save Event"}
      </button>
    </form>
  );
}
