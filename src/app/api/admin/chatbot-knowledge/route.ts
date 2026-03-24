/**
 * Admin API — Chatbot Knowledge Base CRUD
 * GET    /api/admin/chatbot-knowledge?type=symptom|report|intent  → list entries
 * POST   /api/admin/chatbot-knowledge                             → create entry
 * PATCH  /api/admin/chatbot-knowledge                             → update entry
 * DELETE /api/admin/chatbot-knowledge?id=...                      → delete entry
 */
import { and, eq, asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { chatbotKnowledge, type ChatbotKnowledgeData } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { invalidateKnowledgeCache } from "@/lib/chatbot-knowledge";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "viewer"]);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? undefined;

  const rows = await db
    .select()
    .from(chatbotKnowledge)
    .where(type ? eq(chatbotKnowledge.type, type) : undefined)
    .orderBy(asc(chatbotKnowledge.type), asc(chatbotKnowledge.sortOrder));

  return NextResponse.json({ entries: rows, total: rows.length });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { type, key, aliases, data, sortOrder } = body as {
    type?: string;
    key?: string;
    aliases?: string[];
    data?: ChatbotKnowledgeData;
    sortOrder?: number;
  };

  if (!type || !key || !data) {
    return NextResponse.json({ error: "type, key, and data are required" }, { status: 400 });
  }

  const [entry] = await db
    .insert(chatbotKnowledge)
    .values({
      type: type.trim(),
      key: key.trim(),
      aliases: Array.isArray(aliases) ? aliases : [],
      data,
      isActive: true,
      sortOrder: sortOrder ?? 0,
    })
    .returning();

  invalidateKnowledgeCache();
  return NextResponse.json({ entry }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { id, key, aliases, data, isActive, sortOrder } = body as {
    id: string;
    key?: string;
    aliases?: string[];
    data?: ChatbotKnowledgeData;
    isActive?: boolean;
    sortOrder?: number;
  };

  const updates: Record<string, unknown> = {};
  if (key !== undefined) updates.key = key.trim();
  if (aliases !== undefined) updates.aliases = Array.isArray(aliases) ? aliases : [];
  if (data !== undefined) updates.data = data;
  if (isActive !== undefined) updates.isActive = isActive;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [entry] = await db
    .update(chatbotKnowledge)
    .set(updates)
    .where(eq(chatbotKnowledge.id, id))
    .returning();

  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  invalidateKnowledgeCache();
  return NextResponse.json({ entry });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const [deleted] = await db
    .delete(chatbotKnowledge)
    .where(eq(chatbotKnowledge.id, id))
    .returning({ id: chatbotKnowledge.id });

  if (!deleted) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  invalidateKnowledgeCache();
  return NextResponse.json({ success: true, id: deleted.id });
}
