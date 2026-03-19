import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";

import { db } from "@/db/client";
import { hospitals, userEntityPermissions } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import HospitalPortalClient from "./HospitalPortalClient";

type Props = { searchParams: Promise<Record<string, string>> };

export default async function HospitalPortalPage({ searchParams }: Props) {
  const auth = await getAuthFromCookies();

  // Not logged in → login
  if (!auth) redirect("/portal/login");

  // Wrong role → login
  const allowedRoles = ["hospital_admin", "owner", "admin", "advisor"];
  if (!allowedRoles.includes(auth.role)) redirect("/portal/login");

  // Resolve entityId: check users.entityId first, then user_entity_permissions (primary)
  let hospitalId = auth.entityId;

  if (!hospitalId) {
    const perm = await db
      .select({ entityId: userEntityPermissions.entityId })
      .from(userEntityPermissions)
      .where(eq(userEntityPermissions.userId, auth.userId))
      .limit(1);
    hospitalId = perm[0]?.entityId ?? null;
  }

  // Authenticated but no hospital linked → show helpful error, not redirect to login
  if (!hospitalId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
          <div className="text-4xl">🏥</div>
          <h1 className="text-xl font-bold text-slate-800">No Hospital Linked</h1>
          <p className="text-slate-500 text-sm">
            Your account is not yet linked to a hospital. Please contact your EasyHeals administrator
            to map your account to the correct hospital entity.
          </p>
          <p className="text-xs text-slate-400">Logged in as: {auth.email}</p>
          <div className="flex flex-col gap-2 pt-2">
            <Link
              href="/portal/hospital/dashboard"
              className="block w-full py-2.5 text-center bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/portal/kyc-request"
              className="block w-full py-2.5 text-center border border-teal-300 text-teal-700 hover:bg-teal-50 font-semibold rounded-xl text-sm transition-colors"
            >
              Request Access to a Hospital
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [hospital] = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.id, hospitalId))
    .limit(1);

  // Hospital ID set but not found in DB → show error
  if (!hospital) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-bold text-slate-800">Hospital Not Found</h1>
          <p className="text-slate-500 text-sm">
            The hospital linked to your account (ID: {hospitalId}) could not be found.
            Please contact your administrator.
          </p>
          <Link href="/portal/hospital/dashboard" className="block w-full py-2.5 text-center bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const welcome = params.welcome === "1";

  return <HospitalPortalClient hospital={hospital as Record<string, unknown>} welcome={welcome} />;
}
