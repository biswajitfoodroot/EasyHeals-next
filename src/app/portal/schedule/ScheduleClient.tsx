"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ScheduleConfig {
  startHour: number;
  endHour: number;
  slotDurationMinutes: number;
  daysOfWeek: number[];
  capacityPerSlot: number;
  breakStart?: number;
  breakEnd?: number;
}

interface Slot {
  id: string;
  startsAt: string;
  endsAt: string;
  isBooked: boolean;
}

interface Props {
  userRole: string;
  entityId?: string;
  userFullName: string;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOT_DURATIONS = [15, 20, 30, 45, 60];

function formatTime(h: number) {
  const ampm = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:00 ${ampm}`;
}

function formatSlotTime(dt: string) {
  return new Date(dt).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ScheduleClient({ userRole, entityId, userFullName }: Props) {
  const router = useRouter();
  const [config, setConfig] = useState<ScheduleConfig>({
    startHour: 9, endHour: 17, slotDurationMinutes: 30,
    daysOfWeek: [1, 2, 3, 4, 5], capacityPerSlot: 1,
  });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityId) params.set("entityId", entityId);
      const res = await fetch(`/api/v1/provider/schedule?${params}`, { credentials: "include" });
      if (res.status === 401 || res.status === 403) { router.push("/portal/login"); return; }
      if (res.ok) {
        const j = (await res.json()) as { data: { config: ScheduleConfig; slots: Slot[] } };
        setConfig(j.data.config);
        setSlots(j.data.slots ?? []);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/v1/provider/schedule", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const j = await res.json().catch(() => ({})) as { error?: { message?: string } };
      if (!res.ok) {
        setMsg({ type: "error", text: j?.error?.message ?? "Save failed." });
      } else {
        setMsg({ type: "success", text: "Schedule settings saved." });
      }
    } catch { setMsg({ type: "error", text: "Network error." }); }
    finally { setSaving(false); }
  }

  function toggleDay(day: number) {
    setConfig((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day].sort(),
    }));
  }

  const upcomingSlots = slots.filter((s) => new Date(s.startsAt) >= new Date()).slice(0, 20);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-14 lg:w-56 bg-white border-r border-slate-200 flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="px-3 py-4 border-b border-slate-100 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: "#1B8A4A" }}>E</span>
          <span className="hidden lg:block font-bold text-slate-800 text-sm">EasyHeals</span>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {[
            { href: userRole === "doctor" ? "/portal/doctor/dashboard" : "/portal/hospital/dashboard", icon: "🏠", label: "Dashboard" },
            { href: "/portal/schedule", icon: "📅", label: "Schedule", active: true },
            { href: "/portal/queue", icon: "🎫", label: "OPD Queue" },
            { href: "/portal/staff", icon: "👥", label: "Staff" },
            { href: "/portal/subscription", icon: "💳", label: "Subscription" },
          ].map((n) => (
            <Link key={n.label} href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${"active" in n && n.active ? "text-white" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}
              style={"active" in n && n.active ? { background: "#1B8A4A" } : {}}
            >
              <span className="text-base">{n.icon}</span>
              <span className="hidden lg:block">{n.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Schedule & Availability</h1>
            <p className="text-sm text-slate-400">{userFullName}</p>
          </div>

          {msg && (
            <div className={`p-3 rounded-xl text-sm border ${msg.type === "success" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              {msg.text}
            </div>
          )}

          {loading ? (
            <div className="animate-pulse bg-slate-200 rounded-2xl h-64" />
          ) : (
            <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
              <h2 className="text-sm font-bold text-slate-700">Working Hours Settings</h2>

              {/* Days of week */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Working Days</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map((label, i) => (
                    <button key={i} type="button"
                      onClick={() => toggleDay(i)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition ${config.daysOfWeek.includes(i) ? "text-white border-transparent" : "text-slate-500 border-slate-200 hover:bg-slate-50"}`}
                      style={config.daysOfWeek.includes(i) ? { background: "#1B8A4A" } : {}}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hours */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Start Time</label>
                  <select value={config.startHour} onChange={(e) => setConfig((c) => ({ ...c, startHour: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{formatTime(i)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">End Time</label>
                  <select value={config.endHour} onChange={(e) => setConfig((c) => ({ ...c, endHour: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((i) => (
                      <option key={i} value={i}>{formatTime(i)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Slot Duration</label>
                  <select value={config.slotDurationMinutes} onChange={(e) => setConfig((c) => ({ ...c, slotDurationMinutes: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
                    {SLOT_DURATIONS.map((d) => (
                      <option key={d} value={d}>{d} min</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Capacity / Slot</label>
                  <select value={config.capacityPerSlot} onChange={(e) => setConfig((c) => ({ ...c, capacityPerSlot: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
                    {[1, 2, 3, 4, 5, 8, 10].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Break */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Break Start (optional)</label>
                  <select value={config.breakStart ?? ""} onChange={(e) => setConfig((c) => ({ ...c, breakStart: e.target.value ? parseInt(e.target.value) : undefined }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
                    <option value="">No break</option>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{formatTime(i)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Break End (optional)</label>
                  <select value={config.breakEnd ?? ""} onChange={(e) => setConfig((c) => ({ ...c, breakEnd: e.target.value ? parseInt(e.target.value) : undefined }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
                    <option value="">—</option>
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((i) => (
                      <option key={i} value={i}>{formatTime(i)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={saving}
                  className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60 flex items-center gap-2"
                  style={{ background: "#1B8A4A" }}>
                  {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</> : "Save Settings"}
                </button>
              </div>
            </form>
          )}

          {/* Upcoming slots */}
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Upcoming Slots ({upcomingSlots.length})
            </h2>
            {upcomingSlots.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                <p className="text-slate-400 text-sm">No upcoming slots. Save schedule settings to generate slots (or use the Admin panel).</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date & Time</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Capacity</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {upcomingSlots.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-700">{formatSlotTime(s.startsAt)}</td>
                        <td className="px-4 py-2.5 text-slate-600">{config.capacityPerSlot}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${s.isBooked ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>
                            {s.isBooked ? "Booked" : "Available"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
