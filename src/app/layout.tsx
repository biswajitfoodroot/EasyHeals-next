import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans, DM_Serif_Display } from "next/font/google";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://easyheals-next.com"),
  title: {
    default: "EasyHeals",
    template: "%s | EasyHeals",
  },
  description:
    "EasyHeals offers AI-assisted healthcare search across hospitals, doctors, treatments, and symptoms.",
  keywords: ["hospital", "doctor", "appointment", "healthcare", "ai search", "easyheals"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "EasyHeals",
    description: "AI-assisted healthcare discovery and operations platform.",
    url: "https://easyheals-next.com",
    siteName: "EasyHeals",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EasyHeals",
    description: "Interactive AI healthcare search platform.",
  },
};

const VALID_LOCALES = new Set<Locale>(["en", "hi", "mr", "ta", "bn"]);

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
      <body className={`${bricolage.variable} ${dmSans.variable} ${dmSerif.variable}`}>
        <LocaleProvider initialLocale={initialLocale}>
          <SiteNav />
          {children}
          <MSG91HelloChat />
        </LocaleProvider>
      </body>
    </html>
  );
}
