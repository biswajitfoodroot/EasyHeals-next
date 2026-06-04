"use client";

import { useMemo, useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useTranslations } from "@/i18n/LocaleContext";
import { LOCALES } from "@/i18n/translations";
import { ContributeModal } from "@/components/contribute/ContributeModal";
import { RegistrationModal } from "@/components/registration/RegistrationModal";
import styles from "@/components/homepage/homepage.module.css";

/* ── Types ── */
type HospitalCard = {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string | null;
  specialties: string[];
  rating: number;
  reviewCount: number;
  verified: boolean;
  networkTierCode: string | null;
};

type HomePageProps = {
  topHospitals: HospitalCard[];
};

/* ── City picker data ── */
const CITY_GROUPS = [
  { region: "India", cities: ["Mumbai","Delhi","Bengaluru","Chennai","Hyderabad","Kolkata","Pune","Ahmedabad","Jaipur","Nagpur","Kochi","Indore","Lucknow","Visakhapatnam","Surat","Bhopal"] },
  { region: "South Asia", cities: ["Dhaka","Chittagong","Colombo","Kathmandu","Karachi","Lahore","Yangon","Thimphu","Kabul"] },
  { region: "Middle East", cities: ["Dubai","Abu Dhabi","Sharjah","Muscat","Salalah","Riyadh","Jeddah","Kuwait City","Doha","Manama"] },
  { region: "Africa", cities: ["Nairobi","Lagos","Johannesburg","Cairo","Addis Ababa"] },
];

/* ── How it works steps ── */
const HOW_STEPS = [
  { num: "1", icon: "💬", title: "Describe your concern", sub: "Type symptoms, doctor name, or hospital. Use voice in 10 languages." },
  { num: "2", icon: "🤖", title: "AI finds the right care", sub: "Gemini AI matches you to verified hospitals and specialist doctors near you." },
  { num: "3", icon: "📅", title: "Book your appointment", sub: "One tap to book in-person, audio, or video consultation. Free for patients." },
];

export default function HomePage({ topHospitals }: HomePageProps) {
  const router = useRouter();
  const { locale, setLocale, t } = useTranslations();
  const [langOpen, setLangOpen] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [openFQIndex, setOpenFQIndex] = useState<number | null>(null);
  const [personBarDismissed, setPersonBarDismissed] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [city, setCity] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({ hospitalLabel: "12k+", cityLabel: "50+", languageLabel: "9+", doctorLabel: "5k+" });

  const currentLocale = LOCALES.find((l) => l.code === locale);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ── Outside click closes dropdowns ── */
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Element;
      if (!target.closest("[data-city-picker]")) setCityPickerOpen(false);
      if (!target.closest("[data-lang-picker]")) setLangOpen(false);
      if (!target.closest("[data-mobile-menu]")) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  /* ── Auth ── */
  useEffect(() => {
    fetch("/api/v1/patients/me", { credentials: "include" })
      .then((r) => setIsLoggedIn(r.ok))
      .catch(() => setIsLoggedIn(false));
  }, []);

  /* ── Platform stats ── */
  useEffect(() => {
    fetch("/api/public/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { data?: { hospitalLabel: string; cityLabel: string; languageLabel: string; doctorLabel: string } } | null) => {
        if (d?.data) setStats(d.data);
      })
      .catch(() => {});
  }, []);

  /* ── Personalization bar dismissal ── */
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPersonBarDismissed(localStorage.getItem("eh_pbar_v2") === "1");
    }
  }, []);

  function dismissPersonBar() {
    setPersonBarDismissed(true);
    localStorage.setItem("eh_pbar_v2", "1");
  }

  /* ── City detection ── */
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("eh_city") : null;
    if (saved) { setCity(saved); return; }
    fetch("/api/v1/location")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { city?: string } | null) => { if (data?.city) setCity(data.city); })
      .catch(() => {});
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          fetch(`/api/v1/location?lat=${latitude.toFixed(4)}&lng=${longitude.toFixed(4)}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { city?: string } | null) => { if (data?.city) { setCity(data.city); localStorage.setItem("eh_city", data.city); } })
            .catch(() => {});
        }, () => {}, { timeout: 5000, maximumAge: 300_000 },
      );
    }
  }, []);

  const filteredCityGroups = useMemo(() => {
    if (!citySearch.trim()) return CITY_GROUPS;
    const q = citySearch.toLowerCase();
    return CITY_GROUPS
      .map((g) => ({ ...g, cities: g.cities.filter((c) => c.toLowerCase().includes(q)) }))
      .filter((g) => g.cities.length > 0);
  }, [citySearch]);

  function selectCity(name: string) {
    setCity(name);
    localStorage.setItem("eh_city", name);
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
          .then((data: { city?: string } | null) => { if (data?.city) selectCity(data.city); setGpsLoading(false); })
          .catch(() => setGpsLoading(false));
      }, () => setGpsLoading(false), { timeout: 8000, maximumAge: 60_000 },
    );
  }

  /* ── Search submit ── */
  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    router.push(q ? `/ask?q=${encodeURIComponent(q)}` : "/ask");
  }

  /* ── Popular hospitals filtered by city ── */
  const popularHospitals = useMemo(() => {
    if (!city) return topHospitals.slice(0, 8);
    const byCity = topHospitals.filter((h) => h.city.toLowerCase() === city.toLowerCase());
    return byCity.length >= 3 ? byCity.slice(0, 8) : topHospitals.slice(0, 8);
  }, [topHospitals, city]);

  return (
    <main className={styles.page}>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          NAV BAR
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className={styles.topNav} role="banner">
        <div className={styles.topNavInner}>
          <Link href="/" className={styles.brand} aria-label="EasyHeals — Home">
            <Image src="/logo.jpg" alt="EasyHeals logo" width={36} height={36} style={{ borderRadius: "10px", objectFit: "contain" }} />
            <strong>Easy<b>Heals</b></strong>
          </Link>

          <nav className={styles.topNavLinks} aria-label="Main navigation">
            <Link href="/treatments">{t("nav.treatments")}</Link>
            <Link href="/diagnostics">{t("nav.diagnostics")}</Link>
            <Link href="/hospitals">{t("nav.hospitals")}</Link>
            <Link href="/doctors">{t("nav.doctors")}</Link>
          </nav>

          {/* City picker */}
          <div className={styles.navLang} style={{ position: "relative" }} data-city-picker>
            <button type="button" className={styles.navLangBtn} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
              onClick={() => { setCityPickerOpen((v) => !v); setCitySearch(""); }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="11" r="3"/><path d="M12 2a9 9 0 00-9 9c0 5.25 9 13 9 13s9-7.75 9-13a9 9 0 00-9-9z"/>
              </svg>
              <span style={{ maxWidth: "72px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.8rem" }}>{city ?? t("homepage.setCity")}</span>
              <span style={{ fontSize: "0.55rem", opacity: 0.6 }}>▼</span>
            </button>
            {cityPickerOpen && (
              <div className={styles.langDrop} style={{ width: "240px", maxHeight: "360px", overflowY: "auto", padding: "0.5rem" }}>
                <button type="button" style={{ width:"100%",textAlign:"left",padding:"0.45rem 0.6rem",borderRadius:"0.5rem",background:"rgba(27,138,74,0.07)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.4rem",fontSize:"0.82rem",color:"#136836",marginBottom:"0.4rem" }} onClick={detectGpsCity} disabled={gpsLoading}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="9" strokeDasharray="2 3"/></svg>
                  {gpsLoading ? t("homepage.detecting") : t("homepage.useMyLocation")}
                </button>
                <input type="text" placeholder={t("homepage.searchCity")} value={citySearch} onChange={(e) => setCitySearch(e.target.value)}
                  style={{ width:"100%",padding:"0.35rem 0.5rem",borderRadius:"0.4rem",border:"1px solid #d0e4d8",fontSize:"0.8rem",outline:"none",marginBottom:"0.5rem",boxSizing:"border-box" }} autoFocus />
                {filteredCityGroups.map((group) => (
                  <div key={group.region}>
                    <p style={{ margin:"0.3rem 0 0.2rem",fontSize:"0.68rem",fontWeight:600,color:"#8FA39A",textTransform:"uppercase",letterSpacing:"0.05em",padding:"0 0.4rem" }}>{group.region}</p>
                    <div style={{ display:"flex",flexWrap:"wrap",gap:"0.25rem",marginBottom:"0.3rem" }}>
                      {group.cities.map((c) => (
                        <button key={c} type="button" style={{ padding:"0.22rem 0.5rem",borderRadius:"999px",border:"1px solid #d0e4d8",background:city===c?"#1B8A4A":"#fff",color:city===c?"#fff":"#0d1f15",fontSize:"0.75rem",cursor:"pointer",fontFamily:"inherit" }} onClick={() => selectCity(c)}>{c}</button>
                      ))}
                    </div>
                  </div>
                ))}
                {filteredCityGroups.length === 0 && <p style={{ fontSize:"0.78rem",color:"#8FA39A",textAlign:"center",padding:"0.5rem" }}>{t("homepage.noCitiesFound")}</p>}
              </div>
            )}
          </div>

          {/* Language picker */}
          <div className={styles.navLang} style={{ position: "relative" }} data-lang-picker>
            <button type="button" className={styles.navLangBtn} onClick={() => setLangOpen((v) => !v)}>
              <span>{currentLocale?.nativeLabel ?? "EN"}</span>
              <span style={{ fontSize: "0.55rem", opacity: 0.6 }}>▼</span>
            </button>
            {langOpen && (
              <div className={styles.langDrop}>
                {LOCALES.map((loc) => (
                  <button key={loc.code} type="button" className={loc.code === locale ? styles.langDropActive : ""} onClick={() => { setLocale(loc.code); setLangOpen(false); }}>
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
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              {t("home.myDashboard")}
            </Link>
          ) : isLoggedIn === false ? (
            <Link href="/login" className={styles.navLoginBtn}>{t("home.login")}</Link>
          ) : null}

          <button type="button" className={styles.navCta} onClick={() => setRegistrationOpen(true)}>{t("home.listHospitalFree")}</button>

          {/* Burger */}
          <button type="button" className={styles.navBurger} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} data-mobile-menu onClick={() => setMenuOpen((v) => !v)}>
            {menuOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            )}
          </button>
        </div>

        {menuOpen && (
          <nav className={styles.mobileMenu} data-mobile-menu aria-label="Mobile navigation">
            <Link href="/treatments" onClick={() => setMenuOpen(false)}>💊 {t("nav.treatments")}</Link>
            <Link href="/diagnostics" onClick={() => setMenuOpen(false)}>🔬 {t("nav.diagnostics")}</Link>
            <Link href="/hospitals" onClick={() => setMenuOpen(false)}>🏥 {t("nav.hospitals")}</Link>
            <Link href="/doctors" onClick={() => setMenuOpen(false)}>👨‍⚕️ {t("nav.doctors")}</Link>
            <div className={styles.mobileMenuDivider} />
            {isLoggedIn === true ? (
              <Link href="/dashboard" onClick={() => setMenuOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {t("home.myDashboard")}
              </Link>
            ) : (
              <Link href="/login" onClick={() => setMenuOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                {t("home.login")}
              </Link>
            )}
            <button type="button" className={styles.mobileMenuCta} onClick={() => { setMenuOpen(false); setRegistrationOpen(true); }}>{t("home.listHospitalFree")}</button>
          </nav>
        )}
      </header>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          HERO — heading + prominent search bar
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className={styles.heroSection} aria-labelledby="hero-title">

        <div className={styles.heroInner}>
          <span className={styles.heroBadge}>✦ AI-Powered Healthcare Discovery</span>
          <h1 id="hero-title" className={styles.heroTitle}>
            Find the right care. <em>Fast.</em>
          </h1>
          <p className={styles.heroSubtitle}>
            AI-powered · Multilingual · Free for patients
          </p>

          {/* ── Prominent Search Bar — the primary CTA ── */}
          <div className={styles.heroSearchSection}>
            <p className={styles.heroSearchLabel}>
              <span>🤖</span> Ask about symptoms, hospitals or doctors
            </p>
          <form className={styles.heroSearchForm} onSubmit={handleSearchSubmit} role="search">
            <div className={styles.heroSearchBar} onClick={() => searchInputRef.current?.focus()}>
              <svg className={styles.heroSearchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Describe symptoms or search…"
                className={styles.heroSearchInput}
                aria-label="Search hospitals, doctors or describe symptoms"
              />
              {/* Mobile: AI badge + mic instead of full button */}
              <span className={styles.heroSearchAiBadgeMobile} aria-hidden="true">AI</span>
              <span className={styles.heroSearchMicMobile} aria-hidden="true">🎤</span>
              {/* Desktop: divider + "Ask AI →" button */}
              <span className={styles.heroSearchDivider} aria-hidden="true" />
              <button type="submit" className={styles.heroSearchBtn} aria-label="Ask AI">
                Ask AI →
              </button>
            </div>
            <p className={styles.heroSearchHint}>
              Try: <button type="button" onClick={() => router.push("/ask?q=chest+pain+cardiologist")}>chest pain</button> ·{" "}
              <button type="button" onClick={() => router.push("/ask?q=knee+replacement+hospital")}>knee replacement</button> ·{" "}
              <button type="button" onClick={() => router.push("/ask?q=Apollo+Hospitals+Pune")}>Apollo Hospitals</button>
            </p>
          </form>
          </div>

          {/* ── Quick browse chips ── */}
          <div className={styles.heroBrowseChips}>
            {([
              { href: "/ask?q=book+appointment", icon: "📅", full: "Book Appointment", short: "Book" },
              { href: "/hospitals",              icon: "🏥", full: "Browse Hospitals",  short: "Hospitals" },
              { href: "/doctors",                icon: "👨‍⚕️", full: "Find Doctors",     short: "Doctors" },
              { href: "/diagnostics",            icon: "🔬", full: "Lab Tests",         short: "Lab Tests" },
              { href: "/treatments",             icon: "💊", full: "Treatments",        short: "Treatments" },
            ] as { href: string; icon: string; full: string; short: string }[]).map((chip) => (
              <Link key={chip.href} href={chip.href} className={styles.heroBrowseChip}>
                <span className={styles.chipIcon}>{chip.icon}</span>
                <span className={styles.chipLabelFull}>{chip.full}</span>
                <span className={styles.chipLabelShort}>{chip.short}</span>
              </Link>
            ))}
          </div>

          {/* ── Stats strip ── */}
          <div className={styles.heroStats}>
            <article><strong>{stats.hospitalLabel}</strong><span>{t("home.statHospitals")}</span></article>
            <article><strong>{stats.cityLabel}</strong><span>{t("home.statCities")}</span></article>
            <article><strong>{stats.languageLabel}</strong><span>{t("home.statLanguages")}</span></article>
            <article><strong>{stats.doctorLabel}</strong><span>{t("home.statDoctors")}</span></article>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          PERSONALIZATION BAR — desktop only
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {!personBarDismissed && (
        <div className={`${styles.personBar} hidden md:block`}>
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
            <Link href={isLoggedIn ? "/dashboard" : "/login"} className={styles.personBarBtn}>
              {isLoggedIn ? t("personBar.goToDashboard") : t("personBar.signInFree")}
            </Link>
            <button type="button" className={styles.personBarDismiss} onClick={dismissPersonBar} aria-label={t("personBar.dismiss")}>✕</button>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          POPULAR HOSPITALS
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {popularHospitals.length > 0 && (
        <section className={styles.popularSection} aria-label="Popular hospitals">
          <div className={styles.popularInner}>
            <div className={styles.popularHeader}>
              <h2 className={styles.popularTitle}>
                Popular in {city ?? "India"}
              </h2>
              <Link href={city ? `/hospitals?city=${encodeURIComponent(city)}` : "/hospitals"} className={styles.popularSeeAll}>
                See all →
              </Link>
            </div>

            <div className={styles.popularScroll}>
              {popularHospitals.map((h) => {
                const effectiveRating = h.reviewCount === 0 ? 4.0 : h.rating;
                const tierBadge = h.networkTierCode === "premium"
                  ? { label: "Premium Partner", color: "#7C3AED", bg: "#F5EAFF" }
                  : h.networkTierCode
                  ? { label: "Network Partner", color: "#0369A1", bg: "#E0F2FE" }
                  : null;

                return (
                  <div key={h.id} className={styles.popularCard}>
                    {/* Top row: emoji avatar + name / city / rating */}
                    <div className={styles.popularCardTop}>
                      <div className={styles.popularCardAvatar}>🏥</div>
                      <div className={styles.popularCardInfo}>
                        <p className={styles.popularCardName}>{h.name}</p>
                        <p className={styles.popularCardCity}>
                          {h.city}{h.state ? `, ${h.state}` : ""}
                        </p>
                        <p className={styles.popularCardRating}>★ {effectiveRating.toFixed(1)}</p>
                      </div>
                    </div>

                    {/* Badges row */}
                    <div className={styles.popularCardBadges}>
                      {h.verified && (
                        <span className={styles.popularCardBadgeVerified}>✅ Verified</span>
                      )}
                      {tierBadge && (
                        <span
                          className={styles.popularCardBadgeNetwork}
                          style={{ color: tierBadge.color, background: tierBadge.bg }}
                        >
                          ✦ {tierBadge.label}
                        </span>
                      )}
                    </div>

                    {/* Specialty tags */}
                    {h.specialties.length > 0 && (
                      <div className={styles.popularCardTags}>
                        {h.specialties.slice(0, 3).map((s) => (
                          <span key={s}>{s}</span>
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className={styles.popularCardBtns}>
                      <Link href={`/hospitals/${h.slug}`} className={styles.popularCardBtnView}>
                        View
                      </Link>
                      <Link href={`/hospitals/${h.slug}?book=1`} className={styles.popularCardBtnBook}>
                        Book →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          HOW IT WORKS
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className={styles.howSection} aria-labelledby="how-title">
        <div className={styles.howInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Simple · Fast · Free</span>
            <h2 id="how-title" className={styles.sectionTitle}>How EasyHeals works</h2>
          </div>
          <div className={styles.howGrid}>
            {HOW_STEPS.map((step) => (
              <div key={step.num} className={styles.howStep}>
                <div className={styles.howStepNum}>{step.num}</div>
                <div className={styles.howStepIcon}>{step.icon}</div>
                <h3 className={styles.howStepTitle}>{step.title}</h3>
                <p className={styles.howStepSub}>{step.sub}</p>
              </div>
            ))}
          </div>

          {/* CTA below steps */}
          <div style={{ textAlign: "center", marginTop: "28px" }}>
            <Link href="/ask" className={styles.howCta}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              Ask AI Health Assistant
            </Link>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          TRUST — mobile: 1-line strip · desktop: full badge cards
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className={styles.trustSection} aria-label="Institutional support">
        <div className={styles.trustInner}>
          <h2 className={styles.trustLabel}>Supported by &amp; Incubated at</h2>

          {/* All screens: logo + subtitle badges, 1-col on mobile → 5-col on desktop */}
          <div className={styles.trustLogos}>
            <div className={styles.trustBadge}><img src="/logos/iim-lucknow.svg" alt="IIM Lucknow" className={styles.trustLogo} /><div className={styles.trustBadgeText}><strong>IIM Lucknow</strong><small>{t("trust.iimLucknowSub")}</small></div></div>
            <div className={styles.trustBadge}><img src="/logos/iit-mandi.svg" alt="IIT Mandi" className={styles.trustLogo} /><div className={styles.trustBadgeText}><strong>IIT Mandi</strong><small>{t("trust.iitMandiSub")}</small></div></div>
            <div className={styles.trustBadge}><img src="/logos/iihmr.svg" alt="IIHMR" className={styles.trustLogo} /><div className={styles.trustBadgeText}><strong>IIHMR</strong><small>{t("trust.iihmrSub")}</small></div></div>
            <div className={styles.trustBadge}><img src="/logos/deshpande.svg" alt="Deshpande Foundation" className={styles.trustLogo} /><div className={styles.trustBadgeText}><strong>Deshpande Foundation</strong><small>{t("trust.deshpandeSub")}</small></div></div>
            <div className={styles.trustBadge}><img src="/logos/msmf.svg" alt="MSMF" className={styles.trustLogo} /><div className={styles.trustBadgeText}><strong>MSMF</strong><small>{t("trust.msmfSub")}</small></div></div>
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
          PROVIDER CTA
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
              <button type="button" className={styles.providerPrimary} onClick={() => setRegistrationOpen(true)}>{t("home.startRegistration")}</button>
            </div>
          </div>
          <div className={styles.providerVisual}>
            <h3>{t("provider.visualHeading")}</h3>
            <div className={styles.providerVisualGrid}>
              <div className={styles.providerVisualItem}><span>📅</span><strong>{t("provider.appointments")}</strong><p>{t("provider.appointmentsSub")}</p></div>
              <div className={styles.providerVisualItem}><span>🎫</span><strong>{t("provider.opdTokens")}</strong><p>{t("provider.opdTokensSub")}</p></div>
              <div className={styles.providerVisualItem}><span>📱</span><strong>{t("provider.whatsapp")}</strong><p>{t("provider.whatsappSub")}</p></div>
              <div className={styles.providerVisualItem}><span>🤖</span><strong>{t("provider.aiSummaries")}</strong><p>{t("provider.aiSummariesSub")}</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          FAQ
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className={styles.faqSection} aria-labelledby="faq-title">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>{t("faq.sectionLabel")}</span>
          <h2 id="faq-title" className={styles.sectionTitle}>{t("faq.sectionTitle")}</h2>
        </div>
        <div className={styles.faqGrid}>
          {[1,2,3,4,5,6].map((n, i) => {
            const q = t(`faq.q${n}`);
            const a = t(`faq.a${n}`);
            return (
              <div key={q} className={styles.faqItem}>
                <button type="button" className={styles.faqQuestion} onClick={() => setOpenFQIndex(openFQIndex === i ? null : i)} aria-expanded={openFQIndex === i}>
                  {q}
                  <span style={{ fontSize: 18, transform: openFQIndex === i ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
                </button>
                {openFQIndex === i && <p className={styles.faqAnswer}>{a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Modals ── */}
      <RegistrationModal isOpen={registrationOpen} onClose={() => setRegistrationOpen(false)} />
      <ContributeModal isOpen={false} target={null} onClose={() => {}} />
    </main>
  );
}
