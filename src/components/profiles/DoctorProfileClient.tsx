"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { EditHistoryDrawer } from "@/components/profiles/EditHistoryDrawer";
import { InlineFieldEditor } from "@/components/profiles/InlineFieldEditor";
import styles from "@/components/profiles/profiles.module.css";

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

const tabs = [
  { key: "overview", label: "Overview" },
  { key: "affiliations", label: "Affiliations" },
  { key: "services", label: "Services" },
  { key: "reviews", label: "Reviews" },
  { key: "location", label: "Location" },
] as const;

function valueOrFallback(value: string | null | undefined, fallback = "Not available") {
  return value && value.trim() ? value : fallback;
}

export function DoctorProfileClient({ data }: DoctorProfileClientProps) {
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("overview");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyField, setHistoryField] = useState<string | null>(null);

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

  function openHistory(field: string) {
    setHistoryField(field);
    setHistoryOpen(true);
  }

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
              <span className={styles.kicker}>Doctor Profile</span>
              <h1 className={styles.title}>{data.doctor.fullName}</h1>
              <p className={styles.subtitle}>{heroMeta}</p>
              <div className={styles.heroBadges}>
                <span>{data.doctor.verified ? "Verified" : "Community Verified"}</span>
                <span>Bidirectional Hospital Mapping</span>
                <span>Consultation Ready</span>
              </div>
            </div>

            <div className={styles.actions}>
              {data.doctor.phone ? (
                <a className={styles.primaryAction} href={`tel:${data.doctor.phone}`}>
                  Call Doctor
                </a>
              ) : null}
              {primaryHospital ? (
                <a href={primaryHospital.hospital.directionsUrl} target="_blank" rel="noreferrer">
                  Get Directions
                </a>
              ) : null}
              <button type="button" onClick={() => openHistory("")}>View Edit History</button>
            </div>
          </div>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="Doctor profile tabs">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={tab === item.key ? styles.tabActive : ""}
              onClick={() => setTab(item.key)}
            >
              {item.label}
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
                onOpenHistory={openHistory}
              />
              <InlineFieldEditor
                targetType="doctor"
                targetId={data.doctor.id}
                field="specialization"
                label="Specialization"
                value={valueOrFallback(data.doctor.specialization, "")}
                onOpenHistory={openHistory}
              />
              <InlineFieldEditor
                targetType="doctor"
                targetId={data.doctor.id}
                field="qualifications"
                label="Qualifications"
                value={data.doctor.qualifications.join(", ")}
                multiline
                onOpenHistory={openHistory}
              />
              <InlineFieldEditor
                targetType="doctor"
                targetId={data.doctor.id}
                field="consultationFee"
                label="Consultation Fee"
                value={data.doctor.consultationFee ? String(data.doctor.consultationFee) : ""}
                onOpenHistory={openHistory}
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
                    <Link href={item.hospital.profileUrl}>Open Hospital</Link>
                    <a href={item.hospital.directionsUrl} target="_blank" rel="noreferrer">
                      Directions
                    </a>
                  </div>
                </article>
              ))}
              {data.affiliations.length === 0 ? <p>No hospital affiliations yet.</p> : null}
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
                      <Link href={item.profileUrl}>View Profile</Link>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {tab === "reviews" ? (
          <section className={styles.panel}>
            <h2>Ratings</h2>
            <p>
              Current score: <strong>{data.doctor.rating.toFixed(1)} / 5</strong> from {data.doctor.reviewCount.toLocaleString("en-IN")} reviews.
            </p>
            <p>
              This phase includes aggregate score visibility and trust cues. Verified patient review workflow is scheduled in the next phase.
            </p>
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
                      Get Directions
                    </a>
                    <Link href={item.hospital.profileUrl}>Hospital Profile</Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>

      <div className={styles.mobileBar}>
        {data.doctor.phone ? (
          <a className={styles.mobilePrimary} href={`tel:${data.doctor.phone}`}>
            Call Doctor
          </a>
        ) : null}
        {primaryHospital ? (
          <a href={primaryHospital.hospital.directionsUrl} target="_blank" rel="noreferrer">
            Get Directions
          </a>
        ) : null}
      </div>

      <EditHistoryDrawer
        open={historyOpen}
        targetType="doctor"
        targetId={data.doctor.id}
        field={historyField}
        onClose={() => setHistoryOpen(false)}
      />
    </main>
  );
}
