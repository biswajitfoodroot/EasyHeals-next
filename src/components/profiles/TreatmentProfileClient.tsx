"use client";

import Link from "next/link";
import { useState } from "react";

import { useTranslations } from "@/i18n/LocaleContext";
import AppointmentModal from "@/components/AppointmentModal";
import styles from "@/components/profiles/profiles.module.css";

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

type TreatmentData = {
  id: string;
  slug: string;
  title: string;
  type: string;
  description: string | null;
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

export function TreatmentProfileClient({ data }: Props) {
  const { t } = useTranslations();
  const [tab, setTab] = useState<TabKey>("overview");
  const [modalOpen, setModalOpen] = useState(false);

  const { treatment, relatedHospitals, relatedDoctors } = data;

  const tabLabels: Record<TabKey, string> = {
    overview: t("treatment.tabOverview"),
    hospitals: t("treatment.tabHospitals"),
    doctors: t("treatment.tabDoctors"),
  };

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <nav className={styles.breadcrumb}>
          <Link href="/">{t("common.home")}</Link>
          <span>/</span>
          <Link href="/treatments">{t("nav.treatments")}</Link>
          <span>/</span>
          <span>{treatment.title}</span>
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroTop}>
            <div>
              <span className={styles.kicker}>{treatment.type.replace(/_/g, " ")}</span>
              <h1 className={styles.title}>{treatment.title}</h1>
              {treatment.description && (
                <p className={styles.subtitle}>{treatment.description}</p>
              )}
              <div className={styles.heroBadges}>
                {relatedHospitals.length > 0 && <span>{relatedHospitals.length} {t("nav.hospitals")}</span>}
                {relatedDoctors.length > 0 && <span>{relatedDoctors.length} {t("treatment.specialists")}</span>}
              </div>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => setModalOpen(true)}
              >
                {t("common.bookAppointment")}
              </button>
            </div>
          </div>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="Treatment profile tabs">
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

        {tab === "overview" && (
          <section className={styles.contentGrid}>
            <article className={styles.panel}>
              <h2>{t("treatment.aboutTitle")} {treatment.title}</h2>
              <p>
                {treatment.description ?? t("treatment.noHospitals")}
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  {t("treatment.bookFreeConsultation")}
                </button>
              </div>
            </article>

            <aside className={styles.panel}>
              <h3>{t("treatment.quickStats")}</h3>
              <p className="text-slate-600 text-sm mb-3">
                <strong>{relatedHospitals.length}</strong> {t("treatment.hospitalsFound")}.
              </p>
              <p className="text-slate-600 text-sm mb-4">
                <strong>{relatedDoctors.length}</strong> {t("treatment.specialistDoctorsAvailable")}.
              </p>
              {relatedHospitals.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTab("hospitals")}
                  className="text-teal-700 font-semibold text-sm hover:underline"
                >
                  {t("treatment.viewHospitals")} →
                </button>
              )}
            </aside>
          </section>
        )}

        {tab === "hospitals" && (
          <section className={styles.panel}>
            <h2>{t("treatment.hospitalsFor")} {treatment.title}</h2>
            {relatedHospitals.length === 0 ? (
              <p className="text-slate-500">{t("treatment.noHospitals")}</p>
            ) : (
              <div className={styles.cardGrid}>
                {relatedHospitals.map((h) => (
                  <article key={h.id} className={styles.profileCard}>
                    <div className="flex items-start justify-between gap-2">
                      <h4>{h.name}</h4>
                      {h.verified && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">{t("common.verified")}</span>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm">
                      {h.city}{h.state ? `, ${h.state}` : ""}
                      {h.rating > 0 && <> · ⭐ {h.rating.toFixed(1)}</>}
                    </p>
                    <div className={styles.tagRow}>
                      {h.specialties.slice(0, 3).map((s) => (
                        <span key={`${h.id}-${s}`}>{s}</span>
                      ))}
                    </div>
                    <div className={styles.profileCardFooter}>
                      <Link href={h.profileUrl}>{t("common.viewProfile")}</Link>
                      <a href={h.directionsUrl} target="_blank" rel="noreferrer">{t("common.directions")}</a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "doctors" && (
          <section className={styles.panel}>
            <h2>{t("treatment.specialistsFor")} {treatment.title}</h2>
            {relatedDoctors.length === 0 ? (
              <p className="text-slate-500">{t("treatment.noDoctors")}</p>
            ) : (
              <div className={styles.cardGrid}>
                {relatedDoctors.map((d) => (
                  <article key={d.id} className={styles.profileCard}>
                    <div className="flex items-start justify-between gap-2">
                      <h4>{d.fullName}</h4>
                      {d.verified && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">{t("common.verified")}</span>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm">
                      {d.specialization ?? treatment.title}
                      {d.city && <> · {d.city}{d.state ? `, ${d.state}` : ""}</>}
                    </p>
                    <p className="text-slate-500 text-sm">
                      {d.yearsOfExperience ? `${d.yearsOfExperience}+ yrs exp` : ""}
                      {d.consultationFee ? `${d.yearsOfExperience ? " · " : ""}₹${d.consultationFee} fee` : ""}
                    </p>
                    <div className={styles.profileCardFooter}>
                      <Link href={d.profileUrl}>{t("common.viewProfile")}</Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </section>

      <div className={styles.mobileBar}>
        <button
          type="button"
          className={styles.mobilePrimary}
          onClick={() => setModalOpen(true)}
        >
          {t("common.bookAppointment")}
        </button>
      </div>

      <AppointmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        source="treatment_page"
      />
    </main>
  );
}
