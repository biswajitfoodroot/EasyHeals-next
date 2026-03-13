import { redirect } from "next/navigation";

import { getAuthFromCookies } from "@/lib/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthFromCookies();

  if (!auth) {
    redirect("/portal/login");
  }

  const adminRoles = ["owner", "admin", "advisor", "viewer"];
  if (adminRoles.includes(auth.role)) {
    redirect("/admin");
  }

  return <>{children}</>;
}
