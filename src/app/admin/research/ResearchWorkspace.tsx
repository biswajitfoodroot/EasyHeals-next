"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type HospitalRow = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  slug?: string | null;
  type?: string | null;
};

type AgentEntity = {
  name: string;
  type: string;
  city?: string | null;
  website?: string | null;
  phone?: string | null;
  snippet: string;
  sourceUrl?: string | null;
  description?: string | null;
  address?: string | null;
  specialties?: string[];
  facilities?: string[];
  accreditations?: string[];
  workingHours?: string | null;
  googleRating?: number | null;
  packages?: {
    packageName: string;
    procedureName?: string | null;
    department?: string | null;
    priceMin?: number | null;
    priceMax?: number | null;
  }[];
  doctors?: {
    fullName: string;
    specialization?: string;
    qualifications?: string[];
    yearsOfExperience?: number;
    consultationFee?: number;
    bio?: string;
  }[];
};

type MatchCandidate = {
  id: string;
  name: string;
  city: string | null;
  confidence: number;
  reasons: string[];
  specialization?: string | null;
  state?: string | null;
  type?: string | null;
};

type DoctorDraft = {
  fullName: string;
  specialization: string;
  qualifications: string[];
  yearsOfExperience: number | null;
  consultationFee: number | null;
  bio: string;
  matchMode: "existing" | "new" | "skip";
  matchedDoctorId: string | null;
  matchedDoctorName: string | null;
  // Auto-match state
  autoMatchId: string | null;
  autoMatchName: string | null;
  autoMatchConfidence: number | null;
  autoMatchReviewed: boolean;
};

type PackageDraft = {
  packageName: string;
  department: string;
  priceMin: number | null;
  priceMax: number | null;
  include: boolean;
};

type EntityDraft = {
  // Original entity type from AI ("hospital" | "clinic" | "doctor" | "unknown")
  rawType: string;
  // All hospital DB fields (used when rawType !== "doctor")
  name: string;
  type: string;
  city: string;
  state: string;
  addressLine1: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  specialties: string[];
  facilities: string[];
  accreditations: string[];
  // Hospital matching (used when rawType !== "doctor")
  matchMode: "existing" | "new";
  matchedHospitalId: string | null;
  matchedHospitalName: string | null;
  // Doctors & packages (used when rawType !== "doctor")
  doctors: DoctorDraft[];
  packages: PackageDraft[];
  // Doctor-entity fields (used when rawType === "doctor")
  // name maps to doctors.fullName; city/phone/description/specialties[0] also apply
  doctorSpecialization: string;
  doctorQualifications: string[];
  doctorYearsOfExperience: number | null;
  doctorConsultationFee: number | null;
  doctorBio: string;
  // Which hospital to link this doctor to (batch hospital or existing)
  doctorMatchMode: "existing" | "new" | "skip";
  doctorMatchedDoctorId: string | null;   // existing doctor to update
  doctorMatchedDoctorName: string | null;
  linkedHospitalId: string | null;        // hospital affiliation
  linkedHospitalName: string | null;
  // Source references
  sourceUrls: string[];
  // Auto-match state (set by runAutoMatch after entity cards are rendered)
  autoMatchId: string | null;
  autoMatchName: string | null;
  autoMatchConfidence: number | null;
  autoMatchReviewed: boolean;
  // UI state
  expanded: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  saveResult: null | {
    hospitalId?: string;
    hospitalAction?: string;
    doctorsCreated: number;
    doctorsUpdated: number;
    doctorId?: string;
    doctorAction?: string;
  };
  saveError: string | null;
};

type BatchItem = {
  name: string;
  status: "pending" | "processing" | "done" | "failed";
  jobId?: string;
  error?: string | null;
  confidence?: number;
  doctorCount?: number;
  specialtyCount?: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uniqueUrls(urls: (string | null | undefined)[]): string[] {
  return [...new Set(urls.filter((u): u is string => !!u && u.startsWith("http")))];
}

// Gemini's fallback path emits raw grounding chunks (web source URLs) as entities
// when JSON extraction fails. Their names are bare domain strings like
// "cmch-vellore.edu" or "wikipedia.org". Filter them out before rendering.
const DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/i;
const JUNK_DOMAINS = new Set(["wikipedia.org", "practo.com", "justdial.com", "sulekha.com", "credihealth.com", "gomedii.com"]);

function isUsableEntity(e: AgentEntity): boolean {
  if (!e.name?.trim()) return false;
  const name = e.name.trim();
  // Reject bare domain names (no spaces, matches domain pattern)
  if (!name.includes(" ") && DOMAIN_PATTERN.test(name)) return false;
  // Reject known aggregator/reference domains even if formatted with spaces
  const lower = name.toLowerCase();
  if (JUNK_DOMAINS.has(lower)) return false;
  // Require either a known type or some useful data (phone/website/description)
  if (e.type === "unknown" && !e.phone && !e.website && !e.description && !e.city) return false;
  return true;
}

const DOCTOR_BLANK = {
  doctorSpecialization: "",
  doctorQualifications: [] as string[],
  doctorYearsOfExperience: null as number | null,
  doctorConsultationFee: null as number | null,
  doctorBio: "",
  doctorMatchMode: "new" as const,
  doctorMatchedDoctorId: null as string | null,
  doctorMatchedDoctorName: null as string | null,
  linkedHospitalId: null as string | null,
  linkedHospitalName: null as string | null,
};

function entityFromAgent(e: AgentEntity): EntityDraft {
  const isDoctor = e.type === "doctor" || e.type === "physician" || e.type === "surgeon";
  return {
    rawType: e.type ?? "unknown",
    name: e.name ?? "",
    type: e.type === "clinic" ? "clinic" : e.type === "nursing_home" ? "nursing_home" : "hospital",
    city: e.city ?? "",
    state: "",
    addressLine1: e.address ?? "",
    phone: e.phone ?? "",
    email: "",
    website: e.website ?? "",
    description: e.description ?? e.snippet ?? "",
    specialties: e.specialties ?? [],
    facilities: e.facilities ?? [],
    accreditations: e.accreditations ?? [],
    matchMode: "new",
    matchedHospitalId: null,
    matchedHospitalName: null,
    doctors: isDoctor ? [] : (e.doctors ?? []).map(d => ({
      fullName: d.fullName,
      specialization: d.specialization ?? "",
      qualifications: d.qualifications ?? [],
      yearsOfExperience: d.yearsOfExperience ?? null,
      consultationFee: d.consultationFee ?? null,
      bio: d.bio ?? "",
      matchMode: "new" as const,
      matchedDoctorId: null,
      matchedDoctorName: null,
      autoMatchId: null,
      autoMatchName: null,
      autoMatchConfidence: null,
      autoMatchReviewed: false,
    })),
    packages: isDoctor ? [] : (e.packages ?? []).map(p => ({
      packageName: p.packageName,
      department: p.department ?? "",
      priceMin: p.priceMin ?? null,
      priceMax: p.priceMax ?? null,
      include: true,
    })),
    // Doctor-entity specific fields
    ...DOCTOR_BLANK,
    ...(isDoctor ? {
      doctorSpecialization: (e.specialties ?? [])[0] ?? "",
      doctorBio: e.description ?? e.snippet ?? "",
    } : {}),
    sourceUrls: uniqueUrls([e.sourceUrl, e.website]),
    autoMatchId: null,
    autoMatchName: null,
    autoMatchConfidence: null,
    autoMatchReviewed: false,
    expanded: true,
    saveStatus: "idle",
    saveResult: null,
    saveError: null,
  };
}

function entityFromJobDetails(details: Record<string, unknown>): EntityDraft | null {
  const candidates = (details.hospitalCandidates as unknown[]) ?? [];
  if (!candidates.length) return null;

  const cand = candidates[0] as Record<string, unknown>;
  const data = (cand.extractedData as Record<string, unknown>) ?? {};
  const doctorCandidates = (details.doctorCandidates as unknown[]) ?? [];
  const packageCandidates = (details.packageCandidates as unknown[]) ?? [];
  const sources = (details.sources as { sourceUrl?: string }[]) ?? [];

  const doctors: DoctorDraft[] = doctorCandidates.map((dc) => {
    const d = (dc as Record<string, unknown>).extractedData as Record<string, unknown> ?? {};
    return {
      fullName: (d.fullName as string) ?? (dc as Record<string, unknown>).normalizedName as string ?? "",
      specialization: (d.specialization as string) ?? "",
      qualifications: (d.qualifications as string[]) ?? [],
      autoMatchId: null,
      autoMatchName: null,
      autoMatchConfidence: null,
      autoMatchReviewed: false,
      yearsOfExperience: (d.yearsOfExperience as number) ?? null,
      consultationFee: (d.consultationFee as number) ?? null,
      bio: (d.bio as string) ?? "",
      matchMode: "new",
      matchedDoctorId: null,
      matchedDoctorName: null,
    };
  });

  const packages: PackageDraft[] = packageCandidates.map((pc) => {
    const p = (pc as Record<string, unknown>).extractedData as Record<string, unknown> ?? {};
    return {
      packageName: (p.packageName as string) ?? (pc as Record<string, unknown>).packageName as string ?? "",
      department: (p.department as string) ?? "",
      priceMin: (p.priceMin as number) ?? null,
      priceMax: (p.priceMax as number) ?? null,
      include: true,
    };
  });

  return {
    rawType: (data.type as string) ?? "hospital",
    name: (data.name as string) ?? (cand.normalizedName as string) ?? "",
    type: (data.type as string) ?? "hospital",
    city: (data.city as string) ?? "",
    state: (data.state as string) ?? "",
    addressLine1: (data.addressLine1 as string) ?? (data.address as string) ?? "",
    phone: (data.phone as string) ?? "",
    email: (data.email as string) ?? "",
    website: (data.website as string) ?? "",
    description: (data.description as string) ?? "",
    specialties: (data.specialties as string[]) ?? [],
    facilities: (data.facilities as string[]) ?? [],
    accreditations: (data.accreditations as string[]) ?? [],
    matchMode: cand.mergeTargetId ? "existing" : "new",
    matchedHospitalId: (cand.mergeTargetId as string) ?? null,
    matchedHospitalName: null,
    doctors,
    packages,
    ...DOCTOR_BLANK,
    sourceUrls: uniqueUrls(sources.map(s => s.sourceUrl)),
    autoMatchId: null,
    autoMatchName: null,
    autoMatchConfidence: null,
    autoMatchReviewed: false,
    expanded: true,
    saveStatus: "idle",
    saveResult: null,
    saveError: null,
  };
}

// ─── TagInput ─────────────────────────────────────────────────────────────────

function TagInput({
  values,
  onChange,
  placeholder = "Add…",
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  function addTag() {
    const t = input.trim();
    if (!t || values.includes(t)) { setInput(""); return; }
    onChange([...values, t]);
    setInput("");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1 min-h-[26px]">
        {values.length === 0 && <span className="text-xs text-slate-400 italic">None</span>}
        {values.map(v => (
          <span key={v} className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded text-xs font-medium">
            {v}
            <button type="button" onClick={() => onChange(values.filter(x => x !== v))} className="text-teal-400 hover:text-teal-700">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
          placeholder={placeholder}
          className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-400"
        />
        <button type="button" onClick={addTag} className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded border border-slate-200 font-bold">+</button>
      </div>
    </div>
  );
}

// ─── HospitalMatchSelect ──────────────────────────────────────────────────────

function HospitalMatchSelect({
  draft,
  hospitals,
  onUpdate,
}: {
  draft: EntityDraft;
  hospitals: HospitalRow[];
  onUpdate: (patch: Partial<EntityDraft>) => void;
}) {
  const [q, setQ] = useState("");

  const filtered = q.length >= 2
    ? hospitals
        .filter(h =>
          h.name.toLowerCase().includes(q.toLowerCase()) ||
          (h.city ?? "").toLowerCase().includes(q.toLowerCase()),
        )
        .slice(0, 8)
    : [];

  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            className="accent-emerald-600"
            checked={draft.matchMode === "new"}
            onChange={() => onUpdate({ matchMode: "new", matchedHospitalId: null, matchedHospitalName: null })}
          />
          <span className="text-sm font-semibold text-emerald-700">Create New Hospital</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            className="accent-blue-600"
            checked={draft.matchMode === "existing"}
            onChange={() => onUpdate({ matchMode: "existing" })}
          />
          <span className="text-sm font-semibold text-blue-700">Update Existing Hospital</span>
        </label>
      </div>

      {draft.matchMode === "existing" && (
        <div className="relative">
          {draft.matchedHospitalId ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <span className="text-blue-500 shrink-0">✓</span>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-blue-800">{draft.matchedHospitalName}</span>
                <span className="text-blue-400 text-xs ml-2 font-mono">{draft.matchedHospitalId.slice(0, 8)}…</span>
              </div>
              <button
                type="button"
                onClick={() => { onUpdate({ matchedHospitalId: null, matchedHospitalName: null }); setQ(""); }}
                className="text-xs text-blue-400 hover:text-blue-700 shrink-0"
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search by name or city…"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {filtered.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                  {filtered.map(h => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        onUpdate({ matchedHospitalId: h.id, matchedHospitalName: h.name });
                        setQ("");
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm border-b border-slate-100 last:border-0"
                    >
                      <span className="font-medium text-slate-800">{h.name}</span>
                      {(h.city || h.state) && (
                        <span className="text-slate-400 text-xs ml-2">
                          {[h.city, h.state].filter(Boolean).join(", ")}
                        </span>
                      )}
                      {h.type && (
                        <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded font-medium uppercase">{h.type}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {q.length >= 2 && filtered.length === 0 && (
                <p className="mt-1.5 text-xs text-slate-400">No match found — switch to "Create New" or try a different name.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AutoMatchBanner ─────────────────────────────────────────────────────────
// Shown on cards when auto-match found a candidate. High-confidence (≥80%) are
// auto-applied and need confirmation; medium (55-79%) are suggestions only.

function AutoMatchBanner({
  matchName,
  confidence,
  onConfirm,
  onReject,
  onApply,
}: {
  matchName: string;
  confidence: number;
  onConfirm?: () => void;   // only when auto-applied
  onReject: () => void;
  onApply?: () => void;     // only when suggestion
}) {
  const pct = Math.round(confidence * 100);
  const isAutoApplied = confidence >= 0.80;

  if (isAutoApplied) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-sm">
        <span className="text-amber-500 shrink-0">⚡</span>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-amber-800">Auto-matched</span>
          <span className="text-amber-700 ml-1.5">→ <span className="font-medium truncate">{matchName}</span></span>
          <span className="ml-2 text-[11px] text-amber-500 font-mono">{pct}%</span>
        </div>
        <button type="button" onClick={onConfirm}
          className="px-3 py-1 text-[11px] bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors shrink-0">
          Confirm
        </button>
        <button type="button" onClick={onReject}
          className="px-3 py-1 text-[11px] border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shrink-0">
          Not this
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-sky-50 border-b border-sky-200 text-sm">
      <span className="text-sky-500 shrink-0">💡</span>
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-sky-800">Possible match</span>
        <span className="text-sky-700 ml-1.5"><span className="font-medium truncate">{matchName}</span></span>
        <span className="ml-2 text-[11px] text-sky-500 font-mono">{pct}%</span>
      </div>
      <button type="button" onClick={onApply}
        className="px-3 py-1 text-[11px] bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shrink-0">
        Use this
      </button>
      <button type="button" onClick={onReject}
        className="px-3 py-1 text-[11px] border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shrink-0">
        Dismiss
      </button>
    </div>
  );
}

// ─── DoctorRow ────────────────────────────────────────────────────────────────

function DoctorRow({
  doctor,
  city,
  index,
  onUpdate,
  onRemove,
}: {
  doctor: DoctorDraft;
  city: string;
  index: number;
  onUpdate: (patch: Partial<DoctorDraft>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; fullName: string; specialization: string | null; city: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 2) { setSearchResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ type: "doctor", q });
        if (city) params.set("city", city);
        const res = await fetch(`/api/admin/research/search?${params}`, { credentials: "include" });
        const data = await res.json() as { results: { id: string; fullName: string; specialization: string | null; city: string | null }[] };
        setSearchResults(data.results ?? []);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [city]);

  const modeColors = {
    existing: "bg-blue-600 text-white border-blue-600",
    new: "bg-emerald-600 text-white border-emerald-600",
    skip: "bg-slate-400 text-white border-slate-400",
  };

  return (
    <div className={`border rounded-xl overflow-hidden transition-opacity ${doctor.matchMode === "skip" ? "opacity-40" : ""}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50/80">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-slate-400 text-xs w-4 shrink-0"
          aria-label="toggle"
        >
          {expanded ? "▼" : "▶"}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">
            {doctor.fullName || <span className="italic text-slate-400">Unnamed</span>}
          </p>
          {doctor.specialization && (
            <p className="text-xs text-slate-400 truncate">{doctor.specialization}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {(["existing", "new", "skip"] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => onUpdate({ matchMode: m, matchedDoctorId: null, matchedDoctorName: null })}
              className={`px-2 py-0.5 text-[11px] rounded-md font-semibold border transition-colors ${
                doctor.matchMode === m ? modeColors[m] : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {m === "existing" ? "Match" : m === "new" ? "Create" : "Skip"}
            </button>
          ))}
        </div>
        <button type="button" onClick={onRemove} className="text-slate-300 hover:text-red-400 text-sm ml-1 shrink-0">✕</button>
      </div>

      {/* Auto-match banner */}
      {doctor.autoMatchConfidence !== null && !doctor.autoMatchReviewed && (
        <AutoMatchBanner
          matchName={doctor.autoMatchName ?? ""}
          confidence={doctor.autoMatchConfidence}
          onConfirm={() => onUpdate({ autoMatchReviewed: true })}
          onReject={() => onUpdate({
            matchMode: "new",
            matchedDoctorId: null,
            matchedDoctorName: null,
            autoMatchId: null,
            autoMatchName: null,
            autoMatchConfidence: null,
            autoMatchReviewed: true,
          })}
          onApply={() => onUpdate({
            matchMode: "existing",
            matchedDoctorId: doctor.autoMatchId!,
            matchedDoctorName: doctor.autoMatchName!,
            autoMatchReviewed: true,
          })}
        />
      )}

      {/* Match existing search */}
      {doctor.matchMode === "existing" && (
        <div className="px-3 py-2 bg-blue-50/60 border-t border-blue-100">
          {doctor.matchedDoctorId ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-500">✓</span>
              <span className="font-semibold text-blue-800">{doctor.matchedDoctorName}</span>
              <button
                type="button"
                onClick={() => { onUpdate({ matchedDoctorId: null, matchedDoctorName: null }); setSearchQ(""); setSearchResults([]); }}
                className="ml-auto text-xs text-blue-400 hover:text-blue-700"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={searchQ}
                onChange={e => { setSearchQ(e.target.value); search(e.target.value); }}
                placeholder="Search doctor name…"
                className="w-full px-2 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              />
              {searching && <span className="absolute right-2 top-2 text-xs text-slate-400 animate-pulse">…</span>}
              {searchResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                  {searchResults.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => { onUpdate({ matchedDoctorId: d.id, matchedDoctorName: d.fullName }); setSearchQ(""); setSearchResults([]); }}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-slate-100 last:border-0"
                    >
                      <span className="font-medium text-slate-800">{d.fullName}</span>
                      {d.specialization && <span className="text-slate-400 text-xs ml-1.5">· {d.specialization}</span>}
                      {d.city && <span className="text-slate-300 text-xs ml-1.5">· {d.city}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Expanded doctor fields */}
      {expanded && doctor.matchMode !== "skip" && (
        <div className="px-3 py-3 border-t border-slate-100 grid gap-2">
          {([
            ["fullName", "doctors.fullName"],
            ["specialization", "doctors.specialization"],
          ] as [keyof DoctorDraft, string][]).map(([field, dbCol]) => (
            <div key={field} className="grid grid-cols-[180px_1fr] gap-2 items-center">
              <label className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100 truncate">{dbCol}</label>
              <input
                value={doctor[field] as string}
                onChange={e => onUpdate({ [field]: e.target.value } as Partial<DoctorDraft>)}
                className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400"
              />
            </div>
          ))}
          <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
            <label className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100 truncate">doctors.bio</label>
            <textarea
              value={doctor.bio}
              onChange={e => onUpdate({ bio: e.target.value })}
              rows={2}
              className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400 resize-none"
            />
          </div>
          <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
            <label className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100 truncate">doctors.qualifications</label>
            <TagInput
              values={doctor.qualifications}
              onChange={v => onUpdate({ qualifications: v })}
              placeholder="MBBS, MD, DNB…"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid grid-cols-[110px_1fr] gap-2 items-center">
              <label className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100 truncate">yearsOfExperience</label>
              <input
                type="number"
                value={doctor.yearsOfExperience ?? ""}
                onChange={e => onUpdate({ yearsOfExperience: e.target.value ? parseInt(e.target.value) : null })}
                className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400"
              />
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2 items-center">
              <label className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100 truncate">consultationFee</label>
              <input
                type="number"
                value={doctor.consultationFee ?? ""}
                onChange={e => onUpdate({ consultationFee: e.target.value ? parseInt(e.target.value) : null })}
                className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DoctorEntityCard ────────────────────────────────────────────────────────
// Rendered when the AI returned a top-level entity with type "doctor".

const DOCTOR_DB_FIELDS: [keyof EntityDraft, string][] = [
  ["name",                    "doctors.fullName"],
  ["doctorSpecialization",    "doctors.specialization"],
  ["doctorBio",               "doctors.bio"],
  ["city",                    "doctors.city"],
  ["phone",                   "doctors.phone"],
];

function DoctorEntityCard({
  draft,
  index,
  hospitals,
  batchHospitals,
  onUpdate,
  onSave,
}: {
  draft: EntityDraft;
  index: number;
  hospitals: HospitalRow[];
  batchHospitals: { id: string; name: string; city?: string | null }[];
  onUpdate: (patch: Partial<EntityDraft>) => void;
  onSave: () => void;
}) {
  const isSaved = draft.saveStatus === "saved";
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [hospSearchQ, setHospSearchQ] = useState("");

  // Combined hospital list: batch hospitals first, then DB search results
  const dbFiltered = hospSearchQ.length >= 2
    ? hospitals
        .filter(h =>
          h.name.toLowerCase().includes(hospSearchQ.toLowerCase()) ||
          (h.city ?? "").toLowerCase().includes(hospSearchQ.toLowerCase()),
        )
        .slice(0, 6)
    : [];

  // Doctor match search
  const [docSearchQ, setDocSearchQ] = useState("");
  const [docResults, setDocResults] = useState<{ id: string; fullName: string; specialization: string | null; city: string | null }[]>([]);
  const [docSearching, setDocSearching] = useState(false);
  const docTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function searchDoctors(q: string) {
    if (docTimer.current) clearTimeout(docTimer.current);
    if (q.length < 2) { setDocResults([]); return; }
    docTimer.current = setTimeout(async () => {
      setDocSearching(true);
      try {
        const params = new URLSearchParams({ type: "doctor", q });
        if (draft.city) params.set("city", draft.city);
        const res = await fetch(`/api/admin/research/search?${params}`, { credentials: "include" });
        const data = await res.json() as { results: { id: string; fullName: string; specialization: string | null; city: string | null }[] };
        setDocResults(data.results ?? []);
      } finally { setDocSearching(false); }
    }, 300);
  }

  const modeColors: Record<string, string> = {
    existing: "bg-blue-600 text-white border-blue-600",
    new:      "bg-emerald-600 text-white border-emerald-600",
    skip:     "bg-slate-400 text-white border-slate-400",
  };

  return (
    <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all ${
      isSaved ? "border-emerald-300 ring-1 ring-emerald-200/60" : "border-indigo-200"
    }`}>
      {/* Header */}
      <div
        className={`flex items-center gap-3 px-5 py-4 cursor-pointer select-none ${isSaved ? "bg-emerald-50" : "bg-indigo-50/60"}`}
        onClick={() => !isSaved && onUpdate({ expanded: !draft.expanded })}
      >
        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-800 truncate">{draft.name || <span className="italic text-slate-400">Unnamed Doctor</span>}</p>
            <span className="shrink-0 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase tracking-wide">Doctor</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {draft.doctorSpecialization && <span>{draft.doctorSpecialization}</span>}
            {draft.city && <span className="ml-2">· {draft.city}</span>}
            {draft.linkedHospitalName && <span className="ml-2 text-teal-600">→ {draft.linkedHospitalName}</span>}
          </p>
        </div>
        {isSaved ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold shrink-0">
            ✓ {draft.saveResult?.doctorAction === "created" ? "Created" : "Updated"}
          </span>
        ) : (
          <span className="text-slate-300 text-sm shrink-0">{draft.expanded ? "▲" : "▼"}</span>
        )}
      </div>

      {/* Auto-match banner — always visible while unreviewed */}
      {!isSaved && draft.autoMatchConfidence !== null && !draft.autoMatchReviewed && (
        <AutoMatchBanner
          matchName={draft.autoMatchName ?? ""}
          confidence={draft.autoMatchConfidence}
          onConfirm={() => onUpdate({ autoMatchReviewed: true })}
          onReject={() => onUpdate({
            doctorMatchMode: "new",
            doctorMatchedDoctorId: null,
            doctorMatchedDoctorName: null,
            autoMatchId: null,
            autoMatchName: null,
            autoMatchConfidence: null,
            autoMatchReviewed: true,
          })}
          onApply={() => onUpdate({
            doctorMatchMode: "existing",
            doctorMatchedDoctorId: draft.autoMatchId!,
            doctorMatchedDoctorName: draft.autoMatchName!,
            autoMatchReviewed: true,
          })}
        />
      )}

      {draft.expanded && !isSaved && (
        <div className="divide-y divide-slate-100">

          {/* ── Doctor match / create / skip ── */}
          <div className="px-5 py-4">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Match or Create Doctor Record</h3>
            <div className="flex gap-3 mb-3">
              {(["existing", "new", "skip"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onUpdate({ doctorMatchMode: m, doctorMatchedDoctorId: null, doctorMatchedDoctorName: null })}
                  className={`px-3 py-1.5 text-xs rounded-lg font-semibold border transition-colors ${
                    draft.doctorMatchMode === m ? modeColors[m] : "bg-white text-slate-500 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {m === "existing" ? "Match Existing" : m === "new" ? "Create New" : "Skip"}
                </button>
              ))}
            </div>

            {draft.doctorMatchMode === "existing" && (
              <div className="relative">
                {draft.doctorMatchedDoctorId ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    <span className="text-blue-500">✓</span>
                    <span className="font-semibold text-blue-800 flex-1">{draft.doctorMatchedDoctorName}</span>
                    <button type="button" onClick={() => { onUpdate({ doctorMatchedDoctorId: null, doctorMatchedDoctorName: null }); setDocSearchQ(""); setDocResults([]); }}
                      className="text-xs text-blue-400 hover:text-blue-700">Change</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      value={docSearchQ}
                      onChange={e => { setDocSearchQ(e.target.value); searchDoctors(e.target.value); }}
                      placeholder="Search doctor name…"
                      className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    {docSearching && <span className="absolute right-3 top-2.5 text-xs text-slate-400 animate-pulse">…</span>}
                    {docResults.length > 0 && (
                      <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                        {docResults.map(d => (
                          <button key={d.id} type="button"
                            onClick={() => { onUpdate({ doctorMatchedDoctorId: d.id, doctorMatchedDoctorName: d.fullName }); setDocSearchQ(""); setDocResults([]); }}
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm border-b border-slate-100 last:border-0">
                            <span className="font-medium text-slate-800">{d.fullName}</span>
                            {d.specialization && <span className="text-slate-400 text-xs ml-2">· {d.specialization}</span>}
                            {d.city && <span className="text-slate-300 text-xs ml-2">· {d.city}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Doctor DB fields ── */}
          {draft.doctorMatchMode !== "skip" && (
            <div className="px-5 py-4">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Doctor Fields</h3>
              <div className="space-y-2">
                {DOCTOR_DB_FIELDS.map(([field, dbCol]) => (
                  <div key={field} className="grid grid-cols-[200px_1fr] gap-3 items-center">
                    <label className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1.5 rounded border border-slate-100 truncate">{dbCol}</label>
                    <input
                      value={draft[field] as string}
                      onChange={e => onUpdate({ [field]: e.target.value } as Partial<EntityDraft>)}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>
                ))}
                <div className="grid grid-cols-[200px_1fr] gap-3 items-start">
                  <label className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1.5 rounded border border-slate-100 truncate">doctors.qualifications</label>
                  <TagInput
                    values={draft.doctorQualifications}
                    onChange={v => onUpdate({ doctorQualifications: v })}
                    placeholder="MBBS, MD, DNB…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid grid-cols-[110px_1fr] gap-2 items-center">
                    <label className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1.5 rounded border border-slate-100 truncate">yearsOfExp</label>
                    <input type="number" value={draft.doctorYearsOfExperience ?? ""}
                      onChange={e => onUpdate({ doctorYearsOfExperience: e.target.value ? parseInt(e.target.value) : null })}
                      className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400" />
                  </div>
                  <div className="grid grid-cols-[110px_1fr] gap-2 items-center">
                    <label className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1.5 rounded border border-slate-100 truncate">consultFee</label>
                    <input type="number" value={draft.doctorConsultationFee ?? ""}
                      onChange={e => onUpdate({ doctorConsultationFee: e.target.value ? parseInt(e.target.value) : null })}
                      className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Link to hospital ── */}
          {draft.doctorMatchMode !== "skip" && (
            <div className="px-5 py-4">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                Link to Hospital <span className="font-normal normal-case text-slate-400">(creates doctorHospitalAffiliations record)</span>
              </h3>

              {draft.linkedHospitalId ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-sm">
                  <span className="text-teal-500">🏥</span>
                  <span className="font-semibold text-teal-800 flex-1">{draft.linkedHospitalName}</span>
                  <button type="button" onClick={() => { onUpdate({ linkedHospitalId: null, linkedHospitalName: null }); setHospSearchQ(""); }}
                    className="text-xs text-teal-400 hover:text-teal-700">Change</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Batch hospitals (from same research session) */}
                  {batchHospitals.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 font-medium mb-1">From this research session:</p>
                      <div className="flex flex-wrap gap-2">
                        {batchHospitals.map(h => (
                          <button key={h.id} type="button"
                            onClick={() => onUpdate({ linkedHospitalId: h.id, linkedHospitalName: h.name })}
                            className="px-3 py-1.5 text-xs bg-teal-50 border border-teal-200 text-teal-700 rounded-lg hover:bg-teal-100 font-medium transition-colors">
                            🏥 {h.name}{h.city ? ` · ${h.city}` : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Search existing */}
                  <div className="relative">
                    <input
                      value={hospSearchQ}
                      onChange={e => setHospSearchQ(e.target.value)}
                      placeholder="Or search existing hospitals…"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                    {dbFiltered.length > 0 && (
                      <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                        {dbFiltered.map(h => (
                          <button key={h.id} type="button"
                            onClick={() => { onUpdate({ linkedHospitalId: h.id, linkedHospitalName: h.name }); setHospSearchQ(""); }}
                            className="w-full text-left px-3 py-2.5 hover:bg-teal-50 text-sm border-b border-slate-100 last:border-0">
                            <span className="font-medium text-slate-800">{h.name}</span>
                            {(h.city || h.state) && <span className="text-slate-400 text-xs ml-2">{[h.city, h.state].filter(Boolean).join(", ")}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">Leave blank to save the doctor without a hospital affiliation.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Source references ── */}
          <div className="px-5 py-4">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Source References</h3>
            <div className="space-y-1.5">
              {draft.sourceUrls.length === 0 && <p className="text-xs text-slate-400 italic">None</p>}
              {draft.sourceUrls.map((url, ui) => (
                <div key={ui} className="flex items-center gap-2 group">
                  <span className="text-teal-500 text-xs shrink-0">🔗</span>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex-1 truncate">{url}</a>
                  <button type="button" onClick={() => onUpdate({ sourceUrls: draft.sourceUrls.filter((_, i) => i !== ui) })}
                    className="text-slate-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0">✕</button>
                </div>
              ))}
              <div className="flex gap-2 mt-1">
                <input value={newSourceUrl} onChange={e => setNewSourceUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (newSourceUrl.trim()) { onUpdate({ sourceUrls: [...draft.sourceUrls, newSourceUrl.trim()] }); setNewSourceUrl(""); } } }}
                  placeholder="Add source URL…"
                  className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400" />
                <button type="button" onClick={() => { if (newSourceUrl.trim()) { onUpdate({ sourceUrls: [...draft.sourceUrls, newSourceUrl.trim()] }); setNewSourceUrl(""); } }}
                  className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 font-bold">Add</button>
              </div>
            </div>
          </div>

          {/* ── Save bar ── */}
          <div className="px-5 py-4 bg-slate-50/60 flex items-center gap-4 flex-wrap">
            {draft.saveError && <p className="text-xs text-red-600">✕ {draft.saveError}</p>}
            <div className="flex-1" />
            <button type="button" onClick={onSave}
              disabled={draft.doctorMatchMode === "skip" || draft.saveStatus === "saving"}
              className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm">
              {draft.saveStatus === "saving"
                ? <><span className="animate-spin inline-block">⟳</span> Saving…</>
                : draft.doctorMatchMode === "existing" ? "Update Doctor" : draft.doctorMatchMode === "skip" ? "Skipped" : "Create Doctor"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EntityReviewCard ─────────────────────────────────────────────────────────

const DB_TEXT_FIELDS: [keyof EntityDraft, string, "text" | "textarea" | "select"][] = [
  ["name",         "hospitals.name",         "text"],
  ["city",         "hospitals.city",         "text"],
  ["state",        "hospitals.state",        "text"],
  ["addressLine1", "hospitals.addressLine1", "text"],
  ["phone",        "hospitals.phone",        "text"],
  ["email",        "hospitals.email",        "text"],
  ["website",      "hospitals.website",      "text"],
  ["description",  "hospitals.description",  "textarea"],
];

const HOSPITAL_TYPES = ["hospital", "clinic", "nursing_home", "diagnostic_center", "polyclinic", "wellness_center"];

function EntityReviewCard({
  draft,
  index,
  hospitals,
  batchHospitals,
  onUpdate,
  onSave,
}: {
  draft: EntityDraft;
  index: number;
  hospitals: HospitalRow[];
  batchHospitals: { id: string; name: string; city?: string | null }[];
  onUpdate: (patch: Partial<EntityDraft>) => void;
  onSave: () => void;
}) {
  // Delegate doctor-type entities to their own card
  if (draft.rawType === "doctor" || draft.rawType === "physician" || draft.rawType === "surgeon") {
    return (
      <DoctorEntityCard
        draft={draft}
        index={index}
        hospitals={hospitals}
        batchHospitals={batchHospitals}
        onUpdate={onUpdate}
        onSave={onSave}
      />
    );
  }

  const isSaved = draft.saveStatus === "saved";

  function updateDoctor(di: number, patch: Partial<DoctorDraft>) {
    onUpdate({ doctors: draft.doctors.map((d, i) => i === di ? { ...d, ...patch } : d) });
  }

  function addDoctor() {
    const blank: DoctorDraft = {
      fullName: "", specialization: "", qualifications: [], yearsOfExperience: null,
      consultationFee: null, bio: "", matchMode: "new", matchedDoctorId: null, matchedDoctorName: null,
      autoMatchId: null, autoMatchName: null, autoMatchConfidence: null, autoMatchReviewed: false,
    };
    onUpdate({ doctors: [...draft.doctors, blank] });
  }

  function addSourceUrl(url: string) {
    const trimmed = url.trim();
    if (trimmed && !draft.sourceUrls.includes(trimmed)) {
      onUpdate({ sourceUrls: [...draft.sourceUrls, trimmed] });
    }
  }

  const [newSourceUrl, setNewSourceUrl] = useState("");

  const saveable = draft.matchMode === "new" || (draft.matchMode === "existing" && !!draft.matchedHospitalId);
  const activeDoctors = draft.doctors.filter(d => d.matchMode !== "skip");

  return (
    <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all ${
      isSaved ? "border-emerald-300 ring-1 ring-emerald-200/60" : "border-slate-200"
    }`}>
      {/* Card header — always visible */}
      <div
        className={`flex items-center gap-3 px-5 py-4 cursor-pointer select-none ${isSaved ? "bg-emerald-50" : "bg-slate-50/60"}`}
        onClick={() => !isSaved && onUpdate({ expanded: !draft.expanded })}
      >
        <div className="w-8 h-8 rounded-full bg-teal-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 truncate">{draft.name || <span className="italic text-slate-400">Unnamed Entity</span>}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {[draft.city, draft.state].filter(Boolean).join(", ")}
            {draft.type && <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">{draft.type}</span>}
            {draft.doctors.length > 0 && <span className="ml-2">{draft.doctors.length} doctor{draft.doctors.length > 1 ? "s" : ""}</span>}
            {draft.packages.length > 0 && <span className="ml-2">{draft.packages.filter(p => p.include).length} package{draft.packages.filter(p => p.include).length > 1 ? "s" : ""}</span>}
          </p>
        </div>
        {isSaved ? (
          <div className="text-right shrink-0">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
              ✓ {draft.saveResult?.hospitalAction === "created" ? "Created" : "Updated"}
            </span>
            <p className="text-xs text-emerald-500 mt-0.5">
              {draft.saveResult?.doctorsCreated ? `+${draft.saveResult.doctorsCreated} doctors  ` : ""}
              {draft.saveResult?.doctorsUpdated ? `↑${draft.saveResult.doctorsUpdated} updated` : ""}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              draft.matchMode === "existing" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
            }`}>
              {draft.matchMode === "existing"
                ? (draft.matchedHospitalId ? `Update: ${draft.matchedHospitalName?.slice(0, 20)}` : "Update (unset)")
                : "Create New"}
            </span>
            <span className="text-slate-300 text-sm">{draft.expanded ? "▲" : "▼"}</span>
          </div>
        )}
      </div>

      {/* Auto-match banner — always visible while unreviewed */}
      {!isSaved && draft.autoMatchConfidence !== null && !draft.autoMatchReviewed && (
        <AutoMatchBanner
          matchName={draft.autoMatchName ?? ""}
          confidence={draft.autoMatchConfidence}
          onConfirm={() => onUpdate({ autoMatchReviewed: true })}
          onReject={() => onUpdate({
            matchMode: "new",
            matchedHospitalId: null,
            matchedHospitalName: null,
            autoMatchId: null,
            autoMatchName: null,
            autoMatchConfidence: null,
            autoMatchReviewed: true,
          })}
          onApply={() => onUpdate({
            matchMode: "existing",
            matchedHospitalId: draft.autoMatchId!,
            matchedHospitalName: draft.autoMatchName!,
            autoMatchReviewed: true,
          })}
        />
      )}

      {/* Expandable body */}
      {draft.expanded && !isSaved && (
        <div className="divide-y divide-slate-100">

          {/* ── Section 1: Hospital match ── */}
          <div className="px-5 py-4">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Match or Create</h3>
            <HospitalMatchSelect draft={draft} hospitals={hospitals} onUpdate={onUpdate} />
          </div>

          {/* ── Section 2: Hospital DB fields ── */}
          <div className="px-5 py-4">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Hospital Fields</h3>
            <div className="space-y-2">
              {/* Type select */}
              <div className="grid grid-cols-[200px_1fr] gap-3 items-center">
                <label className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1.5 rounded border border-slate-100 truncate">hospitals.type</label>
                <select
                  value={draft.type}
                  onChange={e => onUpdate({ type: e.target.value })}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                >
                  {HOSPITAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Text / textarea fields */}
              {DB_TEXT_FIELDS.map(([field, dbCol, inputType]) => (
                <div key={field} className="grid grid-cols-[200px_1fr] gap-3 items-start">
                  <label className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1.5 rounded border border-slate-100 truncate mt-0.5">{dbCol}</label>
                  {inputType === "textarea" ? (
                    <textarea
                      value={draft[field] as string}
                      onChange={e => onUpdate({ [field]: e.target.value } as Partial<EntityDraft>)}
                      rows={3}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none w-full"
                    />
                  ) : (
                    <input
                      value={draft[field] as string}
                      onChange={e => onUpdate({ [field]: e.target.value } as Partial<EntityDraft>)}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 w-full"
                    />
                  )}
                </div>
              ))}

              {/* Array fields */}
              {([
                ["specialties",    "hospitals.specialties",    "Add specialty…"],
                ["facilities",     "hospitals.facilities",     "Add facility…"],
                ["accreditations", "hospitals.accreditations", "Add accreditation…"],
              ] as [keyof EntityDraft, string, string][]).map(([field, dbCol, ph]) => (
                <div key={field} className="grid grid-cols-[200px_1fr] gap-3 items-start">
                  <label className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1.5 rounded border border-slate-100 truncate mt-0.5">{dbCol}</label>
                  <TagInput
                    values={draft[field] as string[]}
                    onChange={v => onUpdate({ [field]: v } as Partial<EntityDraft>)}
                    placeholder={ph}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Section 3: Packages ── */}
          {draft.packages.length > 0 && (
            <div className="px-5 py-4">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                Packages <span className="font-normal normal-case">({draft.packages.filter(p => p.include).length} of {draft.packages.length} included)</span>
              </h3>
              <div className="space-y-1.5">
                {draft.packages.map((pkg, pi) => (
                  <div
                    key={pi}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm transition-opacity ${
                      pkg.include ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={pkg.include}
                      onChange={e => onUpdate({ packages: draft.packages.map((p, i) => i === pi ? { ...p, include: e.target.checked } : p) })}
                      className="accent-teal-600 shrink-0"
                    />
                    <span className="flex-1 font-medium text-slate-700 truncate">{pkg.packageName}</span>
                    {pkg.department && <span className="text-slate-400 text-xs shrink-0">{pkg.department}</span>}
                    {(pkg.priceMin != null || pkg.priceMax != null) && (
                      <span className="text-teal-600 text-xs font-mono shrink-0">
                        ₹{pkg.priceMin ?? "?"} – ₹{pkg.priceMax ?? "?"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Section 4: Doctors ── */}
          <div className="px-5 py-4">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Doctors <span className="font-normal normal-case">({activeDoctors.length} of {draft.doctors.length} active · linked to this hospital)</span>
            </h3>
            <div className="space-y-2">
              {draft.doctors.map((doc, di) => (
                <DoctorRow
                  key={di}
                  doctor={doc}
                  city={draft.city}
                  index={di}
                  onUpdate={patch => updateDoctor(di, patch)}
                  onRemove={() => onUpdate({ doctors: draft.doctors.filter((_, i) => i !== di) })}
                />
              ))}
              <button
                type="button"
                onClick={addDoctor}
                className="w-full px-3 py-2 text-sm text-slate-400 border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 hover:text-slate-600 transition-colors"
              >
                + Add Doctor
              </button>
            </div>
          </div>

          {/* ── Section 5: Source references ── */}
          <div className="px-5 py-4">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Source References <span className="font-normal normal-case">(saved as provenance in DB)</span>
            </h3>
            <div className="space-y-1.5">
              {draft.sourceUrls.length === 0 && (
                <p className="text-xs text-slate-400 italic">No source URLs yet.</p>
              )}
              {draft.sourceUrls.map((url, ui) => (
                <div key={ui} className="flex items-center gap-2 group">
                  <span className="text-teal-500 shrink-0 text-xs">🔗</span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex-1 truncate"
                  >
                    {url}
                  </a>
                  <button
                    type="button"
                    onClick={() => onUpdate({ sourceUrls: draft.sourceUrls.filter((_, i) => i !== ui) })}
                    className="text-slate-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <input
                  value={newSourceUrl}
                  onChange={e => setNewSourceUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSourceUrl(newSourceUrl); setNewSourceUrl(""); } }}
                  placeholder="Add source URL…"
                  className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
                <button
                  type="button"
                  onClick={() => { addSourceUrl(newSourceUrl); setNewSourceUrl(""); }}
                  className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 font-bold"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* ── Save bar ── */}
          <div className="px-5 py-4 bg-slate-50/60 flex items-center gap-4 flex-wrap">
            {!saveable && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                ⚠ Select an existing hospital to update, or switch to "Create New".
              </p>
            )}
            {draft.saveError && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                ✕ {draft.saveError}
              </p>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onSave}
              disabled={!saveable || draft.saveStatus === "saving"}
              className="px-6 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
            >
              {draft.saveStatus === "saving" ? (
                <><span className="animate-spin inline-block">⟳</span> Saving…</>
              ) : draft.matchMode === "existing" ? (
                "Update Hospital"
              ) : (
                "Create Hospital"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ResearchWorkspace ───────────────────────────────────────────────────

export function ResearchWorkspace({
  hospitals,
}: {
  hospitals: HospitalRow[];
}) {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [query, setQuery] = useState("");
  const [batchText, setBatchText] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"input" | "review">("input");
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [groundedSummary, setGroundedSummary] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<EntityDraft[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ total: number; done: number; failed: number } | null>(null);
  const [batchPolling, setBatchPolling] = useState(false);

  function updateDraft(index: number, patch: Partial<EntityDraft>) {
    setDrafts(prev => prev.map((d, i) => i === index ? { ...d, ...patch } : d));
  }

  function appendDraft(draft: EntityDraft) {
    setDrafts(prev => [...prev, draft]);
  }

  // Runs in background after drafts are set — patches each card with the best DB match.
  async function runAutoMatch(initialDrafts: EntityDraft[]) {
    const matchEntity = async (draft: EntityDraft, i: number) => {
      const isDocEntity = draft.rawType === "doctor" || draft.rawType === "physician" || draft.rawType === "surgeon";
      const params = new URLSearchParams({
        type: isDocEntity ? "doctor" : "hospital",
        name: draft.name,
      });
      if (draft.city) params.set("city", draft.city);
      if (isDocEntity) {
        if (draft.doctorSpecialization) params.set("specialization", draft.doctorSpecialization);
        if (draft.phone) params.set("phone", draft.phone);
      } else {
        if (draft.website) params.set("website", draft.website);
        if (draft.phone) params.set("phone", draft.phone);
      }

      try {
        const res = await fetch(`/api/admin/research/match?${params}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json() as { matches: MatchCandidate[] };
        const top = data.matches?.[0];
        if (!top) return;

        if (top.confidence >= 0.80) {
          if (isDocEntity) {
            updateDraft(i, {
              doctorMatchMode: "existing",
              doctorMatchedDoctorId: top.id,
              doctorMatchedDoctorName: top.name,
              autoMatchId: top.id,
              autoMatchName: top.name,
              autoMatchConfidence: top.confidence,
              autoMatchReviewed: false,
            });
          } else {
            updateDraft(i, {
              matchMode: "existing",
              matchedHospitalId: top.id,
              matchedHospitalName: top.name,
              autoMatchId: top.id,
              autoMatchName: top.name,
              autoMatchConfidence: top.confidence,
              autoMatchReviewed: false,
            });
          }
        } else if (top.confidence >= 0.55) {
          updateDraft(i, {
            autoMatchId: top.id,
            autoMatchName: top.name,
            autoMatchConfidence: top.confidence,
            autoMatchReviewed: false,
          });
        }
      } catch { /* skip */ }
    };

    const matchDoctorsInDraft = async (draft: EntityDraft, draftIndex: number) => {
      if (!draft.doctors.length) return;
      await Promise.all(draft.doctors.map(async (doc, di) => {
        if (!doc.fullName) return;
        const dParams = new URLSearchParams({ type: "doctor", name: doc.fullName });
        if (draft.city) dParams.set("city", draft.city);
        if (doc.specialization) dParams.set("specialization", doc.specialization);
        try {
          const res = await fetch(`/api/admin/research/match?${dParams}`, { credentials: "include" });
          if (!res.ok) return;
          const data = await res.json() as { matches: MatchCandidate[] };
          const top = data.matches?.[0];
          if (!top) return;

          setDrafts(prev => prev.map((d, idx) => {
            if (idx !== draftIndex) return d;
            return {
              ...d,
              doctors: d.doctors.map((doc2, dIdx) => {
                if (dIdx !== di) return doc2;
                if (top.confidence >= 0.80) {
                  return {
                    ...doc2,
                    matchMode: "existing" as const,
                    matchedDoctorId: top.id,
                    matchedDoctorName: top.name,
                    autoMatchId: top.id,
                    autoMatchName: top.name,
                    autoMatchConfidence: top.confidence,
                    autoMatchReviewed: false,
                  };
                } else if (top.confidence >= 0.55) {
                  return {
                    ...doc2,
                    autoMatchId: top.id,
                    autoMatchName: top.name,
                    autoMatchConfidence: top.confidence,
                    autoMatchReviewed: false,
                  };
                }
                return doc2;
              }),
            };
          }));
        } catch { /* skip */ }
      }));
    };

    // Entity-level matching runs first; doctor-level matching runs concurrently.
    await Promise.all([
      ...initialDrafts.map((draft, i) => matchEntity(draft, i)),
      ...initialDrafts.map((draft, i) => matchDoctorsInDraft(draft, i)),
    ]);
  }

  async function runResearch() {
    if (mode === "single" && !query.trim()) return;
    if (mode === "batch" && !batchText.trim()) return;
    setBusy(true);
    setGlobalError(null);
    setDrafts([]);
    setGroundedSummary(null);
    setBatchProgress(null);
    setPhase("review");

    try {
      if (mode === "single") {
        const res = await fetch("/api/admin/research/agent", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query.trim(), city: city.trim() || undefined }),
        });
        const json = await res.json() as { data?: { entities?: AgentEntity[]; groundedSummary?: string }; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Research failed");
        const entities: AgentEntity[] = (json.data?.entities ?? []).filter(isUsableEntity);
        setGroundedSummary(json.data?.groundedSummary ?? null);
        const newDrafts = entities.map(entityFromAgent);
        setDrafts(newDrafts);
        void runAutoMatch(newDrafts);
      } else {
        const names = batchText.split("\n").map(s => s.trim()).filter(Boolean);
        const createRes = await fetch("/api/admin/research/batch", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ names, city: city.trim() || undefined }),
        });
        const createJson = await createRes.json() as { batchId?: string; total?: number; error?: string };
        if (!createRes.ok) throw new Error(createJson.error ?? "Failed to create batch");
        const batchId = createJson.batchId!;
        const total = createJson.total ?? names.length;
        setBatchProgress({ total, done: 0, failed: 0 });
        setBatchPolling(true);

        // Poll until done
        let done = 0;
        let failed = 0;
        while (true) {
          const procRes = await fetch("/api/admin/research/batch/process", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ batchId, size: 3 }),
          });
          const procJson = await procRes.json() as {
            items?: BatchItem[];
            batchStatus?: string;
            remaining?: number;
            error?: string;
          };
          if (!procRes.ok) break;

          const items: BatchItem[] = procJson.items ?? [];
          done += items.filter(i => i.status === "done").length;
          failed += items.filter(i => i.status === "failed").length;
          setBatchProgress(prev => prev ? { ...prev, done, failed } : { total, done, failed });

          // Fetch details for completed items and append EntityDraft cards
          for (const item of items) {
            if (item.status === "done" && item.jobId) {
              try {
                const jobRes = await fetch(`/api/admin/ingestion/jobs?jobId=${item.jobId}`, { credentials: "include" });
                const jobJson = await jobRes.json() as Record<string, unknown>;
                const draft = entityFromJobDetails(jobJson);
                if (draft) appendDraft(draft);
              } catch { /* skip failed fetches */ }
            }
          }

          if (procJson.batchStatus === "done" || procJson.batchStatus === "partial_failure" || !procJson.remaining) break;
          await new Promise(r => setTimeout(r, 1500));
        }
        setBatchPolling(false);
      }
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Research failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveEntity(index: number) {
    const draft = drafts[index];
    updateDraft(index, { saveStatus: "saving", saveError: null });

    try {
      // ── Doctor entity: save via doctor-save + optional link-doctors ──────────
      const isDocEntity = draft.rawType === "doctor" || draft.rawType === "physician" || draft.rawType === "surgeon";
      if (isDocEntity) {
        if (draft.doctorMatchMode === "skip") {
          updateDraft(index, { saveStatus: "saved", expanded: false, saveResult: { doctorsCreated: 0, doctorsUpdated: 0 } });
          return;
        }

        const savePayload: Record<string, unknown> = {
          fullName: draft.name,
          specialization: draft.doctorSpecialization || undefined,
          city: draft.city || undefined,
          phone: draft.phone || undefined,
          bio: draft.doctorBio || undefined,
          qualifications: draft.doctorQualifications.length ? draft.doctorQualifications : undefined,
          yearsOfExperience: draft.doctorYearsOfExperience ?? undefined,
          consultationFee: draft.doctorConsultationFee ?? undefined,
          sourceUrls: draft.sourceUrls,  // send full array so all sources are recorded
        };
        if (draft.doctorMatchMode === "existing" && draft.doctorMatchedDoctorId) {
          savePayload.existingDoctorId = draft.doctorMatchedDoctorId;
        }

        const saveRes = await fetch("/api/admin/research/doctor-save", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(savePayload),
        });
        const saveData = await saveRes.json() as { doctorId?: string; action?: string; error?: string };
        if (!saveRes.ok) throw new Error(saveData.error ?? "Doctor save failed");

        const doctorId = saveData.doctorId!;

        // Link to hospital if one was selected
        if (draft.linkedHospitalId) {
          await fetch("/api/admin/research/link-doctors", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hospitalId: draft.linkedHospitalId, doctorIds: [doctorId] }),
          });
        }

        updateDraft(index, {
          saveStatus: "saved",
          expanded: false,
          saveResult: {
            doctorId,
            doctorAction: saveData.action,
            doctorsCreated: saveData.action === "created" ? 1 : 0,
            doctorsUpdated: saveData.action === "updated" ? 1 : 0,
          },
        });
        return;
      }

      // ── Hospital entity: save via brochure/apply ──────────────────────────
      const doctorIdOverrides: Record<string, string> = {};
      const doctorsToSave = draft.doctors
        .filter(d => d.matchMode !== "skip")
        .map(d => {
          if (d.matchMode === "existing" && d.matchedDoctorId) {
            doctorIdOverrides[d.fullName] = d.matchedDoctorId;
          }
          return {
            fullName: d.fullName,
            specialization: d.specialization || undefined,
            qualifications: d.qualifications.length ? d.qualifications : undefined,
            yearsOfExperience: d.yearsOfExperience ?? undefined,
            consultationFee: d.consultationFee ?? undefined,
            bio: d.bio || undefined,
          };
        });

      const payload: Record<string, unknown> = {
        hospital: {
          name: draft.name,
          type: draft.type || undefined,
          city: draft.city || undefined,
          state: draft.state || undefined,
          addressLine1: draft.addressLine1 || undefined,
          phone: draft.phone || undefined,
          email: draft.email || undefined,
          website: draft.website || undefined,
          description: draft.description || undefined,
          specialties: draft.specialties.length ? draft.specialties : undefined,
          facilities: draft.facilities.length ? draft.facilities : undefined,
          accreditations: draft.accreditations.length ? draft.accreditations : undefined,
        },
        doctors: doctorsToSave,
        packages: draft.packages.filter(p => p.include).map(p => ({
          packageName: p.packageName,
          department: p.department || undefined,
          priceMin: p.priceMin ?? undefined,
          priceMax: p.priceMax ?? undefined,
        })),
        sourceUrls: draft.sourceUrls,
      };

      if (draft.matchMode === "existing" && draft.matchedHospitalId) {
        payload.targetHospitalId = draft.matchedHospitalId;
      } else {
        payload.forceCreate = true;
      }
      if (Object.keys(doctorIdOverrides).length) {
        payload.doctorIdOverrides = doctorIdOverrides;
      }

      const res = await fetch("/api/admin/research/brochure/apply", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as {
        data?: { hospitalId: string; hospitalAction: string; doctorsCreated: number; doctorsUpdated: number };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      updateDraft(index, {
        saveStatus: "saved",
        expanded: false,
        saveResult: {
          hospitalId: data.data!.hospitalId,
          hospitalAction: data.data!.hospitalAction,
          doctorsCreated: data.data!.doctorsCreated ?? 0,
          doctorsUpdated: data.data!.doctorsUpdated ?? 0,
        },
      });
    } catch (e) {
      updateDraft(index, {
        saveStatus: "error",
        saveError: e instanceof Error ? e.message : "Save failed",
      });
    }
  }

  function resetSearch() {
    setPhase("input");
    setDrafts([]);
    setGlobalError(null);
    setGroundedSummary(null);
    setBatchProgress(null);
    setBatchPolling(false);
  }

  const savedCount = drafts.filter(d => d.saveStatus === "saved").length;
  const allSaved = drafts.length > 0 && savedCount === drafts.length;
  const pendingReviewCount = drafts.filter(d =>
    (d.autoMatchConfidence !== null && !d.autoMatchReviewed) ||
    d.doctors.some(doc => doc.autoMatchConfidence !== null && !doc.autoMatchReviewed)
  ).length;

  return (
    <div className="space-y-5">
      {/* ── Header card with query form ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
          <h2 className="text-xl font-bold text-slate-800">AI Research</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Discover hospitals and doctors via AI web research. Review every field, match to existing records, and save with full source tracking.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            {(["single", "batch"] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); resetSearch(); }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  mode === m ? "bg-teal-600 text-white border-teal-600" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {m === "single" ? "Single Query" : "Batch Names"}
              </button>
            ))}
          </div>

          {/* Inputs */}
          <div className={`grid gap-3 ${mode === "single" ? "grid-cols-[1fr_200px]" : "grid-cols-[1fr_200px]"}`}>
            {mode === "single" ? (
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && void runResearch()}
                placeholder="e.g. top cardiac hospitals in Mumbai, best orthopaedic surgeons Delhi…"
                className="px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            ) : (
              <textarea
                value={batchText}
                onChange={e => setBatchText(e.target.value)}
                placeholder={"One hospital or doctor name per line:\nApollo Hospital Mumbai\nFortis Gurgaon\nDr. Naresh Trehan"}
                rows={4}
                className="px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
              />
            )}
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="City (optional)"
              className="px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 self-start"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => void runResearch()}
              disabled={busy || (mode === "single" ? !query.trim() : !batchText.trim())}
              className="px-6 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
            >
              {busy ? <><span className="animate-spin inline-block">⟳</span> Researching…</> : "🔍 Run AI Research"}
            </button>
            {phase === "review" && (
              <button
                type="button"
                onClick={resetSearch}
                className="px-4 py-2.5 border border-slate-300 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
              >
                ← New Search
              </button>
            )}
            {globalError && (
              <p className="text-sm text-red-600 flex items-center gap-1">⚠ {globalError}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Batch progress bar ── */}
      {batchProgress && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 text-sm">Batch Processing</h3>
            <span className="text-sm text-slate-500">
              {batchProgress.done} / {batchProgress.total} complete
              {batchProgress.failed > 0 && <span className="text-red-500 ml-2">· {batchProgress.failed} failed</span>}
            </span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all duration-700"
              style={{ width: `${batchProgress.total > 0 ? (batchProgress.done / batchProgress.total) * 100 : 0}%` }}
            />
          </div>
          {batchPolling && (
            <p className="text-xs text-slate-400 mt-2 animate-pulse">
              Processing… review cards appear below as items complete
            </p>
          )}
        </div>
      )}

      {/* ── AI summary ── */}
      {groundedSummary && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-teal-700 uppercase tracking-wider mb-2">AI Research Summary</h3>
          <p className="text-sm text-teal-900 whitespace-pre-wrap leading-relaxed">
            {groundedSummary.length > 900 ? groundedSummary.slice(0, 900) + "…" : groundedSummary}
          </p>
        </div>
      )}

      {/* ── Entity review cards ── */}
      {drafts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 flex-wrap gap-2">
            <p className="text-sm font-semibold text-slate-600">
              {drafts.length} {drafts.length === 1 ? "entity" : "entities"} found
              {savedCount > 0 && (
                <span className="ml-2 text-emerald-600">· {savedCount} saved</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {pendingReviewCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full border border-amber-200">
                  ⚡ {pendingReviewCount} auto-matched — review needed
                </span>
              )}
              {allSaved && (
                <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1">
                  ✓ All entities saved
                </span>
              )}
            </div>
          </div>

          {(() => {
            // Hospitals saved or pending in this session — available for doctor-entity linking
            const batchHospitals = drafts
              .filter(d => d.rawType !== "doctor" && d.rawType !== "physician" && d.rawType !== "surgeon")
              .filter(d => d.saveResult?.hospitalId || d.matchedHospitalId)
              .map(d => ({
                id: (d.saveResult?.hospitalId ?? d.matchedHospitalId)!,
                name: d.name,
                city: d.city || null,
              }));

            return drafts.map((draft, i) => (
              <EntityReviewCard
                key={i}
                draft={draft}
                index={i}
                hospitals={hospitals}
                batchHospitals={batchHospitals}
                onUpdate={patch => updateDraft(i, patch)}
                onSave={() => void saveEntity(i)}
              />
            ));
          })()}
        </div>
      )}

      {/* ── Empty state ── */}
      {phase === "review" && drafts.length === 0 && !busy && !batchPolling && !globalError && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-5xl mb-4">🔍</p>
          <p className="font-semibold text-slate-500">No entities found</p>
          <p className="text-sm mt-1">Try a more specific query or add a city filter</p>
        </div>
      )}
    </div>
  );
}
