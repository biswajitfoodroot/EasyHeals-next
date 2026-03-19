import { and, eq, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import {
  ingestionDoctorCandidates,
  ingestionHospitalCandidates,
  ingestionPackageCandidates,
  ingestionServiceCandidates,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

const actionSchema = z.object({
  entityType: z.enum(["hospital", "doctor", "service", "package"]),
  entityId: z.string().min(8),
  action: z.enum(["edit", "approve", "reject", "delete"]),
  patch: z.record(z.string(), z.unknown()).optional(),
});

function cleanPatch(patch: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!patch) return {};
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    out[key] = value;
  }

  return out;
}

async function runHospitalAction(entityId: string, action: string, patch: Record<string, unknown>, userId: string) {
  if (action === "edit") {
    const [row] = await db
      .update(ingestionHospitalCandidates)
      .set({
        ...patch,
        applyStatus: "draft",
        reviewStatus: "draft",
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(ingestionHospitalCandidates.id, entityId))
      .returning();
    return row;
  }

  const statusMap = {
    approve: { applyStatus: "approved", reviewStatus: "approved" },
    reject: { applyStatus: "rejected", reviewStatus: "rejected" },
    delete: { applyStatus: "deleted", reviewStatus: "deleted" },
  } as const;

  const [row] = await db
    .update(ingestionHospitalCandidates)
    .set({
      ...statusMap[action as keyof typeof statusMap],
      reviewedByUserId: userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ingestionHospitalCandidates.id, entityId))
    .returning();

  return row;
}

async function runDoctorAction(entityId: string, action: string, patch: Record<string, unknown>, userId: string) {
  if (action === "edit") {
    const [row] = await db
      .update(ingestionDoctorCandidates)
      .set({
        ...patch,
        applyStatus: "draft",
        reviewStatus: "draft",
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(ingestionDoctorCandidates.id, entityId))
      .returning();
    return row;
  }

  const statusMap = {
    approve: { applyStatus: "approved", reviewStatus: "approved" },
    reject: { applyStatus: "rejected", reviewStatus: "rejected" },
    delete: { applyStatus: "deleted", reviewStatus: "deleted" },
  } as const;

  const [row] = await db
    .update(ingestionDoctorCandidates)
    .set({
      ...statusMap[action as keyof typeof statusMap],
      reviewedByUserId: userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ingestionDoctorCandidates.id, entityId))
    .returning();

  return row;
}

async function runServiceAction(entityId: string, action: string, patch: Record<string, unknown>, userId: string) {
  if (action === "edit") {
    const [row] = await db
      .update(ingestionServiceCandidates)
      .set({
        ...patch,
        applyStatus: "draft",
        reviewStatus: "draft",
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(ingestionServiceCandidates.id, entityId))
      .returning();
    return row;
  }

  const statusMap = {
    approve: { applyStatus: "approved", reviewStatus: "approved" },
    reject: { applyStatus: "rejected", reviewStatus: "rejected" },
    delete: { applyStatus: "deleted", reviewStatus: "deleted" },
  } as const;

  const [row] = await db
    .update(ingestionServiceCandidates)
    .set({
      ...statusMap[action as keyof typeof statusMap],
      reviewedByUserId: userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ingestionServiceCandidates.id, entityId))
    .returning();

  return row;
}

async function runPackageAction(entityId: string, action: string, patch: Record<string, unknown>, userId: string) {
  if (action === "edit") {
    const [row] = await db
      .update(ingestionPackageCandidates)
      .set({
        ...patch,
        applyStatus: "draft",
        reviewStatus: "draft",
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(ingestionPackageCandidates.id, entityId))
      .returning();
    return row;
  }

  const statusMap = {
    approve: { applyStatus: "approved", reviewStatus: "approved" },
    reject: { applyStatus: "rejected", reviewStatus: "rejected" },
    delete: { applyStatus: "deleted", reviewStatus: "deleted" },
  } as const;

  const [row] = await db
    .update(ingestionPackageCandidates)
    .set({
      ...statusMap[action as keyof typeof statusMap],
      reviewedByUserId: userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ingestionPackageCandidates.id, entityId))
    .returning();

  return row;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const payload = await req.json();
  const parsed = actionSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review action", details: parsed.error.flatten() }, { status: 400 });
  }

  const { entityType, entityId, action } = parsed.data;
  const patch = cleanPatch(parsed.data.patch);

  let updated: unknown = null;

  if (entityType === "hospital") {
    updated = await runHospitalAction(entityId, action, patch, auth.userId);
  } else if (entityType === "doctor") {
    updated = await runDoctorAction(entityId, action, patch, auth.userId);
  } else if (entityType === "service") {
    updated = await runServiceAction(entityId, action, patch, auth.userId);
  } else {
    updated = await runPackageAction(entityId, action, patch, auth.userId);
  }

  if (!updated) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  return NextResponse.json({ data: updated });
}

// ═══════════════════════════════════════════════════════════════════════════════
// BULK ACTIONS — PUT /api/admin/ingestion/review
// ═══════════════════════════════════════════════════════════════════════════════

const bulkActionSchema = z.object({
  jobId: z.string().min(8),
  entityType: z.enum(["hospital", "doctor", "service", "package", "all"]),
  action: z.enum(["approve", "reject", "delete"]),
  /** Optional: only apply to candidates BELOW this confidence threshold (for reject) */
  confidenceThreshold: z.number().min(0).max(1).optional(),
});

const TABLE_MAP = {
  hospital: ingestionHospitalCandidates,
  doctor: ingestionDoctorCandidates,
  service: ingestionServiceCandidates,
  package: ingestionPackageCandidates,
} as const;

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const payload = await req.json();
  const parsed = bulkActionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid bulk action", details: parsed.error.flatten() }, { status: 400 });
  }

  const { jobId, entityType, action, confidenceThreshold } = parsed.data;
  const statusMap = {
    approve: { applyStatus: "approved" as const, reviewStatus: "approved" as const },
    reject: { applyStatus: "rejected" as const, reviewStatus: "rejected" as const },
    delete: { applyStatus: "deleted" as const, reviewStatus: "deleted" as const },
  };

  const setPayload = {
    ...statusMap[action],
    reviewedByUserId: auth.userId,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  };

  let totalUpdated = 0;

  const typesToProcess = entityType === "all"
    ? (["hospital", "doctor", "service", "package"] as const)
    : [entityType] as const;

  for (const type of typesToProcess) {
    const table = TABLE_MAP[type];

    // Build conditions: must be in this job + not already processed
    const conditions = [
      eq(table.jobId, jobId),
    ];

    // For confidence-based filtering (e.g., reject all below 0.5)
    if (confidenceThreshold !== undefined && action === "reject" && "aiConfidence" in table) {
      conditions.push(lt(table.aiConfidence, confidenceThreshold));
    }

    const result = await db
      .update(table)
      .set(setPayload)
      .where(and(...conditions))
      .returning({ id: table.id });

    totalUpdated += result.length;
  }

  return NextResponse.json({
    data: { action, entityType, totalUpdated },
  });
}
