"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";

import { useTranslations } from "@/i18n/LocaleContext";
import styles from "@/components/profiles/profiles.module.css";

const PAGE_SIZE = 20;

// Color index for avatar backgrounds (0–7), deterministic from name
function avatarColor(name: string): string {
  return String(name.charCodeAt(0) % 8);
}

// Initials from name (up to 2 chars)
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type DirectoryItem = {
  id: string;
  name: string;
  city: string;
  state: string | null;
  specialties: string[];
  rating: number;
  reviewCount?: number;
  verified: boolean;
  url: string;
  subtitle?: string | null;
  yearsOfExperience?: number | null;
  feeMin?: number | null;
  feeMax?: number | null;
};

type DirectorySearchListProps = {
  kind: "hospital" | "doctor";
  items: DirectoryItem[];
  cityOptions: string[];
};

function Stars({ rating }: { rating: number }) {
  const full = Math.min(5, Math.round(rating));
  return (
    <span className={styles.starRow}>
      {"★".repeat(full)}{"☆".repeat(5 - full)}
      <span>{rating.toFixed(1)}</span>
    </span>
  );
}

export function DirectorySearchList({ kind, items, cityOptions }: DirectorySearchListProps) {
  const { t } = useTranslations();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("all");
  const [specialty, setSpecialty] = useState("all");
  const [sort, setSort] = useState<"rating" | "name" | "reviews">("rating");
  const [page, setPage] = useState(1);

  // Initialise city from nav localStorage selection
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("eh_city") : null;
    if (saved && saved !== "all" && cityOptions.includes(saved)) setCity(saved);

    // Also react to nav city changes without page reload
    function onStorage(e: StorageEvent) {
      if (e.key === "eh_city") {
        const next = e.newValue ?? "all";
        setCity(cityOptions.includes(next) ? next : "all");
        setPage(1);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title = kind === "hospital" ? t("hospital.directoryTitle") : t("doctor.directoryTitle");
  const description = kind === "hospital" ? t("hospital.directoryDescription") : t("doctor.directoryDescription");

  const allSpecialties = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const item of items) {
      for (const s of item.specialties) {
        const key = s.trim();
        if (key && !seen.has(key)) { seen.add(key); list.push(key); }
      }
    }
    return list.sort();
  }, [items]);

  const filtered = useMemo(() => {
    let result = items.filter((item) => {
      if (city !== "all" && item.city.toLowerCase() !== city.toLowerCase()) return false;
      if (specialty !== "all" && !item.specialties.some((s) => s.trim() === specialty)) return false;
      if (!query.trim()) return true;
      const text = `${item.name} ${item.city} ${item.state ?? ""} ${item.specialties.join(" ")} ${item.subtitle ?? ""}`.toLowerCase();
      return text.includes(query.trim().toLowerCase());
    });

    if (sort === "rating") result = [...result].sort((a, b) => b.rating - a.rating);
    else if (sort === "name") result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "reviews") result = [...result].sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));

    return result;
  }, [city, items, query, sort, specialty]);

  const visibleItems = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visibleItems.length < filtered.length;

  function resetPage() { setPage(1); }

  return (
    <main className={styles.directoryPage}>
      {/* ── Hero + search ── */}
      <section className={styles.directoryHero}>
        <span className={styles.kicker}>
          {kind === "hospital" ? t("hospital.kicker") : t("doctor.kicker")}
        </span>
        <h1>{title}</h1>
        <p>{description}</p>

        <div className={styles.searchBar}>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); resetPage(); }}
            placeholder={kind === "hospital" ? t("hospital.searchPlaceholder") : t("doctor.searchPlaceholder")}
            aria-label="Search listings"
          />
          <select value={city} onChange={(e) => {
            const next = e.target.value;
            setCity(next);
            if (typeof window !== "undefined") localStorage.setItem("eh_city", next);
            resetPage();
          }} aria-label="Filter by city">
            <option value="all">{t("common.allCities")}</option>
            {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sort} onChange={(e) => { setSort(e.target.value as typeof sort); resetPage(); }} aria-label="Sort">
            <option value="rating">★ {t("common.rating")}</option>
            <option value="name">A–Z</option>
            <option value="reviews">{t("common.rating")} (reviews)</option>
          </select>
        </div>
      </section>

      {/* ── Specialty filter pills ── */}
      {allSpecialties.length > 0 && (
        <div className={styles.directoryControls}>
          <div className={styles.filterScroll}>
            <button
              type="button"
              className={specialty === "all" ? styles.filterPillActive : styles.filterPill}
              onClick={() => { setSpecialty("all"); resetPage(); }}
            >
              {t("common.allDepartments")}
              <span className={styles.filterPillCount}>{items.length}</span>
            </button>
            {allSpecialties.slice(0, 20).map((s) => {
              const count = items.filter((i) => i.specialties.some((sp) => sp.trim() === s)).length;
              return (
                <button
                  key={s}
                  type="button"
                  className={specialty === s ? styles.filterPillActive : styles.filterPill}
                  onClick={() => { setSpecialty(s); resetPage(); }}
                >
                  {s}
                  <span className={styles.filterPillCount}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Result count ── */}
      <p style={{ width: "min(1180px,100%)", margin: "8px auto 0", fontSize: "12px", color: "#8FA39A", fontFamily: "var(--font-bricolage),sans-serif" }}>
        {filtered.length} {kind === "hospital" ? t("nav.hospitals") : t("nav.doctors")} found
      </p>

      {/* ── Card grid ── */}
      <section className={styles.directoryGrid} aria-label={title}>
        {visibleItems.map((item) => (
          <article
            key={item.id}
            className={styles.directoryCard}
            data-testid="directory-card"
            data-entity-id={item.id}
            data-entity-kind={kind}
          >
            {/* Card header: avatar + name — RN: <View row> */}
            <div className={styles.cardHeader}>
              <div
                className={styles.avatar}
                data-color={avatarColor(item.name)}
                aria-hidden="true"
                data-testid="card-avatar"
              >
                {initials(item.name)}
              </div>
              <div className={styles.cardHeaderText}>
                <h2 style={{ margin: 0, fontSize: "15px" }} data-testid="card-name">{item.name}</h2>
                <p style={{ margin: "2px 0 0" }} data-testid="card-location">
                  {item.city}{item.state ? `, ${item.state}` : ""}
                </p>
              </div>
              <span className={styles.typeBadge} data-type={kind} data-testid="card-type-badge">
                {kind === "hospital" ? "🏥" : "👨‍⚕️"}
              </span>
            </div>

            {item.subtitle ? (
              <p style={{ margin: 0, fontSize: "12px", color: "#5A7367" }} data-testid="card-subtitle">
                {item.subtitle.length > 70 ? `${item.subtitle.slice(0, 70)}…` : item.subtitle}
              </p>
            ) : null}

            <div className={styles.tagRow} data-testid="card-specialties">
              {item.specialties.slice(0, 3).map((s) => (
                <span key={`${item.id}-${s}`}>{s}</span>
              ))}
            </div>

            <div className={styles.cardMeta} data-testid="card-meta">
              <Stars rating={item.rating} />
              {item.reviewCount ? (
                <span className={styles.reviewCount} data-testid="card-review-count">
                  ({item.reviewCount.toLocaleString("en-IN")})
                </span>
              ) : null}
              <span className={styles.verifiedBadge} data-testid="card-verified">
                {item.verified ? `✅ ${t("common.verified")}` : t("common.communityVerified")}
              </span>
            </div>

            {/* Doctor extras */}
            {kind === "doctor" && (item.yearsOfExperience ?? item.feeMin) ? (
              <p className={styles.cardExtraRow}>
                {item.yearsOfExperience ? `${item.yearsOfExperience}+ ${t("common.yearsExp")}` : ""}
                {item.yearsOfExperience && item.feeMin ? " · " : ""}
                {item.feeMin ? `₹${item.feeMin.toLocaleString("en-IN")}${item.feeMax ? `–${item.feeMax.toLocaleString("en-IN")}` : ""}` : ""}
              </p>
            ) : null}

            {/* Action buttons — same style as profileCardFooter */}
            <div className={styles.directoryCardFooter}>
              <Link href={item.url} className={styles.directoryCardView} data-testid="btn-view">
                {t("common.viewProfile")}
              </Link>
              <Link href={`${item.url}?book=1`} className={styles.directoryCardBook} data-testid="btn-book">
                {t("common.bookAppointment")}
              </Link>
            </div>
          </article>
        ))}

        {filtered.length === 0 && (
          <p className={styles.emptyState}>{t("common.noResults")}</p>
        )}
      </section>

      {/* ── Load more ── */}
      {hasMore && (
        <div className={styles.loadMoreWrap}>
          <button type="button" className={styles.loadMoreBtn} onClick={() => setPage((p) => p + 1)}>
            Show more ({filtered.length - visibleItems.length} remaining)
          </button>
        </div>
      )}
    </main>
  );
}
