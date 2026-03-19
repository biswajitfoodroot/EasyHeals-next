import type { Metadata } from "next";

import { AdminNav } from "@/app/admin/AdminNav";
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
    <div className="flex min-h-screen bg-slate-50">
      <AdminNav me={{ fullName: auth.fullName, email: auth.email, role: auth.role }} />
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
