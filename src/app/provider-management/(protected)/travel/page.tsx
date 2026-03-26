import { desc, eq, count } from "drizzle-orm";
import { db } from "@/db/client";
import { travelCases, travelQuotes, users } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import TravelClient from "./TravelClient";

export const metadata = { title: "Travel Cases | EasyHeals Provider Management" };

type CaseRow = {
  id: string; referralCaseId: string | null; patientName: string | null;
  patientPhone: string | null; destinationCity: string | null;
  checkInDate: string | null; checkOutDate: string | null;
  guestCount: number | null; budgetPaise: number | null;
  requirements: string | null; status: string;
  assignedCoordinatorId: string | null; coordinatorName: string | null;
  commissionPaise: number | null; notes: string | null;
  createdAt: string | null; quoteCount: number;
};

export default async function TravelPage() {
  await getAuthFromCookies(); // auth checked in layout

  let cases: CaseRow[] = [];
  try {
    const rows = await db
      .select({
        id: travelCases.id,
        referralCaseId: travelCases.referralCaseId,
        patientName: travelCases.patientName,
        patientPhone: travelCases.patientPhone,
        destinationCity: travelCases.destinationCity,
        checkInDate: travelCases.checkInDate,
        checkOutDate: travelCases.checkOutDate,
        guestCount: travelCases.guestCount,
        budgetPaise: travelCases.budgetPaise,
        requirements: travelCases.requirements,
        status: travelCases.status,
        assignedCoordinatorId: travelCases.assignedCoordinatorId,
        coordinatorName: users.fullName,
        commissionPaise: travelCases.commissionPaise,
        notes: travelCases.notes,
        createdAt: travelCases.createdAt,
      })
      .from(travelCases)
      .leftJoin(users, eq(users.id, travelCases.assignedCoordinatorId))
      .orderBy(desc(travelCases.createdAt))
      .limit(200);

    const quoteCounts = await db
      .select({ travelCaseId: travelQuotes.travelCaseId, cnt: count() })
      .from(travelQuotes)
      .groupBy(travelQuotes.travelCaseId);

    const quoteMap = new Map(quoteCounts.map((q) => [q.travelCaseId, q.cnt]));
    cases = rows.map((r) => ({
      ...r,
      checkInDate: r.checkInDate ? new Date(r.checkInDate).toISOString() : null,
      checkOutDate: r.checkOutDate ? new Date(r.checkOutDate).toISOString() : null,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
      quoteCount: quoteMap.get(r.id) ?? 0,
    }));
  } catch {
    // Table may not exist yet — run db:push to create new tables
  }

  const statusCounts = cases.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Travel Cases</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Medical accommodation and travel coordination
          </p>
        </div>
        <div className="flex gap-3 text-center">
          {[
            { label: "Requested", key: "requested", color: "text-amber-700" },
            { label: "Quoted", key: "quoted", color: "text-blue-700" },
            { label: "Booked", key: "booked", color: "text-indigo-700" },
          ].map(s => (
            <div key={s.key} className="bg-white rounded-xl border border-slate-200 px-4 py-2 min-w-[70px]">
              <p className={`text-lg font-bold ${s.color}`}>{statusCounts[s.key] ?? 0}</p>
              <p className="text-[10px] text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
      <TravelClient cases={cases} />
    </div>
  );
}
