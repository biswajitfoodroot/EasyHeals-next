import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db/client";
import { getAuthFromCookies } from "@/lib/auth";
import { hospitalSubscriptions, packages, packageFeatures } from "@/db/schema";
import SubscriptionClient from "./SubscriptionClient";

export const metadata = { title: "Subscription | EasyHeals Portal" };

export default async function SubscriptionPage() {
  const auth = await getAuthFromCookies();
  if (!auth) redirect("/portal/login");
  if (!["hospital_admin", "owner", "admin"].includes(auth.role)) redirect("/portal/hospital/dashboard");

  // Load current subscription
  let currentSub: {
    id: string;
    packageId: string;
    packageName: string;
    monthlyPrice: number;
    status: string;
    startsAt: string;
    endsAt: string | null;
  } | null = null;

  if (auth.entityId) {
    const subRows = await db
      .select({
        id: hospitalSubscriptions.id,
        packageId: hospitalSubscriptions.packageId,
        packageName: packages.name,
        monthlyPrice: packages.monthlyPrice,
        status: hospitalSubscriptions.status,
        startsAt: hospitalSubscriptions.startsAt,
        endsAt: hospitalSubscriptions.endsAt,
      })
      .from(hospitalSubscriptions)
      .innerJoin(packages, eq(packages.id, hospitalSubscriptions.packageId))
      .where(eq(hospitalSubscriptions.hospitalId, auth.entityId))
      .limit(1);

    if (subRows.length) {
      const s = subRows[0];
      currentSub = {
        id: s.id,
        packageId: s.packageId,
        packageName: s.packageName,
        monthlyPrice: s.monthlyPrice,
        status: s.status,
        startsAt: s.startsAt instanceof Date ? s.startsAt.toISOString() : String(s.startsAt),
        endsAt: s.endsAt ? (s.endsAt instanceof Date ? s.endsAt.toISOString() : String(s.endsAt)) : null,
      };
    }
  }

  // Load all available plans
  const planRows = await db
    .select({
      id: packages.id,
      code: packages.code,
      name: packages.name,
      monthlyPrice: packages.monthlyPrice,
    })
    .from(packages)
    .where(eq(packages.isActive, true));

  // Load features for each plan
  const featRows = await db.select().from(packageFeatures);
  const plans = planRows.map((p) => ({
    ...p,
    features: featRows.filter((f) => f.packageId === p.id && f.isEnabled).map((f) => f.featureKey),
  }));

  return (
    <SubscriptionClient
      currentSub={currentSub}
      plans={plans}
      userRole={auth.role}
      hospitalId={auth.entityId ?? undefined}
    />
  );
}
