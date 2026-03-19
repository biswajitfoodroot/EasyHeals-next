"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminPatientsTab } from "./AdminPatientsTab";
import { AdminAppointmentsTab } from "./AdminAppointmentsTab";
import { AdminProvidersTab } from "./AdminProvidersTab";
import KycReviewTabContent from "./KycReviewTabContent";

type Me = { fullName: string; email: string; role: string };
type Hospital = {
  id: string;
  name: string;
  city: string;
  state: string | null;
  phone: string | null;
  email: string | null;
  slug: string;
  isActive: boolean;
};
type TaxonomyNode = {
  id: string;
  title: string;
  type: string;
  slug: string;
  isActive: boolean;
  description: string | null;
};

type Props = {
  me: Me;
  hospitals: Hospital[];
  nodes: TaxonomyNode[];
};

type IngestionJob = {
  id: string;
  status: string;
  sourceUrl: string;
  searchQuery: string | null;
  targetCity: string | null;
  summary: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: string | null;
};

type CandidateStatus = "draft" | "approved" | "rejected" | "deleted" | "applied" | "pending" | "skipped";

type IngestionDetails = {
  job: IngestionJob;
  sources: Array<{ id: string; sourceType: string; title: string | null; sourceUrl: string | null; snippet: string | null }>;
  hospitalCandidates: Array<{
    id: string;
    name: string;
    city: string | null;
    website?: string | null;
    mergeAction: string;
    matchHospitalId: string | null;
    matchHospitalName?: string;
    specialties: string[];
    services: string[];
    outlierFlags: string[];
    aiConfidence: number | null;
    applyStatus: CandidateStatus;
    reviewStatus: CandidateStatus;
  }>;
  doctorCandidates: Array<{
    id: string;
    fullName: string;
    specialization: string | null;
    qualifications?: string[];
    yearsOfExperience?: number;
    consultationFee: number | null;
    consultationDays?: string[];
    opdTiming?: string;
    mergeAction: string;
    matchDoctorId: string | null;
    matchDoctorName?: string;
    outlierFlags: string[];
    aiConfidence: number | null;
    applyStatus: CandidateStatus;
    reviewStatus: CandidateStatus;
  }>;
  serviceCandidates: Array<{
    id: string;
    serviceName: string;
    category: string | null;
    outlierFlags: string[];
    applyStatus: CandidateStatus;
    reviewStatus: CandidateStatus;
  }>;
  packageCandidates: Array<{
    id: string;
    packageName: string;
    department: string | null;
    priceMin: number | null;
    priceMax: number | null;
    outlierFlags: string[];
    applyStatus: CandidateStatus;
    reviewStatus: CandidateStatus;
  }>;
  fieldConfidences: Array<{
    id: string;
    entityType: string;
    fieldKey: string;
    confidence: number;
    sourceType: string | null;
    sourceUrl: string | null;
    extractedValue: string | null;
  }>;
};

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

type Tab = "ingestion" | "hospitals" | "taxonomy" | "ai_research" | "brochure" | "contributions" | "config" | "patients" | "appointments" | "providers" | "kyc";

type BrochureDiff = {
  dryRun: true;
  hospitalId: string;
  hospitalSlug: string;
  hospitalAction: "created" | "updated";
  hospital: {
    addedSpecialties: string[];
    dupSpecialties: string[];
    addedFacilities: string[];
    dupFacilities: string[];
    addedAccreditations: string[];
    dupAccreditations: string[];
    fieldFills: Array<{ field: string; value: string }>;
  };
  doctors: {
    new: Array<{ fullName: string; specialization: string | null }>;
    existing: Array<{ id: string; fullName: string }>;
  };
  packages: {
    new: Array<{ packageName: string; department: string | null; priceMin: number | null; priceMax: number | null }>;
    existing: Array<{ id: string; packageName: string }>;
  };
};

export default function AdminDashboardClient({ me, hospitals: initialHospitals, nodes: initialNodes }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const validTabs: Tab[] = ["ingestion", "hospitals", "taxonomy", "ai_research", "brochure", "contributions", "kyc", "config", "patients", "appointments", "providers"];
  // Feature flags state (Task 3.5)
  const [configFlags, setConfigFlags] = React.useState<Array<{ key: string; phase: string; enabled: boolean; description: string | null; complianceChecklist: string[] }>>([]);
  const [configLoading, setConfigLoading] = React.useState(false);
  const [configMsg, setConfigMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [togglingKey, setTogglingKey] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam && validTabs.includes(tabParam) ? tabParam : "ingestion"
  );
  const [error, setError] = useState<string | null>(null);

  // Sync tab when URL search param changes
  useEffect(() => {
    if (tabParam && validTabs.includes(tabParam)) setActiveTab(tabParam);
  }, [tabParam]);

  // ── Hospital Management ─────────────────────────────────────────────────────
  const [hospitalList, setHospitalList] = useState<Hospital[]>(initialHospitals);
  const [hospitalSearch, setHospitalSearch] = useState("");
  const [hospitalCityFilter, setHospitalCityFilter] = useState("");
  const [hospitalStatusFilter, setHospitalStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editingHospitalId, setEditingHospitalId] = useState<string | null>(null);
  const [editHospitalDraft, setEditHospitalDraft] = useState<Record<string, string | boolean>>({});
  const [hospitalMgmtBusy, setHospitalMgmtBusy] = useState(false);
  const [hospitalMgmtMsg, setHospitalMgmtMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedHospitalIds, setSelectedHospitalIds] = useState<string[]>([]);

  // ── Quick Create Hospital ───────────────────────────────────────────────────
  const [newHospName, setNewHospName] = useState("");
  const [newHospCity, setNewHospCity] = useState("");
  const [newHospState, setNewHospState] = useState("");
  const [newHospPhone, setNewHospPhone] = useState("");
  const [newHospEmail, setNewHospEmail] = useState("");
  const [createHospBusy, setCreateHospBusy] = useState(false);
  const [createHospMsg, setCreateHospMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ── Quick Create Taxonomy ───────────────────────────────────────────────────
  const [nodeType, setNodeType] = useState("specialty");
  const [nodeTitle, setNodeTitle] = useState("");
  const [nodeDescription, setNodeDescription] = useState("");
  const [createTaxoBusy, setCreateTaxoBusy] = useState(false);
  const [createTaxoMsg, setCreateTaxoMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ── Ingestion ───────────────────────────────────────────────────────────────
  const [sourceUrl, setSourceUrl] = useState("");
  const [ingestionHospitalName, setIngestionHospitalName] = useState("");
  const [ingestionCity, setIngestionCity] = useState("");
  const [ingestionQuery, setIngestionQuery] = useState("");
  const [targetHospitalId, setTargetHospitalId] = useState("");
  const [jobIdInput, setJobIdInput] = useState("");
  const [ingestionBusy, setIngestionBusy] = useState(false);
  const [ingestionProgressTask, setIngestionProgressTask] = useState<string | null>(null);
  const [ingestionProgressPercent, setIngestionProgressPercent] = useState(0);
  const [ingestionMessage, setIngestionMessage] = useState<string | null>(null);
  const [recentJobs, setRecentJobs] = useState<IngestionJob[]>([]);
  const [details, setDetails] = useState<IngestionDetails | null>(null);

  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult[]>([]);
  const [selectedDiscoveryLinks, setSelectedDiscoveryLinks] = useState<string[]>([]);
  const [researchQueue, setResearchQueue] = useState<ResearchQueueRow[]>([]);

  // ── AI Research Agent ───────────────────────────────────────────────────────
  const [agentQuery, setAgentQuery] = useState("");
  const [agentCity, setAgentCity] = useState("");
  const [agentAutoQueue, setAgentAutoQueue] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentResult, setAgentResult] = useState<{
    query: string;
    groundedSummary: string;
    entities: Array<{
      name: string;
      type: string;
      city: string | null;
      website: string | null;
      phone: string | null;
      snippet: string;
      sourceUrl: string | null;
    }>;
    queuedCount: number;
    queuedItems: Array<{ id: string; sourceUrl: string; sourceTitle: string | null }>;
  } | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  // AI research save
  const [agentBatchBusy, setAgentBatchBusy] = useState(false);
  const [agentBatchResult, setAgentBatchResult] = useState<{
    saved: {
      hospitals: Array<{ action: "created" | "updated"; name: string; id: string; slug: string }>;
      doctors: Array<{ action: "created" | "updated"; name: string; id: string; slug: string; linkedHospital: string | null }>;
    };
    ambiguous: Array<{
      name: string;
      city: string;
      candidates: Array<{ id: string; name: string; slug: string; city: string; state: string | null; phone: string | null; isActive: boolean }>;
    }>;
    errors: string[];
  } | null>(null);
  const [agentBatchError, setAgentBatchError] = useState<string | null>(null);
  
  // Hospital search for ambiguous matches
  const [ambiguousSearchQueries, setAmbiguousSearchQueries] = useState<Record<string, string>>({});
  const [ambiguousSearchResults, setAmbiguousSearchResults] = useState<Record<string, Array<{ id: string; name: string; slug: string; city: string; state: string | null; phone: string | null; isActive: boolean }>>>({});
  const [ambiguousSearchLoading, setAmbiguousSearchLoading] = useState<Record<string, boolean>>({});

  // ── Brochure Extractor ──────────────────────────────────────────────────────
  const [brochureText, setBrochureText] = useState("");
  const [brochureSourceHint, setBrochureSourceHint] = useState("");
  const [brochureCityHint, setBrochureCityHint] = useState("");
  const [brochureBusy, setBrochureBusy] = useState(false);
  const [brochureResult, setBrochureResult] = useState<Record<string, unknown> | null>(null);
  const [brochureError, setBrochureError] = useState<string | null>(null);
  const [brochureApplyBusy, setBrochureApplyBusy] = useState(false);
  const [brochureApplyResult, setBrochureApplyResult] = useState<{
    hospitalId: string;
    hospitalSlug: string;
    hospitalAction: "created" | "updated";
    doctorsCreated: number;
    doctorsUpdated: number;
    packagesUpserted: number;
  } | null>(null);
  const [brochureApplyError, setBrochureApplyError] = useState<string | null>(null);
  const [brochureCandidates, setBrochureCandidates] = useState<Array<{
    id: string;
    name: string;
    slug: string;
    city: string;
    state: string | null;
    phone: string | null;
    isActive: boolean;
  }> | null>(null);
  const [brochureCandidateMeta, setBrochureCandidateMeta] = useState<{ extractedName: string; extractedCity: string } | null>(null);
  // Hospital search picker (manual selection before saving)
  const [brochureTargetHospital, setBrochureTargetHospital] = useState<{ id: string; name: string; city: string; slug: string } | null>(null);
  const [brochureHospitalSearch, setBrochureHospitalSearch] = useState("");
  const [brochureHospitalSearchResults, setBrochureHospitalSearchResults] = useState<Array<{ id: string; name: string; city: string; state: string | null; slug: string }>>([]);
  const [brochureHospitalSearchBusy, setBrochureHospitalSearchBusy] = useState(false);
  // File scan mode
  const [brochureInputMode, setBrochureInputMode] = useState<"text" | "file">("text");
  const [brochureFile, setBrochureFile] = useState<File | null>(null);
  const [brochureFilePreview, setBrochureFilePreview] = useState<string | null>(null);
  const [brochureFileDragging, setBrochureFileDragging] = useState(false);
  // Preview / confirmation
  const [brochureDiff, setBrochureDiff] = useState<BrochureDiff | null>(null);
  const [brochureConfirmOpen, setBrochureConfirmOpen] = useState(false);
  const [brochurePendingArgs, setBrochurePendingArgs] = useState<Record<string, unknown>>({});
  const [brochurePendingPayload, setBrochurePendingPayload] = useState<Record<string, unknown> | null>(null);
  // AI research save state
  const [agentSavingIdx, setAgentSavingIdx] = useState<number | null>(null);
  const [agentSaveResults, setAgentSaveResults] = useState<Record<number, { ok: boolean; text: string }>>({});

  // Edit Mode state (for ingestion review)
  const [editModeId, setEditModeId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, any>>({});

  const selectedDiscoveryRows = useMemo(
    () => discoveryResults.filter((item) => selectedDiscoveryLinks.includes(item.link)),
    [discoveryResults, selectedDiscoveryLinks],
  );

  // ── Derived hospital data ───────────────────────────────────────────────────
  const filteredHospitals = useMemo(() => {
    return hospitalList.filter((h) => {
      const q = hospitalSearch.toLowerCase();
      const matchSearch =
        !q ||
        h.name.toLowerCase().includes(q) ||
        (h.city ?? "").toLowerCase().includes(q) ||
        (h.state ?? "").toLowerCase().includes(q) ||
        h.id.toLowerCase().includes(q);
      const matchCity = !hospitalCityFilter || h.city === hospitalCityFilter;
      const matchStatus =
        hospitalStatusFilter === "all" ||
        (hospitalStatusFilter === "active" ? h.isActive : !h.isActive);
      return matchSearch && matchCity && matchStatus;
    });
  }, [hospitalList, hospitalSearch, hospitalCityFilter, hospitalStatusFilter]);

  const allFilteredSelected = filteredHospitals.length > 0 && filteredHospitals.every(h => selectedHospitalIds.includes(h.id));

  function toggleSelectAllHospitals() {
    if (allFilteredSelected) {
      const idsToRemove = filteredHospitals.map(h => h.id);
      setSelectedHospitalIds(prev => prev.filter(id => !idsToRemove.includes(id)));
    } else {
      const idsToAdd = filteredHospitals.map(h => h.id).filter(id => !selectedHospitalIds.includes(id));
      setSelectedHospitalIds(prev => [...prev, ...idsToAdd]);
    }
  }

  function toggleHospitalSelection(id: string) {
    setSelectedHospitalIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handlePopulateData() {
    const selectedNames = hospitalList
      .filter(h => selectedHospitalIds.includes(h.id))
      .map(h => h.name)
      .join(", ");
    
    if (!selectedNames) return;
    
    setAgentQuery(`Find service details, packages, and doctor list of (cardiology, general surgeon, oncology, gastro, neurology, etc) for: ${selectedNames}`);
    setActiveTab("ai_research");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const uniqueCities = useMemo(
    () => [...new Set(hospitalList.map((h) => h.city).filter(Boolean))].sort() as string[],
    [hospitalList],
  );

  const hospitalStats = useMemo(() => {
    const active = hospitalList.filter((h) => h.isActive).length;
    return { total: hospitalList.length, active, inactive: hospitalList.length - active };
  }, [hospitalList]);

  const slugPreview = useMemo(
    () =>
      nodeTitle
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    [nodeTitle],
  );

  // ── Hospital Management Actions ─────────────────────────────────────────────
  async function onSaveHospital(hospitalId: string) {
    setHospitalMgmtBusy(true);
    setHospitalMgmtMsg(null);
    const res = await fetch(`/api/hospitals/${hospitalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editHospitalDraft),
    });
    setHospitalMgmtBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setHospitalMgmtMsg({ type: "error", text: body.error ?? "Failed to update hospital" });
      return;
    }
    setHospitalList((prev) => prev.map((item) => item.id === hospitalId ? { ...item, ...editHospitalDraft } as Hospital : item));
    setEditingHospitalId(null);
    setEditHospitalDraft({});
    setHospitalMgmtMsg({ type: "success", text: "Hospital updated." });
    setTimeout(() => setHospitalMgmtMsg(null), 3000);
  }

  async function onToggleHospitalActive(h: Hospital) {
    const action = h.isActive ? "Deactivate" : "Reactivate";
    if (!globalThis.confirm(`${action} "${h.name}"?`)) return;
    setHospitalMgmtBusy(true);
    const res = await fetch(`/api/hospitals/${h.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !h.isActive }),
    });
    setHospitalMgmtBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setHospitalMgmtMsg({ type: "error", text: body.error ?? "Failed to update" });
      return;
    }
    setHospitalList((prev) => prev.map((item) => item.id === h.id ? { ...item, isActive: !h.isActive } : item));
    setHospitalMgmtMsg({ type: "success", text: `"${h.name}" ${h.isActive ? "deactivated" : "reactivated"}.` });
    setTimeout(() => setHospitalMgmtMsg(null), 3000);
  }

  async function onDeleteHospital(h: Hospital) {
    if (!globalThis.confirm(`Permanently delete "${h.name}"? This cannot be undone.`)) return;
    setHospitalMgmtBusy(true);
    const res = await fetch(`/api/hospitals/${h.id}`, { method: "DELETE" });
    setHospitalMgmtBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setHospitalMgmtMsg({ type: "error", text: body.error ?? "Failed to delete hospital" });
      return;
    }
    setHospitalList((prev) => prev.filter((item) => item.id !== h.id));
    setHospitalMgmtMsg({ type: "success", text: `"${h.name}" deleted.` });
    setTimeout(() => setHospitalMgmtMsg(null), 3000);
  }

  // ── Quick Create Hospital ───────────────────────────────────────────────────
  async function onCreateHospital(event: FormEvent) {
    event.preventDefault();
    setCreateHospBusy(true);
    setCreateHospMsg(null);

    const res = await fetch("/api/hospitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newHospName,
        city: newHospCity,
        state: newHospState || undefined,
        phone: newHospPhone || undefined,
        email: newHospEmail || undefined,
      }),
    });

    setCreateHospBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setCreateHospMsg({ type: "error", text: body.error ?? "Failed to create hospital" });
      return;
    }

    const body = await res.json();
    if (body.data) {
      setHospitalList((prev) => [body.data as Hospital, ...prev]);
    }
    setCreateHospMsg({ type: "success", text: `"${body.data?.name}" created successfully!` });
    setNewHospName("");
    setNewHospCity("");
    setNewHospState("");
    setNewHospPhone("");
    setNewHospEmail("");
    setTimeout(() => setCreateHospMsg(null), 5000);
  }

  // ── Quick Create Taxonomy ───────────────────────────────────────────────────
  async function onCreateTaxonomy(event: FormEvent) {
    event.preventDefault();
    setCreateTaxoBusy(true);
    setCreateTaxoMsg(null);

    const res = await fetch("/api/taxonomy/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: nodeType,
        title: nodeTitle,
        description: nodeDescription || undefined,
      }),
    });

    setCreateTaxoBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setCreateTaxoMsg({ type: "error", text: body.error ?? "Failed to create taxonomy node" });
      return;
    }

    setCreateTaxoMsg({ type: "success", text: `"${nodeTitle}" added as ${nodeType}.` });
    setNodeTitle("");
    setNodeDescription("");
    setTimeout(() => setCreateTaxoMsg(null), 5000);
    router.refresh();
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  // ── Ingestion helpers ───────────────────────────────────────────────────────
  async function loadRecentJobs() {
    try {
      const response = await fetch("/api/admin/ingestion/jobs", { method: "GET" });
      const body = (await response.json()) as { data?: { jobs?: IngestionJob[] }; error?: string };
      if (!response.ok) {
        setIngestionMessage(body.error ?? "Unable to load recent jobs.");
        return;
      }
      setRecentJobs(body.data?.jobs ?? []);
    } catch {
      setIngestionMessage("Unable to load recent jobs due to a network or server issue.");
    }
  }

  async function loadResearchQueue() {
    try {
      const response = await fetch("/api/admin/ingestion/research-queue", { method: "GET" });
      const body = (await response.json()) as { data?: { rows?: ResearchQueueRow[] }; error?: string };
      if (!response.ok) {
        setIngestionMessage(body.error ?? "Unable to load research queue.");
        return;
      }
      setResearchQueue(body.data?.rows ?? []);
    } catch {
      setIngestionMessage("Unable to load research queue.");
    }
  }

  async function loadJobDetails(jobId: string) {
    try {
      const response = await fetch(`/api/admin/ingestion/jobs?jobId=${encodeURIComponent(jobId)}`);
      const body = (await response.json()) as { data?: IngestionDetails; error?: string };
      if (!response.ok || !body.data) {
        setIngestionMessage(body.error ?? "Unable to load ingestion job details.");
        return;
      }
      setDetails(body.data);
      setJobIdInput(jobId);
    } catch {
      setIngestionMessage("Unable to load ingestion details due to a network or server issue.");
    }
  }

  // ── AI Research Agent Handler ───────────────────────────────────────────────
  async function onRunAgentResearch(e: FormEvent) {
    e.preventDefault();
    setAgentBusy(true);
    setAgentError(null);
    setAgentResult(null);
    try {
      const res = await fetch("/api/admin/research/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: agentQuery, city: agentCity || undefined, autoQueue: agentAutoQueue }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Agent request failed");
      setAgentResult(body.data);
    } catch (err: any) {
      setAgentError(err.message ?? "Unknown error");
    } finally {
      setAgentBusy(false);
    }
  }

  // ── Brochure Extractor Handler ──────────────────────────────────────────────
  function resetBrochureState() {
    setBrochureError(null);
    setBrochureResult(null);
    setBrochureApplyResult(null);
    setBrochureApplyError(null);
    setBrochureCandidates(null);
    setBrochureCandidateMeta(null);
    setBrochureTargetHospital(null);
    setBrochureHospitalSearch("");
    setBrochureHospitalSearchResults([]);
    setBrochureDiff(null);
    setBrochureConfirmOpen(false);
  }

  async function onExtractBrochure(e: FormEvent) {
    e.preventDefault();
    setBrochureBusy(true);
    resetBrochureState();
    try {
      const res = await fetch("/api/admin/research/brochure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: brochureText, sourceHint: brochureSourceHint || undefined, cityHint: brochureCityHint || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Extraction failed");
      setBrochureResult(body.data);
    } catch (err: any) {
      setBrochureError(err.message ?? "Unknown error");
    } finally {
      setBrochureBusy(false);
    }
  }

  async function onScanFile(e: FormEvent) {
    e.preventDefault();
    if (!brochureFile) return;
    setBrochureBusy(true);
    resetBrochureState();
    try {
      const fd = new FormData();
      fd.append("file", brochureFile);
      if (brochureSourceHint) fd.append("sourceHint", brochureSourceHint);
      if (brochureCityHint) fd.append("cityHint", brochureCityHint);
      const res = await fetch("/api/admin/research/brochure/scan", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Scan failed");
      setBrochureResult(body.data);
    } catch (err: any) {
      setBrochureError(err.message ?? "Unknown error");
    } finally {
      setBrochureBusy(false);
    }
  }

  function onFileSelected(file: File | null) {
    setBrochureFile(file);
    setBrochureFilePreview(null);
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setBrochureFilePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  }

  async function submitApply(extra: Record<string, unknown> = {}, explicitPayload?: Record<string, unknown> | null) {
    const basePayload = explicitPayload ?? brochureResult;
    if (!basePayload) return;
    setBrochureApplyBusy(true);
    setBrochureApplyError(null);
    setBrochureApplyResult(null);
    setBrochureCandidates(null);
    try {
      const res = await fetch("/api/admin/research/brochure/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...basePayload, ...extra }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = body.details ? ` — ${JSON.stringify(body.details)}` : "";
        throw new Error((body.error ?? "Apply failed") + detail);
      }
      if (body.needsConfirmation) {
        setBrochureCandidates(body.candidates);
        setBrochureCandidateMeta({ extractedName: body.extractedName, extractedCity: body.extractedCity });
      } else {
        setBrochureApplyResult(body.data);
      }
    } catch (err: any) {
      setBrochureApplyError(err.message ?? "Unknown error");
    } finally {
      setBrochureApplyBusy(false);
    }
  }

  async function previewApply(extra: Record<string, unknown> = {}, explicitPayload?: Record<string, unknown> | null) {
    const basePayload = explicitPayload ?? brochureResult;
    if (!basePayload) return;
    setBrochureApplyBusy(true);
    setBrochureApplyError(null);
    setBrochureCandidates(null);
    setBrochureDiff(null);
    try {
      const res = await fetch("/api/admin/research/brochure/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...basePayload, ...extra, dryRun: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = body.details ? ` — ${JSON.stringify(body.details)}` : "";
        throw new Error((body.error ?? "Preview failed") + detail);
      }
      if (body.needsConfirmation) {
        setBrochureCandidates(body.candidates);
        setBrochureCandidateMeta({ extractedName: body.extractedName, extractedCity: body.extractedCity });
      } else if (body.dryRun) {
        setBrochureDiff(body as BrochureDiff);
        setBrochurePendingArgs(extra);
        setBrochurePendingPayload(explicitPayload ?? null);
        setBrochureConfirmOpen(true);
      }
    } catch (err: any) {
      setBrochureApplyError(err.message ?? "Unknown error");
    } finally {
      setBrochureApplyBusy(false);
    }
  }

  function onApplyBrochure() {
    if (brochureTargetHospital) {
      previewApply({ targetHospitalId: brochureTargetHospital.id });
    } else {
      previewApply();
    }
  }
  function onApplyWithTarget(targetHospitalId: string) { previewApply({ targetHospitalId }, brochurePendingPayload); }
  function onApplyForceCreate() { previewApply({ forceCreate: true }, brochurePendingPayload); }

  async function confirmApply() {
    setBrochureConfirmOpen(false);
    const savedIdx = agentSavingIdx;
    await submitApply(brochurePendingArgs, brochurePendingPayload);
    // If triggered from AI research, track per-entity result
    if (savedIdx !== null) {
      setAgentSaveResults((prev) => ({ ...prev, [savedIdx]: { ok: true, text: "Saved successfully" } }));
      setAgentSavingIdx(null);
    }
  }

  async function onSaveAgentEntity(entity: NonNullable<typeof agentResult>["entities"][number], idx: number) {
    setAgentSavingIdx(idx);
    setAgentSaveResults((prev) => { const next = { ...prev }; delete next[idx]; return next; });
    setBrochureApplyError(null);

    const isDoctor = ["doctor", "physician", "surgeon", "dr."].some((t) => entity.type.toLowerCase().includes(t));

    if (isDoctor) {
      // Save doctor directly — check for hospital match in the same search results
      try {
        // Try to find associated hospital from the same result set
        const hospitalEntities = (agentResult?.entities ?? []).filter(
          (e) => !["doctor", "physician", "surgeon", "dr."].some((t) => e.type.toLowerCase().includes(t)),
        );
        let linkedHospitalId: string | undefined;
        if (hospitalEntities.length === 1) {
          // Only one hospital in the result set — check if it's in DB
          const res = await fetch("/api/admin/research/entity-batch-save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entities: [hospitalEntities[0]] }),
          });
          const body = await res.json().catch(() => ({}));
          linkedHospitalId = body.data?.saved?.hospitals?.[0]?.id;
        }

        const res = await fetch("/api/admin/research/doctor-save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: entity.name,
            city: entity.city ?? undefined,
            phone: entity.phone ?? undefined,
            bio: entity.snippet || undefined,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Doctor save failed");
        setAgentSaveResults((prev) => ({ ...prev, [idx]: { ok: true, text: `${body.data.action} doctor` } }));
      } catch (err: any) {
        setBrochureApplyError(err.message ?? "Unknown error");
      } finally {
        setAgentSavingIdx(null);
      }
      return;
    }

    // Hospital/clinic — use quickSave (auto-save for 0-1 matches, ask only for 2+ matches)
    const payload: Record<string, unknown> = {
      hospital: {
        name: entity.name,
        type: entity.type.toLowerCase().includes("clinic") ? "clinic" : "hospital",
        city: entity.city ?? undefined,
        phone: entity.phone ?? undefined,
        website: entity.website ?? undefined,
        description: entity.snippet || undefined,
      },
      doctors: [],
      packages: [],
      services: [],
      quickSave: true,
    };

    try {
      const res = await fetch("/api/admin/research/brochure/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = body.details ? ` — ${JSON.stringify(body.details)}` : "";
        throw new Error((body.error ?? "Save failed") + detail);
      }
      if (body.needsConfirmation) {
        // Multiple fuzzy matches — store pending payload and show candidates modal
        setBrochurePendingPayload(payload);
        setBrochureCandidates(body.candidates);
        setBrochureCandidateMeta({ extractedName: body.extractedName, extractedCity: body.extractedCity });
      } else if (body.data) {
        setAgentSaveResults((prev) => ({ ...prev, [idx]: { ok: true, text: body.data.hospitalAction } }));
      }
    } catch (err: any) {
      setBrochureApplyError(err.message ?? "Unknown error");
    } finally {
      setAgentSavingIdx(null);
    }
  }

  async function onBatchSaveAll() {
    if (!agentResult?.entities.length) return;
    setAgentBatchBusy(true);
    setAgentBatchError(null);
    setAgentBatchResult(null);
    try {
      const res = await fetch("/api/admin/research/entity-batch-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entities: agentResult.entities }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Batch save failed");
      setAgentBatchResult(body.data);
      // Update hospitalList with any created hospitals
      if (body.data?.saved?.hospitals?.length) {
        // Trigger a background refresh to pick up new hospital records
        router.refresh();
      }
    } catch (err: any) {
      setAgentBatchError(err.message ?? "Unknown error");
    } finally {
      setAgentBatchBusy(false);
    }
  }

  async function onResolveAmbiguous(name: string, city: string, targetHospitalId: string) {
    // User picked a hospital for an ambiguous entity — apply it now
    const entity = agentResult?.entities.find(
      (e) => e.name.trim() === name && (e.city ?? "") === city,
    );
    if (!entity) return;
    const payload: Record<string, unknown> = {
      hospital: {
        name: entity.name,
        type: entity.type.toLowerCase().includes("clinic") ? "clinic" : "hospital",
        city: entity.city ?? undefined,
        phone: entity.phone ?? undefined,
        website: entity.website ?? undefined,
        description: entity.snippet || undefined,
      },
      doctors: [],
      packages: [],
      services: [],
    };
    await submitApply({ targetHospitalId }, payload);
    // Remove from ambiguous list
    setAgentBatchResult((prev) =>
      prev
        ? { ...prev, ambiguous: prev.ambiguous.filter((a) => !(a.name === name && a.city === city)) }
        : prev,
    );
  }

  async function onCreateAmbiguousAsNew(name: string, city: string) {
    const entity = agentResult?.entities.find(
      (e) => e.name.trim() === name && (e.city ?? "") === city,
    );
    if (!entity) return;
    const payload: Record<string, unknown> = {
      hospital: {
        name: entity.name,
        type: entity.type.toLowerCase().includes("clinic") ? "clinic" : "hospital",
        city: entity.city ?? undefined,
        phone: entity.phone ?? undefined,
        website: entity.website ?? undefined,
        description: entity.snippet || undefined,
      },
      doctors: [],
      packages: [],
      services: [],
      forceCreate: true,
    };
    await submitApply({}, payload);
    setAgentBatchResult((prev) =>
      prev
        ? { ...prev, ambiguous: prev.ambiguous.filter((a) => !(a.name === name && a.city === city)) }
        : prev,
    );
  }

  async function onSearchAmbiguousHospitals(key: string, query: string) {
    setAmbiguousSearchQueries((prev) => ({ ...prev, [key]: query }));
    
    // Fallback to local filtering for instant results
    const lower = query.toLowerCase();
    const results = hospitalList
      .filter((h) => 
        h.name.toLowerCase().includes(lower) || 
        (h.city ?? "").toLowerCase().includes(lower) ||
        (h.state ?? "").toLowerCase().includes(lower)
      )
      .slice(0, 50); // Show more results locally
    
    setAmbiguousSearchResults((prev) => ({ ...prev, [key]: results }));
    
    // If query is empty, we don't need to load anything extra
    if (query.trim().length === 0) return;

    // Optional: still trigger background fetch if we want to be sure about server-side matches
    // but for now, local search on 23-100 hospitals is sufficient.
  }

  function onBrochureHospitalSearchChange(q: string) {
    setBrochureHospitalSearch(q);
    setBrochureTargetHospital(null);
    if (q.trim().length < 2) {
      setBrochureHospitalSearchResults([]);
      return;
    }
    setBrochureHospitalSearchBusy(true);
    // Search against the already-loaded hospitalList
    const lower = q.toLowerCase();
    const results = hospitalList
      .filter((h) =>
        h.name.toLowerCase().includes(lower) ||
        (h.city ?? "").toLowerCase().includes(lower) ||
        (h.state ?? "").toLowerCase().includes(lower),
      )
      .slice(0, 8)
      .map((h) => ({ id: h.id, name: h.name, city: h.city, state: h.state, slug: h.slug }));
    setBrochureHospitalSearchResults(results);
    setBrochureHospitalSearchBusy(false);
  }

  async function onRunIngestion(event: FormEvent) {
    event.preventDefault();
    setIngestionBusy(true);
    setIngestionMessage(null);
    setIngestionProgressTask("Starting mission...");
    setIngestionProgressPercent(0);

    let pollInterval: any;

    try {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch("/api/admin/ingestion/jobs");
          const body = await res.json();
          const latestJob = body.data?.jobs?.[0];
          if (
            latestJob &&
            ["collecting_sources", "fetching", "extracting_data", "extracting"].includes(latestJob.status)
          ) {
            setIngestionProgressTask(latestJob.summary?.currentTask || "Processing...");
            setIngestionProgressPercent(latestJob.summary?.percent || 0);
          }
        } catch (e) {
          console.error("Polling error:", e);
        }
      }, 2500);

      const response = await fetch("/api/admin/ingestion/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl,
          hospitalName: ingestionHospitalName || undefined,
          city: ingestionCity || undefined,
          searchQuery: ingestionQuery || undefined,
          targetHospitalId: targetHospitalId || undefined,
        }),
      });

      const body = (await response.json()) as {
        data?: { jobId: string; summary?: any };
        error?: string;
        message?: string;
      };

      if (!response.ok || !body.data) {
        throw new Error(body.message ?? body.error ?? "Ingestion run failed.");
      }

      clearInterval(pollInterval);
      const warnings = Array.isArray(body.data.summary?.warnings)
        ? (body.data.summary?.warnings as unknown[]).filter((item): item is string => typeof item === "string")
        : [];

      setIngestionMessage(
        warnings.length
          ? `Ingestion completed with warnings. Job ID: ${body.data.jobId}. ${warnings[0]}`
          : `Ingestion completed. Job ID: ${body.data.jobId}`,
      );
      setJobIdInput(body.data.jobId);
      await Promise.all([loadRecentJobs(), loadJobDetails(body.data.jobId), loadResearchQueue()]);
    } catch (e: any) {
      clearInterval(pollInterval);
      setIngestionMessage(e.message ?? "Ingestion request failed.");
    } finally {
      setIngestionBusy(false);
      setIngestionProgressTask(null);
      setIngestionProgressPercent(0);
    }
  }

  async function onApplyJob() {
    if (!jobIdInput.trim()) {
      setIngestionMessage("Enter a job ID first.");
      return;
    }
    setIngestionBusy(true);
    setIngestionMessage(null);
    try {
      const response = await fetch(
        `/api/admin/ingestion/jobs/${encodeURIComponent(jobIdInput.trim())}/apply`,
        { method: "POST" },
      );
      const body = (await response.json()) as {
        data?: { hospitalsApplied: number; doctorsApplied: number; affiliationsApplied: number; packagesApplied?: number };
        error?: string;
      };
      if (!response.ok || !body.data) {
        setIngestionMessage(body.error ?? "Apply failed.");
        return;
      }
      setIngestionMessage(
        `Applied successfully. Hospitals: ${body.data.hospitalsApplied}, Doctors: ${body.data.doctorsApplied}, Affiliations: ${body.data.affiliationsApplied}, Packages: ${body.data.packagesApplied ?? 0}`,
      );
      await Promise.all([loadRecentJobs(), loadJobDetails(jobIdInput.trim()), router.refresh()]);
    } catch {
      setIngestionMessage("Apply failed due to a network or server error.");
    } finally {
      setIngestionBusy(false);
    }
  }

  async function runReviewAction(
    entityType: "hospital" | "doctor" | "service" | "package",
    entityId: string,
    action: "approve" | "reject" | "delete" | "edit",
    patch?: Record<string, any>,
  ) {
    setIngestionBusy(true);
    setIngestionMessage(null);
    try {
      const response = await fetch("/api/admin/ingestion/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, action, patch }),
      });
      const body = (await response.json()) as { data?: unknown; error?: string };
      if (!response.ok) {
        setIngestionMessage(body.error ?? "Review update failed.");
        return;
      }
      setIngestionMessage(`Updated ${entityType} candidate: ${action}`);
      if (action === "edit") {
        setEditModeId(null);
        setEditDraft({});
      }
      if (jobIdInput.trim()) await loadJobDetails(jobIdInput.trim());
    } catch {
      setIngestionMessage("Review update failed due to a network or server error.");
    } finally {
      setIngestionBusy(false);
    }
  }

  async function deepSearchPricing(candidate: any) {
    if (!details?.job.id) return;
    setIngestionBusy(true);
    setIngestionProgressTask(`Deep searching pricing for ${candidate.name}...`);
    setIngestionProgressPercent(15);
    try {
      const response = await fetch("/api/admin/ingestion/pricing-discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalName: candidate.name,
          city: candidate.city,
          candidateId: candidate.id,
          jobId: details.job.id,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Deep search failed.");
      setIngestionMessage(`Deep Pricing Search Complete! Found ${body.data.packages.length} packages.`);
      if (jobIdInput.trim()) await loadJobDetails(jobIdInput.trim());
    } catch (e: any) {
      setIngestionMessage(e.message);
    } finally {
      setIngestionBusy(false);
      setIngestionProgressTask(null);
      setIngestionProgressPercent(0);
    }
  }

  async function bulkReviewAction(
    entityType: "hospital" | "doctor" | "service" | "package" | "all",
    action: "approve" | "reject" | "delete",
  ) {
    if (!details?.job.id) {
      setIngestionMessage("Load a job first.");
      return;
    }
    const label = entityType === "all" ? "ALL candidates" : `all ${entityType}s`;
    if (!globalThis.confirm(`${action.toUpperCase()} ${label}? This cannot be undone.`)) return;
    setIngestionBusy(true);
    setIngestionMessage(null);
    try {
      const response = await fetch("/api/admin/ingestion/review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: details.job.id, entityType, action }),
      });
      const body = (await response.json()) as { data?: { totalUpdated: number }; error?: string };
      if (!response.ok) {
        setIngestionMessage(body.error ?? "Bulk action failed.");
        return;
      }
      setIngestionMessage(`Bulk ${action}: ${body.data?.totalUpdated ?? 0} candidates updated.`);
      if (jobIdInput.trim()) await loadJobDetails(jobIdInput.trim());
    } catch {
      setIngestionMessage("Bulk action failed due to a network or server error.");
    } finally {
      setIngestionBusy(false);
    }
  }

  async function loadDiscovery() {
    if (!discoveryQuery.trim()) {
      setIngestionMessage("Enter a Google research query.");
      return;
    }
    setIngestionBusy(true);
    setIngestionMessage(null);
    try {
      const response = await fetch(
        `/api/admin/ingestion/discovery?q=${encodeURIComponent(discoveryQuery.trim())}`,
      );
      const body = (await response.json()) as { data?: { results?: DiscoveryResult[] }; error?: string };
      if (!response.ok) {
        setIngestionMessage(body.error ?? "Discovery failed.");
        return;
      }
      const rows = body.data?.results ?? [];
      setDiscoveryResults(rows);
      setSelectedDiscoveryLinks(rows.slice(0, 5).map((item) => item.link));
      setIngestionMessage(`Loaded ${rows.length} discovery results.`);
    } catch {
      setIngestionMessage("Discovery request failed.");
    } finally {
      setIngestionBusy(false);
    }
  }

  async function queueSelectedDiscovery() {
    if (!selectedDiscoveryRows.length) {
      setIngestionMessage("Select at least one result to queue.");
      return;
    }
    setIngestionBusy(true);
    setIngestionMessage(null);
    try {
      const response = await fetch("/api/admin/ingestion/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: discoveryQuery,
          selectedResults: selectedDiscoveryRows.map((item) => ({ title: item.title, link: item.link })),
        }),
      });
      const body = (await response.json()) as { data?: { queued: number }; error?: string };
      if (!response.ok || !body.data) {
        setIngestionMessage(body.error ?? "Queue creation failed.");
        return;
      }
      setIngestionMessage(`Queued ${body.data.queued} research tasks.`);
      await loadResearchQueue();
    } catch {
      setIngestionMessage("Queue creation failed due to a network or server error.");
    } finally {
      setIngestionBusy(false);
    }
  }

  // ── Sub-components ──────────────────────────────────────────────────────────
  const FlagBadge = ({ flag }: { flag: string }) => (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-200 shadow-sm mr-2 mb-2">
      {flag.replace(/_/g, " ")}
    </span>
  );

  const StatusBadge = ({ active }: { active: boolean }) => (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
        active
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-slate-100 text-slate-500 border-slate-200"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );

  const Toast = ({ msg }: { msg: { type: "success" | "error"; text: string } }) => (
    <div
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border ${
        msg.type === "success"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-red-50 text-red-700 border-red-200"
      }`}
    >
      {msg.type === "success" ? "✓" : "✗"} {msg.text}
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 font-sans antialiased">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <section className="bg-gradient-to-r from-teal-900 to-teal-700 text-white rounded-2xl p-6 shadow-sm border border-teal-800 flex justify-between items-center">
          <div>
            <p className="text-teal-200 text-sm font-semibold uppercase tracking-wider mb-1">EasyHeals Admin</p>
            <h1 className="text-3xl font-bold tracking-tight">CRM Operations Center</h1>
            <p className="text-teal-100 mt-1.5">
              Signed in as <span className="font-semibold text-white">{me.fullName}</span>{" "}
              <span className="text-teal-300 text-sm">({me.role})</span>
            </p>
          </div>
          <button
            onClick={onLogout}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl transition-colors font-medium backdrop-blur-sm"
          >
            Sign Out
          </button>
        </section>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl shadow-sm text-sm font-medium flex items-center gap-2">
            <span className="text-red-400">✗</span> {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 text-lg leading-none">×</button>
          </div>
        )}

        {/* ── TAB NAVIGATION ─────────────────────────────────────────────── */}
        <nav className="flex flex-wrap gap-1 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm">
          {(["ingestion", "hospitals", "taxonomy", "ai_research", "brochure", "contributions", "kyc", "config", "patients", "appointments", "providers"] as Tab[]).map((tab) => {
            const labels: Record<Tab, { label: string; icon: string; count?: number }> = {
              ingestion: { label: "Data Ingestion", icon: "🤖" },
              hospitals: { label: "Hospitals", icon: "🏥", count: hospitalStats.total },
              taxonomy: { label: "Taxonomy", icon: "🏷️", count: initialNodes.length },
              ai_research: { label: "AI Research", icon: "🔍" },
              brochure: { label: "Brochure Extract", icon: "📄" },
              contributions: { label: "Contributions", icon: "✏️" },
              kyc: { label: "KYC Requests", icon: "🪪" },
              config: { label: "Config & Flags", icon: "⚙️" },
              patients: { label: "Patients", icon: "👤" },
              appointments: { label: "Appointments", icon: "📅" },
              providers: { label: "Providers", icon: "🏥" },
            };
            const { label, icon, count } = labels[tab];
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <span>{icon}</span>
                <span>{label}</span>
                {count !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === tab ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ── HOSPITAL MANAGEMENT (tab) ────────────────────────────────────── */}
        {activeTab === "hospitals" && (<>

        {/* ── HOSPITAL MANAGEMENT ─────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex flex-wrap justify-between items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Hospital Management</h2>
              <p className="text-slate-500 text-sm mt-0.5">Search, edit, and manage all hospital records.</p>
            </div>
            {/* Stats */}
            <div className="flex gap-3">
              <div className="text-center px-4 py-2 bg-slate-100 rounded-xl border border-slate-200">
                <p className="text-lg font-bold text-slate-800">{hospitalStats.total}</p>
                <p className="text-xs text-slate-500 font-medium">Total</p>
              </div>
              <div className="text-center px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-200">
                <p className="text-lg font-bold text-emerald-700">{hospitalStats.active}</p>
                <p className="text-xs text-emerald-600 font-medium">Active</p>
              </div>
              <div className="text-center px-4 py-2 bg-slate-100 rounded-xl border border-slate-200">
                <p className="text-lg font-bold text-slate-500">{hospitalStats.inactive}</p>
                <p className="text-xs text-slate-400 font-medium">Inactive</p>
              </div>
            </div>
          </div>

          <div className="p-5">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
              <input
                className="flex-1 min-w-[200px] px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
                value={hospitalSearch}
                onChange={(e) => setHospitalSearch(e.target.value)}
                placeholder="Search by name, city, state, or UUID..."
              />
              <select
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                value={hospitalCityFilter}
                onChange={(e) => setHospitalCityFilter(e.target.value)}
              >
                <option value="">All Cities</option>
                {uniqueCities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                value={hospitalStatusFilter}
                onChange={(e) => setHospitalStatusFilter(e.target.value as any)}
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
              <span className="self-center text-xs text-slate-400 font-medium">
                {filteredHospitals.length} result{filteredHospitals.length !== 1 ? "s" : ""}
              </span>
              {selectedHospitalIds.length > 0 && (
                <button
                  onClick={handlePopulateData}
                  className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm transition flex items-center gap-2 font-medium"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  Populate Data ({selectedHospitalIds.length})
                </button>
              )}
            </div>

            {hospitalMgmtMsg && (
              <div className="mb-4">
                <Toast msg={hospitalMgmtMsg} />
              </div>
            )}

            {/* Table */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left">
                      <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap w-12 text-center">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAllHospitals}
                          className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Hospital</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">City / State</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Phone</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Email</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHospitals.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm italic">
                          No hospitals match your filters.
                        </td>
                      </tr>
                    )}
                    {filteredHospitals.map((h) => (
                      <React.Fragment key={h.id}>
                        <tr className={`hover:bg-slate-50/60 transition-colors group ${selectedHospitalIds.includes(h.id) ? "bg-teal-50/20" : ""}`}>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedHospitalIds.includes(h.id)}
                              onChange={() => toggleHospitalSelection(h.id)}
                              className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800">{h.name}</p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">{h.slug}</p>
                            <button
                              className="text-xs text-slate-300 font-mono mt-0.5 hover:text-teal-600 transition-colors text-left truncate max-w-[200px] block"
                              title={`UUID: ${h.id} — click to copy`}
                              onClick={() => { void navigator.clipboard.writeText(h.id); }}
                            >
                              {h.id.slice(0, 8)}…
                            </button>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {h.city}
                            {h.state ? <span className="text-slate-400">, {h.state}</span> : null}
                          </td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs">{h.phone ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-[160px]">{h.email ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3">
                            <StatusBadge active={h.isActive} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 justify-end">
                              <a
                                href={`/hospitals/${h.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg text-slate-500 hover:text-teal-600 hover:border-teal-200 bg-white transition-all"
                                title="View profile"
                              >
                                View
                              </a>
                              <button
                                onClick={() => {
                                  setEditingHospitalId(editingHospitalId === h.id ? null : h.id);
                                  setEditHospitalDraft({ name: h.name, city: h.city, state: h.state ?? "", phone: h.phone ?? "", email: h.email ?? "" });
                                }}
                                className="px-2.5 py-1 text-xs border border-teal-200 rounded-lg text-teal-700 bg-teal-50 hover:bg-teal-100 font-medium transition-all"
                              >
                                {editingHospitalId === h.id ? "Cancel" : "Edit"}
                              </button>
                              <button
                                onClick={() => onToggleHospitalActive(h)}
                                disabled={hospitalMgmtBusy}
                                className={`px-2.5 py-1 text-xs border rounded-lg font-medium transition-all disabled:opacity-50 ${
                                  h.isActive
                                    ? "border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
                                    : "border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                }`}
                              >
                                {h.isActive ? "Deactivate" : "Activate"}
                              </button>
                              <button
                                onClick={() => onDeleteHospital(h)}
                                disabled={hospitalMgmtBusy}
                                className="px-2.5 py-1 text-xs border border-red-200 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-all disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* Inline edit row */}
                        {editingHospitalId === h.id && (
                          <tr className="bg-teal-50/50">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div>
                                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Hospital Name</label>
                                  <input
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                                    value={editHospitalDraft.name as string ?? ""}
                                    onChange={(e) => setEditHospitalDraft({ ...editHospitalDraft, name: e.target.value })}
                                    placeholder="Hospital name"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-500 mb-1 block">City</label>
                                  <input
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                                    value={editHospitalDraft.city as string ?? ""}
                                    onChange={(e) => setEditHospitalDraft({ ...editHospitalDraft, city: e.target.value })}
                                    placeholder="City"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-500 mb-1 block">State</label>
                                  <input
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                                    value={editHospitalDraft.state as string ?? ""}
                                    onChange={(e) => setEditHospitalDraft({ ...editHospitalDraft, state: e.target.value })}
                                    placeholder="State"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Phone</label>
                                  <input
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white font-mono"
                                    value={editHospitalDraft.phone as string ?? ""}
                                    onChange={(e) => setEditHospitalDraft({ ...editHospitalDraft, phone: e.target.value })}
                                    placeholder="+91 XXXXX XXXXX"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Email</label>
                                  <input
                                    type="email"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                                    value={editHospitalDraft.email as string ?? ""}
                                    onChange={(e) => setEditHospitalDraft({ ...editHospitalDraft, email: e.target.value })}
                                    placeholder="contact@hospital.com"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Hospital UUID</label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      readOnly
                                      value={h.id}
                                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-slate-100 text-slate-500 outline-none select-all"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => { void navigator.clipboard.writeText(h.id); }}
                                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs rounded-lg transition-colors whitespace-nowrap"
                                      title="Copy UUID"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-end gap-2">
                                  <button
                                    onClick={() => onSaveHospital(h.id)}
                                    disabled={hospitalMgmtBusy}
                                    className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    {hospitalMgmtBusy ? "Saving..." : "Save Changes"}
                                  </button>
                                  <button
                                    onClick={() => { setEditingHospitalId(null); setEditHospitalDraft({}); }}
                                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ── QUICK ADD HOSPITAL (inside hospitals tab) ────────────────────── */}
        <article className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800">Quick Add Hospital</h2>
            <p className="text-slate-500 text-xs mt-0.5">Manually create a new hospital record.</p>
          </div>
          <div className="p-5">
            {createHospMsg && <div className="mb-4"><Toast msg={createHospMsg} /></div>}
            <form onSubmit={onCreateHospital} className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Hospital Name *</label>
                <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" value={newHospName} onChange={(e) => setNewHospName(e.target.value)} placeholder="e.g., Apollo Hospitals" required />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">City *</label>
                <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" value={newHospCity} onChange={(e) => setNewHospCity(e.target.value)} placeholder="e.g., Mumbai" required />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">State</label>
                <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" value={newHospState} onChange={(e) => setNewHospState(e.target.value)} placeholder="e.g., Maharashtra" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Phone</label>
                <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-mono" value={newHospPhone} onChange={(e) => setNewHospPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Email</label>
                <input type="email" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" value={newHospEmail} onChange={(e) => setNewHospEmail(e.target.value)} placeholder="contact@hospital.com" />
              </div>
              <div className="col-span-2">
                <button type="submit" disabled={createHospBusy} className="w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {createHospBusy ? <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Creating...</> : "+ Add Hospital"}
                </button>
              </div>
            </form>
          </div>
        </article>

        </>)}

        {/* ── INGESTION TAB ────────────────────────────────────────────────── */}
        {activeTab === "ingestion" && (<>

        {/* ── AI INGESTION TOOL ───────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-800">Smart AI Data Scraper</h2>
            <p className="text-slate-500 mt-1 text-sm">Input a hospital website or Google Maps link to automatically extract standard details for review.</p>
          </div>
          <div className="p-6">
            <form onSubmit={onRunIngestion} className="space-y-4">
              <input
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none text-slate-700"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://hospital-website.com or Google Maps Profile URL"
                required
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 transition-all outline-none text-sm"
                  value={ingestionHospitalName}
                  onChange={(event) => setIngestionHospitalName(event.target.value)}
                  placeholder="Hospital name context (optional)"
                />
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 transition-all outline-none text-sm"
                  value={ingestionCity}
                  onChange={(event) => setIngestionCity(event.target.value)}
                  placeholder="City context (optional)"
                />
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 transition-all outline-none text-sm"
                  value={ingestionQuery}
                  onChange={(event) => setIngestionQuery(event.target.value)}
                  placeholder="Specific queries (optional)"
                />
              </div>
              <input
                className="w-full px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-sm placeholder:text-indigo-400 text-indigo-800"
                value={targetHospitalId}
                onChange={(event) => setTargetHospitalId(event.target.value)}
                placeholder="Target Hospital ID (if updating an existing hospital)"
              />
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={ingestionBusy}
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {ingestionBusy ? (
                    <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Running Scraping...</>
                  ) : "Scrape Now / Regenerate"}
                </button>
                <button
                  type="button"
                  onClick={loadRecentJobs}
                  disabled={ingestionBusy}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium rounded-xl transition-colors"
                >
                  Refresh Recent Jobs
                </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
              <div className="md:col-span-5 space-y-2">
                <label className="text-sm font-medium text-slate-700">Load Job Details using ID</label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 transition-all outline-none"
                    value={jobIdInput}
                    onChange={(event) => setJobIdInput(event.target.value)}
                    placeholder="Enter Job ID here..."
                  />
                  <button
                    type="button"
                    onClick={() => loadJobDetails(jobIdInput.trim())}
                    disabled={ingestionBusy || !jobIdInput.trim()}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium rounded-xl transition-colors whitespace-nowrap"
                  >
                    Load
                  </button>
                </div>
              </div>
              <div className="md:col-span-7 flex items-center justify-end gap-3">
                {ingestionMessage && (
                  <p className="text-sm font-medium text-teal-700 bg-teal-50 px-4 py-2 rounded-lg border border-teal-100 flex-1 animate-in fade-in">
                    {ingestionMessage}
                  </p>
                )}
                <button
                  type="button"
                  onClick={onApplyJob}
                  disabled={ingestionBusy || !jobIdInput.trim()}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-xl transition-colors shadow-sm whitespace-nowrap disabled:opacity-50"
                >
                  Publish ALL Approved to Core
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── DISCOVERY QUEUE ─────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-800">Google Search Research Queue</h2>
            <p className="text-slate-500 mt-1 text-sm">Discover and queue clinics/hospitals from Google Search directly for scraping.</p>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <input
                className="flex-1 min-w-[300px] px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 transition-all outline-none"
                value={discoveryQuery}
                onChange={(e) => setDiscoveryQuery(e.target.value)}
                placeholder="e.g., Best Orthopedic Clinics in Mumbai"
              />
              <button
                type="button"
                onClick={loadDiscovery}
                disabled={ingestionBusy}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl border border-slate-200 transition-colors"
              >
                Search Google
              </button>
              <button
                type="button"
                onClick={queueSelectedDiscovery}
                disabled={ingestionBusy || !selectedDiscoveryRows.length}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-sm transition-colors disabled:opacity-50"
              >
                Create Queue from Selected
              </button>
              <button
                type="button"
                onClick={loadResearchQueue}
                disabled={ingestionBusy}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl border border-slate-200 transition-colors"
              >
                View Queue Tasks
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl shadow-inner">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 pb-2 border-b border-slate-200">
                  Discovery Results
                </h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {discoveryResults.length === 0 ? (
                    <p className="text-slate-500 text-sm italic">Type a query to load results.</p>
                  ) : null}
                  {discoveryResults.map((item) => (
                    <label
                      key={item.link}
                      className="flex items-start gap-4 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-teal-400 hover:shadow-sm transition-all"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                        checked={selectedDiscoveryLinks.includes(item.link)}
                        onChange={(event) => {
                          setSelectedDiscoveryLinks((prev) =>
                            event.target.checked ? [...prev, item.link] : prev.filter((link) => link !== item.link),
                          );
                        }}
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800 text-sm line-clamp-2">{item.title}</p>
                        <span className="inline-block mt-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 font-mono text-xs rounded border border-indigo-100">
                          {item.suggestedAction.replace(/_/g, " ")}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl shadow-inner">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 pb-2 border-b border-slate-200">
                  Task Queue
                </h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {researchQueue.length === 0 ? (
                    <p className="text-slate-500 text-sm italic">Queue is currently empty.</p>
                  ) : null}
                  {researchQueue.map((row) => (
                    <div key={row.id} className="p-3 bg-white border border-slate-200 rounded-xl">
                      <p className="font-semibold text-slate-800 text-sm truncate">{row.sourceTitle ?? row.sourceUrl}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-mono text-xs rounded border border-slate-200">{row.nextAction}</span>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono text-xs rounded border border-blue-200">{row.queueStatus}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SCRAPED DATA REVIEW CENTER ──────────────────────────────────── */}
        {details && (
          <div className="space-y-6 pt-4 border-t-2 border-slate-200 animate-in fade-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-base">🩺</span>
              Scraped Data Review Center
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-1 md:col-span-4 lg:col-span-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Job Status</p>
                <p className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-emerald-600 capitalize">
                  {details.job.status.replace(/_/g, " ")}
                </p>
                {details.job.errorMessage && (
                  <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">{details.job.errorMessage}</p>
                )}
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">Quick Actions</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => bulkReviewAction("all", "approve")} disabled={ingestionBusy} className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">✓ Approve All</button>
                    <button onClick={() => bulkReviewAction("all", "reject")} disabled={ingestionBusy} className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">✗ Reject All</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => bulkReviewAction("doctor", "approve")} disabled={ingestionBusy} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded border border-green-200 hover:bg-green-100">✓ All Doctors</button>
                    <button onClick={() => bulkReviewAction("package", "approve")} disabled={ingestionBusy} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded border border-green-200 hover:bg-green-100">✓ All Packages</button>
                    <button onClick={() => bulkReviewAction("service", "approve")} disabled={ingestionBusy} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded border border-green-200 hover:bg-green-100">✓ All Services</button>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-blue-50 p-2 rounded"><span className="font-bold text-blue-700">{details.hospitalCandidates.length}</span> Hospitals</div>
                  <div className="bg-indigo-50 p-2 rounded"><span className="font-bold text-indigo-700">{details.doctorCandidates.length}</span> Doctors</div>
                  <div className="bg-purple-50 p-2 rounded"><span className="font-bold text-purple-700">{details.serviceCandidates.length}</span> Services</div>
                  <div className="bg-amber-50 p-2 rounded"><span className="font-bold text-amber-700">{details.packageCandidates.length}</span> Packages</div>
                </div>
                {Array.isArray(details.job.summary?.warnings) && (details.job.summary?.warnings as string[]).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-bold text-amber-600 uppercase mb-2">Warnings</p>
                    <ul className="text-xs text-amber-700 space-y-1 bg-amber-50 p-2 rounded">
                      {(details.job.summary?.warnings as string[]).slice(0, 5).map((w, i) => (
                        <li key={i}>• {w.substring(0, 80)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Hospital Candidate Review */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm col-span-1 md:col-span-4 lg:col-span-3">
                <div className="p-4 bg-slate-50 border-b border-slate-100 rounded-t-2xl flex justify-between items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-800">Hospital Core Data</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => bulkReviewAction("hospital", "approve")} disabled={ingestionBusy} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded border border-green-200 hover:bg-green-100 font-medium">✓ Approve All</button>
                    <span className="px-2 py-1 bg-slate-200 text-slate-800 text-xs font-bold rounded-md">{details.hospitalCandidates.length}</span>
                  </div>
                </div>
                <div className="p-5 overflow-x-auto space-y-4">
                  {details.hospitalCandidates.map((item) => (
                    <div key={item.id} className="p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-shadow">
                      {item.outlierFlags.length > 0 && <div className="mb-2">{item.outlierFlags.map((f) => <FlagBadge key={f} flag={f} />)}</div>}
                      {editModeId === item.id ? (
                        <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <input className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500" value={editDraft.name || ""} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} placeholder="Hospital Name" />
                          <input className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500" value={editDraft.city || ""} onChange={(e) => setEditDraft({ ...editDraft, city: e.target.value })} placeholder="City" />
                          <input className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500" value={editDraft.website || ""} onChange={(e) => setEditDraft({ ...editDraft, website: e.target.value })} placeholder="Website URL" />
                          <div className="flex gap-2 pt-2">
                            <button onClick={() => runReviewAction("hospital", item.id, "edit", editDraft)} className="px-4 py-1.5 bg-teal-600 text-white text-sm rounded hover:bg-teal-700">Save</button>
                            <button onClick={() => setEditModeId(null)} className="px-4 py-1.5 bg-slate-200 text-slate-700 text-sm rounded hover:bg-slate-300">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start flex-wrap gap-4">
                          <div>
                            <h4 className="text-lg font-bold text-slate-800">{item.name}</h4>
                            <div className="flex flex-col gap-1 mt-1">
                              <p className="text-sm text-slate-500 flex items-center gap-1.5">
                                <span className="text-slate-400">📍</span> {item.city ?? "Location not specified"}
                              </p>
                              {item.website && (
                                <a href={item.website} target="_blank" rel="noreferrer" className="text-xs text-teal-600 hover:underline flex items-center gap-1.5 font-medium">
                                  <span>🌐</span> {item.website.replace(/^https?:\/\//, "").substring(0, 30)}...
                                </a>
                              )}
                            </div>
                            <div className="flex gap-2 mt-3">
                              {item.matchHospitalName && (
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded border border-indigo-100 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                  Merging with: {item.matchHospitalName}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${item.applyStatus === "approved" ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                                {item.applyStatus}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { setEditModeId(item.id); setEditDraft({ name: item.name, city: item.city }); }} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white hover:bg-slate-50 text-slate-600 font-medium">Edit</button>
                            <button onClick={() => deepSearchPricing(item)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-1.5">
                              <span>💰</span> Deep Pricing Search
                            </button>
                            <button onClick={() => runReviewAction("hospital", item.id, "approve")} className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100">Approve</button>
                            <button onClick={() => runReviewAction("hospital", item.id, "reject")} className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100">Reject</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Doctors */}
              <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-800">Extracted Doctors</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => bulkReviewAction("doctor", "approve")} disabled={ingestionBusy} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded border border-green-200 hover:bg-green-100 font-medium">✓ All</button>
                    <button onClick={() => bulkReviewAction("doctor", "reject")} disabled={ingestionBusy} className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded border border-red-200 hover:bg-red-100 font-medium">✗ All</button>
                    <span className="px-2 py-1 bg-slate-200 text-slate-800 text-xs font-bold rounded-md">{details.doctorCandidates.length}</span>
                  </div>
                </div>
                <div className="flex-1 p-0 overflow-y-auto max-h-[500px]">
                  <ul className="divide-y divide-slate-100">
                    {details.doctorCandidates.map((item) => (
                      <li key={item.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                        {editModeId === item.id ? (
                          <div className="space-y-2">
                            <input className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-teal-500 outline-none" value={editDraft.fullName || ""} onChange={(e) => setEditDraft({ ...editDraft, fullName: e.target.value })} placeholder="Doctor Name" />
                            <input className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-teal-500 outline-none" value={editDraft.specialization || ""} onChange={(e) => setEditDraft({ ...editDraft, specialization: e.target.value })} placeholder="Specialization" />
                            <div className="flex gap-2 items-center">
                              <span className="text-sm font-medium text-slate-500">₹</span>
                              <input type="number" className="flex-1 p-2 border border-slate-300 rounded text-sm focus:ring-teal-500 outline-none" value={editDraft.consultationFee || ""} onChange={(e) => setEditDraft({ ...editDraft, consultationFee: Number(e.target.value) })} placeholder="Fee" />
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => runReviewAction("doctor", item.id, "edit", editDraft)} className="flex-1 py-1.5 bg-teal-600 text-white text-xs rounded hover:bg-teal-700">Save</button>
                              <button onClick={() => setEditModeId(null)} className="flex-1 py-1.5 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1">
                                {item.outlierFlags.length > 0 && <div className="mb-2 flex flex-wrap gap-1">{item.outlierFlags.map((f: string) => <FlagBadge key={f} flag={f} />)}</div>}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-slate-800 text-base leading-tight">{item.fullName}</h4>
                                  {item.yearsOfExperience && (
                                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded border border-amber-100 uppercase">{item.yearsOfExperience}y Exp</span>
                                  )}
                                </div>
                                <p className="text-xs font-semibold text-teal-600 mt-1 uppercase tracking-tight">{item.specialization ?? "General Physician"}</p>
                                {item.qualifications && Array.isArray(item.qualifications) && item.qualifications.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {(item.qualifications as string[]).slice(0, 4).map((q: string, idx: number) => (
                                      <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200">{q}</span>
                                    ))}
                                    {item.qualifications.length > 4 && <span className="text-[10px] text-slate-400 self-center">+{item.qualifications.length - 4} more</span>}
                                  </div>
                                )}
                                {item.matchDoctorName && (
                                  <div className="mt-3 p-2 bg-indigo-50 border border-indigo-100 rounded-lg">
                                    <p className="text-[10px] uppercase font-bold text-indigo-400 leading-none mb-1">Matches Existing Record</p>
                                    <p className="text-xs font-medium text-indigo-700">{item.matchDoctorName}</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col gap-2 shrink-0 items-end">
                                <div className="flex gap-1.5">
                                  <button onClick={() => { setEditModeId(item.id); setEditDraft({ ...item }); }} className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg bg-white text-slate-500 hover:text-teal-600 hover:border-teal-200 transition-all shadow-sm">✎</button>
                                  <button onClick={() => runReviewAction("doctor", item.id, "approve")} className="w-8 h-8 flex items-center justify-center border border-green-200 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-all shadow-sm font-bold">✓</button>
                                  <button onClick={() => runReviewAction("doctor", item.id, "reject")} className="w-8 h-8 flex items-center justify-center border border-red-200 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all shadow-sm font-bold">×</button>
                                </div>
                                <div className="text-right">
                                  <span className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase rounded-full border ${item.applyStatus === "approved" ? "bg-green-100 text-green-800 border-green-200" : item.applyStatus === "rejected" ? "bg-red-100 text-red-800 border-red-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                                    {item.applyStatus}
                                  </span>
                                  {item.consultationFee && <div className="mt-1 font-bold text-slate-700 text-xs">₹{item.consultationFee}</div>}
                                </div>
                              </div>
                            </div>
                            {(item.opdTiming || (item.consultationDays && item.consultationDays.length > 0)) && (
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                <span className="font-bold text-slate-400 uppercase">Availability:</span>
                                <span>{item.opdTiming || (Array.isArray(item.consultationDays) ? item.consultationDays.join(", ") : "")}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Packages */}
              <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-800">Hospital Packages</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => bulkReviewAction("package", "approve")} disabled={ingestionBusy} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded border border-green-200 hover:bg-green-100 font-medium">✓ All</button>
                    <span className="px-2 py-1 bg-slate-200 text-slate-800 text-xs font-bold rounded-md">{details.packageCandidates.length}</span>
                  </div>
                </div>
                <div className="flex-1 p-0 overflow-y-auto max-h-[500px]">
                  <ul className="divide-y divide-slate-100">
                    {details.packageCandidates.map((item) => (
                      <li key={item.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                        {editModeId === item.id ? (
                          <div className="space-y-2">
                            <input className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-teal-500 outline-none" value={editDraft.packageName || ""} onChange={(e) => setEditDraft({ ...editDraft, packageName: e.target.value })} placeholder="Package Name" />
                            <input className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-teal-500 outline-none" value={editDraft.department || ""} onChange={(e) => setEditDraft({ ...editDraft, department: e.target.value })} placeholder="Department" />
                            <div className="flex gap-2">
                              <input type="number" className="w-1/2 p-2 border border-slate-300 rounded text-sm focus:ring-teal-500 outline-none" value={editDraft.priceMin || ""} onChange={(e) => setEditDraft({ ...editDraft, priceMin: Number(e.target.value) })} placeholder="Min ₹" />
                              <input type="number" className="w-1/2 p-2 border border-slate-300 rounded text-sm focus:ring-teal-500 outline-none" value={editDraft.priceMax || ""} onChange={(e) => setEditDraft({ ...editDraft, priceMax: Number(e.target.value) })} placeholder="Max ₹" />
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => runReviewAction("package", item.id, "edit", editDraft)} className="flex-1 py-1.5 bg-teal-600 text-white text-xs rounded hover:bg-teal-700">Save</button>
                              <button onClick={() => setEditModeId(null)} className="flex-1 py-1.5 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {item.outlierFlags.length > 0 && <div className="mb-1">{item.outlierFlags.map((f) => <FlagBadge key={f} flag={f} />)}</div>}
                            <div className="flex justify-between">
                              <div>
                                <p className="font-bold text-slate-800">{item.packageName}</p>
                                <p className="text-sm text-slate-500">{item.department ?? "General"} • ₹{item.priceMin ?? "?"} - ₹{item.priceMax ?? "?"}</p>
                                <span className={`inline-block mt-1 px-2 py-0.5 text-[0.65rem] font-bold uppercase rounded ${item.applyStatus === "approved" ? "bg-green-100 text-green-700" : item.applyStatus === "rejected" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>{item.applyStatus}</span>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <button onClick={() => { setEditModeId(item.id); setEditDraft({ packageName: item.packageName, department: item.department, priceMin: item.priceMin, priceMax: item.priceMax }); }} className="px-2 py-1 text-xs border border-slate-200 rounded text-slate-600 hover:bg-slate-50">Edit</button>
                                <div className="flex gap-1.5">
                                  <button onClick={() => runReviewAction("package", item.id, "approve")} className="w-7 h-7 flex items-center justify-center bg-green-50 text-green-600 border border-green-200 rounded font-bold hover:bg-green-100" title="Approve">✓</button>
                                  <button onClick={() => runReviewAction("package", item.id, "reject")} className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-600 border border-red-200 rounded font-bold hover:bg-red-100" title="Reject">×</button>
                                  <button onClick={() => runReviewAction("package", item.id, "delete")} className="w-7 h-7 flex items-center justify-center bg-slate-100 text-slate-500 border border-slate-200 rounded hover:bg-slate-200" title="Delete">🗑</button>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Services */}
              <div className="md:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-800">Extracted Services & Facilities</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => bulkReviewAction("service", "approve")} disabled={ingestionBusy} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded border border-green-200 hover:bg-green-100 font-medium">✓ All</button>
                    <button onClick={() => bulkReviewAction("service", "reject")} disabled={ingestionBusy} className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded border border-red-200 hover:bg-red-100 font-medium">✗ All</button>
                    <span className="px-2 py-1 bg-slate-200 text-slate-800 text-xs font-bold rounded-md">{details.serviceCandidates.length}</span>
                  </div>
                </div>
                <div className="p-4">
                  {details.serviceCandidates.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No services extracted for this job.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {details.serviceCandidates.map((svc) => (
                        <div
                          key={svc.id}
                          className={`group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                            svc.applyStatus === "approved"
                              ? "bg-green-50 border-green-200 text-green-800"
                              : svc.applyStatus === "rejected"
                              ? "bg-red-50 border-red-200 text-red-400 line-through"
                              : "bg-white border-slate-200 text-slate-700 hover:border-teal-300"
                          }`}
                        >
                          <span>{svc.serviceName}</span>
                          {svc.category && <span className="text-xs text-slate-400">({svc.category})</span>}
                          <div className="hidden group-hover:flex items-center gap-1 ml-1">
                            <button onClick={() => runReviewAction("service", svc.id, "approve")} className="w-5 h-5 flex items-center justify-center bg-green-100 text-green-600 rounded text-xs hover:bg-green-200">✓</button>
                            <button onClick={() => runReviewAction("service", svc.id, "reject")} className="w-5 h-5 flex items-center justify-center bg-red-100 text-red-600 rounded text-xs hover:bg-red-200">✗</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        </>)}

        {/* ── TAXONOMY TAB ─────────────────────────────────────────────────── */}
        {activeTab === "taxonomy" && (<>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Taxonomy Node */}
          <article className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Create Taxonomy Node</h2>
              <p className="text-slate-500 text-xs mt-0.5">Add specialties, treatments, symptoms, or procedures.</p>
            </div>
            <div className="p-5 flex-1 flex flex-col gap-4">
              {createTaxoMsg && <Toast msg={createTaxoMsg} />}
              <form onSubmit={onCreateTaxonomy} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Type</label>
                  <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" value={nodeType} onChange={(e) => setNodeType(e.target.value)}>
                    <option value="specialty">Specialty</option>
                    <option value="treatment">Treatment</option>
                    <option value="symptom">Symptom</option>
                    <option value="procedure">Procedure</option>
                    <option value="department">Department</option>
                    <option value="facility">Facility</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Title *</label>
                  <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" value={nodeTitle} onChange={(e) => setNodeTitle(e.target.value)} placeholder="e.g., Cardiology" required />
                  {nodeTitle && (
                    <p className="mt-1.5 text-xs text-slate-400 font-mono"><span className="text-slate-300">slug:</span> {slugPreview}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Description</label>
                  <textarea className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none resize-none text-sm" value={nodeDescription} onChange={(e) => setNodeDescription(e.target.value)} placeholder="Brief description (optional)" rows={2} />
                </div>
                <button type="submit" disabled={createTaxoBusy} className="w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {createTaxoBusy ? <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Adding...</> : "+ Add Node"}
                </button>
              </form>
            </div>
          </article>

          {/* Taxonomy Node List */}
          <section className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-800">All Taxonomy Nodes</h2>
                <p className="text-slate-500 text-xs mt-0.5">{initialNodes.length} nodes total</p>
              </div>
            </div>
            <div className="p-4">
              {/* Group by type */}
              {(["specialty", "treatment", "symptom", "procedure", "department", "facility"] as const).map((t) => {
                const group = initialNodes.filter((n) => n.type === t);
                if (!group.length) return null;
                return (
                  <div key={t} className="mb-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                      {t}
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">{group.length}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.map((n) => (
                        <span
                          key={n.id}
                          className={`inline-flex items-center px-3 py-1 rounded-lg border text-xs font-medium ${
                            n.isActive
                              ? "bg-white border-slate-200 text-slate-700"
                              : "bg-slate-50 border-slate-100 text-slate-400 line-through"
                          }`}
                        >
                          {n.title}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
              {initialNodes.length === 0 && (
                <p className="text-slate-400 text-sm italic text-center py-8">No taxonomy nodes yet. Add one using the form.</p>
              )}
            </div>
          </section>
        </div>

        </>)}

        {/* ── AI RESEARCH TAB ──────────────────────────────────────────────── */}
        {activeTab === "ai_research" && (<>
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/60">
              <h2 className="text-xl font-bold text-slate-800">AI Research Agent</h2>
              <p className="text-slate-500 text-sm mt-0.5">Use Gemini with Google Search Grounding to discover hospitals and doctors.</p>
            </div>
            <form onSubmit={onRunAgentResearch} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Research Query *</label>
                  <input
                    required
                    value={agentQuery}
                    onChange={(e) => setAgentQuery(e.target.value)}
                    placeholder="e.g. top cardiac hospitals in Mumbai, best orthopedic surgeons Delhi"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">City (optional)</label>
                  <input
                    value={agentCity}
                    onChange={(e) => setAgentCity(e.target.value)}
                    placeholder="e.g. Pune"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50"
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <input
                    id="autoQueue"
                    type="checkbox"
                    checked={agentAutoQueue}
                    onChange={(e) => setAgentAutoQueue(e.target.checked)}
                    className="w-4 h-4 accent-teal-600"
                  />
                  <label htmlFor="autoQueue" className="text-sm font-medium text-slate-700">Auto-queue discovered URLs for ingestion</label>
                </div>
              </div>

              {agentError && (
                <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{agentError}</div>
              )}

              <button
                type="submit"
                disabled={agentBusy}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {agentBusy ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Researching...</> : "🔍 Run AI Research"}
              </button>
            </form>
          </section>

          {agentResult && (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-800">Results for: <span className="text-teal-700">"{agentResult.query}"</span></h3>
                  <p className="text-sm text-slate-500 mt-0.5">{agentResult.entities.length} entities found · {agentResult.queuedCount} URLs queued</p>
                </div>
                {agentResult.entities.length > 0 && (
                  <button
                    type="button"
                    disabled={agentBatchBusy || brochureApplyBusy}
                    onClick={onBatchSaveAll}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2 text-sm"
                  >
                    {agentBatchBusy
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving all...</>
                      : `💾 Save All to DB (${agentResult.entities.length})`}
                  </button>
                )}
              </div>

              {agentResult.groundedSummary && (
                <div className="px-5 py-4 bg-blue-50 border-b border-blue-100">
                  <p className="text-xs font-semibold text-blue-700 mb-1">AI Grounded Summary</p>
                  <p className="text-sm text-blue-800 whitespace-pre-line">{agentResult.groundedSummary}</p>
                </div>
              )}

              {/* Batch save result */}
              {(agentBatchResult || agentBatchError) && (
                <div className="px-5 py-4 border-b border-slate-100 space-y-3">
                  {agentBatchError && (
                    <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{agentBatchError}</div>
                  )}
                  {agentBatchResult && (
                    <>
                      <div className="flex flex-wrap gap-3">
                        {agentBatchResult.saved.hospitals.length > 0 && (
                          <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                            <p className="text-xs font-bold text-emerald-700 mb-1">🏥 Hospitals/Clinics</p>
                            {agentBatchResult.saved.hospitals.map((h) => (
                              <p key={h.id} className="text-xs text-emerald-800">
                                <span className={`inline-block w-14 font-semibold ${h.action === "created" ? "text-emerald-600" : "text-blue-600"}`}>{h.action === "created" ? "+ Created" : "↺ Updated"}</span>
                                {h.name}
                              </p>
                            ))}
                          </div>
                        )}
                        {agentBatchResult.saved.doctors.length > 0 && (
                          <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                            <p className="text-xs font-bold text-emerald-700 mb-1">👨‍⚕️ Doctors</p>
                            {agentBatchResult.saved.doctors.map((d) => (
                              <p key={d.id} className="text-xs text-emerald-800">
                                <span className={`inline-block w-14 font-semibold ${d.action === "created" ? "text-emerald-600" : "text-blue-600"}`}>{d.action === "created" ? "+ Created" : "↺ Updated"}</span>
                                {d.name}
                                {d.linkedHospital && <span className="text-slate-500 ml-1">→ {d.linkedHospital}</span>}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      {agentBatchResult.errors.length > 0 && (
                        <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                          <p className="text-xs font-bold text-red-700 mb-1">Errors</p>
                          {agentBatchResult.errors.map((e, i) => (
                            <p key={i} className="text-xs text-red-600">{e}</p>
                          ))}
                        </div>
                      )}
                      {/* Ambiguous hospitals — needs user input */}
                      {agentBatchResult.ambiguous.length > 0 && (
                        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
                          <p className="text-sm font-bold text-amber-800">
                            {agentBatchResult.ambiguous.length} hospital{agentBatchResult.ambiguous.length > 1 ? "s" : ""} need your input — multiple matches found
                          </p>
                          {agentBatchResult.ambiguous.map((item) => {
                            const key = `${item.name}-${item.city}`;
                            const searchQuery = ambiguousSearchQueries[key] || "";
                            const searchResults = ambiguousSearchResults[key] || [];
                            const isSearching = ambiguousSearchLoading[key] || false;
                            
                            return (
                            <div key={key} className="bg-white border border-amber-200 rounded-xl p-3 space-y-2">
                  <p className="text-sm font-semibold text-slate-800">"{item.name}" <span className="text-slate-400 text-xs font-normal">in {item.city}</span></p>
                              
                              {/* Search field */}
                              <div className="pb-2 border-b border-amber-100">
                                <input
                                  type="text"
                                  placeholder="🔍 Search all hospitals..."
                                  value={searchQuery}
                                  onChange={(e) => onSearchAmbiguousHospitals(key, e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                                />
                              </div>
                              
                              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                                {/* Show search results if searching */}
                                {searchQuery.trim().length > 0 ? (
                                  <>
                                    {isSearching ? (
                                      <p className="text-xs text-slate-400 py-2">Searching...</p>
                                    ) : searchResults.length > 0 ? (
                                      <>
                                        <p className="text-xs font-semibold text-slate-600 px-1">Search Results ({searchResults.length})</p>
                                        {searchResults.map((c) => (
                                          <div key={c.id} className="flex items-center justify-between gap-2 px-1.5 py-1 hover:bg-slate-50 rounded">
                                            <div className="min-w-0">
                                              <p className="text-xs font-medium text-slate-700 truncate">{c.name}</p>
                                              <p className="text-xs text-slate-400">{c.city}{c.state ? `, ${c.state}` : ""}</p>
                                            </div>
                                            <button
                                              type="button"
                                              disabled={brochureApplyBusy}
                                              onClick={() => onResolveAmbiguous(item.name, item.city, c.id)}
                                              className="shrink-0 px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
                                            >
                                              Update This
                                            </button>
                                          </div>
                                        ))}
                                      </>
                                    ) : (
                                      <p className="text-xs text-slate-400 py-2">No hospitals found matching "{searchQuery}"</p>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-center justify-between px-1 pt-1">
                                      <p className="text-xs font-semibold text-slate-600">AI Suggested Matches</p>
                                      <button 
                                        onClick={() => onSearchAmbiguousHospitals(key, " ")} 
                                        className="text-[10px] text-teal-600 font-bold hover:underline uppercase"
                                      >
                                        Browse All
                                      </button>
                                    </div>
                                    {item.candidates.map((c) => (
                                      <div key={c.id} className="flex items-center justify-between gap-2 px-1.5 py-1 hover:bg-slate-50 rounded">
                                        <div className="min-w-0">
                                          <p className="text-xs font-medium text-slate-700 truncate">{c.name}</p>
                                          <p className="text-xs text-slate-400">{c.city}{c.state ? `, ${c.state}` : ""}</p>
                                        </div>
                                        <button
                                          type="button"
                                          disabled={brochureApplyBusy}
                                          onClick={() => onResolveAmbiguous(item.name, item.city, c.id)}
                                          className="shrink-0 px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
                                        >
                                          Update This
                                        </button>
                                      </div>
                                    ))}
                                  </>
                                )}
                              </div>
                              
                              <button
                                type="button"
                                disabled={brochureApplyBusy}
                                onClick={() => onCreateAmbiguousAsNew(item.name, item.city)}
                                className="w-full py-1.5 border border-slate-200 hover:border-slate-400 text-slate-500 text-xs rounded-lg transition-colors disabled:opacity-60"
                              >
                                + Create as New
                              </button>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="p-5">
                {brochureApplyError && (
                  <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{brochureApplyError}</div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agentResult.entities.map((entity, idx) => {
                    const isSaved = agentBatchResult?.saved.hospitals.some((h) => h.name === entity.name) ||
                      agentBatchResult?.saved.doctors.some((d) => d.name === entity.name);
                    const isAmbiguous = agentBatchResult?.ambiguous.some((a) => a.name === entity.name);
                    const isDoctor = ["doctor", "physician", "surgeon", "dr."].some((t) => entity.type.toLowerCase().includes(t));
                    const isSaving = agentSavingIdx === idx && brochureApplyBusy;
                    const perEntityResult = agentSaveResults[idx];
                    return (
                      <div key={idx} className={`border rounded-xl p-4 transition-colors flex flex-col gap-2 ${isSaved || perEntityResult?.ok ? "border-emerald-300 bg-emerald-50/40" : isAmbiguous ? "border-amber-300 bg-amber-50/40" : "border-slate-200 hover:border-teal-300"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-slate-800 text-sm">{entity.name}</h4>
                          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${isDoctor ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{entity.type}</span>
                        </div>
                        {entity.city && <p className="text-xs text-slate-500">📍 {entity.city}</p>}
                        {entity.phone && <p className="text-xs text-slate-500">📞 {entity.phone}</p>}
                        {entity.snippet && <p className="text-xs text-slate-600 line-clamp-3">{entity.snippet}</p>}
                        {entity.website && (
                          <a href={entity.website} target="_blank" rel="noreferrer" className="text-xs text-teal-700 font-medium hover:underline break-all">
                            {entity.website}
                          </a>
                        )}
                        <div className="mt-auto pt-1">
                          {isSaved || perEntityResult?.ok ? (
                            <p className="text-xs text-emerald-700 font-semibold">✓ Saved to database</p>
                          ) : isAmbiguous ? (
                            <p className="text-xs text-amber-600 font-semibold">⚠ Needs your input (see above)</p>
                          ) : (
                            <button
                              type="button"
                              disabled={brochureApplyBusy || agentBatchBusy}
                              onClick={() => onSaveAgentEntity(entity, idx)}
                              className="w-full py-1.5 px-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                            >
                              {isSaving
                                ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                                : "💾 Save to DB"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {agentResult.queuedItems.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-slate-100">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Queued for Ingestion ({agentResult.queuedItems.length})</p>
                    <div className="space-y-1">
                      {agentResult.queuedItems.map((item) => (
                        <div key={item.id} className="text-xs text-slate-600 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-teal-500 rounded-full shrink-0" />
                          <span className="font-medium">{item.sourceTitle ?? "—"}</span>
                          <span className="text-slate-400 truncate">{item.sourceUrl}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </>)}

        {/* ── BROCHURE EXTRACTOR TAB ───────────────────────────────────────── */}
        {activeTab === "brochure" && (<>
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Brochure / Document Extractor</h2>
                  <p className="text-slate-500 text-sm mt-0.5">Paste text or upload a PDF / image. AI will extract structured hospital data.</p>
                </div>
                {/* Mode toggle */}
                <div className="flex items-center bg-slate-100 rounded-xl p-1 self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => { setBrochureInputMode("text"); setBrochureFile(null); setBrochureFilePreview(null); }}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${brochureInputMode === "text" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    📝 Paste Text
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBrochureInputMode("file"); }}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${brochureInputMode === "file" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    📎 Upload / Scan
                  </button>
                </div>
              </div>
            </div>

            {/* ── TEXT MODE ── */}
            {brochureInputMode === "text" && (
              <form onSubmit={onExtractBrochure} className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Source Hint (optional)</label>
                    <input
                      value={brochureSourceHint}
                      onChange={(e) => setBrochureSourceHint(e.target.value)}
                      placeholder="e.g. Apollo Hospital website"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">City Hint (optional)</label>
                    <input
                      value={brochureCityHint}
                      onChange={(e) => setBrochureCityHint(e.target.value)}
                      placeholder="e.g. Mumbai"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Paste Document Text *</label>
                    <textarea
                      required
                      value={brochureText}
                      onChange={(e) => setBrochureText(e.target.value)}
                      placeholder="Paste the full text of the hospital brochure, website content, or any document here..."
                      rows={10}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50 resize-y font-mono"
                    />
                    <p className="text-xs text-slate-400 mt-1">{brochureText.length.toLocaleString()} / 60,000 characters</p>
                  </div>
                </div>

                {brochureError && (
                  <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{brochureError}</div>
                )}

                <button
                  type="submit"
                  disabled={brochureBusy || brochureText.length < 20}
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                  {brochureBusy ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Extracting...</> : "📄 Extract Data"}
                </button>
              </form>
            )}

            {/* ── FILE / UPLOAD MODE ── */}
            {brochureInputMode === "file" && (
              <form onSubmit={onScanFile} className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Source Hint (optional)</label>
                    <input
                      value={brochureSourceHint}
                      onChange={(e) => setBrochureSourceHint(e.target.value)}
                      placeholder="e.g. Apollo Hospital brochure"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">City Hint (optional)</label>
                    <input
                      value={brochureCityHint}
                      onChange={(e) => setBrochureCityHint(e.target.value)}
                      placeholder="e.g. Mumbai"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50"
                    />
                  </div>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setBrochureFileDragging(true); }}
                  onDragLeave={() => setBrochureFileDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setBrochureFileDragging(false);
                    const dropped = e.dataTransfer.files?.[0] ?? null;
                    onFileSelected(dropped);
                  }}
                  onClick={() => { document.getElementById("brochure-file-input")?.click(); }}
                  className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl cursor-pointer transition-colors min-h-48 p-6 ${brochureFileDragging ? "border-teal-500 bg-teal-50" : brochureFile ? "border-teal-300 bg-teal-50/40" : "border-slate-200 hover:border-teal-400 bg-slate-50/60"}`}
                >
                  <input
                    id="brochure-file-input"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,image/*,application/pdf"
                    className="sr-only"
                    onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
                  />

                  {brochureFile ? (
                    <>
                      {brochureFilePreview ? (
                        /* Image preview */
                        <img src={brochureFilePreview} alt="preview" className="max-h-40 rounded-xl object-contain border border-slate-200 shadow-sm" />
                      ) : (
                        /* PDF / non-image icon */
                        <div className="w-16 h-20 flex flex-col items-center justify-center bg-red-50 border border-red-200 rounded-lg shadow-sm">
                          <span className="text-2xl">📄</span>
                          <span className="text-xs text-red-600 font-semibold mt-1">PDF</span>
                        </div>
                      )}
                      <p className="text-sm font-medium text-slate-700 text-center">{brochureFile.name}</p>
                      <p className="text-xs text-slate-400">{(brochureFile.size / 1024 / 1024).toFixed(2)} MB · Click to change</p>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-2xl">📎</div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-slate-700">Drop file here or click to browse</p>
                        <p className="text-xs text-slate-400 mt-1">PDF, JPEG, PNG, WebP, HEIC · Max 12 MB</p>
                      </div>
                    </>
                  )}
                </div>

                {brochureError && (
                  <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{brochureError}</div>
                )}

                <button
                  type="submit"
                  disabled={brochureBusy || !brochureFile}
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                  {brochureBusy ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Scanning...</> : "🔍 Scan Document"}
                </button>
              </form>
            )}
          </section>

          {brochureResult && (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Extracted Data</h3>
                {typeof (brochureResult as any).confidence === "number" && (
                  <p className="text-sm text-slate-500 mt-0.5">AI Confidence: <span className={`font-semibold ${(brochureResult as any).confidence >= 0.7 ? "text-emerald-600" : "text-amber-600"}`}>{Math.round((brochureResult as any).confidence * 100)}%</span></p>
                )}
              </div>

              <div className="p-5 space-y-5">
                {/* Hospital */}
                {(brochureResult as any).hospital && (
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-2 text-sm uppercase tracking-wide">Hospital</h4>
                    <div className="border border-slate-200 rounded-xl p-4 space-y-1">
                      {Object.entries((brochureResult as any).hospital).map(([key, val]) => (
                        val !== null && val !== undefined && !(Array.isArray(val) && (val as unknown[]).length === 0) ? (
                          <div key={key} className="flex gap-2 text-sm">
                            <span className="text-slate-400 font-medium w-32 shrink-0">{key}:</span>
                            <span className="text-slate-700">{Array.isArray(val) ? (val as unknown[]).join(", ") : typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
                          </div>
                        ) : null
                      ))}
                    </div>
                  </div>
                )}

                {/* Doctors */}
                {Array.isArray((brochureResult as any).doctors) && (brochureResult as any).doctors.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-2 text-sm uppercase tracking-wide">Doctors ({(brochureResult as any).doctors.length})</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {((brochureResult as any).doctors as Record<string, unknown>[]).map((doc, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-1">
                          {Object.entries(doc).map(([key, val]) => (
                            val !== null && val !== undefined && !(Array.isArray(val) && (val as unknown[]).length === 0) ? (
                              <div key={key} className="flex gap-2 text-sm">
                                <span className="text-slate-400 font-medium w-28 shrink-0">{key}:</span>
                                <span className="text-slate-700">{Array.isArray(val) ? (val as unknown[]).join(", ") : String(val)}</span>
                              </div>
                            ) : null
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Packages */}
                {Array.isArray((brochureResult as any).packages) && (brochureResult as any).packages.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-2 text-sm uppercase tracking-wide">Packages ({(brochureResult as any).packages.length})</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {((brochureResult as any).packages as Record<string, unknown>[]).map((pkg, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-1">
                          {Object.entries(pkg).map(([key, val]) => (
                            val !== null && val !== undefined && !(Array.isArray(val) && (val as unknown[]).length === 0) ? (
                              <div key={key} className="flex gap-2 text-sm">
                                <span className="text-slate-400 font-medium w-28 shrink-0">{key}:</span>
                                <span className="text-slate-700">{Array.isArray(val) ? (val as unknown[]).join(", ") : String(val)}</span>
                              </div>
                            ) : null
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Services */}
                {Array.isArray((brochureResult as any).services) && (brochureResult as any).services.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-2 text-sm uppercase tracking-wide">Services</h4>
                    <div className="flex flex-wrap gap-2">
                      {((brochureResult as any).services as string[]).map((s, idx) => (
                        <span key={idx} className="px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-medium border border-teal-100">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {(brochureResult as any).notes && (
                  <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-semibold text-amber-700 mb-1">AI Notes</p>
                    <p className="text-sm text-amber-800">{String((brochureResult as any).notes)}</p>
                  </div>
                )}

                {/* Save to Database */}
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-0.5">Save to Database</p>
                    <p className="text-xs text-slate-400">Search and select an existing hospital to update, or save as a new hospital.</p>
                  </div>

                  {/* Hospital search picker */}
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        value={brochureHospitalSearch}
                        onChange={(e) => onBrochureHospitalSearchChange(e.target.value)}
                        placeholder="Search hospital by name or city to update existing…"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50 pr-8"
                      />
                      {brochureHospitalSearch && (
                        <button
                          type="button"
                          onClick={() => { setBrochureHospitalSearch(""); setBrochureHospitalSearchResults([]); setBrochureTargetHospital(null); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none"
                        >×</button>
                      )}
                    </div>

                    {/* Search results dropdown */}
                    {brochureHospitalSearchResults.length > 0 && !brochureTargetHospital && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        {brochureHospitalSearchResults.map((h) => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => {
                              setBrochureTargetHospital(h);
                              setBrochureHospitalSearch(h.name);
                              setBrochureHospitalSearchResults([]);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-teal-50 border-b border-slate-100 last:border-0 transition-colors"
                          >
                            <p className="text-sm font-semibold text-slate-800">{h.name}</p>
                            <p className="text-xs text-slate-500">{h.city}{h.state ? `, ${h.state}` : ""} · {h.slug}</p>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Selected hospital badge */}
                    {brochureTargetHospital && (
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-teal-50 border border-teal-200 rounded-xl">
                        <span className="text-teal-600 text-lg">🏥</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-teal-800">{brochureTargetHospital.name}</p>
                          <p className="text-xs text-teal-600">{brochureTargetHospital.city} · Will update this hospital</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setBrochureTargetHospital(null); setBrochureHospitalSearch(""); }}
                          className="text-teal-400 hover:text-teal-700 text-lg leading-none shrink-0"
                        >×</button>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={onApplyBrochure}
                      disabled={brochureApplyBusy}
                      className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {brochureApplyBusy
                        ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Checking...</>
                        : brochureTargetHospital
                          ? `👁 Preview Changes for "${brochureTargetHospital.name}"`
                          : "👁 Preview Changes"}
                    </button>
                  </div>

                  {brochureApplyError && (
                    <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{brochureApplyError}</div>
                  )}

                  {/* Candidates are shown in the global modal overlay below */}

                  {brochureApplyResult && (
                    <div className="px-4 py-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-emerald-600 text-lg">✓</span>
                        <p className="text-sm font-bold text-emerald-800">
                          Hospital {brochureApplyResult.hospitalAction === "created" ? "Created" : "Updated"} Successfully
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-emerald-700 mb-3">
                        <span>🏥 {brochureApplyResult.hospitalAction}</span>
                        {brochureApplyResult.doctorsCreated > 0 && <span>👨‍⚕️ {brochureApplyResult.doctorsCreated} doctors added</span>}
                        {brochureApplyResult.doctorsUpdated > 0 && <span>👨‍⚕️ {brochureApplyResult.doctorsUpdated} doctors updated</span>}
                        {brochureApplyResult.packagesUpserted > 0 && <span>📦 {brochureApplyResult.packagesUpserted} packages saved</span>}
                      </div>
                      <div className="flex gap-3">
                        <a
                          href={`/hospitals/${brochureApplyResult.hospitalSlug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-teal-700 hover:underline"
                        >
                          View Hospital Profile →
                        </a>
                        <button
                          type="button"
                          onClick={() => setActiveTab("hospitals")}
                          className="text-sm font-semibold text-teal-700 hover:underline"
                        >
                          Go to Hospitals Tab →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </>)}

        {/* ── CONTRIBUTIONS TAB ─────────────────────────────────────────── */}
        {activeTab === "contributions" && (
          <ContributionsTabContent />
        )}

        {/* ── KYC REQUESTS TAB ──────────────────────────────────────────── */}
        {activeTab === "kyc" && (
          <KycReviewTabContent myRole={me.role} />
        )}

        {/* ── CONFIG / FEATURE FLAGS TAB (Task 3.5) ──────────────────── */}
        {activeTab === "config" && (
          <ConfigTab
            flags={configFlags}
            loading={configLoading}
            msg={configMsg}
            togglingKey={togglingKey}
            onMount={async () => {
              setConfigLoading(true);
              try {
                const res = await fetch("/api/admin/config/flags");
                const body = await res.json();
                setConfigFlags(body.flags ?? []);
              } catch {
                setConfigMsg({ type: "error", text: "Failed to load feature flags" });
              } finally {
                setConfigLoading(false);
              }
            }}
            onToggle={async (key, enabled) => {
              setTogglingKey(key);
              setConfigMsg(null);
              try {
                const res = await fetch("/api/admin/config/flags", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ key, enabled }),
                });
                if (!res.ok) throw new Error("Toggle failed");
                setConfigFlags((prev) =>
                  prev.map((f) => (f.key === key ? { ...f, enabled } : f)),
                );
                setConfigMsg({ type: "success", text: `"${key}" ${enabled ? "enabled" : "disabled"}` });
              } catch {
                setConfigMsg({ type: "error", text: "Failed to update flag" });
              } finally {
                setTogglingKey(null);
                setTimeout(() => setConfigMsg(null), 3000);
              }
            }}
          />
        )}

        {/* Access moved to /admin/access */}

        {/* ── PATIENTS TAB ─────────────────────────────────────────────── */}
        {activeTab === "patients" && (
          <AdminPatientsTab />
        )}

        {/* ── APPOINTMENTS TAB ─────────────────────────────────────────── */}
        {activeTab === "appointments" && (
          <AdminAppointmentsTab />
        )}

        {/* ── PROVIDERS TAB ────────────────────────────────────────────── */}
        {activeTab === "providers" && (
          <AdminProvidersTab />
        )}

      </div>

      {/* ── Candidates Picker Modal (works from any tab) ─────────────────── */}
      {brochureCandidates && brochureCandidateMeta && !brochureConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9997] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Which hospital does this belong to?</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Extracted: <strong>"{brochureCandidateMeta.extractedName}"</strong>
                  {brochureCandidateMeta.extractedCity && <> in <strong>{brochureCandidateMeta.extractedCity}</strong></>}.
                  {brochureCandidates.length > 0 ? " Similar hospitals found — select one to preview changes, or create new." : " No similar hospitals found."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBrochureCandidates(null)}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none shrink-0 mt-0.5"
              >×</button>
            </div>
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {brochureCandidates.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-4 py-3 hover:border-teal-300 transition-colors bg-white">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.city}{c.state ? `, ${c.state}` : ""}{c.phone ? ` · ${c.phone}` : ""}</p>
                    <span className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${c.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={brochureApplyBusy}
                    onClick={() => { setBrochureCandidates(null); onApplyWithTarget(c.id); }}
                    className="shrink-0 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
                  >
                    {brochureApplyBusy ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : "Preview & Update"}
                  </button>
                </div>
              ))}
            </div>
            <div className="px-4 pb-4">
              <button
                type="button"
                disabled={brochureApplyBusy}
                onClick={() => { setBrochureCandidates(null); onApplyForceCreate(); }}
                className="w-full py-2.5 border border-slate-200 hover:border-slate-400 text-slate-600 hover:text-slate-800 text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
              >
                + Create as New Hospital
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Brochure Diff Confirmation Modal ─────────────────────────────── */}
      {brochureConfirmOpen && brochureDiff && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9998] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {brochureDiff.hospitalAction === "created" ? "Create New Hospital" : "Confirm Changes"}
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Review what will be {brochureDiff.hospitalAction === "created" ? "created" : "added / updated"} before saving.
                  <span className="ml-1 font-medium text-amber-700">Existing data will NOT be removed.</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBrochureConfirmOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none shrink-0 mt-0.5"
              >×</button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto p-6 space-y-5 flex-1">

              {/* Hospital arrays */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hospital Data</h4>

                {brochureDiff.hospital.addedSpecialties.length > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-2">+ {brochureDiff.hospital.addedSpecialties.length} new specialties will be added</p>
                    <div className="flex flex-wrap gap-1.5">
                      {brochureDiff.hospital.addedSpecialties.map((s) => (
                        <span key={s} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-xs font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {brochureDiff.hospital.dupSpecialties.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold text-slate-500 mb-2">✓ {brochureDiff.hospital.dupSpecialties.length} specialties already exist (skipped)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {brochureDiff.hospital.dupSpecialties.map((s) => (
                        <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {brochureDiff.hospital.addedFacilities.length > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-2">+ {brochureDiff.hospital.addedFacilities.length} new facilities will be added</p>
                    <div className="flex flex-wrap gap-1.5">
                      {brochureDiff.hospital.addedFacilities.map((f) => (
                        <span key={f} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-xs font-medium">{f}</span>
                      ))}
                    </div>
                  </div>
                )}

                {brochureDiff.hospital.addedAccreditations.length > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-2">+ {brochureDiff.hospital.addedAccreditations.length} new accreditations will be added</p>
                    <div className="flex flex-wrap gap-1.5">
                      {brochureDiff.hospital.addedAccreditations.map((a) => (
                        <span key={a} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-xs font-medium">{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {brochureDiff.hospital.fieldFills.length > 0 && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                    <p className="text-xs font-semibold text-blue-700 mb-2">+ {brochureDiff.hospital.fieldFills.length} empty fields will be filled in</p>
                    <div className="space-y-1">
                      {brochureDiff.hospital.fieldFills.map(({ field, value }) => (
                        <div key={field} className="flex gap-2 text-xs">
                          <span className="text-blue-500 font-medium w-24 shrink-0">{field}:</span>
                          <span className="text-blue-800 truncate">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {brochureDiff.hospital.addedSpecialties.length === 0 &&
                  brochureDiff.hospital.addedFacilities.length === 0 &&
                  brochureDiff.hospital.addedAccreditations.length === 0 &&
                  brochureDiff.hospital.fieldFills.length === 0 && (
                  <p className="text-sm text-slate-400 italic">No new hospital data to add.</p>
                )}
              </div>

              {/* Doctors */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Doctors ({brochureDiff.doctors.new.length + brochureDiff.doctors.existing.length} total)
                </h4>
                {brochureDiff.doctors.new.length > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-2">+ {brochureDiff.doctors.new.length} new doctors will be created</p>
                    <div className="space-y-1">
                      {brochureDiff.doctors.new.map((d) => (
                        <div key={d.fullName} className="flex gap-2 text-xs">
                          <span className="font-medium text-emerald-800">{d.fullName}</span>
                          {d.specialization && <span className="text-emerald-600">· {d.specialization}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {brochureDiff.doctors.existing.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold text-slate-500 mb-2">✓ {brochureDiff.doctors.existing.length} doctors already exist — qualifications will be merged, empty fields filled</p>
                    <div className="flex flex-wrap gap-1.5">
                      {brochureDiff.doctors.existing.map((d) => (
                        <span key={d.id} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{d.fullName}</span>
                      ))}
                    </div>
                  </div>
                )}
                {brochureDiff.doctors.new.length === 0 && brochureDiff.doctors.existing.length === 0 && (
                  <p className="text-sm text-slate-400 italic">No doctors in extracted data.</p>
                )}
              </div>

              {/* Packages */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Packages ({brochureDiff.packages.new.length + brochureDiff.packages.existing.length} total)
                </h4>
                {brochureDiff.packages.new.length > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-2">+ {brochureDiff.packages.new.length} new packages will be created</p>
                    <div className="space-y-1.5">
                      {brochureDiff.packages.new.map((p) => (
                        <div key={p.packageName} className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-emerald-800">{p.packageName}</span>
                          {p.department && <span className="text-emerald-600 shrink-0">· {p.department}</span>}
                          {(p.priceMin || p.priceMax) && (
                            <span className="text-emerald-600 shrink-0">· ₹{p.priceMin ?? "–"}–{p.priceMax ?? "–"}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {brochureDiff.packages.existing.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold text-slate-500 mb-2">✓ {brochureDiff.packages.existing.length} packages already exist — pricing will be updated if missing</p>
                    <div className="flex flex-wrap gap-1.5">
                      {brochureDiff.packages.existing.map((p) => (
                        <span key={p.id} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{p.packageName}</span>
                      ))}
                    </div>
                  </div>
                )}
                {brochureDiff.packages.new.length === 0 && brochureDiff.packages.existing.length === 0 && (
                  <p className="text-sm text-slate-400 italic">No packages in extracted data.</p>
                )}
              </div>

            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap gap-3 justify-end shrink-0 bg-slate-50/60 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setBrochureConfirmOpen(false)}
                className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium rounded-xl transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmApply}
                disabled={brochureApplyBusy}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2 text-sm"
              >
                {brochureApplyBusy
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                  : brochureDiff.hospitalAction === "created" ? "✓ Confirm & Create Hospital" : "✓ Confirm & Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Overlay */}
      {ingestionBusy && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-8 text-center">
            <div className="mb-6 relative">
              <div className="w-24 h-24 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin mx-auto" />
              <div className="absolute inset-0 flex items-center justify-center font-bold text-slate-700">
                {ingestionProgressPercent}%
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">AI Data Mission in Progress</h3>
            <p className="text-slate-500 text-sm mb-6">{ingestionProgressTask || "Gathering initial data..."}</p>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div className="bg-teal-600 h-full transition-all duration-500 ease-out" style={{ width: `${ingestionProgressPercent}%` }} />
            </div>
            <p className="mt-4 text-xs text-slate-400 italic">This may take up to 2 minutes depending on the website size.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRIBUTIONS TAB — AI-driven bulk edit review
// ═══════════════════════════════════════════════════════════════════════════════

type ContribRow = {
  id: string;
  targetType: string;
  targetId: string;
  entityName: string;
  fieldChanged: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown>;
  outlierScore: number | null;
  outlierFlags: string[] | null;
  status: string;
  contributorId: string | null;
  createdAt: Date | null;
};

type AIReview = {
  id: string;
  recommendation: "approve" | "reject" | "manual_review";
  confidence: number;
  reason: string;
};

type OutlierThresholds = {
  autoApproveMaxScore: number;
  autoApproveMinTrust: number;
  autoRejectMinScore: number;
  massEditBurstLimit: number;
  feeOutlierMax: number;
  feeOutlierMin: number;
  semanticSuspiciousWeight: number;
};

function ThresholdPanel() {
  const [thresholds, setThresholds] = useState<OutlierThresholds | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d: { data: OutlierThresholds }) => setThresholds(d.data))
      .catch(() => null);
  }, []);

  async function save() {
    if (!thresholds) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(thresholds),
      });
      if (res.ok) setMsg("Thresholds saved.");
      else setMsg("Save failed.");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  function numField(label: string, key: keyof OutlierThresholds) {
    if (!thresholds) return null;
    return (
      <label key={key} className="flex flex-col gap-1 text-xs text-slate-400">
        {label}
        <input
          type="number"
          className="px-2 py-1 rounded bg-slate-800 border border-slate-600 text-white text-sm"
          value={thresholds[key]}
          onChange={(e) =>
            setThresholds((prev) => (prev ? { ...prev, [key]: Number(e.target.value) } : prev))
          }
        />
      </label>
    );
  }

  return (
    <div className="mb-4 border border-slate-700 rounded-xl">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 rounded-xl"
        onClick={() => setOpen((p) => !p)}
      >
        <span>⚙️ Outlier Threshold Configuration</span>
        <span className="text-slate-500 text-xs">{open ? "▲ hide" : "▼ show"}</span>
      </button>
      {open && thresholds ? (
        <div className="px-4 pb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {numField("Auto-approve if score below", "autoApproveMaxScore")}
          {numField("Auto-approve min trust score", "autoApproveMinTrust")}
          {numField("Auto-reject if score ≥", "autoRejectMinScore")}
          {numField("Mass edit burst limit (per hr)", "massEditBurstLimit")}
          {numField("Fee outlier max (₹)", "feeOutlierMax")}
          {numField("Fee outlier min (₹)", "feeOutlierMin")}
          {numField("AI semantic suspicious weight", "semanticSuspiciousWeight")}
          <div className="col-span-full flex items-center gap-3 mt-2">
            <button
              type="button"
              className="px-4 py-1.5 rounded bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Thresholds"}
            </button>
            {msg ? <span className="text-sm text-emerald-400">{msg}</span> : null}
          </div>
        </div>
      ) : open ? (
        <p className="px-4 pb-4 text-sm text-slate-400">Loading…</p>
      ) : null}
    </div>
  );
}

function ContributionsTabContent() {
  const [contributions, setContributions] = useState<ContribRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiReviews, setAiReviews] = useState<Map<string, AIReview>>(new Map());
  const [reviewLoading, setReviewLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [toast, setToast] = useState<string | null>(null);

  async function loadContributions() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/contributions/ai-review?status=${statusFilter}&limit=50`);
      const data = (await res.json()) as { data: ContribRow[] };
      setContributions(data.data ?? []);
      setSelected(new Set());
      setAiReviews(new Map());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadContributions(); }, [statusFilter]);

  async function runAiReview() {
    const ids = selected.size > 0 ? [...selected] : contributions.map((c) => c.id);
    if (!ids.length) return;
    setReviewLoading(true);
    try {
      const res = await fetch("/api/admin/contributions/ai-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ids.slice(0, 30) }),
      });
      const data = (await res.json()) as { data: AIReview[] };
      const map = new Map<string, AIReview>();
      for (const r of data.data ?? []) map.set(r.id, r);
      setAiReviews(map);
    } finally {
      setReviewLoading(false);
    }
  }

  async function applyRecommendations(onlyRecommended: boolean) {
    const actions: Array<{ id: string; action: "approve" | "reject" }> = [];

    for (const [id, review] of aiReviews) {
      if (onlyRecommended && review.recommendation === "manual_review") continue;
      if (review.recommendation === "manual_review") continue;
      const action = review.recommendation;
      actions.push({ id, action });
    }

    if (!actions.length) { setToast("No AI-reviewed items to apply."); return; }

    setApplying(true);
    try {
      const res = await fetch("/api/admin/contributions/ai-review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions }),
      });
      const data = (await res.json()) as { data: { approved: number; rejected: number } };
      setToast(`Applied: ${data.data.approved} approved, ${data.data.rejected} rejected.`);
      void loadContributions();
    } finally {
      setApplying(false);
    }
  }

  const allSelected = contributions.length > 0 && selected.size === contributions.length;
  const reviewedCount = aiReviews.size;
  const autoApproveCount = [...aiReviews.values()].filter((r) => r.recommendation === "approve").length;
  const autoRejectCount = [...aiReviews.values()].filter((r) => r.recommendation === "reject").length;

  return (
    <div className="space-y-6">
      <ThresholdPanel />
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Community Contributions</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Google-verified crowd edits — AI-scored, awaiting your review
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["pending", "approved", "rejected", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${statusFilter === s ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {toast && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex justify-between">
            {toast}
            <button type="button" onClick={() => setToast(null)} className="text-emerald-600 font-bold">✕</button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => void runAiReview()}
            disabled={reviewLoading || contributions.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 disabled:opacity-50"
          >
            {reviewLoading ? "AI Reviewing..." : `🤖 AI Review ${selected.size > 0 ? `${selected.size} selected` : "all"}`}
          </button>

          {reviewedCount > 0 && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl text-xs font-medium text-slate-600 border border-slate-200">
                <span className="text-emerald-600 font-bold">✓ {autoApproveCount} approve</span>
                <span>·</span>
                <span className="text-red-600 font-bold">✕ {autoRejectCount} reject</span>
                <span>·</span>
                <span>{reviewedCount - autoApproveCount - autoRejectCount} manual</span>
              </div>
              <button
                type="button"
                onClick={() => void applyRecommendations(true)}
                disabled={applying}
                className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 disabled:opacity-50"
              >
                {applying ? "Applying..." : "Apply AI Decisions"}
              </button>
            </>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading contributions...</div>
        ) : contributions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm">No {statusFilter} contributions found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => {
                        setSelected(allSelected ? new Set() : new Set(contributions.map((c) => c.id)));
                      }}
                    />
                  </th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Entity</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Field</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">New Value</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Score</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">AI Review</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {contributions.map((c) => {
                  const review = aiReviews.get(c.id);
                  const newValStr = c.newValue
                    ? Object.values(c.newValue).map(String).join(", ").slice(0, 60)
                    : "—";
                  return (
                    <tr key={c.id} className={`hover:bg-slate-50 ${selected.has(c.id) ? "bg-blue-50" : ""}`}>
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={() => {
                            const next = new Set(selected);
                            next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                            setSelected(next);
                          }}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <p className="font-medium text-slate-800">{c.entityName}</p>
                        <p className="text-xs text-slate-400">{c.targetType}</p>
                      </td>
                      <td className="py-2 px-3 text-slate-600 font-mono text-xs">{c.fieldChanged}</td>
                      <td className="py-2 px-3 text-slate-700 max-w-[160px] truncate" title={newValStr}>{newValStr}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          (c.outlierScore ?? 0) < 30 ? "bg-emerald-100 text-emerald-700"
                          : (c.outlierScore ?? 0) < 70 ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                        }`}>
                          {c.outlierScore ?? "—"}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {review ? (
                          <div>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              review.recommendation === "approve" ? "bg-emerald-100 text-emerald-700"
                              : review.recommendation === "reject" ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                            }`}>
                              {review.recommendation} ({Math.round(review.confidence * 100)}%)
                            </span>
                            <p className="text-xs text-slate-400 mt-0.5 max-w-[200px] truncate" title={review.reason}>{review.reason}</p>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          c.status === "approved" ? "bg-emerald-100 text-emerald-700"
                          : c.status === "rejected" ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                        }`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Feature Flags Tab Component ────────────────────────────────────────────────

function ConfigTab({
  flags,
  loading,
  msg,
  togglingKey,
  onMount,
  onToggle,
}: {
  flags: Array<{ key: string; phase: string; enabled: boolean; description: string | null; complianceChecklist: string[] }>;
  loading: boolean;
  msg: { type: "success" | "error"; text: string } | null;
  togglingKey: string | null;
  onMount: () => void;
  onToggle: (key: string, enabled: boolean) => void;
}) {
  React.useEffect(() => { onMount(); }, []);

  const phaseBadge = (phase: string) => {
    const styles: Record<string, string> = {
      p1: "bg-emerald-100 text-emerald-700 border-emerald-200",
      p2: "bg-amber-100 text-amber-700 border-amber-200",
      p3: "bg-slate-100 text-slate-500 border-slate-200",
      unknown: "bg-purple-100 text-purple-700 border-purple-200",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${styles[phase] ?? styles.unknown}`}>
        {phase.toUpperCase()}
      </span>
    );
  };

  const grouped = ["p1", "p2", "p3"].map((phase) => ({
    phase,
    flags: flags.filter((f) => f.phase === phase),
  }));

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-slate-50/60">
        <h2 className="text-xl font-bold text-slate-800">⚙️ Configuration &amp; Feature Flags</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Toggle features per phase. P2/P3 flags should only be enabled after compliance gate checklist is complete.
        </p>
      </div>

      <div className="p-5">
        {msg && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium border ${
            msg.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
          }`}>
            {msg.type === "success" ? "✓" : "✗"} {msg.text}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading flags…</div>
        ) : (
          <div className="space-y-8">
            {grouped.map(({ phase, flags: phaseFlags }) => (
              <div key={phase}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Phase {phase.toUpperCase()} Flags
                </h3>
                <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                  {phaseFlags.map((flag) => (
                    <div key={flag.key} className="flex items-start gap-4 p-4 hover:bg-slate-50/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-slate-800">{flag.key}</span>
                          {phaseBadge(flag.phase)}
                          {flag.enabled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                              ● ON
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-100 text-slate-500 border-slate-200">
                              ○ OFF
                            </span>
                          )}
                        </div>
                        {flag.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{flag.description}</p>
                        )}
                        {!flag.enabled && flag.complianceChecklist.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-amber-600 font-semibold cursor-pointer select-none">
                              ⚠️ {flag.complianceChecklist.length} compliance gates must pass before enabling
                            </summary>
                            <ul className="mt-2 space-y-1">
                              {flag.complianceChecklist.map((item) => (
                                <li key={item} className="flex items-start gap-2 text-xs text-slate-600">
                                  <span className="text-slate-400 mt-0.5">□</span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggle(flag.key, !flag.enabled)}
                        disabled={togglingKey === flag.key}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          flag.enabled ? "bg-teal-600" : "bg-slate-200"
                        } ${togglingKey === flag.key ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                        role="switch"
                        aria-checked={flag.enabled}
                        aria-label={`Toggle ${flag.key}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                            flag.enabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
