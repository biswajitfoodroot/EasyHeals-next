import type { Metadata } from "next";

import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
