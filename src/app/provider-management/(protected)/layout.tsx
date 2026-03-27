import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthFromCookies } from "@/lib/auth";
import { ProviderManagementNav } from "@/components/provider-management/ProviderManagementNav";
import { PMShell } from "@/components/provider-management/PMShell";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Provider Management",
  description: "EasyHeals provider network operations, agreements, and KYC.",
  path: "/provider-management",
});

// Roles allowed in the Provider Management plane
const PM_ROLES = ["owner", "admin", "admin_manager", "admin_editor", "operator", "coordinator"];

export default async function ProviderManagementLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthFromCookies();

  if (!auth) {
    redirect("/provider-management/login");
  }

  if (!PM_ROLES.includes(auth.role)) {
    redirect("/unauthorized?from=provider-management");
  }

  return (
    <PMShell nav={<ProviderManagementNav me={{ fullName: auth.fullName, email: auth.email, role: auth.role }} />}>
      {children}
    </PMShell>
  );
}
