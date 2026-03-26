import { db } from "@/db/client";
import { commissionEntries, hospitals } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import PayoutsClient from "./PayoutsClient";

export const metadata = { title: "Payout Management | EasyHeals Provider Management" };

export default async function PayoutsPage() {
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
    .limit(500);

  return (
    <PayoutsClient
      entries={entries.map((e) => ({
        ...e,
        createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : null,
        paidAt: e.paidAt ? new Date(e.paidAt).toISOString() : null,
        hospitalName: e.hospitalName ?? null,
        hospitalId: e.hospitalId ?? null,
      }))}
    />
  );
}
