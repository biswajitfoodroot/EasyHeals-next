"use client";

import { useMemo, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { useTranslations } from "@/i18n/LocaleContext";
import { LOCALES } from "@/i18n/translations";

import { ContributeModal } from "@/components/contribute/ContributeModal";
import { categories, smartBrowseData } from "@/components/phase1/data";
import { RegistrationModal } from "@/components/registration/RegistrationModal";
import { ChatSearch } from "@/components/search/ChatSearch";
import { SearchResults } from "@/components/search/SearchResults";
import type { SearchIntent, SearchResponse, SearchResult } from "@/components/phase1/types";
import { easyHealsPublicData } from "@/data/easyhealsPublicData";
import { RewardsTeaser } from "@/components/gamification/RewardsTeaser";
import styles from "@/components/homepage/homepage.module.css";

type TopRatedEntry = {
  id: string;
  name: string;
  slug: string;
  city: string;
  rating: number;
  reviewCount: number;
  specialties: string[];
};

/* ── Symptom-to-specialist mapping ─────────────────────────────────────────── */

const symptomAreas = [
  {
    key: "head",
    label: "Head & Brain",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a7 7 0 017 7c0 2.5-1.3 4.7-3.2 6l-.8 1H9l-.8-1A7 7 0 115 9a7 7 0 017-7z" /><path d="M9 21h6m-3-3v3" />
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
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
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
        <path d="M6 3l4 4-2 2 4 4 2-2 4 4" /><path d="M3 21l4.5-4.5" />
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
        <ellipse cx="12" cy="13" rx="7" ry="6" /><path d="M9 7c0-2.2 1.3-4 3-4s3 1.8 3 4" />
      </svg>
    ),
    specialist: "Gastroenterology",
    description: "Acidity, stomach pain, liver, digestion and bowel concerns.",
  },
];

/* ── FAQ Data (SEO) ────────────────────────────────────────────────────────── */

const homeFAQs = [
  {
    q: "What is EasyHeals?",
    a: "EasyHeals is an AI-powered healthcare discovery platform that helps patients find the right hospitals, doctors, treatments, and lab tests across India. It supports multilingual search in Hindi, Tamil, Marathi, Bengali and English.",
  },
  {
    q: "Is EasyHeals free to use?",
    a: "Yes. EasyHeals is completely free for patients. Hospitals and doctors can also list their practice and manage appointments at no cost.",
  },
  {
    q: "Does EasyHeals provide medical advice or prescriptions?",
    a: "No. EasyHeals helps you understand symptoms and find the right specialist, but it does not prescribe medication or offer medical diagnosis. Always consult a qualified doctor for medical advice.",
  },
  {
    q: "How does EasyHeals AI search work?",
    a: "Our Gemini-powered AI understands your symptoms or health queries in multiple languages, maps them to the right medical specialties, and shows you verified hospitals and doctors from the EasyHeals network.",
  },
  {
    q: "Can hospitals register on EasyHeals?",
    a: "Yes. Hospitals and clinics can register for free through the self-service OTP-verified onboarding. Once registered, they get access to appointment management, OPD token system, and patient communication tools.",
  },
  {
    q: "Is my health data safe on EasyHeals?",
    a: "Absolutely. EasyHeals follows DPDP (Digital Personal Data Protection) guidelines. All personal health data is AES-256 encrypted, and access is consent-gated. You control your data at all times.",
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

/* ══════════════════════════════════════════════════════════════════════════════
   HOMEPAGE COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── City picker data ──────────────────────────────────────────────────────── */
const CITY_GROUPS = [
  {
    region: "India",
    cities: ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Nagpur", "Kochi", "Indore", "Lucknow", "Visakhapatnam", "Surat", "Bhopal"],
  },
  {
    region: "South Asia",
    cities: ["Dhaka", "Chittagong", "Colombo", "Kathmandu", "Karachi", "Lahore", "Yangon", "Thimphu", "Kabul"],
  },
  {
    region: "Middle East",
    cities: ["Dubai", "Abu Dhabi", "Sharjah", "Muscat", "Salalah", "Riyadh", "Jeddah", "Kuwait City", "Doha", "Manama"],
  },
  {
    region: "Africa",
    cities: ["Nairobi", "Lagos", "Johannesburg", "Cairo", "Addis Ababa"],
  },
];

export default function HomePage() {
  const { locale, setLocale, t } = useTranslations();
  const [langOpen, setLangOpen] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [intent, setIntent] = useState<SearchIntent | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [contributeTarget, setContributeTarget] = useState<SearchResult | null>(null);
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]["key"]>("hospital");
  const [activeSymptomArea, setActiveSymptomArea] = useState(symptomAreas[0]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [personBarDismissed, setPersonBarDismissed] = useState(false);
  const [openFQIndex, setOpenFQIndex] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const currentLocale = LOCALES.find((l) => l.code === locale);

  // Close dropdowns on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Element;
      if (!target.closest("[data-city-picker]")) setCityPickerOpen(false);
      if (!target.closest("[data-lang-picker]")) setLangOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const smartCards = useMemo(
    () => smartBrowseData[activeCategory] ?? smartBrowseData.hospital,
    [activeCategory],
  );

  const [topRated, setTopRated] = useState<TopRatedEntry[]>([]);
  const [city, setCity] = useState<string | null>(null);

  // Filtered city groups based on search input
  const filteredCityGroups = useMemo(() => {
    if (!citySearch.trim()) return CITY_GROUPS;
    const q = citySearch.toLowerCase();
    return CITY_GROUPS
      .map((g) => ({ ...g, cities: g.cities.filter((c) => c.toLowerCase().includes(q)) }))
      .filter((g) => g.cities.length > 0);
  }, [citySearch]);

  // Auth state
  useEffect(() => {
    fetch("/api/v1/patients/me", { credentials: "include" })
      .then((r) => setIsLoggedIn(r.ok))
      .catch(() => setIsLoggedIn(false));
  }, []);

  // Personalization dismissal
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPersonBarDismissed(localStorage.getItem("eh_pbar_v2") === "1");
    }
  }, []);

  // Location detection — localStorage first, then IP, then GPS
  useEffect(() => {
    // 1. Restore last chosen city from localStorage
    const saved = typeof window !== "undefined" ? localStorage.getItem("eh_city") : null;
    if (saved) { setCity(saved); return; }

    // 2. IP-based detection (works on Vercel via x-vercel-ip-city header)
    fetch("/api/v1/location")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { city?: string } | null) => {
        if (data?.city) setCity(data.city);
      })
      .catch(() => {});

    // 3. GPS — silent attempt
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          fetch(`/api/v1/location?lat=${latitude.toFixed(4)}&lng=${longitude.toFixed(4)}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { city?: string } | null) => {
              if (data?.city) setCity(data.city);
            })
            .catch(() => {});
        },
        () => {},
        { timeout: 5000, maximumAge: 300_000 },
      );
    }
  }, []);

  function selectCity(name: string) {
    setCity(name);
    if (typeof window !== "undefined") localStorage.setItem("eh_city", name);
    setCityPickerOpen(false);
    setCitySearch("");
  }

  function detectGpsCity() {
    if (!("geolocation" in navigator)) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        fetch(`/api/v1/location?lat=${latitude.toFixed(4)}&lng=${longitude.toFixed(4)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data: { city?: string } | null) => {
            if (data?.city) selectCity(data.city);
            setGpsLoading(false);
          })
          .catch(() => setGpsLoading(false));
      },
      () => setGpsLoading(false),
      { timeout: 8000, maximumAge: 60_000 },
    );
  }

  // Top rated data — refresh when category or city changes
  useEffect(() => {
    const params = new URLSearchParams({ category: activeCategory });
    if (city) params.set("city", city);
    fetch(`/api/public/top-rated?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { data?: TopRatedEntry[] } | null) => {
        if (data?.data?.length) setTopRated(data.data);
        else setTopRated([]);
      })
      .catch(() => setTopRated([]));
  }, [activeCategory, city]);

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

  function dismissPersonBar() {
    setPersonBarDismissed(true);
    localStorage.setItem("eh_pbar_v2", "1");
  }

  return (
    <main className={styles.page}>
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ① NAV BAR — White, clean, accessible
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className={styles.topNav} role="banner">
        <div className={styles.topNavInner}>
          <Link href="/" className={styles.brand} aria-label="EasyHeals — Home">
            <Image src="/logo.jpg" alt="EasyHeals logo" width={36} height={36} style={{ borderRadius: "10px", objectFit: "contain" }} />
            <strong>
              Easy<b>Heals</b>
            </strong>
          </Link>

          <nav className={styles.topNavLinks} aria-label="Main navigation">
            <Link href="/treatments">{t("nav.treatments")}</Link>
            <Link href="/hospitals">{t("nav.hospitals")}</Link>
            <Link href="/doctors">{t("nav.doctors")}</Link>
          </nav>

          {/* City picker */}
          <div className={styles.navLang} style={{ position: "relative" }} data-city-picker>
            <button
              type="button"
              className={styles.navLangBtn}
              style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
              onClick={() => { setCityPickerOpen((v) => !v); setCitySearch(""); }}
              aria-label="Select city"
              title="Select your city"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="11" r="3" /><path d="M12 2a9 9 0 00-9 9c0 5.25 9 13 9 13s9-7.75 9-13a9 9 0 00-9-9z" />
              </svg>
              <span style={{ maxWidth: "72px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.8rem" }}>
                {city ?? "Set city"}
              </span>
              <span style={{ fontSize: "0.55rem", opacity: 0.6 }}>▼</span>
            </button>

            {cityPickerOpen && (
              <div className={styles.langDrop} style={{ width: "240px", maxHeight: "360px", overflowY: "auto", padding: "0.5rem" }}>
                {/* GPS detect */}
                <button
                  type="button"
                  style={{ width: "100%", textAlign: "left", padding: "0.45rem 0.6rem", borderRadius: "0.5rem", background: "rgba(27,138,74,0.07)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", color: "#136836", marginBottom: "0.4rem" }}
                  onClick={detectGpsCity}
                  disabled={gpsLoading}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /><circle cx="12" cy="12" r="9" strokeDasharray="2 3" />
                  </svg>
                  {gpsLoading ? "Detecting…" : "Use my location"}
                </button>

                {/* Search input */}
                <input
                  type="text"
                  placeholder="Search city…"
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  style={{ width: "100%", padding: "0.35rem 0.5rem", borderRadius: "0.4rem", border: "1px solid #d0e4d8", fontSize: "0.8rem", outline: "none", marginBottom: "0.5rem", boxSizing: "border-box" }}
                  autoFocus
                />

                {/* City groups */}
                {filteredCityGroups.map((group) => (
                  <div key={group.region}>
                    <p style={{ margin: "0.3rem 0 0.2rem", fontSize: "0.68rem", fontWeight: 600, color: "#8FA39A", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 0.4rem" }}>
                      {group.region}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginBottom: "0.3rem" }}>
                      {group.cities.map((c) => (
                        <button
                          key={c}
                          type="button"
                          style={{ padding: "0.22rem 0.5rem", borderRadius: "999px", border: "1px solid #d0e4d8", background: city === c ? "#1B8A4A" : "#fff", color: city === c ? "#fff" : "#0d1f15", fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit" }}
                          onClick={() => selectCity(c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {filteredCityGroups.length === 0 && (
                  <p style={{ fontSize: "0.78rem", color: "#8FA39A", textAlign: "center", padding: "0.5rem" }}>No cities found</p>
                )}
              </div>
            )}
          </div>

          {/* Language picker */}
          <div className={styles.navLang} style={{ position: "relative" }} data-lang-picker>
            <button type="button" className={styles.navLangBtn} onClick={() => setLangOpen((v) => !v)} aria-label={t("nav.changeLanguage")}>
              <span>{currentLocale?.nativeLabel ?? "EN"}</span>
              <span style={{ fontSize: "0.55rem", opacity: 0.6 }}>▼</span>
            </button>

            {langOpen && (
              <div className={styles.langDrop}>
                {LOCALES.map((loc) => (
                  <button
                    key={loc.code}
                    type="button"
                    className={loc.code === locale ? styles.langDropActive : ""}
                    onClick={() => { setLocale(loc.code); setLangOpen(false); }}
                  >
                    <span>{loc.nativeLabel}</span>
                    <span style={{ fontSize: "0.7rem", color: "#8FA39A" }}>{loc.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Auth */}
          {isLoggedIn === true ? (
            <Link href="/dashboard" className={styles.navDashBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              {t("home.myDashboard")}
            </Link>
          ) : isLoggedIn === false ? (
            <Link href="/login" className={styles.navLoginBtn}>{t("home.login")}</Link>
          ) : null}

          <button type="button" className={styles.navCta} onClick={() => setRegistrationOpen(true)}>
            {t("home.listHospitalFree")}
          </button>
        </div>
      </header>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ② HERO SECTION — White, centered AI search
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className={styles.heroSection} aria-labelledby="hero-title">
        <div className={styles.heroDecor} aria-hidden="true">
          <div className={`${styles.heroBlob} ${styles.heroBlob1}`} />
          <div className={`${styles.heroBlob} ${styles.heroBlob2}`} />
        </div>

        <div className={styles.heroInner}>
          <span className={styles.heroBadge}>{t("home.heroLabel")}</span>

          <h1 id="hero-title" className={styles.heroTitle}>
            {t("home.heroTitle").split(".")[0]}.<br /><em>We&apos;ll find the right care.</em>
          </h1>

          <p className={styles.heroSubtitle}>
            {t("home.heroSubtitle")}
          </p>

          <div className={styles.heroChat} id="eh-chat" data-theme="light">
            <ChatSearch
              onSearchResult={handleSearch}
              onLoadingChange={setLoading}
              queuedPrompt={queuedPrompt}
              onQueuedPromptHandled={() => setQueuedPrompt(null)}
              isLoggedIn={isLoggedIn === true}
            />
          </div>

          <div className={styles.heroDisclaimers}>
            <span>🛡️ DPDP Compliant</span>
            <span>✅ Verified Listings</span>
            <span>🆓 Free to Use</span>
            <span>💊 No Medication Advice</span>
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
              <strong>5</strong>
              <span>{t("home.statLanguages")}</span>
            </article>
            <article>
              <strong>4.8★</strong>
              <span>{t("home.statRating")}</span>
            </article>
          </div>

          {/* Search results appear here */}
          <div className={styles.heroResults} data-theme="light">
            <SearchResults
              intent={intent}
              results={results}
              loading={loading}
              onPrompt={triggerPrompt}
              onContribute={setContributeTarget}
              city={city ?? undefined}
              isLoggedIn={isLoggedIn === true}
            />
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ③ PERSONALIZATION BAR — Login encouragement or welcome
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {!personBarDismissed && (
        <div className={styles.personBar}>
          <div className={styles.personBarInner}>
            <span className={styles.personBarIcon}>{isLoggedIn ? "👋" : "💡"}</span>
            <div className={styles.personBarText}>
              <strong>{isLoggedIn ? "Welcome back! Your health dashboard is ready" : "Unlock Your Personalized Health Dashboard"}</strong>
              <p>{isLoggedIn ? "View your appointments, health timeline, rewards & AI health coach." : "Sign in to get AI-powered health suggestions, track appointments, earn rewards & access your personal health coach."}</p>
              <div className={styles.personBarFeatures}>
                <span>📅 Appointments</span>
                <span>📊 Health Timeline</span>
                <span>🏆 Rewards</span>
                <span>🤖 AI Coach</span>
              </div>
            </div>
            <Link href={isLoggedIn ? "/dashboard" : "/login"} className={styles.personBarBtn}>{isLoggedIn ? "Go to Dashboard →" : "Sign In Free →"}</Link>
            <button type="button" className={styles.personBarDismiss} onClick={dismissPersonBar} aria-label="Dismiss">✕</button>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ④ QUICK ACCESS GRID — Browse categories
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className={styles.quickSection} aria-labelledby="quick-title">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Find Healthcare</span>
          <h2 id="quick-title" className={styles.sectionTitle}>{t("home.whatLooking")}</h2>
          <p className={styles.sectionSubtitle}>Find the right healthcare across India — verified private hospitals, specialist doctors, lab tests and treatments.</p>
        </div>

        <div className={styles.quickGrid}>
          <Link href="/hospitals" className={styles.quickCard}>
            <span className={styles.quickIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21V7a2 2 0 012-2h14a2 2 0 012 2v14" /><path d="M3 21h18" /><path d="M9 21V12h6v9" /><path d="M12 7v3m-1.5-1.5h3" />
              </svg>
            </span>
            {t("nav.hospitals")}
          </Link>
          <Link href="/doctors" className={styles.quickCard}>
            <span className={styles.quickIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3" /><path d="M6.5 20a5.5 5.5 0 0111 0" /><path d="M14 15h2a2 2 0 012 2v1" />
              </svg>
            </span>
            {t("nav.doctors")}
          </Link>
          <Link href="/hospitals" className={styles.quickCard}>
            <span className={styles.quickIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8l-5-5H9z" /><path d="M9 3v5h10" /><path d="M9 13h6m-3-3v6" />
              </svg>
            </span>
            {t("home.labTests")}
          </Link>
          <Link href="/treatments" className={styles.quickCard}>
            <span className={styles.quickIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 7l-1 1-4-4 1-1a2 2 0 012.83 0l1.17 1.17A2 2 0 0119 7z" /><path d="M14 8L5 17l-2 4 4-2 9-9" /><path d="M7.5 13.5l3 3" />
              </svg>
            </span>
            {t("nav.treatments")}
          </Link>
          <Link href="/symptoms" className={styles.quickCard}>
            <span className={styles.quickIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" /><path d="M12 6v6l4 2" />
              </svg>
            </span>
            {t("home.symptoms")}
          </Link>
          <button type="button" className={`${styles.quickCard} ${styles.quickCardHighlight}`} onClick={() => setRegistrationOpen(true)}>
            <span className={styles.quickIcon} style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14m-7-7h14" />
              </svg>
            </span>
            {t("home.listHospitalFree")}
          </button>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ⑤ TRUST & SUPPORT STRIP — Institutional backing
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className={styles.trustSection} aria-label="Institutional support and trust signals">
        <div className={styles.trustInner}>
          <p className={styles.trustLabel}>Supported By</p>
          <div className={styles.trustLogos}>
            <div className={styles.trustBadge}>
              <img src="/logos/iim-lucknow.svg" alt="IIM Lucknow" className={styles.trustLogo} />
              <div className={styles.trustBadgeText}>
                <strong>IIM Lucknow</strong>
                <small>Indian Institute of Management</small>
              </div>
            </div>
            <div className={styles.trustBadge}>
              <img src="/logos/iit-mandi.svg" alt="IIT Mandi" className={styles.trustLogo} />
              <div className={styles.trustBadgeText}>
                <strong>IIT Mandi</strong>
                <small>Indian Institute of Technology</small>
              </div>
            </div>
            <div className={styles.trustBadge}>
              <img src="/logos/iihmr.svg" alt="IIHMR" className={styles.trustLogo} />
              <div className={styles.trustBadgeText}>
                <strong>IIHMR</strong>
                <small>Institute of Health Management Research</small>
              </div>
            </div>
          </div>

          <div className={styles.trustDivider} />

          <p className={styles.trustLabel}>Incubated At</p>
          <div className={styles.trustLogos}>
            <div className={styles.trustBadge}>
              <img src="/logos/deshpande.svg" alt="Deshpande Foundation" className={styles.trustLogo} />
              <div className={styles.trustBadgeText}>
                <strong>Deshpande Foundation</strong>
                <small>Startup Incubator</small>
              </div>
            </div>
            <div className={styles.trustBadge}>
              <img src="/logos/msmf.svg" alt="Mazumdar Shaw Medical Foundation" className={styles.trustLogo} />
              <div className={styles.trustBadgeText}>
                <strong>MSMF</strong>
                <small>Mazumdar Shaw Medical Foundation</small>
              </div>
            </div>
          </div>

          <div className={styles.trustSignals}>
            <span>🛡️ DPDP Compliant</span>
            <span>✅ Community Verified Listings</span>
            <span>🆓 Free for Patients</span>
            <span>🌐 5 Indian Languages</span>
            <span>🔒 AES-256 Encrypted</span>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ⑥ TOP RATED NEAR YOU — Category tabs + listings
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className={styles.ratedSection} aria-labelledby="rated-title">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Verified Healthcare</span>
          <h2 id="rated-title" className={styles.sectionTitle}>
            {city ? `${t("home.topRatedIn")} ${city}` : t("home.topRatedNear")}
          </h2>
          <p className={styles.sectionSubtitle}>Community-verified healthcare providers in your area</p>
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
            <button
              type="button"
              className={activeCategory === ("symptom" as typeof activeCategory) ? styles.smartNavActive : ""}
              onClick={() => setActiveCategory("symptom" as typeof activeCategory)}
            >
              Symptom Checker
            </button>
          </aside>

          <div>
            {activeCategory === ("symptom" as typeof activeCategory) ? (
              /* Symptom-to-specialist */
              <div>
                <div className={styles.sectionHeader} style={{ textAlign: "left", marginBottom: 16 }}>
                  <h3 className={styles.sectionTitle} style={{ fontSize: 24 }}>{t("home.notSureSpecialist")}</h3>
                  <p className={styles.sectionSubtitle} style={{ margin: "6px 0 0" }}>{t("home.selectBodyArea")}</p>
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
              </div>
            ) : (
              /* Listings cards */
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
            )}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ⑦ GAMIFICATION — Rewards teaser (moved BEFORE provider section)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className={styles.gamificationSection} aria-label="Rewards programme preview">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Health Rewards</span>
          <h2 className={styles.sectionTitle}>Earn Points for Every Health Action</h2>
          <p className={styles.sectionSubtitle}>Search, book, and stay informed. Top patients in your city get featured on the leaderboard.</p>
        </div>
        <div className={styles.gamificationInner}>
          <RewardsTeaser />
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ⑧ FOR DOCTORS & HOSPITALS — Free tools CTA
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className={styles.providerSection} aria-labelledby="provider-title">
        <div className={styles.providerInner}>
          <div className={styles.providerCopy}>
            <span className={styles.sectionLabel}>For Doctors &amp; Hospitals</span>
            <h2 id="provider-title">{t("home.listHospitalCta")}</h2>
            <p>Manage appointments, patient flow, and your online presence — completely free. No hidden charges, no premium tiers for basic features.</p>

            <ul className={styles.providerFeatures}>
              <li>Free appointment management system</li>
              <li>OPD token queue for walk-in patients</li>
              <li>Patient communication via WhatsApp</li>
              <li>AI-powered patient summaries before visits</li>
              <li>Community-verified listing on EasyHeals</li>
              <li>Self-service OTP onboarding in minutes</li>
            </ul>

            <div className={styles.providerActions}>
              <button type="button" className={styles.providerPrimary} onClick={() => setRegistrationOpen(true)}>
                {t("home.startRegistration")}
              </button>
            </div>
          </div>

          <div className={styles.providerVisual}>
            <h3>What You Get — Free</h3>
            <div className={styles.providerVisualGrid}>
              <div className={styles.providerVisualItem}>
                <span>📅</span>
                <strong>Appointments</strong>
                <p>Manage bookings easily</p>
              </div>
              <div className={styles.providerVisualItem}>
                <span>🎫</span>
                <strong>OPD Tokens</strong>
                <p>Walk-in queue system</p>
              </div>
              <div className={styles.providerVisualItem}>
                <span>📱</span>
                <strong>WhatsApp</strong>
                <p>Patient notifications</p>
              </div>
              <div className={styles.providerVisualItem}>
                <span>🤖</span>
                <strong>AI Summaries</strong>
                <p>Pre-visit patient briefs</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          FAQ Section (SEO — visible content for search engines)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className={styles.faqSection} aria-labelledby="faq-title">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Common Questions</span>
          <h2 id="faq-title" className={styles.sectionTitle}>Frequently Asked Questions</h2>
        </div>

        <div className={styles.faqGrid}>
          {homeFAQs.map((faq, i) => (
            <div key={faq.q} className={styles.faqItem}>
              <button
                type="button"
                className={styles.faqQuestion}
                onClick={() => setOpenFQIndex(openFQIndex === i ? null : i)}
                aria-expanded={openFQIndex === i}
              >
                {faq.q}
                <span style={{ fontSize: 18, transform: openFQIndex === i ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
              </button>
              {openFQIndex === i && <p className={styles.faqAnswer}>{faq.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ⑨ FOOTER — Enhanced
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <footer className={styles.footer} role="contentinfo">
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <strong>EasyHeals Technologies Pvt. Ltd.</strong>
            <p>
              {easyHealsPublicData.contact.phone} · {easyHealsPublicData.contact.email}<br />
              {easyHealsPublicData.contact.address}
            </p>
          </div>

          <nav className={styles.footerLinks} aria-label="Footer links">
            <Link href="/hospitals">Hospitals</Link>
            <Link href="/doctors">Doctors</Link>
            <Link href="/treatments">Treatments</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/register">Register Hospital</Link>
          </nav>
        </div>

        <div className={styles.footerBottom}>
          <p>© {new Date().getFullYear()} EasyHeals Technologies Pvt. Ltd. All rights reserved.</p>
          <p className={styles.footerInstitutions}>
            Supported by IIM Lucknow, IIT Mandi &amp; IIHMR · Incubated at Deshpande Foundation &amp; MSMF
          </p>
        </div>
      </footer>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <RegistrationModal isOpen={registrationOpen} onClose={() => setRegistrationOpen(false)} />
      <ContributeModal
        isOpen={Boolean(contributeTarget)}
        target={contributeTarget}
        onClose={() => setContributeTarget(null)}
      />
    </main>
  );
}
