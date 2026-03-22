"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "@/i18n/LocaleContext";
import styles from "@/components/profiles/profiles.module.css";
import { getTreatmentName } from "@/lib/treatment-content";

type TaxonomyItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type: string | null;
};

type GroupedItems = Record<string, TaxonomyItem[]>;

// ── Medical emoji icon mapping ────────────────────────────────────────────────
type IconEntry = { keys: string[]; emoji: string; color: string };

const ICON_MAP: IconEntry[] = [
  // Specific joints — checked before generic bone/ortho
  { keys: ["knee replacement", "knee arthroscop"],                                            emoji: "🦵",  color: "#FEF3C7" },
  { keys: ["hip replacement"],                                                                emoji: "🦷",  color: "#FEF3C7" },
  // Systems
  { keys: ["heart", "cardio", "cardiac", "coronary", "bypass", "angio", "valve", "vascular", "pacemaker", "cabg"], emoji: "❤️", color: "#FEE2E2" },
  { keys: ["brain", "neuro", "cranio", "seizure", "stroke", "epilep", "alzheim", "parkin", "deep brain"], emoji: "🧠", color: "#EDE9FE" },
  { keys: ["bone", "ortho", "joint", "shoulder", "fractur", "arthro", "ligament", "scolio", "arthroscop"], emoji: "🦴", color: "#FEF3C7" },
  { keys: ["eye", "ophthal", "retina", "cataract", "glaucoma", "vision", "cornea", "lasik"],  emoji: "👁️", color: "#DBEAFE" },
  { keys: ["lung", "pulmo", "respir", "bronch", "asthma", "thorac", "tuberculosis", "bronchoscop"], emoji: "🫁", color: "#E0F2FE" },
  { keys: ["kidney", "dialysis", "renal", "nephro"],                                          emoji: "🫘",  color: "#FEF9C3" },
  { keys: ["bladder", "prostat", "urinar", "urol", "cystoscop", "lithotripsy", "varicocele"], emoji: "🔵",  color: "#DBEAFE" },
  { keys: ["skin", "dermat", "acne", "eczema", "psoria", "wound"],                            emoji: "🩹",  color: "#FCE7F3" },
  { keys: ["hair", "transplant", "alopecia"],                                                 emoji: "💆",  color: "#FCE7F3" },
  { keys: ["dental", "tooth", "teeth", "oral", "orthodont", "gum", "jaw", "root canal", "implant"], emoji: "🦷", color: "#E0F2FE" },
  { keys: ["cancer", "oncol", "tumor", "chemo", "radiother", "biopsy", "lymph", "leukemia", "mastectom"], emoji: "🎗️", color: "#FEE2E2" },
  { keys: ["gynec", "obstet", "maternal", "pregnan", "uterus", "ovari", "breast", "cervic", "ivf", "fertil", "hysterectom", "caesar"], emoji: "🤰", color: "#FCE7F3" },
  { keys: ["child", "paediat", "pediatr", "infant", "neonat"],                               emoji: "👶",  color: "#DCFCE7" },
  { keys: ["diabetes", "endocrin", "thyroid", "hormone", "metabol", "obesity", "sugar"],     emoji: "🩸",  color: "#FEF3C7" },
  { keys: ["ear", "nose", "throat", "ent", "sinus", "hearing", "tonsil", "larynx", "cochlear"], emoji: "👂", color: "#EDE9FE" },
  { keys: ["gastro", "stomach", "liver", "digesti", "intestin", "colon", "endoscop", "hepat", "gallbladder", "ercp", "appendect", "hernia"], emoji: "🫀", color: "#DCFCE7" },
  { keys: ["psych", "mental", "anxiety", "depress", "bipolar", "schizo"],                    emoji: "🧘",  color: "#F3E8FF" },
  { keys: ["plastic", "cosmetic", "reconstruct", "aesthetic", "rhinoplasty", "liposuc"],     emoji: "✨",  color: "#FDF4FF" },
  { keys: ["spine", "spinal", "disc", "vertebr", "laminect", "spondyl", "spinal fusion"],   emoji: "🦿",  color: "#F0FDF4" },
  { keys: ["blood", "hematol", "anemia", "thalass", "sickle", "transfusion", "stem cell", "bone marrow"], emoji: "💉", color: "#FEE2E2" },
  { keys: ["immuno", "allerg", "autoimmun", "rheumato", "lupus"],                            emoji: "🛡️", color: "#ECFDF5" },
  { keys: ["nutrition", "diet", "weight", "bariatric", "sleeve gastrectom", "gastric"],     emoji: "🥗",  color: "#F0FDF4" },
  { keys: ["physio", "rehab", "sport"],                                                      emoji: "🏃",  color: "#ECFDF5" },
  { keys: ["radiolog", "imaging", "mri", "ct scan", "ultrasound", "echocardiog", "ecg", "mammog"], emoji: "🔬", color: "#E0F2FE" },
  { keys: ["palliative", "hospice"],                                                          emoji: "🕊️", color: "#F8FAFC" },
  { keys: ["transplant", "organ"],                                                            emoji: "🏥",  color: "#E6F5EC" },
  { keys: ["emergency", "icu", "critical", "trauma", "ecmo"],                                emoji: "🚨",  color: "#FEE2E2" },
  { keys: ["vaccination", "immunis", "vaccine"],                                              emoji: "💊",  color: "#DCFCE7" },
  { keys: ["checkup", "screening", "preventive", "health check"],                            emoji: "📋",  color: "#E6F5EC" },
  { keys: ["anaesth", "anaesth"],                                                             emoji: "💤",  color: "#F8FAFC" },
  { keys: ["robotic", "laparoscop", "keyhole", "minimal"],                                   emoji: "🤖",  color: "#E6F5EC" },
  { keys: ["surgery", "surgical", "operation"],                                              emoji: "🏥",  color: "#E6F5EC" },
];

const DEFAULT_ICON: Omit<IconEntry, "keys"> = { emoji: "🩺", color: "#E6F5EC" };

function getMedicalIcon(title: string): Omit<IconEntry, "keys"> {
  const lower = title.toLowerCase();
  for (const entry of ICON_MAP) {
    if (entry.keys.some((k) => lower.includes(k))) return entry;
  }
  return DEFAULT_ICON;
}

// Strip boilerplate placeholder descriptions from legacy data
const BOILERPLATE_PATTERNS = [
  "imported from easyheals",
  "not available",
  "no description",
  "coming soon",
];
function cleanDesc(desc: string | null): string | null {
  if (!desc) return null;
  const lower = desc.toLowerCase();
  if (BOILERPLATE_PATTERNS.some((p) => lower.includes(p))) return null;
  return desc;
}

// Static city list for the city filter
const CITIES = [
  "Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad", "Kolkata",
  "Pune", "Ahmedabad", "Jaipur", "Kochi", "Lucknow", "Indore",
  "Nagpur", "Surat", "Bhopal", "Visakhapatnam",
];

export function TreatmentsClient({
  grouped,
  types,
  totalCount,
}: {
  grouped: GroupedItems;
  types: string[];
  totalCount: number;
}) {
  const { t, locale } = useTranslations();
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState("all");
  const [city, setCity] = useState("all");

  // Default city from nav localStorage
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("eh_city") : null;
    if (saved && saved !== "all" && CITIES.includes(saved)) setCity(saved);

    function onStorage(e: StorageEvent) {
      if (e.key === "eh_city") {
        const next = e.newValue ?? "all";
        setCity(CITIES.includes(next) ? next : "all");
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const typeLabel: Record<string, string> = {
    specialty:  t("treatment.typeSpecialty"),
    treatment:  t("treatment.typeTreatment"),
    procedure:  t("treatment.typeProcedure"),
    condition:  t("treatment.typeCondition"),
    department: t("treatment.typeDepartment"),
  };

  // Flat list of all items for search filtering
  const allItems = useMemo(() =>
    types.flatMap((type) => (grouped[type] ?? []).map((item) => ({ ...item, type: type }))),
    [grouped, types],
  );

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (activeType !== "all" && item.type !== activeType) return false;
      if (!query.trim()) return true;
      const text = `${item.title} ${item.description ?? ""}`.toLowerCase();
      return text.includes(query.trim().toLowerCase());
    });
  }, [allItems, activeType, query]);

  // Group filtered items by type for display
  const filteredGrouped = useMemo(() => {
    const result: GroupedItems = {};
    for (const item of filteredItems) {
      const key = item.type ?? "other";
      if (!result[key]) result[key] = [];
      result[key].push(item);
    }
    return result;
  }, [filteredItems]);

  const activeTypes = activeType === "all" ? types.filter((t) => filteredGrouped[t]?.length) : [activeType];

  return (
    <main className={styles.directoryPage}>
      {/* ── Hero ── */}
      <section className={styles.directoryHero}>
        <span className={styles.kicker}>{t("treatment.directoryTitle")}</span>
        <h1>{t("treatment.directoryTitle")}</h1>
        <p>
          {totalCount} {t("treatment.hospitalsFound").split(" ").pop()} · {t("treatment.directoryDescription")}
        </p>

        <div className={styles.searchBar}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${t("common.search")} ${t("treatment.directoryTitle").toLowerCase()}...`}
            aria-label="Search treatments"
          />
          <select value={city} onChange={(e) => {
            const next = e.target.value;
            setCity(next);
            if (typeof window !== "undefined") localStorage.setItem("eh_city", next);
            window.dispatchEvent(new StorageEvent("storage", { key: "eh_city", newValue: next }));
          }} aria-label={t("common.allCities")}>
            <option value="all">{t("common.allCities")}</option>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </section>

      {/* ── Type filter pills ── */}
      <div className={styles.directoryControls}>
        <div className={styles.filterScroll}>
          <button
            type="button"
            className={activeType === "all" ? styles.filterPillActive : styles.filterPill}
            onClick={() => setActiveType("all")}
          >
            All
            <span className={styles.filterPillCount}>{totalCount}</span>
          </button>
          {types.map((type) => {
            const count = (grouped[type] ?? []).length;
            return (
              <button
                key={type}
                type="button"
                className={activeType === type ? styles.filterPillActive : styles.filterPill}
                onClick={() => setActiveType(type)}
              >
                {typeLabel[type] ?? type}
                <span className={styles.filterPillCount}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Result count ── */}
      <p style={{ width: "min(1180px,100%)", margin: "8px auto 0", fontSize: "12px", color: "#8FA39A", fontFamily: "var(--font-bricolage),sans-serif" }}>
        {filteredItems.length} {t("treatment.directoryTitle").toLowerCase()} found
        {city !== "all" ? ` · ${city}` : ""}
      </p>

      {/* ── Grouped grids ── */}
      <div style={{ width: "min(1180px, 100%)", margin: "0 auto", display: "grid", gap: "24px", marginTop: "16px" }}>
        {activeTypes.map((type) => {
          const sectionItems = filteredGrouped[type] ?? [];
          if (!sectionItems.length) return null;
          return (
            <section key={type}>
              <h2
                className={styles.sectionHeading}
                data-type={type}
              >
                {typeLabel[type] ?? type}
              </h2>
              <div className={styles.directoryGrid} style={{ margin: 0, width: "100%" }}>
                {sectionItems.map((item) => {
                  const med = getMedicalIcon(item.title);
                  const desc = cleanDesc(item.description);
                  const displayTitle = getTreatmentName(item.slug, locale) ?? item.title;
                  return (
                    <article
                      key={item.id}
                      className={styles.directoryCard}
                      data-testid="treatment-card"
                      data-treatment-id={item.id}
                      data-treatment-type={type}
                    >
                      {/* Icon + badge row — RN: <View row> */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                        <div
                          style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "14px",
                            background: med.color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            fontSize: "24px",
                            lineHeight: 1,
                          }}
                          aria-hidden="true"
                          data-testid="treatment-icon"
                        >
                          {med.emoji}
                        </div>
                        <span className={styles.typeBadge} data-type={type} data-testid="treatment-type-badge">
                          {typeLabel[type] ?? type}
                        </span>
                      </div>

                      <h2 style={{ fontSize: "15px", margin: "6px 0 0" }} data-testid="treatment-title">
                        {displayTitle}
                      </h2>

                      {desc ? (
                        <p style={{ fontSize: "13px" }} data-testid="treatment-desc">
                          {desc.length > 100 ? `${desc.slice(0, 100)}…` : desc}
                        </p>
                      ) : null}

                      <div className={styles.directoryCardFooter} style={{ marginTop: "auto" }}>
                        <Link
                          href={`/treatments/${item.slug}`}
                          className={styles.directoryCardView}
                          data-testid="btn-explore"
                          style={{ flex: 1, textAlign: "center" }}
                        >
                          {t("treatment.exploreMore")}
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

        {filteredItems.length === 0 && (
          <p className={styles.emptyState}>{t("common.noResults")}</p>
        )}
      </div>
    </main>
  );
}
