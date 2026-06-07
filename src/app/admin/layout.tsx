import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminNav } from "@/app/admin/AdminNav";
import { AdminShell } from "@/app/admin/AdminShell";
import { getAuthFromCookies } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Admin",
  description: "EasyHeals Next admin operations and CRM controls.",
  path: "/admin",
});

// Roles permitted to enter any /admin route.
// All other authenticated roles (contributor, hospital_admin, doctor, etc.)
// must be redirected away — they must not see any admin surface.
const ADMIN_ROLES = [
  "owner",
  "admin",
  "admin_manager",
  "admin_editor",
  "advisor",
  // "viewer" is intentionally excluded — no admin panel access
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthFromCookies();

  // No session at all — render children bare so the login page can display.
  if (!auth) {
    return <>{children}</>;
  }

  // Authenticated but not a staff/admin role (e.g. contributor, hospital_admin, doctor).
  // Redirect to home rather than to /admin/login to avoid a redirect loop when the
  // user already has a community session cookie and navigates to /admin/login.
  if (!ADMIN_ROLES.includes(auth.role)) {
    redirect("/");
  }

  return (
    <AdminShell nav={<AdminNav me={{ fullName: auth.fullName, email: auth.email, role: auth.role }} />}>
      {children}
    </AdminShell>
  );
}
