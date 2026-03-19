"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { useTranslations } from "@/i18n/LocaleContext";
import styles from "@/components/profiles/profiles.module.css";

type DirectoryItem = {
  id: string;
  name: string;
  city: string;
  state: string | null;
  specialties: string[];
  rating: number;
  verified: boolean;
  url: string;
  subtitle?: string | null;
};

type DirectorySearchListProps = {
  kind: "hospital" | "doctor";
  items: DirectoryItem[];
  cityOptions: string[];
};

export function DirectorySearchList({ kind, items, cityOptions }: DirectorySearchListProps) {
  const { t } = useTranslations();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("all");

  const title = kind === "hospital" ? t("hospital.directoryTitle") : t("doctor.directoryTitle");
  const description = kind === "hospital" ? t("hospital.directoryDescription") : t("doctor.directoryDescription");

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (city !== "all" && item.city.toLowerCase() !== city.toLowerCase()) return false;
      if (!query.trim()) return true;

      const text = `${item.name} ${item.city} ${item.state ?? ""} ${item.specialties.join(" ")}`.toLowerCase();
      return text.includes(query.trim().toLowerCase());
    });
  }, [city, items, query]);

  return (
    <main className={styles.directoryPage}>
      <section className={styles.directoryHero}>
        <span className={styles.kicker}>{kind === "hospital" ? t("hospital.kicker") : t("doctor.kicker")}</span>
        <h1>{title}</h1>
        <p>{description}</p>

        <div className={styles.searchBar}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={kind === "hospital" ? t("hospital.searchPlaceholder") : t("doctor.searchPlaceholder")}
            aria-label="Search listings"
          />
          <select value={city} onChange={(event) => setCity(event.target.value)} aria-label="Filter city">
            <option value="all">{t("common.allCities")}</option>
            {cityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className={styles.directoryGrid}>
        {filtered.map((item) => (
          <article key={item.id} className={styles.directoryCard}>
            <h2>{item.name}</h2>
            <p>
              {item.city}
              {item.state ? `, ${item.state}` : ""}
            </p>
            {item.subtitle ? <p>{item.subtitle}</p> : null}
            <div className={styles.tagRow}>
              {item.specialties.slice(0, 4).map((specialty) => (
                <span key={`${item.id}-${specialty}`}>{specialty}</span>
              ))}
            </div>
            <p>{item.verified ? t("common.verified") : t("common.communityVerified")} · {t("common.rating")} {item.rating.toFixed(1)}</p>
            <Link href={item.url}>{t("common.viewProfile")}</Link>
          </article>
        ))}

        {filtered.length === 0 ? <p>{t("common.noResults")}</p> : null}
      </section>
    </main>
  );
}
