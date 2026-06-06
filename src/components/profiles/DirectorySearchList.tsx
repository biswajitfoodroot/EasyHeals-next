"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

import { useTranslations } from "@/i18n/LocaleContext";
import EasyHealsNetworkBadge from "@/components/profiles/EasyHealsNetworkBadge";
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
  networkTierCode?: string | null;
};

type DirectorySearchListProps = {
  kind: "hospital" | "doctor";
  items: DirectoryItem[];
  cityOptions: string[];
};

function Stars({ rating, reviewCount }: { rating: number; reviewCount?: number }) {
  // Bayesian prior: entities with no reviews start at 4.0
  const effective = (reviewCount === 0 || reviewCount == null) && rating === 0 ? 4.0 : rating;
  const full = Math.min(5, Math.round(effective));
  return (
    <span className={styles.starRow}>
      {"★".repeat(full)}{"☆".repeat(5 - full)}
      <span>{effective.toFixed(1)}</span>
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
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  // Draft state for the filter sheet (applied only on "Show Results" tap)
  const [draftCity, setDraftCity] = useState("all");
  const [draftSpecialty, setDraftSpecialty] = useState("all");
  const [draftSort, setDraftSort] = useState<"rating" | "name" | "reviews">("rating");

  function openFilterSheet() {
    setDraftCity(city);
    setDraftSpecialty(specialty);
    setDraftSort(sort);
    setFilterSheetOpen(true);
  }

  function applyFilters() {
    setCity(draftCity);
    setSpecialty(draftSpecialty);
    setSort(draftSort);
    setPage(1);
    setFilterSheetOpen(false);
  }

  function resetFilters() {
    setDraftCity("all");
    setDraftSpecialty("all");
    setDraftSort("rating");
  }

  const activeFilterCount = [city !== "all", specialty !== "all", sort !== "rating"].filter(Boolean).length;

  // These must be computed before the sentinel useCallback that depends on hasMore
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

  // Count based on draft filter state — updates live as user taps options in the sheet
  const draftFilteredCount = useMemo(() => {
    return items.filter((item) => {
      if (draftCity !== "all" && item.city.toLowerCase() !== draftCity.toLowerCase()) return false;
      if (draftSpecialty !== "all" && !item.specialties.some((s) => s.trim() === draftSpecialty)) return false;
      if (!query.trim()) return true;
      const text = `${item.name} ${item.city} ${item.state ?? ""} ${item.specialties.join(" ")} ${item.subtitle ?? ""}`.toLowerCase();
      return text.includes(query.trim().toLowerCase());
    }).length;
  }, [draftCity, draftSpecialty, items, query]);

  const visibleItems = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visibleItems.length < filtered.length;

  // Sentinel element observed by IntersectionObserver to auto-load next page
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMore = useCallback(() => {
    if (hasMore) setPage((p) => p + 1);
  }, [hasMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

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

  function resetPage() { setPage(1); }

  return (
    <main className={styles.directoryPage}>
      {/* ── Hero + search ── */}
      <section className={styles.directoryHero}>
        <h1>{title}</h1>
        <p>{description}</p>

        <div className={styles.heroStatsBanner}>
          <span className={styles.heroStatPill}>🏥 {items.length} {kind === "hospital" ? t("common.hospitals") : t("common.doctors")}</span>
          <span className={styles.heroStatPill}>📍 {cityOptions.length} {t("common.cities")}</span>
          <span className={styles.heroStatPill}>🩺 {allSpecialties.length} {t("common.specialties")}</span>
        </div>

        <div className={styles.searchBar}>
          <div className={styles.searchInputWrap}>
            <svg className={styles.searchInputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); resetPage(); }}
              placeholder={kind === "hospital" ? t("hospital.searchPlaceholder") : t("doctor.searchPlaceholder")}
              aria-label={t("common.search")}
            />
          </div>
          <select
            value={city}
            onChange={(e) => {
              const next = e.target.value;
              setCity(next);
              if (typeof window !== "undefined") localStorage.setItem("eh_city", next);
              resetPage();
            }}
            aria-label={t("common.allCities")}
            className={styles.searchBarSelectHideMobile}
          >
            <option value="all">{t("common.allCities")}</option>
            {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as typeof sort); resetPage(); }}
            aria-label={t("common.rating")}
            className={styles.searchBarSelectHideMobile}
          >
            <option value="rating">★ {t("common.rating")}</option>
            <option value="name">{t("common.sortAZ")}</option>
            <option value="reviews">{t("common.sortReviews")}</option>
          </select>
          {/* Filter button — visible only on mobile */}
          <button
            type="button"
            className={styles.mobileFilterBtn}
            data-active={activeFilterCount > 0 ? "true" : "false"}
            onClick={openFilterSheet}
            aria-label={t("common.filters")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            {t("common.filters")}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        </div>
      </section>

      {/* ── View mode toggle (List / Map) ── */}
      <div className={styles.viewToggleBar}>
        <button
          type="button"
          className={viewMode === "list" ? styles.viewToggleActive : styles.viewToggle}
          onClick={() => setViewMode("list")}
          aria-pressed={viewMode === "list"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          {t("common.listView")}
        </button>
        <button
          type="button"
          className={viewMode === "map" ? styles.viewToggleActive : styles.viewToggle}
          onClick={() => setViewMode("map")}
          aria-pressed={viewMode === "map"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
            <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
          </svg>
          {t("common.mapView")}
        </button>
      </div>

      {/* ── Map view panel ── */}
      {viewMode === "map" && (() => {
        const searchCity = city !== "all" ? city : "India";
        const searchQuery = encodeURIComponent(`${kind === "hospital" ? "hospitals" : "doctors"} in ${searchCity}`);
        const mapsUrl = `https://www.google.com/maps/search/${searchQuery}`;
        const embedUrl = `https://maps.google.com/maps?q=${searchQuery}&output=embed&hl=en`;
        return (
          <div className={styles.mapViewPanel}>
            {/* Mobile CTA — opens native Maps app */}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.mapOpenBtn}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="11" r="3"/><path d="M12 2a9 9 0 00-9 9c0 5.25 9 13 9 13s9-7.75 9-13a9 9 0 00-9-9z"/>
              </svg>
              Open {kind === "hospital" ? "Hospitals" : "Doctors"} in {searchCity} on Google Maps
            </a>
            {/* Desktop + tablet: embedded map */}
            <div className={styles.mapEmbedWrap}>
              <iframe
                src={embedUrl}
                title={`${kind === "hospital" ? "Hospitals" : "Doctors"} near ${searchCity}`}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                className={styles.mapEmbed}
              />
            </div>
            <p className={styles.mapNote}>
              Showing Google Maps results for {kind === "hospital" ? "hospitals" : "doctors"} in {searchCity}. Tap a pin for details.
            </p>
          </div>
        );
      })()}

      {/* ── Specialty filter pills ── */}
      {viewMode === "list" && allSpecialties.length > 0 && (
        <div className={styles.directoryControls}>
          <p className={styles.filterScrollLabel}>{t("common.browseByDepartment")}</p>
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

      {/* ── List mode: result count + card grid ── */}
      {viewMode === "list" && (<>
      <p className={styles.resultCount}>
        {(kind === "hospital" ? t("common.hospitalsFound") : t("common.doctorsFound")).replace("{n}", String(filtered.length))}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => { setCity("all"); setSpecialty("all"); setSort("rating"); setPage(1); }}
            className={styles.clearFiltersBtn}
          >
            {t("common.clearFilters")}
          </button>
        )}
      </p>

      {/* ── Card grid ── */}
      <section className={styles.directoryGrid} aria-label={title}>
        {visibleItems.map((item) => (
          <article
            key={item.id}
            className={styles.directoryCard}
            data-color={avatarColor(item.name)}
            data-testid="directory-card"
            data-entity-id={item.id}
            data-entity-kind={kind}
          >
            {/* Card header: avatar + name — desktop layout */}
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
                <h3 className={styles.cardName} data-testid="card-name">{item.name}</h3>
                <p className={styles.cardLocation} data-testid="card-location">
                  {item.city}{item.state ? `, ${item.state}` : ""}
                </p>
              </div>
              <span className={styles.typeBadge} data-type={kind} data-testid="card-type-badge">
                {kind === "hospital" ? "🏥" : "👨‍⚕️"}
              </span>
            </div>

            {/* Mobile list body — shows name, location, rating, experience inline beside avatar */}
            <div className={styles.directoryListBody}>
              <p className={styles.listBodyName}>{item.name}</p>
              <p className={styles.listBodyMeta}>
                {item.city}{item.state ? `, ${item.state}` : ""}
                {item.subtitle ? ` · ${item.subtitle.slice(0, 40)}` : ""}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                <Stars rating={item.rating} reviewCount={item.reviewCount} />
                {kind === "doctor" && item.yearsOfExperience ? (
                  <span className={styles.listBodyExpBadge}>
                    {item.yearsOfExperience}+ {t("common.yearsExp")}
                  </span>
                ) : null}
                {kind === "doctor" && item.feeMin ? (
                  <span className={styles.listBodyFeeBadge}>
                    ₹{item.feeMin.toLocaleString("en-IN")}
                    {item.feeMax ? `–${item.feeMax.toLocaleString("en-IN")}` : ""}
                  </span>
                ) : null}
                {!item.networkTierCode && (
                  <span className={styles.listBodyVerifiedBadge} data-verified={item.verified ? "true" : "false"}>
                    {item.verified ? `✅ ${t("common.verified")}` : t("common.communityVerified")}
                  </span>
                )}
                {item.networkTierCode ? (
                  <span className={styles.listBodyNetworkChip}>✦ {t("common.network")}</span>
                ) : null}
              </div>
            </div>

            {item.subtitle ? (
              <p style={{ margin: 0, fontSize: "12px", color: "#5A7367" }} data-testid="card-subtitle">
                {item.subtitle.length > 70 ? `${item.subtitle.slice(0, 70)}…` : item.subtitle}
              </p>
            ) : null}

            {item.specialties.length > 0 && (
              <div className={styles.tagRow} data-testid="card-specialties">
                {item.specialties.slice(0, 3).map((s) => (
                  <span key={`${item.id}-${s}`}>{s}</span>
                ))}
              </div>
            )}

            <div className={styles.cardMeta} data-testid="card-meta">
              <Stars rating={item.rating} reviewCount={item.reviewCount} />
              {item.reviewCount ? (
                <span className={styles.reviewCount} data-testid="card-review-count">
                  ({item.reviewCount.toLocaleString("en-IN")})
                </span>
              ) : null}
              {!item.networkTierCode && (
                <span className={styles.verifiedBadge} data-testid="card-verified">
                  {item.verified ? `✅ ${t("common.verified")}` : t("common.communityVerified")}
                </span>
              )}
            </div>

            {/* EasyHeals Network badge */}
            {item.networkTierCode && (
              <div className={styles.networkBadgeWrap} style={{ marginTop: "6px" }}>
                <EasyHealsNetworkBadge tierCode={item.networkTierCode} compact />
              </div>
            )}

            {/* Doctor extras */}
            {kind === "doctor" && (item.yearsOfExperience ?? item.feeMin) ? (
              <p className={styles.cardExtraRow}>
                {item.yearsOfExperience ? `${item.yearsOfExperience}+ ${t("common.yearsExp")}` : ""}
                {item.yearsOfExperience && item.feeMin ? " · " : ""}
                {item.feeMin ? `₹${item.feeMin.toLocaleString("en-IN")}${item.feeMax ? `–${item.feeMax.toLocaleString("en-IN")}` : ""}` : ""}
              </p>
            ) : null}

            {/* Action buttons */}
            <div className={styles.directoryCardFooter}>
              <Link href={item.url} className={styles.directoryCardView} data-testid="btn-view">
                {t("home.view")}
              </Link>
              {kind === "hospital" && !item.networkTierCode ? (
                <Link href={`${item.url}?contact=1`} className={styles.directoryCardBook} data-testid="btn-contact"
                  style={{ background: "transparent", color: "#1B8A4A", border: "1.5px solid #1B8A4A" }}>
                  {t("common.contact")}
                </Link>
              ) : (
                <Link href={`${item.url}?book=1`} className={styles.directoryCardBook} data-testid="btn-book">
                  {t("home.book")}
                </Link>
              )}
            </div>
          </article>
        ))}

        {filtered.length === 0 && (
          <p className={styles.emptyState}>{t("common.noResults")}</p>
        )}
      </section>

      {/* ── Infinite scroll sentinel ── */}
      {hasMore && (
        <div ref={sentinelRef} className={styles.loadMoreWrap} aria-hidden="true">
          <span style={{ display: "flex", justifyContent: "center", padding: "12px 0", color: "#8FA39A", fontSize: "13px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B8A4A" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}>
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
          </span>
        </div>
      )}
      </>)} {/* end viewMode === "list" */}

      {/* ── Mobile filter bottom sheet ── */}
      {filterSheetOpen && (
        <>
          <div className={styles.filterSheetOverlay} onClick={() => setFilterSheetOpen(false)} />
          <div className={styles.filterSheet} role="dialog" aria-label="Filter options">
            <div className={styles.filterSheetHandle}><div /></div>

            <div className={styles.filterSheetHeader}>
              <h3>
                {t("common.filters")}
                {activeFilterCount > 0 && (
                  <span className={styles.filterActiveChip}>{activeFilterCount}</span>
                )}
              </h3>
              <button type="button" onClick={() => setFilterSheetOpen(false)} aria-label="Close filters">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className={styles.filterSheetBody}>
              {/* Sort — 3-column segmented control */}
              <div className={styles.filterSheetSection}>
                <h4>{t("common.sortBy")}</h4>
                <div className={styles.filterSortGrid}>
                  {[
                    { value: "rating" as const, icon: "★", label: t("common.topRated") },
                    { value: "name" as const, icon: "A→Z", label: t("common.sortAZ") },
                    { value: "reviews" as const, icon: "💬", label: t("common.sortReviews") },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={draftSort === opt.value ? styles.filterSortBtnActive : styles.filterSortBtn}
                      onClick={() => setDraftSort(opt.value)}
                    >
                      <span className={styles.filterSortBtnIcon}>{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* City — single-line horizontal scroll */}
              <div className={styles.filterSheetSection}>
                <h4>{t("common.city")}</h4>
                <div className={styles.filterCityScroll}>
                  <button
                    type="button"
                    className={draftCity === "all" ? styles.filterPillActive : styles.filterPill}
                    onClick={() => setDraftCity("all")}
                  >
                    {t("common.all")}
                  </button>
                  {cityOptions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={draftCity === c ? styles.filterPillActive : styles.filterPill}
                      onClick={() => setDraftCity(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specialty — scrollable pill grid */}
              {allSpecialties.length > 0 && (
                <div className={styles.filterSheetSection}>
                  <h4>{t("common.specialty")}</h4>
                  <div className={styles.filterSpecialtyScroll}>
                    <div className={styles.filterSheetPills}>
                      <button
                        type="button"
                        className={draftSpecialty === "all" ? styles.filterPillActive : styles.filterPill}
                        onClick={() => setDraftSpecialty("all")}
                      >
                        {t("common.all")}
                      </button>
                      {allSpecialties.slice(0, 40).map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={draftSpecialty === s ? styles.filterPillActive : styles.filterPill}
                          onClick={() => setDraftSpecialty(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.filterSheetFooter}>
              <button type="button" className={styles.filterSheetReset} onClick={resetFilters}>{t("common.reset")}</button>
              <button type="button" className={styles.filterSheetApply} onClick={applyFilters}>
                {t("common.showNResults").replace("{n}", String(draftFilteredCount))}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
