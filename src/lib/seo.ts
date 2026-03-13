import type { Metadata } from "next";

import { env } from "@/lib/env";

export function absoluteUrl(path = "/") {
  return new URL(path, env.APP_BASE_URL).toString();
}

// ── JSON-LD Builders ──────────────────────────────────────────────────────────

export function buildHospitalJsonLd(h: {
  name: string;
  slug: string;
  city: string;
  state: string | null;
  addressLine1: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  rating: number;
  reviewCount: number;
  specialties: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: h.name,
    url: absoluteUrl(`/hospitals/${h.slug}`),
    description: h.description ?? undefined,
    telephone: h.phone ?? undefined,
    email: h.email ?? undefined,
    sameAs: h.website ? [h.website] : undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: h.addressLine1 ?? undefined,
      addressLocality: h.city,
      addressRegion: h.state ?? undefined,
      addressCountry: "IN",
    },
    aggregateRating:
      h.reviewCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: h.rating.toFixed(1),
            reviewCount: h.reviewCount,
            bestRating: "5",
            worstRating: "1",
          }
        : undefined,
    medicalSpecialty: h.specialties.length ? h.specialties : undefined,
  };
}

export function buildDoctorJsonLd(d: {
  fullName: string;
  slug: string;
  specialization: string | null;
  qualifications: string[];
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  rating: number;
  reviewCount: number;
  yearsOfExperience: number | null;
  consultationFee: number | null;
  feeMin: number | null;
  feeMax: number | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Physician",
    name: d.fullName,
    url: absoluteUrl(`/doctors/${d.slug}`),
    telephone: d.phone ?? undefined,
    email: d.email ?? undefined,
    medicalSpecialty: d.specialization ?? undefined,
    knowsAbout: d.qualifications.length ? d.qualifications : undefined,
    address: d.city
      ? {
          "@type": "PostalAddress",
          addressLocality: d.city,
          addressRegion: d.state ?? undefined,
          addressCountry: "IN",
        }
      : undefined,
    aggregateRating:
      d.reviewCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: d.rating.toFixed(1),
            reviewCount: d.reviewCount,
            bestRating: "5",
            worstRating: "1",
          }
        : undefined,
    priceRange:
      d.feeMin || d.feeMax
        ? `₹${d.feeMin ?? d.feeMax} – ₹${d.feeMax ?? d.feeMin}`
        : d.consultationFee
          ? `₹${d.consultationFee}`
          : undefined,
  };
}

export function buildTreatmentJsonLd(t: {
  slug: string;
  title: string;
  description: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalProcedure",
    name: t.title,
    url: absoluteUrl(`/treatments/${t.slug}`),
    description: t.description ?? undefined,
  };
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildMetadata(input: {
  title: string;
  description: string;
  path?: string;
}): Metadata {
  const canonicalPath = input.path ?? "/";

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url: absoluteUrl(canonicalPath),
      siteName: "EasyHeals Next",
      locale: "en_IN",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
    },
  };
}
