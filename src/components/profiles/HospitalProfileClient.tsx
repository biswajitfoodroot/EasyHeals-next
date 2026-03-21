"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { useTranslations } from "@/i18n/LocaleContext";
import AuthBookingModal, { type BookingDoctor } from "@/components/AuthBookingModal";
import { ContributeModal } from "@/components/contribute/ContributeModal";
import { InlineFieldEditor } from "@/components/profiles/InlineFieldEditor";
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

type HospitalProfileClientProps = {
  data: {
    hospital: HospitalPayload;
    packages: HospitalPackage[];
    doctors: AffiliatedDoctor[];
    nearbyHospitals: NearbyHospital[];
  };
};

const TABS = ["overview", "doctors", "packages", "services", "reviews", "location"] as const;
type TabKey = (typeof TABS)[number];

function ratingText(rating: number, count: number) {
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
  const [doctorDept, setDoctorDept] = useState<string>("all");

  const doctorDepts = useMemo(() => {
    const seen = new Set<string>();
    const depts: string[] = [];
    for (const d of data.doctors) {
      const dept = d.specialization?.trim();
      if (dept && !seen.has(dept)) { seen.add(dept); depts.push(dept); }
    }
    return depts.sort();
  }, [data.doctors]);

  const visibleDoctors = useMemo(
    () => doctorDept === "all" ? data.doctors : data.doctors.filter((d) => d.specialization === doctorDept),
    [data.doctors, doctorDept],
  );

  const titleMeta = useMemo(
    () =>
      [
        data.hospital.city,
        data.hospital.state,
        `Rating ${ratingText(data.hospital.rating, data.hospital.reviewCount)}`,
      ]
        .filter(Boolean)
        .join(" Â· "),
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
                <span>Private Listing</span>
                <span>Bidirectional Doctor Links</span>
                <span>ISR 1h</span>
                <span>Map Navigation Ready</span>
              </div>
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
                    <small>{doctor.yearsOfExperience ? `${doctor.yearsOfExperience}+ yrs` : t("common.updating")}</small>
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
            {data.packages.length === 0 ? (
              <p className="text-slate-500">{t("hospital.noPackages")}</p>
            ) : (
              <div className={styles.cardGrid}>
                {data.packages.map((pkg) => (
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
            <p>
              {t("common.currentScore")}: <strong>{ratingText(data.hospital.rating, data.hospital.reviewCount)}</strong>
            </p>
            <p>{t("hospital.ratingsReviewNote")}</p>
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
