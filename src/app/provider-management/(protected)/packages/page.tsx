import { db } from "@/db/client";
import { packages, packageFeatures } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import PackagesClient from "./PackagesClient";

export const metadata = { title: "Subscription Plans | EasyHeals Provider Management" };

export default async function PackagesPage() {
  const auth = await getAuthFromCookies();

  const pkgs = await db.select().from(packages).orderBy(packages.monthlyPrice);
  const features = await db.select().from(packageFeatures);

  const plans = pkgs.map((p) => ({
    ...p,
    features: features
      .filter((f) => f.packageId === p.id && f.isEnabled)
      .map((f) => f.featureKey),
  }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Subscription Plans</h1>
        <p className="text-sm text-slate-400">Create and manage subscription plan tiers for providers</p>
      </div>
      <PackagesClient plans={plans} canDelete={auth?.role === "owner"} />
    </div>
  );
}
