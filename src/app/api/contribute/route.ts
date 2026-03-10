import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { contributions, contributorTrust, doctors, hospitals } from "@/db/schema";
import { scoreContribution } from "@/lib/outlier";

const contributionSchema = z.object({
  targetType: z.enum(["hospital", "doctor", "lab"]),
  targetId: z.string().min(3),
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

function normalizeHospitalPatch(field: string, value: unknown): Record<string, unknown> | null {
  switch (field.toLowerCase()) {
    case "name":
      return typeof value === "string" ? { name: value } : null;
    case "phone":
      return typeof value === "string" ? { phone: value } : null;
    case "email":
      return typeof value === "string" ? { email: value } : null;
    case "address":
    case "addressline1":
      return typeof value === "string" ? { addressLine1: value } : null;
    case "website":
      return typeof value === "string" ? { website: value } : null;
    case "description":
      return typeof value === "string" ? { description: value } : null;
    case "specialties":
      return Array.isArray(value) ? { specialties: value } : null;
    case "facilities":
      return Array.isArray(value) ? { facilities: value } : null;
    case "workinghours":
      return typeof value === "object" && value !== null ? { workingHours: value } : null;
    case "fees":
    case "feesrange":
      return typeof value === "object" && value !== null ? { feesRange: value } : null;
    default:
      return null;
  }
}

function normalizeDoctorPatch(field: string, value: unknown): Record<string, unknown> | null {
  switch (field.toLowerCase()) {
    case "name":
    case "fullname":
      return typeof value === "string" ? { fullName: value } : null;
    case "phone":
      return typeof value === "string" ? { phone: value } : null;
    case "email":
      return typeof value === "string" ? { email: value } : null;
    case "specialization":
      return typeof value === "string" ? { specialization: value } : null;
    case "specialties":
      return Array.isArray(value) ? { specialties: value } : null;
    case "qualifications":
      return Array.isArray(value) ? { qualifications: value } : null;
    case "languages":
      return Array.isArray(value) ? { languages: value } : null;
    case "consultationhours":
      return typeof value === "object" && value !== null ? { consultationHours: value } : null;
    case "consultationfee":
      return typeof value === "number" ? { consultationFee: value } : null;
    case "fee":
    case "feemin":
    case "feemax":
      if (typeof value === "object" && value !== null) {
        const record = value as Record<string, unknown>;
        return {
          feeMin: typeof record.min === "number" ? record.min : undefined,
          feeMax: typeof record.max === "number" ? record.max : undefined,
        };
      }
      return null;
    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const parsed = contributionSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid contribution", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { targetType, targetId, contributorId, fieldChanged, oldValue, newValue, changeType } =
      parsed.data;

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
        const patch = normalizeHospitalPatch(fieldChanged, newValue);
        if (patch) {
          await db
            .update(hospitals)
            .set({
              ...patch,
              updatedAt: new Date(),
              contributionCount: sql`${hospitals.contributionCount} + 1`,
            })
            .where(eq(hospitals.id, targetId));
        }
      } else {
        const patch = normalizeDoctorPatch(fieldChanged, newValue);
        if (patch) {
          await db
            .update(doctors)
            .set({
              ...patch,
              updatedAt: new Date(),
            })
            .where(eq(doctors.id, targetId));
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
