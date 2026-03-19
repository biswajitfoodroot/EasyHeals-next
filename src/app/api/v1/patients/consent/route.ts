/**
 * GET  /api/v1/patients/consent  — List active consents for the current patient
 * POST /api/v1/patients/consent  — Grant consent for one or more purposes (session-authenticated)
 *
 * Auth: eh_patient_session cookie (patient session)
 * Unlike /api/v1/consent (body-based patientId), these endpoints derive patientId from the session.
 */

import { and, desc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { consentRecords } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { checkDuplicateConsent } from "@/lib/security/consent";
import { hashDeviceFp } from "@/lib/security/encryption";
import { withErrorHandler } from "@/lib/errors/app-error";

const grantSchema = z.object({
  purposes: z.array(z.string().min(1)).min(1),
  version: z.string().default("1.0"),
});

// ── GET — list all consent records ───────────────────────────────────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);
  const { patientId } = session;

  const records = await db
    .select({
      id: consentRecords.id,
      purpose: consentRecords.purpose,
      granted: consentRecords.granted,
      grantedAt: consentRecords.grantedAt,
      revokedAt: consentRecords.revokedAt,
      version: consentRecords.version,
    })
    .from(consentRecords)
    .where(eq(consentRecords.patientId, patientId))
    .orderBy(desc(consentRecords.grantedAt));

  // Return latest record per purpose
  const purposeMap = new Map<string, typeof records[0]>();
  for (const row of records) {
    if (!purposeMap.has(row.purpose)) {
      purposeMap.set(row.purpose, row);
    }
  }

  return NextResponse.json({ data: [...purposeMap.values()] });
});

// ── POST — grant consent (session-auth, no patientId in body) ─────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);
  const { patientId } = session;

  const payload = await req.json().catch(() => null);
  const parsed = grantSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request: purposes array required" }, { status: 400 });
  }

  const { purposes, version } = parsed.data;
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const ipHash = hashDeviceFp(ip);
  const ua = req.headers.get("user-agent") ?? "";
  const userAgentHash = ua ? hashDeviceFp(ua) : null;
  const grantedAt = new Date();
  const consentIds: string[] = [];

  for (const purpose of purposes) {
    const existingId = await checkDuplicateConsent(patientId, purpose);
    if (existingId) { consentIds.push(existingId); continue; }

    const [record] = await db
      .insert(consentRecords)
      .values({
        patientId,
        purpose,
        version,
        granted: true,
        grantedAt,
        channel: "web",
        ipHash,
        userAgentHash,
        legalBasis: "dpdp_consent",
      })
      .returning({ id: consentRecords.id });

    consentIds.push(record.id);
  }

  return NextResponse.json({ consentIds, grantedAt: grantedAt.toISOString() });
});
