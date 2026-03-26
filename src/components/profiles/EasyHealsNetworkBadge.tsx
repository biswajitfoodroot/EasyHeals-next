"use client";

/**
 * EasyHealsNetworkBadge
 * Shown on public hospital/doctor profile pages when the provider has
 * an accepted provider_agreements row (network partner).
 *
 * RN-ready: no DOM-specific APIs. All layout via inline Tailwind.
 */
type Props = {
  tierCode?: string | null;
  compact?: boolean;
};

const TIER_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  premium: { label: "Premium Partner",  color: "#7C3AED", icon: "⭐" },
  partner: { label: "Verified Partner", color: "#1B8A4A", icon: "✅" },
  basic:   { label: "Network Partner",  color: "#0369A1", icon: "🤝" },
};

export default function EasyHealsNetworkBadge({ tierCode, compact = false }: Props) {
  const tier = TIER_LABELS[tierCode ?? "partner"] ?? TIER_LABELS.partner;

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-sm"
        style={{ background: tier.color }}
      >
        <span className="text-[11px]">{tier.icon}</span>
        EasyHeals {tier.label}
      </span>
    );
  }

  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3 border"
      style={{ background: `${tier.color}0D`, borderColor: `${tier.color}33` }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm"
        style={{ background: tier.color }}
      >
        E
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: tier.color }}>
          {tier.icon} EasyHeals {tier.label}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
          Verified on the EasyHeals referral network. Book online with confidence.
        </p>
      </div>
    </div>
  );
}
