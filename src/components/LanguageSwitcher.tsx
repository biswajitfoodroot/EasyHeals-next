"use client";

/**
 * LanguageSwitcher — P5 W4
 *
 * Cookie-based locale switcher. Sets `eh_locale` cookie and refreshes the page.
 * Feature-gated by `i18n_hindi` flag — renders nothing if flag is OFF.
 *
 * When next-intl is fully integrated (P6), this will trigger URL prefix routing.
 */

import { useState, useEffect } from "react";
import { LOCALE_COOKIE, LOCALE_LABELS, LOCALES, type Locale } from "@/i18n/config";

function getCurrentLocale(): Locale {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=([^;]+)`));
  const val = match?.[1]?.trim();
  return LOCALES.includes(val as Locale) ? (val as Locale) : "en";
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [flagEnabled, setFlagEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLocale(getCurrentLocale());

    // Check if i18n_hindi flag is enabled
    void fetch("/api/v1/config/flags/i18n_hindi")
      .then((r) => r.ok ? r.json() : { enabled: false })
      .then((j: { enabled?: boolean }) => setFlagEnabled(j.enabled ?? false))
      .catch(() => setFlagEnabled(false));
  }, []);

  function switchLocale(newLocale: Locale) {
    // Set cookie (1 year)
    document.cookie = `${LOCALE_COOKIE}=${newLocale}; path=/; max-age=${365 * 24 * 3600}; SameSite=Lax`;
    setLocale(newLocale);
    window.location.reload();
  }

  if (!mounted || !flagEnabled) return null;

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => switchLocale(l)}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
            locale === l
              ? "bg-slate-800 text-white"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          }`}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
