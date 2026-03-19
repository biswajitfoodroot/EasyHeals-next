/**
 * GET /api/v1/patients/health-timeline — Paginated decrypted health events
 *
 * Auth:   eh_patient_session cookie
 * Flag:   health_memory (returns 503 if OFF)
 *
 * Query params:
 *   limit    — max records per page (default 50, max 200)
 *   offset   — number of records to skip (default 0)
 *   type     — filter by event_type (optional)
 *   source   — filter by source (optional)
 *   from     — ISO date string, earliest event_date (optional)
 *   to       — ISO date string, latest event_date (optional)
 *   sourceId — filter by source_ref_id / document ID (optional)
 */

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { healthMemoryEvents } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { decryptPHI } from "@/lib/health/encryption";
import { withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest) => {
  if (!await isFeatureEnabled("health_memory")) {
    return NextResponse.json({ error: "Feature not available" }, { status: 503 });
  }

  const session = await requirePatientSession(req);
  const { patientId } = session;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10), 0);
  const typeFilter = url.searchParams.get("type");
  const sourceFilter = url.searchParams.get("source");
  const fromDate = url.searchParams.get("from");
  const toDate = url.searchParams.get("to");
  const sourceId = url.searchParams.get("sourceId");

  // Build where conditions
  const conditions = [
    eq(healthMemoryEvents.patientId, patientId),
    eq(healthMemoryEvents.isActive, true),
  ];
  if (typeFilter) conditions.push(eq(healthMemoryEvents.eventType, typeFilter));
  if (sourceFilter) conditions.push(eq(healthMemoryEvents.source, sourceFilter));
  if (sourceId) conditions.push(eq(healthMemoryEvents.sourceRefId, sourceId));
  if (fromDate) conditions.push(gte(healthMemoryEvents.eventDate, new Date(fromDate)));
  if (toDate) conditions.push(lte(healthMemoryEvents.eventDate, new Date(toDate)));

  const rows = await db
    .select({
      id: healthMemoryEvents.id,
      source: healthMemoryEvents.source,
      sourceRefId: healthMemoryEvents.sourceRefId,
      eventType: healthMemoryEvents.eventType,
      eventDate: healthMemoryEvents.eventDate,
      dataEncrypted: healthMemoryEvents.dataEncrypted,
      createdAt: healthMemoryEvents.createdAt,
    })
    .from(healthMemoryEvents)
    .where(and(...conditions))
    .orderBy(desc(healthMemoryEvents.eventDate))
    .limit(limit)
    .offset(offset);

  // Decrypt and shape — never return dataEncrypted to client
  const events = rows.map((row) => {
    let data: Record<string, unknown> = {};
    try { data = decryptPHI<Record<string, unknown>>(row.dataEncrypted); }
    catch { /* decryption failure — return minimal record */ }

    return {
      id: row.id,
      source: row.source,
      sourceRefId: row.sourceRefId,
      eventType: row.eventType,
      eventDate: row.eventDate,
      createdAt: row.createdAt,
      data,
    };
  });

  return NextResponse.json({
    data: events,
    meta: { limit, offset, count: events.length },
  });
});
