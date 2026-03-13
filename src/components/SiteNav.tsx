"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useTranslations } from "@/i18n/LocaleContext";
import { LOCALES } from "@/i18n/translations";

export function SiteNav() {
  const pathname = usePathname();
  const { t, locale, setLocale } = useTranslations();
  const [langOpen, setLangOpen] = useState(false);

  if (pathname.startsWith("/admin") || pathname.startsWith("/portal") || pathname === "/") return null;

  const currentLocale = LOCALES.find((l) => l.code === locale);

  return (
    <header className="site-header">
      <Link href="/" className="brand-link" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.45rem" }}>
        <Image src="/logo.jpg" alt="EasyHeals" width={32} height={32} style={{ borderRadius: "8px", objectFit: "contain" }} />
        <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--primary)", letterSpacing: "-0.01em" }}>
          EasyHeals
        </span>
      </Link>

      <nav className="top-nav">
        <Link href="/hospitals">{t("nav.hospitals")}</Link>
        <Link href="/doctors">{t("nav.doctors")}</Link>
        <Link href="/treatments">{t("nav.treatments")}</Link>
        <Link href="/register" style={{ opacity: 0.72 }}>{t("nav.register")}</Link>
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {/* Language picker */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setLangOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "0.38rem 0.7rem",
              borderRadius: "999px",
              border: "1px solid rgba(0,184,150,0.3)",
              background: "rgba(0,184,150,0.08)",
              color: "var(--primary)",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            aria-label={t("nav.changeLanguage")}
          >
            <span>{currentLocale?.nativeLabel ?? "EN"}</span>
            <span style={{ fontSize: "0.6rem", opacity: 0.7 }}>▼</span>
          </button>

          {langOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                overflow: "hidden",
                minWidth: "140px",
                zIndex: 200,
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
                    background: loc.code === locale ? "rgba(0,184,150,0.08)" : "transparent",
                    border: "none",
                    borderBottom: "1px solid #f1f5f9",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    fontFamily: "inherit",
                    color: loc.code === locale ? "var(--primary)" : "#334155",
                    fontWeight: loc.code === locale ? 700 : 400,
                    textAlign: "left",
                  }}
                >
                  <span>{loc.nativeLabel}</span>
                  <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{loc.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Link href="/hospitals" className="cta-primary" style={{ fontSize: "0.85rem", padding: "0.48rem 0.85rem" }}>
          {t("nav.findCare")}
        </Link>
      </div>
    </header>
  );
}
