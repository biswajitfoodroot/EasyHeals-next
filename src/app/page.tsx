import type { Metadata } from "next";

import HomePage from "@/components/homepage/HomePage";
import { absoluteUrl, buildFAQJsonLd, buildOrganizationJsonLd, buildHreflangAlternates } from "@/lib/seo";

/* ── SEO Metadata ─────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "EasyHeals — AI-Powered Healthcare Discovery | Find Hospitals, Doctors & Treatments Across India",
  description:
    "EasyHeals is an AI-powered healthcare platform to find verified hospitals, specialist doctors, treatments, lab tests and appointments across India. Search in Hindi, Tamil, Marathi, Bengali or English. Free for patients. Supported by IIM Lucknow, IIT Mandi & IIHMR.",
  keywords: [
    "hospital near me",
    "doctor appointment",
    "healthcare India",
    "AI health search",
    "find doctor",
    "best hospital Pune",
    "best hospital Mumbai",
    "best hospital Bangalore",
    "specialist doctor India",
    "lab test booking",
    "treatment cost India",
    "EasyHeals",
    "health check up",
    "cardiology",
    "orthopaedics",
    "neurology",
    "multilingual healthcare",
    "Hindi doctor search",
    "free hospital listing",
    "appointment management system",
    "OPD token system",
    "DPDP compliant health platform",
  ],
  alternates: {
    canonical: "/",
    languages: buildHreflangAlternates("/"),
  },
  openGraph: {
    title: "EasyHeals — AI Healthcare Discovery Platform",
    description:
      "Find the right hospitals, doctors, treatments and lab tests across India with multilingual AI search. Free for patients. Supported by IIM Lucknow & IIT Mandi.",
    url: absoluteUrl("/"),
    siteName: "EasyHeals",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: absoluteUrl("/logo.jpg"),
        width: 512,
        height: 512,
        alt: "EasyHeals Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EasyHeals — AI Healthcare Discovery",
    description:
      "Find hospitals, doctors, treatments across India. Multilingual AI search. Free for patients.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large" as const,
      "max-snippet": -1,
    },
  },
  other: {
    // Signals for AI search engines (ChatGPT, Gemini, Perplexity)
    "ai-content-declaration": "This is a legitimate healthcare discovery platform, not AI-generated content.",
  },
};

/* ── JSON-LD Structured Data ─────────────────────────────────────────────── */

const homeFAQs = [
  {
    question: "What is EasyHeals?",
    answer:
      "EasyHeals is an AI-powered healthcare discovery platform that helps patients find the right hospitals, doctors, treatments, and lab tests across India. It supports multilingual search in Hindi, Tamil, Marathi, Bengali and English.",
  },
  {
    question: "Is EasyHeals free to use?",
    answer:
      "Yes, EasyHeals is completely free for patients. Hospitals and doctors can also list their practice and manage appointments at no cost.",
  },
  {
    question: "Does EasyHeals provide medical advice or prescriptions?",
    answer:
      "No. EasyHeals helps you understand symptoms and find the right specialist, but it does not prescribe medication or offer medical diagnosis. Always consult a qualified doctor for medical advice.",
  },
  {
    question: "How does EasyHeals AI search work?",
    answer:
      "The Gemini-powered AI understands symptoms or health queries in multiple Indian languages, maps them to the right medical specialties, and shows verified hospitals and doctors from the EasyHeals network.",
  },
  {
    question: "Can hospitals register on EasyHeals?",
    answer:
      "Yes. Hospitals and clinics can register for free through self-service OTP-verified onboarding. Once registered, they get access to appointment management, OPD token system, and patient communication tools.",
  },
  {
    question: "Is my health data safe on EasyHeals?",
    answer:
      "Absolutely. EasyHeals follows DPDP (Digital Personal Data Protection) guidelines. All personal health data is AES-256 encrypted, and access is consent-gated.",
  },
  {
    question: "Which cities does EasyHeals cover?",
    answer:
      "EasyHeals covers 50+ cities across India with 12,000+ verified private hospital listings. Major cities include Mumbai, Pune, Bangalore, Delhi NCR, Hyderabad, Chennai, Kolkata, and more.",
  },
  {
    question: "Who supports EasyHeals?",
    answer:
      "EasyHeals is supported by IIM Lucknow, IIT Mandi, and IIHMR. It is incubated at the Deshpande Foundation and MSMF (Mazumdar Shaw Medical Foundation).",
  },
];

const organizationJsonLd = {
  ...buildOrganizationJsonLd(),
  description:
    "EasyHeals is an AI-powered healthcare discovery platform helping patients find hospitals, doctors, treatments and lab tests across 50+ cities in India. Supported by IIM Lucknow, IIT Mandi and IIHMR.",
  foundingDate: "2024",
  areaServed: {
    "@type": "Country",
    name: "India",
  },
  knowsAbout: [
    "Healthcare",
    "Hospital Search",
    "Doctor Appointment",
    "AI Health Search",
    "Telemedicine",
    "Health Technology",
  ],
  award: [
    "Supported by IIM Lucknow",
    "Supported by IIT Mandi",
    "Supported by IIHMR",
    "Incubated at Deshpande Foundation",
    "Incubated at Mazumdar Shaw Medical Foundation (MSMF)",
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "EasyHeals",
  alternateName: ["Easy Heals", "EasyHeals India"],
  url: absoluteUrl("/"),
  description:
    "AI-powered healthcare discovery platform to find hospitals, doctors, treatments, and lab tests across India.",
  inLanguage: ["en-IN", "hi-IN", "mr-IN", "ta-IN", "bn-IN"],
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${absoluteUrl("/")}?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const medicalWebPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "MedicalWebPage",
  name: "EasyHeals — AI Healthcare Discovery",
  about: {
    "@type": "MedicalCondition",
    name: "General Health",
  },
  audience: {
    "@type": "PeopleAudience",
    healthCondition: {
      "@type": "MedicalCondition",
      name: "General Health",
    },
    suggestedGender: "unisex",
  },
  lastReviewed: new Date().toISOString().split("T")[0],
  specialty: [
    "Cardiology",
    "Orthopaedics",
    "Neurology",
    "Oncology",
    "Gastroenterology",
    "Dermatology",
    "Pulmonology",
    "Nephrology",
    "Urology",
    "Ophthalmology",
  ],
};

/* ── Page Component ──────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <>
      {/* JSON-LD: Organization */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      {/* JSON-LD: WebSite (enables Google Sitelinks Search Box) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      {/* JSON-LD: MedicalWebPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(medicalWebPageJsonLd) }}
      />
      {/* JSON-LD: FAQ (rich results in Google + AI search engines) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFAQJsonLd(homeFAQs)) }}
      />
      <HomePage />
    </>
  );
}
