import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";

import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
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
      <body className={`${jakarta.variable} ${sora.variable}`}>
        <div className="site-shell">
          <header className="site-header">
            <Link href="/" className="brand-link">
              <Image
                unoptimized
                src="https://easyheals.com/easyHealsLogo.svg"
                alt="EasyHeals"
                width={160}
                height={46}
              />
            </Link>
            <nav className="top-nav" aria-label="Primary navigation">
              <Link href="/hospitals">Hospitals</Link>
              <Link href="/treatments">Treatments</Link>
              <Link href="/admin">Admin</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
