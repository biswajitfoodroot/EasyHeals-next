"use client";

import { useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

type DuplicateEntry = {
  affiliationId: string;
  affiliationIsActive: boolean;
  doctorId: string;
  doctorName: string;
  doctorCity: string | null;
  doctorSpecialization: string | null;
  doctorIsActive: boolean;
  doctorCreatedAt: number | null;
  doctorSlug: string;
};


type DoctorResult = {
  id: string;
  fullName: string;
  city: string | null;
  state: string | null;
  specialization: string | null;
  isActive: boolean;
};

type HospitalResult = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  isActive: boolean;
};

type Affiliation = {
  id: string;
  role: string;
  isPrimary: boolean;
  isActive: boolean;
  affiliationStatus: string;
  feeMin: number | null;
  feeMax: number | null;
  source: string;
  createdAt: number | null;
  hospitalId: string;
  hospitalName: string;
  hospitalCity: string | null;
  hospitalState: string | null;
  hospitalSlug: string;
  hospitalIsActive: boolean;
};

const ROLES = [
  "Consultant",
  "Visiting Consultant",
  "Senior Consultant",
  "Resident Doctor",
  "Associate Consultant",
  "Head of Department",
  "Medical Director",
];

// ── Main Component ─────────────────────────────────────────────────────────────

export function AdminAffiliationsTab() {
  // Doctor search
  const [doctorQuery, setDoctorQuery] = useState("");
  const [doctorResults, setDoctorResults] = useState<DoctorResult[]>([]);
  const [doctorSearchBusy, setDoctorSearchBusy] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorResult | null>(null);

  // Affiliations for selected doctor
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [affiliationsBusy, setAffiliationsBusy] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editFeeMin, setEditFeeMin] = useState("");
  const [editFeeMax, setEditFeeMax] = useState("");
  const [editIsPrimary, setEditIsPrimary] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Add affiliation panel
  const [showAdd, setShowAdd] = useState(false);
  const [hospitalQuery, setHospitalQuery] = useState("");
  const [hospitalResults, setHospitalResults] = useState<HospitalResult[]>([]);
  const [hospitalSearchBusy, setHospitalSearchBusy] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<HospitalResult | null>(null);
  const [addRole, setAddRole] = useState("Consultant");
  const [addIsPrimary, setAddIsPrimary] = useState(false);
  const [addFeeMin, setAddFeeMin] = useState("");
  const [addFeeMax, setAddFeeMax] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ── Duplicate finder ─────────────────────────────────────────────────────────
  const [dupHospitalQuery, setDupHospitalQuery] = useState("");
  const [dupHospitalResults, setDupHospitalResults] = useState<HospitalResult[]>([]);
  const [dupHospitalBusy, setDupHospitalBusy] = useState(false);
  const [dupSelectedHospital, setDupSelectedHospital] = useState<HospitalResult | null>(null);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateEntry[][]>([]);
  const [dupLoading, setDupLoading] = useState(false);
  const [mergingPair, setMergingPair] = useState<{ keepId: string; deleteId: string } | null>(null);
  const [mergeMsg, setMergeMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ── Doctor search ────────────────────────────────────────────────────────────

  const searchDoctors = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setDoctorResults([]); return; }
    setDoctorSearchBusy(true);
    try {
      const res = await fetch(`/api/admin/affiliations?searchDoctors=${encodeURIComponent(q.trim())}`);
      const json = await res.json() as { data?: DoctorResult[] };
      setDoctorResults(json.data ?? []);
    } catch { setDoctorResults([]); }
    finally { setDoctorSearchBusy(false); }
  }, []);

  const selectDoctor = useCallback(async (doc: DoctorResult) => {
    setSelectedDoctor(doc);
    setDoctorResults([]);
    setDoctorQuery(doc.fullName);
    setAffiliations([]);
    setShowAdd(false);
    setEditingId(null);
    setMsg(null);

    setAffiliationsBusy(true);
    try {
      const res = await fetch(`/api/admin/affiliations?doctorId=${doc.id}`);
      const json = await res.json() as { data?: Affiliation[] };
      setAffiliations(json.data ?? []);
    } catch { setMsg({ type: "error", text: "Failed to load affiliations." }); }
    finally { setAffiliationsBusy(false); }
  }, []);

  // ── Hospital search ──────────────────────────────────────────────────────────

  const searchHospitals = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setHospitalResults([]); return; }
    setHospitalSearchBusy(true);
    try {
      const res = await fetch(`/api/admin/affiliations?searchHospitals=${encodeURIComponent(q.trim())}`);
      const json = await res.json() as { data?: HospitalResult[] };
      setHospitalResults(json.data ?? []);
    } catch { setHospitalResults([]); }
    finally { setHospitalSearchBusy(false); }
  }, []);

  // ── Edit inline ──────────────────────────────────────────────────────────────

  function startEdit(aff: Affiliation) {
    setEditingId(aff.id);
    setEditRole(aff.role);
    setEditFeeMin(aff.feeMin != null ? String(aff.feeMin) : "");
    setEditFeeMax(aff.feeMax != null ? String(aff.feeMax) : "");
    setEditIsPrimary(aff.isPrimary);
  }

  async function saveEdit(affId: string) {
    setSavingId(affId);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/affiliations?id=${affId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editRole,
          isPrimary: editIsPrimary,
          feeMin: editFeeMin ? Number(editFeeMin) : null,
          feeMax: editFeeMax ? Number(editFeeMax) : null,
        }),
      });
      const json = await res.json() as { data?: Affiliation; error?: string };
      if (!res.ok) { setMsg({ type: "error", text: json.error ?? "Update failed" }); return; }
      setAffiliations((prev) => prev.map((a) => a.id === affId ? { ...a, ...json.data! } : a));
      setEditingId(null);
      setMsg({ type: "success", text: "Affiliation updated." });
    } catch { setMsg({ type: "error", text: "Network error." }); }
    finally { setSavingId(null); }
  }

  async function toggleActive(aff: Affiliation) {
    setSavingId(aff.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/affiliations?id=${aff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !aff.isActive }),
      });
      const json = await res.json() as { data?: Affiliation; error?: string };
      if (!res.ok) { setMsg({ type: "error", text: json.error ?? "Update failed" }); return; }
      setAffiliations((prev) => prev.map((a) => a.id === aff.id ? { ...a, isActive: !aff.isActive } : a));
    } catch { setMsg({ type: "error", text: "Network error." }); }
    finally { setSavingId(null); }
  }

  async function deleteAffiliation(affId: string, hospitalName: string) {
    if (!confirm(`Remove affiliation with "${hospitalName}"? This cannot be undone.`)) return;
    setSavingId(affId);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/affiliations?id=${affId}`, { method: "DELETE" });
      if (!res.ok) { setMsg({ type: "error", text: "Delete failed." }); return; }
      setAffiliations((prev) => prev.filter((a) => a.id !== affId));
      setMsg({ type: "success", text: `Removed affiliation with "${hospitalName}".` });
    } catch { setMsg({ type: "error", text: "Network error." }); }
    finally { setSavingId(null); }
  }

  // ── Add affiliation ──────────────────────────────────────────────────────────

  async function submitAdd() {
    if (!selectedDoctor || !selectedHospital) return;
    setAddBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/affiliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          hospitalId: selectedHospital.id,
          role: addRole,
          isPrimary: addIsPrimary,
          feeMin: addFeeMin ? Number(addFeeMin) : null,
          feeMax: addFeeMax ? Number(addFeeMax) : null,
        }),
      });
      const json = await res.json() as { error?: string; reactivated?: boolean };
      if (!res.ok) { setMsg({ type: "error", text: json.error ?? "Failed to add affiliation" }); return; }

      // Reload affiliations
      const r2 = await fetch(`/api/admin/affiliations?doctorId=${selectedDoctor.id}`);
      const j2 = await r2.json() as { data?: Affiliation[] };
      setAffiliations(j2.data ?? []);

      setShowAdd(false);
      setSelectedHospital(null);
      setHospitalQuery("");
      setAddRole("Consultant");
      setAddIsPrimary(false);
      setAddFeeMin("");
      setAddFeeMax("");
      setMsg({ type: "success", text: json.reactivated ? "Affiliation reactivated." : "Affiliation created." });
    } catch { setMsg({ type: "error", text: "Network error." }); }
    finally { setAddBusy(false); }
  }

  // ── Duplicate finder handlers ─────────────────────────────────────────────────

  const searchDupHospitals = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setDupHospitalResults([]); return; }
    setDupHospitalBusy(true);
    try {
      const res = await fetch(`/api/admin/affiliations?searchHospitals=${encodeURIComponent(q.trim())}`);
      const json = await res.json() as { data?: HospitalResult[] };
      setDupHospitalResults(json.data ?? []);
    } catch { setDupHospitalResults([]); }
    finally { setDupHospitalBusy(false); }
  }, []);

  const loadDuplicates = useCallback(async (hospital: HospitalResult) => {
    setDupSelectedHospital(hospital);
    setDupHospitalResults([]);
    setDupHospitalQuery(hospital.name);
    setDuplicateGroups([]);
    setMergeMsg(null);
    setDupLoading(true);
    try {
      const res = await fetch(`/api/admin/affiliations?duplicates=${hospital.id}`);
      const json = await res.json() as { data?: DuplicateEntry[][] };
      setDuplicateGroups(json.data ?? []);
    } catch { setMergeMsg({ type: "error", text: "Failed to load duplicates." }); }
    finally { setDupLoading(false); }
  }, []);

  async function mergeDoctors(keepId: string, deleteId: string, hospitalId: string) {
    setMergingPair({ keepId, deleteId });
    setMergeMsg(null);
    try {
      const res = await fetch("/api/admin/affiliations/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepId, deleteId }),
      });
      const json = await res.json() as { ok?: boolean; error?: string; affiliationsRepointed?: number; affiliationsRemoved?: number };
      if (!res.ok) { setMergeMsg({ type: "error", text: json.error ?? "Merge failed" }); return; }
      setMergeMsg({ type: "success", text: `Merged. ${json.affiliationsRepointed} affiliation(s) repointed, ${json.affiliationsRemoved} removed.` });
      // Reload duplicates
      if (dupSelectedHospital) await loadDuplicates(dupSelectedHospital);
    } catch { setMergeMsg({ type: "error", text: "Network error." }); }
    finally { setMergingPair(null); }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/60">
          <h2 className="text-lg font-bold text-slate-800">🔗 Doctor–Hospital Affiliation Manager</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            All affiliations are managed through the <code className="text-teal-700 bg-teal-50 px-1 rounded">doctor_hospital_affiliations</code> table — no implicit hospital linking via <code className="text-red-600 bg-red-50 px-1 rounded">doctors.hospitalId</code>.
          </p>
        </div>

        {/* Doctor search */}
        <div className="p-5">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Search Doctor</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={doctorQuery}
              onChange={(e) => {
                setDoctorQuery(e.target.value);
                void searchDoctors(e.target.value);
              }}
              placeholder="Type doctor name…"
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
            />
            {doctorSearchBusy && <span className="self-center text-xs text-slate-400">Searching…</span>}
          </div>

          {/* Doctor results dropdown */}
          {doctorResults.length > 0 && (
            <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100">
              {doctorResults.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => void selectDoctor(doc)}
                  className="w-full text-left px-4 py-2.5 hover:bg-teal-50 transition-colors flex items-center justify-between"
                >
                  <span>
                    <span className="font-semibold text-sm text-slate-800">{doc.fullName}</span>
                    {doc.specialization && (
                      <span className="ml-2 text-xs text-teal-700">{doc.specialization}</span>
                    )}
                  </span>
                  <span className="text-xs text-slate-400">
                    {doc.city}{doc.state ? `, ${doc.state}` : ""}
                    {!doc.isActive && <span className="ml-1 text-red-500">(inactive)</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Affiliations list */}
      {selectedDoctor && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800">{selectedDoctor.fullName}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedDoctor.specialization ?? "—"} &nbsp;·&nbsp;
                {selectedDoctor.city ?? "—"}{selectedDoctor.state ? `, ${selectedDoctor.state}` : ""}
                &nbsp;·&nbsp;ID: <code className="text-[11px]">{selectedDoctor.id}</code>
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowAdd(true); setMsg(null); }}
              className="flex-shrink-0 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              + Add Affiliation
            </button>
          </div>

          {/* Feedback message */}
          {msg && (
            <div className={`mx-5 mt-4 p-3 rounded-xl text-sm border ${msg.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              {msg.text}
            </div>
          )}

          {/* Affiliations */}
          <div className="p-5 space-y-3">
            {affiliationsBusy && <p className="text-sm text-slate-400">Loading affiliations…</p>}

            {!affiliationsBusy && affiliations.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">No affiliations found in the affiliations table.</p>
            )}

            {affiliations.map((aff) => (
              <div
                key={aff.id}
                className={`border rounded-xl p-4 ${aff.isActive ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"}`}
              >
                {editingId === aff.id ? (
                  /* ── Edit mode ─────────────────────────────────────────── */
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">{aff.hospitalName}</span>
                      <span className="text-xs text-slate-400">{aff.hospitalCity}{aff.hospitalState ? `, ${aff.hospitalState}` : ""}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Role</label>
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                        >
                          {ROLES.map((r) => <option key={r}>{r}</option>)}
                          <option value={editRole}>{editRole}</option>
                        </select>
                      </div>
                      <div className="flex items-end gap-3">
                        <label className="flex items-center gap-2 cursor-pointer pb-1">
                          <input
                            type="checkbox"
                            checked={editIsPrimary}
                            onChange={(e) => setEditIsPrimary(e.target.checked)}
                            className="w-4 h-4 accent-teal-600"
                          />
                          <span className="text-sm font-medium text-slate-700">Primary hospital</span>
                        </label>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Fee Min (₹)</label>
                        <input
                          type="number"
                          value={editFeeMin}
                          onChange={(e) => setEditFeeMin(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Fee Max (₹)</label>
                        <input
                          type="number"
                          value={editFeeMax}
                          onChange={(e) => setEditFeeMax(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void saveEdit(aff.id)}
                        disabled={savingId === aff.id}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                      >
                        {savingId === aff.id ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-sm font-semibold rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── View mode ─────────────────────────────────────────── */
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold text-sm ${aff.isActive ? "text-slate-800" : "text-slate-400"}`}>
                          {aff.hospitalName}
                        </span>
                        {aff.isPrimary && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full uppercase tracking-wide">
                            ★ Primary
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide ${
                          aff.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}>
                          {aff.isActive ? "Active" : "Inactive"}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-500 rounded-full">
                          {aff.affiliationStatus}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-3">
                        <span>📍 {aff.hospitalCity ?? "—"}{aff.hospitalState ? `, ${aff.hospitalState}` : ""}</span>
                        <span>🏷 {aff.role}</span>
                        {(aff.feeMin || aff.feeMax) && (
                          <span>₹{aff.feeMin ?? "—"}–{aff.feeMax ?? "—"}</span>
                        )}
                        <span className="text-slate-300">Source: {aff.source}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(aff)}
                        className="px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(aff)}
                        disabled={savingId === aff.id}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-60"
                      >
                        {aff.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteAffiliation(aff.id, aff.hospitalName)}
                        disabled={savingId === aff.id}
                        className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add affiliation panel */}
          {showAdd && (
            <div className="mx-5 mb-5 border border-teal-200 rounded-xl p-4 bg-teal-50/40">
              <h4 className="font-semibold text-sm text-slate-800 mb-3">Add Hospital Affiliation</h4>

              {/* Hospital search */}
              {!selectedHospital ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Search Hospital</label>
                  <input
                    type="text"
                    value={hospitalQuery}
                    onChange={(e) => {
                      setHospitalQuery(e.target.value);
                      void searchHospitals(e.target.value);
                    }}
                    placeholder="Type hospital name or city…"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                  />
                  {hospitalSearchBusy && <p className="text-xs text-slate-400 mt-1">Searching…</p>}
                  {hospitalResults.length > 0 && (
                    <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100 bg-white">
                      {hospitalResults.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => {
                            setSelectedHospital(h);
                            setHospitalResults([]);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-teal-50 transition-colors flex items-center justify-between"
                        >
                          <span className="font-semibold text-sm text-slate-800">{h.name}</span>
                          <span className="text-xs text-slate-400">
                            {h.city}{h.state ? `, ${h.state}` : ""}
                            {!h.isActive && <span className="ml-1 text-red-500">(inactive)</span>}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">
                      🏥 {selectedHospital.name}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {selectedHospital.city}{selectedHospital.state ? `, ${selectedHospital.state}` : ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => { setSelectedHospital(null); setHospitalQuery(""); }}
                      className="text-xs text-slate-500 hover:text-slate-700 underline"
                    >
                      Change
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Role</label>
                      <select
                        value={addRole}
                        onChange={(e) => setAddRole(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                      >
                        {ROLES.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addIsPrimary}
                          onChange={(e) => setAddIsPrimary(e.target.checked)}
                          className="w-4 h-4 accent-teal-600"
                        />
                        <span className="text-sm font-medium text-slate-700">Set as primary hospital</span>
                      </label>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Fee Min (₹)</label>
                      <input
                        type="number"
                        value={addFeeMin}
                        onChange={(e) => setAddFeeMin(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                        placeholder="Optional"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Fee Max (₹)</label>
                      <input
                        type="number"
                        value={addFeeMax}
                        onChange={(e) => setAddFeeMax(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                        placeholder="Optional"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void submitAdd()}
                      disabled={addBusy}
                      className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center gap-2"
                    >
                      {addBusy ? (
                        <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Adding…</>
                      ) : "Add Affiliation"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAdd(false); setSelectedHospital(null); setHospitalQuery(""); }}
                      className="px-4 py-2 text-slate-600 hover:bg-white text-sm font-semibold rounded-xl transition-colors border border-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Duplicate Doctor Finder ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
        <div className="p-5 border-b border-red-50 bg-red-50/40">
          <h2 className="text-lg font-bold text-slate-800">🔍 Find &amp; Merge Duplicate Doctors</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Detects doctors who appear more than once at the same hospital (usually from repeated AI research runs).
            Merge keeps the canonical record and re-points all affiliations.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Hospital picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Select Hospital to Check</label>
            <input
              type="text"
              value={dupHospitalQuery}
              onChange={(e) => {
                setDupHospitalQuery(e.target.value);
                void searchDupHospitals(e.target.value);
              }}
              placeholder="Type hospital name…"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-400 outline-none text-sm"
            />
            {dupHospitalBusy && <p className="text-xs text-slate-400 mt-1">Searching…</p>}
            {dupHospitalResults.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100">
                {dupHospitalResults.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => void loadDuplicates(h)}
                    className="w-full text-left px-4 py-2.5 hover:bg-red-50 transition-colors flex items-center justify-between"
                  >
                    <span className="font-semibold text-sm text-slate-800">{h.name}</span>
                    <span className="text-xs text-slate-400">{h.city}{h.state ? `, ${h.state}` : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results */}
          {mergeMsg && (
            <div className={`p-3 rounded-xl text-sm border ${mergeMsg.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              {mergeMsg.text}
            </div>
          )}

          {dupLoading && <p className="text-sm text-slate-400">Scanning for duplicates…</p>}

          {!dupLoading && dupSelectedHospital && duplicateGroups.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <span>✅</span>
              <span>No duplicate doctors found at <strong>{dupSelectedHospital.name}</strong>.</span>
            </div>
          )}

          {duplicateGroups.map((group, gi) => (
            <div key={gi} className="border border-red-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-red-50 border-b border-red-200">
                <span className="font-semibold text-sm text-red-700">
                  ⚠️ {group[0].doctorName} — {group.length} duplicate records
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {group.map((entry, ei) => (
                  <div key={entry.doctorId} className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-slate-800">{entry.doctorName}</span>
                        {!entry.doctorIsActive && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-500 rounded-full uppercase">Inactive</span>
                        )}
                        {!entry.affiliationIsActive && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-600 rounded-full uppercase">Aff. Inactive</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400 flex flex-wrap gap-2">
                        <span>{entry.doctorSpecialization ?? "—"}</span>
                        <span>📍 {entry.doctorCity ?? "—"}</span>
                        <code className="text-[10px]">{entry.doctorId.slice(0, 8)}…</code>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {group.filter((_, j) => j !== ei).map((other) => (
                        <button
                          key={other.doctorId}
                          type="button"
                          disabled={!!mergingPair}
                          onClick={() => void mergeDoctors(entry.doctorId, other.doctorId, "")}
                          className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-60"
                          title={`Keep this record, merge & deactivate the other`}
                        >
                          {mergingPair?.keepId === entry.doctorId ? "Merging…" : "Keep This →"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
