"use client";

import React, { FormEvent, useMemo, useRef, useState } from "react";

import {
  DOCTOR_BLANK,
  EntityDraft,
  EntityReviewCard,
  HospitalRow,
  MatchCandidate,
  entityFromJobDetails,
  uniqueUrls,
} from "@/app/admin/research/ResearchWorkspace";

// ── Local types ───────────────────────────────────────────────────────────────

type DiscoveryResult = {
  title: string;
  link: string;
  snippet: string;
  suggestedAction: "scrape_website" | "import_google_profile";
};

type ResearchQueueRow = {
  id: string;
  query: string;
  sourceTitle: string | null;
  sourceUrl: string;
  queueStatus: string;
  nextAction: string;
  linkedJobId: string | null;
};

// ── Specialty picker ──────────────────────────────────────────────────────────

const SPECIALTY_LIST = [
  "Anaesthesiology", "Bariatric Surgery", "Cardiology", "Cardiothoracic Surgery",
  "Colorectal Surgery", "Dental & Oral Surgery", "Dermatology", "ENT (Ear, Nose & Throat)",
  "Emergency Medicine", "Endocrinology", "Gastroenterology", "General Medicine & Internal Medicine",
  "General Surgery", "Geriatrics", "Gynaecology & Obstetrics", "Haematology",
  "Hepatology", "Immunology & Allergy", "Neonatology", "Nephrology",
  "Neurology", "Neurosurgery", "Nutrition & Dietetics", "Oncology",
  "Ophthalmology", "Orthopaedics", "Paediatric Surgery", "Paediatrics",
  "Palliative Care", "Plastic & Reconstructive Surgery", "Psychiatry", "Pulmonology",
  "Radiology & Imaging", "Reproductive Medicine & IVF", "Rheumatology",
  "Spine Surgery", "Sports Medicine", "Transplant Medicine", "Urology", "Vascular Surgery",
] as const;

function SpecialtyPicker({
  onSelect,
  onSelectAll,
}: {
  onSelect: (name: string) => void;
  onSelectAll?: (names: readonly string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 hover:bg-slate-50 font-medium transition-colors"
      >
        + Specialty
      </button>
      {open && (
        <div className="absolute z-50 left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-3 max-h-72 overflow-y-auto">
          {onSelectAll && (
            <button
              type="button"
              onClick={() => { onSelectAll(SPECIALTY_LIST); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 rounded mb-1"
            >
              + All Specialties
            </button>
          )}
          {SPECIALTY_LIST.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => { onSelect(s); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Multi-draft builder from job details ──────────────────────────────────────
// For multi-location jobs, create one EntityDraft per hospital candidate.
// The first candidate gets all doctors + packages (via entityFromJobDetails).
// Additional candidates get empty doctor/package lists.

function entityArrayFromJobDetails(data: Record<string, unknown>): EntityDraft[] {
  const candidates = (data.hospitalCandidates as unknown[]) ?? [];
  if (!candidates.length) return [];

  const results: EntityDraft[] = [];

  // First candidate: full conversion with doctors + packages
  const first = entityFromJobDetails(data);
  if (first) results.push(first);

  // Additional hospital candidates (multi-location chain)
  const sources = (data.sources as Array<{ sourceUrl?: string }>) ?? [];
  const sourceUrlList = uniqueUrls(sources.map(s => s.sourceUrl));

  for (let i = 1; i < candidates.length; i++) {
    const cand = candidates[i] as Record<string, unknown>;

    results.push({
      rawType: (cand.type as string) ?? "hospital",
      name: (cand.name as string) ?? "",
      type: (cand.type as string) === "clinic" ? "clinic" : (cand.type as string) === "nursing_home" ? "nursing_home" : "hospital",
      city: (cand.city as string) ?? "",
      state: (cand.state as string) ?? "",
      addressLine1: (cand.addressLine1 as string) ?? "",
      phone: (cand.phone as string) ?? "",
      email: (cand.email as string) ?? "",
      website: (cand.website as string) ?? "",
      description: (cand.description as string) ?? "",
      specialties: (cand.specialties as string[]) ?? [],
      facilities: (cand.keyFacilities as string[]) ?? [],
      accreditations: [],
      matchMode: cand.matchHospitalId ? "existing" : "new",
      matchedHospitalId: (cand.matchHospitalId as string) ?? null,
      matchedHospitalName: (cand.matchHospitalName as string) ?? null,
      doctors: [],
      packages: [],
      ...DOCTOR_BLANK,
      sourceUrls: sourceUrlList,
      autoMatchId: null,
      autoMatchName: null,
      autoMatchConfidence: null,
      autoMatchReviewed: false,
      expanded: true,
      saveStatus: "idle",
      saveResult: null,
      saveError: null,
    });
  }

  return results;
}

// ── ScraperWorkspace ──────────────────────────────────────────────────────────

export function ScraperWorkspace({ hospitals }: { hospitals: HospitalRow[] }) {
  // ── Scraper form ────────────────────────────────────────────────────────────
  const [sourceUrl, setSourceUrl] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [city, setCity] = useState("");
  const [specialtyQuery, setSpecialtyQuery] = useState("");
  const [targetHospitalId, setTargetHospitalId] = useState("");
  const [jobIdInput, setJobIdInput] = useState("");

  // ── Progress / status ───────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false);
  const [progressTask, setProgressTask] = useState<string | null>(null);
  const [progressPct, setProgressPct] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  // ── Discovery ───────────────────────────────────────────────────────────────
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult[]>([]);
  const [selectedLinks, setSelectedLinks] = useState<string[]>([]);
  const [researchQueue, setResearchQueue] = useState<ResearchQueueRow[]>([]);

  const selectedDiscoveryRows = useMemo(
    () => discoveryResults.filter(r => selectedLinks.includes(r.link)),
    [discoveryResults, selectedLinks],
  );

  // ── Drafts ──────────────────────────────────────────────────────────────────
  const [drafts, setDrafts] = useState<EntityDraft[]>([]);
  const reviewRef = useRef<HTMLDivElement | null>(null);

  function updateDraft(index: number, patch: Partial<EntityDraft>) {
    setDrafts(prev => prev.map((d, i) => i === index ? { ...d, ...patch } : d));
  }

  // ── Auto-match (mirrors ResearchWorkspace logic) ────────────────────────────
  async function runAutoMatch(initialDrafts: EntityDraft[]) {
    const matchEntity = async (draft: EntityDraft, idx: number) => {
      const isDoc = draft.rawType === "doctor" || draft.rawType === "physician" || draft.rawType === "surgeon";
      const params = new URLSearchParams({ type: isDoc ? "doctor" : "hospital", name: draft.name });
      if (draft.city) params.set("city", draft.city);
      if (isDoc) {
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
          updateDraft(idx, isDoc ? {
            doctorMatchMode: "existing", doctorMatchedDoctorId: top.id, doctorMatchedDoctorName: top.name,
            autoMatchId: top.id, autoMatchName: top.name, autoMatchConfidence: top.confidence, autoMatchReviewed: false,
          } : {
            matchMode: "existing", matchedHospitalId: top.id, matchedHospitalName: top.name,
            autoMatchId: top.id, autoMatchName: top.name, autoMatchConfidence: top.confidence, autoMatchReviewed: false,
          });
        } else if (top.confidence >= 0.55) {
          updateDraft(idx, { autoMatchId: top.id, autoMatchName: top.name, autoMatchConfidence: top.confidence, autoMatchReviewed: false });
        }
      } catch { /* skip */ }
    };

    const matchDoctors = async (draft: EntityDraft, draftIdx: number) => {
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
            if (idx !== draftIdx) return d;
            return {
              ...d,
              doctors: d.doctors.map((doc2, dIdx) => {
                if (dIdx !== di) return doc2;
                if (top.confidence >= 0.80) {
                  return { ...doc2, matchMode: "existing" as const, matchedDoctorId: top.id, matchedDoctorName: top.name, autoMatchId: top.id, autoMatchName: top.name, autoMatchConfidence: top.confidence, autoMatchReviewed: false };
                } else if (top.confidence >= 0.55) {
                  return { ...doc2, autoMatchId: top.id, autoMatchName: top.name, autoMatchConfidence: top.confidence, autoMatchReviewed: false };
                }
                return doc2;
              }),
            };
          }));
        } catch { /* skip */ }
      }));
    };

    await Promise.all([
      ...initialDrafts.map((draft, i) => matchEntity(draft, i)),
      ...initialDrafts.map((draft, i) => matchDoctors(draft, i)),
    ]);
  }

  // ── Save entity (mirrors ResearchWorkspace saveEntity) ──────────────────────
  async function saveEntity(index: number) {
    const draft = drafts[index];
    updateDraft(index, { saveStatus: "saving", saveError: null });

    try {
      const isDoc = draft.rawType === "doctor" || draft.rawType === "physician" || draft.rawType === "surgeon";

      if (isDoc) {
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
          sourceUrls: draft.sourceUrls,
        };
        if (draft.doctorMatchMode === "existing" && draft.doctorMatchedDoctorId) {
          savePayload.existingDoctorId = draft.doctorMatchedDoctorId;
        }
        const saveRes = await fetch("/api/admin/research/doctor-save", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(savePayload),
        });
        const saveData = await saveRes.json() as { data?: { action?: string; doctorId?: string }; error?: string };
        if (!saveRes.ok) throw new Error(saveData.error ?? "Doctor save failed");
        const doctorId = saveData.data?.doctorId ?? "";
        const action = saveData.data?.action;
        if (draft.linkedHospitalId) {
          await fetch("/api/admin/research/link-doctors", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hospitalId: draft.linkedHospitalId, doctorIds: [doctorId] }),
          });
        }
        updateDraft(index, {
          saveStatus: "saved", expanded: false,
          saveResult: { doctorId, doctorAction: action, doctorsCreated: action === "created" ? 1 : 0, doctorsUpdated: action === "updated" ? 1 : 0 },
        });
        return;
      }

      // Hospital entity — via brochure/apply
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
          name: draft.name, type: draft.type || undefined,
          city: draft.city || undefined, state: draft.state || undefined,
          addressLine1: draft.addressLine1 || undefined,
          phone: draft.phone || undefined, email: draft.email || undefined,
          website: draft.website || undefined, description: draft.description || undefined,
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
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as {
        data?: { hospitalId: string; hospitalAction: string; doctorsCreated: number; doctorsUpdated: number };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      updateDraft(index, {
        saveStatus: "saved", expanded: false,
        saveResult: {
          hospitalId: data.data!.hospitalId,
          hospitalAction: data.data!.hospitalAction,
          doctorsCreated: data.data!.doctorsCreated ?? 0,
          doctorsUpdated: data.data!.doctorsUpdated ?? 0,
        },
      });
    } catch (e) {
      updateDraft(index, { saveStatus: "error", saveError: e instanceof Error ? e.message : "Save failed" });
    }
  }

  // ── Run ingestion ────────────────────────────────────────────────────────────
  async function onRunIngestion(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setIsError(false);
    setProgressTask("Starting scraping…");
    setProgressPct(0);
    setDrafts([]);

    let pollInterval: ReturnType<typeof setInterval> | undefined;
    try {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch("/api/admin/ingestion/jobs");
          const body = await res.json() as {
            data?: { jobs?: Array<{ status: string; summary?: { currentTask?: string; percent?: number } }> };
          };
          const latestJob = body.data?.jobs?.[0];
          if (latestJob && ["collecting_sources", "fetching", "extracting_data", "extracting"].includes(latestJob.status)) {
            setProgressTask(latestJob.summary?.currentTask ?? "Processing…");
            setProgressPct(latestJob.summary?.percent ?? 0);
          }
        } catch { /* ignore poll errors */ }
      }, 2500);

      const response = await fetch("/api/admin/ingestion/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl,
          hospitalName: hospitalName || undefined,
          city: city || undefined,
          searchQuery: specialtyQuery || undefined,
          targetHospitalId: targetHospitalId || undefined,
        }),
      });
      const body = await response.json() as { data?: { jobId: string }; error?: string; message?: string };
      if (!response.ok || !body.data) throw new Error(body.message ?? body.error ?? "Scraping failed.");

      clearInterval(pollInterval);
      const jobId = body.data.jobId;
      setJobIdInput(jobId);
      setMessage(`Scraping completed. Job: ${jobId}`);
      await loadAndConvertJob(jobId, true);
    } catch (e: unknown) {
      if (pollInterval) clearInterval(pollInterval);
      setMessage(e instanceof Error ? e.message : "Scraping failed.");
      setIsError(true);
    } finally {
      setBusy(false);
      setProgressTask(null);
      setProgressPct(0);
    }
  }

  // ── Load job and convert to EntityDraft[] ────────────────────────────────────
  async function loadAndConvertJob(jobId: string, scrollToReview = false) {
    try {
      const response = await fetch(`/api/admin/ingestion/jobs?jobId=${encodeURIComponent(jobId)}`);
      const body = await response.json() as { data?: Record<string, unknown>; error?: string };
      if (!response.ok || !body.data) {
        setMessage(body.error ?? "Unable to load job details.");
        setIsError(true);
        return;
      }
      const newDrafts = entityArrayFromJobDetails(body.data);
      setDrafts(newDrafts);
      if (newDrafts.length > 0) {
        void runAutoMatch(newDrafts);
        if (scrollToReview) {
          setTimeout(() => {
            reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 150);
        }
      } else {
        setMessage("No hospital data found in this job.");
        setIsError(false);
      }
    } catch {
      setMessage("Unable to load job details.");
      setIsError(true);
    }
  }

  // ── Discovery helpers ────────────────────────────────────────────────────────
  async function loadDiscovery() {
    if (!discoveryQuery.trim()) { setMessage("Enter a discovery query."); setIsError(false); return; }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/ingestion/discovery?q=${encodeURIComponent(discoveryQuery.trim())}`);
      const body = await response.json() as { data?: { results?: DiscoveryResult[] }; error?: string };
      if (!response.ok) { setMessage(body.error ?? "Discovery failed."); setIsError(true); return; }
      const rows = body.data?.results ?? [];
      setDiscoveryResults(rows);
      setSelectedLinks(rows.slice(0, 5).map(r => r.link));
      setMessage(`Loaded ${rows.length} discovery results.`);
      setIsError(false);
    } catch { setMessage("Discovery request failed."); setIsError(true); }
    finally { setBusy(false); }
  }

  async function queueSelectedDiscovery() {
    if (!selectedDiscoveryRows.length) { setMessage("Select at least one result to queue."); setIsError(false); return; }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/ingestion/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: discoveryQuery,
          selectedResults: selectedDiscoveryRows.map(r => ({ title: r.title, link: r.link })),
        }),
      });
      const body = await response.json() as { data?: { queued: number }; error?: string };
      if (!response.ok || !body.data) { setMessage(body.error ?? "Queue creation failed."); setIsError(true); return; }
      setMessage(`Queued ${body.data.queued} research tasks.`);
      setIsError(false);
      await loadResearchQueue();
    } catch { setMessage("Queue creation failed."); setIsError(true); }
    finally { setBusy(false); }
  }

  async function loadResearchQueue() {
    try {
      const response = await fetch("/api/admin/ingestion/research-queue");
      const body = await response.json() as { data?: { rows?: ResearchQueueRow[] }; error?: string };
      if (!response.ok) { setMessage(body.error ?? "Unable to load queue."); setIsError(true); return; }
      setResearchQueue(body.data?.rows ?? []);
    } catch { setMessage("Unable to load queue."); setIsError(true); }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const savedCount = drafts.filter(d => d.saveStatus === "saved").length;
  const allSaved = drafts.length > 0 && savedCount === drafts.length;
  const pendingReviewCount = drafts.filter(d =>
    (d.autoMatchConfidence !== null && !d.autoMatchReviewed) ||
    d.doctors.some(doc => doc.autoMatchConfidence !== null && !doc.autoMatchReviewed)
  ).length;

  return (
    <div className="space-y-5">

      {/* ── Scraper form ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
          <h2 className="text-xl font-bold text-slate-800">Smart AI Data Scraper</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Enter a hospital website or Google Maps link. Extracted data is reviewed field-by-field
            with DB mapping, doctor matching, and full source provenance.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <form onSubmit={e => void onRunIngestion(e)} className="space-y-3">
            <input
              value={sourceUrl}
              onChange={e => setSourceUrl(e.target.value)}
              placeholder="https://hospital-website.com  or  Google Maps Profile URL"
              required
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none text-slate-700 text-sm"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                value={hospitalName}
                onChange={e => setHospitalName(e.target.value)}
                placeholder="Hospital name context (optional)"
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-400 outline-none text-sm"
              />
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="City context (optional)"
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-400 outline-none text-sm"
              />
              <div className="flex gap-2">
                <input
                  value={specialtyQuery}
                  onChange={e => setSpecialtyQuery(e.target.value)}
                  placeholder="Specialties (optional)"
                  className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-400 outline-none text-sm"
                />
                <SpecialtyPicker
                  onSelect={s => setSpecialtyQuery(q => q ? `${q}, ${s}` : s)}
                  onSelectAll={all => setSpecialtyQuery(all.join(", "))}
                />
              </div>
            </div>
            <input
              value={targetHospitalId}
              onChange={e => setTargetHospitalId(e.target.value)}
              placeholder="Target Hospital ID — if updating an existing hospital (optional)"
              className="w-full px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-400 outline-none text-sm placeholder:text-indigo-400 text-indigo-800"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="submit"
                disabled={busy || !sourceUrl.trim()}
                className="px-6 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-colors"
              >
                {busy
                  ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Scraping…</>
                  : "Scrape Now / Regenerate"}
              </button>
              {message && (
                <p className={`text-sm font-medium px-3 py-1.5 rounded-lg border flex-1 ${
                  isError
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-teal-50 text-teal-700 border-teal-100"
                }`}>
                  {message}
                </p>
              )}
            </div>
          </form>

          {/* Load by job ID */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[260px] space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Load job by ID</label>
              <div className="flex gap-2">
                <input
                  value={jobIdInput}
                  onChange={e => setJobIdInput(e.target.value)}
                  placeholder="Enter job ID…"
                  className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-400 outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={() => void loadAndConvertJob(jobIdInput.trim(), true)}
                  disabled={busy || !jobIdInput.trim()}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium rounded-xl transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
                >
                  Load
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Progress bar ── */}
      {busy && progressTask && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700">{progressTask}</p>
            <span className="text-xs text-slate-400 font-mono">{progressPct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Discovery Queue ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
          <h2 className="text-lg font-bold text-slate-800">Google Search Research Queue</h2>
          <p className="text-sm text-slate-500 mt-0.5">Discover and queue hospitals from Google Search for scraping.</p>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <SpecialtyPicker
              onSelect={s => setDiscoveryQuery(q => q ? `${q} ${s}` : `Best ${s} clinics in India`)}
              onSelectAll={all => setDiscoveryQuery(`Best hospitals covering ${all.slice(0, 10).join(", ")} and more in India`)}
            />
            <input
              value={discoveryQuery}
              onChange={e => setDiscoveryQuery(e.target.value)}
              placeholder="e.g., Best Orthopedic Clinics in Mumbai"
              className="flex-1 min-w-[260px] px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-400 outline-none text-sm"
            />
            <button
              type="button"
              onClick={() => void loadDiscovery()}
              disabled={busy}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl border border-slate-200 transition-colors text-sm disabled:opacity-50"
            >
              Search Google
            </button>
            <button
              type="button"
              onClick={() => void queueSelectedDiscovery()}
              disabled={busy || !selectedDiscoveryRows.length}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-sm transition-colors text-sm disabled:opacity-50"
            >
              Create Queue from Selected
            </button>
            <button
              type="button"
              onClick={() => void loadResearchQueue()}
              disabled={busy}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl border border-slate-200 transition-colors text-sm disabled:opacity-50"
            >
              View Queue Tasks
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Discovery results */}
            <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl shadow-inner">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                Discovery Results
              </h3>
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {discoveryResults.length === 0 && (
                  <p className="text-sm text-slate-400 italic">Search Google to load results.</p>
                )}
                {discoveryResults.map(item => (
                  <label
                    key={item.link}
                    className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-teal-400 hover:shadow-sm transition-all"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 w-4 h-4 accent-teal-600 shrink-0"
                      checked={selectedLinks.includes(item.link)}
                      onChange={e =>
                        setSelectedLinks(prev =>
                          e.target.checked ? [...prev, item.link] : prev.filter(l => l !== item.link)
                        )
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm line-clamp-2">{item.title}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 font-mono text-xs rounded border border-indigo-100">
                        {item.suggestedAction.replace(/_/g, " ")}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Task queue */}
            <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl shadow-inner">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                Task Queue
              </h3>
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {researchQueue.length === 0 && (
                  <p className="text-sm text-slate-400 italic">Queue is currently empty.</p>
                )}
                {researchQueue.map(row => (
                  <div key={row.id} className="p-3 bg-white border border-slate-200 rounded-xl">
                    <p className="font-semibold text-slate-800 text-sm truncate">{row.sourceTitle ?? row.sourceUrl}</p>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-mono text-xs rounded border border-slate-200">
                        {row.nextAction}
                      </span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono text-xs rounded border border-blue-200">
                        {row.queueStatus}
                      </span>
                      {row.linkedJobId && (
                        <button
                          type="button"
                          onClick={() => { setJobIdInput(row.linkedJobId!); void loadAndConvertJob(row.linkedJobId!, true); }}
                          className="px-2 py-0.5 bg-teal-50 text-teal-700 font-mono text-xs rounded border border-teal-200 hover:bg-teal-100 transition-colors"
                        >
                          Load →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Entity review cards ── */}
      {drafts.length > 0 && (
        <div ref={reviewRef} className="space-y-4 pt-2">
          <div className="flex items-center justify-between px-1 flex-wrap gap-2">
            <p className="text-sm font-semibold text-slate-600">
              {drafts.length} {drafts.length === 1 ? "entity" : "entities"} extracted
              {savedCount > 0 && <span className="ml-2 text-emerald-600">· {savedCount} saved</span>}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
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
              <button
                type="button"
                onClick={() => { setDrafts([]); setMessage(null); }}
                className="px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {(() => {
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

      {/* ── Empty state after scrape completes ── */}
      {drafts.length === 0 && !busy && message && !isError && (
        <div className="text-center py-12 text-slate-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-semibold text-slate-500">No data extracted from this URL</p>
          <p className="text-sm mt-1">Try adding more context: hospital name, city, or specific specialties</p>
        </div>
      )}
    </div>
  );
}
