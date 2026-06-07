import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { contributions, contributorTrust, doctors, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { scoreContribution } from "@/lib/outlier";

const ARRAY_FIELDS_HOSPITAL = new Set(["specialties", "facilities"]);
const ARRAY_FIELDS_DOCTOR   = new Set(["specialties", "qualifications", "languages"]);

function dedupeStrings(arr: unknown[]): string[] {
  return [...new Set(arr.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((s) => s.trim()))];
}

const contributionSchema = z.object({
  targetType: z.enum(["hospital", "doctor", "lab"]),
  targetId: z.string().min(3),
  // contributorId is ignored — always derived from server-side session
  contributorId: z.string().optional(),
  changeType: z.string().min(3).max(40).default("update"),
  fieldChanged: z.string().min(2).max(80),
  oldValue: z.unknown().optional(),
  newValue: z.unknown(),
});

function toTrustChange(status: "auto_approve" | "pending_review" | "auto_reject") {
  if (status === "auto_approve") return 3;
  if (status === "auto_reject") return -7;
  return 0;
}

// Contributors (public users) may only suggest service-availability data.
// Core identity fields (name, phone, email, address, website, description) are
// editable only by portal owners (hospital_admin / doctor role) and EasyHeals admins.
// Array fields (specialties, facilities, qualifications, languages) are merged
// with existing values — never overwritten — so community edits are additive.
// Returns { patch, before } so the contribution record can be stamped with the
// true before/after values for accurate Edits history display.
type PatchResult = { patch: Record<string, unknown>; before: Record<string, unknown> };

async function normalizeHospitalPatch(targetId: string, field: string, value: unknown): Promise<PatchResult | null> {
  const f = field.toLowerCase();
  if (f === "workinghours") {
    if (typeof value === "object" && value !== null) return { patch: { workingHours: value }, before: {} };
    return null;
  }
  if (ARRAY_FIELDS_HOSPITAL.has(f)) {
    if (!Array.isArray(value)) return null;
    const [row] = await db
      .select({ specialties: hospitals.specialties, facilities: hospitals.facilities })
      .from(hospitals)
      .where(eq(hospitals.id, targetId))
      .limit(1);
    const existing = (row?.[f as "specialties" | "facilities"] as string[] | null) ?? [];
    return { patch: { [f]: dedupeStrings([...existing, ...value]) }, before: { [f]: existing } };
  }
  return null; // all other fields are portal/admin-only
}

async function normalizeDoctorPatch(targetId: string, field: string, value: unknown): Promise<PatchResult | null> {
  const f = field.toLowerCase();
  if (f === "consultationhours") {
    if (typeof value === "object" && value !== null) return { patch: { consultationHours: value }, before: {} };
    return null;
  }
  if (ARRAY_FIELDS_DOCTOR.has(f)) {
    if (!Array.isArray(value)) return null;
    const [row] = await db
      .select({ specialties: doctors.specialties, qualifications: doctors.qualifications, languages: doctors.languages })
      .from(doctors)
      .where(eq(doctors.id, targetId))
      .limit(1);
    const existing = (row?.[f as "specialties" | "qualifications" | "languages"] as string[] | null) ?? [];
    return { patch: { [f]: dedupeStrings([...existing, ...value]) }, before: { [f]: existing } };
  }
  return null; // all other fields are portal/admin-only
}

export async function POST(req: NextRequest) {
  // Require authentication — Google Sign-In (contributor) or any internal role
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const payload = await req.json();
    const parsed = contributionSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid contribution", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { targetType, targetId, fieldChanged, oldValue, newValue, changeType } = parsed.data;
    // Always use server-side userId — never trust client-sent contributorId
    const contributorId = auth.userId;

    const normalizedTargetType = targetType === "lab" ? "hospital" : targetType;

    let targetContext: { id: string; city: string; name: string } | null = null;

    if (normalizedTargetType === "hospital") {
      const existing = await db
        .select({ id: hospitals.id, city: hospitals.city, name: hospitals.name })
        .from(hospitals)
        .where(eq(hospitals.id, targetId))
        .limit(1);

      targetContext = existing[0] ? { id: existing[0].id, city: existing[0].city, name: existing[0].name } : null;
    } else {
      const existing = await db
        .select({ id: doctors.id, city: doctors.city, name: doctors.fullName })
        .from(doctors)
        .where(eq(doctors.id, targetId))
        .limit(1);

      targetContext = existing[0]
        ? { id: existing[0].id, city: existing[0].city ?? "", name: existing[0].name }
        : null;
    }

    if (!targetContext) {
      return NextResponse.json({ error: `${normalizedTargetType} not found` }, { status: 404 });
    }

    const trust = contributorId
      ? await db
          .select({
            trustScore: contributorTrust.trustScore,
            totalEdits: contributorTrust.totalEdits,
            approvedEdits: contributorTrust.approvedEdits,
            rejectedEdits: contributorTrust.rejectedEdits,
          })
          .from(contributorTrust)
          .where(eq(contributorTrust.contributorId, contributorId))
          .limit(1)
      : [];

    const trustScore = trust[0]?.trustScore ?? 50;

    const outlier = await scoreContribution(
      fieldChanged,
      oldValue ?? null,
      newValue,
      trustScore,
      targetContext,
      contributorId,
      normalizedTargetType,
    );

    if (outlier.recommendation === "auto_reject") {
      return NextResponse.json(
        { status: "rejected", reason: outlier.flags.join(", "), outlier },
        { status: 422 },
      );
    }

    const [saved] = await db
      .insert(contributions)
      .values({
        targetType: normalizedTargetType,
        targetId,
        contributorId,
        changeType,
        fieldChanged,
        oldValue: (oldValue as Record<string, unknown> | null) ?? null,
        newValue: (typeof newValue === "object" && newValue !== null
          ? (newValue as Record<string, unknown>)
          : { value: newValue }) as Record<string, unknown>,
        outlierScore: outlier.score,
        outlierFlags: outlier.flags,
        aiConfidence: outlier.confidence,
        status: outlier.recommendation === "auto_approve" ? "approved" : "pending",
      })
      .returning();

    if (outlier.recommendation === "auto_approve") {
      if (normalizedTargetType === "hospital") {
        const result = await normalizeHospitalPatch(targetId, fieldChanged, newValue);
        if (result) {
          await db
            .update(hospitals)
            .set({
              ...result.patch,
              updatedAt: new Date(),
              contributionCount: sql`${hospitals.contributionCount} + 1`,
            })
            .where(eq(hospitals.id, targetId));
          // Stamp contribution with true before/after so Edits history is accurate.
          await db
            .update(contributions)
            .set({ oldValue: result.before as Record<string, unknown>, newValue: result.patch as Record<string, unknown> })
            .where(eq(contributions.id, saved.id));
        }
      } else {
        const result = await normalizeDoctorPatch(targetId, fieldChanged, newValue);
        if (result) {
          await db
            .update(doctors)
            .set({
              ...result.patch,
              updatedAt: new Date(),
            })
            .where(eq(doctors.id, targetId));
          // Stamp contribution with true before/after so Edits history is accurate.
          await db
            .update(contributions)
            .set({ oldValue: result.before as Record<string, unknown>, newValue: result.patch as Record<string, unknown> })
            .where(eq(contributions.id, saved.id));
        }
      }
    }

    if (contributorId) {
      const delta = toTrustChange(outlier.recommendation);
      const approvedIncrement = outlier.recommendation === "auto_approve" ? 1 : 0;

      if (trust.length) {
        await db
          .update(contributorTrust)
          .set({
            totalEdits: sql`${contributorTrust.totalEdits} + 1`,
            approvedEdits: sql`${contributorTrust.approvedEdits} + ${approvedIncrement}`,
            rejectedEdits: sql`${contributorTrust.rejectedEdits}`,
            trustScore: Math.max(0, Math.min(100, (trust[0]?.trustScore ?? 50) + delta)),
            updatedAt: new Date(),
          })
          .where(eq(contributorTrust.contributorId, contributorId));
      } else {
        await db.insert(contributorTrust).values({
          contributorId,
          trustScore: Math.max(0, Math.min(100, 50 + delta)),
          totalEdits: 1,
          approvedEdits: approvedIncrement,
          rejectedEdits: 0,
        });
      }
    }

    // Write audit log for crowd edit submission
    await writeAuditLog({
      actorUserId: contributorId,
      action: `crowd.edit.${outlier.recommendation}`,
      entityType: normalizedTargetType,
      entityId: targetId,
      changes: {
        fieldChanged,
        oldValue: oldValue ?? null,
        newValue,
        outlierScore: outlier.score,
        outlierFlags: outlier.flags,
        contributionId: saved.id,
      },
    });

    return NextResponse.json({
      status: outlier.recommendation,
      contributionId: saved.id,
      outlier,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Contribution failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? "all";
  const targetType = req.nextUrl.searchParams.get("targetType");
  const targetId = req.nextUrl.searchParams.get("targetId");
  const limit = Math.min(200, Math.max(10, Number(req.nextUrl.searchParams.get("limit") ?? 100)));

  const filters: Array<SQL | undefined> = [
    status !== "all" ? eq(contributions.status, status) : undefined,
    targetType ? eq(contributions.targetType, targetType) : undefined,
    targetId ? eq(contributions.targetId, targetId) : undefined,
  ];

  const rows = await db
    .select({
      id: contributions.id,
      targetType: contributions.targetType,
      targetId: contributions.targetId,
      contributorId: contributions.contributorId,
      fieldChanged: contributions.fieldChanged,
      oldValue: contributions.oldValue,
      newValue: contributions.newValue,
      outlierScore: contributions.outlierScore,
      outlierFlags: contributions.outlierFlags,
      status: contributions.status,
      rejectReason: contributions.rejectReason,
      createdAt: contributions.createdAt,
      reviewedAt: contributions.reviewedAt,
    })
    .from(contributions)
    .where(and(...filters))
    .orderBy(desc(contributions.createdAt))
    .limit(limit);

  return NextResponse.json({ data: rows });
}
