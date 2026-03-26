import { db } from "@/db/client";
import { channelPartners, channelAttributions } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getAuthFromCookies } from "@/lib/auth";
import AgentsClient from "./AgentsClient";

export const metadata = { title: "Field Agents | EasyHeals Provider Management" };

export default async function AgentsPage() {
  const auth = await getAuthFromCookies();

  const partners = await db
    .select()
    .from(channelPartners)
    .orderBy(desc(channelPartners.createdAt))
    .limit(200);

  const attributions = await db.select({ partnerId: channelAttributions.partnerId }).from(channelAttributions);
  const attrCount: Record<string, number> = {};
  for (const a of attributions) {
    attrCount[a.partnerId] = (attrCount[a.partnerId] ?? 0) + 1;
  }

  const agents = partners.map((p) => ({
    ...p,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
    updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : null,
    attributionCount: attrCount[p.id] ?? 0,
  }));

  const canManage = ["owner", "admin", "admin_manager", "operator"].includes(auth?.role ?? "");

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Field Agents</h1>
        <p className="text-sm text-slate-400">Agent registrations, onboarding attribution, and fraud flags</p>
      </div>
      <AgentsClient agents={agents} canManage={canManage} />
    </div>
  );
}
