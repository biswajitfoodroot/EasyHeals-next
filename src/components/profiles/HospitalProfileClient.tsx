"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";

import { useTranslations } from "@/i18n/LocaleContext";
import AuthBookingModal, { type BookingDoctor } from "@/components/AuthBookingModal";
import { ContributeModal } from "@/components/contribute/ContributeModal";
import { InlineFieldEditor } from "@/components/profiles/InlineFieldEditor";
import EasyHealsNetworkBadge from "@/components/profiles/EasyHealsNetworkBadge";
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

const TABS = ["overview", "doctors", "packages", "services", "reviews", "location"] as const;
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

export function HospitalProfileClient({ data }: HospitalProfileClientProps) {
  const { t } = useTranslations();
  const [tab, setTab] = useState<TabKey>("overview");
  const [modalOpen, setModalOpen] = useState(false);
  const [contributeOpen, setContributeOpen] = useState(false);

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
  const [doctorDept, setDoctorDept] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const doctorDepts = useMemo(() => {
    const seen = new Set<string>();
    const depts: string[] = [];
    for (const d of data.doctors) {
      const dept = d.specialization?.trim();
      if (dept && !seen.has(dept)) { seen.add(dept); depts.push(dept); }
    }
    return depts.sort();
  }, [data.doctors]);

  const visibleDoctors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const byDept = doctorDept === "all" ? data.doctors : data.doctors.filter((d) => d.specialization === doctorDept);
    if (!q) return byDept;
    return byDept.filter((d) =>
      d.name.toLowerCase().includes(q) ||
      (d.specialization ?? "").toLowerCase().includes(q) ||
      d.specialties.some((s) => s.toLowerCase().includes(q))
    );
  }, [data.doctors, doctorDept, searchQuery]);

  const visiblePackages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return data.packages;
    return data.packages.filter((p) =>
      p.packageName.toLowerCase().includes(q) ||
      (p.procedureName ?? "").toLowerCase().includes(q) ||
      (p.department ?? "").toLowerCase().includes(q)
    );
  }, [data.packages, searchQuery]);

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
    overview: t("hospital.tabOverview"),
    doctors: t("hospital.tabDoctors"),
    packages: t("hospital.tabPackages"),
    services: t("hospital.tabServices"),
    reviews: t("hospital.tabReviews"),
    location: t("hospital.tabLocation"),
  };

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <nav className={styles.breadcrumb}>
          <Link href="/">{t("common.home")}</Link>
          <span>/</span>
          <Link href="/hospitals">{t("nav.hospitals")}</Link>
          <span>/</span>
          <span>{data.hospital.name}</span>
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroTop}>
            <div>
              <span className={styles.kicker}>{t("hospital.kicker")}</span>
              <h1 className={styles.title}>{data.hospital.name}</h1>
              <p className={styles.subtitle}>{titleMeta}</p>
              <div className={styles.heroBadges}>
                <span>✅ {t("common.verified")}</span>
                {data.hospital.specialties.slice(0, 3).map((s) => (
                  <span key={s}>{s}</span>
                ))}
                {data.doctors.length > 0 && (
                  <span>{data.doctors.length} {t("hospital.tabDoctors")}</span>
                )}
              </div>
              {data.networkTierCode && (
                <div className="mt-3">
                  <EasyHealsNetworkBadge tierCode={data.networkTierCode} compact />
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.primaryAction} onClick={() => setModalOpen(true)}>
                {t("common.bookAppointment")}
              </button>
              {data.hospital.phone ? (
                <a href={`tel:${data.hospital.phone}`}>
                  {t("common.callNow")}
                </a>
              ) : null}
              <a href={data.hospital.map.directionsUrl} target="_blank" rel="noreferrer">
                {t("common.getDirections")}
              </a>
              <button type="button" onClick={() => setContributeOpen(true)}>{t("common.suggestEdit")}</button>
            </div>
          </div>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="Hospital profile tabs">
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? styles.tabActive : ""}
              onClick={() => setTab(key)}
            >
              {tabLabels[key]}
            </button>
          ))}
        </div>

        {/* ── Search bar — shown on doctors/packages tabs ── */}
        {(tab === "doctors" || tab === "packages") && (
          <div className={styles.profileSearch}>
            <svg className={styles.profileSearchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              className={styles.profileSearchInput}
              placeholder={tab === "doctors" ? `Search doctors, specialties…` : `Search packages, procedures…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search within hospital"
            />
            {searchQuery && (
              <button type="button" className={styles.profileSearchClear} onClick={() => setSearchQuery("")} aria-label="Clear search">×</button>
            )}
          </div>
        )}

        {tab === "overview" ? (
          <section className={styles.contentGrid}>
            <article className={styles.panel}>
              <h2>{t("hospital.profileOverview")}</h2>
              <p>{data.hospital.description ?? t("hospital.descriptionPending")}</p>

              <InlineFieldEditor
                targetType="hospital"
                targetId={data.hospital.id}
                field="phone"
                label={t("common.phone")}
                value={data.hospital.phone ?? ""}

              />
              <InlineFieldEditor
                targetType="hospital"
                targetId={data.hospital.id}
                field="addressLine1"
                label={t("common.address")}
                value={data.hospital.addressLabel}
                multiline

              />
              <InlineFieldEditor
                targetType="hospital"
                targetId={data.hospital.id}
                field="website"
                label={t("common.website")}
                value={data.hospital.website ?? ""}

              />
              <InlineFieldEditor
                targetType="hospital"
                targetId={data.hospital.id}
                field="workingHours"
                label={t("common.workingHours")}
                value={objectSummary(data.hospital.workingHours, t("common.notUpdated"))}
                multiline

              />
            </article>

            <aside className={styles.panel}>
              <h3>{t("hospital.hospitalData")}</h3>
              <div className={styles.tagRow}>
                {data.hospital.specialties.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <p>{t("hospital.facilities")}: {data.hospital.facilities.length ? data.hospital.facilities.join(", ") : t("common.pending")}</p>
              <p>
                {t("hospital.accreditations")}: {data.hospital.accreditations.length ? data.hospital.accreditations.join(", ") : t("common.pending")}
              </p>
              <p>{t("common.feeRange")}: {objectSummary(data.hospital.feesRange, t("common.notUpdated"))}</p>
            </aside>
          </section>
        ) : null}

        {tab === "doctors" ? (
          <section className={styles.panel}>
            <h2>{t("hospital.affiliatedDoctors")}</h2>
            <p>{t("hospital.affiliatedDoctorsHint")}</p>

            {doctorDepts.length > 0 && (
              <div className={styles.tagRow} style={{ marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setDoctorDept("all")}
                  className={doctorDept === "all" ? styles.filterPillActive : styles.filterPill}
                >
                  {t("common.allDepartments")}
                  <span className={styles.filterPillCount}>{data.doctors.length}</span>
                </button>
                {doctorDepts.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setDoctorDept(dept)}
                    className={doctorDept === dept ? styles.filterPillActive : styles.filterPill}
                  >
                    {dept}
                    <span className={styles.filterPillCount}>
                      {data.doctors.filter((d) => d.specialization === dept).length}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className={styles.cardGrid}>
              {visibleDoctors.map((doctor) => (
                <article key={doctor.id} className={styles.profileCard}>
                  <h4>{doctor.name}</h4>
                  <p>
                    {doctor.specialization ?? t("common.specialist")} · {doctor.role}
                  </p>
                  <div className={styles.tagRow}>
                    {doctor.specialties.slice(0, 4).map((item) => (
                      <span key={`${doctor.id}-${item}`}>{item}</span>
                    ))}
                  </div>
                  <div className={styles.profileCardFooter}>
                    <small>
                      {doctor.yearsOfExperience ? (
                        `${doctor.yearsOfExperience}+ yrs`
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#64748b", fontStyle: "italic" }}>
                          ⏳ {t("common.updating")}
                        </span>
                      )}
                    </small>
                    <Link href={doctor.profileUrl}>{t("common.viewProfile")}</Link>
                  </div>
                </article>
              ))}
              {visibleDoctors.length === 0 && (
                <p>{t("common.noResults")}</p>
              )}
            </div>
          </section>
        ) : null}

        {tab === "packages" ? (
          <section className={styles.panel}>
            <h2>{t("hospital.tabPackages")}</h2>
            {visiblePackages.length === 0 ? (
              <p className="text-slate-500">{searchQuery ? `No packages match "${searchQuery}"` : t("hospital.noPackages")}</p>
            ) : (
              <div className={styles.cardGrid}>
                {visiblePackages.map((pkg) => (
                  <article key={pkg.id} className={styles.profileCard}>
                    <h4>{pkg.packageName}</h4>
                    {pkg.procedureName && <p className="text-slate-500 text-sm">{pkg.procedureName}</p>}
                    {pkg.department && <p className="text-xs text-teal-700 font-medium">{pkg.department}</p>}
                    <p className="text-slate-700 font-semibold text-sm mt-1">
                      {pkg.priceMin || pkg.priceMax
                        ? `₹${pkg.priceMin?.toLocaleString("en-IN") ?? "–"} – ₹${pkg.priceMax?.toLocaleString("en-IN") ?? "–"} ${pkg.currency !== "INR" ? pkg.currency : ""}`
                        : t("common.priceOnRequest")}
                    </p>
                    {pkg.lengthOfStay && <p className="text-xs text-slate-500">{t("common.stay")}: {pkg.lengthOfStay}</p>}
                    {pkg.inclusions.length > 0 && (
                      <ul className="mt-2 text-xs text-slate-600 space-y-0.5 list-disc list-inside">
                        {pkg.inclusions.slice(0, 4).map((inc) => (
                          <li key={inc}>{inc}</li>
                        ))}
                      </ul>
                    )}
                    <div className={styles.profileCardFooter}>
                      <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="text-teal-700 font-semibold text-sm hover:underline"
                      >
                        {t("common.bookPackage")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {tab === "services" ? (
          <section className={styles.split}>
            <article className={styles.panel}>
              <h2>{t("hospital.departmentsServices")}</h2>
              <div className={styles.tagRow}>
                {data.hospital.specialties.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <h2>{t("hospital.nearby")}</h2>
              <div className={styles.cardGrid}>
                {data.nearbyHospitals.map((item) => (
                  <article key={item.id} className={styles.profileCard}>
                    <h4>{item.name}</h4>
                    <p>
                      {item.city}
                      {item.state ? `, ${item.state}` : ""}
                    </p>
                    <div className={styles.tagRow}>
                      {item.specialties.slice(0, 3).map((tag) => (
                        <span key={`${item.id}-${tag}`}>{tag}</span>
                      ))}
                    </div>
                    <div className={styles.profileCardFooter}>
                      <Link href={item.profileUrl}>{t("common.open")}</Link>
                      <a href={item.mapUrl} target="_blank" rel="noreferrer">
                        {t("common.directions")}
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {tab === "reviews" ? (
          <section className={styles.panel}>
            <h2>{t("hospital.ratingsTitle")}</h2>
            <p style={{ marginBottom: "0.5rem" }}>
              {t("common.currentScore")}: <strong>{ratingText(data.hospital.rating, data.hospital.reviewCount)}</strong>
            </p>

            {/* Approved reviews list */}
            {data.reviews.length > 0 ? (
              <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                {data.reviews.map((review) => (
                  <div key={review.id} style={{ border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem", background: "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>{review.patientName}</span>
                        {review.visitDate && (
                          <span style={{ marginLeft: "0.75rem", fontSize: "0.75rem", color: "#94a3b8" }}>
                            Visited {new Date(review.visitDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                          </span>
                        )}
                      </div>
                      <div style={{ color: "#f59e0b", fontWeight: 700, fontSize: "1rem" }}>
                        {"★".repeat(Math.round(review.rating))}{"☆".repeat(5 - Math.round(review.rating))}
                        <span style={{ color: "#64748b", fontWeight: 500, marginLeft: "0.25rem", fontSize: "0.85rem" }}>{review.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    {review.title && <p style={{ fontWeight: 600, marginTop: "0.5rem", color: "#334155" }}>{review.title}</p>}
                    {review.body && <p style={{ marginTop: "0.25rem", color: "#475569", fontSize: "0.9rem", lineHeight: 1.6 }}>{review.body}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#64748b", marginTop: "1rem", fontStyle: "italic" }}>
                No reviews yet. Be the first to share your experience!
              </p>
            )}

            {/* Review submission form */}
            <div style={{ marginTop: "2rem", padding: "1.25rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.75rem" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "1rem", color: "#1e293b" }}>Write a Review</h3>
              {reviewSubmitted ? (
                <p style={{ color: "#16a34a", fontWeight: 600 }}>
                  ✓ Thank you! Your review has been submitted and will appear after moderation.
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
                  style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
                >
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <input
                      required
                      value={reviewName}
                      onChange={(e) => setReviewName(e.target.value)}
                      placeholder="Your name *"
                      style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", fontSize: "0.9rem" }}
                    />
                    <select
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      style={{ padding: "0.5rem 0.75rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", background: "#fff" }}
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
                    style={{ padding: "0.5rem 0.75rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", fontSize: "0.9rem" }}
                  />
                  <textarea
                    required
                    value={reviewBody}
                    onChange={(e) => setReviewBody(e.target.value)}
                    placeholder="Share your experience (min 10 characters) *"
                    rows={4}
                    style={{ padding: "0.5rem 0.75rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", fontSize: "0.9rem", resize: "vertical" }}
                  />
                  {reviewError && <p style={{ color: "#dc2626", fontSize: "0.85rem" }}>{reviewError}</p>}
                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    style={{ alignSelf: "flex-start", padding: "0.5rem 1.25rem", background: "#0d9488", color: "#fff", border: "none", borderRadius: "0.5rem", fontWeight: 600, cursor: "pointer", opacity: reviewSubmitting ? 0.7 : 1 }}
                  >
                    {reviewSubmitting ? "Submitting…" : "Submit Review"}
                  </button>
                </form>
              )}
            </div>
          </section>
        ) : null}

        {tab === "location" ? (
          <section className={styles.split}>
            <article className={styles.panel}>
              <h2>{t("hospital.locationTitle")}</h2>
              <p>{data.hospital.addressLabel || t("hospital.addressNotAvailable")}</p>
              <div className={styles.actions}>
                <a className={styles.primaryAction} href={data.hospital.map.directionsUrl} target="_blank" rel="noreferrer">
                  {t("common.getDirections")}
                </a>
                <a href={data.hospital.map.directionsUrl} target="_blank" rel="noreferrer">
                  {t("hospital.largerMap")}
                </a>
              </div>
            </article>
            <div className={styles.mapWrap}>
              <iframe
                src={data.hospital.map.embedUrl}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                title={`${data.hospital.name} map`}
              />
            </div>
          </section>
        ) : null}

        {/* ── Related: Affiliated Doctors ── */}
        {data.doctors.length > 0 && (
          <div className={styles.relatedSection}>
            <h3 className={styles.relatedTitle}>👨‍⚕️ Doctors at this Hospital</h3>
            <div className={styles.relatedScroll}>
              {data.doctors.slice(0, 10).map((doc) => (
                <Link key={doc.id} href={doc.profileUrl} className={styles.relatedCard}>
                  <span className={styles.relatedCardName}>{doc.name}</span>
                  <span className={styles.relatedCardSub}>{doc.specialization ?? "Specialist"}</span>
                  <span className={styles.relatedCardBadge}>★ {doc.reviewCount === 0 ? "4.0" : doc.rating.toFixed(1)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Related: Similar Hospitals ── */}
        {data.nearbyHospitals.length > 0 && (
          <div className={styles.relatedSection}>
            <h3 className={styles.relatedTitle}>🏥 Similar Hospitals You May Consider</h3>
            <div className={styles.relatedScroll}>
              {data.nearbyHospitals.slice(0, 8).map((item) => (
                <Link key={item.id} href={item.profileUrl} className={styles.relatedCard}>
                  <span className={styles.relatedCardName}>{item.name}</span>
                  <span className={styles.relatedCardSub}>{item.city}{item.state ? `, ${item.state}` : ""}</span>
                  <span className={styles.relatedCardBadge}>★ {item.rating > 0 ? item.rating.toFixed(1) : "4.0"}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
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
