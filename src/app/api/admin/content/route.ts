import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { taxonomyNodes, type TaxonomyNodeMeta } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { slugify } from "@/lib/strings";

export type ProcedureCandidate = {
  name: string;
  proposedSlug: string;
  parentNodeId: string;
  similarNode: { id: string; slug: string; title: string; type: string };
};

// Word overlap score for fuzzy matching (Jaccard on meaningful words)
function wordOverlapScore(a: string, b: string): number {
  const stopWords = new Set(["of", "and", "the", "for", "in", "by", "with", "a", "an", "to"]);
  const toWords = (s: string): Set<string> =>
    new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w)));
  const wa = toWords(a);
  const wb = toWords(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  const intersection = [...wa].filter(w => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return intersection / union;
}

// GET: returns all taxonomy nodes (all types)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "viewer"]);
  if (forbidden) return forbidden;

  const rows = await db
    .select({
      id: taxonomyNodes.id,
      slug: taxonomyNodes.slug,
      title: taxonomyNodes.title,
      type: taxonomyNodes.type,
      description: taxonomyNodes.description,
      metadata: taxonomyNodes.metadata,
      isActive: taxonomyNodes.isActive,
    })
    .from(taxonomyNodes)
    .orderBy(taxonomyNodes.title);

  const nodes = rows.map(r => ({
    ...r,
    hasAiContent: !!(r.metadata && Object.keys(r.metadata).length > 0),
  }));

  return NextResponse.json({ nodes });
}

// POST: creates a new taxonomy node
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { title, type, description } = body as { title?: string; type?: string; description?: string };
  if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!type?.trim()) return NextResponse.json({ error: "type is required" }, { status: 400 });

  const slug = slugify(`${type}-${title}`);

  const [node] = await db
    .insert(taxonomyNodes)
    .values({
      slug,
      title: title.trim(),
      type: type.trim(),
      description: description?.trim() ?? null,
      isActive: true,
    })
    .returning();

  return NextResponse.json({ node }, { status: 201 });
}

// PATCH: updates title, description, type, isActive for a node (by id)
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { id, title, description, type, isActive, metadata } = body as {
    id?: string;
    title?: string;
    description?: string;
    type?: string;
    isActive?: boolean;
    metadata?: TaxonomyNodeMeta;
  };

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const updates: Partial<{ title: string; description: string | null; type: string; isActive: boolean; metadata: TaxonomyNodeMeta | null }> = {};
  if (title !== undefined) updates.title = title.trim();
  if (description !== undefined) updates.description = description?.trim() ?? null;
  if (type !== undefined) updates.type = type.trim();
  if (isActive !== undefined) updates.isActive = isActive;
  if (metadata !== undefined) updates.metadata = metadata ?? null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [node] = await db
    .update(taxonomyNodes)
    .set(updates)
    .where(eq(taxonomyNodes.id, id))
    .returning();

  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  // Deduplicate relatedProcedures by slug (normalised)
  const rawNames: string[] = Array.isArray(metadata?.relatedProcedures) ? metadata.relatedProcedures : [];
  const seenSlugs = new Set<string>();
  const procedureNames: string[] = [];
  for (const n of rawNames) {
    const s = slugify(n.trim());
    if (s && !seenSlugs.has(s)) {
      seenSlugs.add(s);
      procedureNames.push(n.trim());
    }
  }

  const procedureUpsertResults: Array<{ slug: string; title: string; action: "created" | "existed" }> = [];
  const procedureCandidates: ProcedureCandidate[] = [];

  if (procedureNames.length > 0) {
    // Fetch all existing nodes for fuzzy comparison
    const allNodes = await db
      .select({ id: taxonomyNodes.id, slug: taxonomyNodes.slug, title: taxonomyNodes.title, type: taxonomyNodes.type })
      .from(taxonomyNodes);
    const slugToNode = new Map(allNodes.map(n => [n.slug, n]));

    for (const procName of procedureNames) {
      const proposedSlug = slugify(procName);
      if (!proposedSlug) continue;

      // Exact slug match → already exists
      if (slugToNode.has(proposedSlug)) {
        procedureUpsertResults.push({ slug: proposedSlug, title: procName, action: "existed" });
        continue;
      }

      // Fuzzy match: best word-overlap against all existing node titles
      let bestScore = 0;
      let bestNode: { id: string; slug: string; title: string; type: string } | null = null;
      for (const existing of allNodes) {
        const score = wordOverlapScore(procName, existing.title);
        if (score > bestScore) { bestScore = score; bestNode = existing; }
      }

      if (bestScore >= 0.5 && bestNode) {
        // Near-match: surface for user verification, don't auto-create
        procedureCandidates.push({ name: procName, proposedSlug, parentNodeId: node.id, similarNode: bestNode });
      } else {
        // No match → auto-create
        await db.insert(taxonomyNodes).values({ slug: proposedSlug, title: procName, type: "procedure", isActive: true }).onConflictDoNothing();
        procedureUpsertResults.push({ slug: proposedSlug, title: procName, action: "created" });
      }
    }
  }

  return NextResponse.json({ node, proceduresUpserted: procedureUpsertResults, procedureCandidates });
}

// DELETE: deletes a node (by id in query param)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  // Only owner/admin can delete
  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query param is required" }, { status: 400 });

  const [deleted] = await db
    .delete(taxonomyNodes)
    .where(eq(taxonomyNodes.id, id))
    .returning({ id: taxonomyNodes.id });

  if (!deleted) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  return NextResponse.json({ success: true, id: deleted.id });
}
