/**
 * DEV-ONLY API — /api/dev
 *
 * Blocked in production (NODE_ENV=production → 404).
 * Provides read/write access to test data without going through Razorpay or auth flows.
 *
 * GET  /api/dev?section=patients|users|flags|hospitals|doctors
 * POST /api/dev  body: { action, ...params }
 *
 * Actions:
 *   set_patient_tier    { patientId, tier }
 *   toggle_flag         { key, enabled }
 *   set_user_entity     { userId, role, entityType, entityId }
 *   set_user_password   { userId, password }     (plain → bcrypt)
 *   create_test_patient { phone, tier? }
 */

import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import {
  patients, users, hospitals, doctors,
  featureFlags, doctorHospitalAffiliations,
  userRoleMap, roles,
} from "@/db/schema";
import { createSession, setSessionCookie } from "@/lib/session";

// ── Guard ─────────────────────────────────────────────────────────────────────

function isProd() {
  return process.env.NODE_ENV === "production";
}

function blocked() {
  return NextResponse.json({ error: "Dev API not available in production." }, { status: 404 });
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (isProd()) return blocked();

  const section = new URL(req.url).searchParams.get("section") ?? "patients";

  if (section === "patients") {
    const rows = await db
      .select({
        id: patients.id,
        googleEmail: patients.googleEmail,
        googleName: patients.googleName,
        displayAlias: patients.displayAlias,
        subscriptionTier: patients.subscriptionTier,
        subscriptionExpiresAt: patients.subscriptionExpiresAt,
        trialStartedAt: patients.trialStartedAt,
        createdAt: patients.createdAt,
      })
      .from(patients)
      .orderBy(desc(patients.createdAt))
      .limit(50);
    return NextResponse.json({ data: rows });
  }

  if (section === "users") {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        roleCode: roles.code,
        entityType: users.entityType,
        entityId: users.entityId,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(userRoleMap, eq(userRoleMap.userId, users.id))
      .leftJoin(roles, eq(roles.id, userRoleMap.roleId))
      .orderBy(desc(users.createdAt))
      .limit(50);
    return NextResponse.json({ data: rows });
  }

  if (section === "flags") {
    const rows = await db
      .select({ key: featureFlags.key, enabled: featureFlags.enabled, updatedAt: featureFlags.updatedAt })
      .from(featureFlags)
      .orderBy(featureFlags.key);
    return NextResponse.json({ data: rows });
  }

  if (section === "hospitals") {
    const rows = await db
      .select({ id: hospitals.id, name: hospitals.name, city: hospitals.city, isActive: hospitals.isActive })
      .from(hospitals)
      .orderBy(hospitals.name)
      .limit(50);
    return NextResponse.json({ data: rows });
  }

  if (section === "doctors") {
    const rows = await db
      .select({
        id: doctors.id,
        fullName: doctors.fullName,
        specialization: doctors.specialization,
        city: doctors.city,
        isActive: doctors.isActive,
        hospitalId: doctors.hospitalId,
      })
      .from(doctors)
      .orderBy(doctors.fullName)
      .limit(50);
    return NextResponse.json({ data: rows });
  }

  if (section === "affiliations") {
    const rows = await db
      .select({
        id: doctorHospitalAffiliations.id,
        doctorId: doctorHospitalAffiliations.doctorId,
        hospitalId: doctorHospitalAffiliations.hospitalId,
        role: doctorHospitalAffiliations.role,
        affiliationStatus: doctorHospitalAffiliations.affiliationStatus,
        isActive: doctorHospitalAffiliations.isActive,
      })
      .from(doctorHospitalAffiliations)
      .orderBy(desc(doctorHospitalAffiliations.createdAt))
      .limit(50);
    return NextResponse.json({ data: rows });
  }

  return NextResponse.json({ error: "Unknown section" }, { status: 400 });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (isProd()) return blocked();

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

  const action = body.action as string;

  // ── Set patient subscription tier ─────────────────────────────────────────

  if (action === "set_patient_tier") {
    const { patientId, tier } = body as { patientId: string; tier: string };
    const VALID = ["free", "health_plus", "health_pro", "trial"];
    if (!patientId || !VALID.includes(tier)) {
      return NextResponse.json({ error: "Invalid patientId or tier" }, { status: 400 });
    }

    const expiresAt = (tier === "free" || tier === "trial")
      ? null
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    await db.update(patients).set({
      subscriptionTier: tier === "trial" ? "free" : tier,
      subscriptionExpiresAt: expiresAt,
      // "free" → null clears trial entirely; "trial" → reset to now; paid → leave unchanged
      trialStartedAt: tier === "free" ? null : tier === "trial" ? new Date() : undefined,
    }).where(eq(patients.id, patientId));

    return NextResponse.json({ ok: true, patientId, tier, expiresAt });
  }

  // ── Toggle feature flag ────────────────────────────────────────────────────

  if (action === "toggle_flag") {
    const { key, enabled } = body as { key: string; enabled: boolean };
    if (!key || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Invalid key or enabled" }, { status: 400 });
    }

    await db.insert(featureFlags)
      .values({ key, enabled, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: featureFlags.key,
        set: { enabled, updatedAt: new Date() },
      });

    return NextResponse.json({ ok: true, key, enabled });
  }

  // ── Set portal user entity (link user to hospital/doctor) ─────────────────

  if (action === "set_user_entity") {
    const { userId, role, entityType, entityId } = body as {
      userId: string; role: string; entityType: string | null; entityId: string | null;
    };
    if (!userId || !role) return NextResponse.json({ error: "Invalid userId or role" }, { status: 400 });

    // Update entity binding on users table
    await db.update(users).set({
      entityType: entityType ?? null,
      entityId: entityId ?? null,
    }).where(eq(users.id, userId));

    // Upsert role into userRoleMap (roles are stored separately)
    const roleRow = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, role)).limit(1);
    if (roleRow.length > 0) {
      const roleId = roleRow[0].id;
      // Delete existing role mappings for this user then insert the new one
      await db.delete(userRoleMap).where(eq(userRoleMap.userId, userId));
      await db.insert(userRoleMap).values({ userId, roleId });
    }

    return NextResponse.json({ ok: true, userId, role, entityType, entityId });
  }

  // ── Reset user password (dev only, bcrypt hash) ───────────────────────────

  if (action === "set_user_password") {
    const { userId, password } = body as { userId: string; password: string };
    if (!userId || !password || password.length < 4) {
      return NextResponse.json({ error: "Invalid userId or password (min 4 chars)" }, { status: 400 });
    }

    // Dynamic import to avoid bundle bloat
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash(password, 10);
    await db.update(users).set({ passwordHash: hash }).where(eq(users.id, userId));
    return NextResponse.json({ ok: true, userId, message: "Password updated." });
  }

  // ── Create or activate test feature flag ─────────────────────────────────

  if (action === "enable_all_flags") {
    const CORE_FLAGS = [
      "appointment_booking", "token_queue", "health_memory",
      "ai_coach", "emr_lite", "wearable_sync",
    ];
    for (const key of CORE_FLAGS) {
      await db.insert(featureFlags)
        .values({ key, enabled: true, updatedAt: new Date() })
        .onConflictDoUpdate({ target: featureFlags.key, set: { enabled: true, updatedAt: new Date() } });
    }
    return NextResponse.json({ ok: true, flags: CORE_FLAGS });
  }

  // ── Dev quick login as any portal user ────────────────────────────────────

  if (action === "dev_login_as") {
    const { userId } = body as { userId: string };
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const { sessionToken, expiresAt } = await createSession(userId);
    await setSessionCookie(sessionToken, expiresAt);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
