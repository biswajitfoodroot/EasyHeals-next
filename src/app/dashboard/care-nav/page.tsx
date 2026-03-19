import type { Metadata } from "next";
import CareNavClient from "./CareNavClient";

export const metadata: Metadata = {
  title: "Care Navigator | EasyHeals",
  description: "Describe your symptoms and get AI-powered triage guidance and specialist recommendations.",
};

export default function CareNavPage() {
  return <CareNavClient />;
}
