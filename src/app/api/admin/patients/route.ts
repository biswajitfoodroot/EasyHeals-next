/**
 * GET /api/admin/patients — List patients with health data stats (admin only)
 *
 * Auth: admin session (owner/admin role)
 * Returns: patient list with document + event + appointment counts
 * PHI: Patient phone/identity NOT returned — only aggregate counts
 */

import { count, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { patients, healthDocuments, healthMemoryEvents, appointments } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10), 0);

  // Get patients with aggregate stats
  const patientRows = await db
    .select({
      id: patients.id,
      createdAt: patients.createdAt,
    })
    .from(patients)
    .orderBy(desc(patients.createdAt))
    .limit(limit)
    .offset(offset);

  // For each patient, get counts
  const enriched = await Promise.all(
    patientRows.map(async (p) => {
      const [docCount, eventCount, apptCount] = await Promise.all([
        db.select({ n: count() }).from(healthDocuments).where(eq(healthDocuments.patientId, p.id)),
        db.select({ n: count() }).from(healthMemoryEvents).where(eq(healthMemoryEvents.patientId, p.id)),
        db.select({ n: count() }).from(appointments).where(eq(appointments.patientId, p.id)),
      ]);
      return {
        id: p.id,
        createdAt: p.createdAt,
        documentCount: docCount[0]?.n ?? 0,
        eventCount: eventCount[0]?.n ?? 0,
        appointmentCount: apptCount[0]?.n ?? 0,
      };
    })
  );

  return NextResponse.json({ data: enriched, meta: { limit, offset, count: enriched.length } });
});
