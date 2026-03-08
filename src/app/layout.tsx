import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://easyheals-next.com"),
  title: {
    default: "EasyHeals Next",
    template: "%s | EasyHeals Next",
  },
  description:
    "EasyHeals Next is a mobile-first healthcare discovery and CRM-connected platform for providers and patients.",
  keywords: ["hospital", "doctor", "appointment", "healthcare", "easyheals"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "EasyHeals Next",
    description: "Healthcare discovery, lead management, and appointment operations.",
    url: "https://easyheals-next.com",
    siteName: "EasyHeals Next",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EasyHeals Next",
    description: "Mobile-first healthcare discovery platform.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div className="site-shell">
          <header className="site-header">
            <p className="brand">EasyHeals Next</p>
            <nav className="top-nav" aria-label="Primary navigation">
              <a href="#discovery">Discovery</a>
              <a href="#providers">Providers</a>
              <a href="#operations">Operations</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
