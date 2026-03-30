"use client";

import type React from "react";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";

import { useTranslations } from "@/i18n/LocaleContext";
import { stripMarkdown } from "@/lib/strings";
import styles from "@/components/profiles/profiles.module.css";
import { slugify } from "@/lib/strings";
import {
  getTreatmentData,
  getSpecialtyData,
  getAnyName,
  getAnyAbout,
  getAnyProcedures,
  getSpecialtyTreatments,
} from "@/lib/treatment-content";

// ── Types ─────────────────────────────────────────────────────────────────────

type TreatmentHospital = {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string | null;
  rating: number;
  reviewCount: number;
  specialties: string[];
  verified: boolean;
  profileUrl: string;
  directionsUrl: string;
};

type TreatmentDoctor = {
  id: string;
  slug: string;
  fullName: string;
  specialization: string | null;
  specialties: string[];
  city: string | null;
  state: string | null;
  rating: number;
  reviewCount: number;
  verified: boolean;
  yearsOfExperience: number | null;
  consultationFee: number | null;
  profileUrl: string;
};

type TreatmentMeta = {
  causes?: string;
  possibleProblems?: string;
  nextSteps?: string;
  whenToVisit?: string;
  homeCare?: string;
  relatedProcedures?: string[];
  seoTitle?: string;
  seoDescription?: string;
  names?: Record<string, string>;
};

type TreatmentData = {
  id: string;
  slug: string;
  title: string;
  type: string;
  description: string | null;
  metadata: TreatmentMeta | null;
};

type Props = {
  data: {
    treatment: TreatmentData;
    relatedHospitals: TreatmentHospital[];
    relatedDoctors: TreatmentDoctor[];
  };
};

const TABS = ["overview", "hospitals", "doctors"] as const;
type TabKey = (typeof TABS)[number];

// Static city list for the city filter — matches SiteNav / directory pages
const CITIES = [
  "Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad", "Kolkata",
  "Pune", "Ahmedabad", "Jaipur", "Kochi", "Lucknow", "Indore",
  "Nagpur", "Surat", "Bhopal", "Visakhapatnam",
];

// ── Component ─────────────────────────────────────────────────────────────────

export function TreatmentProfileClient({ data }: Props) {
  const { t, locale } = useTranslations();
  const [tab, setTab] = useState<TabKey>("overview");
  const [city, setCity] = useState("all");

  const { treatment, relatedHospitals, relatedDoctors } = data;

  // Rich content from static data files
  const treatmentContent = getTreatmentData(treatment.slug);
  const specialtyContent = getSpecialtyData(treatment.slug);

  // Internal linking — specialty's mapped treatments (for specialty pages)
  const specialtyTreatments = specialtyContent ? getSpecialtyTreatments(treatment.slug) : [];

  // Internal linking — primary specialty link (for treatment pages)
  const primarySpecialtySlug = treatmentContent?.primarySpecialtySlug ?? null;
  const primarySpecialtyName = treatmentContent?.primarySpecialtyName ?? null;

  // Sync city from localStorage / nav picker
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

  const tabLabels: Record<TabKey, string> = {
    overview: t("treatment.tabOverview"),
    hospitals: t("treatment.tabHospitals"),
    doctors: t("treatment.tabDoctors"),
  };

  // Translated title (falls back to DB title if no translation entry)
  const displayTitle = getAnyName(treatment.slug, locale) ?? treatment.title;

  // DB description takes priority (admin-managed); static file used as locale-aware fallback
  const richAbout =
    (treatment.description && treatment.description.trim().length > 0 ? treatment.description : null) ??
    getAnyAbout(treatment.slug, locale) ??
    `${t("treatment.aboutTitle")} ${displayTitle}`;

  // DB metadata (AI-saved) takes priority over static file data
  const meta = treatment.metadata;
  const dbCauses = meta?.causes ?? meta?.possibleProblems ?? null;
  const dbNextSteps = meta?.nextSteps ?? meta?.whenToVisit ?? null;
  const dbHomeCare = meta?.homeCare ?? null;
  const dbProcedures = meta?.relatedProcedures ?? null;

  // Causes / problems
  const displayCauses = dbCauses ?? treatmentContent?.causes ?? specialtyContent?.possibleProblems ?? null;
  // Next steps / when to visit
  const displayNextSteps = dbNextSteps ?? treatmentContent?.nextSteps ?? specialtyContent?.whenToVisit ?? null;
  // Home care
  const displayHomeCare = dbHomeCare ?? specialtyContent?.homeCare ?? null;
  // Procedures for this treatment/specialty
  const procedures = dbProcedures ?? getAnyProcedures(treatment.slug);

  // City-filtered hospitals and doctors
  const filteredHospitals = useMemo(() =>
    city === "all" ? relatedHospitals : relatedHospitals.filter((h) => h.city === city),
    [relatedHospitals, city],
  );

  const filteredDoctors = useMemo(() =>
    city === "all" ? relatedDoctors : relatedDoctors.filter((d) => d.city === city),
    [relatedDoctors, city],
  );

  // ── Structured text renderer ──
  // Comma/semicolon lists → chips. Multi-sentence prose → short paragraph.
  function RichText({ text }: { text: string }) {
    const clean = stripMarkdown(text).trim();
    // Detect comma/semicolon-separated key-point lists (short items, no full stops mid-text)
    const isKeyList = /,|;/.test(clean) && !(/\.\s+[A-Z]/.test(clean));
    if (isKeyList) {
      const items = clean.split(/[,;]/).map(s => s.trim()).filter(Boolean);
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "2px" }}>
          {items.map((item, i) => (
            <span key={i} style={{
              background: "#fff",
              border: "1px solid #6EE7B7",
              borderRadius: "999px",
              padding: "3px 11px",
              fontSize: "12.5px",
              color: "#065F46",
              fontWeight: 500,
            }}>{item}</span>
          ))}
        </div>
      );
    }
    // Prose — split on sentence boundaries, show as compact lines (max 5)
    const sentences = clean.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0).slice(0, 5);
    return (
      <p style={{ color: "#374151", lineHeight: "1.7", fontSize: "13.5px", margin: 0 }}>
        {sentences.join(" ")}
      </p>
    );
  }

  // ── City Selector ── (shared across hospitals + doctors tabs)
  function CitySelector({ label }: { label: string }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "13px", color: "#5A7367", fontWeight: 600 }}>
          {label}:
        </span>
        <select
          value={city}
          onChange={(e) => {
            const next = e.target.value;
            setCity(next);
            if (typeof window !== "undefined") localStorage.setItem("eh_city", next);
            window.dispatchEvent(new StorageEvent("storage", { key: "eh_city", newValue: next }));
          }}
          data-testid="city-filter-select"
          style={{
            border: "1.5px solid #D0E4D8",
            borderRadius: "8px",
            padding: "5px 10px",
            fontSize: "13px",
            color: "#1A2B23",
            background: "#fff",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
          aria-label={t("treatment.filterByCity")}
        >
          <option value="all">{t("common.allCities")}</option>
          {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {city !== "all" && (
          <button
            type="button"
            onClick={() => setCity("all")}
            style={{ fontSize: "12px", color: "#1B8A4A", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            Clear
          </button>
        )}
      </div>
    );
  }

  return (
    <main className={styles.page} data-testid="treatment-profile-page">
      <section className={styles.container}>

        {/* ── Breadcrumb ── */}
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">{t("common.home")}</Link>
          <span>/</span>
          <Link href="/treatments">{t("nav.treatments")}</Link>
          <span>/</span>
          <span>{displayTitle}</span>
        </nav>

        {/* ── Hero ── */}
        <header className={styles.hero}>
          <div className={styles.heroTop}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span className={styles.kicker} data-testid="treatment-type-kicker">
                  {treatment.type?.replace(/_/g, " ")}
                </span>
                {primarySpecialtySlug && primarySpecialtyName && (
                  <Link
                    href={`/treatments/${primarySpecialtySlug}`}
                    data-testid="primary-specialty-link"
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#fff",
                      background: "#1B8A4A",
                      borderRadius: "999px",
                      padding: "4px 12px",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    ↗ {primarySpecialtyName}
                  </Link>
                )}
              </div>
              <h1 className={styles.title} data-testid="treatment-title">{displayTitle}</h1>
              <p className={styles.subtitle} style={{ maxWidth: "680px" }}>
                {richAbout.length > 220 ? `${richAbout.slice(0, 220)}…` : richAbout}
              </p>
              <div className={styles.heroBadges}>
                {relatedHospitals.length > 0 && (
                  <span data-testid="hospital-count-badge">
                    {relatedHospitals.length} {t("treatment.tabHospitals")}
                  </span>
                )}
                {relatedDoctors.length > 0 && (
                  <span data-testid="doctor-count-badge">
                    {relatedDoctors.length} {t("treatment.specialists")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── Tabs ── */}
        <div className={styles.tabs} role="tablist" aria-label="Treatment profile tabs">
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? styles.tabActive : ""}
              onClick={() => setTab(key)}
              data-testid={`tab-${key}`}
            >
              {tabLabels[key]}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {tab === "overview" && (
          <section className={styles.contentGrid} data-testid="tab-overview-content">
            {/* About panel */}
            <article className={styles.panel}>
              <h2 style={{ fontSize: "17px", marginBottom: "12px" }}>
                {t("treatment.aboutTitle")} {displayTitle}
              </h2>
              <p style={{ color: "#374151", lineHeight: "1.75", fontSize: "14px" }}>
                {stripMarkdown(richAbout)}
              </p>

              {/* Causes / Common Problems */}
              {displayCauses && (
                <div style={{ marginTop: "20px", background: "#F0FDF4", padding: "14px 16px", borderRadius: "10px", border: "1px solid #BBF7D0" }} data-testid="treatment-causes">
                  <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#166534", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {treatment.type === "specialty" ? "Common Problems" : "Causes / Typical Use Case"}
                  </h3>
                  <RichText text={displayCauses} />
                </div>
              )}

              {/* Next Steps / When to Visit */}
              {displayNextSteps && (
                <div style={{ marginTop: "12px", background: "#F0FDF4", padding: "14px 16px", borderRadius: "10px", border: "1px solid #BBF7D0" }} data-testid="treatment-next-steps">
                  <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#166534", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {treatment.type === "specialty" ? "When to Visit Doctor" : "Next Steps"}
                  </h3>
                  <RichText text={displayNextSteps} />
                </div>
              )}

              {/* Home Care */}
              {displayHomeCare && (
                <div style={{ marginTop: "12px", background: "#DCFCE7", padding: "14px 16px", borderRadius: "10px", border: "1px solid #86EFAC" }} data-testid="specialty-home-care">
                  <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#14532D", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Safe Home Care
                  </h3>
                  <RichText text={displayHomeCare} />
                </div>
              )}

              {/* Specialty mapped treatments section */}
              {specialtyContent && !treatmentContent && (
                <>

                  {/* Mapped Treatments — clickable internal links */}
                  {specialtyTreatments.length > 0 && (
                    <div style={{ marginTop: "20px" }} data-testid="specialty-mapped-treatments">
                      <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1A2B23", marginBottom: "10px" }}>
                        Related Treatments & Procedures
                      </h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {specialtyTreatments.map((item) => (
                          <Link
                            key={item.slug}
                            href={`/treatments/${item.slug}`}
                            data-testid="mapped-treatment-link"
                            style={{
                              fontSize: "12.5px",
                              fontWeight: 700,
                              color: "#0F5132",
                              background: "#fff",
                              border: "2px solid #1B8A4A",
                              borderRadius: "8px",
                              padding: "6px 14px",
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                            }}
                          >
                            {item.name} ↗
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Common Procedures */}
              {procedures.length > 0 && (
                <div style={{ marginTop: "24px" }}>
                  <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1A2B23", marginBottom: "12px" }}>
                    {t("treatment.commonProcedures")}
                  </h3>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "8px" }}>
                    {procedures.map((proc) => {
                      const procSlug = slugify(proc) || null;
                      const inner = (
                        <>
                          <span style={{ color: "#1B8A4A", fontWeight: 700, fontSize: "15px", flexShrink: 0 }}>✓</span>
                          <span style={{ flex: 1 }}>{proc}</span>
                          {procSlug && <span style={{ fontSize: "12px", color: "#1B8A4A", fontWeight: 700 }}>↗</span>}
                        </>
                      );
                      const itemStyle: React.CSSProperties = {
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "13.5px",
                        color: "#374151",
                        padding: "8px 12px",
                        background: "#F0FDF4",
                        borderRadius: "8px",
                        border: procSlug ? "1.5px solid #1B8A4A" : "1px solid #BBF7D0",
                        textDecoration: "none",
                        cursor: procSlug ? "pointer" : "default",
                      };
                      return procSlug ? (
                        <li key={proc} data-testid="procedure-item">
                          <Link href={`/treatments/${procSlug}`} style={itemStyle}>
                            {inner}
                          </Link>
                        </li>
                      ) : (
                        <li key={proc} data-testid="procedure-item" style={itemStyle}>
                          {inner}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </article>

            {/* Quick stats sidebar */}
            <aside className={styles.panel}>
              {/* Primary specialty back-link (treatment pages only) */}
              {primarySpecialtySlug && primarySpecialtyName && (
                <div style={{ marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid #E5F0E8" }} data-testid="sidebar-specialty-link">
                  <p style={{ fontSize: "11px", color: "#5A7367", fontWeight: 600, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Specialty
                  </p>
                  <Link
                    href={`/treatments/${primarySpecialtySlug}`}
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#1B8A4A",
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {primarySpecialtyName} →
                  </Link>
                </div>
              )}
              <h3 style={{ fontSize: "15px", marginBottom: "12px" }}>{t("treatment.quickStats")}</h3>
              <p style={{ color: "#5A7367", fontSize: "13px", marginBottom: "8px" }}>
                <strong style={{ color: "#1A2B23" }}>{filteredHospitals.length}</strong>{" "}
                {t("treatment.hospitalsFound")}{city !== "all" ? ` in ${city}` : ""}
              </p>
              <p style={{ color: "#5A7367", fontSize: "13px", marginBottom: "16px" }}>
                <strong style={{ color: "#1A2B23" }}>{filteredDoctors.length}</strong>{" "}
                {t("treatment.specialistDoctorsAvailable")}{city !== "all" ? ` in ${city}` : ""}
              </p>

              {/* ── Where to get this ── */}
              <div className={styles.whereSection}>
                <p className={styles.whereTitle}>Where to get this</p>
                <CitySelector label="City" />

                {filteredHospitals.slice(0, 3).map((h) => (
                  <Link key={h.id} href={h.profileUrl} className={styles.whereCard}>
                    <div className={styles.whereCardAvatar}>
                      {h.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.whereCardBody}>
                      <div className={styles.whereCardName}>{h.name}</div>
                      <div className={styles.whereCardMeta}>🏥 {h.city}{h.state ? `, ${h.state}` : ""} · ★ {h.rating > 0 ? h.rating.toFixed(1) : "4.0"}</div>
                    </div>
                  </Link>
                ))}

                {filteredDoctors.slice(0, 2).map((d) => (
                  <Link key={d.id} href={d.profileUrl} className={styles.whereCard}>
                    <div className={styles.whereCardAvatar} style={{ background: "#4B5563" }}>
                      {d.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.whereCardBody}>
                      <div className={styles.whereCardName}>{d.fullName}</div>
                      <div className={styles.whereCardMeta}>👨‍⚕️ {d.specialization ?? displayTitle}{d.city ? ` · ${d.city}` : ""}</div>
                    </div>
                  </Link>
                ))}

                {filteredHospitals.length === 0 && filteredDoctors.length === 0 && (
                  <p style={{ fontSize: "12px", color: "#8FA39A" }}>
                    {city !== "all" ? `No results in ${city}. ` : ""}Try a different city.
                  </p>
                )}

                {(filteredHospitals.length > 3 || filteredDoctors.length > 2) && (
                  <button type="button" className={styles.whereMore} onClick={() => setTab("hospitals")} data-testid="btn-view-hospitals">
                    See all {filteredHospitals.length} hospitals →
                  </button>
                )}
              </div>
            </aside>
          </section>
        )}

        {/* ── Hospitals Tab ── */}
        {tab === "hospitals" && (
          <section className={styles.panel} data-testid="tab-hospitals-content">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "4px" }}>
              <h2 style={{ fontSize: "17px" }}>
                {t("treatment.hospitalsFor")} {displayTitle}
              </h2>
            </div>

            <CitySelector label={t("treatment.filterByCity")} />

            {filteredHospitals.length === 0 ? (
              <p style={{ color: "#5A7367", fontSize: "14px" }}>
                {city !== "all"
                  ? `No hospitals found for ${displayTitle} in ${city}.`
                  : t("treatment.noHospitals")}
              </p>
            ) : (
              <div className={styles.cardGrid}>
                {filteredHospitals.map((h) => (
                  <article
                    key={h.id}
                    className={styles.profileCard}
                    data-testid="hospital-card"
                    data-hospital-id={h.id}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6px" }}>
                      <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#1A2B23" }} data-testid="card-name">
                        {h.name}
                      </h4>
                      {h.verified && (
                        <span
                          data-testid="card-verified"
                          style={{
                            fontSize: "11px",
                            background: "#DCFCE7",
                            color: "#1B8A4A",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            flexShrink: 0,
                            fontWeight: 700,
                          }}
                        >
                          {t("common.verified")}
                        </span>
                      )}
                    </div>
                    <p style={{ color: "#5A7367", fontSize: "13px", margin: "4px 0 0" }} data-testid="card-location">
                      {h.city}{h.state ? `, ${h.state}` : ""}
                      {h.rating > 0 && <> · ⭐ {h.rating.toFixed(1)}</>}
                    </p>
                    <div className={styles.tagRow} style={{ marginTop: "8px" }}>
                      {h.specialties.slice(0, 3).map((s) => (
                        <span key={`${h.id}-${s}`}>{s}</span>
                      ))}
                    </div>
                    <div className={styles.profileCardFooter}>
                      <Link href={h.profileUrl} data-testid="btn-view">{t("common.viewProfile")}</Link>
                      <a href={h.directionsUrl} target="_blank" rel="noreferrer" data-testid="btn-directions">
                        {t("common.directions")}
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Doctors Tab ── */}
        {tab === "doctors" && (
          <section className={styles.panel} data-testid="tab-doctors-content">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "4px" }}>
              <h2 style={{ fontSize: "17px" }}>
                {t("treatment.specialistsFor")} {displayTitle}
              </h2>
            </div>

            <CitySelector label={t("treatment.filterByCity")} />

            {filteredDoctors.length === 0 ? (
              <p style={{ color: "#5A7367", fontSize: "14px" }}>
                {city !== "all"
                  ? `No specialists found for ${displayTitle} in ${city}.`
                  : t("treatment.noDoctors")}
              </p>
            ) : (
              <div className={styles.cardGrid}>
                {filteredDoctors.map((d) => (
                  <article
                    key={d.id}
                    className={styles.profileCard}
                    data-testid="doctor-card"
                    data-doctor-id={d.id}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6px" }}>
                      <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#1A2B23" }} data-testid="card-name">
                        {d.fullName}
                      </h4>
                      {d.verified && (
                        <span
                          data-testid="card-verified"
                          style={{
                            fontSize: "11px",
                            background: "#DCFCE7",
                            color: "#1B8A4A",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            flexShrink: 0,
                            fontWeight: 700,
                          }}
                        >
                          {t("common.verified")}
                        </span>
                      )}
                    </div>
                    <p style={{ color: "#5A7367", fontSize: "13px", margin: "4px 0 0" }} data-testid="card-specialization">
                      {d.specialization ?? displayTitle}
                    </p>
                    {(d.city || d.state) && (
                      <p style={{ color: "#8FA39A", fontSize: "12px", margin: "2px 0 0" }} data-testid="card-location">
                        {d.city}{d.state ? `, ${d.state}` : ""}
                      </p>
                    )}
                    <p style={{ color: "#8FA39A", fontSize: "12px", margin: "4px 0 0" }}>
                      {d.yearsOfExperience ? `${d.yearsOfExperience}+ ${t("common.yearsExp")}` : ""}
                      {d.consultationFee ? `${d.yearsOfExperience ? " · " : ""}₹${d.consultationFee} ${t("common.fee")}` : ""}
                    </p>
                    <div className={styles.profileCardFooter}>
                      <Link href={d.profileUrl} data-testid="btn-view">{t("common.viewProfile")}</Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

      </section>
    </main>
  );
}
