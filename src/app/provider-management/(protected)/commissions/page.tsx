import { db } from "@/db/client";
import { commissionEntries, providerAgreements, hospitals, users } from "@/db/schema";
import { eq, desc, sum } from "drizzle-orm";

export const metadata = { title: "Commissions | EasyHeals Provider Management" };

export default async function CommissionsPage() {
  const entries = await db
    .select({
      id: commissionEntries.id,
      amountPaise: commissionEntries.amountPaise,
      status: commissionEntries.status,
      notes: commissionEntries.notes,
      createdAt: commissionEntries.createdAt,
      paidAt: commissionEntries.paidAt,
      hospitalName: hospitals.name,
      hospitalId: commissionEntries.hospitalId,
    })
    .from(commissionEntries)
    .leftJoin(hospitals, eq(hospitals.id, commissionEntries.hospitalId))
    .orderBy(desc(commissionEntries.createdAt))
    .limit(100);

  const [pendingTotal] = await db
    .select({ total: sum(commissionEntries.amountPaise) })
    .from(commissionEntries)
    .where(eq(commissionEntries.status, "pending"));

  const STATUS_COLORS: Record<string, string> = {
    pending:  "bg-amber-50 text-amber-700 border-amber-200",
    invoiced: "bg-blue-50 text-blue-700 border-blue-200",
    paid:     "bg-green-50 text-green-700 border-green-200",
    disputed: "bg-red-50 text-red-700 border-red-200",
  };

  function formatInr(paise: number) {
    return `₹${(paise / 100).toLocaleString("en-IN")}`;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Commission Entries</h1>
          <p className="text-sm text-slate-400">
            Pending: <span className="font-semibold text-amber-700">
              {formatInr(Number(pendingTotal?.total ?? 0))}
            </span>
          </p>
        </div>
        <a href="/provider-management/commissions/new"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition">
          + Log Commission
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {entries.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400 text-sm">No commission entries yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Hospital</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Notes</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {e.hospitalName ?? (e.hospitalId ? e.hospitalId.slice(0, 10) + "…" : "—")}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {formatInr(e.amountPaise)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[e.status] ?? STATUS_COLORS.pending}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                    {e.notes ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">
                    {e.createdAt ? new Date(e.createdAt).toLocaleDateString("en-IN") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
