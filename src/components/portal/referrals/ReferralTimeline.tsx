"use client";

type TimelineEvent = {
  id: string;
  eventType: string;
  note?: string | null;
  createdByActorType?: string | null;
  createdAt: string | null;
};

type Props = {
  events: TimelineEvent[];
};

const EVENT_ICON: Record<string, string> = {
  submitted:            "📤",
  triaging:             "🔍",
  destination_suggested:"💡",
  accepted:             "✅",
  rejected:             "❌",
  patient_contacted:    "📞",
  booked:               "📅",
  completed:            "🏁",
  note_added:           "📝",
  billed:               "🧾",
  commission_locked:    "🔒",
  paid:                 "💸",
  cancelled:            "🚫",
};

export default function ReferralTimeline({ events }: Props) {
  if (!events.length) {
    return <p className="text-xs text-slate-400 text-center py-6">No events yet.</p>;
  }

  return (
    <ol className="relative space-y-0">
      {events.map((ev, idx) => {
        const icon = EVENT_ICON[ev.eventType] ?? "📌";
        const date = ev.createdAt
          ? new Date(ev.createdAt).toLocaleString("en-IN", {
              day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
            })
          : "—";
        const isLast = idx === events.length - 1;

        return (
          <li key={ev.id} className="flex gap-3">
            {/* Spine */}
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-sm shrink-0 z-10">
                {icon}
              </div>
              {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1" />}
            </div>

            <div className={`pb-4 flex-1 min-w-0 ${isLast ? "" : ""}`}>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-700 capitalize">
                  {ev.eventType.replace(/_/g, " ")}
                </span>
                <span className="text-[10px] text-slate-400">{date}</span>
                {ev.createdByActorType && (
                  <span className="text-[10px] text-slate-300 capitalize">
                    by {ev.createdByActorType.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              {ev.note && (
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{ev.note}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
