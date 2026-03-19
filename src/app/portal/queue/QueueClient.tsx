"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Token {
  id: string;
  tokenNumber: number;
  patientName: string | null;
  patientPhone: string | null;
  status: string;
  notes: string | null;
  calledAt: string | null;
  doneAt: string | null;
  createdAt: string | null;
}

interface Props {
  userRole: string;
  providerId?: string;
  doctorId?: string;
}

const STATUS_COLORS: Record<string, string> = {
  waiting:  "bg-amber-100 text-amber-800 border-amber-200",
  called:   "bg-blue-100 text-blue-800 border-blue-200",
  serving:  "bg-purple-100 text-purple-800 border-purple-200",
  done:     "bg-green-100 text-green-800 border-green-200",
  skipped:  "bg-slate-100 text-slate-500 border-slate-200",
};

export default function QueueClient({ userRole, providerId, doctorId }: Props) {
  const router = useRouter();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  // Add walk-in form
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);

  const todayStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  useEffect(() => {
    void loadQueue();
  }, []);

  async function loadQueue() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (providerId) params.set("providerId", providerId);
      if (doctorId) params.set("doctorId", doctorId);
      const res = await fetch(`/api/v1/provider/queue?${params}`, { credentials: "include" });
      if (res.status === 401 || res.status === 403) { router.push("/portal/login"); return; }
      if (res.ok) {
        const j = (await res.json()) as { data: Token[] };
        setTokens(j.data ?? []);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }

  async function handleAddWalkin(e: FormEvent) {
    e.preventDefault();
    if (!providerId) { setError("No hospital linked to your account."); return; }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/provider/queue", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, doctorId, patientName: patientName || undefined, patientPhone: patientPhone || undefined, notes: notes || undefined }),
      });
      const j = await res.json().catch(() => ({})) as { error?: { message?: string } };
      if (!res.ok) { setError(j?.error?.message ?? "Failed to add token."); return; }
      setPatientName(""); setPatientPhone(""); setNotes("");
      await loadQueue();
    } catch { setError("Network error."); }
    finally { setAdding(false); }
  }

  async function handleAction(id: string, action: "call" | "done" | "skip") {
    setActing(id);
    try {
      await fetch(`/api/v1/provider/queue/${id}/call`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await loadQueue();
    } catch { /* non-fatal */ }
    finally { setActing(null); }
  }

  const waiting  = tokens.filter((t) => t.status === "waiting");
  const active   = tokens.filter((t) => ["called", "serving"].includes(t.status));
  const done     = tokens.filter((t) => ["done", "skipped"].includes(t.status));

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
            { href: "/portal/hospital/dashboard", icon: "🏠", label: "Dashboard" },
            { href: "/portal/schedule", icon: "📅", label: "Schedule" },
            { href: "/portal/queue", icon: "🎫", label: "OPD Queue", active: true },
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
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800">OPD Walk-in Queue</h1>
              <p className="text-sm text-slate-400">{todayStr}</p>
            </div>
            <button onClick={() => void loadQueue()}
              className="text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition">
              🔄 Refresh
            </button>
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}

          {/* Add walk-in */}
          <form onSubmit={handleAddWalkin} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-700 mb-4">+ Add Walk-in Patient</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="text" value={patientName} onChange={(e) => setPatientName(e.target.value)}
                placeholder="Patient name (optional)"
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
              <input type="text" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
            </div>
            <div className="flex justify-end mt-3">
              <button type="submit" disabled={adding}
                className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60"
                style={{ background: "#1B8A4A" }}>
                {adding ? "Adding..." : "Issue Token"}
              </button>
            </div>
          </form>

          {/* Now Serving */}
          {active.length > 0 && (
            <div className="bg-white rounded-2xl border-2 p-5 shadow-sm" style={{ borderColor: "#1B8A4A" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-green-700 mb-2">Now Serving</p>
              {active.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-3xl font-bold text-green-700">#{t.tokenNumber}</span>
                    {t.patientName && <span className="ml-3 text-sm font-semibold text-slate-700">{t.patientName}</span>}
                    {t.patientPhone && <span className="ml-2 text-sm text-slate-500">{t.patientPhone}</span>}
                  </div>
                  <button onClick={() => handleAction(t.id, "done")} disabled={acting === t.id}
                    className="px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
                    style={{ background: "#1B8A4A" }}>
                    Mark Done
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Waiting queue */}
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="animate-pulse bg-slate-200 rounded-2xl h-16" />)}</div>
          ) : waiting.length === 0 && active.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <p className="text-slate-400 text-sm">No patients waiting. Add walk-ins above.</p>
            </div>
          ) : (
            <>
              {waiting.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Waiting ({waiting.length})
                  </h2>
                  <div className="space-y-2">
                    {waiting.map((t) => (
                      <div key={t.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-4">
                          <span className="text-2xl font-bold text-slate-800">#{t.tokenNumber}</span>
                          <div>
                            <p className="text-sm font-medium text-slate-700">{t.patientName ?? "Walk-in"}</p>
                            {t.patientPhone && <p className="text-xs text-slate-400">{t.patientPhone}</p>}
                            {t.notes && <p className="text-xs text-slate-400">{t.notes}</p>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleAction(t.id, "call")} disabled={acting === t.id}
                            className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
                            style={{ background: "#1B8A4A" }}>
                            Call
                          </button>
                          <button onClick={() => handleAction(t.id, "skip")} disabled={acting === t.id}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                            Skip
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {done.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-500 select-none">
                    Completed today ({done.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {done.map((t) => (
                      <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between opacity-60">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-slate-600">#{t.tokenNumber}</span>
                          <span className="text-sm text-slate-600">{t.patientName ?? "Walk-in"}</span>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[t.status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
