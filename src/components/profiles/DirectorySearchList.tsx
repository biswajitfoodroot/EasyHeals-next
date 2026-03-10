"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

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
  title: string;
  description: string;
  items: DirectoryItem[];
  cityOptions: string[];
};

export function DirectorySearchList({ kind, title, description, items, cityOptions }: DirectorySearchListProps) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("all");

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
        <span className={styles.kicker}>{kind === "hospital" ? "Hospital Directory" : "Doctor Directory"}</span>
        <h1>{title}</h1>
        <p>{description}</p>

        <div className={styles.searchBar}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={kind === "hospital" ? "Search hospital, specialty, city" : "Search doctor, specialty, city"}
            aria-label="Search listings"
          />
          <select value={city} onChange={(event) => setCity(event.target.value)} aria-label="Filter city">
            <option value="all">All Cities</option>
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
            <p>{item.verified ? "Verified" : "Community"} · Rating {item.rating.toFixed(1)}</p>
            <Link href={item.url}>View Profile</Link>
          </article>
        ))}

        {filtered.length === 0 ? <p>No matches found for this filter.</p> : null}
      </section>
    </main>
  );
}
