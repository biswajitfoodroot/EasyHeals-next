import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";
import RegisterPageClient from "./RegisterPageClient";

export const metadata: Metadata = buildMetadata({
  title: "Register Your Hospital — Free",
  description:
    "List your private hospital or clinic on EasyHeals for free. OTP-verified self-registration. Go live in minutes. No admin steps required.",
  path: "/register",
});

export default function RegisterPage() {
  return <RegisterPageClient />;
}
