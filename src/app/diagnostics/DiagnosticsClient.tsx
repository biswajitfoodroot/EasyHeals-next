"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "@/i18n/LocaleContext";

type TaxNode = {
  id: string;
  slug: string;
  title: string;
  type: string;
  description: string | null;
};

type Props = {
  pathology: TaxNode[];
  radiology: TaxNode[];
  totalCount: number;
};

// ── Icon mapping for diagnostic tests ────────────────────────────────────────

const PATHOLOGY_ICONS: Array<{ keys: string[]; emoji: string }> = [
  { keys: ["blood", "cbc", "haemoglobin", "hemoglobin", "platelet", "wbc", "rbc"],  emoji: "🩸" },
  { keys: ["urine", "urinalysis"],                                                    emoji: "🧫" },
  { keys: ["thyroid", "tsh", "t3", "t4"],                                             emoji: "🦋" },
  { keys: ["diabetes", "sugar", "glucose", "hba1c"],                                  emoji: "🍬" },
  { keys: ["lipid", "cholesterol", "triglyceride"],                                    emoji: "💊" },
  { keys: ["liver", "lft", "sgot", "sgpt", "bilirubin", "albumin"],                  emoji: "🫀" },
  { keys: ["kidney", "kft", "rft", "creatinine", "urea", "uric acid"],               emoji: "🫘" },
  { keys: ["biopsy", "histopath", "cytolog"],                                          emoji: "🔭" },
  { keys: ["culture", "sensitivity", "pcr", "covid", "malaria", "dengue", "typhoid"],emoji: "🦠" },
  { keys: ["hormone", "fertility", "fsh", "lh", "prolactin", "testosterone"],        emoji: "⚗️" },
  { keys: ["vitamin", "calcium", "iron", "ferritin", "b12"],                          emoji: "💉" },
  { keys: ["stool", "faeces"],                                                         emoji: "🧬" },
  { keys: ["tumour", "tumor", "cancer", "cea", "afp", "psa", "ca-125"],               emoji: "🎗️" },
  { keys: ["cardiac", "troponin", "creatine kinase", "bnp"],                           emoji: "❤️" },
  { keys: ["coagulation", "pt", "aptt", "inr", "d-dimer"],                            emoji: "🩺" },
];

const RADIOLOGY_ICONS: Array<{ keys: string[]; emoji: string }> = [
  { keys: ["mri"],                                                                     emoji: "🧲" },
  { keys: ["ct scan", "ct ", "computed"],                                              emoji: "💿" },
  { keys: ["x-ray", "xray", "radiograph"],                                             emoji: "📷" },
  { keys: ["ultrasound", "usg", "sonograph"],                                          emoji: "🔊" },
  { keys: ["echo", "echocardiog"],                                                     emoji: "❤️" },
  { keys: ["ecg", "electrocardiog"],                                                   emoji: "📈" },
  { keys: ["pet scan", "pet-ct", "nuclear"],                                           emoji: "☢️" },
  { keys: ["mammog", "mammography"],                                                    emoji: "🔵" },
  { keys: ["dexa", "bone density", "bone mineral"],                                    emoji: "🦴" },
  { keys: ["angiog", "angiography"],                                                   emoji: "🩸" },
  { keys: ["fluoroscop"],                                                               emoji: "📡" },
  { keys: ["endoscop"],                                                                 emoji: "🔬" },
];

function getIcon(title: string, type: "pathology" | "radiology"): string {
  const lower = title.toLowerCase();
  const map = type === "pathology" ? PATHOLOGY_ICONS : RADIOLOGY_ICONS;
  for (const entry of map) {
    if (entry.keys.some(k => lower.includes(k))) return entry.emoji;
  }
  return type === "pathology" ? "🧪" : "🔬";
}

// ── Component ────────────────────────────────────────────────────────────────

export function DiagnosticsClient({ pathology, radiology, totalCount }: Props) {
  const { t } = useTranslations();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "pathology" | "radiology">("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filterFn = (n: TaxNode) =>
      !q || n.title.toLowerCase().includes(q) || (n.description ?? "").toLowerCase().includes(q);

    return {
      pathology: (tab === "radiology" ? [] : pathology).filter(filterFn),
      radiology: (tab === "pathology" ? [] : radiology).filter(filterFn),
    };
  }, [search, tab, pathology, radiology]);

  const totalFiltered = filtered.pathology.length + filtered.radiology.length;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
            <Link href="/" className="hover:text-green-600">{t("common.home")}</Link>
            <span>/</span>
            <span className="text-gray-600">{t("diagnostics.breadcrumbDiagnostics")}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 leading-tight">
            {t("diagnostics.heroTitle")}
          </h1>
          <p className="text-gray-500 mt-2 text-sm sm:text-base max-w-2xl">
            {t("diagnostics.heroSubtitle")}
          </p>

          {/* Stats */}
          <div className="flex flex-wrap gap-4 mt-5">
            {[
              { label: t("diagnostics.statPathologyTests"), val: pathology.length || "50+" },
              { label: t("diagnostics.statRadiologyImaging"), val: radiology.length || "30+" },
              { label: t("diagnostics.statCitiesCovered"), val: "50+" },
              { label: t("diagnostics.statVerifiedCentres"), val: "500+" },
            ].map(s => (
              <div key={s.label} className="bg-green-50 border border-green-100 rounded-xl px-4 py-2.5">
                <p className="font-bold text-green-700 text-lg leading-none">{s.val}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t("diagnostics.searchPlaceholder")}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 w-full"
        />
        <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden shrink-0">
          {(["all", "pathology", "radiology"] as const).map(key => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === key
                  ? "bg-green-500 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {key === "all"
                ? t("diagnostics.filterAll")
                : key === "pathology"
                  ? t("diagnostics.filterPathology")
                  : t("diagnostics.filterRadiology")}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-12 space-y-10">
        {/* ── Pathology section ─────────────────────────────────────────── */}
        {filtered.pathology.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🧪</span>
              <div>
                <h2 className="font-bold text-gray-800 text-lg">{t("diagnostics.sectionPathologyTests")}</h2>
                <p className="text-xs text-gray-400">{t("diagnostics.testsAvailable").replace("{n}", String(filtered.pathology.length))}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.pathology.map(node => (
                <DiagnosticCard key={node.id} node={node} diagType="pathology" findLabel={t("diagnostics.findCentres")} />
              ))}
            </div>
          </section>
        )}

        {/* ── Radiology section ─────────────────────────────────────────── */}
        {filtered.radiology.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🔬</span>
              <div>
                <h2 className="font-bold text-gray-800 text-lg">{t("diagnostics.sectionRadiologyImaging")}</h2>
                <p className="text-xs text-gray-400">{t("diagnostics.imagingAvailable").replace("{n}", String(filtered.radiology.length))}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.radiology.map(node => (
                <DiagnosticCard key={node.id} node={node} diagType="radiology" findLabel={t("diagnostics.findCentres")} />
              ))}
            </div>
          </section>
        )}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {totalFiltered === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">{tab === "pathology" ? "🧪" : tab === "radiology" ? "🔬" : "🩺"}</p>
            <p className="text-gray-500 text-sm">
              {search
                ? t("diagnostics.noResultsFor").replace("{q}", search)
                : t("diagnostics.noListings")}
            </p>
            <button
              onClick={() => { setSearch(""); setTab("all"); }}
              className="mt-4 text-sm text-green-600 hover:underline"
            >
              {t("diagnostics.clearFilters")}
            </button>
          </div>
        )}

        {/* ── CTA banner ───────────────────────────────────────────────── */}
        {totalCount === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-8 text-center">
            <p className="text-2xl mb-2">🔬</p>
            <h3 className="font-bold text-gray-800 mb-1">{t("diagnostics.comingSoonTitle")}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {t("diagnostics.comingSoonBody")}
            </p>
            <Link
              href="/?q=blood+test+near+me"
              className="inline-block bg-green-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-green-600 transition-colors"
            >
              {t("diagnostics.findViaAi")}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

function DiagnosticCard({ node, diagType, findLabel }: { node: TaxNode; diagType: "pathology" | "radiology"; findLabel: string }) {
  const icon = getIcon(node.title, diagType);
  const desc = node.description?.trim();

  return (
    <Link
      href={`/treatments/${node.slug}`}
      className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-green-300 hover:shadow-md transition-all flex flex-col gap-2"
    >
      <span className="text-2xl">{icon}</span>
      <p className="font-semibold text-sm text-gray-800 leading-snug group-hover:text-green-700 line-clamp-2">
        {node.title}
      </p>
      {desc && (
        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{desc}</p>
      )}
      <span className="mt-auto text-xs text-green-600 font-medium group-hover:underline">
        {findLabel}
      </span>
    </Link>
  );
}
