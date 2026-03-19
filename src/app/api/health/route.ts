/**
 * Task 1.5 — Health Check Endpoint
 * GET /api/health
 *
 * Returns system health: DB connectivity, AI client status, feature flags,
 * Gemini token usage counters, and overall status (ok | degraded).
 *
 * This endpoint is public (no auth required) so monitoring services can poll it.
 * Sensitive details (keys, DSNs) are never included in the response.
 */

import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { getTokenUsage } from "@/lib/ai/client";
import { getAllFlags } from "@/lib/config/feature-flags";

export const dynamic = "force-dynamic";

type ComponentStatus = "ok" | "error" | "degraded";

async function checkDb(): Promise<ComponentStatus> {
  try {
    await db.run(sql`SELECT 1`);
    return "ok";
  } catch {
    return "error";
  }
}

async function checkAi(): Promise<ComponentStatus> {
  try {
    const { getGeminiClient } = await import("@/lib/ai/client");
    getGeminiClient(); // throws if API key missing / client init fails
    return "ok";
  } catch {
    return "degraded";
  }
}

export async function GET(): Promise<Response> {
  const [dbStatus, aiStatus, flags] = await Promise.all([
    checkDb(),
    checkAi(),
    getAllFlags(),
  ]);

  const overallStatus: ComponentStatus =
    dbStatus === "error" ? "degraded" : "ok";

  const tokenUsage = getTokenUsage();

  const body = {
    status: overallStatus,
    db: dbStatus,
    ai: aiStatus,
    features: flags,
    tokenUsage: {
      calls: tokenUsage.calls,
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      lastResetAt: new Date(tokenUsage.lastResetAt).toISOString(),
    },
    ts: new Date().toISOString(),
  };

  return Response.json(body, {
    status: overallStatus === "ok" ? 200 : 503,
  });
}
