import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthFromCookies } from "@/lib/auth";
import { ProviderManagementNav } from "@/components/provider-management/ProviderManagementNav";
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
    <div className="flex min-h-screen bg-slate-50">
      <ProviderManagementNav me={{ fullName: auth.fullName, email: auth.email, role: auth.role }} />
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
