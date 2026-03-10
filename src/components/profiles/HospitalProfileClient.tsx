"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { EditHistoryDrawer } from "@/components/profiles/EditHistoryDrawer";
import { InlineFieldEditor } from "@/components/profiles/InlineFieldEditor";
import styles from "@/components/profiles/profiles.module.css";

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
    doctors: AffiliatedDoctor[];
    nearbyHospitals: NearbyHospital[];
  };
};

const tabs = [
  { key: "overview", label: "Overview" },
  { key: "doctors", label: "Doctors" },
  { key: "services", label: "Services" },
  { key: "reviews", label: "Reviews" },
  { key: "location", label: "Location" },
] as const;

function ratingText(rating: number, count: number) {
  return `${rating.toFixed(1)} (${count.toLocaleString("en-IN")})`;
}

function objectSummary(value: Record<string, unknown> | null): string {
  if (!value) return "Not updated";
  return Object.entries(value)
    .map(([key, item]) => `${key}: ${String(item)}`)
    .join(" | ");
}

export function HospitalProfileClient({ data }: HospitalProfileClientProps) {
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("overview");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyField, setHistoryField] = useState<string | null>(null);

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
          <Link href="/hospitals">Hospitals</Link>
          <span>/</span>
          <span>{data.hospital.name}</span>
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroTop}>
            <div>
              <span className={styles.kicker}>Hospital Profile</span>
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
              {data.hospital.phone ? (
                <a className={styles.primaryAction} href={`tel:${data.hospital.phone}`}>
                  Call Now
                </a>
              ) : null}
              <a href={data.hospital.map.directionsUrl} target="_blank" rel="noreferrer">
                Get Directions
              </a>
              <button type="button" onClick={() => openHistory("")}>View Edit History</button>
            </div>
          </div>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="Hospital profile tabs">
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
              <h2>Profile Overview</h2>
              <p>{data.hospital.description ?? "Description will appear after profile verification."}</p>

              <InlineFieldEditor
                targetType="hospital"
                targetId={data.hospital.id}
                field="phone"
                label="Primary Phone"
                value={data.hospital.phone ?? ""}
                onOpenHistory={openHistory}
              />
              <InlineFieldEditor
                targetType="hospital"
                targetId={data.hospital.id}
                field="addressLine1"
                label="Address"
                value={data.hospital.addressLabel}
                multiline
                onOpenHistory={openHistory}
              />
              <InlineFieldEditor
                targetType="hospital"
                targetId={data.hospital.id}
                field="website"
                label="Website"
                value={data.hospital.website ?? ""}
                onOpenHistory={openHistory}
              />
              <InlineFieldEditor
                targetType="hospital"
                targetId={data.hospital.id}
                field="workingHours"
                label="Working Hours"
                value={objectSummary(data.hospital.workingHours)}
                multiline
                onOpenHistory={openHistory}
              />
            </article>

            <aside className={styles.panel}>
              <h3>Hospital Data</h3>
              <div className={styles.tagRow}>
                {data.hospital.specialties.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <p>Facilities: {data.hospital.facilities.length ? data.hospital.facilities.join(", ") : "Pending"}</p>
              <p>
                Accreditations: {data.hospital.accreditations.length ? data.hospital.accreditations.join(", ") : "Pending"}
              </p>
              <p>Fee Range: {objectSummary(data.hospital.feesRange)}</p>
            </aside>
          </section>
        ) : null}

        {tab === "doctors" ? (
          <section className={styles.panel}>
            <h2>Affiliated Doctors</h2>
            <p>Click any doctor to open the detailed profile with all affiliated hospitals.</p>
            <div className={styles.cardGrid}>
              {data.doctors.map((doctor) => (
                <article key={doctor.id} className={styles.profileCard}>
                  <h4>{doctor.name}</h4>
                  <p>
                    {doctor.specialization ?? "Specialist"} Â· {doctor.role}
                  </p>
                  <div className={styles.tagRow}>
                    {doctor.specialties.slice(0, 4).map((item) => (
                      <span key={`${doctor.id}-${item}`}>{item}</span>
                    ))}
                  </div>
                  <div className={styles.profileCardFooter}>
                    <small>{doctor.yearsOfExperience ? `${doctor.yearsOfExperience}+ yrs` : "Experience updating"}</small>
                    <Link href={doctor.profileUrl}>View Profile</Link>
                  </div>
                </article>
              ))}
              {data.doctors.length === 0 ? <p>No affiliated doctors added yet.</p> : null}
            </div>
          </section>
        ) : null}

        {tab === "services" ? (
          <section className={styles.split}>
            <article className={styles.panel}>
              <h2>Departments & Services</h2>
              <div className={styles.tagRow}>
                {data.hospital.specialties.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <h2>Also Nearby (&lt;= 5km target area)</h2>
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
                      <Link href={item.profileUrl}>Open</Link>
                      <a href={item.mapUrl} target="_blank" rel="noreferrer">
                        Directions
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
            <h2>Ratings & Community Trust</h2>
            <p>
              Current score: <strong>{ratingText(data.hospital.rating, data.hospital.reviewCount)}</strong>
            </p>
            <p>
              Review system in this phase shows aggregate score and trust signals. Verified patient review workflow is in the next planned sprint.
            </p>
          </section>
        ) : null}

        {tab === "location" ? (
          <section className={styles.split}>
            <article className={styles.panel}>
              <h2>Location & Navigation</h2>
              <p>{data.hospital.addressLabel || "Address not available."}</p>
              <div className={styles.actions}>
                <a className={styles.primaryAction} href={data.hospital.map.directionsUrl} target="_blank" rel="noreferrer">
                  Get Directions
                </a>
                <a href={data.hospital.map.directionsUrl} target="_blank" rel="noreferrer">
                  Larger Map
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
        {data.hospital.phone ? (
          <a className={styles.mobilePrimary} href={`tel:${data.hospital.phone}`}>
            Call Now
          </a>
        ) : null}
        <a href={data.hospital.map.directionsUrl} target="_blank" rel="noreferrer">
          Get Directions
        </a>
      </div>

      <EditHistoryDrawer
        open={historyOpen}
        targetType="hospital"
        targetId={data.hospital.id}
        field={historyField}
        onClose={() => setHistoryOpen(false)}
      />
    </main>
  );
}
