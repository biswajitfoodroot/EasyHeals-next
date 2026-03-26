import { redirect } from "next/navigation";

import { getAuthFromCookies } from "@/lib/auth";

export default async function PortalPage() {
  const auth = await getAuthFromCookies();

  if (!auth) {
    redirect("/portal/login");
  }

  if (auth.role === "hospital_admin") {
    redirect("/portal/hospital/dashboard");
  }

  if (auth.role === "doctor") {
    redirect("/portal/doctor/dashboard");
  }

  if (auth.role === "receptionist") {
    redirect("/portal/queue");
  }

  redirect("/portal/login");
}
