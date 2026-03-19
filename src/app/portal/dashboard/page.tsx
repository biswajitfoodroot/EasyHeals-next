import { redirect } from "next/navigation";
import { getAuthFromCookies } from "@/lib/auth";
import ProviderDashboardClient from "./ProviderDashboardClient";

export default async function ProviderDashboardPage() {
  const auth = await getAuthFromCookies();

  if (!auth) {
    redirect("/portal/login");
  }

  // Only doctor / hospital_admin / admin / advisor may access provider dashboard
  const allowed = ["doctor", "hospital_admin", "owner", "admin", "advisor"];
  if (!allowed.includes(auth.role)) {
    redirect("/portal/login");
  }

  return (
    <ProviderDashboardClient
      userFullName={auth.fullName}
      userRole={auth.role}
      entityId={auth.entityId ?? undefined}
    />
  );
}
