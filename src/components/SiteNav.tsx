"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

import { useTranslations } from "@/i18n/LocaleContext";
import { LOCALES } from "@/i18n/translations";

/**
 * SiteNav — dark fixed top nav, visually matching the home page header.
 * Renders on all pages except /admin, /portal, and / (home has its own nav).
 */
export function SiteNav() {
  const pathname = usePathname();
  const { t, locale, setLocale } = useTranslations();
  const [langOpen, setLangOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/v1/patients/me", { credentials: "include" })
      .then((r) => setIsLoggedIn(r.ok))
      .catch(() => setIsLoggedIn(false));
  }, []);

  if (pathname.startsWith("/admin") || pathname.startsWith("/portal") || pathname === "/") return null;

  const currentLocale = LOCALES.find((l) => l.code === locale);

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "62px",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        background: "rgba(4, 13, 26, 0.93)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid rgba(255,255,255,0.09)",
      }}
    >
      <div
        style={{
          width: "min(1200px, 100%)",
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            color: "#fff",
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
              fontSize: "19px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#fff",
            }}
          >
            Easy<span style={{ color: "#6ee8a0" }}>Heals</span>
          </strong>
        </Link>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Nav links — hidden on mobile (<640px) via className */}
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
                  color: active ? "#fff" : "rgba(255,255,255,0.68)",
                  textDecoration: "none",
                  padding: "6px 10px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: active ? 700 : 400,
                  background: active ? "rgba(255,255,255,0.08)" : "transparent",
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Language picker — hidden on mobile */}
        <div className="sitenav-lang" style={{ position: "relative" }}>
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
            aria-label={t("nav.changeLanguage")}
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
        {isLoggedIn === null ? null : isLoggedIn ? (
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            My Dashboard
          </Link>
        ) : (
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
            Login
          </Link>
        )}

        {/* CTA */}
        <Link
          href="/register"
          style={{
            height: "34px",
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
          }}
        >
          List Hospital Free
        </Link>
      </div>
    </header>
  );
}
