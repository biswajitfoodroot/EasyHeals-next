"use client";

import { useState } from "react";
import Link from "next/link";

import { useTranslations } from "@/i18n/LocaleContext";
import AuthBookingModal from "@/components/AuthBookingModal";
import { ContributeModal } from "@/components/contribute/ContributeModal";
import EasyHealsNetworkBadge from "@/components/profiles/EasyHealsNetworkBadge";
import styles from "@/components/profiles/profiles.module.css";
import type { SearchResult } from "@/components/phase1/types";

type HospitalAffiliation = {
  affiliationId: string;
  role: string;
  schedule: Record<string, unknown> | null;
  feeMin: number | null;
  feeMax: number | null;
  isPrimary: boolean;
  hospital: {
    id: string;
    slug: string;
    name: string;
    city: string;
    state: string | null;
    phone: string | null;
    rating: number;
    reviewCount: number;
    verified: boolean;
    specialties: string[];
    profileUrl: string;
    directionsUrl: string;
  };
};

type DoctorPayload = {
  id: string;
  slug: string;
  fullName: string;
  specialization: string | null;
  specialties: string[];
  qualifications: string[];
  languages: string[];
  consultationHours: Record<string, unknown> | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  yearsOfExperience: number | null;
  consultationFee: number | null;
  feeMin: number | null;
  feeMax: number | null;
  rating: number;
  reviewCount: number;
  verified: boolean;
  aiReviewSummary?: string | null;
};

type NearbyDoctor = {
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
  profileUrl: string;
};

type PastAffiliation = {
  affiliationId: string;
  role: string;
  affiliationStatus: string;
  hospital: {
    id: string;
    slug: string;
    name: string;
    city: string;
    state: string | null;
    profileUrl: string;
  };
};

type DoctorProfileClientProps = {
  data: {
    doctor: DoctorPayload;
    affiliations: HospitalAffiliation[];
    pastAffiliations: PastAffiliation[];
    nearbyDoctors: NearbyDoctor[];
    networkTierCode?: string | null;
  };
};

const TABS = ["overview", "affiliations", "reviews"] as const;
type TabKey = (typeof TABS)[number];

const TAB_ICONS: Record<TabKey, string> = {
  overview:     "👤",
  affiliations: "🏥",
  reviews:      "⭐",
};

function avatarColor(name: string): string {
  return String((name.charCodeAt(0) ?? 0) % 8);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function starString(rating: number): string {
  const full = Math.min(5, Math.round(rating));
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function Stars({ rating, reviewCount }: { rating: number; reviewCount: number }) {
  const effective = reviewCount === 0 && rating === 0 ? 4.0 : rating;
  const full = Math.min(5, Math.round(effective));
  return (
    <span className={styles.starRow}>
      {"★".repeat(full)}{"☆".repeat(5 - full)}
      <span>{effective.toFixed(1)}</span>
    </span>
  );
}

export function DoctorProfileClient({ data }: DoctorProfileClientProps) {
  const { t } = useTranslations();
  const { doctor } = data;

  const [tab, setTab]             = useState<TabKey>("overview");
  const [modalOpen, setModalOpen] = useState(false);
  const [contributeOpen, setContributeOpen] = useState(false);

  const primaryHospital = data.affiliations.find((a) => a.isPrimary) ?? data.affiliations[0] ?? null;
  const effectiveRating = doctor.reviewCount === 0 ? 4.0 : doctor.rating;
  const color = avatarColor(doctor.fullName);

  const displayName = /^dr\.?\s+/i.test(doctor.fullName)
    ? doctor.fullName
    : `Dr. ${doctor.fullName}`;

  const subtitle = [doctor.specialization, doctor.city, doctor.state]
    .filter(Boolean)
    .join(" · ");

  const fee = doctor.consultationFee ?? doctor.feeMin;

  const contributeTarget: SearchResult = {
    id: doctor.id,
    type: "doctor",
    name: doctor.fullName,
    slug: doctor.slug,
    city: doctor.city ?? "",
    state: doctor.state,
    rating: doctor.rating,
    verified: doctor.verified,
    communityVerified: true,
    specialties: doctor.specialties,
    source: "db",
    score: doctor.rating,
    description: doctor.bio ?? null,
    profileUrl: `/doctors/${doctor.slug}`,
    phone: doctor.phone,
  };

  const tabLabels: Record<TabKey, string> = {
    overview:     t("doctor.tabOverview"),
    affiliations: "Affiliations",
    reviews:      t("doctor.tabReviews"),
  };

  return (
    <main className={styles.page}>
      {/* ── Hero container ── */}
      <div className={styles.container}>

        {/* ── Breadcrumb ── */}
        <nav className={styles.breadcrumb}>
          <Link href="/">{t("common.home")}</Link>
          <span>/</span>
          <Link href="/doctors">{t("nav.doctors")}</Link>
          <span>/</span>
          <span>{doctor.fullName}</span>
        </nav>

        {/* ── Hero ── */}
        <header className={styles.hero}>
          <div className={styles.heroTop}>

            {/* Left column */}
            <div className={styles.heroInfo}>
              <div className={styles.heroProfile}>
                {/* Doctor avatar */}
                <div
                  className={styles.avatar}
                  data-color={color}
                  style={{ width: 72, height: 72, fontSize: 26, borderRadius: "50%", flexShrink: 0 }}
                  aria-hidden="true"
                >
                  {doctor.fullName.charAt(0).toUpperCase()}
                </div>

                <div className={styles.heroProfileText}>
                  <div className={styles.heroMeta}>
                    <span className={styles.heroVerifiedBadge}>
                      {doctor.verified ? `✅ ${t("common.verified")}` : `✓ ${t("common.communityVerified")}`}
                    </span>
                    {doctor.reviewCount > 0 && (
                      <span className={styles.heroRatingBadge}>
                        ★ {doctor.rating.toFixed(1)}
                      </span>
                    )}
                    {data.networkTierCode && (
                      <EasyHealsNetworkBadge tierCode={data.networkTierCode} compact />
                    )}
                  </div>
                  <h1 className={styles.title}>{displayName}</h1>
                  {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                </div>
              </div>

              {/* Quick-fact pills */}
              <div className={styles.heroFacts}>
                {doctor.phone && (
                  <a href={`tel:${doctor.phone}`} className={styles.heroFact}>
                    <span className={styles.heroFactIcon}>📞</span>
                    {doctor.phone}
                  </a>
                )}
                {doctor.city && (
                  <span className={styles.heroFact}>
                    <span className={styles.heroFactIcon}>📍</span>
                    {doctor.city}{doctor.state ? `, ${doctor.state}` : ""}
                  </span>
                )}
                {doctor.yearsOfExperience ? (
                  <span className={styles.heroFact}>
                    <span className={styles.heroFactIcon}>🏅</span>
                    {doctor.yearsOfExperience}+ {t("common.yearsExp")}
                  </span>
                ) : null}
                {fee ? (
                  <span className={styles.heroFact}>
                    <span className={styles.heroFactIcon}>💰</span>
                    ₹{fee.toLocaleString("en-IN")} {t("common.fee")}
                  </span>
                ) : null}
                {primaryHospital && (
                  <Link href={primaryHospital.hospital.profileUrl} className={styles.heroFact}>
                    <span className={styles.heroFactIcon}>🏥</span>
                    {primaryHospital.hospital.name}
                  </Link>
                )}
              </div>

              {/* Bio */}
              {doctor.bio && (
                <p className={styles.heroDescription}>{doctor.bio}</p>
              )}

              {/* Specialty pills */}
              {doctor.specialties.length > 0 && (
                <div className={styles.heroPillRow}>
                  <span className={styles.heroPillRowLabel}>{t("doctor.specialties")}</span>
                  {doctor.specialties.map((s) => (
                    <span key={s} className={styles.heroPill}>{s}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Right: action card */}
            <div className={styles.actionCard}>
              <div className={styles.actionCardRating}>
                <span className={styles.actionCardRatingVal}>{effectiveRating.toFixed(1)}</span>
                <div className={styles.actionCardRatingMeta}>
                  <span className={styles.actionCardStars}>{starString(effectiveRating)}</span>
                  <span className={styles.actionCardRatingCount}>
                    {doctor.reviewCount === 0
                      ? t("doctor.newDoctor")
                      : `${doctor.reviewCount.toLocaleString("en-IN")} ${t("common.reviews")}`}
                  </span>
                </div>
              </div>

              <div className={styles.actionsMain}>
                <button
                  type="button"
                  className={styles.primaryAction}
                  onClick={() => setModalOpen(true)}
                >
                  {t("common.bookAppointment")}
                </button>
                {doctor.phone && (
                  <a href={`tel:${doctor.phone}`} className={styles.secondaryAction}>
                    {t("common.callNow")}
                  </a>
                )}
              </div>

              <div className={styles.actionsTertiary}>
                {primaryHospital && (
                  <a href={primaryHospital.hospital.directionsUrl} target="_blank" rel="noreferrer">
                    {t("common.getDirections")}
                  </a>
                )}
                <button type="button" onClick={() => setContributeOpen(true)}>
                  {t("common.suggestEdit")}
                </button>
              </div>
            </div>
          </div>

          {/* Stats + qualifications bar */}
          <div className={styles.heroBottom}>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatVal}>{effectiveRating.toFixed(1)}</span>
                <span className={styles.heroStatLab}>{t("common.rating")}</span>
              </div>
              {doctor.yearsOfExperience ? (
                <div className={styles.heroStat}>
                  <span className={styles.heroStatVal}>{doctor.yearsOfExperience}+</span>
                  <span className={styles.heroStatLab}>{t("common.yearsExp")}</span>
                </div>
              ) : null}
              <div className={styles.heroStat}>
                <span className={styles.heroStatVal}>{data.affiliations.length}</span>
                <span className={styles.heroStatLab}>{t("common.hospitals")}</span>
              </div>
              {doctor.reviewCount > 0 && (
                <div className={styles.heroStat}>
                  <span className={styles.heroStatVal}>{doctor.reviewCount}</span>
                  <span className={styles.heroStatLab}>{t("common.reviews")}</span>
                </div>
              )}
            </div>
            {doctor.qualifications.length > 0 && (
              <div className={styles.heroSpecialties}>
                {doctor.qualifications.map((q) => (
                  <span key={q} className={styles.heroSpecialtyPill}>{q}</span>
                ))}
              </div>
            )}
          </div>
        </header>

      </div>{/* end hero container */}

      {/* ── Tab Nav (own container so negative margins bleed correctly) ── */}
      <div className={styles.container}>
        <nav className={styles.anchorNav} role="tablist" aria-label="Doctor profile sections">
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={styles.anchorLink}
              style={tab === key
                ? { background: "#E6F5EC", color: "#1B8A4A", fontWeight: 700 }
                : undefined}
            >
              {TAB_ICONS[key]} {tabLabels[key]}
            </button>
          ))}
        </nav>
      </div>{/* end tab nav container */}

      {/* ── Tab Content ── */}
      <div className={styles.container} style={{ minWidth: 0, marginTop: "24px", marginBottom: "8px" }}>

        {/* ══════════════════════════════
            TAB: Overview
        ══════════════════════════════ */}
        {tab === "overview" && (
          <div className={styles.overviewMain} style={{ minWidth: 0, overflow: "hidden" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "36px 40px",
            }}>

              {/* Highlights */}
              <div>
                <p className={styles.sidebarCardTitle}>✦ {t("doctor.highlights")}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {doctor.yearsOfExperience ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "20px" }}>🏅</span>
                      <div>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#1A2B23" }}>
                          {doctor.yearsOfExperience}+ {t("common.yearsExp")}
                        </p>
                        <p style={{ margin: 0, fontSize: "11px", color: "#8FA39A" }}>{t("common.experience")}</p>
                      </div>
                    </div>
                  ) : null}
                  {(fee ?? doctor.feeMax) ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "20px" }}>💰</span>
                      <div>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#1A2B23" }}>
                          {fee ? `₹${fee.toLocaleString("en-IN")}` : ""}
                          {doctor.feeMax && doctor.feeMin ? ` – ₹${doctor.feeMax.toLocaleString("en-IN")}` : ""}
                        </p>
                        <p style={{ margin: 0, fontSize: "11px", color: "#8FA39A" }}>{t("doctor.consultationFee")}</p>
                      </div>
                    </div>
                  ) : null}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px" }}>⭐</span>
                    <div>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#1A2B23" }}>
                        {effectiveRating.toFixed(1)} / 5
                      </p>
                      <p style={{ margin: 0, fontSize: "11px", color: "#8FA39A" }}>
                        {doctor.reviewCount === 0 ? t("doctor.newDoctor") : `${doctor.reviewCount} ${t("common.reviews")}`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Languages */}
              {doctor.languages.length > 0 && (
                <div>
                  <p className={styles.sidebarCardTitle}>🗣 {t("doctor.languages")}</p>
                  <div className={styles.tagRow}>
                    {doctor.languages.map((l) => <span key={l}>{l}</span>)}
                  </div>
                </div>
              )}

              {/* Qualifications */}
              {doctor.qualifications.length > 0 && (
                <div>
                  <p className={styles.sidebarCardTitle}>🎓 {t("doctor.qualifications")}</p>
                  <div className={styles.tagRow}>
                    {doctor.qualifications.map((q) => <span key={q}>{q}</span>)}
                  </div>
                </div>
              )}

              {/* Consultation hours */}
              {doctor.consultationHours && typeof doctor.consultationHours === "string" && (
                <div>
                  <p className={styles.sidebarCardTitle}>🕐 {t("common.workingHours")}</p>
                  <p className={styles.sidebarCardBody} style={{ wordBreak: "break-word" }}>
                    {doctor.consultationHours as unknown as string}
                  </p>
                </div>
              )}

              {/* Email */}
              {doctor.email && (
                <div>
                  <p className={styles.sidebarCardTitle}>✉️ {t("common.contact")}</p>
                  <a href={`mailto:${doctor.email}`} className={styles.contactValue}>{doctor.email}</a>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ══════════════════════════════
            TAB: Affiliations
        ══════════════════════════════ */}
        {tab === "affiliations" && (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelHeaderIcon}>🏥</div>
              <div>
                <h2 className={styles.panelTitle}>{t("doctor.tabAffiliations")}</h2>
                <p className={styles.panelHint}>{t("doctor.affiliationsHint")}</p>
              </div>
            </div>

            {/* ── Current affiliations ── */}
            {data.affiliations.length > 0 && (
              <>
                {data.pastAffiliations.length > 0 && (
                  <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#1B8A4A", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
                    ✅ {t("common.verified")}
                  </h3>
                )}
                <section className={styles.directoryGrid}>
                  {data.affiliations.map((item) => (
                    <article key={item.affiliationId} className={styles.directoryCard} data-color={avatarColor(item.hospital.name)}>
                      {/* Desktop card header */}
                      <div className={styles.cardHeader}>
                        <div className={styles.avatar} data-color={avatarColor(item.hospital.name)} aria-hidden="true">
                          {initials(item.hospital.name)}
                        </div>
                        <div className={styles.cardHeaderText}>
                          <h3 className={styles.cardName}>{item.hospital.name}</h3>
                          <p className={styles.cardLocation}>
                            {item.hospital.city}{item.hospital.state ? `, ${item.hospital.state}` : ""}
                          </p>
                        </div>
                        <span className={styles.typeBadge} data-type="hospital">🏥</span>
                      </div>

                      {/* Mobile list body */}
                      <div className={styles.directoryListBody}>
                        <p className={styles.listBodyName}>{item.hospital.name}</p>
                        <p className={styles.listBodyMeta}>
                          {item.hospital.city}{item.hospital.state ? `, ${item.hospital.state}` : ""}
                          {item.role ? ` · ${item.role}` : ""}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                          <Stars rating={item.hospital.rating} reviewCount={item.hospital.reviewCount} />
                          <span className={styles.listBodyVerifiedBadge} data-verified={item.hospital.verified ? "true" : "false"}>
                            {item.hospital.verified ? `✅ ${t("common.verified")}` : t("common.communityVerified")}
                          </span>
                        </div>
                      </div>

                      {item.role && (
                        <p style={{ margin: 0, fontSize: "12px", color: "#5A7367" }}>{item.role}</p>
                      )}

                      {item.hospital.specialties.length > 0 && (
                        <div className={styles.tagRow}>
                          {item.hospital.specialties.slice(0, 3).map((s) => (
                            <span key={`${item.affiliationId}-${s}`}>{s}</span>
                          ))}
                        </div>
                      )}

                      <div className={styles.cardMeta}>
                        <Stars rating={item.hospital.rating} reviewCount={item.hospital.reviewCount} />
                        {item.hospital.reviewCount > 0 && (
                          <span className={styles.reviewCount}>({item.hospital.reviewCount.toLocaleString("en-IN")})</span>
                        )}
                        <span className={styles.verifiedBadge}>
                          {item.hospital.verified ? `✅ ${t("common.verified")}` : t("common.communityVerified")}
                        </span>
                      </div>

                      <div className={styles.directoryCardFooter}>
                        <Link
                          href={item.hospital.profileUrl}
                          className={styles.directoryCardBook}
                          style={{ background: "#1B8A4A", borderColor: "#1B8A4A", boxShadow: "0 2px 6px rgba(27,138,74,0.22)" }}
                        >
                          {t("home.view")}
                        </Link>
                        <a
                          href={item.hospital.directionsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.directoryCardView}
                        >
                          {t("common.getDirections")}
                        </a>
                      </div>
                    </article>
                  ))}
                </section>
              </>
            )}

            {/* ── Past affiliations ── */}
            {data.pastAffiliations.length > 0 && (
              <>
                <div style={{ marginTop: "24px", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>⛔</span>
                  <p style={{ margin: 0, fontSize: "13px", color: "#b91c1c", fontWeight: 600 }}>
                    {t("doctor.noAppointments")}
                  </p>
                </div>
                <h3 style={{ marginTop: "16px", fontSize: "13px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
                  🕐 {t("doctor.previouslyAt")}
                </h3>
                <section className={styles.directoryGrid}>
                  {data.pastAffiliations.map((item) => (
                    <article
                      key={item.affiliationId}
                      className={styles.directoryCard}
                      data-color={avatarColor(item.hospital.name)}
                      style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0" }}
                    >
                      <div className={styles.cardHeader}>
                        <div
                          className={styles.avatar}
                          data-color={avatarColor(item.hospital.name)}
                          aria-hidden="true"
                          style={{ filter: "grayscale(60%)" }}
                        >
                          {initials(item.hospital.name)}
                        </div>
                        <div className={styles.cardHeaderText}>
                          <h3 className={styles.cardName} style={{ color: "#64748b" }}>{item.hospital.name}</h3>
                          <p className={styles.cardLocation} style={{ color: "#94a3b8" }}>
                            {item.hospital.city}{item.hospital.state ? `, ${item.hospital.state}` : ""}
                          </p>
                        </div>
                        <span style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", background: "#e2e8f0", borderRadius: "4px", padding: "2px 6px", letterSpacing: "0.08em", alignSelf: "flex-start", flexShrink: 0 }}>
                          {t("doctor.past")}
                        </span>
                      </div>

                      <div className={styles.directoryListBody}>
                        <p className={styles.listBodyName} style={{ color: "#64748b" }}>{item.hospital.name}</p>
                        <p className={styles.listBodyMeta} style={{ color: "#94a3b8" }}>
                          {item.hospital.city}{item.hospital.state ? `, ${item.hospital.state}` : ""}
                          {item.role ? ` · ${item.role}` : ""}
                        </p>
                      </div>

                      {item.role && (
                        <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>{item.role}</p>
                      )}

                      <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
                        {t("doctor.noAppointments")}
                      </p>

                      <div className={styles.directoryCardFooter}>
                        <Link
                          href={item.hospital.profileUrl}
                          className={styles.directoryCardView}
                          style={{ color: "#94a3b8", borderColor: "#cbd5e1", background: "#f1f5f9" }}
                        >
                          {t("home.view")}
                        </Link>
                      </div>
                    </article>
                  ))}
                </section>
              </>
            )}

            {data.affiliations.length === 0 && data.pastAffiliations.length === 0 && (
              <p>{t("doctor.noAffiliations")}</p>
            )}
          </section>
        )}

        {/* ══════════════════════════════
            TAB: Reviews
        ══════════════════════════════ */}
        {tab === "reviews" && (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelHeaderIcon}>⭐</div>
              <div>
                <h2 className={styles.panelTitle}>{t("doctor.ratingsTitle")}</h2>
                <p className={styles.panelHint}>
                  {t("common.currentScore")}: <strong>{effectiveRating.toFixed(1)} / 5</strong>
                  {" "}
                  {doctor.reviewCount === 0
                    ? `(${t("doctor.newDoctor")})`
                    : `${doctor.reviewCount.toLocaleString("en-IN")} ${t("common.reviews")}`}
                </p>
              </div>
            </div>

            {/* Rating visual */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px", background: "linear-gradient(135deg,#F8FAF9,#EDF7F2)", borderRadius: "14px", border: "1px solid #D0E4D8", marginBottom: "16px" }}>
              <span style={{ fontSize: "48px", fontWeight: 900, color: "#1B8A4A", fontFamily: "var(--font-bricolage),sans-serif", lineHeight: 1 }}>
                {effectiveRating.toFixed(1)}
              </span>
              <div>
                <div style={{ color: "#F59E0B", fontSize: "22px", letterSpacing: "2px" }}>
                  {starString(effectiveRating)}
                </div>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#5A7367" }}>
                  {doctor.reviewCount === 0
                    ? t("doctor.ratingsNote")
                    : `${doctor.reviewCount.toLocaleString("en-IN")} ${t("common.reviews")}`}
                </p>
              </div>
            </div>

            {doctor.aiReviewSummary ? (
              <div style={{ padding: "14px 16px", borderRadius: "12px", border: "1px solid rgba(27,138,74,0.2)", background: "rgba(0,184,150,0.06)" }}>
                <p style={{ margin: "0 0 6px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#1B8A4A" }}>
                  {t("doctor.aiReviewSummary")}
                </p>
                <p style={{ margin: 0, lineHeight: 1.6, fontSize: "14px", color: "#1A2B23" }}>
                  {doctor.aiReviewSummary}
                </p>
              </div>
            ) : (
              <p style={{ color: "#8FA39A", fontStyle: "italic" }}>{t("doctor.ratingsNote")}</p>
            )}
          </section>
        )}

      </div>{/* end tab content container */}

      {/* ── Nearby Doctors (always visible, below all tabs) ── */}
      {data.nearbyDoctors.length > 0 && (
        <div className={styles.container} style={{ minWidth: 0, marginTop: "40px" }}>
          <div className={styles.relatedSection} style={{ marginTop: 0, borderTop: "none", paddingTop: 0 }}>
            <h3 className={styles.relatedTitle}>👨‍⚕️ {t("doctor.nearbyDoctors")}</h3>
            <div className={styles.relatedScroll}>
              {data.nearbyDoctors.map((item) => (
                <Link key={item.id} href={item.profileUrl} className={styles.relatedCard}>
                  <span className={styles.relatedCardName}>{item.fullName}</span>
                  <span className={styles.relatedCardSub}>
                    {item.specialization ?? t("common.specialist")}{item.city ? ` · ${item.city}` : ""}
                  </span>
                  <span className={styles.relatedCardBadge}>
                    ★ {item.reviewCount === 0 ? "4.0" : item.rating.toFixed(1)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile sticky bar ── */}
      <div className={styles.mobileBar}>
        <button type="button" className={styles.mobilePrimary} onClick={() => setModalOpen(true)}>
          {t("common.bookAppointment")}
        </button>
        {doctor.phone && (
          <a href={`tel:${doctor.phone}`}>
            {t("common.callNow")}
          </a>
        )}
      </div>

      <AuthBookingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        doctorName={displayName}
        doctorId={doctor.id}
        doctorHospitals={data.affiliations.map((a) => ({ id: a.hospital.id, name: a.hospital.name, city: a.hospital.city }))}
        hospitalId={data.affiliations.length === 1 ? data.affiliations[0].hospital.id : undefined}
        hospitalName={data.affiliations.length === 1 ? data.affiliations[0].hospital.name : undefined}
      />

      <ContributeModal
        isOpen={contributeOpen}
        target={contributeTarget}
        onClose={() => setContributeOpen(false)}
      />
    </main>
  );
}
