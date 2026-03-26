/**
 * POST /api/register/report-duplicate
 * Authenticated — submit a duplicate / deletion request.
 * The duplicate (to-be-removed) and the primary (to-be-kept) hospital IDs are both stored.
 * An admin must approve before anything is deleted.
 */
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { entityAccessRequests, hospitals, users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

const bodySchema = z.object({
  duplicateEntityId: z.string().uuid("Must be a valid hospital ID"),
  keepEntityId: z.string().uuid("Must be a valid hospital ID"),
  reason: z.string().min(10).max(1000),
  docUrls: z.array(z.string().url()).min(1, "At least one proof document is required"),
  phone: z.string().min(10).max(15),
  contactName: z.string().min(2).max(120),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json() as unknown;
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const { duplicateEntityId, keepEntityId, reason, docUrls, phone, contactName, notes } = parsed.data;

  if (duplicateEntityId === keepEntityId) {
    return NextResponse.json({ error: "Duplicate and primary listings cannot be the same" }, { status: 400 });
  }

  // Verify both hospitals exist
  const [dupHospital] = await db.select({ name: hospitals.name }).from(hospitals).where(eq(hospitals.id, duplicateEntityId)).limit(1);
  const [keepHospital] = await db.select({ name: hospitals.name }).from(hospitals).where(eq(hospitals.id, keepEntityId)).limit(1);

  if (!dupHospital) return NextResponse.json({ error: "Duplicate listing not found" }, { status: 404 });
  if (!keepHospital) return NextResponse.json({ error: "Primary listing not found" }, { status: 404 });

  // Save phone + name on user
  await db
    .update(users)
    .set({ phone, fullName: contactName, updatedAt: new Date() })
    .where(eq(users.id, auth.userId));

  const user = await db.select({ email: users.email }).from(users).where(eq(users.id, auth.userId)).limit(1);

  const notesPayload = JSON.stringify({
    duplicateEntityId,
    duplicateName: dupHospital.name,
    keepEntityId,
    keepName: keepHospital.name,
    reason,
    additionalNotes: notes ?? "",
  });

  const [inserted] = await db
    .insert(entityAccessRequests)
    .values({
      requesterId: auth.userId,
      entityType: "hospital",
      entityId: duplicateEntityId,
      requestType: "deletion_request",
      businessName: dupHospital.name,
      kycDocuments: docUrls,
      contactPhone: phone,
      contactEmail: user[0]?.email ?? "",
      notes: notesPayload,
      status: "pending",
    })
    .returning({ id: entityAccessRequests.id });

  return NextResponse.json({ data: { id: inserted.id, status: "pending" } }, { status: 201 });
}
