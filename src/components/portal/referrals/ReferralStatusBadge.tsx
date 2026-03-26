"use client";

type Status =
  | "draft" | "submitted" | "triaging" | "destination_suggested"
  | "accepted" | "patient_contacted" | "booked" | "completed"
  | "billed" | "commission_locked" | "paid" | "rejected" | "cancelled" | "expired";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  draft:                { label: "Draft",            bg: "bg-slate-100",   text: "text-slate-500" },
  submitted:            { label: "Submitted",        bg: "bg-blue-50",     text: "text-blue-600"  },
  triaging:             { label: "Triaging",         bg: "bg-violet-50",   text: "text-violet-600" },
  destination_suggested:{ label: "Suggested",        bg: "bg-indigo-50",   text: "text-indigo-600" },
  accepted:             { label: "Accepted",         bg: "bg-emerald-50",  text: "text-emerald-700" },
  patient_contacted:    { label: "Patient Contacted",bg: "bg-teal-50",     text: "text-teal-700"  },
  booked:               { label: "Booked",           bg: "bg-cyan-50",     text: "text-cyan-700"  },
  completed:            { label: "Completed",        bg: "bg-green-100",   text: "text-green-700" },
  billed:               { label: "Billed",           bg: "bg-lime-50",     text: "text-lime-700"  },
  commission_locked:    { label: "Commission Locked",bg: "bg-amber-50",    text: "text-amber-700" },
  paid:                 { label: "Paid",             bg: "bg-emerald-100", text: "text-emerald-800" },
  rejected:             { label: "Rejected",         bg: "bg-red-50",      text: "text-red-600"   },
  cancelled:            { label: "Cancelled",        bg: "bg-slate-100",   text: "text-slate-400" },
  expired:              { label: "Expired",          bg: "bg-orange-50",   text: "text-orange-500" },
};

export default function ReferralStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: "bg-slate-100", text: "text-slate-500" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}
