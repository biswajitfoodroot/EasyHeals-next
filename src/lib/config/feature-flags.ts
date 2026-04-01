/**
 * Task 1.4 — Feature Flag System
 *
 * Resolution order:
 *   1. Environment variable EH_FLAG_{KEY}=1 (deploy-time override — highest priority)
 *   2. DB table `feature_flags` (runtime admin-controlled toggle)
 *   3. Hardcoded safe default (false for P2+, true for P1 core features)
 *
 * DB rows are cached in-process for 60s to avoid a DB hit on every request.
 * Cache is bypassed if Redis is available (Task 1.6 will wire that up).
 */

import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { featureFlags } from "@/db/schema";
import { eq } from "drizzle-orm";

// ─── Flag registries ──────────────────────────────────────────────────────────

/** P1 flags — ON by default (core soft-launch features) */
export const P1_FLAGS = [
  "patient_registration",     // OTP sign-up
  "lead_booking",             // /api/book (legacy)
  "fts_search",               // FTS5 full-text search
  "audit_logging",            // audit_logs table writes
  "gamification_points",      // point events (Phase A — passive)
] as const;

/** P2 flags — OFF by default (require explicit DB row to enable) */
export const P2_FLAGS = [
  "appointment_booking",      // real slot booking
  "whatsapp_notifications",   // WhatsApp Business API
  "token_queue",              // live queue management
  "mass_broadcast",           // broadcast tool
  "gamification_phase_b",     // verified appointment/review events
  "paid_membership",          // patient paid tier
  "provider_analytics",       // analytics dashboard
  "crm_integration",          // event bus + webhooks
] as const;

/** P3 flags — OFF; require gate checklist before enabling */
export const P3_FLAGS = [
  "emr_lite",                 // electronic medical records
  "lab_test_ordering",        // lab integrations
  "video_consultation",       // full multi-participant video room
] as const;

/** P5 flags — OFF by default; enable per capsule as ready */
export const P5_FLAGS = [
  "health_memory",            // document upload + health events timeline
  "ai_health_coach",          // AI Health Coach chat (SSE streaming)
  "ai_learning",              // RAG embeddings + profile synthesis
  "previsit_brief",           // pre-visit brief for doctors
  "document_sharing",         // time-limited patient→provider doc shares
  "abha_integration",         // ABHA Health ID (OFF until ABDM credentials ready)
  "booking_v2",               // full 4-step booking wizard (/book/[id])
  "gamification_ui",          // rewards page + leaderboard
  "session_sliding",          // sliding window session TTL (extends on activity)
  "care_nav",                 // AI care navigation / triage
] as const;

/** P6 flags — OFF by default; Care Nav + Wearables + Conversion + Reminders + Referrals + Provider Insights */
export const P6_FLAGS = [
  "wearable_sync",            // wearable data import (Phase A: file upload; Phase B: native SDK)
  "conversion_analytics",     // funnel analytics dashboard for admins
  "smart_reminders",          // AI-generated medication + appointment reminders
  "referral_engine",          // refer-a-friend with tracked attribution
  "provider_insights",        // hospital/doctor analytics portal (own stats only)
] as const;

export type P1Flag = (typeof P1_FLAGS)[number];
export type P2Flag = (typeof P2_FLAGS)[number];
export type P3Flag = (typeof P3_FLAGS)[number];
export type P5Flag = (typeof P5_FLAGS)[number];
export type P6Flag = (typeof P6_FLAGS)[number];
export type FeatureFlagKey = P1Flag | P2Flag | P3Flag | P5Flag | P6Flag;

// ─── In-process cache (60s TTL) ───────────────────────────────────────────────

type CacheEntry = { value: boolean; expiresAt: number };
const _cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function getCached(key: string): boolean | undefined {
  const entry = _cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached(key: string, value: boolean): void {
  _cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Invalidate the in-process cache (useful in tests or after admin toggle). */
export function invalidateFlagCache(key?: string): void {
  if (key) {
    _cache.delete(key);
  } else {
    _cache.clear();
  }
}

// ─── Core resolver ────────────────────────────────────────────────────────────

function hardcodedDefault(key: string): boolean {
  return (P1_FLAGS as readonly string[]).includes(key);
}

/**
 * Guard for API route handlers. Returns a 423 response if the feature is disabled,
 * or null if enabled (caller should continue).
 *
 * Usage:
 *   const flagCheck = await requireFeatureFlag('health_memory')
 *   if (flagCheck) return flagCheck
 */
export async function requireFeatureFlag(key: string): Promise<NextResponse | null> {
  const enabled = await isFeatureEnabled(key);
  if (!enabled) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_DISABLED", feature: key },
      { status: 423 },
    );
  }
  return null;
}

/**
 * Returns true if the feature flag `key` is enabled.
 *
 * Resolution: env var EH_FLAG_{KEY} → DB row → hardcoded default.
 * Env var takes highest priority so Vercel / deploy-time overrides always win.
 * Result is cached in-process for 60 seconds.
 */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  // 1. In-process cache
  const cached = getCached(key);
  if (cached !== undefined) return cached;

  // 2. Environment variable override (highest priority — deploy-time wins)
  const envKey = `EH_FLAG_${key.toUpperCase()}`;
  const envVal = process.env[envKey];
  if (envVal !== undefined) {
    const value = envVal === "1" || envVal === "true";
    setCached(key, value);
    return value;
  }

  // 3. DB lookup (runtime toggle via admin UI)
  try {
    const rows = await db
      .select({ enabled: featureFlags.enabled })
      .from(featureFlags)
      .where(eq(featureFlags.key, key))
      .limit(1);

    if (rows.length > 0) {
      const value = !!rows[0].enabled;
      setCached(key, value);
      return value;
    }
  } catch {
    // DB unavailable — fall through to hardcoded default
  }

  // 4. Hardcoded default
  const value = hardcodedDefault(key);
  setCached(key, value);
  return value;
}

/** Alias for isFeatureEnabled — preferred name in route handlers. */
export const getFeatureFlag = isFeatureEnabled;

/**
 * Fetch all known flags at once (used by /api/health).
 * Returns a record of key → boolean.
 */
export async function getAllFlags(): Promise<Record<string, boolean>> {
  const allKeys: string[] = [...P1_FLAGS, ...P2_FLAGS, ...P3_FLAGS, ...P5_FLAGS, ...P6_FLAGS];
  const entries = await Promise.all(
    allKeys.map(async (key) => [key, await isFeatureEnabled(key)] as const),
  );
  return Object.fromEntries(entries);
}
