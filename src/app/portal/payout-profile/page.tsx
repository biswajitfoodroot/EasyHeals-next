import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { providerPayoutProfiles } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import PayoutProfileClient from "./PayoutProfileClient";

export const metadata = { title: "Payout Profile | EasyHeals Portal" };

const PROVIDER_ROLES = ["hospital_admin", "doctor"];

export default async function PayoutProfilePage() {
  const auth = await getAuthFromCookies();
  if (!auth || !PROVIDER_ROLES.includes(auth.role)) redirect("/portal/login");
  if (!auth.entityId) redirect("/portal/login");

  const [profile] = await db
    .select()
    .from(providerPayoutProfiles)
    .where(eq(providerPayoutProfiles.entityId, auth.entityId))
    .limit(1);

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Payout Profile</h1>
        <p className="text-sm text-slate-400">Bank / UPI details for receiving referral commission payments</p>
      </div>
      <PayoutProfileClient
        entityId={auth.entityId}
        entityType={auth.role === "doctor" ? "doctor" : "hospital"}
        profile={profile ? {
          ...profile,
          createdAt: profile.createdAt ?? null,
          updatedAt: profile.updatedAt ?? null,
          verifiedAt: profile.verifiedAt ?? null,
        } : null}
      />
    </div>
  );
}
