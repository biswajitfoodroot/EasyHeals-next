"use client";

import { useMemo, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { useTranslations } from "@/i18n/LocaleContext";
import { LOCALES } from "@/i18n/translations";

import { ContributeModal } from "@/components/contribute/ContributeModal";
import { RegistrationModal } from "@/components/registration/RegistrationModal";
import { ChatSearch } from "@/components/search/ChatSearch";
import { SearchResults } from "@/components/search/SearchResults";
import type { SearchIntent, SearchResponse, SearchResult } from "@/components/phase1/types";
import { easyHealsPublicData } from "@/data/easyhealsPublicData";
import HealthAssistant from "@/components/health-assistant/HealthAssistant";
import styles from "@/components/homepage/homepage.module.css";

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
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [personBarDismissed, setPersonBarDismissed] = useState(false);
  const [openFQIndex, setOpenFQIndex] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [stats, setStats] = useState({
    hospitalLabel: "12k+",
    cityLabel: "50+",
    languageLabel: "9+",
    doctorLabel: "5k+",
  });

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

  // Live platform stats
  useEffect(() => {
    fetch("/api/public/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { data?: { hospitalLabel: string; cityLabel: string; languageLabel: string; doctorLabel: string } } | null) => {
        if (d?.data) setStats(d.data);
      })
      .catch(() => {});
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
            <Link href="/diagnostics">Diagnostics</Link>
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

        {/* ── Text block — narrow, always centered ── */}
        <div className={styles.heroInner}>
          <span className={styles.heroBadge}>{t("home.heroLabel")}</span>

          <h1 id="hero-title" className={styles.heroTitle}>
            {t("home.heroTitle").split(".")[0]}.<br /><em>We&apos;ll find the right care.</em>
          </h1>

          <p className={styles.heroSubtitle}>
            {t("home.heroSubtitle")}
          </p>

          {/* ── Mobile: HealthAssistant (self-contained chat + results) ── */}
          <div className="md:hidden w-full" style={{ height: 520 }}>
            <HealthAssistant className="h-full shadow-lg" />
          </div>

          {/* ── Mobile: disclaimers + stats below HealthAssistant ── */}
          <div className="md:hidden">
            <div className={styles.heroDisclaimers}>
              <span>🛡️ DPDP Compliant</span>
              <span>✅ Verified Listings</span>
              <span>🆓 Free to Use</span>
              <span>💊 No Medication Advice</span>
            </div>
            <div className={styles.heroStats}>
              <article><strong>{stats.hospitalLabel}</strong><span>{t("home.statHospitals")}</span></article>
              <article><strong>{stats.cityLabel}</strong><span>{t("home.statCities")}</span></article>
              <article><strong>{stats.languageLabel}</strong><span>{t("home.statLanguages")}</span></article>
              <article><strong>{stats.doctorLabel}</strong><span>{t("home.statDoctors")}</span></article>
            </div>
          </div>
        </div>

        {/* ── Desktop: two-column — [chat | live results] ── */}
        <div className={`${styles.heroColumnsWrap} hidden md:block`}>
          <div
            className={styles.heroColumns}
            data-has-results={results.length > 0 || loading ? "true" : "false"}
          >
            {/* Left col: Chat input + Disclaimers + Stats */}
            <div className={styles.heroChatCol}>
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
                <article><strong>12k+</strong><span>{t("home.statHospitals")}</span></article>
                <article><strong>50+</strong><span>{t("home.statCities")}</span></article>
                <article><strong>9+</strong><span>{t("home.statLanguages")}</span></article>
                <article><strong>4.8★</strong><span>{t("home.statRating")}</span></article>
              </div>
            </div>

            {/* Right col: Live Results — sticky alongside chat */}
            <div className={styles.heroResultsCol}>
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
            <span>🌐 9 Languages</span>
            <span>🔒 AES-256 Encrypted</span>
          </div>
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
            <Link href="/diagnostics">Diagnostics</Link>
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
