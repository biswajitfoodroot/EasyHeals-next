import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getAuthFromCookies } from "@/lib/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // Allow the login page to render without auth
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  if (pathname === "/portal/login" || pathname.startsWith("/portal/login")) {
    return <>{children}</>;
  }

  const auth = await getAuthFromCookies();

  if (!auth) {
    redirect("/portal/login");
  }

  // Only hospital_admin and doctor roles are allowed in the provider portal.
  // Any other role (including admins) gets redirected back to portal login.
  if (!["hospital_admin", "doctor"].includes(auth.role)) {
    redirect("/portal/login");
  }

  return <>{children}</>;
}
