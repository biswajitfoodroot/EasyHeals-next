import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db/client";
import { doctors } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import DoctorDashboardClient from "./DoctorDashboardClient";

export const metadata = { title: "Doctor Dashboard | EasyHeals Portal" };

export default async function DoctorDashboardPage() {
  const auth = await getAuthFromCookies();

  if (!auth) redirect("/portal/login");

  if (auth.role !== "doctor") redirect("/portal/login");

  let doctorName = auth.fullName;
  if (auth.entityId) {
    const [doctor] = await db
      .select({ fullName: doctors.fullName })
      .from(doctors)
      .where(eq(doctors.id, auth.entityId))
      .limit(1);
    if (doctor) doctorName = doctor.fullName;
  }

  return (
    <DoctorDashboardClient
      userFullName={auth.fullName}
      userRole={auth.role}
      doctorId={auth.entityId ?? undefined}
      doctorName={doctorName}
    />
  );
}
