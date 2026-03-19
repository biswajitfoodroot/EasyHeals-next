import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { patients, consentRecords } from "@/db/schema";
import { AppError } from "@/lib/errors/app-error";
import { hashPhone } from "@/lib/security/encryption";

export function getPhoneHash(phone: string): string {
  return hashPhone(phone);
}

export async function findOrCreatePatient(phone: string): Promise<string> {
  const phoneHash = getPhoneHash(phone);

  const existing = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.phoneHash, phoneHash))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const [newPatient] = await db
    .insert(patients)
    .values({ phoneHash })
    .returning({ id: patients.id });

  return newPatient.id;
}

export async function requireConsent(patientId: string, purpose: string): Promise<string> {
  const records = await db
    .select({ id: consentRecords.id, granted: consentRecords.granted, revokedAt: consentRecords.revokedAt })
    .from(consentRecords)
    .where(
      and(
        eq(consentRecords.patientId, patientId),
        eq(consentRecords.purpose, purpose)
      )
    )
    .orderBy(desc(consentRecords.grantedAt))
    .limit(1);

  if (!records.length || !records[0].granted || records[0].revokedAt !== null) {
    throw new AppError("CONSENT_MISSING", `Active consent missing for purpose: ${purpose}`);
  }

  return records[0].id;
}

export async function revokeConsent(patientId: string, purpose: string): Promise<void> {
  await db
    .update(consentRecords)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(consentRecords.patientId, patientId),
        eq(consentRecords.purpose, purpose),
        isNull(consentRecords.revokedAt)
      )
    );
}

/** Returns the existing active consent record ID, or null if none exists. */
export async function checkDuplicateConsent(patientId: string, purpose: string): Promise<string | null> {
  const records = await db
    .select({ id: consentRecords.id })
    .from(consentRecords)
    .where(
      and(
        eq(consentRecords.patientId, patientId),
        eq(consentRecords.purpose, purpose),
        isNull(consentRecords.revokedAt),
        eq(consentRecords.granted, true)
      )
    )
    .limit(1);

  return records.length > 0 ? records[0].id : null;
}
