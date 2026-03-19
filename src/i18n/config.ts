/**
 * i18n Configuration — P5 W4
 *
 * Strategy: Cookie-based locale (P5). URL prefix (/hi/*) deferred to P6.
 * Currently supported locales: en (default), hi (Hindi)
 * Feature gated by: i18n_hindi feature flag
 *
 * To activate next-intl integration:
 *   1. npm install next-intl
 *   2. Uncomment the middleware integration in src/middleware.ts
 *   3. Wrap layout.tsx with NextIntlClientProvider
 *   4. Enable `i18n_hindi` feature flag in admin
 *
 * Until next-intl is integrated, use the LanguageSwitcher component
 * for cookie-based locale switching (graceful degradation).
 */

export const LOCALES = ["en", "hi"] as const;
export type Locale = typeof LOCALES[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "eh_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  hi: "हिंदी",
};

/** Reads locale from cookie string (server-safe). */
export function getLocaleFromCookieStr(cookieStr: string): Locale {
  const match = cookieStr.match(new RegExp(`${LOCALE_COOKIE}=([^;]+)`));
  const val = match?.[1]?.trim();
  return LOCALES.includes(val as Locale) ? (val as Locale) : DEFAULT_LOCALE;
}

/** Returns translation messages for given locale. */
export async function getMessages(locale: Locale): Promise<Record<string, unknown>> {
  const messages = await import(`./${locale}.json`);
  return messages.default as Record<string, unknown>;
}
