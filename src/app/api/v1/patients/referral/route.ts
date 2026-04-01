/**
 * Referral Engine
 *
 * POST /api/v1/patients/referral        — generate or return existing referral code
 * GET  /api/v1/patients/referral        — stats: clicks, conversions, points
 *
 * Flag: referral_engine
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { referralCodes, referralConversions } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { requireFeatureFlag } from "@/lib/config/feature-flags";
import { withErrorHandler } from "@/lib/errors/app-error";

// ── nanoid-lite: 8-char uppercase alphanumeric ─────────────────────────────────

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 confusion
  let code = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const b of bytes) code += chars[b % chars.length];
  return code;
}

// ── GET ────────────────────────────────────────────────────────────────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  const flagCheck = await requireFeatureFlag("referral_engine");
  if (flagCheck) return flagCheck;

  const session = await requirePatientSession(req);
  const { patientId } = session;

  const existing = await db
    .select({
      id: referralCodes.id,
      code: referralCodes.code,
      totalClicks: referralCodes.totalClicks,
      totalConversions: referralCodes.totalConversions,
      pointsAwarded: referralCodes.pointsAwarded,
      createdAt: referralCodes.createdAt,
    })
    .from(referralCodes)
    .where(eq(referralCodes.patientId, patientId))
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ code: null, stats: null });
  }

  const rc = existing[0];

  // Recent conversions
  const conversions = await db
    .select({ convertedAt: referralConversions.convertedAt })
    .from(referralConversions)
    .where(eq(referralConversions.codeId, rc.id))
    .orderBy(referralConversions.convertedAt)
    .limit(10);

  const baseUrl = process.env.APP_BASE_URL ?? "https://easy-heals-next.vercel.app";

  return NextResponse.json({
    code: rc.code,
    referralUrl: `${baseUrl}/r/${rc.code}`,
    stats: {
      totalClicks: rc.totalClicks,
      totalConversions: rc.totalConversions,
      pointsAwarded: rc.pointsAwarded,
      recentConversions: conversions.map((c) => ({ convertedAt: c.convertedAt })),
    },
  });
});

// ── POST — generate code ───────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  const flagCheck = await requireFeatureFlag("referral_engine");
  if (flagCheck) return flagCheck;

  const session = await requirePatientSession(req);
  const { patientId } = session;

  // Return existing code if already has one
  const existing = await db
    .select({ code: referralCodes.code })
    .from(referralCodes)
    .where(eq(referralCodes.patientId, patientId))
    .limit(1);

  if (existing.length > 0) {
    const baseUrl = process.env.APP_BASE_URL ?? "https://easy-heals-next.vercel.app";
    return NextResponse.json({
      code: existing[0].code,
      referralUrl: `${baseUrl}/r/${existing[0].code}`,
      created: false,
    });
  }

  // Generate unique code with collision retry
  let code = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateCode();
    const clash = await db
      .select({ id: referralCodes.id })
      .from(referralCodes)
      .where(eq(referralCodes.code, candidate))
      .limit(1);
    if (clash.length === 0) { code = candidate; break; }
  }

  if (!code) {
    return NextResponse.json({ error: "Failed to generate unique code" }, { status: 500 });
  }

  await db.insert(referralCodes).values({ patientId, code });

  const baseUrl = process.env.APP_BASE_URL ?? "https://easy-heals-next.vercel.app";
  return NextResponse.json({
    code,
    referralUrl: `${baseUrl}/r/${code}`,
    created: true,
  }, { status: 201 });
});
