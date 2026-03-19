import { redirect } from "next/navigation";

import { getAuthFromCookies } from "@/lib/auth";

export default async function PortalPage() {
  const auth = await getAuthFromCookies();

  if (!auth) {
    redirect("/portal/login");
  }

  if (auth.entityType === "hospital") {
    redirect("/portal/hospital");
  }

  if (auth.entityType === "doctor") {
    redirect("/portal/doctor");
  }

  redirect("/portal/login");
}
