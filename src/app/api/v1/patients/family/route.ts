/**
 * Family Profile API — /api/v1/patients/family
 *
 * GET  → list all family members linked to the authenticated patient
 * POST → add a family member (creates a real EasyHeals patient account if needed)
 *
 * Rules:
 *  - Max 5 family members per account (Health Pro plan)
 *  - Each family member is a full EasyHeals patient (own account, can log in)
 *  - A family member phone cannot be the same as the primary patient's phone
 *  - Duplicate links (same pair) are rejected
 *
 * Auth: eh_patient_session cookie (requirePremiumAccess — Health Pro)
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { patients, patientFamilyLinks } from "@/db/schema";
import { withErrorHandler } from "@/lib/errors/app-error";
import { requirePatientSession } from "@/lib/core/patient-session";
import { requirePremiumAccess } from "@/lib/core/patient-trial";
import { hashPhone, encryptPhone } from "@/lib/security/encryption";

const MAX_FAMILY = 5;

// ── GET /api/v1/patients/family ───────────────────────────────────────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);
  const { patientId } = session;

  const links = await db
    .select({
      id: patientFamilyLinks.id,
      linkedPatientId: patientFamilyLinks.linkedPatientId,
      relation: patientFamilyLinks.relation,
      displayName: patientFamilyLinks.displayName,
      createdAt: patientFamilyLinks.createdAt,
    })
    .from(patientFamilyLinks)
    .where(eq(patientFamilyLinks.primaryPatientId, patientId));

  if (links.length === 0) return NextResponse.json({ data: [] });

  // Fetch patient details for each linked member
  const linkedIds = links.map((l) => l.linkedPatientId);
  const memberRows = await db
    .select({
      id: patients.id,
      displayAlias: patients.displayAlias,
      googleName: patients.googleName,
      city: patients.city,
      subscriptionTier: patients.subscriptionTier,
      createdAt: patients.createdAt,
    })
    .from(patients)
    .where(and(inArray(patients.id, linkedIds), isNull(patients.deletedAt)));

  const memberMap = new Map(memberRows.map((m) => [m.id, m]));

  const data = links.map((l) => {
    const mp = memberMap.get(l.linkedPatientId);
    return {
      linkId: l.id,
      patientId: l.linkedPatientId,
      relation: l.relation,
      name: l.displayName ?? mp?.displayAlias ?? mp?.googleName ?? "Family Member",
      city: mp?.city ?? null,
      memberSince: mp?.createdAt ?? null,
      createdAt: l.createdAt,
    };
  });

  return NextResponse.json({ data });
});

// ── POST /api/v1/patients/family ──────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);
  const { patientId } = session;

  // Family profiles require premium
  await requirePremiumAccess(patientId);

  const body = await req.json().catch(() => null) as {
    phone?: string;
    name?: string;
    relation?: string;
    dob?: string;
  } | null;

  if (!body?.phone || !body?.name) {
    return NextResponse.json({ error: "Phone number and name are required." }, { status: 400 });
  }

  const phone = body.phone.trim();
  const name  = body.name.trim();
  const relation = body.relation?.trim() || "Family";

  // Check max limit
  const existing = await db
    .select({ id: patientFamilyLinks.id })
    .from(patientFamilyLinks)
    .where(eq(patientFamilyLinks.primaryPatientId, patientId));

  if (existing.length >= MAX_FAMILY) {
    return NextResponse.json({ error: `Maximum of ${MAX_FAMILY} family members allowed.` }, { status: 400 });
  }

  // Hash the new phone
  const newPhoneHash = hashPhone(phone);

  // Check it's not the primary patient's own phone
  const [primaryRow] = await db
    .select({ phoneHash: patients.phoneHash })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (primaryRow?.phoneHash === newPhoneHash) {
    return NextResponse.json({ error: "You cannot add yourself as a family member." }, { status: 400 });
  }

  // Find or create the family member's patient account
  const [existingPatient] = await db
    .select({ id: patients.id, displayAlias: patients.displayAlias, googleName: patients.googleName })
    .from(patients)
    .where(and(eq(patients.phoneHash, newPhoneHash), isNull(patients.deletedAt)))
    .limit(1);

  let linkedPatientId: string;

  if (existingPatient) {
    linkedPatientId = existingPatient.id;
  } else {
    // Create a new patient account for the family member
    // They can log in later using their phone via OTP
    const newId = crypto.randomUUID();
    let encryptedPhone: string | null = null;
    try { encryptedPhone = encryptPhone(phone); } catch { /* dev — encryption key may not be set */ }

    await db.insert(patients).values({
      id: newId,
      phoneHash: newPhoneHash,
      phoneEncrypted: encryptedPhone,
      displayAlias: name,
      legalBasis: "dpdp_consent",
    });
    linkedPatientId = newId;
  }

  // Check this pair isn't already linked
  const [existingLink] = await db
    .select({ id: patientFamilyLinks.id })
    .from(patientFamilyLinks)
    .where(and(
      eq(patientFamilyLinks.primaryPatientId, patientId),
      eq(patientFamilyLinks.linkedPatientId, linkedPatientId),
    ))
    .limit(1);

  if (existingLink) {
    return NextResponse.json({ error: "This person is already in your family." }, { status: 409 });
  }

  // Create the family link
  const linkId = crypto.randomUUID();
  await db.insert(patientFamilyLinks).values({
    id: linkId,
    primaryPatientId: patientId,
    linkedPatientId,
    relation,
    displayName: name,
  });

  return NextResponse.json({
    ok: true,
    family: {
      linkId,
      patientId: linkedPatientId,
      relation,
      name,
      isNewAccount: !existingPatient,
    },
  });
});

// ── DELETE /api/v1/patients/family/[linkId] — handled in [linkId]/route.ts ───
