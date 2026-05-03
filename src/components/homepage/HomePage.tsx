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
            <Link href="/diagnostics">{t("nav.diagnostics")}</Link>
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
              aria-label={t("homepage.selectCity")}
              title={t("homepage.selectYourCity")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="11" r="3" /><path d="M12 2a9 9 0 00-9 9c0 5.25 9 13 9 13s9-7.75 9-13a9 9 0 00-9-9z" />
              </svg>
              <span style={{ maxWidth: "72px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.8rem" }}>
                {city ?? t("homepage.setCity")}
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
                  {gpsLoading ? t("homepage.detecting") : t("homepage.useMyLocation")}
                </button>

                {/* Search input */}
                <input
                  type="text"
                  placeholder={t("homepage.searchCity")}
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
                  <p style={{ fontSize: "0.78rem", color: "#8FA39A", textAlign: "center", padding: "0.5rem" }}>{t("homepage.noCitiesFound")}</p>
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
            {t("home.heroTitle").split(".")[0]}.<br /><em>{t("homepage.heroTitleSecond")}</em>
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
              <span>🛡️ {t("disclaimer.dpdpCompliant")}</span>
              <span>✅ {t("disclaimer.verifiedListings")}</span>
              <span>🆓 {t("disclaimer.freeToUse")}</span>
              <span>💊 {t("disclaimer.noMedicationAdvice")}</span>
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
                <span>🛡️ {t("disclaimer.dpdpCompliant")}</span>
                <span>✅ {t("disclaimer.verifiedListings")}</span>
                <span>🆓 {t("disclaimer.freeToUse")}</span>
                <span>💊 {t("disclaimer.noMedicationAdvice")}</span>
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
              <strong>{isLoggedIn ? t("personBar.welcomeBack") : t("personBar.unlockTitle")}</strong>
              <p>{isLoggedIn ? t("personBar.welcomeBackSub") : t("personBar.unlockSub")}</p>
              <div className={styles.personBarFeatures}>
                <span>📅 {t("personBar.appointments")}</span>
                <span>📊 {t("personBar.healthTimeline")}</span>
                <span>🏆 {t("personBar.rewards")}</span>
                <span>🤖 {t("personBar.aiCoach")}</span>
              </div>
            </div>
            <Link href={isLoggedIn ? "/dashboard" : "/login"} className={styles.personBarBtn}>{isLoggedIn ? t("personBar.goToDashboard") : t("personBar.signInFree")}</Link>
            <button type="button" className={styles.personBarDismiss} onClick={dismissPersonBar} aria-label={t("personBar.dismiss")}>✕</button>
          </div>
        </div>
      )}


      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ⑤ TRUST & SUPPORT STRIP — Institutional backing
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className={styles.trustSection} aria-label="Institutional support and trust signals">
        <div className={styles.trustInner}>
          <p className={styles.trustLabel}>{t("trust.supportedBy")}</p>
          <div className={styles.trustLogos}>
            <div className={styles.trustBadge}>
              <img src="/logos/iim-lucknow.svg" alt="IIM Lucknow" className={styles.trustLogo} />
              <div className={styles.trustBadgeText}>
                <strong>IIM Lucknow</strong>
                <small>{t("trust.iimLucknowSub")}</small>
              </div>
            </div>
            <div className={styles.trustBadge}>
              <img src="/logos/iit-mandi.svg" alt="IIT Mandi" className={styles.trustLogo} />
              <div className={styles.trustBadgeText}>
                <strong>IIT Mandi</strong>
                <small>{t("trust.iitMandiSub")}</small>
              </div>
            </div>
            <div className={styles.trustBadge}>
              <img src="/logos/iihmr.svg" alt="IIHMR" className={styles.trustLogo} />
              <div className={styles.trustBadgeText}>
                <strong>IIHMR</strong>
                <small>{t("trust.iihmrSub")}</small>
              </div>
            </div>
          </div>

          <div className={styles.trustDivider} />

          <p className={styles.trustLabel}>{t("trust.incubatedAt")}</p>
          <div className={styles.trustLogos}>
            <div className={styles.trustBadge}>
              <img src="/logos/deshpande.svg" alt="Deshpande Foundation" className={styles.trustLogo} />
              <div className={styles.trustBadgeText}>
                <strong>Deshpande Foundation</strong>
                <small>{t("trust.deshpandeSub")}</small>
              </div>
            </div>
            <div className={styles.trustBadge}>
              <img src="/logos/msmf.svg" alt="Mazumdar Shaw Medical Foundation" className={styles.trustLogo} />
              <div className={styles.trustBadgeText}>
                <strong>MSMF</strong>
                <small>{t("trust.msmfSub")}</small>
              </div>
            </div>
          </div>

          <div className={styles.trustSignals}>
            <span>🛡️ {t("disclaimer.dpdpCompliant")}</span>
            <span>✅ {t("disclaimer.communityVerifiedListings")}</span>
            <span>🆓 {t("disclaimer.freeForPatients")}</span>
            <span>🌐 {t("disclaimer.nineLanguages")}</span>
            <span>🔒 {t("disclaimer.aes256Encrypted")}</span>
          </div>
        </div>
      </section>


      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ⑧ FOR DOCTORS & HOSPITALS — Free tools CTA
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className={styles.providerSection} aria-labelledby="provider-title">
        <div className={styles.providerInner}>
          <div className={styles.providerCopy}>
            <span className={styles.sectionLabel}>{t("provider.sectionLabel")}</span>
            <h2 id="provider-title">{t("home.listHospitalCta")}</h2>
            <p>{t("provider.description")}</p>

            <ul className={styles.providerFeatures}>
              <li>{t("provider.feature1")}</li>
              <li>{t("provider.feature2")}</li>
              <li>{t("provider.feature3")}</li>
              <li>{t("provider.feature4")}</li>
              <li>{t("provider.feature5")}</li>
              <li>{t("provider.feature6")}</li>
            </ul>

            <div className={styles.providerActions}>
              <button type="button" className={styles.providerPrimary} onClick={() => setRegistrationOpen(true)}>
                {t("home.startRegistration")}
              </button>
            </div>
          </div>

          <div className={styles.providerVisual}>
            <h3>{t("provider.visualHeading")}</h3>
            <div className={styles.providerVisualGrid}>
              <div className={styles.providerVisualItem}>
                <span>📅</span>
                <strong>{t("provider.appointments")}</strong>
                <p>{t("provider.appointmentsSub")}</p>
              </div>
              <div className={styles.providerVisualItem}>
                <span>🎫</span>
                <strong>{t("provider.opdTokens")}</strong>
                <p>{t("provider.opdTokensSub")}</p>
              </div>
              <div className={styles.providerVisualItem}>
                <span>📱</span>
                <strong>{t("provider.whatsapp")}</strong>
                <p>{t("provider.whatsappSub")}</p>
              </div>
              <div className={styles.providerVisualItem}>
                <span>🤖</span>
                <strong>{t("provider.aiSummaries")}</strong>
                <p>{t("provider.aiSummariesSub")}</p>
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
          <span className={styles.sectionLabel}>{t("faq.sectionLabel")}</span>
          <h2 id="faq-title" className={styles.sectionTitle}>{t("faq.sectionTitle")}</h2>
        </div>

        <div className={styles.faqGrid}>
          {[1, 2, 3, 4, 5, 6].map((n, i) => {
            const q = t(`faq.q${n}`);
            const a = t(`faq.a${n}`);
            return (
              <div key={q} className={styles.faqItem}>
                <button
                  type="button"
                  className={styles.faqQuestion}
                  onClick={() => setOpenFQIndex(openFQIndex === i ? null : i)}
                  aria-expanded={openFQIndex === i}
                >
                  {q}
                  <span style={{ fontSize: 18, transform: openFQIndex === i ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
                </button>
                {openFQIndex === i && <p className={styles.faqAnswer}>{a}</p>}
              </div>
            );
          })}
        </div>
      </section>



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
