"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { useTranslations } from "@/i18n/LocaleContext";
import AppointmentModal from "@/components/AppointmentModal";
import { ContributeModal } from "@/components/contribute/ContributeModal";
import { InlineFieldEditor } from "@/components/profiles/InlineFieldEditor";
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

type DoctorProfileClientProps = {
  data: {
    doctor: DoctorPayload;
    affiliations: HospitalAffiliation[];
    nearbyDoctors: NearbyDoctor[];
  };
};

const TABS = ["overview", "affiliations", "services", "reviews", "location"] as const;
type TabKey = (typeof TABS)[number];

function valueOrFallback(value: string | null | undefined, fallback = "Not available") {
  return value && value.trim() ? value : fallback;
}

export function DoctorProfileClient({ data }: DoctorProfileClientProps) {
  const { t } = useTranslations();
  const [tab, setTab] = useState<TabKey>("overview");
  const [modalOpen, setModalOpen] = useState(false);
  const [contributeOpen, setContributeOpen] = useState(false);

  const heroMeta = useMemo(
    () =>
      [
        data.doctor.specialization,
        data.doctor.city,
        data.doctor.state,
        `${data.doctor.rating.toFixed(1)}?`,
      ]
        .filter(Boolean)
        .join(" · "),
    [data.doctor.city, data.doctor.rating, data.doctor.specialization, data.doctor.state],
  );

  const primaryHospital = data.affiliations.find((item) => item.isPrimary) ?? data.affiliations[0] ?? null;

  const contributeTarget: SearchResult = {
    id: data.doctor.id,
    type: "doctor",
    name: data.doctor.fullName,
    slug: data.doctor.slug,
    city: data.doctor.city ?? "",
    state: data.doctor.state,
    rating: data.doctor.rating,
    verified: data.doctor.verified,
    communityVerified: true,
    specialties: data.doctor.specialties,
    source: "db",
    score: data.doctor.rating,
    description: data.doctor.bio ?? null,
    profileUrl: `/doctors/${data.doctor.slug}`,
    phone: data.doctor.phone,
  };

  const tabLabels: Record<TabKey, string> = {
    overview: t("doctor.tabOverview"),
    affiliations: t("doctor.tabAffiliations"),
    services: t("doctor.tabServices"),
    reviews: t("doctor.tabReviews"),
    location: t("doctor.tabLocation"),
  };

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <nav className={styles.breadcrumb}>
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/doctors">Doctors</Link>
          <span>/</span>
          <span>{data.doctor.fullName}</span>
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroTop}>
            <div>
              <span className={styles.kicker}>{t("doctor.kicker")}</span>
              <h1 className={styles.title}>{data.doctor.fullName}</h1>
              <p className={styles.subtitle}>{heroMeta}</p>
              <div className={styles.heroBadges}>
                <span>{data.doctor.verified ? "Verified" : "Community Verified"}</span>
                <span>Bidirectional Hospital Mapping</span>
                <span>Consultation Ready</span>
              </div>
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.primaryAction} onClick={() => setModalOpen(true)}>
                {t("common.bookAppointment")}
              </button>
              {data.doctor.phone ? (
                <a href={`tel:${data.doctor.phone}`}>{t("common.callNow")}</a>
              ) : null}
              {primaryHospital ? (
                <a href={primaryHospital.hospital.directionsUrl} target="_blank" rel="noreferrer">
                  {t("common.getDirections")}
                </a>
              ) : null}
              <button type="button" onClick={() => setContributeOpen(true)}>{t("common.suggestEdit")}</button>
            </div>
          </div>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="Doctor profile tabs">
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
              <h2>Doctor Overview</h2>
              <p>{data.doctor.bio ?? "Profile summary will appear after verification."}</p>

              <InlineFieldEditor
                targetType="doctor"
                targetId={data.doctor.id}
                field="phone"
                label="Phone"
                value={valueOrFallback(data.doctor.phone, "")}

              />
              <InlineFieldEditor
                targetType="doctor"
                targetId={data.doctor.id}
                field="specialization"
                label="Specialization"
                value={valueOrFallback(data.doctor.specialization, "")}

              />
              <InlineFieldEditor
                targetType="doctor"
                targetId={data.doctor.id}
                field="qualifications"
                label="Qualifications"
                value={data.doctor.qualifications.join(", ")}
                multiline

              />
              <InlineFieldEditor
                targetType="doctor"
                targetId={data.doctor.id}
                field="consultationFee"
                label="Consultation Fee"
                value={data.doctor.consultationFee ? String(data.doctor.consultationFee) : ""}

              />
            </article>

            <aside className={styles.panel}>
              <h3>Highlights</h3>
              <p>Experience: {data.doctor.yearsOfExperience ? `${data.doctor.yearsOfExperience}+ years` : "Updating"}</p>
              <p>Languages: {data.doctor.languages.length ? data.doctor.languages.join(", ") : "Updating"}</p>
              <p>
                Fee Range: {data.doctor.feeMin || data.doctor.feeMax ? `${data.doctor.feeMin ?? "-"} - ${data.doctor.feeMax ?? "-"}` : "Updating"}
              </p>
              <div className={styles.tagRow}>
                {data.doctor.specialties.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </aside>
          </section>
        ) : null}

        {tab === "affiliations" ? (
          <section className={styles.panel}>
            <h2>Affiliated Hospitals</h2>
            <p>Click a hospital to navigate to its profile page and available doctors.</p>
            <div className={styles.cardGrid}>
              {data.affiliations.map((item) => (
                <article key={item.affiliationId} className={styles.profileCard}>
                  <h4>{item.hospital.name}</h4>
                  <p>
                    {item.role} · {item.hospital.city}
                    {item.hospital.state ? `, ${item.hospital.state}` : ""}
                  </p>
                  <div className={styles.tagRow}>
                    {item.hospital.specialties.slice(0, 4).map((tag) => (
                      <span key={`${item.affiliationId}-${tag}`}>{tag}</span>
                    ))}
                  </div>
                  <div className={styles.profileCardFooter}>
                    <Link href={item.hospital.profileUrl}>{t("common.open")}</Link>
                    <a href={item.hospital.directionsUrl} target="_blank" rel="noreferrer">
                      {t("common.directions")}
                    </a>
                  </div>
                </article>
              ))}
              {data.affiliations.length === 0 ? <p>{t("doctor.noAffiliations")}</p> : null}
            </div>
          </section>
        ) : null}

        {tab === "services" ? (
          <section className={styles.split}>
            <article className={styles.panel}>
              <h2>Specialties</h2>
              <div className={styles.tagRow}>
                {data.doctor.specialties.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <h2>Nearby Doctors</h2>
              <div className={styles.cardGrid}>
                {data.nearbyDoctors.map((item) => (
                  <article key={item.id} className={styles.profileCard}>
                    <h4>{item.fullName}</h4>
                    <p>{valueOrFallback(item.specialization)}</p>
                    <p>
                      {valueOrFallback(item.city)}
                      {item.state ? `, ${item.state}` : ""}
                    </p>
                    <div className={styles.profileCardFooter}>
                      <Link href={item.profileUrl}>{t("common.viewProfile")}</Link>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {tab === "reviews" ? (
          <section className={styles.panel}>
            <h2>{t("doctor.ratingsTitle")}</h2>
            <p>
              Current score: <strong>{data.doctor.rating.toFixed(1)} / 5</strong> from {data.doctor.reviewCount.toLocaleString("en-IN")} reviews.
            </p>
            {data.doctor.aiReviewSummary ? (
              <div style={{ marginTop: "12px", padding: "14px 16px", borderRadius: "12px", border: "1px solid rgba(77,255,216,0.2)", background: "rgba(0,184,150,0.06)" }}>
                <p style={{ margin: "0 0 6px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#4dffd8" }}>{t("doctor.aiReviewSummary")}</p>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{data.doctor.aiReviewSummary}</p>
              </div>
            ) : (
              <p>Verified patient review workflow is scheduled in the next phase.</p>
            )}
          </section>
        ) : null}

        {tab === "location" ? (
          <section className={styles.panel}>
            <h2>Practice Locations</h2>
            <div className={styles.cardGrid}>
              {data.affiliations.map((item) => (
                <article key={`${item.affiliationId}-location`} className={styles.profileCard}>
                  <h4>{item.hospital.name}</h4>
                  <p>
                    {item.hospital.city}
                    {item.hospital.state ? `, ${item.hospital.state}` : ""}
                  </p>
                  <div className={styles.profileCardFooter}>
                    <a href={item.hospital.directionsUrl} target="_blank" rel="noreferrer">
                      {t("common.getDirections")}
                    </a>
                    <Link href={item.hospital.profileUrl}>{t("hospital.kicker")}</Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>

      <div className={styles.mobileBar}>
        <button type="button" className={styles.mobilePrimary} onClick={() => setModalOpen(true)}>
          {t("common.bookAppointment")}
        </button>
        {data.doctor.phone ? (
          <a href={`tel:${data.doctor.phone}`}>{t("common.callNow")}</a>
        ) : null}
      </div>

      <AppointmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        doctorName={data.doctor.fullName}
        hospitalId={primaryHospital?.hospital.id}
        hospitalName={primaryHospital?.hospital.name}
        source="doctor_profile"
      />

      <ContributeModal
        isOpen={contributeOpen}
        target={contributeTarget}
        onClose={() => setContributeOpen(false)}
      />
    </main>
  );
}
