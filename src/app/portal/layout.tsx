import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getAuthFromCookies } from "@/lib/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // Allow the login page to render without auth — it is nested inside this layout
  // but must not be protected (otherwise we get an infinite redirect loop).
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  if (pathname === "/portal/login" || pathname.startsWith("/portal/login")) {
    return <>{children}</>;
  }

  const auth = await getAuthFromCookies();

  if (!auth) {
    redirect("/portal/login");
  }

  const adminRoles = ["owner", "admin", "advisor", "viewer"];
  if (adminRoles.includes(auth.role)) {
    // Admin-role users who land on /portal/* should use /admin instead
    redirect("/admin");
  }

  return <>{children}</>;
}
