"use client";

import { useState } from "react";
import AgreementModal from "./AgreementModal";

type Agreement = {
  id: string;
  agreementType: string;
  status: string;
  publishedAt: string | null;
  customTerms?: string | null;
  termsVersion?: string | null;
};

type Props = {
  agreement: Agreement;
  onAccepted?: () => void;
};

export default function AgreementBanner({ agreement, onAccepted }: Props) {
  const [open, setOpen] = useState(false);

  if (agreement.status !== "published") return null;

  return (
    <>
      <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-lg">
          📋
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            New EasyHeals Network Agreement
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Review and accept your partnership agreement to unlock Referrals and Earnings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-all active:scale-95"
          style={{ background: "#1B8A4A" }}
        >
          Review
        </button>
      </div>

      {open && (
        <AgreementModal
          agreement={agreement}
          onClose={() => setOpen(false)}
          onAccepted={() => {
            setOpen(false);
            onAccepted?.();
          }}
        />
      )}
    </>
  );
}
