/**
 * treatment-content.ts
 * Central access point for all treatment and specialty rich content.
 * Source data: src/data/treatments-data.ts and src/data/specialties-data.ts
 * RN-note: Pure data, no DOM/window references. Safe for React Native.
 */

import type { Locale } from "@/i18n/translations";
import { TREATMENTS, TREATMENTS_BY_SLUG, type TreatmentData } from "@/data/treatments-data";
import { SPECIALTIES_BY_SLUG, SPECIALTY_TREATMENT_MAP, type SpecialtyData } from "@/data/specialties-data";

export type { TreatmentData, SpecialtyData };
export { TREATMENTS_BY_SLUG, SPECIALTIES_BY_SLUG, SPECIALTY_TREATMENT_MAP };

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

// Returns mapped treatments for a specialty slug as {slug, name} pairs for linking
export function getSpecialtyTreatments(specialtySlug: string): { slug: string; name: string }[] {
  return SPECIALTY_TREATMENT_MAP[specialtySlug] ?? [];
}

// ── Procedure name → slug lookup ──────────────────────────────────────────────
// Auto-built from all treatments (English name → slug).
// Used to make procedure checklist items clickable when a matching page exists.
const TREATMENT_NAME_TO_SLUG: Record<string, string> = Object.fromEntries(
  TREATMENTS.map((t) => [t.names.en.toLowerCase(), t.slug])
);

export function getProcedureSlug(procedureName: string): string | null {
  return TREATMENT_NAME_TO_SLUG[procedureName.toLowerCase()] ?? null;
}
