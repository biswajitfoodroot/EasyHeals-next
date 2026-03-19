import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { leads, hospitals, patients } from "@/db/schema";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { findOrCreatePatient, requireConsent, getPhoneHash } from "@/lib/security/consent";
import { publishEvent } from "@/lib/crm/outbox";

/**
 * INT-B.1: Generate a CRM-compatible EH-XXXXXX ref ID.
 * Mirrors CRM's generateRefId() — uses MAX(CAST(...)) to avoid race conditions.
 */
async function generateCrmRefId(): Promise<string> {
  try {
    const result = await db.all<{ maxNum: number | null }>(
      sql`SELECT MAX(CAST(SUBSTR(ref_id, 4) AS INTEGER)) as maxNum
          FROM leads WHERE ref_id LIKE 'EH-%'`
    );
    const maxNum = (result[0]?.maxNum as number | null) ?? 100000;
    return `EH-${Number(maxNum) + 1}`;
  } catch {
    return `EH-${Date.now()}`; // fallback
  }
}

const leadSchema = z.object({
  hospitalId: z.string().uuid(),
  patientPhone: z.string().min(6).max(20),
  symptom: z.string().max(2000).optional(),
  preferredDate: z.string().optional(),
  consentGranted: z.literal(true),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const payload = await req.json().catch(() => null);
  if (!payload) {
    throw new AppError("SYS_UNHANDLED", "Invalid request body", "Invalid request body", 400);
  }

  const parsed = leadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", "Validation error", 400);
  }

  const { hospitalId, patientPhone, symptom, preferredDate } = parsed.data;

  // 1. Hash phone → find/create patient
  const patientId = await findOrCreatePatient(patientPhone);
  const phoneHash = getPhoneHash(patientPhone);

  // 2. Check consent_records for `booking_lead` purpose
  let consentRecordId: string;
  try {
    consentRecordId = await requireConsent(patientId, "booking_lead");
  } catch {
    throw new AppError("LEAD_CONSENT_REQUIRED", "Consent required", "Consent required for this action", 403);
  }

  // 3. Check hospital isActive
  const hospital = await db
    .select({ isActive: hospitals.isActive, name: hospitals.name })
    .from(hospitals)
    .where(eq(hospitals.id, hospitalId))
    .limit(1);

  if (!hospital.length || !hospital[0].isActive) {
    throw new AppError("LEAD_HOSPITAL_INACTIVE", "Hospital is inactive", "Selected hospital is not active", 409);
  }

  // 4. Check duplicate: same patient + hospital + status=new within 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const duplicates = await db
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(
        eq(leads.patientId, patientId),
        eq(leads.hospitalId, hospitalId),
        eq(leads.status, "new"),
        gt(leads.createdAt, sevenDaysAgo)
      )
    )
    .limit(1);

  if (duplicates.length > 0) {
    throw new AppError("LEAD_DUPLICATE", "Duplicate lead", "You have already submitted a recent request to this hospital.", 409);
  }

  // 5. Get patient display alias for CRM-compatible `name` field
  const patientRow = await db
    .select({ displayAlias: patients.displayAlias })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  const displayAlias = patientRow[0]?.displayAlias ?? "Platform Patient";

  // 6. Generate CRM-compatible refId
  const refId = await generateCrmRefId();

  // 7. INSERT lead — fills both Next.js fields and CRM bridge columns
  const [newLead] = await db
    .insert(leads)
    .values({
      // CRM-required fields (shared DB compatibility)
      fullName: displayAlias,   // full_name column (CRM bridge alias)
      phone: phoneHash,         // phone_hash used here — no raw PII in shared DB
      refId,
      sourcePlatform: "easyheals_platform",
      phoneHash,
      // Next.js fields
      hospitalId,
      patientId,
      consentRecordId,
      medicalSummary: symptom,
      preferredSlotDate: preferredDate ? new Date(preferredDate) : undefined,
      status: "new",
      score: 30,
      source: "web",
    })
    .returning({ id: leads.id });

  // 8. Publish CRM outbox event (non-fatal — CRM BullMQ processes async)
  await publishEvent("lead.created", { leadId: newLead.id, patientId, hospitalId, refId });

  return NextResponse.json({
    data: {
      leadId: newLead.id,
      refId,
      status: "new",
    },
    message: "Hospital will call you back within 24 hours"
  });
});
