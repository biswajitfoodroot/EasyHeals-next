"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReferralCard from "@/components/portal/referrals/ReferralCard";
import IncomingReferralCard from "@/components/portal/referrals/IncomingReferralCard";
import ReferralWizard from "@/components/portal/referrals/ReferralWizard";
import ReferralDetailSheet from "@/components/portal/referrals/ReferralDetailSheet";

type ReferralCase = {
  id: string;
  referralCode?: string | null;
  patientName?: string | null;
  patientPhone?: string | null;
  clinicalCategory?: string | null;
  suspectedCondition?: string | null;
  urgency: string;
  status: string;
  referralType: string;
  clinicalNotes?: string | null;
  createdAt: string | null;
  referringOrganizationId?: string | null;
  referringProviderId?: string | null;
  selectedDestinationOrgId?: string | null;
  selectedDestinationProviderId?: string | null;
};

type View = "outgoing" | "incoming";

type Props = {
  userRole: string;
  entityId: string;
  userId: string;
};

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-16 animate-pulse bg-slate-100 rounded-2xl" />
      ))}
    </div>
  );
}

export default function ReferralsClient({ userRole, entityId, userId }: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("incoming");
  const [referrals, setReferrals] = useState<ReferralCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/referrals", { credentials: "include" });
      if (res.ok) {
        const { data } = await res.json() as { data: ReferralCase[] };
        setReferrals(data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const outgoing = referrals.filter(r =>
    userRole === "hospital_admin"
      ? r.referringOrganizationId === entityId
      : r.referringProviderId === entityId
  );

  const incoming = referrals.filter(r =>
    userRole === "hospital_admin"
      ? r.selectedDestinationOrgId === entityId
      : r.selectedDestinationProviderId === entityId
  );

  const currentList = view === "outgoing" ? outgoing : incoming;
  const pendingIncoming = incoming.filter(r =>
    ["submitted", "triaging", "destination_suggested"].includes(r.status)
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-800">Referrals</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {pendingIncoming.length > 0
              ? `${pendingIncoming.length} incoming referral${pendingIncoming.length > 1 ? "s" : ""} need attention`
              : "Manage patient referrals"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl text-white transition active:scale-95 shadow-sm"
          style={{ background: "#1B8A4A" }}
        >
          <span>+</span>
          New Referral
        </button>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 p-1 bg-white rounded-2xl border border-slate-200 shadow-sm">
        {([
          { key: "incoming" as View, label: "Incoming", count: incoming.length },
          { key: "outgoing" as View, label: "Sent Out", count: outgoing.length },
        ] as const).map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all ${
              view === key ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
            style={view === key ? { background: "#1B8A4A" } : {}}
          >
            {label}
            {count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                view === key
                  ? "bg-white/20 text-white"
                  : key === "incoming" && pendingIncoming.length > 0
                  ? "bg-amber-500 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <Skeleton />
      ) : currentList.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <p className="text-3xl mb-2">{view === "incoming" ? "📭" : "📤"}</p>
          <p className="text-sm font-semibold text-slate-600">
            {view === "incoming" ? "No incoming referrals" : "No outgoing referrals yet"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {view === "incoming"
              ? "When other providers refer patients to you, they will appear here."
              : "Use the New Referral button to refer a patient to another provider."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {view === "incoming"
            ? currentList.map(r => (
                <IncomingReferralCard
                  key={r.id}
                  referral={r}
                  onAction={() => void load()}
                />
              ))
            : currentList.map(r => (
                <ReferralCard
                  key={r.id}
                  referral={r}
                  viewAs="sender"
                  onClick={setSelectedId}
                />
              ))
          }
        </div>
      )}

      {showWizard && (
        <ReferralWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => {
            setShowWizard(false);
            void load();
          }}
        />
      )}

      {selectedId && (
        <ReferralDetailSheet
          referralId={selectedId}
          userRole={userRole}
          entityId={entityId}
          onClose={() => setSelectedId(null)}
          onUpdate={() => void load()}
        />
      )}
    </div>
  );
}
