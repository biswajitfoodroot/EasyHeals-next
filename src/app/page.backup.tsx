import type { Metadata } from "next";

import PhaseOneHome from "@/components/phase1/PhaseOneHome";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "EasyHeals Phase 1 - Intelligent Search",
  description:
    "AI multilingual healthcare discovery with crowd-verified private hospital listings and OTP self-registration.",
  path: "/",
});

export default function Home() {
  return <PhaseOneHome />;
}

