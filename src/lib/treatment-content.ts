/**
 * treatment-content.ts
 * Central access point for all treatment and specialty rich content.
 * Source data: src/data/treatments-data.ts and src/data/specialties-data.ts
 * RN-note: Pure data, no DOM/window references. Safe for React Native.
 */

import type { Locale } from "@/i18n/translations";
import { TREATMENTS_BY_SLUG, type TreatmentData } from "@/data/treatments-data";
import { SPECIALTIES_BY_SLUG, type SpecialtyData } from "@/data/specialties-data";

export type { TreatmentData, SpecialtyData };
export { TREATMENTS_BY_SLUG, SPECIALTIES_BY_SLUG };

// ── Treatment getters ─────────────────────────────────────────────────────────

export function getTreatmentData(slug: string): TreatmentData | null {
  return TREATMENTS_BY_SLUG[slug] ?? null;
}

export function getTreatmentName(slug: string, locale: Locale): string | null {
  const t = TREATMENTS_BY_SLUG[slug];
  if (!t) return null;
  return (t.names[locale] && t.names[locale] !== t.names.en) ? t.names[locale] : t.names.en;
}

export function getTreatmentAbout(slug: string, _locale: Locale): string | null {
  return TREATMENTS_BY_SLUG[slug]?.description ?? null;
}

export function getTreatmentProcedures(slug: string): string[] {
  return TREATMENTS_BY_SLUG[slug]?.relatedProcedures ?? [];
}

// ── Specialty getters ─────────────────────────────────────────────────────────

export function getSpecialtyData(slug: string): SpecialtyData | null {
  return SPECIALTIES_BY_SLUG[slug] ?? null;
}

export function getSpecialtyName(slug: string, locale: Locale): string | null {
  const s = SPECIALTIES_BY_SLUG[slug];
  if (!s) return null;
  return (s.names[locale] && s.names[locale] !== s.names.en) ? s.names[locale] : s.names.en;
}

export function getSpecialtyAbout(slug: string, _locale: Locale): string | null {
  return SPECIALTIES_BY_SLUG[slug]?.description ?? null;
}

// ── Combined getter (works for both treatment and specialty pages) ─────────────

export function getAnyName(slug: string, locale: Locale): string | null {
  return getTreatmentName(slug, locale) ?? getSpecialtyName(slug, locale);
}

export function getAnyAbout(slug: string, locale: Locale): string | null {
  return getTreatmentAbout(slug, locale) ?? getSpecialtyAbout(slug, locale);
}

export function getAnyProcedures(slug: string): string[] {
  return getTreatmentProcedures(slug);
}
