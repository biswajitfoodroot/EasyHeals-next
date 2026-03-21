import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  DM_Sans,
  DM_Serif_Display,
  Noto_Sans,
  Noto_Sans_Arabic,
  Noto_Sans_Bengali,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_Sinhala,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
} from "next/font/google";
import { cookies } from "next/headers";

import { LocaleProvider } from "@/i18n/LocaleContext";
import type { Locale } from "@/i18n/translations";
import { SiteNav } from "@/components/SiteNav";
import { MSG91HelloChat } from "@/components/MSG91HelloChat";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dmsans",
  subsets: ["latin"],
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  weight: "400",
});

// Indic script support — Devanagari covers Hindi & Marathi
const notoSans = Noto_Sans({
  variable: "--font-noto",
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Bengali script support
const notoBengali = Noto_Sans_Bengali({
  variable: "--font-noto-bn",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Tamil script support
const notoTamil = Noto_Sans_Tamil({
  variable: "--font-noto-ta",
  subsets: ["tamil"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Malayalam script support
const notoMalayalam = Noto_Sans_Malayalam({
  variable: "--font-noto-ml",
  subsets: ["malayalam"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Kannada script support
const notoKannada = Noto_Sans_Kannada({
  variable: "--font-noto-kn",
  subsets: ["kannada"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Telugu script support
const notoTelugu = Noto_Sans_Telugu({
  variable: "--font-noto-te",
  subsets: ["telugu"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Arabic script support (also covers Urdu, Persian)
const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-ar",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Sinhala script support
const notoSinhala = Noto_Sans_Sinhala({
  variable: "--font-noto-si",
  subsets: ["sinhala"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_BASE_URL || "https://easy-heals-next.vercel.app"),
  title: {
    default: "EasyHeals — AI Healthcare Discovery Platform",
    template: "%s | EasyHeals",
  },
  description:
    "EasyHeals is India's AI-powered healthcare discovery platform. Find verified hospitals, specialist doctors, treatments, lab tests and book appointments. Multilingual search in Hindi, Tamil, Marathi, Bengali. Supported by IIM Lucknow, IIT Mandi & IIHMR.",
  keywords: [
    "hospital near me",
    "doctor appointment India",
    "healthcare platform",
    "AI health search",
    "EasyHeals",
    "find doctor",
    "best hospital",
    "lab test booking",
    "treatment cost",
    "multilingual healthcare",
    "appointment management",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "EasyHeals — AI Healthcare Discovery",
    description: "Find hospitals, doctors, treatments across 50+ cities in India. AI-powered multilingual search. Free for patients.",
    url: process.env.APP_BASE_URL || "https://easy-heals-next.vercel.app",
    siteName: "EasyHeals",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EasyHeals — AI Healthcare Discovery",
    description: "Find the right hospitals, doctors & treatments across India with AI-powered search.",
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
};

const VALID_LOCALES = new Set<Locale>(["en", "hi", "mr", "ta", "bn", "ml", "kn", "te", "ar", "si"]);

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("easyheals_locale")?.value ?? "en";
  const initialLocale: Locale = VALID_LOCALES.has(rawLocale as Locale) ? (rawLocale as Locale) : "en";

  return (
    <html lang={initialLocale}>
      <body className={`${bricolage.variable} ${dmSans.variable} ${dmSerif.variable} ${notoSans.variable} ${notoBengali.variable} ${notoTamil.variable} ${notoMalayalam.variable} ${notoKannada.variable} ${notoTelugu.variable} ${notoArabic.variable} ${notoSinhala.variable}`}>
        <LocaleProvider initialLocale={initialLocale}>
          <SiteNav />
          {children}
          <MSG91HelloChat />
        </LocaleProvider>
      </body>
    </html>
  );
}
