/**
 * GET /api/admin/settings  — read current outlier thresholds
 * POST /api/admin/settings — update outlier thresholds (owner/admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { loadThresholds, saveThresholds } from "@/lib/outlier-config";

export function GET(req: NextRequest) {
  void req;
  const thresholds = loadThresholds();
  return NextResponse.json({ data: thresholds });
}

const thresholdsSchema = z.object({
  autoApproveMaxScore: z.number().int().min(0).max(100),
  autoApproveMinTrust: z.number().int().min(0).max(100),
  autoRejectMinScore: z.number().int().min(0).max(100),
  massEditBurstLimit: z.number().int().min(1).max(200),
  feeOutlierMax: z.number().int().min(1000),
  feeOutlierMin: z.number().int().min(0),
  semanticSuspiciousWeight: z.number().int().min(0).max(100),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const body = await req.json();
  const parsed = thresholdsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid thresholds", details: parsed.error.flatten() }, { status: 400 });
  }

  saveThresholds(parsed.data);
  return NextResponse.json({ data: parsed.data });
}
