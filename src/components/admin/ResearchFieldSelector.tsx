"use client";

/**
 * ResearchFieldSelector — field-by-field comparison between AI-researched
 * candidate data and the current DB state. Lets admins cherry-pick which
 * fields to write when saving an ingestion job to the database.
 */

export type CurrentHospital = {
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  addressLine1: string | null;
  facilities: string[];
  specialties: string[];
  workingHours: Record<string, unknown> | null;
  accreditations: string[];
  googleRating: number | null;
};

export type HospitalCandidateFull = {
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  addressLine1: string | null;
  keyFacilities: string[];
  specialties: string[];
  operatingHours: Record<string, unknown> | null;
  rawPayload: Record<string, unknown> | null;
  aiConfidence: number | null;
  currentHospital: CurrentHospital | null;
};

type Props = {
  candidate: HospitalCandidateFull;
  selectedFields: Set<string>;
  onToggle: (fieldKey: string) => void;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtHours(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v).slice(0, 120); } catch { return ""; }
}

type FieldStatus = "new" | "changed" | "same" | "missing";

function scalarStatus(fetched: string | null | undefined, current: string | null | undefined): FieldStatus {
  const f = (fetched ?? "").trim();
  const c = (current ?? "").trim();
  if (!f) return "missing";
  if (!c) return "new";
  if (f === c) return "same";
  return "changed";
}

const STATUS_STYLE: Record<FieldStatus, string> = {
  new:     "text-emerald-700 bg-emerald-50",
  changed: "text-amber-700 bg-amber-50",
  same:    "text-slate-400 bg-slate-50",
  missing: "text-slate-300 bg-slate-50",
};

const STATUS_LABEL: Record<FieldStatus, string> = {
  new:     "NEW",
  changed: "CHANGED",
  same:    "SAME",
  missing: "—",
};

// ─── Scalar field row ───────────────────────────────────────────────────────────

function FieldRow({
  fieldKey,
  label,
  fetchedText,
  currentText,
  selected,
  onToggle,
}: {
  fieldKey: string;
  label: string;
  fetchedText: string;
  currentText: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const status = scalarStatus(fetchedText, currentText);
  const isApplicable = status !== "missing";

  return (
    <tr className={`border-b border-slate-100 last:border-0 ${!isApplicable ? "opacity-40" : ""}`}>
      <td className="py-2.5 pr-3 text-xs font-semibold text-slate-600 whitespace-nowrap">{label}</td>
      <td className="py-2.5 pr-3 text-xs text-slate-500 max-w-[200px]">
        <span className="block truncate">{currentText || <span className="italic text-slate-300">—</span>}</span>
      </td>
      <td className="py-2.5 pr-3">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${STATUS_STYLE[status]}`}>
            {STATUS_LABEL[status]}
          </span>
          <span className="text-xs text-slate-700 max-w-[200px] block truncate">{fetchedText || "—"}</span>
        </div>
      </td>
      <td className="py-2.5 pl-2 text-right">
        <input
          type="checkbox"
          checked={selected && isApplicable}
          disabled={!isApplicable}
          onChange={onToggle}
          className="w-4 h-4 accent-teal-600 cursor-pointer"
        />
      </td>
    </tr>
  );
}

// ─── Array section ────────────────────────────────────────────────────────────

function ArraySection({
  title,
  fieldKey,
  fetchedItems,
  currentItems,
  selected,
  onToggle,
}: {
  title: string;
  fieldKey: string;
  fetchedItems: string[];
  currentItems: string[];
  selected: boolean;
  onToggle: () => void;
}) {
  const newItems = fetchedItems.filter(i => !currentItems.includes(i));
  const existingItems = fetchedItems.filter(i => currentItems.includes(i));
  const hasNewItems = newItems.length > 0;

  return (
    <div className={`border border-slate-200 rounded-xl overflow-hidden ${!hasNewItems ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{title}</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-slate-500">
            {hasNewItems ? `${newItems.length} new` : "no new items"}
          </span>
          <input
            type="checkbox"
            checked={selected && hasNewItems}
            disabled={!hasNewItems}
            onChange={onToggle}
            className="w-4 h-4 accent-teal-600"
          />
        </label>
      </div>
      <div className="px-4 py-3 space-y-2">
        {newItems.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-emerald-600 mb-1.5">Will be added:</p>
            <div className="flex flex-wrap gap-1.5">
              {newItems.map((item) => (
                <span key={item} className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-full">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
        {existingItems.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 mb-1.5">Already in DB:</p>
            <div className="flex flex-wrap gap-1.5">
              {existingItems.map((item) => (
                <span key={item} className="px-2 py-0.5 bg-slate-100 text-slate-400 text-xs rounded-full">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
        {fetchedItems.length === 0 && (
          <p className="text-xs text-slate-400 italic">No data fetched</p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ResearchFieldSelector({ candidate, selectedFields, onToggle }: Props) {
  const raw = (candidate.rawPayload ?? {}) as Record<string, unknown>;
  const current = candidate.currentHospital;
  const isNew = !current;

  const fetchedAccreditations = Array.isArray(raw.accreditations) ? (raw.accreditations as string[]) : [];
  const rawGoogleRating = typeof raw.googleRating === "number" ? String(raw.googleRating) : "";
  const fetchedHours = fmtHours(candidate.operatingHours ?? raw.operatingHours);

  const scalarFields: Array<{ key: string; label: string; fetched: string; current: string }> = [
    { key: "description", label: "Description",    fetched: candidate.description ?? "",            current: current?.description ?? "" },
    { key: "phone",       label: "Phone",           fetched: candidate.phone ?? "",                  current: current?.phone ?? "" },
    { key: "email",       label: "Email",           fetched: candidate.email ?? "",                  current: current?.email ?? "" },
    { key: "website",     label: "Website",         fetched: candidate.website ?? "",                current: current?.website ?? "" },
    { key: "addressLine1",label: "Address",         fetched: candidate.addressLine1 ?? "",           current: current?.addressLine1 ?? "" },
    { key: "operatingHours", label: "Working Hours", fetched: fetchedHours,                         current: fmtHours(current?.workingHours) },
    { key: "googleRating", label: "Google Rating",  fetched: rawGoogleRating,                       current: current?.googleRating !== null && current?.googleRating !== undefined ? String(current.googleRating) : "" },
  ];

  const applicableCount = scalarFields.filter(f => scalarStatus(f.fetched, f.current) !== "missing").length;
  const selectedScalarCount = scalarFields.filter(f => selectedFields.has(f.key)).length;
  const allScalarsSelected = applicableCount > 0 && selectedScalarCount === applicableCount;

  function toggleAllScalars() {
    const applicable = scalarFields.filter(f => scalarStatus(f.fetched, f.current) !== "missing").map(f => f.key);
    if (allScalarsSelected) {
      applicable.forEach(k => { if (selectedFields.has(k)) onToggle(k); });
    } else {
      applicable.forEach(k => { if (!selectedFields.has(k)) onToggle(k); });
    }
  }

  return (
    <div className="space-y-5">
      {isNew && (
        <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium">
          This is a new hospital — all selected fields will be written on insert.
        </div>
      )}

      {/* Overview section */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Overview</span>
          <button
            type="button"
            onClick={toggleAllScalars}
            className="text-xs text-teal-600 hover:text-teal-800 font-semibold"
          >
            {allScalarsSelected ? "Deselect all" : "Select all"}
          </button>
        </div>
        <div className="px-4 py-1 overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="py-2 pr-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide w-28">Field</th>
                <th className="py-2 pr-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide w-48">Current in DB</th>
                <th className="py-2 pr-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide">AI Fetched</th>
                <th className="py-2 pl-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wide w-12">Apply?</th>
              </tr>
            </thead>
            <tbody>
              {scalarFields.map((f) => (
                <FieldRow
                  key={f.key}
                  fieldKey={f.key}
                  label={f.label}
                  fetchedText={f.fetched}
                  currentText={f.current}
                  selected={selectedFields.has(f.key)}
                  onToggle={() => onToggle(f.key)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Array sections */}
      <ArraySection
        title="Specialties"
        fieldKey="specialties"
        fetchedItems={candidate.specialties ?? []}
        currentItems={current?.specialties ?? []}
        selected={selectedFields.has("specialties")}
        onToggle={() => onToggle("specialties")}
      />
      <ArraySection
        title="Facilities"
        fieldKey="facilities"
        fetchedItems={candidate.keyFacilities ?? []}
        currentItems={current?.facilities ?? []}
        selected={selectedFields.has("facilities")}
        onToggle={() => onToggle("facilities")}
      />
      <ArraySection
        title="Accreditations"
        fieldKey="accreditations"
        fetchedItems={fetchedAccreditations}
        currentItems={current?.accreditations ?? []}
        selected={selectedFields.has("accreditations")}
        onToggle={() => onToggle("accreditations")}
      />
    </div>
  );
}

/** Compute smart default selectedFields for a candidate: auto-select fields
 *  that have new / changed data compared to the current DB state. */
export function defaultSelectedFields(candidate: HospitalCandidateFull): Set<string> {
  const selected = new Set<string>();
  const raw = (candidate.rawPayload ?? {}) as Record<string, unknown>;
  const cur = candidate.currentHospital;

  const scalars: Array<{ key: string; fetched: string; current: string }> = [
    { key: "description",    fetched: candidate.description ?? "",       current: cur?.description ?? "" },
    { key: "phone",          fetched: candidate.phone ?? "",             current: cur?.phone ?? "" },
    { key: "email",          fetched: candidate.email ?? "",             current: cur?.email ?? "" },
    { key: "website",        fetched: candidate.website ?? "",           current: cur?.website ?? "" },
    { key: "addressLine1",   fetched: candidate.addressLine1 ?? "",      current: cur?.addressLine1 ?? "" },
    { key: "operatingHours", fetched: fmtHours(candidate.operatingHours ?? raw.operatingHours), current: fmtHours(cur?.workingHours) },
    { key: "googleRating",   fetched: typeof raw.googleRating === "number" ? String(raw.googleRating) : "", current: cur?.googleRating !== null && cur?.googleRating !== undefined ? String(cur.googleRating) : "" },
  ];

  for (const { key, fetched, current } of scalars) {
    const status = scalarStatus(fetched, current);
    if (status === "new" || status === "changed") selected.add(key);
  }

  const specs = candidate.specialties ?? [];
  if (specs.some(s => !(cur?.specialties ?? []).includes(s))) selected.add("specialties");

  const facs = candidate.keyFacilities ?? [];
  if (facs.some(f => !(cur?.facilities ?? []).includes(f))) selected.add("facilities");

  const accreds = Array.isArray(raw.accreditations) ? (raw.accreditations as string[]) : [];
  if (accreds.some(a => !(cur?.accreditations ?? []).includes(a))) selected.add("accreditations");

  return selected;
}
