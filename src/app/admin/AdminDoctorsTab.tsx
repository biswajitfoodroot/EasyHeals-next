"use client";

import { useCallback, useEffect, useState } from "react";

type Affiliation = {
  id: string;
  doctorId: string;
  hospitalId: string;
  hospitalName: string;
  hospitalCity: string;
  hospitalState: string | null;
  hospitalSlug: string;
  role: string;
  isActive: boolean;
  affiliationStatus: string;
  isPrimary: boolean;
  feeMin: number | null;
  feeMax: number | null;
};

type Doctor = {
  id: string;
  slug: string;
  fullName: string;
  specialization: string | null;
  city: string | null;
  state: string | null;
  verified: boolean;
  isActive: boolean;
  updatedAt: Date | null;
  affiliations: Affiliation[];
};

type AffAction = "mark_current" | "mark_past" | "set_primary" | "delete";

export function AdminDoctorsTab() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Bulk selection: per-doctor map of selected affiliation IDs
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQuery(query); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/doctors?q=${encodeURIComponent(debouncedQuery)}&page=${page}`);
      const body = await res.json() as { data?: { doctors: Doctor[] } };
      setDoctors(body.data?.doctors ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [debouncedQuery, page]);

  useEffect(() => { void load(); }, [load]);

  // Clear selection when doctor list changes
  useEffect(() => { setSelected(new Set()); }, [doctors]);

  async function updateAffiliation(affiliationId: string, action: AffAction, doctorId: string) {
    if (action === "delete" && !confirm("Delete this affiliation permanently? This cannot be undone.")) return;
    setBusy(prev => ({ ...prev, [affiliationId]: true }));
    setMsg(null);
    try {
      const res = await fetch("/api/admin/doctors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliationId, action }),
      });
      const body = await res.json() as { data?: { ok: boolean }; error?: string };
      if (res.ok) {
        setMsg({ id: doctorId, text: action === "delete" ? "Affiliation deleted" : "Affiliation updated", ok: true });
        void load();
      } else {
        setMsg({ id: doctorId, text: body.error ?? "Failed", ok: false });
      }
    } catch {
      setMsg({ id: doctorId, text: "Network error", ok: false });
    }
    setBusy(prev => ({ ...prev, [affiliationId]: false }));
  }

  async function bulkAction(action: AffAction) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const actionLabel = action.replace("_", " ");
    if (action === "delete" && !confirm(`Delete ${ids.length} affiliation(s) permanently? This cannot be undone.`)) return;
    if (action !== "delete" && !confirm(`${actionLabel} ${ids.length} affiliation(s)?`)) return;
    setBulkBusy(true);
    setBulkMsg(null);
    try {
      const res = await fetch("/api/admin/doctors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliationIds: ids, action }),
      });
      const body = await res.json() as { data?: { ok: boolean; affected: number }; error?: string };
      if (res.ok) {
        const count = body.data?.affected ?? ids.length;
        setBulkMsg({ text: `✓ ${actionLabel} applied to ${count} affiliation(s)`, ok: true });
        setSelected(new Set());
        void load();
      } else {
        setBulkMsg({ text: `✗ ${body.error ?? "Failed"}`, ok: false });
      }
    } catch {
      setBulkMsg({ text: "✗ Bulk action failed — network error", ok: false });
    }
    setBulkBusy(false);
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllForDoctor(doctor: Doctor) {
    const allIds = doctor.affiliations.map(a => a.id);
    const allSelected = allIds.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) {
        allIds.forEach(id => next.delete(id));
      } else {
        allIds.forEach(id => next.add(id));
      }
      return next;
    });
  }

  const currentAffiliations = (d: Doctor) => d.affiliations.filter(a => a.isActive && a.affiliationStatus === "active");
  const pastAffiliations = (d: Doctor) => d.affiliations.filter(a => !a.isActive || a.affiliationStatus !== "active");

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Doctor Data Correction</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Review and correct current vs. past hospital affiliations for all doctors.
              Incorrect affiliations allow patients to book at hospitals where the doctor no longer practices.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-xl font-medium text-slate-700 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by doctor name, city, or specialization…"
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
      </div>

      {/* Warning banner */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
        <span className="text-2xl shrink-0">⛔</span>
        <div>
          <p className="font-semibold text-red-800 text-sm">Why this matters</p>
          <p className="text-red-700 text-xs mt-0.5">
            If a doctor is incorrectly marked as "current" at a hospital they no longer work at,
            patients can book appointments there — leading to failed bookings and poor experience.
            Use this tab to correct affiliations after AI research ingestion.
          </p>
        </div>
      </div>

      {/* Bulk action bar (floating) */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-20 bg-teal-700 text-white rounded-2xl p-3 flex flex-wrap items-center gap-3 shadow-lg">
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <div className="flex-1" />
          <button
            type="button" disabled={bulkBusy}
            onClick={() => bulkAction("mark_current")}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            Mark as Current
          </button>
          <button
            type="button" disabled={bulkBusy}
            onClick={() => bulkAction("mark_past")}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            Mark as Past
          </button>
          <button
            type="button" disabled={bulkBusy}
            onClick={() => bulkAction("delete")}
            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Bulk action result banner */}
      {bulkMsg && (
        <div className={`rounded-xl p-3 text-sm font-medium ${bulkMsg.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {bulkMsg.text}
          <button type="button" onClick={() => setBulkMsg(null)} className="ml-3 text-xs underline opacity-70 hover:opacity-100">dismiss</button>
        </div>
      )}

      {/* Doctor list */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <span className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mr-3" />
          Loading doctors…
        </div>
      )}

      {!loading && doctors.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          No doctors found{query ? ` for "${query}"` : ""}.
        </div>
      )}

      <div className="space-y-3">
        {doctors.map((doctor) => {
          const current = currentAffiliations(doctor);
          const past = pastAffiliations(doctor);
          const isExpanded = expandedId === doctor.id;
          const hasProblem = past.length > 0 && current.length === 0;
          const allDocAffs = doctor.affiliations.map(a => a.id);
          const allSelected = allDocAffs.length > 0 && allDocAffs.every(id => selected.has(id));
          const someSelected = allDocAffs.some(id => selected.has(id));

          return (
            <div
              key={doctor.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${hasProblem ? "border-amber-300" : "border-slate-200"}`}
            >
              {/* Doctor header row */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : doctor.id)}
                className="w-full flex items-start gap-4 p-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm shrink-0">
                  {doctor.fullName.replace("Dr.", "").trim().charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-800">{doctor.fullName}</p>
                    {hasProblem && (
                      <span className="text-xs font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">⚠ No current affiliation</span>
                    )}
                    {!doctor.isActive && (
                      <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {doctor.specialization ?? "–"} · {doctor.city ?? "–"}{doctor.state ? `, ${doctor.state}` : ""}
                  </p>
                  <div className="flex gap-3 mt-1 text-xs">
                    <span className="text-emerald-600 font-medium">{current.length} current</span>
                    {past.length > 0 && <span className="text-slate-400">{past.length} past</span>}
                  </div>
                </div>
                <span className="text-slate-400 text-lg mt-1">{isExpanded ? "▲" : "▼"}</span>
              </button>

              {/* Expanded: affiliations editor */}
              {isExpanded && (
                <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/40">
                  {msg?.id === doctor.id && (
                    <div className={`px-4 py-2 rounded-xl text-sm font-medium ${msg.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                      {msg.ok ? "✓" : "✗"} {msg.text}
                    </div>
                  )}

                  {/* Select all toggle */}
                  {doctor.affiliations.length > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => selectAllForDoctor(doctor)}
                        className="flex items-center gap-2 text-xs text-slate-500 hover:text-teal-700 font-medium transition-colors"
                      >
                        <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${allSelected ? "bg-teal-600 border-teal-600 text-white" : someSelected ? "bg-teal-100 border-teal-400" : "border-slate-300"}`}>
                          {allSelected && "✓"}
                          {someSelected && !allSelected && "–"}
                        </span>
                        Select all affiliations
                      </button>
                    </div>
                  )}

                  {/* Current affiliations */}
                  {current.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">✅ Currently Practices At (Patients can book here)</p>
                      <div className="space-y-2">
                        {current.map((aff) => (
                          <div key={aff.id} className={`bg-white border rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 ${selected.has(aff.id) ? "border-teal-400 ring-1 ring-teal-200" : "border-emerald-200"}`}>
                            {/* Checkbox */}
                            <button
                              type="button"
                              onClick={() => toggleSelect(aff.id)}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selected.has(aff.id) ? "bg-teal-600 border-teal-600 text-white" : "border-slate-300 hover:border-teal-400"}`}
                            >
                              {selected.has(aff.id) && <span className="text-xs">✓</span>}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-800 text-sm">{aff.hospitalName}</p>
                              <p className="text-xs text-slate-500">{aff.hospitalCity}{aff.hospitalState ? `, ${aff.hospitalState}` : ""} · {aff.role}</p>
                              {(aff.feeMin || aff.feeMax) && (
                                <p className="text-xs text-teal-600 mt-0.5">
                                  Fee: ₹{aff.feeMin?.toLocaleString() ?? "–"} – ₹{aff.feeMax?.toLocaleString() ?? "–"}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {aff.isPrimary && (
                                <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">⭐ Primary</span>
                              )}
                              {!aff.isPrimary && (
                                <button
                                  type="button"
                                  disabled={busy[aff.id]}
                                  onClick={() => updateAffiliation(aff.id, "set_primary", doctor.id)}
                                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors font-medium"
                                >
                                  Set Primary
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={busy[aff.id]}
                                onClick={() => updateAffiliation(aff.id, "mark_past", doctor.id)}
                                className="text-xs px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg transition-colors font-semibold"
                              >
                                {busy[aff.id] ? "…" : "Mark as Past"}
                              </button>
                              <button
                                type="button"
                                disabled={busy[aff.id]}
                                onClick={() => updateAffiliation(aff.id, "delete", doctor.id)}
                                className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition-colors font-semibold"
                              >
                                {busy[aff.id] ? "…" : "Delete"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Past affiliations */}
                  {past.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">🕐 Past Affiliations (No booking)</p>
                      <div className="space-y-2">
                        {past.map((aff) => (
                          <div key={aff.id} className={`bg-slate-100 border rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 ${selected.has(aff.id) ? "border-teal-400 ring-1 ring-teal-200 opacity-100" : "border-slate-200 opacity-75"}`}>
                            {/* Checkbox */}
                            <button
                              type="button"
                              onClick={() => toggleSelect(aff.id)}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selected.has(aff.id) ? "bg-teal-600 border-teal-600 text-white" : "border-slate-300 hover:border-teal-400"}`}
                            >
                              {selected.has(aff.id) && <span className="text-xs">✓</span>}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-500 text-sm">{aff.hospitalName}</p>
                              <p className="text-xs text-slate-400">{aff.hospitalCity}{aff.hospitalState ? `, ${aff.hospitalState}` : ""} · {aff.role}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-bold px-2 py-0.5 bg-slate-200 text-slate-500 rounded-full">PAST</span>
                              <button
                                type="button"
                                disabled={busy[aff.id]}
                                onClick={() => updateAffiliation(aff.id, "mark_current", doctor.id)}
                                className="text-xs px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors font-semibold"
                              >
                                {busy[aff.id] ? "…" : "← Current"}
                              </button>
                              <button
                                type="button"
                                disabled={busy[aff.id]}
                                onClick={() => updateAffiliation(aff.id, "delete", doctor.id)}
                                className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition-colors font-semibold"
                              >
                                {busy[aff.id] ? "…" : "Delete"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {current.length === 0 && past.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">No hospital affiliations found for this doctor.</p>
                  )}

                  <div className="flex justify-end">
                    <a
                      href={`/doctors/${doctor.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-teal-600 hover:text-teal-800 font-medium"
                    >
                      View public profile →
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {doctors.length === 30 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            disabled={page === 1 || loading}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-sm text-slate-500">Page {page}</span>
          <button
            type="button"
            disabled={loading}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}
