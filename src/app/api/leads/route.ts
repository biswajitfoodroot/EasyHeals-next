import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { leads } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { ensureRole } from "@/lib/rbac";

const createLeadSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(6).max(20),
  email: z.string().email().optional(),
  city: z.string().min(2).max(80).optional(),
  source: z.string().min(2).max(50).default("web"),
  medicalSummary: z.string().max(2000).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "viewer"]);
  if (forbidden) return forbidden;

  const rows = await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(50);
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const payload = await req.json();
  const parsed = createLeadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation error",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const [lead] = await db
    .insert(leads)
    .values({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      city: parsed.data.city,
      source: parsed.data.source,
      medicalSummary: parsed.data.medicalSummary,
      assignedUserId: auth.userId,
      status: "new",
      score: 30,
    })
    .returning();

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "lead.create",
    entityType: "lead",
    entityId: lead.id,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    changes: { fullName: lead.fullName, phone: lead.phone, status: lead.status },
  });

  const [createdLead] = await db.select().from(leads).where(eq(leads.id, lead.id));
  return NextResponse.json({ data: createdLead }, { status: 201 });
}
