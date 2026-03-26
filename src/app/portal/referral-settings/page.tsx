import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { providerReferralPreferences } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import ReferralSettingsClient from "./ReferralSettingsClient";

export const metadata = { title: "Referral Settings | EasyHeals Portal" };

const PROVIDER_ROLES = ["hospital_admin", "doctor"];

export default async function ReferralSettingsPage() {
  const auth = await getAuthFromCookies();
  if (!auth || !PROVIDER_ROLES.includes(auth.role)) redirect("/portal/login");
  if (!auth.entityId) redirect("/portal/login");

  const [prefs] = await db
    .select()
    .from(providerReferralPreferences)
    .where(eq(providerReferralPreferences.entityId, auth.entityId))
    .limit(1);

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Referral Settings</h1>
        <p className="text-sm text-slate-400">Configure how you receive incoming referrals from the EasyHeals network</p>
      </div>
      <ReferralSettingsClient
        entityId={auth.entityId}
        entityType={auth.role === "doctor" ? "doctor" : "hospital"}
        prefs={prefs ? {
          acceptsIncomingReferrals: prefs.acceptsIncomingReferrals ?? true,
          defaultResponseSlaMins: prefs.defaultResponseSlaMins ?? 60,
          referralSpecialties: prefs.referralSpecialties ? JSON.parse(prefs.referralSpecialties) as string[] : [],
          requiresPreapproval: prefs.requiresPreapproval ?? false,
          acceptedReferralTypes: prefs.acceptedReferralTypes ? JSON.parse(prefs.acceptedReferralTypes) as string[] : [],
        } : null}
      />
    </div>
  );
}
