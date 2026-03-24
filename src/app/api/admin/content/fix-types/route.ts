import { eq, inArray, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { taxonomyNodes } from "@/db/schema";
import { SPECIALTIES } from "@/data/specialties-data";
import { TREATMENTS } from "@/data/treatments-data";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

const VALID_TYPES = new Set(["specialty", "treatment", "procedure", "condition", "department"]);

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  // Build slug → type lookup from static data
  const slugToType = new Map<string, string>();
  for (const s of SPECIALTIES) slugToType.set(s.slug, "specialty");
  for (const t of TREATMENTS) {
    // TREATMENTS type field is "treatment" or "procedure" based on static data
    const nodeType = (t as { type?: string }).type ?? "treatment";
    slugToType.set(t.slug, VALID_TYPES.has(nodeType) ? nodeType : "treatment");
  }

  // Find all nodes with missing or invalid types
  const allNodes = await db
    .select({ id: taxonomyNodes.id, slug: taxonomyNodes.slug, type: taxonomyNodes.type })
    .from(taxonomyNodes);

  const toFix = allNodes.filter(n => !n.type || !VALID_TYPES.has(n.type));

  if (toFix.length === 0) {
    return NextResponse.json({ fixed: 0, message: "All types already set correctly." });
  }

  const results: Array<{ slug: string; oldType: string; newType: string }> = [];

  for (const node of toFix) {
    const newType = slugToType.get(node.slug) ?? "treatment"; // default to treatment if unknown
    await db
      .update(taxonomyNodes)
      .set({ type: newType })
      .where(eq(taxonomyNodes.id, node.id));
    results.push({ slug: node.slug, oldType: node.type ?? "", newType });
  }

  return NextResponse.json({ fixed: results.length, results });
}
