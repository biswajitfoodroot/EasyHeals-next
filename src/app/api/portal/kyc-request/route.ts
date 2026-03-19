/**
 * POST /api/portal/kyc-request — provider submits KYC / access request
 * GET  /api/portal/kyc-request — provider checks status of their own request(s)
 */
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { entityAccessRequests, users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

const PHONE_RE = /^(\+91|0)?[6-9]\d{9}$/;

const submitSchema = z.object({
  entityType: z.enum(["hospital", "doctor", "clinic"]),
  entityId: z.string().uuid().optional(), // if claiming existing entity
  businessName: z.string().min(2).max(200),
  licenseNumber: z.string().min(1).max(100),
  licenseType: z.enum(["clinic", "hospital", "medical_practice"]),
  kycDocuments: z.array(z.string().url()).min(1, "At least one KYC document URL is required"),
  contactPhone: z
    .string()
    .refine((v) => PHONE_RE.test(v.replace(/\s/g, "")), {
      message: "Invalid Indian phone number",
    }),
  contactEmail: z.string().email(),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json() as unknown;
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const {
    entityType, entityId, businessName, licenseNumber, licenseType,
    kycDocuments, contactPhone, contactEmail, notes,
  } = parsed.data;

  // Update user kycStatus to "submitted"
  await db.update(users).set({ kycStatus: "submitted" }).where(eq(users.id, auth.userId));

  const id = crypto.randomUUID();
  await db.insert(entityAccessRequests).values({
    id,
    requesterId: auth.userId,
    entityType,
    entityId: entityId ?? null,
    businessName,
    licenseNumber,
    licenseType,
    kycDocuments,
    contactPhone,
    contactEmail,
    notes: notes ?? null,
    status: "pending",
  });

  return NextResponse.json({ data: { id, status: "pending" } }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select()
    .from(entityAccessRequests)
    .where(eq(entityAccessRequests.requesterId, auth.userId))
    .orderBy(desc(entityAccessRequests.createdAt));

  return NextResponse.json({ data: rows });
}
