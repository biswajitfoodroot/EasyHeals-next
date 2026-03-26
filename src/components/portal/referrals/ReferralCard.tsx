"use client";

import ReferralStatusBadge from "./ReferralStatusBadge";

type ReferralCase = {
  id: string;
  referralCode?: string | null;
  patientName?: string | null;
  clinicalCategory?: string | null;
  urgency: string;
  status: string;
  referralType: string;
  createdAt: string | null;
  selectedDestinationOrgId?: string | null;
};

type Props = {
  referral: ReferralCase;
  viewAs: "sender" | "receiver";
  onClick?: (id: string) => void;
};

const URGENCY_COLOR: Record<string, string> = {
  emergency_transfer: "bg-red-500",
  urgent:             "bg-orange-400",
  priority:           "bg-amber-400",
  routine:            "bg-slate-300",
};

export default function ReferralCard({ referral, viewAs, onClick }: Props) {
  const urgencyDot = URGENCY_COLOR[referral.urgency] ?? "bg-slate-300";
  const date = referral.createdAt
    ? new Date(referral.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    : "—";

  return (
    <button
      type="button"
      onClick={() => onClick?.(referral.id)}
      className="w-full text-left bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-start gap-3 hover:border-emerald-300 hover:shadow-sm transition-all active:scale-[0.99]"
    >
      {/* Urgency indicator */}
      <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
        <span className={`w-2 h-2 rounded-full ${urgencyDot}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 truncate">
            {referral.patientName ?? "Patient"}
          </span>
          <ReferralStatusBadge status={referral.status} />
          {viewAs === "receiver" && (
            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold">
              INCOMING
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="text-xs text-slate-400">
            {referral.clinicalCategory ?? referral.referralType.replace(/_/g, " ")}
          </span>
          {referral.referralCode && (
            <span className="text-[10px] font-mono text-slate-300">
              {referral.referralCode}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-xs text-slate-400">{date}</p>
        <p className="text-[10px] text-slate-300 mt-0.5 capitalize">
          {referral.urgency.replace(/_/g, " ")}
        </p>
      </div>
    </button>
  );
}
