"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";

import { useTranslations } from "@/i18n/LocaleContext";
import { LOCALES } from "@/i18n/translations";

const CITY_GROUPS = [
  {
    region: "India",
    cities: ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Nagpur", "Kochi", "Indore", "Lucknow", "Visakhapatnam", "Surat", "Bhopal"],
  },
  {
    region: "South Asia",
    cities: ["Dhaka", "Colombo", "Kathmandu", "Karachi", "Lahore"],
  },
  {
    region: "Middle East",
    cities: ["Dubai", "Abu Dhabi", "Sharjah", "Muscat", "Riyadh", "Jeddah", "Kuwait City", "Doha"],
  },
];

/**
 * SiteNav — white fixed top nav, matching the homepage header.
 * Renders on all pages except /admin, /portal, /provider-management, /dashboard,
 * /unauthorized, and / (home has its own nav).
 */
export function SiteNav() {
  const pathname = usePathname();
  const { t, locale, setLocale } = useTranslations();
  const [langOpen, setLangOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Restore saved city from localStorage
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("eh_city") : null;
    if (saved) setCity(saved);
  }, []);

  useEffect(() => {
    fetch("/api/v1/patients/me", { credentials: "include" })
      .then((r) => setIsLoggedIn(r.ok))
      .catch(() => setIsLoggedIn(false));
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Element;
      if (!target.closest("[data-lang-picker]")) setLangOpen(false);
      if (!target.closest("[data-city-picker]")) { setCityOpen(false); setCitySearch(""); }
      if (!target.closest("[data-mobile-menu]")) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  function selectCity(name: string) {
    setCity(name);
    if (typeof window !== "undefined") localStorage.setItem("eh_city", name);
    setCityOpen(false);
    setCitySearch("");
    // Dispatch storage event so directory pages can react
    window.dispatchEvent(new StorageEvent("storage", { key: "eh_city", newValue: name }));
  }

  const filteredCityGroups = useMemo(() => {
    if (!citySearch.trim()) return CITY_GROUPS;
    const q = citySearch.toLowerCase();
    return CITY_GROUPS
      .map((g) => ({ ...g, cities: g.cities.filter((c) => c.toLowerCase().includes(q)) }))
      .filter((g) => g.cities.length > 0);
  }, [citySearch]);

  if (pathname.startsWith("/admin") || pathname.startsWith("/portal") || pathname.startsWith("/provider-management") || pathname.startsWith("/unauthorized") || pathname.startsWith("/dashboard") || pathname === "/") return null;

  const currentLocale = LOCALES.find((l) => l.code === locale);

  const pillStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "6px 12px",
    borderRadius: "999px",
    border: "1.5px solid #D0E4D8",
    background: "#fff",
    color: "#5A7367",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "border-color 0.15s",
    whiteSpace: "nowrap" as const,
  };

  const dropStyle: React.CSSProperties = {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    background: "#fff",
    border: "1px solid #D0E4D8",
    borderRadius: "14px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
    overflow: "hidden",
    zIndex: 300,
  };

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "64px",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        background: "rgba(255, 255, 255, 0.97)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        borderBottom: "1px solid rgba(26, 43, 35, 0.06)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          width: "min(1200px, 100%)",
          margin: "0 auto",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "9px",
            textDecoration: "none",
            color: "#1A2B23",
            flexShrink: 0,
          }}
        >
          <Image
            src="/logo.svg"
            alt="EasyHeals"
            width={34}
            height={34}
            style={{ borderRadius: "9px", objectFit: "contain" }}
          />
          <strong
            style={{
              fontFamily: "var(--font-bricolage), sans-serif",
              fontSize: "20px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#1A2B23",
            }}
          >
            Easy<b style={{ color: "#1B8A4A" }}>Heals</b>
          </strong>
        </Link>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Nav links — hidden on mobile via sitenav-links class */}
        <nav className="sitenav-links" style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          {[
            { href: "/treatments", label: t("nav.treatments") },
            { href: "/diagnostics", label: t("nav.diagnostics") },
            { href: "/hospitals", label: t("nav.hospitals") },
            { href: "/doctors", label: t("nav.doctors") },
          ].map(({ href, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  color: active ? "#1B8A4A" : "#5A7367",
                  textDecoration: "none",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontFamily: "var(--font-bricolage), sans-serif",
                  fontSize: "14px",
                  fontWeight: active ? 700 : 500,
                  background: active ? "rgba(27, 138, 74, 0.06)" : "transparent",
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* ── City picker — hidden on mobile ── */}
        <div className="sitenav-lang" style={{ position: "relative" }} data-city-picker>
          <button
            type="button"
            onClick={() => setCityOpen((v) => !v)}
            style={pillStyle}
            aria-label="Select city"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
            <span style={{ maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis" }}>
              {city ?? t("common.allCities")}
            </span>
            <span style={{ fontSize: "0.55rem", opacity: 0.7 }}>▼</span>
          </button>

          {cityOpen && (
            <div style={{ ...dropStyle, minWidth: "200px" }}>
              {/* Search */}
              <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(26,43,35,0.06)" }}>
                <input
                  autoFocus
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  placeholder="Search city..."
                  style={{
                    width: "100%",
                    border: "1px solid #D0E4D8",
                    borderRadius: "8px",
                    padding: "6px 10px",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    color: "#1A2B23",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              {/* All cities option */}
              <button
                type="button"
                onClick={() => selectCity("all")}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "9px 14px",
                  background: city === null || city === "all" ? "#E6F5EC" : "transparent",
                  border: "none",
                  borderBottom: "1px solid rgba(26,43,35,0.04)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  color: city === null || city === "all" ? "#1B8A4A" : "#5A7367",
                  fontWeight: city === null || city === "all" ? 700 : 400,
                  textAlign: "left",
                }}
              >
                {t("common.allCities")}
              </button>
              {/* City groups */}
              <div style={{ maxHeight: "260px", overflowY: "auto" }}>
                {filteredCityGroups.map((group) => (
                  <div key={group.region}>
                    <div style={{ padding: "6px 14px 3px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8FA39A" }}>
                      {group.region}
                    </div>
                    {group.cities.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => selectCity(c)}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "7px 14px",
                          background: city === c ? "#E6F5EC" : "transparent",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontFamily: "inherit",
                          color: city === c ? "#1B8A4A" : "#5A7367",
                          fontWeight: city === c ? 700 : 400,
                          textAlign: "left",
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Language picker — hidden on mobile ── */}
        <div className="sitenav-lang" style={{ position: "relative" }} data-lang-picker>
          <button
            type="button"
            onClick={() => setLangOpen((v) => !v)}
            style={pillStyle}
            aria-label={t("nav.changeLanguage")}
          >
            <span>{currentLocale?.nativeLabel ?? "EN"}</span>
            <span style={{ fontSize: "0.55rem", opacity: 0.7 }}>▼</span>
          </button>

          {langOpen && (
            <div style={{ ...dropStyle, minWidth: "150px" }}>
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
                    padding: "10px 14px",
                    background: loc.code === locale ? "#E6F5EC" : "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(26,43,35,0.06)",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    color: loc.code === locale ? "#1B8A4A" : "#5A7367",
                    fontWeight: loc.code === locale ? 700 : 400,
                    textAlign: "left",
                  }}
                >
                  <span>{loc.nativeLabel}</span>
                  <span style={{ fontSize: "0.7rem", color: "#8FA39A" }}>{loc.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Auth link — hidden on mobile ── */}
        {isLoggedIn === null ? null : isLoggedIn ? (
          <Link
            href="/dashboard"
            className="sitenav-lang"
            style={{
              height: "36px",
              borderRadius: "999px",
              padding: "0 16px",
              alignItems: "center",
              gap: "6px",
              color: "#1B8A4A",
              border: "1.5px solid rgba(27,138,74,0.4)",
              background: "rgba(27,138,74,0.06)",
              fontSize: "13px",
              fontWeight: 700,
              textDecoration: "none",
              flexShrink: 0,
              whiteSpace: "nowrap",
              fontFamily: "var(--font-bricolage), sans-serif",
            }}
          >
            My Dashboard
          </Link>
        ) : (
          <Link
            href="/login"
            className="sitenav-lang"
            style={{
              height: "36px",
              borderRadius: "999px",
              padding: "0 16px",
              alignItems: "center",
              color: "#1B8A4A",
              border: "1.5px solid #1B8A4A",
              background: "#fff",
              fontSize: "13px",
              fontWeight: 700,
              textDecoration: "none",
              flexShrink: 0,
              whiteSpace: "nowrap",
              fontFamily: "var(--font-bricolage), sans-serif",
            }}
          >
            Login
          </Link>
        )}

        {/* ── CTA — hidden on mobile and on patient dashboard pages ── */}
        {!pathname.startsWith("/dashboard") && (
          <Link
            href="/register"
            className="sitenav-lang"
            style={{
              height: "36px",
              borderRadius: "999px",
              padding: "0 18px",
              alignItems: "center",
              color: "#fff",
              background: "#1B8A4A",
              fontSize: "13px",
              fontWeight: 700,
              textDecoration: "none",
              flexShrink: 0,
              whiteSpace: "nowrap",
              fontFamily: "var(--font-bricolage), sans-serif",
            }}
          >
            List Hospital Free
          </Link>
        )}

        {/* ── Hamburger (mobile only, hidden >= 640px) ── */}
        <div data-mobile-menu style={{ position: "relative" }}>
          <button
            type="button"
            className="sitenav-burger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Open menu"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              border: "1.5px solid #D0E4D8",
              background: menuOpen ? "#E6F5EC" : "#fff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
              cursor: "pointer",
              flexShrink: 0,
              padding: 0,
            }}
          >
            <span style={{ display: "block", width: "16px", height: "2px", background: menuOpen ? "#1B8A4A" : "#5A7367", borderRadius: "2px", transition: "transform 0.2s", transform: menuOpen ? "translateY(7px) rotate(45deg)" : "none" }} />
            <span style={{ display: "block", width: "16px", height: "2px", background: menuOpen ? "#1B8A4A" : "#5A7367", borderRadius: "2px", opacity: menuOpen ? 0 : 1, transition: "opacity 0.2s" }} />
            <span style={{ display: "block", width: "16px", height: "2px", background: menuOpen ? "#1B8A4A" : "#5A7367", borderRadius: "2px", transition: "transform 0.2s", transform: menuOpen ? "translateY(-7px) rotate(-45deg)" : "none" }} />
          </button>

          {menuOpen && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              background: "#fff",
              border: "1px solid #D0E4D8",
              borderRadius: "16px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              minWidth: "220px",
              zIndex: 400,
              overflow: "hidden",
              padding: "8px",
            }}>
              {/* Auth row */}
              {isLoggedIn === false && (
                <Link
                  href="/login"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    textDecoration: "none",
                    color: "#1B8A4A",
                    border: "1.5px solid #1B8A4A",
                    fontWeight: 700,
                    fontSize: "14px",
                    marginBottom: "6px",
                    fontFamily: "var(--font-bricolage), sans-serif",
                  }}
                >
                  Login / Sign up
                </Link>
              )}
              {isLoggedIn && (
                <Link
                  href="/dashboard"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    textDecoration: "none",
                    color: "#1B8A4A",
                    background: "rgba(27,138,74,0.06)",
                    fontWeight: 700,
                    fontSize: "14px",
                    marginBottom: "6px",
                    fontFamily: "var(--font-bricolage), sans-serif",
                  }}
                >
                  👤 My Dashboard
                </Link>
              )}

              {/* City picker row */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 6px 8px" }}>
                <span style={{ fontSize: "11px", color: "#8FA39A", fontWeight: 600 }}>City:</span>
                <select
                  value={city ?? ""}
                  onChange={(e) => { selectCity(e.target.value); setMenuOpen(false); }}
                  style={{
                    flex: 1,
                    border: "1.5px solid #D0E4D8",
                    borderRadius: "8px",
                    padding: "5px 8px",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    color: "#1A2B23",
                    background: "#fff",
                  }}
                >
                  <option value="">{t("common.allCities")}</option>
                  {CITY_GROUPS.flatMap(g => g.cities).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div style={{ height: "1px", background: "#E8F0EB", margin: "2px 0 6px" }} />

              {[
                { href: "/treatments", label: t("nav.treatments") },
                { href: "/hospitals", label: t("nav.hospitals") },
                { href: "/doctors", label: t("nav.doctors") },
                { href: "/diagnostics", label: t("nav.diagnostics") },
              ].map(({ href, label }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "11px 14px",
                      borderRadius: "10px",
                      textDecoration: "none",
                      color: active ? "#1B8A4A" : "#1A2B23",
                      fontWeight: active ? 700 : 500,
                      fontSize: "15px",
                      background: active ? "#E6F5EC" : "transparent",
                      fontFamily: "var(--font-bricolage), sans-serif",
                    }}
                  >
                    {label}
                  </Link>
                );
              })}

              <div style={{ height: "1px", background: "#E8F0EB", margin: "6px 0" }} />

              {/* Language options */}
              <div style={{ padding: "4px 8px 2px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8FA39A" }}>Language</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "6px 6px 8px" }}>
                {LOCALES.slice(0, 6).map((loc) => (
                  <button
                    key={loc.code}
                    type="button"
                    onClick={() => { setLocale(loc.code); setMenuOpen(false); }}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "8px",
                      border: "1.5px solid",
                      borderColor: loc.code === locale ? "#1B8A4A" : "#D0E4D8",
                      background: loc.code === locale ? "#E6F5EC" : "#fff",
                      color: loc.code === locale ? "#1B8A4A" : "#5A7367",
                      fontSize: "12px",
                      fontWeight: loc.code === locale ? 700 : 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {loc.nativeLabel}
                  </button>
                ))}
              </div>

              <div style={{ height: "1px", background: "#E8F0EB", margin: "2px 0 6px" }} />

              {!pathname.startsWith("/dashboard") && (
                <Link
                  href="/register"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    textDecoration: "none",
                    color: "#fff",
                    background: "#1B8A4A",
                    fontWeight: 700,
                    fontSize: "14px",
                    fontFamily: "var(--font-bricolage), sans-serif",
                  }}
                >
                  List Hospital Free →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
