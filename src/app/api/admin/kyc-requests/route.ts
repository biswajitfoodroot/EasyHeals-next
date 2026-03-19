/**
 * GET  /api/admin/kyc-requests          — list all access requests (admin_manager / admin / owner)
 * PATCH /api/admin/kyc-requests/[id]    — approve / reject (admin_manager)
 */
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { entityAccessRequests, hospitals, userEntityPermissions, users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "admin_manager"]);
  if (forbidden) return forbidden;

  const status = req.nextUrl.searchParams.get("status"); // filter by status

  const rows = await db
    .select({
      id: entityAccessRequests.id,
      requesterId: entityAccessRequests.requesterId,
      entityType: entityAccessRequests.entityType,
      entityId: entityAccessRequests.entityId,
      businessName: entityAccessRequests.businessName,
      licenseNumber: entityAccessRequests.licenseNumber,
      licenseType: entityAccessRequests.licenseType,
      kycDocuments: entityAccessRequests.kycDocuments,
      contactPhone: entityAccessRequests.contactPhone,
      contactEmail: entityAccessRequests.contactEmail,
      notes: entityAccessRequests.notes,
      status: entityAccessRequests.status,
      reviewNotes: entityAccessRequests.reviewNotes,
      reviewedAt: entityAccessRequests.reviewedAt,
      approvedEntityId: entityAccessRequests.approvedEntityId,
      createdAt: entityAccessRequests.createdAt,
      requesterName: users.fullName,
      requesterEmail: users.email,
    })
    .from(entityAccessRequests)
    .innerJoin(users, eq(users.id, entityAccessRequests.requesterId))
    .where(status ? eq(entityAccessRequests.status, status) : undefined)
    .orderBy(desc(entityAccessRequests.createdAt));

  // Enrich with hospital/entity name if entityId is set
  const entityIds = rows.filter((r) => r.entityId).map((r) => r.entityId!);
  let entityNameMap = new Map<string, string>();
  if (entityIds.length) {
    const hRows = await db
      .select({ id: hospitals.id, name: hospitals.name })
      .from(hospitals);
    entityNameMap = new Map(hRows.map((h) => [h.id, h.name]));
  }

  const enriched = rows.map((r) => ({
    ...r,
    entityName: r.entityId ? (entityNameMap.get(r.entityId) ?? r.entityId) : null,
  }));

  return NextResponse.json({ data: enriched });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "admin_manager"]);
  if (forbidden) return forbidden;

  const body = await req.json() as {
    id: string;
    action: "approve" | "reject" | "under_review" | "info_requested";
    reviewNotes?: string;
    linkEntityId?: string; // admin_editor links to real entity on approve
  };

  if (!body.id || !body.action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  const [request] = await db
    .select()
    .from(entityAccessRequests)
    .where(eq(entityAccessRequests.id, body.id))
    .limit(1);

  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  const statusMap: Record<string, string> = {
    approve: "approved",
    reject: "rejected",
    under_review: "under_review",
    info_requested: "info_requested",
  };

  const newStatus = statusMap[body.action];
  if (!newStatus) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const approvedEntityId = body.action === "approve" ? (body.linkEntityId ?? request.entityId) : request.approvedEntityId;

  await db
    .update(entityAccessRequests)
    .set({
      status: newStatus,
      reviewedBy: auth.userId,
      reviewedAt: new Date(),
      reviewNotes: body.reviewNotes ?? null,
      approvedEntityId: approvedEntityId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(entityAccessRequests.id, body.id));

  // On approval: auto-link user to entity in user_entity_permissions
  if (body.action === "approve" && approvedEntityId) {
    await db
      .insert(userEntityPermissions)
      .values({
        id: crypto.randomUUID(),
        userId: request.requesterId,
        entityType: request.entityType,
        entityId: approvedEntityId,
        isPrimary: true,
        permissions: "edit",
      })
      .onConflictDoNothing();

    // Also update users.entityId if not already set
    const [user] = await db
      .select({ entityId: users.entityId })
      .from(users)
      .where(eq(users.id, request.requesterId))
      .limit(1);

    if (!user?.entityId) {
      await db
        .update(users)
        .set({ entityId: approvedEntityId, entityType: request.entityType, kycStatus: "approved" })
        .where(eq(users.id, request.requesterId));
    } else {
      await db
        .update(users)
        .set({ kycStatus: "approved" })
        .where(eq(users.id, request.requesterId));
    }
  }

  if (body.action === "reject") {
    await db
      .update(users)
      .set({ kycStatus: "rejected" })
      .where(eq(users.id, request.requesterId));
  }

  return NextResponse.json({ data: { id: body.id, status: newStatus } });
}
