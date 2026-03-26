import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { rolePermissions } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";

const VALID_LEVELS = ["full", "limited", "none"] as const;
type Level = typeof VALID_LEVELS[number];

function isLevel(v: unknown): v is Level {
  return VALID_LEVELS.includes(v as Level);
}

// ── GET — return all role permission rows ────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth || (auth.role !== "owner" && auth.role !== "admin" && auth.role !== "admin_manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db.select().from(rolePermissions).orderBy(rolePermissions.role);
  return NextResponse.json({ data: rows });
}

// ── POST — upsert one role's permissions ─────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth || (auth.role !== "owner" && auth.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden — only owner/admin can edit permissions" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.role || typeof body.role !== "string") {
    return NextResponse.json({ error: "Missing role" }, { status: 400 });
  }

  const { role, hospitals, doctors, aiResearch, providerMgmt, userMgmt, portal } = body as {
    role: string;
    hospitals: unknown; doctors: unknown; aiResearch: unknown;
    providerMgmt: unknown; userMgmt: unknown; portal: unknown;
  };

  if (!isLevel(hospitals) || !isLevel(doctors) || !isLevel(aiResearch) ||
      !isLevel(providerMgmt) || !isLevel(userMgmt) || !isLevel(portal)) {
    return NextResponse.json({ error: "All permission values must be full | limited | none" }, { status: 400 });
  }

  await db.insert(rolePermissions)
    .values({ role, hospitals, doctors, aiResearch, providerMgmt, userMgmt, portal, updatedAt: new Date(), updatedBy: auth.userId })
    .onConflictDoUpdate({
      target: rolePermissions.role,
      set: { hospitals, doctors, aiResearch, providerMgmt, userMgmt, portal, updatedAt: new Date(), updatedBy: auth.userId },
    });

  return NextResponse.json({ ok: true, role });
}
