import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { taxonomyNodes } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { ensureRole } from "@/lib/rbac";
import { slugify } from "@/lib/strings";

const updateTaxonomySchema = z.object({
  type: z.string().min(2).max(60).optional(),
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const { id } = await params;
  const payload = await req.json();
  const parsed = updateTaxonomySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 400 });
  }

  const patch: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.title) {
    patch.slug = slugify(parsed.data.title);
  }

  const [updated] = await db.update(taxonomyNodes).set(patch).where(eq(taxonomyNodes.id, id)).returning();

  if (!updated) {
    return NextResponse.json({ error: "Taxonomy node not found" }, { status: 404 });
  }

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "taxonomy.update",
    entityType: "taxonomy_node",
    entityId: id,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    changes: parsed.data,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const { id } = await params;

  const [updated] = await db
    .update(taxonomyNodes)
    .set({ isActive: false })
    .where(eq(taxonomyNodes.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Taxonomy node not found" }, { status: 404 });
  }

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "taxonomy.deactivate",
    entityType: "taxonomy_node",
    entityId: id,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    changes: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
