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

export type P1Flag = (typeof P1_FLAGS)[number];
export type P2Flag = (typeof P2_FLAGS)[number];
export type P3Flag = (typeof P3_FLAGS)[number];
export type FeatureFlagKey = P1Flag | P2Flag | P3Flag;

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
  const allKeys: string[] = [...P1_FLAGS, ...P2_FLAGS, ...P3_FLAGS];
  const entries = await Promise.all(
    allKeys.map(async (key) => [key, await isFeatureEnabled(key)] as const),
  );
  return Object.fromEntries(entries);
}
