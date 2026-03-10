"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Me = { fullName: string; email: string; role: string };
type Hospital = { id: string; name: string; city: string; slug: string; isActive: boolean };
type TaxonomyNode = { id: string; title: string; type: string; slug: string; isActive: boolean };

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
    mergeAction: string;
    matchHospitalId: string | null;
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
    consultationFee: number | null;
    mergeAction: string;
    matchDoctorId: string | null;
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

export default function AdminDashboardClient({ me, hospitals, nodes }: Props) {
  const router = useRouter();
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalCity, setHospitalCity] = useState("");
  const [nodeType, setNodeType] = useState("specialty");
  const [nodeTitle, setNodeTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [sourceUrl, setSourceUrl] = useState("");
  const [ingestionHospitalName, setIngestionHospitalName] = useState("");
  const [ingestionCity, setIngestionCity] = useState("");
  const [ingestionQuery, setIngestionQuery] = useState("");
  const [targetHospitalId, setTargetHospitalId] = useState("");
  const [jobIdInput, setJobIdInput] = useState("");
  const [ingestionBusy, setIngestionBusy] = useState(false);
  const [ingestionMessage, setIngestionMessage] = useState<string | null>(null);
  const [recentJobs, setRecentJobs] = useState<IngestionJob[]>([]);
  const [details, setDetails] = useState<IngestionDetails | null>(null);

  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult[]>([]);
  const [selectedDiscoveryLinks, setSelectedDiscoveryLinks] = useState<string[]>([]);
  const [researchQueue, setResearchQueue] = useState<ResearchQueueRow[]>([]);

  // Edit Mode state
  const [editModeId, setEditModeId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, any>>({});

  const selectedDiscoveryRows = useMemo(
    () => discoveryResults.filter((item) => selectedDiscoveryLinks.includes(item.link)),
    [discoveryResults, selectedDiscoveryLinks],
  );

  async function onCreateHospital(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const res = await fetch("/api/hospitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: hospitalName, city: hospitalCity }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to create hospital");
      return;
    }

    setHospitalName("");
    setHospitalCity("");
    router.refresh();
  }

  async function onCreateTaxonomy(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const res = await fetch("/api/taxonomy/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: nodeType, title: nodeTitle }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to create taxonomy node");
      return;
    }

    setNodeTitle("");
    router.refresh();
  }

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  async function onDeleteHospital(hospitalId: string, hospitalName: string) {
    if (!globalThis.confirm(`Are you sure you want to delete ${hospitalName}?`)) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/hospitals/${hospitalId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to delete hospital");
      return;
    }
    router.refresh();
  }

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

  async function onRunIngestion(event: FormEvent) {
    event.preventDefault();
    setIngestionBusy(true);
    setIngestionMessage(null);

    try {
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
        data?: { jobId: string; summary?: Record<string, unknown> };
        error?: string;
        message?: string;
        hint?: string;
        code?: string;
        retryable?: boolean;
      };

      if (!response.ok || !body.data) {
        const message = [
          body.code ? `[${body.code}]` : null,
          body.message ?? body.error ?? "Ingestion run failed.",
          body.hint ? `Hint: ${body.hint}` : null,
          body.retryable ? "You can retry after some time." : null,
        ]
          .filter(Boolean)
          .join(" ");

        setIngestionMessage(message);
        return;
      }

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
    } catch {
      setIngestionMessage("Ingestion request failed due to a network or server error.");
    } finally {
      setIngestionBusy(false);
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
      const response = await fetch(`/api/admin/ingestion/jobs/${encodeURIComponent(jobIdInput.trim())}/apply`, {
        method: "POST",
      });

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
    patch?: Record<string, any>
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
      if (jobIdInput.trim()) {
        await loadJobDetails(jobIdInput.trim());
      }
    } catch {
      setIngestionMessage("Review update failed due to a network or server error.");
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
      const response = await fetch(`/api/admin/ingestion/discovery?q=${encodeURIComponent(discoveryQuery.trim())}`);
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

  // Helper for rendering flags
  const FlagBadge = ({ flag }: { flag: string }) => (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-200 shadow-sm mr-2 mb-2">
      {flag.replace(/_/g, " ")}
    </span>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 font-sans antialiased">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header Section */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex justify-between items-center bg-gradient-to-r from-teal-900 to-teal-700 text-white">
          <div>
            <p className="text-teal-200 text-sm font-semibold uppercase tracking-wider mb-1">EasyHeals Admin</p>
            <h1 className="text-3xl font-bold tracking-tight">CRM Operations Center</h1>
            <p className="text-teal-100 mt-2">
              Signed in as <span className="font-semibold text-white">{me.fullName}</span> ({me.role})
            </p>
          </div>
          <button
            onClick={onLogout}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl transition-colors font-medium backdrop-blur-sm"
          >
            Sign Out
          </button>
        </section>

        {error ? (
          <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl shadow-sm text-sm font-medium">
            {error}
          </div>
        ) : null}

        {/* Core Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <article className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Quick Create Hospital</h2>
            </div>
            <div className="p-5 flex-1">
              <form onSubmit={onCreateHospital} className="flex flex-col gap-3">
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none"
                  value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} placeholder="Hospital name" required
                />
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none"
                  value={hospitalCity} onChange={(e) => setHospitalCity(e.target.value)} placeholder="City" required
                />
                <button type="submit" className="mt-2 w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-colors shadow-sm">
                  Add Hospital
                </button>
              </form>
              <div className="mt-6 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-bold text-slate-800 mb-2">Hospital Management</h3>
                <div className="max-h-[150px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {hospitals.map((h) => (
                    <div key={h.id} className="flex justify-between items-center p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-sm font-medium text-slate-700">{h.name}</span>
                      <button
                        onClick={() => onDeleteHospital(h.id, h.name)}
                        className="text-red-600 hover:text-red-800 text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  {hospitals.length === 0 && (
                    <p className="text-xs text-slate-500 italic">No hospitals found.</p>
                  )}
                </div>
              </div>
            </div>
          </article>

          <article className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Create Taxonomy Node</h2>
            </div>
            <div className="p-5 flex-1">
              <form onSubmit={onCreateTaxonomy} className="flex flex-col gap-3">
                <select
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none"
                  value={nodeType} onChange={(e) => setNodeType(e.target.value)}
                >
                  <option value="specialty">Specialty</option>
                  <option value="treatment">Treatment</option>
                  <option value="symptom">Symptom</option>
                </select>
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none"
                  value={nodeTitle} onChange={(e) => setNodeTitle(e.target.value)} placeholder="Node title" required
                />
                <button type="submit" className="mt-2 w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-colors shadow-sm">
                  Add Node
                </button>
              </form>
            </div>
          </article>
        </div>

        {/* AI Ingestion Tool */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-800">Smart AI Data Scraper</h2>
            <p className="text-slate-500 mt-1 text-sm">Input a hospital website or Google Maps link to automatically extract standard details for review.</p>
          </div>
          <div className="p-6">
            <form onSubmit={onRunIngestion} className="space-y-4">
              <input
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none text-slate-700"
                value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://hospital-website.com or Google Maps Profile URL" required
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none text-sm"
                  value={ingestionHospitalName} onChange={(event) => setIngestionHospitalName(event.target.value)} placeholder="Hospital name context (optional)"
                />
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none text-sm"
                  value={ingestionCity} onChange={(event) => setIngestionCity(event.target.value)} placeholder="City context (optional)"
                />
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none text-sm"
                  value={ingestionQuery} onChange={(event) => setIngestionQuery(event.target.value)} placeholder="Specific queries (optional)"
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <input
                  className="w-full px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm placeholder:text-indigo-400 text-indigo-800"
                  value={targetHospitalId} onChange={(event) => setTargetHospitalId(event.target.value)} placeholder="Target Hospital ID (If updating an existing hospital)"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button type="submit" disabled={ingestionBusy} className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-2">
                  {ingestionBusy ? (
                    <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span> Running Scraping...</>
                  ) : "Scrape Now / Regenerate"}
                </button>
                <button type="button" onClick={loadRecentJobs} disabled={ingestionBusy} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium rounded-xl transition-colors">
                  Refresh Recent Jobs
                </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
              <div className="md:col-span-5 space-y-2">
                <label className="text-sm font-medium text-slate-700">Load Job Details using ID</label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none"
                    value={jobIdInput} onChange={(event) => setJobIdInput(event.target.value)} placeholder="Enter Job ID here..."
                  />
                  <button type="button" onClick={() => loadJobDetails(jobIdInput.trim())} disabled={ingestionBusy || !jobIdInput.trim()} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium rounded-xl transition-colors whitespace-nowrap">
                    Load
                  </button>
                </div>
              </div>
              <div className="md:col-span-7 flex items-center justify-end md:pb-px">
                {ingestionMessage && (
                  <p className="mr-4 text-sm font-medium text-teal-700 bg-teal-50 px-4 py-2 rounded-lg border border-teal-100 w-full animate-in fade-in slide-in-from-bottom-2">
                    {ingestionMessage}
                  </p>
                )}
                <button type="button" onClick={onApplyJob} disabled={ingestionBusy || !jobIdInput.trim()} className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-xl transition-colors shadow-sm whitespace-nowrap disabled:opacity-50">
                  Publish ALL Approved to Core
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Discovery Queue */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-800">Google Search Research Queue</h2>
            <p className="text-slate-500 mt-1 text-sm">Discover and queue clinics/hospitals from google search directly for scraping.</p>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <input
                className="flex-1 min-w-[300px] px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none"
                value={discoveryQuery} onChange={(e) => setDiscoveryQuery(e.target.value)} placeholder="e.g., Best Orthopedic Clinics in Mumbai"
              />
              <button type="button" onClick={loadDiscovery} disabled={ingestionBusy} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl border border-slate-200 transition-colors">
                Search Google
              </button>
              <button type="button" onClick={queueSelectedDiscovery} disabled={ingestionBusy || !selectedDiscoveryRows.length} className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-sm transition-colors disabled:opacity-50">
                Create Queue from Selected
              </button>
              <button type="button" onClick={loadResearchQueue} disabled={ingestionBusy} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl border border-slate-200 transition-colors">
                View Queue Tasks
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl shadow-inner">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 pb-2 border-b border-slate-200">Discovery Results</h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {discoveryResults.length === 0 ? <p className="text-slate-500 text-sm italic">Type a query to load results.</p> : null}
                  {discoveryResults.map((item) => (
                    <label key={item.link} className="flex items-start gap-4 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-teal-400 hover:shadow-sm transition-all">
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
                        <span className="inline-block mt-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 font-mono text-xs rounded border border-indigo-100">{item.suggestedAction.replace(/_/g, ' ')}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl shadow-inner">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 pb-2 border-b border-slate-200">Task Queue</h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {researchQueue.length === 0 ? <p className="text-slate-500 text-sm italic">Queue is currently empty.</p> : null}
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

        {/* Dynamic Job Details Details & Editing Interface */}
        {details && (
          <div className="space-y-6 pt-4 border-t-2 border-slate-200 animate-in fade-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center">🩺</span>
              Scraped Data Review Center
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-1 md:col-span-4 lg:col-span-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Job Status</p>
                <p className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-emerald-600 capitalize">{details.job.status.replace(/_/g, " ")}</p>
                {details.job.errorMessage && <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">{details.job.errorMessage}</p>}
                {Array.isArray(details.job.summary?.warnings) && (details.job.summary?.warnings as string[]).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-bold text-amber-600 uppercase mb-2">Warnings Setup</p>
                    <ul className="text-xs text-amber-700 space-y-1 bg-amber-50 p-2 rounded">
                      {(details.job.summary?.warnings as string[]).slice(0, 3).map((w, i) => <li key={i}>• {w.substring(0, 60)}...</li>)}
                    </ul>
                  </div>
                )}
              </div>

              {/* Hospital Candidate Review */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm col-span-1 md:col-span-4 lg:col-span-3">
                <div className="p-4 bg-slate-50 border-b border-slate-100 rounded-t-2xl flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Hospital Core Data</h3>
                  <span className="px-2 py-1 bg-slate-200 text-slate-800 text-xs font-bold rounded-md">{details.hospitalCandidates.length} Found</span>
                </div>
                <div className="p-5 overflow-x-auto space-y-4">
                  {details.hospitalCandidates.map((item) => (
                    <div key={item.id} className="p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-shadow">
                      {item.outlierFlags.length > 0 && <div className="mb-2">{item.outlierFlags.map(f => <FlagBadge key={f} flag={f} />)}</div>}

                      {editModeId === item.id ? (
                        <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <input className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500" value={editDraft.name || ""} onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} placeholder="Hospital Name" />
                          <input className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500" value={editDraft.city || ""} onChange={e => setEditDraft({ ...editDraft, city: e.target.value })} placeholder="City" />
                          <div className="flex gap-2 pt-2">
                            <button onClick={() => runReviewAction('hospital', item.id, 'edit', editDraft)} className="px-4 py-1.5 bg-teal-600 text-white text-sm rounded hover:bg-teal-700">Save</button>
                            <button onClick={() => setEditModeId(null)} className="px-4 py-1.5 bg-slate-200 text-slate-700 text-sm rounded hover:bg-slate-300">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start flex-wrap gap-4">
                          <div>
                            <h4 className="text-lg font-bold text-slate-800">{item.name}</h4>
                            <p className="text-sm text-slate-500">{item.city ?? "Location not specified"}</p>
                            <div className="flex gap-2 mt-2">
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-mono rounded">Action: {item.mergeAction}</span>
                              <span className={`px-2 py-0.5 text-xs font-mono rounded ${item.applyStatus === 'approved' ? 'bg-green-100 text-green-800' : item.applyStatus === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}>Status: {item.applyStatus}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { setEditModeId(item.id); setEditDraft({ name: item.name, city: item.city }); }} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white hover:bg-slate-50 text-slate-600 font-medium">Edit</button>
                            <button onClick={() => runReviewAction("hospital", item.id, "approve")} className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100">Approve</button>
                            <button onClick={() => runReviewAction("hospital", item.id, "reject")} className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100">Reject</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Doctors & Packages side by side */}
              <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Extracted Doctors</h3>
                  <span className="px-2 py-1 bg-slate-200 text-slate-800 text-xs font-bold rounded-md">{details.doctorCandidates.length}</span>
                </div>
                <div className="flex-1 p-0 overflow-y-auto max-h-[500px]">
                  <ul className="divide-y divide-slate-100">
                    {details.doctorCandidates.map((item) => (
                      <li key={item.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                        {editModeId === item.id ? (
                          <div className="space-y-2">
                            <input className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-teal-500 outline-none" value={editDraft.fullName || ""} onChange={e => setEditDraft({ ...editDraft, fullName: e.target.value })} placeholder="Doctor Name" />
                            <input className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-teal-500 outline-none" value={editDraft.specialization || ""} onChange={e => setEditDraft({ ...editDraft, specialization: e.target.value })} placeholder="Specialization" />
                            <div className="flex gap-2 items-center">
                              <span className="text-sm font-medium text-slate-500">₹</span>
                              <input type="number" className="flex-1 p-2 border border-slate-300 rounded text-sm focus:ring-teal-500 outline-none" value={editDraft.consultationFee || ""} onChange={e => setEditDraft({ ...editDraft, consultationFee: Number(e.target.value) })} placeholder="Fee" />
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => runReviewAction('doctor', item.id, 'edit', editDraft)} className="flex-1 py-1.5 bg-teal-600 text-white text-xs rounded hover:bg-teal-700">Save</button>
                              <button onClick={() => setEditModeId(null)} className="flex-1 py-1.5 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {item.outlierFlags.length > 0 && <div className="mb-1">{item.outlierFlags.map(f => <FlagBadge key={f} flag={f} />)}</div>}
                            <div className="flex justify-between">
                              <div>
                                <p className="font-bold text-slate-800">{item.fullName}</p>
                                <p className="text-sm text-slate-500">{item.specialization ?? "General"} • Fee: ₹{item.consultationFee ?? "—"}</p>
                                <span className={`inline-block mt-1 px-2 py-0.5 text-[0.65rem] font-bold uppercase rounded ${item.applyStatus === 'approved' ? 'bg-green-100 text-green-700' : item.applyStatus === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{item.applyStatus}</span>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <button onClick={() => { setEditModeId(item.id); setEditDraft({ fullName: item.fullName, specialization: item.specialization, consultationFee: item.consultationFee }); }} className="px-2 py-1 text-xs border border-slate-200 rounded text-slate-600 hover:bg-slate-50">Edit</button>
                                <div className="flex gap-1.5">
                                  <button onClick={() => runReviewAction("doctor", item.id, "approve")} className="w-7 h-7 flex items-center justify-center bg-green-50 text-green-600 border border-green-200 rounded font-bold hover:bg-green-100" title="Approve">✓</button>
                                  <button onClick={() => runReviewAction("doctor", item.id, "reject")} className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-600 border border-red-200 rounded font-bold hover:bg-red-100" title="Reject">×</button>
                                  <button onClick={() => runReviewAction("doctor", item.id, "delete")} className="w-7 h-7 flex items-center justify-center bg-slate-100 text-slate-500 border border-slate-200 rounded hover:bg-slate-200" title="Delete">🗑</button>
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

              <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Hospital Packages</h3>
                  <span className="px-2 py-1 bg-slate-200 text-slate-800 text-xs font-bold rounded-md">{details.packageCandidates.length}</span>
                </div>
                <div className="flex-1 p-0 overflow-y-auto max-h-[500px]">
                  <ul className="divide-y divide-slate-100">
                    {details.packageCandidates.map((item) => (
                      <li key={item.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                        {editModeId === item.id ? (
                          <div className="space-y-2">
                            <input className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-teal-500 outline-none" value={editDraft.packageName || ""} onChange={e => setEditDraft({ ...editDraft, packageName: e.target.value })} placeholder="Package Name" />
                            <input className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-teal-500 outline-none" value={editDraft.department || ""} onChange={e => setEditDraft({ ...editDraft, department: e.target.value })} placeholder="Department" />
                            <div className="flex gap-2">
                              <input type="number" className="w-1/2 p-2 border border-slate-300 rounded text-sm focus:ring-teal-500 outline-none" value={editDraft.priceMin || ""} onChange={e => setEditDraft({ ...editDraft, priceMin: Number(e.target.value) })} placeholder="Min ₹" />
                              <input type="number" className="w-1/2 p-2 border border-slate-300 rounded text-sm focus:ring-teal-500 outline-none" value={editDraft.priceMax || ""} onChange={e => setEditDraft({ ...editDraft, priceMax: Number(e.target.value) })} placeholder="Max ₹" />
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => runReviewAction('package', item.id, 'edit', editDraft)} className="flex-1 py-1.5 bg-teal-600 text-white text-xs rounded hover:bg-teal-700">Save</button>
                              <button onClick={() => setEditModeId(null)} className="flex-1 py-1.5 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {item.outlierFlags.length > 0 && <div className="mb-1">{item.outlierFlags.map(f => <FlagBadge key={f} flag={f} />)}</div>}
                            <div className="flex justify-between">
                              <div>
                                <p className="font-bold text-slate-800">{item.packageName}</p>
                                <p className="text-sm text-slate-500">{item.department ?? "General"} • ₹{item.priceMin ?? "?"} - ₹{item.priceMax ?? "?"}</p>
                                <span className={`inline-block mt-1 px-2 py-0.5 text-[0.65rem] font-bold uppercase rounded ${item.applyStatus === 'approved' ? 'bg-green-100 text-green-700' : item.applyStatus === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{item.applyStatus}</span>
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

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
