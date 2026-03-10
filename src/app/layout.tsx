import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans, DM_Serif_Display } from "next/font/google";

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
    default: "EasyHeals Next",
    template: "%s | EasyHeals Next",
  },
  description:
    "EasyHeals Next offers AI-assisted healthcare search across hospitals, doctors, treatments, and symptoms.",
  keywords: ["hospital", "doctor", "appointment", "healthcare", "ai search", "easyheals"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "EasyHeals Next",
    description: "AI-assisted healthcare discovery and operations platform.",
    url: "https://easyheals-next.com",
    siteName: "EasyHeals Next",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EasyHeals Next",
    description: "Interactive AI healthcare search platform.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bricolage.variable} ${dmSans.variable} ${dmSerif.variable}`}>{children}</body>
    </html>
  );
}

