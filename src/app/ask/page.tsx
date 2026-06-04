import { Suspense } from "react";
import type { Metadata } from "next";
import { buildHreflangAlternates } from "@/lib/seo";
import AskClient from "./AskClient";

export const metadata: Metadata = {
  title: "AI Health Assistant — Find Hospitals, Doctors & Book Appointments",
  description:
    "Describe your symptoms or search hospitals and doctors across India. EasyHeals AI matches you to the right specialist and helps you book an appointment instantly. Free for patients.",
  alternates: {
    canonical: "/ask",
    languages: buildHreflangAlternates("/ask"),
  },
  robots: { index: true, follow: true },
};

export default function AskPage() {
  return (
    <Suspense>
      <AskClient />
    </Suspense>
  );
}
