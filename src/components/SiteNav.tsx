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
 * Renders on all pages except /admin, /portal, and / (home has its own nav).
 */
export function SiteNav() {
  const pathname = usePathname();
  const { t, locale, setLocale } = useTranslations();
  const [langOpen, setLangOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

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
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

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

  if (pathname.startsWith("/admin") || pathname.startsWith("/portal") || pathname === "/") return null;

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
            src="/logo.jpg"
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

        {/* ── City picker ── */}
        <div style={{ position: "relative" }} data-city-picker>
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

        {/* ── Language picker ── */}
        <div style={{ position: "relative" }} data-lang-picker>
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

        {/* ── Auth link ── */}
        {isLoggedIn === null ? null : isLoggedIn ? (
          <Link
            href="/dashboard"
            style={{
              height: "36px",
              borderRadius: "999px",
              padding: "0 16px",
              display: "inline-flex",
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
            style={{
              height: "36px",
              borderRadius: "999px",
              padding: "0 16px",
              display: "inline-flex",
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

        {/* ── CTA ── */}
        <Link
          href="/register"
          style={{
            height: "36px",
            borderRadius: "999px",
            padding: "0 18px",
            display: "inline-flex",
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
      </div>
    </header>
  );
}
