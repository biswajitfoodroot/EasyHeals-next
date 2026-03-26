import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";

import { db } from "@/db/client";
import { hospitals, doctors, providerAgreements } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import PortalNav from "@/components/portal/PortalNav";

const PORTAL_ROLES = ["hospital_admin", "doctor", "receptionist"];

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

  if (!PORTAL_ROLES.includes(auth.role)) {
    redirect("/portal/login");
  }

  // Fetch entity name + active agreement in parallel
  let entityName: string | undefined;
  let hasActiveAgreement = false;

  if (auth.entityId) {
    const entityType = auth.role === "doctor" ? "doctor" : "hospital";

    const [entityResult, agreementResult] = await Promise.all([
      auth.role === "hospital_admin" || auth.role === "receptionist"
        ? db.select({ name: hospitals.name }).from(hospitals).where(eq(hospitals.id, auth.entityId)).limit(1)
        : auth.role === "doctor"
        ? db.select({ fullName: doctors.fullName }).from(doctors).where(eq(doctors.id, auth.entityId)).limit(1)
        : Promise.resolve([]),

      db.select({ id: providerAgreements.id })
        .from(providerAgreements)
        .where(and(
          auth.role === "doctor"
            ? eq(providerAgreements.doctorId, auth.entityId)
            : eq(providerAgreements.hospitalId, auth.entityId),
          eq(providerAgreements.status, "accepted"),
        ))
        .limit(1),
    ]);

    if (auth.role === "hospital_admin" || auth.role === "receptionist") {
      entityName = (entityResult[0] as { name?: string })?.name ?? undefined;
    } else if (auth.role === "doctor") {
      entityName = (entityResult[0] as { fullName?: string })?.fullName ?? undefined;
    }

    hasActiveAgreement = agreementResult.length > 0;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <PortalNav
        userRole={auth.role}
        userName={auth.fullName}
        entityName={entityName}
        hasActiveAgreement={hasActiveAgreement}
      />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
