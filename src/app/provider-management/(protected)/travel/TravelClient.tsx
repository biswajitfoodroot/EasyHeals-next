"use client";

import { useState } from "react";

type Quote = {
  id: string;
  partnerName: string;
  propertyName: string | null;
  ratePerNightPaise: number | null;
  totalAmountPaise: number | null;
  inclusions: string | null;
  distanceFromHospitalKm: number | null;
  partnerContactPhone: string | null;
  status: string;
};

type TravelCase = {
  id: string;
  referralCaseId: string | null;
  patientName: string | null;
  patientPhone: string | null;
  destinationCity: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  guestCount: number | null;
  budgetPaise: number | null;
  requirements: string | null;
  status: string;
  assignedCoordinatorId: string | null;
  coordinatorName: string | null;
  commissionPaise: number | null;
  notes: string | null;
  createdAt: string | null;
  quoteCount: number;
};

const STATUS_COLORS: Record<string, string> = {
  requested:  "bg-amber-50 text-amber-700 border-amber-200",
  quoted:     "bg-blue-50 text-blue-700 border-blue-200",
  booked:     "bg-indigo-50 text-indigo-700 border-indigo-200",
  checked_in: "bg-teal-50 text-teal-700 border-teal-200",
  completed:  "bg-green-50 text-green-700 border-green-200",
  cancelled:  "bg-red-50 text-red-700 border-red-200",
};

function formatInr(paise: number | null | undefined) {
  if (!paise) return "—";
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function TravelClient({ cases: initial }: { cases: TravelCase[] }) {
  const [cases, setCases] = useState(initial);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote[]>>({});
  const [loadingQuotes, setLoadingQuotes] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  // New case form
  const [form, setForm] = useState({
    patientName: "", patientPhone: "", destinationCity: "",
    checkInDate: "", checkOutDate: "", guestCount: 1,
    budgetPaise: "", requirements: "",
  });

  // Add quote form
  const [quoteForm, setQuoteForm] = useState<Record<string, {
    partnerName: string; propertyName: string; ratePerNight: string;
    total: string; inclusions: string; distance: string; phone: string;
  }>>({});

  async function loadQuotes(id: string) {
    setLoadingQuotes(id);
    try {
      const res = await fetch(`/api/provider-management/travel/${id}`);
      if (res.ok) {
        const { data } = await res.json() as { data: TravelCase & { quotes: Quote[] } };
        setQuotes(q => ({ ...q, [id]: data.quotes }));
      }
    } finally { setLoadingQuotes(null); }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!quotes[id]) await loadQuotes(id);
  }

  async function handleCreate() {
    if (!form.patientName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/provider-management/travel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: form.patientName,
          patientPhone: form.patientPhone || undefined,
          destinationCity: form.destinationCity || undefined,
          checkInDate: form.checkInDate || undefined,
          checkOutDate: form.checkOutDate || undefined,
          guestCount: form.guestCount,
          budgetPaise: form.budgetPaise ? Math.round(parseFloat(form.budgetPaise) * 100) : undefined,
          requirements: form.requirements || undefined,
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setForm({ patientName: "", patientPhone: "", destinationCity: "", checkInDate: "", checkOutDate: "", guestCount: 1, budgetPaise: "", requirements: "" });
        await refreshList();
      }
    } finally { setSaving(false); }
  }

  async function handleAddQuote(caseId: string) {
    const qf = quoteForm[caseId];
    if (!qf?.partnerName) return;
    setSaving(true);
    try {
      await fetch(`/api/provider-management/travel/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_quote",
          quote: {
            partnerName: qf.partnerName,
            propertyName: qf.propertyName || undefined,
            ratePerNightPaise: qf.ratePerNight ? Math.round(parseFloat(qf.ratePerNight) * 100) : undefined,
            totalAmountPaise: qf.total ? Math.round(parseFloat(qf.total) * 100) : undefined,
            inclusions: qf.inclusions || undefined,
            distanceFromHospitalKm: qf.distance ? parseFloat(qf.distance) : undefined,
            partnerContactPhone: qf.phone || undefined,
          },
        }),
      });
      setQuoteForm(f => ({ ...f, [caseId]: { partnerName: "", propertyName: "", ratePerNight: "", total: "", inclusions: "", distance: "", phone: "" } }));
      await loadQuotes(caseId);
      await refreshList();
    } finally { setSaving(false); }
  }

  async function handleSelectQuote(caseId: string, quoteId: string) {
    await fetch(`/api/provider-management/travel/${caseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "select_quote", quoteId }),
    });
    await loadQuotes(caseId);
    await refreshList();
  }

  async function handleStatusChange(caseId: string, status: string) {
    await fetch(`/api/provider-management/travel/${caseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await refreshList();
  }

  async function refreshList() {
    const res = await fetch(`/api/provider-management/travel${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`);
    if (res.ok) {
      const { data } = await res.json() as { data: TravelCase[] };
      setCases(data);
    }
  }

  const filtered = statusFilter === "all" ? cases : cases.filter(c => c.status === statusFilter);

  const statusCounts = cases.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-5">
      {/* Status filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        {["all", "requested", "quoted", "booked", "checked_in", "completed", "cancelled"].map(s => (
          <button key={s} type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              statusFilter === s
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
            }`}>
            {s === "all" ? "All" : s.replace("_", " ")}
            {s !== "all" && statusCounts[s] ? <span className="ml-1.5 opacity-70">({statusCounts[s]})</span> : null}
          </button>
        ))}
        <button type="button" onClick={() => setShowAdd(!showAdd)}
          className="ml-auto px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition">
          + New Travel Case
        </button>
      </div>

      {/* New case form */}
      {showAdd && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <p className="text-sm font-bold text-slate-700">New Travel Coordination Case</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Patient Name *", key: "patientName", type: "text" },
              { label: "Patient Phone", key: "patientPhone", type: "tel" },
              { label: "Destination City", key: "destinationCity", type: "text" },
              { label: "Check-in Date", key: "checkInDate", type: "date" },
              { label: "Check-out Date", key: "checkOutDate", type: "date" },
              { label: "Budget (₹)", key: "budgetPaise", type: "number" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{f.label}</label>
                <input type={f.type}
                  value={(form as Record<string, string | number>)[f.key] as string}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Guest Count</label>
            <input type="number" min={1} value={form.guestCount}
              onChange={e => setForm(p => ({ ...p, guestCount: parseInt(e.target.value) || 1 }))}
              className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Requirements / Notes</label>
            <textarea value={form.requirements} onChange={e => setForm(p => ({ ...p, requirements: e.target.value }))}
              rows={2} placeholder="Accessible room, near hospital, vegetarian meals..."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={saving || !form.patientName.trim()} onClick={handleCreate}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60">
              {saving ? "Creating..." : "Create Case"}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="px-4 py-2 border border-slate-200 text-sm text-slate-600 rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {/* Cases list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm">No travel cases found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(tc => {
            const isOpen = expandedId === tc.id;
            const caseQuotes = quotes[tc.id] ?? [];
            const qf = quoteForm[tc.id] ?? { partnerName: "", propertyName: "", ratePerNight: "", total: "", inclusions: "", distance: "", phone: "" };

            return (
              <div key={tc.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Header row */}
                <div className="px-5 py-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800">{tc.patientName ?? "Unknown Patient"}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[tc.status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                        {tc.status.replace("_", " ").toUpperCase()}
                      </span>
                      {tc.quoteCount > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {tc.quoteCount} quote{tc.quoteCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                      {tc.destinationCity && <span>📍 {tc.destinationCity}</span>}
                      {tc.checkInDate && <span>📅 {fmtDate(tc.checkInDate)} → {fmtDate(tc.checkOutDate)}</span>}
                      {tc.budgetPaise && <span>💰 Budget {formatInr(tc.budgetPaise)}</span>}
                      {tc.guestCount && tc.guestCount > 1 && <span>👥 {tc.guestCount} guests</span>}
                      {tc.patientPhone && <span>📞 {tc.patientPhone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select value={tc.status}
                      onChange={e => void handleStatusChange(tc.id, e.target.value)}
                      className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white outline-none">
                      {["requested", "quoted", "booked", "checked_in", "completed", "cancelled"].map(s => (
                        <option key={s} value={s}>{s.replace("_", " ")}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => void toggleExpand(tc.id)}
                      className="text-xs font-semibold text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50">
                      {isOpen ? "Collapse" : loadingQuotes === tc.id ? "Loading..." : "Details"}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                    {tc.requirements && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-0.5">Requirements</p>
                        <p className="text-sm text-slate-700">{tc.requirements}</p>
                      </div>
                    )}

                    {/* Quotes */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2">
                        Quotes ({caseQuotes.length})
                      </p>
                      {caseQuotes.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {caseQuotes.map(q => (
                            <div key={q.id} className={`rounded-xl border px-4 py-3 flex flex-wrap items-center gap-3 ${
                              q.status === "selected" ? "border-green-300 bg-green-50" :
                              q.status === "declined" ? "border-slate-200 bg-slate-50 opacity-60" :
                              "border-slate-200 bg-white"
                            }`}>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800">{q.partnerName}</p>
                                {q.propertyName && <p className="text-xs text-slate-500">{q.propertyName}</p>}
                                <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                                  {q.ratePerNightPaise && <span>₹{(q.ratePerNightPaise / 100).toLocaleString("en-IN")}/night</span>}
                                  {q.totalAmountPaise && <span>Total {formatInr(q.totalAmountPaise)}</span>}
                                  {q.distanceFromHospitalKm && <span>{q.distanceFromHospitalKm} km from hospital</span>}
                                  {q.partnerContactPhone && <span>📞 {q.partnerContactPhone}</span>}
                                </div>
                                {q.inclusions && <p className="text-xs text-slate-400 mt-0.5">{q.inclusions}</p>}
                              </div>
                              <div className="shrink-0 flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  q.status === "selected" ? "bg-green-100 text-green-700 border-green-300" :
                                  q.status === "declined" ? "bg-slate-100 text-slate-500 border-slate-200" :
                                  "bg-blue-50 text-blue-700 border-blue-200"
                                }`}>{q.status}</span>
                                {q.status === "proposed" && (
                                  <button type="button"
                                    onClick={() => void handleSelectQuote(tc.id, q.id)}
                                    className="text-xs font-semibold text-green-700 border border-green-300 px-3 py-1 rounded-lg hover:bg-green-50">
                                    Select
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add quote form */}
                      <div className="border border-dashed border-slate-300 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-semibold text-slate-500">Add Quote</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { label: "Partner Name *", key: "partnerName" },
                            { label: "Property Name", key: "propertyName" },
                            { label: "Contact Phone", key: "phone" },
                            { label: "Rate/Night (₹)", key: "ratePerNight" },
                            { label: "Total (₹)", key: "total" },
                            { label: "Distance (km)", key: "distance" },
                          ].map(f => (
                            <div key={f.key}>
                              <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">{f.label}</label>
                              <input value={(qf as Record<string, string>)[f.key]}
                                onChange={e => setQuoteForm(p => ({
                                  ...p,
                                  [tc.id]: { ...qf, [f.key]: e.target.value },
                                }))}
                                className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-400" />
                            </div>
                          ))}
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Inclusions</label>
                          <input value={qf.inclusions}
                            onChange={e => setQuoteForm(p => ({ ...p, [tc.id]: { ...qf, inclusions: e.target.value } }))}
                            placeholder="Breakfast, WiFi, airport transfer..."
                            className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-400" />
                        </div>
                        <button type="button" disabled={saving || !qf.partnerName}
                          onClick={() => void handleAddQuote(tc.id)}
                          className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60">
                          {saving ? "Adding..." : "Add Quote"}
                        </button>
                      </div>
                    </div>

                    {/* Commission + Notes */}
                    <div className="flex flex-wrap gap-4 pt-1">
                      {tc.commissionPaise != null && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500">Commission</p>
                          <p className="text-sm font-bold text-green-700">{formatInr(tc.commissionPaise)}</p>
                        </div>
                      )}
                      {tc.notes && (
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-slate-500">Notes</p>
                          <p className="text-sm text-slate-600">{tc.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
