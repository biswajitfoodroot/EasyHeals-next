import { and, desc, eq, like } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { phiSafeChanges, writeAuditLog } from "@/lib/audit";
import { ensureRole } from "@/lib/rbac";
import { slugify } from "@/lib/strings";

const createHospitalSchema = z.object({
  name: z.string().min(2).max(150),
  city: z.string().min(2).max(80),
  state: z.string().max(80).optional(),
  country: z.string().max(80).default("India"),
  addressLine1: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const city = req.nextUrl.searchParams.get("city");
  const search = req.nextUrl.searchParams.get("search");

  const filters = [];
  if (city) filters.push(eq(hospitals.city, city));
  if (search) filters.push(like(hospitals.name, `%${search}%`));

  const rows = await db
    .select()
    .from(hospitals)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(hospitals.createdAt))
    .limit(100);

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const payload = await req.json();
  const parsed = createHospitalSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 400 });
  }

  const baseSlug = slugify(parsed.data.name);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db.select({ id: hospitals.id }).from(hospitals).where(eq(hospitals.slug, slug)).limit(1);
    if (!existing.length) break;
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }

  const [created] = await db
    .insert(hospitals)
    .values({
      ...parsed.data,
      slug,
    })
    .returning();

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "hospital.create",
    entityType: "hospital",
    entityId: created.id,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    changes: phiSafeChanges(created),
  });

  return NextResponse.json({ data: created }, { status: 201 });
}

