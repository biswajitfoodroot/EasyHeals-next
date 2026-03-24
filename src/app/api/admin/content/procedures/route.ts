import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { taxonomyNodes, type TaxonomyNodeMeta } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { slugify } from "@/lib/strings";

// POST: confirms creation of a single procedure node after fuzzy-match review
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const slug = slugify(name);
  if (!slug) return NextResponse.json({ error: "Invalid procedure name" }, { status: 400 });

  const [existing] = await db
    .select({ id: taxonomyNodes.id, slug: taxonomyNodes.slug })
    .from(taxonomyNodes)
    .where(eq(taxonomyNodes.slug, slug))
    .limit(1);

  if (existing) {
    return NextResponse.json({ node: existing, action: "existed" });
  }

  const [created] = await db
    .insert(taxonomyNodes)
    .values({ slug, title: name, type: "procedure", isActive: true })
    .returning();

  return NextResponse.json({ node: created, action: "created" }, { status: 201 });
}

// PATCH: remap a procedure name in a parent node's metadata to an existing node's title
// When user clicks "Skip / Link to existing", replace the AI-suggested name with the
// existing node's title so the profile page link resolves to the existing slug.
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  const { parentNodeId, oldName, newName } = (body ?? {}) as {
    parentNodeId?: string;
    oldName?: string;
    newName?: string;
  };

  if (!parentNodeId || !oldName || !newName) {
    return NextResponse.json({ error: "parentNodeId, oldName and newName are required" }, { status: 400 });
  }

  const [parent] = await db
    .select({ id: taxonomyNodes.id, metadata: taxonomyNodes.metadata })
    .from(taxonomyNodes)
    .where(eq(taxonomyNodes.id, parentNodeId))
    .limit(1);

  if (!parent) return NextResponse.json({ error: "Parent node not found" }, { status: 404 });

  const meta: TaxonomyNodeMeta = parent.metadata ?? {};
  const procedures: string[] = Array.isArray(meta.relatedProcedures) ? meta.relatedProcedures : [];

  // Replace oldName with newName (case-insensitive match)
  const updated = procedures.map(p => p.trim().toLowerCase() === oldName.trim().toLowerCase() ? newName : p);
  const updatedMeta: TaxonomyNodeMeta = { ...meta, relatedProcedures: updated };

  await db
    .update(taxonomyNodes)
    .set({ metadata: updatedMeta })
    .where(eq(taxonomyNodes.id, parentNodeId));

  return NextResponse.json({ success: true, relatedProcedures: updated });
}
