"use client";

import { useMemo, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { useTranslations } from "@/i18n/LocaleContext";
import { LOCALES } from "@/i18n/translations";

import { ContributeModal } from "@/components/contribute/ContributeModal";
import { categories, smartBrowseData } from "@/components/phase1/data";
import styles from "@/components/phase1/phase1.module.css";
import { RegistrationModal } from "@/components/registration/RegistrationModal";
import { ChatSearch } from "@/components/search/ChatSearch";
import { SearchResults } from "@/components/search/SearchResults";
import type { SearchIntent, SearchResponse, SearchResult } from "@/components/phase1/types";
import { easyHealsPublicData } from "@/data/easyhealsPublicData";
import { RewardsTeaser } from "@/components/gamification/RewardsTeaser";

type TopRatedEntry = {
  id: string;
  name: string;
  slug: string;
  city: string;
  rating: number;
  reviewCount: number;
  specialties: string[];
};

const symptomAreas = [
  {
    key: "head",
    label: "Head & Brain",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a7 7 0 017 7c0 2.5-1.3 4.7-3.2 6l-.8 1H9l-.8-1A7 7 0 115 9a7 7 0 017-7z"/><path d="M9 21h6m-3-3v3"/>
      </svg>
    ),
    specialist: "Neurology",
    description: "Headache, seizure, memory issues, dizziness, stroke signs.",
  },
  {
    key: "heart",
    label: "Chest & Heart",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
      </svg>
    ),
    specialist: "Cardiology",
    description: "Chest pain, palpitations, breathlessness, blood pressure concerns.",
  },
  {
    key: "joints",
    label: "Joints & Bones",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3l4 4-2 2 4 4 2-2 4 4"/><path d="M3 21l4.5-4.5"/>
      </svg>
    ),
    specialist: "Orthopaedics",
    description: "Joint pain, fractures, back pain, sports injury, spine issues.",
  },
  {
    key: "abdomen",
    label: "Abdomen",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="13" rx="7" ry="6"/><path d="M9 7c0-2.2 1.3-4 3-4s3 1.8 3 4"/>
      </svg>
    ),
    specialist: "Gastroenterology",
    description: "Acidity, stomach pain, liver, digestion and bowel concerns.",
  },
];

function smartListingAsSearchResult(item: {
  id: string;
  name: string;
  location: string;
  tags: string[];
  rating: string;
}): SearchResult {
  const [city] = item.location.split(",").slice(-1);

  return {
    id: item.id,
    type: item.name.toLowerCase().includes("dr") ? "doctor" : "hospital",
    name: item.name,
    slug: item.id,
    city: (city ?? item.location).trim(),
    state: null,
    rating: Number(item.rating) || 0,
    verified: true,
    communityVerified: true,
    specialties: item.tags,
    source: "seed",
    score: Number(item.rating) || 0,
    description: null,
    profileUrl: item.name.toLowerCase().includes("dr") ? `/doctors/${item.id}` : `/hospitals/${item.id}`,
    phone: null,
  };
}

export default function PhaseOneHome() {
  const { locale, setLocale, t } = useTranslations();
  const [langOpen, setLangOpen] = useState(false);
  const [intent, setIntent] = useState<SearchIntent | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [contributeTarget, setContributeTarget] = useState<SearchResult | null>(null);
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]["key"]>("hospital");
  const [activeSymptomArea, setActiveSymptomArea] = useState(symptomAreas[0]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  const currentLocale = LOCALES.find((l) => l.code === locale);

  const smartCards = useMemo(
    () => smartBrowseData[activeCategory] ?? smartBrowseData.hospital,
    [activeCategory],
  );

  const [topRated, setTopRated] = useState<TopRatedEntry[]>([]);
  const [city, setCity] = useState<string | null>(null);

  // Auth state check — determines Login vs My Dashboard in nav
  useEffect(() => {
    fetch("/api/v1/patients/me", { credentials: "include" })
      .then((r) => setIsLoggedIn(r.ok))
      .catch(() => setIsLoggedIn(false));
  }, []);

  // Task 3.10 — Location detection: Vercel IP city header (primary) + browser geolocation (refinement)
  useEffect(() => {
    // Step 1: fetch server-detected city from Vercel IP header
    fetch("/api/v1/location")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { city?: string } | null) => {
        if (data?.city) setCity(data.city);
      })
      .catch(() => {/* non-fatal */});

    // Step 2: try browser geolocation for precision — result sent back to server for reverse-geocode
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          fetch(`/api/v1/location?lat=${latitude.toFixed(4)}&lng=${longitude.toFixed(4)}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { city?: string } | null) => {
              if (data?.city) setCity(data.city);
            })
            .catch(() => {/* non-fatal */});
        },
        () => {/* denied or unavailable — IP-based city already set above */},
        { timeout: 5000, maximumAge: 300_000 },
      );
    }
  }, []);

  useEffect(() => {
    fetch(`/api/public/top-rated?category=${activeCategory}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { data?: TopRatedEntry[] } | null) => {
        if (data?.data?.length) setTopRated(data.data);
        else setTopRated([]);
      })
      .catch(() => setTopRated([]));
  }, [activeCategory]);

  function handleSearch(payload: SearchResponse) {
    setIntent(payload.intent);
    setResults(payload.results);
  }

  function triggerPrompt(prompt: string) {
    setQueuedPrompt(prompt);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function focusChat() {
    document.getElementById("eh-chat")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <main className={styles.page}>
      <header className={styles.topNav}>
        <div className={styles.topNavInner}>
          <Link href="/" className={styles.brand}>
            <Image src="/logo.jpg" alt="EasyHeals logo" width={34} height={34} style={{ borderRadius: "9px", objectFit: "contain" }} />
            <strong>
              Easy<b>Heals</b>
            </strong>
          </Link>

          <button type="button" className={styles.navPill} onClick={focusChat}>
            <i>?</i>
            <span>Ask anything - chest pain, knee surgeon, MRI near me...</span>
            <small>AI</small>
          </button>

          <nav className={styles.topNavLinks}>
            <Link href="/treatments">{t("nav.treatments")}</Link>
            <Link href="/symptoms">{t("home.symptoms")}</Link>
            <Link href="/hospitals">{t("nav.hospitals")}</Link>
            <Link href="/doctors">{t("nav.doctors")}</Link>
          </nav>

          {/* Language picker */}
          <div className={styles.navLang} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "5px 10px",
                borderRadius: "999px",
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.75)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              aria-label="Change language"
            >
              <span>{currentLocale?.nativeLabel ?? "EN"}</span>
              <span style={{ fontSize: "0.55rem", opacity: 0.7 }}>▼</span>
            </button>

            {langOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  background: "#0d1f38",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "12px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  overflow: "hidden",
                  minWidth: "140px",
                  zIndex: 300,
                }}
              >
                {LOCALES.map((loc) => (
                  <button
                    key={loc.code}
                    type="button"
                    onClick={() => { setLocale(loc.code); setLangOpen(false); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      padding: "0.55rem 0.85rem",
                      background: loc.code === locale ? "rgba(110,232,160,0.1)" : "transparent",
                      border: "none",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      cursor: "pointer",
                      fontSize: "0.82rem",
                      fontFamily: "inherit",
                      color: loc.code === locale ? "#6ee8a0" : "rgba(255,255,255,0.75)",
                      fontWeight: loc.code === locale ? 700 : 400,
                      textAlign: "left",
                    }}
                  >
                    <span>{loc.nativeLabel}</span>
                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)" }}>{loc.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Auth link */}
          {isLoggedIn === true ? (
            <Link
              href="/dashboard"
              style={{
                height: "34px",
                borderRadius: "999px",
                padding: "0 16px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                color: "#6ee8a0",
                border: "1px solid rgba(110,232,160,0.35)",
                background: "rgba(110,232,160,0.08)",
                fontSize: "13px",
                fontWeight: 700,
                textDecoration: "none",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              {t("home.myDashboard")}
            </Link>
          ) : isLoggedIn === false ? (
            <Link
              href="/login"
              style={{
                height: "34px",
                borderRadius: "999px",
                padding: "0 16px",
                display: "inline-flex",
                alignItems: "center",
                color: "rgba(255,255,255,0.85)",
                border: "1px solid rgba(255,255,255,0.25)",
                background: "transparent",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              {t("home.login")}
            </Link>
          ) : null}

          <button type="button" className={styles.navCta} onClick={() => setRegistrationOpen(true)}>
            {t("home.listHospitalFree")}
          </button>
        </div>
      </header>

      <section className={styles.heroSection}>
        <div className={styles.heroOrbs} aria-hidden="true">
          <div className={`${styles.orb} ${styles.orbOne}`} />
          <div className={`${styles.orb} ${styles.orbTwo}`} />
          <div className={`${styles.orb} ${styles.orbThree}`} />
        </div>
        <div className={styles.heroGrid} aria-hidden="true" />

        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.heroLabel}>{t("home.heroLabel")}</span>
            <h1>
              {t("home.heroTitle")}
            </h1>
            <p>
              {t("home.heroSubtitle")}
            </p>

            <div id="eh-chat">
              <ChatSearch
                onSearchResult={handleSearch}
                onLoadingChange={setLoading}
                queuedPrompt={queuedPrompt}
                onQueuedPromptHandled={() => setQueuedPrompt(null)}
              />
            </div>

            <div className={styles.heroStats}>
              <article>
                <strong>12k+</strong>
                <span>{t("home.statHospitals")}</span>
              </article>
              <article>
                <strong>50+</strong>
                <span>{t("home.statCities")}</span>
              </article>
              <article>
                <strong>9 lang</strong>
                <span>{t("home.statLanguages")}</span>
              </article>
              <article>
                <strong>4.8?</strong>
                <span>{t("home.statRating")}</span>
              </article>
            </div>
          </div>

          <div className={styles.heroRight}>
            <SearchResults
              intent={intent}
              results={results}
              loading={loading}
              onPrompt={triggerPrompt}
              onContribute={setContributeTarget}
            />

            <div className={styles.trustRow}>
              <span>HIPAA Compliant</span>
              <span>Verified Listings</span>
              <span>Free to Use</span>
              <span>9 Languages</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.quickSection}>
        <div className={styles.sectionHeader}>
          <span>RC#4 Pan India Private Coverage</span>
          <h2>{t("home.whatLooking")}</h2>
          <p>Government hospitals are excluded by rule in this phase.</p>
        </div>
        <div className={styles.quickGrid}>
          <Link href="/hospitals">
            <span className={styles.quickIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21V7a2 2 0 012-2h14a2 2 0 012 2v14"/><path d="M3 21h18"/><path d="M9 21V12h6v9"/><path d="M12 7v3m-1.5-1.5h3"/>
              </svg>
            </span>
            {t("nav.hospitals")}
          </Link>
          <Link href="/doctors">
            <span className={styles.quickIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3"/><path d="M6.5 20a5.5 5.5 0 0111 0"/><path d="M14 15h2a2 2 0 012 2v1"/>
              </svg>
            </span>
            {t("nav.doctors")}
          </Link>
          <Link href="/hospitals">
            <span className={styles.quickIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8l-5-5H9z"/><path d="M9 3v5h10"/><path d="M9 13h6m-3-3v6"/>
              </svg>
            </span>
            {t("home.labTests")}
          </Link>
          <Link href="/treatments">
            <span className={styles.quickIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 7l-1 1-4-4 1-1a2 2 0 012.83 0l1.17 1.17A2 2 0 0119 7z"/><path d="M14 8L5 17l-2 4 4-2 9-9"/><path d="M7.5 13.5l3 3"/>
              </svg>
            </span>
            {t("nav.treatments")}
          </Link>
          <Link href="/treatments">
            <span className={styles.quickIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/><path d="M12 6v6l4 2"/>
              </svg>
            </span>
            {t("home.symptoms")}
          </Link>
          <button type="button" onClick={() => setRegistrationOpen(true)}>
            <span className={styles.quickIcon} style={{ color: "#fff" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14m-7-7h14"/>
              </svg>
            </span>
            {t("home.listHospitalFree")}
          </button>
        </div>
      </section>

      <section className={styles.smartSection}>
        <div className={styles.sectionHeader}>
          <span>RC#3 Crowd Listings + AI Outlier Detection</span>
          <h2>{city ? `${t("home.topRatedIn")} ${city}` : t("home.topRatedNear")}</h2>
          <p>Community updates are scored before approval.</p>
        </div>

        <div className={styles.smartLayout}>
          <aside className={styles.smartNav}>
            {categories.map((category) => (
              <button
                key={category.key}
                type="button"
                className={activeCategory === category.key ? styles.smartNavActive : ""}
                onClick={() => setActiveCategory(category.key)}
              >
                {category.label}
              </button>
            ))}
          </aside>

          <div className={styles.smartCards}>
            {topRated.length > 0
              ? topRated.map((entry) => (
                  <article key={entry.id}>
                    <h3>{entry.name}</h3>
                    <p>{entry.city}</p>
                    <div className={styles.tagRow}>
                      {entry.specialties.slice(0, 3).map((tag) => (
                        <span key={`${entry.id}-${tag}`}>{tag}</span>
                      ))}
                    </div>
                    <div className={styles.smartFoot}>
                      <span>⭐ {entry.rating.toFixed(1)} ({entry.reviewCount.toLocaleString("en-IN")})</span>
                      <Link href={`/hospitals/${entry.slug}`} className={styles.smartViewBtn}>
                        {t("home.viewProfile")}
                      </Link>
                    </div>
                  </article>
                ))
              : smartCards.map((card) => (
                  <article key={card.id}>
                    <h3>{card.name}</h3>
                    <p>{card.location}</p>
                    <div className={styles.tagRow}>
                      {card.tags.map((tag) => (
                        <span key={`${card.id}-${tag}`}>{tag}</span>
                      ))}
                    </div>
                    <div className={styles.smartFoot}>
                      <span>⭐ {card.rating} ({card.reviews})</span>
                      <button type="button" onClick={() => setContributeTarget(smartListingAsSearchResult(card))}>
                        {t("home.suggestEdit")}
                      </button>
                    </div>
                  </article>
                ))}
          </div>
        </div>
      </section>

      <section className={styles.symptomSection}>
        <div className={styles.sectionHeader}>
          <span>RC#1 Symptom to Specialist Mapping</span>
          <h2>{t("home.notSureSpecialist")}</h2>
          <p>{t("home.selectBodyArea")}</p>
        </div>

        <div className={styles.symptomLayout}>
          <div className={styles.areaButtons}>
            {symptomAreas.map((area) => (
              <button
                key={area.key}
                type="button"
                className={activeSymptomArea.key === area.key ? styles.areaActive : ""}
                onClick={() => setActiveSymptomArea(area)}
              >
                <span className={styles.areaIcon}>{area.icon}</span>
                {area.label}
              </button>
            ))}
          </div>
          <article className={styles.symptomPanel}>
            <h3>{activeSymptomArea.specialist}</h3>
            <p>{activeSymptomArea.description}</p>
            <button type="button" onClick={() => triggerPrompt(`Need ${activeSymptomArea.specialist} specialist`)}>
              Find {activeSymptomArea.specialist}
            </button>
          </article>
        </div>
      </section>

      {/* Task 3.4 — RewardsTeaser: shown in P1 when gamification_phase_a=OFF */}
      <section style={{ padding: "40px 24px", maxWidth: "480px", margin: "0 auto" }}>
        <RewardsTeaser />
      </section>

      <section className={styles.registerSection}>
        <div>
          <span>RC#6 Self Registration</span>
          <h2>{t("home.listHospitalCta")}</h2>
          <p>
            OTP verified onboarding, free basic tier, and activation in minutes. Zero manual admin
            dependency.
          </p>
        </div>
        <button type="button" onClick={() => setRegistrationOpen(true)}>
          {t("home.startRegistration")}
        </button>
      </section>

      <footer className={styles.footer}>
        <strong>EasyHeals Technologies Pvt. Ltd.</strong>
        <p>
          {easyHealsPublicData.contact.phone} - {easyHealsPublicData.contact.email} - {easyHealsPublicData.contact.address}
        </p>
      </footer>

      <RegistrationModal isOpen={registrationOpen} onClose={() => setRegistrationOpen(false)} />
      <ContributeModal
        isOpen={Boolean(contributeTarget)}
        target={contributeTarget}
        onClose={() => setContributeTarget(null)}
      />
    </main>
  );
}


