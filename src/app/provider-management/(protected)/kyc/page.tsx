import { getAuthFromCookies } from "@/lib/auth";
import KycReviewTabContent from "@/app/admin/KycReviewTabContent";

export const metadata = { title: "KYC Review | EasyHeals Provider Management" };

export default async function KycPage() {
  const auth = await getAuthFromCookies();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">KYC Review</h1>
        <p className="text-sm text-slate-400">Review and approve provider identity verification requests</p>
      </div>

      <KycReviewTabContent myRole={auth?.role ?? ""} />
    </div>
  );
}
