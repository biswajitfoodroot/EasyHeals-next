import type { Metadata } from "next";

import { AdminNav } from "@/app/admin/AdminNav";
import { AdminShell } from "@/app/admin/AdminShell";
import { getAuthFromCookies } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Admin",
  description: "EasyHeals Next admin operations and CRM controls.",
  path: "/admin",
});

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthFromCookies();

  // No session → login page renders without sidebar
  if (!auth) {
    return <>{children}</>;
  }

  return (
    <AdminShell nav={<AdminNav me={{ fullName: auth.fullName, email: auth.email, role: auth.role }} />}>
      {children}
    </AdminShell>
  );
}
