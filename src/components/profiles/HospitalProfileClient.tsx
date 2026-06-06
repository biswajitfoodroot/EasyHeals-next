"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

import { useTranslations } from "@/i18n/LocaleContext";
import AuthBookingModal, { type BookingDoctor } from "@/components/AuthBookingModal";
import { ContributeModal } from "@/components/contribute/ContributeModal";
import { InlineFieldEditor } from "@/components/profiles/InlineFieldEditor";
import EasyHealsNetworkBadge from "@/components/profiles/EasyHealsNetworkBadge";
import HospitalMiniCard from "@/components/profiles/HospitalMiniCard";
import styles from "@/components/profiles/profiles.module.css";
import type { SearchResult } from "@/components/phase1/types";

type AffiliatedDoctor = {
  id: string;
  slug: string;
  name: string;
  specialization: string | null;
  specialties: string[];
  qualifications: string[];
  avatarUrl: string | null;
  yearsOfExperience: number | null;
  rating: number;
  reviewCount: number;
  verified: boolean;
  role: string;
  schedule: Record<string, unknown> | null;
  feeMin: number | null;
  feeMax: number | null;
  isPrimary: boolean;
  profileUrl: string;
};

type NearbyHospital = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string | null;
  rating: number;
  specialties: string[];
  addressLine1: string | null;
  latitude: number | null;
  longitude: number | null;
  profileUrl: string;
  mapUrl: string;
};

type HospitalPackage = {
  id: string;
  packageName: string;
  procedureName: string | null;
  department: string | null;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  lengthOfStay: string | null;
  inclusions: string[];
};

type HospitalPayload = {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string | null;
  addressLine1: string | null;
  addressLabel: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  rating: number;
  reviewCount: number;
  specialties: string[];
  facilities: string[];
  photos: string[];
  accreditations: string[];
  workingHours: Record<string, unknown> | null;
  feesRange: Record<string, unknown> | null;
  map: {
    embedUrl: string;
    directionsUrl: string;
  };
};

type PatientReview = {
  id: string;
  patientName: string;
  rating: number;
  title: string | null;
  body: string | null;
  visitDate: string | null;
  createdAt: string | null;
};

type HospitalProfileClientProps = {
  data: {
    hospital: HospitalPayload;
    packages: HospitalPackage[];
    doctors: AffiliatedDoctor[];
    nearbyHospitals: NearbyHospital[];
    reviews: PatientReview[];
    networkTierCode?: string | null;
  };
};

const TABS = ["doctors", "packages", "reviews"] as const;
type TabKey = (typeof TABS)[number];

function ratingText(rating: number, count: number) {
  // When no real reviews yet, show 4.0 (New) per Bayesian prior
  if (count === 0) return "4.0 (New)";
  return `${rating.toFixed(1)} (${count.toLocaleString("en-IN")})`;
}

function objectSummary(value: Record<string, unknown> | null, notUpdatedLabel = "Not updated"): string {
  if (!value) return notUpdatedLabel;
  return Object.entries(value)
    .map(([key, item]) => `${key}: ${String(item)}`)
    .join(" | ");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const HOSPITAL_STOP_WORDS = new Set(["hospital", "care", "clinic", "centre", "center", "medical", "multi", "speciality", "specialty", "and", "the", "a"]);

function hospitalEmblemText(name: string): string {
  const words = name.trim().split(/\s+/).filter(w => !HOSPITAL_STOP_WORDS.has(w.toLowerCase()) && w.length > 1);
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function docAvatarColor(name: string): string {
  return String(name.charCodeAt(0) % 8);
}

const facilityIcons: Record<string, string> = {
  emergency: "🚑",
  "24x7 emergency": "🚑",
  icu: "🛏️",
  pharmacy: "💊",
  "blood bank": "🩸",
  parking: "🅿️",
  wifi: "📶",
  ambulance: "🚑",
  cafeteria: "☕",
  canteen: "☕",
  atm: "🏧",
  laboratory: "🔬",
  lab: "🔬",
  "x-ray": "🩻",
  mri: "🧲",
  wheelchair: "♿",
  lift: "🛗",
};

const accreditationIcons: Record<string, string> = {
  nabh: "🥇",
  nabl: "🔬",
  jci: "🌎",
  iso: "🎖️",
};

function PictorialListItem({ text, type }: { text: string; type: "facility" | "accreditation" }) {
  const lower = text.toLowerCase();
  const map = type === "facility" ? facilityIcons : accreditationIcons;
  // Match key by substring if exact match fails
  const iconKey = Object.keys(map).find(k => lower.includes(k));
  const icon = iconKey ? map[iconKey] : "✔️";

  return (
    <div className={styles.pictorialItem}>
      <div className={styles.pictorialIcon}>{icon}</div>
      <span className={styles.pictorialText}>{text}</span>
    </div>
  );
}

export function HospitalProfileClient({ data }: HospitalProfileClientProps) {
  const { t } = useTranslations();
  const [modalOpen, setModalOpen] = useState(false);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [showAllSpecialties, setShowAllSpecialties] = useState(false);

  // Review submission form state
  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Auto-open booking modal when ?book=1 or ?contact=1 is in URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("book") || params.has("contact")) setModalOpen(true);
  }, []);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [packageSearch, setPackageSearch] = useState("");

  const visibleDoctors = useMemo(() => {
    const q = doctorSearch.trim().toLowerCase();
    if (!q) return data.doctors;
    return data.doctors.filter((d) =>
      d.name.toLowerCase().includes(q) ||
      (d.specialization ?? "").toLowerCase().includes(q) ||
      d.specialties.some((s) => s.toLowerCase().includes(q))
    );
  }, [data.doctors, doctorSearch]);

  const visiblePackages = useMemo(() => {
    const q = packageSearch.trim().toLowerCase();
    if (!q) return data.packages;
    return data.packages.filter((p) =>
      p.packageName.toLowerCase().includes(q) ||
      (p.procedureName ?? "").toLowerCase().includes(q) ||
      (p.department ?? "").toLowerCase().includes(q)
    );
  }, [data.packages, packageSearch]);

  const titleMeta = useMemo(
    () =>
      [
        data.hospital.city,
        data.hospital.state,
        `★ ${ratingText(data.hospital.rating, data.hospital.reviewCount)}`,
      ]
        .filter(Boolean)
        .join(" · "),
    [data.hospital.city, data.hospital.reviewCount, data.hospital.rating, data.hospital.state],
  );

  const contributeTarget: SearchResult = {
    id: data.hospital.id,
    type: "hospital",
    name: data.hospital.name,
    slug: data.hospital.slug,
    city: data.hospital.city,
    state: data.hospital.state,
    rating: data.hospital.rating,
    verified: true,
    communityVerified: true,
    specialties: data.hospital.specialties,
    source: "db",
    score: data.hospital.rating,
    description: data.hospital.description,
    profileUrl: `/hospitals/${data.hospital.slug}`,
    phone: data.hospital.phone,
  };

  const tabLabels: Record<TabKey, string> = {
    doctors: t("hospital.tabDoctors"),
    packages: t("hospital.tabPackagesShort"),
    reviews: t("hospital.tabReviews"),
  };

  const tabIcons: Record<TabKey, string> = {
    doctors: "👨‍⚕️",
    packages: "📦",
    reviews: "⭐",
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">{t("common.home")}</Link>
          <span>/</span>
          <Link href="/hospitals">{t("nav.hospitals")}</Link>
          <span>/</span>
          <span>{data.hospital.name}</span>
        </nav>

        {/* ── Photo Gallery ── */}
        {data.hospital.photos && data.hospital.photos.length > 0 && (
          <div className={styles.galleryWrap}>
            <div className={styles.galleryScroll}>
              {data.hospital.photos.map((photo, index) => (
                <div key={index} className={styles.galleryItem}>
                  <Image 
                    src={photo} 
                    alt={`${data.hospital.name} facility photo ${index + 1}`} 
                    fill 
                    className={styles.galleryImage} 
                    sizes="(max-width: 640px) 100vw, 80vw"
                    priority={index === 0}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
        <header className={styles.hero}>
          <div className={styles.heroTop}>
            {/* Identity Column */}
            <div className={styles.heroInfo}>

              {/* Emblem + name group */}
              <div className={styles.heroProfile}>
                <div className={styles.hospitalEmblem} aria-hidden="true">
                  {hospitalEmblemText(data.hospital.name)}
                </div>
                <div className={styles.heroProfileText}>
                  <div className={styles.heroMeta}>
                    {data.networkTierCode && (
                      <EasyHealsNetworkBadge tierCode={data.networkTierCode} compact />
                    )}
                    {!data.networkTierCode && (
                      <span className={styles.heroVerifiedBadge}>✓ {t("common.verified")}</span>
                    )}
                    <span className={styles.heroRatingBadge}>
                      ★ {ratingText(data.hospital.rating, data.hospital.reviewCount)}
                    </span>
                  </div>
                  <h1 className={styles.title}>{data.hospital.name}</h1>
                  <p className={styles.subtitle}>
                    📍 {data.hospital.city}{data.hospital.state ? `, ${data.hospital.state}` : ""}
                  </p>
                </div>
              </div>

              {/* Quick facts strip */}
              <div className={styles.heroFacts}>
                {data.hospital.phone && (
                  <a href={`tel:${data.hospital.phone}`} className={styles.heroFact}>
                    <span className={styles.heroFactIcon}>📞</span>
                    <span>{data.hospital.phone}</span>
                  </a>
                )}
                {data.hospital.website && (
                  <a href={data.hospital.website} target="_blank" rel="noreferrer" className={styles.heroFact}>
                    <span className={styles.heroFactIcon}>🌐</span>
                    <span>Website</span>
                  </a>
                )}
                {data.hospital.addressLine1 && (
                  <span className={styles.heroFact}>
                    <span className={styles.heroFactIcon}>📌</span>
                    <span>{data.hospital.addressLine1}</span>
                  </span>
                )}
                {data.hospital.workingHours && (
                  <span className={styles.heroFact}>
                    <span className={styles.heroFactIcon}>🕐</span>
                    <span>{objectSummary(data.hospital.workingHours, "").split("|")[0]?.trim() || "Open"}</span>
                  </span>
                )}
              </div>

              {/* About */}
              <p className={styles.heroDescription}>
                {data.hospital.description ?? t("hospital.descriptionPending")}
              </p>

              {/* Facilities */}
              {data.hospital.facilities.length > 0 && (
                <div className={styles.heroPillRow}>
                  <span className={styles.heroPillRowLabel}>Facilities</span>
                  {data.hospital.facilities.slice(0, 8).map((f) => (
                    <span key={f} className={styles.heroPill}>{f}</span>
                  ))}
                </div>
              )}

              {/* Accreditations */}
              {data.hospital.accreditations.length > 0 && (
                <div className={styles.heroPillRow}>
                  <span className={styles.heroPillRowLabel}>Accreditations</span>
                  {data.hospital.accreditations.map((a) => (
                    <span key={a} className={`${styles.heroPill} ${styles.heroPillAccred}`}>🏅 {a}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Action Card */}
            <div className={styles.actionCard}>
              <div className={styles.actionCardRating}>
                <span className={styles.actionCardRatingVal}>
                  {ratingText(data.hospital.rating, data.hospital.reviewCount).split(" ")[0]}
                </span>
                <div className={styles.actionCardRatingMeta}>
                  <span className={styles.actionCardStars}>
                    {"★".repeat(Math.round(data.hospital.rating))}{"☆".repeat(5 - Math.round(data.hospital.rating))}
                  </span>
                  <span className={styles.actionCardRatingCount}>
                    {data.hospital.reviewCount > 0 ? `${data.hospital.reviewCount.toLocaleString("en-IN")} reviews` : "New"}
                  </span>
                </div>
              </div>
              <div className={styles.actionsMain}>
                <button type="button" className={styles.primaryAction} onClick={() => setModalOpen(true)}>
                  📅 {t("common.bookAppointment")}
                </button>
                {data.hospital.phone ? (
                  <a href={`tel:${data.hospital.phone}`} className={styles.secondaryAction}>
                    📞 {t("common.callNow")}
                  </a>
                ) : null}
              </div>
              <div className={styles.actionsTertiary}>
                <a href={data.hospital.map.directionsUrl} target="_blank" rel="noreferrer">
                  📍 {t("common.getDirections")}
                </a>
                <button type="button" onClick={() => setContributeOpen(true)}>
                  ✏️ {t("common.suggestEdit")}
                </button>
              </div>
            </div>
          </div>

          {/* ── Stats + Specialties meta bar ── */}
          <div className={styles.heroBottom}>
            <div className={styles.heroStats}>
              {data.doctors.length > 0 && (
                <div className={styles.heroStat}>
                  <span className={styles.heroStatVal}>{data.doctors.length}</span>
                  <span className={styles.heroStatLab}>Doctors</span>
                </div>
              )}
              <div className={styles.heroStat}>
                <span className={styles.heroStatVal}>{data.hospital.specialties.length || "—"}</span>
                <span className={styles.heroStatLab}>Specialties</span>
              </div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatVal}>{ratingText(data.hospital.rating, data.hospital.reviewCount).split(" ")[0]}</span>
                <span className={styles.heroStatLab}>★ Rating</span>
              </div>
              {data.packages.length > 0 && (
                <div className={styles.heroStat}>
                  <span className={styles.heroStatVal}>{data.packages.length}</span>
                  <span className={styles.heroStatLab}>Packages</span>
                </div>
              )}
            </div>
            {data.hospital.specialties.length > 0 && (
              <div className={styles.heroSpecialties}>
                {(showAllSpecialties ? data.hospital.specialties : data.hospital.specialties.slice(0, 6)).map((s) => (
                  <span key={s} className={styles.heroSpecialtyPill}>{s}</span>
                ))}
                {!showAllSpecialties && data.hospital.specialties.length > 6 && (
                  <button type="button" onClick={() => setShowAllSpecialties(true)} className={styles.heroSpecialtyMore}>
                    +{data.hospital.specialties.length - 6} more
                  </button>
                )}
              </div>
            )}
          </div>
        </header>
      </div>

      {/* ══ STICKY NAVIGATION BAR ══════════════════════════════════════════════ */}
      <div className={styles.container}>
        <nav className={styles.anchorNav} aria-label="Hospital profile sections">
          {TABS.map((key) => (
            <a key={key} href={`#${key}`} className={styles.anchorLink}>
              {tabIcons[key]} {tabLabels[key]}
            </a>
          ))}
        </nav>
      </div>

      <section id="doctors" className={styles.pageSection}>
        <div className={styles.container}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelHeaderIcon}>👨‍⚕️</div>
              <div>
                <h2 className={styles.panelTitle}>{t("hospital.affiliatedDoctors")}</h2>
                <p className={styles.panelHint}>{t("hospital.affiliatedDoctorsHint")}</p>
              </div>
            </div>

            <div className={styles.tabSearchControl}>
              <div className={styles.tabSearchRow}>
                <svg className={styles.tabSearchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder={t("hospital.searchDoctors")}
                  className={styles.tabSearchInput}
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  aria-label={t("hospital.searchDoctors")}
                />
                {doctorSearch && (
                  <button type="button" className={styles.tabSearchClear} onClick={() => setDoctorSearch("")}>✕</button>
                )}
              </div>
            </div>

            <div className={styles.sectionScrollBox}>
            <div className={styles.cardGrid}>
              {visibleDoctors.map((doctor) => (
                <article key={doctor.id} className={styles.docCard} data-color={docAvatarColor(doctor.name)}>
                  {/* Header: avatar + identity */}
                  <div className={styles.docCardHeader}>
                    <div className={styles.avatar} data-color={docAvatarColor(doctor.name)} aria-hidden="true">
                      {initials(doctor.name)}
                    </div>
                    <div className={styles.docCardIdentity}>
                      <h3 className={styles.docCardName}>{doctor.name}</h3>
                      <span className={styles.docCardRole}>{doctor.role}</span>
                    </div>
                  </div>

                  {/* Specialization */}
                  {doctor.specialization && (
                    <div className={styles.docCardSection}>
                      <span className={styles.docCardSectionLabel}>🩺 Specialization</span>
                      <span className={styles.docCardSpecValue}>{doctor.specialization}</span>
                    </div>
                  )}

                  {/* Qualifications */}
                  {doctor.qualifications.length > 0 && (
                    <div className={styles.docCardSection}>
                      <span className={styles.docCardSectionLabel}>🎓 {t("doctor.qualifications")}</span>
                      <div className={styles.docCardQualPills}>
                        {doctor.qualifications.slice(0, 3).map((q) => (
                          <span key={q} className={styles.docCardQualPill}>{q}</span>
                        ))}
                        {doctor.qualifications.length > 3 && (
                          <span className={styles.docCardQualPillMore}>+{doctor.qualifications.length - 3}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sub-specialties */}
                  {doctor.specialties.length > 0 && (
                    <div className={styles.docCardSpecialties}>
                      {doctor.specialties.slice(0, 3).map((item) => (
                        <span key={`${doctor.id}-${item}`} className={styles.docCardSpecialtyTag}>{item}</span>
                      ))}
                      {doctor.specialties.length > 3 && (
                        <span className={styles.tagMore}>+{doctor.specialties.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className={styles.docCardFooter}>
                    {doctor.yearsOfExperience ? (
                      <span className={styles.docCardExp}>
                        <span className={styles.docCardExpVal}>{doctor.yearsOfExperience}+</span> {t("common.yearsExp")}
                      </span>
                    ) : (
                      <span className={styles.docCardExpMuted}>⏳ {t("common.updating")}</span>
                    )}
                    <Link href={doctor.profileUrl} className={styles.docCardViewBtn}>{t("common.viewProfile")}</Link>
                  </div>
                </article>
              ))}
              {visibleDoctors.length === 0 && (
                <div className={styles.emptyStateCard}>
                  <div className={styles.emptyStateIcon}>👨‍⚕️</div>
                  <h3 className={styles.emptyStateTitle}>{t("common.noResults")}</h3>
                  <p className={styles.emptyStateBody}>Try a different search term or clear the department filter.</p>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </section>

      <section id="packages" className={styles.pageSection}>
        <div className={styles.container}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelHeaderIcon}>📦</div>
              <div>
                <h2 className={styles.panelTitle}>{t("hospital.tabPackages")}</h2>
              </div>
            </div>
            
            <div className={styles.tabSearchControl}>
              <div className={styles.tabSearchRow}>
                <svg className={styles.tabSearchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder={t("hospital.searchPackages")}
                  className={styles.tabSearchInput}
                  value={packageSearch}
                  onChange={(e) => setPackageSearch(e.target.value)}
                  aria-label={t("hospital.searchPackages")}
                />
                {packageSearch && (
                  <button type="button" className={styles.tabSearchClear} onClick={() => setPackageSearch("")}>✕</button>
                )}
              </div>
            </div>
            {visiblePackages.length === 0 ? (
              <div className={styles.emptyStateCard}>
                <div className={styles.emptyStateIcon}>📦</div>
                <h3 className={styles.emptyStateTitle}>{packageSearch ? t("hospital.noMatchingPackages") : t("hospital.noPackagesYet")}</h3>
                <p className={styles.emptyStateBody}>
                  {packageSearch ? t("hospital.noPackagesMatch").replace("{q}", packageSearch) : t("hospital.noPackages")}
                </p>
              </div>
            ) : (
              <div className={styles.sectionScrollBox}>
              <div className={styles.cardGrid}>
                {visiblePackages.map((pkg) => (
                  <article key={pkg.id} className={styles.packageCard}>
                    <h3 className={styles.packageName}>{pkg.packageName}</h3>
                    {pkg.procedureName && <p className={styles.packageProcedure}>{pkg.procedureName}</p>}
                    {pkg.department && <span className={styles.packageDept}>{pkg.department}</span>}
                    <p className={styles.packagePrice}>
                      {pkg.priceMin || pkg.priceMax
                        ? `₹${pkg.priceMin?.toLocaleString("en-IN") ?? "–"} – ₹${pkg.priceMax?.toLocaleString("en-IN") ?? "–"}${pkg.currency !== "INR" ? ` ${pkg.currency}` : ""}`
                        : t("common.priceOnRequest")}
                    </p>
                    {pkg.lengthOfStay && <p className={styles.packageStay}>🛏 {t("common.stay")}: {pkg.lengthOfStay}</p>}
                    {pkg.inclusions.length > 0 && (
                      <ul className={styles.packageInclusions}>
                        {pkg.inclusions.slice(0, 4).map((inc) => (
                          <li key={inc} className={styles.packageInclusionItem}>{inc}</li>
                        ))}
                      </ul>
                    )}
                    <div className={styles.profileCardFooter}>
                      <button type="button" onClick={() => setModalOpen(true)} className={styles.directoryCardBook}>
                        {t("common.bookPackage")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              </div>
            )}
          </div>
        </div>
      </section>



      <section id="reviews" className={styles.pageSection}>
        <div className={styles.container}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelHeaderIcon}>⭐</div>
              <div>
                <h2 className={styles.panelTitle}>{t("hospital.ratingsTitle")}</h2>
                <p className={styles.panelHint}>
                  {t("common.currentScore")}: <strong>{ratingText(data.hospital.rating, data.hospital.reviewCount)}</strong>
                </p>
              </div>
            </div>

            {/* Approved reviews list */}
            {data.reviews.length > 0 && (
              <div className={styles.reviewList}>
                {data.reviews.map((review) => (
                  <article key={review.id} className={styles.reviewCard}
                    itemScope itemType="https://schema.org/Review">
                    <meta itemProp="itemReviewed" content={data.hospital.name} />
                    <div className={styles.reviewCardHeader}>
                      <div className={styles.reviewAuthorRow}>
                        <div className={styles.reviewAvatar} aria-hidden="true">
                          {review.patientName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className={styles.reviewAuthorName} itemProp="author" itemScope itemType="https://schema.org/Person">
                            <span itemProp="name">{review.patientName}</span>
                          </div>
                          {review.visitDate && (
                            <div className={styles.reviewVisitDate}>
                              Visited {new Date(review.visitDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={styles.reviewStars} itemProp="reviewRating" itemScope itemType="https://schema.org/Rating">
                        <meta itemProp="bestRating" content="5" />
                        <meta itemProp="worstRating" content="1" />
                        {"★".repeat(Math.round(review.rating))}{"☆".repeat(5 - Math.round(review.rating))}
                        <span className={styles.reviewStarValue} itemProp="ratingValue">{review.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    {review.title && <p className={styles.reviewTitle}>{review.title}</p>}
                    {review.body && <p className={styles.reviewBodyText} itemProp="reviewBody">{review.body}</p>}
                  </article>
                ))}
              </div>
            )}

            {/* Review submission form */}
            <div className={styles.reviewForm}>
              <h3 className={styles.reviewFormTitle}>
                {data.reviews.length > 0 ? t("common.writeReview") : t("common.beFirstReview")}
              </h3>
              {reviewSubmitted ? (
                <p className={styles.reviewSuccess}>
                  ✅ {t("common.reviewThankYou")}
                </p>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!reviewBody.trim() || !reviewName.trim()) return;
                    setReviewSubmitting(true);
                    setReviewError(null);
                    try {
                      const res = await fetch("/api/reviews", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          entityType: "hospital",
                          entityId: data.hospital.id,
                          patientName: reviewName,
                          rating: reviewRating,
                          title: reviewTitle || undefined,
                          body: reviewBody,
                        }),
                      });
                      if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error ?? "Submission failed");
                      }
                      setReviewSubmitted(true);
                    } catch (err: unknown) {
                      setReviewError((err as Error).message);
                    } finally {
                      setReviewSubmitting(false);
                    }
                  }}
                  className={styles.reviewFormBody}
                >
                  <div className={styles.reviewFormRow}>
                    <input
                      required
                      value={reviewName}
                      onChange={(e) => setReviewName(e.target.value)}
                      placeholder="Your name *"
                      className={styles.reviewInput}
                    />
                    <select
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      className={styles.reviewSelect}
                    >
                      {[5, 4, 3, 2, 1].map((r) => (
                        <option key={r} value={r}>{"★".repeat(r)} {r}/5</option>
                      ))}
                    </select>
                  </div>
                  <input
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder="Review title (optional)"
                    className={styles.reviewInput}
                  />
                  <textarea
                    required
                    value={reviewBody}
                    onChange={(e) => setReviewBody(e.target.value)}
                    placeholder="Share your experience (min 10 characters) *"
                    rows={4}
                    className={styles.reviewTextarea}
                  />
                  {reviewError && <p className={styles.reviewError}>{reviewError}</p>}
                  <button type="submit" disabled={reviewSubmitting} className={styles.reviewSubmitBtn}>
                    {reviewSubmitting ? t("common.submitting") : t("common.submitReview")}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.pageSection}>
        <div className={styles.container}>

        {/* ── Related: Similar Hospitals ── */}
        {data.nearbyHospitals.length > 0 && (
          <div className={styles.relatedSection}>
            <h3 className={styles.relatedTitle}>🏥 {t("hospital.nearby")}</h3>
            <div className={styles.relatedScroll}>
              {data.nearbyHospitals.slice(0, 8).map((item) => (
                <HospitalMiniCard
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  profileUrl={item.profileUrl}
                  city={item.city}
                  state={item.state}
                  rating={item.rating}
                  specialties={item.specialties}
                />
              ))}
            </div>
          </div>
        )}
        </div>
      </section>

      <div className={styles.mobileBar}>
        <button type="button" className={styles.mobilePrimary} onClick={() => setModalOpen(true)}>
          {t("common.bookAppointment")}
        </button>
        {data.hospital.phone ? (
          <a href={`tel:${data.hospital.phone}`}>{t("common.callNow")}</a>
        ) : null}
      </div>

      <AuthBookingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        hospitalId={data.hospital.id}
        hospitalName={data.hospital.name}
        isNetworkPartner={!!data.networkTierCode}
        hospitalPhone={data.hospital.phone ?? undefined}
        hospitalDoctors={data.doctors.map((d): BookingDoctor => ({
          id: d.id,
          name: d.name,
          specialty: d.specialization,
          avatarUrl: d.avatarUrl,
        }))}
      />

      <ContributeModal
        isOpen={contributeOpen}
        target={contributeTarget}
        onClose={() => setContributeOpen(false)}
      />
    </main>
  );
}
