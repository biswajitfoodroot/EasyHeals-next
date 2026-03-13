/**
 * GET  /api/admin/audit-log  — paginated unified activity log
 * POST /api/admin/audit-log  — AI natural-language search → returns filter params + summary
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { and, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { auditLogs, contributions, doctors, hospitals, users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { ensureRole } from "@/lib/rbac";

// ── Shared types ─────────────────────────────────────────────────────────────

export type UnifiedLogEntry = {
  id: string;
  source: "contribution" | "audit";
  when: string;
  actorId: string | null;
  actorName: string | null;
  actorAvatar: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  fieldChanged: string | null;
  oldValue: unknown;
  newValue: unknown;
  outlierScore: number | null;
  outlierFlags: string[];
  status: string;
  rejectReason: string | null;
  changes: unknown;
};

// ── GET ───────────────────────────────────────────────────────────────────────

const filterSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  entityType: z.enum(["hospital", "doctor", "all"]).default("all"),
  status: z.enum(["pending", "approved", "rejected", "all"]).default("all"),
  minScore: z.coerce.number().optional(),
  actorRole: z.string().optional(),
  entityId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const sp = req.nextUrl.searchParams;
  const f = filterSchema.parse({
    dateFrom: sp.get("dateFrom") ?? undefined,
    dateTo: sp.get("dateTo") ?? undefined,
    entityType: sp.get("entityType") ?? "all",
    status: sp.get("status") ?? "all",
    minScore: sp.get("minScore") ?? undefined,
    actorRole: sp.get("actorRole") ?? undefined,
    entityId: sp.get("entityId") ?? undefined,
    limit: sp.get("limit") ?? 100,
    offset: sp.get("offset") ?? 0,
  });

  const dateFrom = f.dateFrom ? new Date(f.dateFrom) : null;
  const dateTo = f.dateTo ? new Date(f.dateTo) : null;

  // ── 1. Contributions (crowd edits) ───────────────────────────────────────
  const contribWhere = [
    f.entityType !== "all" ? eq(contributions.targetType, f.entityType) : undefined,
    f.status !== "all" ? eq(contributions.status, f.status) : undefined,
    dateFrom ? gte(contributions.createdAt, dateFrom) : undefined,
    dateTo ? lte(contributions.createdAt, dateTo) : undefined,
    f.minScore !== undefined ? gte(contributions.outlierScore, f.minScore) : undefined,
    f.entityId ? eq(contributions.targetId, f.entityId) : undefined,
  ].filter(Boolean);

  const contribRows = await db
    .select()
    .from(contributions)
    .where(contribWhere.length ? and(...contribWhere) : undefined)
    .orderBy(desc(contributions.createdAt))
    .limit(f.limit + f.offset);

  // ── 2. Audit logs (portal + admin edits) ──────────────────────────────────
  const auditWhere = [
    f.entityType !== "all" ? eq(auditLogs.entityType, f.entityType) : undefined,
    dateFrom ? gte(auditLogs.createdAt, dateFrom) : undefined,
    dateTo ? lte(auditLogs.createdAt, dateTo) : undefined,
    f.entityId ? eq(auditLogs.entityId, f.entityId) : undefined,
  ].filter(Boolean);

  // If status filter is active, audit logs only show for "approved" (they're always applied)
  const auditRows =
    f.status === "pending" || f.status === "rejected"
      ? []
      : await db
          .select()
          .from(auditLogs)
          .where(auditWhere.length ? and(...auditWhere) : undefined)
          .orderBy(desc(auditLogs.createdAt))
          .limit(f.limit + f.offset);

  // ── 3. Enrich with actor names ─────────────────────────────────────────────
  const actorIds = [
    ...new Set([
      ...contribRows.map((r) => r.contributorId).filter(Boolean),
      ...auditRows.map((r) => r.actorUserId).filter(Boolean),
    ]),
  ] as string[];

  const actorRows = actorIds.length
    ? await db
        .select({
          id: users.id,
          fullName: users.fullName,
          googleAvatar: users.googleAvatar,
          entityType: users.entityType,
        })
        .from(users)
        .where(inArray(users.id, actorIds))
    : [];

  const actorMap = new Map(actorRows.map((u) => [u.id, u]));

  // ── 4. Enrich with entity names ────────────────────────────────────────────
  const hospIds = [
    ...new Set([
      ...contribRows.filter((r) => r.targetType === "hospital").map((r) => r.targetId),
      ...auditRows.filter((r) => r.entityType === "hospital").map((r) => r.entityId).filter(Boolean),
    ]),
  ] as string[];

  const docIds = [
    ...new Set([
      ...contribRows.filter((r) => r.targetType === "doctor").map((r) => r.targetId),
      ...auditRows.filter((r) => r.entityType === "doctor").map((r) => r.entityId).filter(Boolean),
    ]),
  ] as string[];

  const [hospNames, docNames] = await Promise.all([
    hospIds.length
      ? db.select({ id: hospitals.id, name: hospitals.name }).from(hospitals).where(inArray(hospitals.id, hospIds))
      : [],
    docIds.length
      ? db.select({ id: doctors.id, name: doctors.fullName }).from(doctors).where(inArray(doctors.id, docIds))
      : [],
  ]);

  const entityNameMap = new Map<string, string>([
    ...hospNames.map((h): [string, string] => [h.id, h.name]),
    ...docNames.map((d): [string, string] => [d.id, d.name]),
  ]);

  // ── 5. Merge & sort ───────────────────────────────────────────────────────
  const merged: UnifiedLogEntry[] = [
    ...contribRows.map((r): UnifiedLogEntry => {
      const actor = r.contributorId ? actorMap.get(r.contributorId) : null;
      return {
        id: r.id,
        source: "contribution",
        when: r.createdAt?.toISOString() ?? new Date(0).toISOString(),
        actorId: r.contributorId,
        actorName: actor?.fullName ?? null,
        actorAvatar: actor?.googleAvatar ?? null,
        actorRole: actor?.entityType ?? "contributor",
        action: `crowd.edit.${r.status}`,
        entityType: r.targetType,
        entityId: r.targetId,
        entityName: entityNameMap.get(r.targetId) ?? null,
        fieldChanged: r.fieldChanged,
        oldValue: r.oldValue,
        newValue: r.newValue,
        outlierScore: r.outlierScore,
        outlierFlags: (r.outlierFlags as string[]) ?? [],
        status: r.status,
        rejectReason: r.rejectReason,
        changes: null,
      };
    }),
    ...auditRows.map((r): UnifiedLogEntry => {
      const actor = r.actorUserId ? actorMap.get(r.actorUserId) : null;
      return {
        id: r.id,
        source: "audit",
        when: r.createdAt?.toISOString() ?? new Date(0).toISOString(),
        actorId: r.actorUserId ?? null,
        actorName: actor?.fullName ?? null,
        actorAvatar: actor?.googleAvatar ?? null,
        actorRole: actor?.entityType ?? "admin",
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId ?? null,
        entityName: r.entityId ? (entityNameMap.get(r.entityId) ?? null) : null,
        fieldChanged: null,
        oldValue: null,
        newValue: null,
        outlierScore: null,
        outlierFlags: [],
        status: "applied",
        rejectReason: null,
        changes: r.changes,
      };
    }),
  ]
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
    .slice(f.offset, f.offset + f.limit);

  // ── 6. Summary stats (for current filters) ────────────────────────────────
  const allContrib = await db
    .select({
      status: contributions.status,
      outlierScore: contributions.outlierScore,
    })
    .from(contributions)
    .where(
      and(
        dateFrom ? gte(contributions.createdAt, dateFrom) : undefined,
        dateTo ? lte(contributions.createdAt, dateTo) : undefined,
        f.entityType !== "all" ? eq(contributions.targetType, f.entityType) : undefined,
      ),
    );

  const stats = {
    total: allContrib.length,
    autoApproved: allContrib.filter((r) => r.status === "approved" && (r.outlierScore ?? 0) < 20).length,
    pending: allContrib.filter((r) => r.status === "pending").length,
    rejected: allContrib.filter((r) => r.status === "rejected").length,
    highRisk: allContrib.filter((r) => (r.outlierScore ?? 0) >= 70).length,
  };

  return NextResponse.json({ data: merged, stats, total: merged.length });
}

// ── POST: AI natural language search ─────────────────────────────────────────

const aiSearchSchema = z.object({
  query: z.string().min(3).max(500),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const body = await req.json();
  const parsed = aiSearchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY ?? "");
  const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL ?? "gemini-2.5-flash" });

  const today = new Date().toISOString().split("T")[0];

  const prompt = `You are a healthcare admin assistant. Convert this natural language query into structured filter parameters for an activity log.

Query: "${parsed.data.query}"
Today's date: ${today}

Return ONLY valid JSON with these optional fields:
{
  "dateFrom": "YYYY-MM-DD",
  "dateTo": "YYYY-MM-DD",
  "entityType": "hospital" | "doctor" | "all",
  "status": "pending" | "approved" | "rejected" | "all",
  "minScore": 0-100,
  "summary": "one sentence describing what was searched for"
}

Examples:
- "suspicious phone edits last 7 days" → dateFrom = 7 days ago, minScore: 30, fieldChanged: phone
- "pending doctor edits" → status: pending, entityType: doctor
- "high risk contributions this month" → dateFrom = start of month, minScore: 70

Only include fields that are relevant to the query. Return ONLY JSON, no markdown.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/```json|```/g, "");
    const filters = JSON.parse(text) as {
      dateFrom?: string;
      dateTo?: string;
      entityType?: string;
      status?: string;
      minScore?: number;
      summary?: string;
    };

    return NextResponse.json({ filters, summary: filters.summary ?? "Filtered by AI" });
  } catch {
    return NextResponse.json({ error: "AI search failed" }, { status: 500 });
  }
}
