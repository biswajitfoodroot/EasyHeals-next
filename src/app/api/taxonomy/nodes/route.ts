import { and, desc, eq, like } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { taxonomyNodes } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { ensureRole } from "@/lib/rbac";
import { slugify } from "@/lib/strings";

const createTaxonomyNodeSchema = z.object({
  type: z.string().min(2).max(60),
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const type = req.nextUrl.searchParams.get("type");
  const search = req.nextUrl.searchParams.get("search");

  const filters = [];
  if (type) filters.push(eq(taxonomyNodes.type, type));
  if (search) filters.push(like(taxonomyNodes.title, `%${search}%`));

  const rows = await db
    .select()
    .from(taxonomyNodes)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(taxonomyNodes.createdAt))
    .limit(200);

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const payload = await req.json();
  const parsed = createTaxonomyNodeSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 400 });
  }

  const baseSlug = slugify(parsed.data.title);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db
      .select({ id: taxonomyNodes.id })
      .from(taxonomyNodes)
      .where(eq(taxonomyNodes.slug, slug))
      .limit(1);

    if (!existing.length) break;
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }

  const [created] = await db
    .insert(taxonomyNodes)
    .values({
      type: parsed.data.type,
      title: parsed.data.title,
      slug,
      description: parsed.data.description,
    })
    .returning();

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "taxonomy.create",
    entityType: "taxonomy_node",
    entityId: created.id,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    changes: created,
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
