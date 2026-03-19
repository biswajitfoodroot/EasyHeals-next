"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { dictionaries, getTranslation, type Dict, type Locale } from "@/i18n/translations";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string) => string;
  dict: Dict;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (path) => path,
  dict: dictionaries.en,
});

export function LocaleProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    // Persist to cookie (30-day expiry, SameSite lax, no httpOnly so JS can read it)
    document.cookie = `easyheals_locale=${next}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  }, []);

  const dict = useMemo(() => dictionaries[locale] ?? dictionaries.en, [locale]);

  const t = useCallback((path: string) => getTranslation(dict, path), [dict]);

  const value = useMemo(() => ({ locale, setLocale, t, dict }), [locale, setLocale, t, dict]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslations() {
  return useContext(LocaleContext);
}
