/**
 * System Config
 *
 * getConfig(key) resolution order:
 *   1. Redis cache (60s TTL) — if Redis is configured
 *   2. DB `system_config` table
 *   3. Hardcoded defaults (safe fallbacks for P1 launch)
 *
 * Used for runtime-tunable settings like rate limits, OTP TTL,
 * lead dedup window, etc. without requiring a redeploy.
 */

import { db } from "@/db/client";
import { systemConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redisGet, redisSet } from "@/lib/core/redis";

const REDIS_TTL_SECONDS = 60;
const REDIS_PREFIX = "syscfg:";

// Hardcoded safe defaults — override via DB rows
const DEFAULTS: Record<string, string> = {
  otp_ttl_seconds: "300",             // 5 minutes
  otp_max_attempts: "3",
  lead_dedup_window_seconds: "604800", // 7 days
  rate_limit_lead_per_hour: "5",
  rate_limit_otp_per_phone_per_hour: "3",
  max_hospitals_per_page: "20",
  ai_timeout_ms: "8000",
};

/**
 * Get a system config value as a string.
 * Returns the hardcoded default if not found in Redis or DB.
 */
export async function getConfig(key: string): Promise<string> {
  // 1. Redis cache
  const cached = await redisGet<string>(`${REDIS_PREFIX}${key}`);
  if (cached !== null) return cached;

  // 2. DB lookup
  try {
    const rows = await db
      .select({ value: systemConfig.value })
      .from(systemConfig)
      .where(eq(systemConfig.key, key))
      .limit(1);

    if (rows.length > 0 && rows[0].value !== null) {
      await redisSet(`${REDIS_PREFIX}${key}`, rows[0].value, REDIS_TTL_SECONDS);
      return rows[0].value;
    }
  } catch {
    // DB unavailable — fall through to default
  }

  // 3. Hardcoded default
  return DEFAULTS[key] ?? "";
}

/**
 * Get a config value parsed as an integer. Returns defaultValue on parse failure.
 */
export async function getConfigInt(
  key: string,
  defaultValue: number,
): Promise<number> {
  const raw = await getConfig(key);
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get a config value parsed as a boolean. "true" | "1" → true.
 */
export async function getConfigBool(
  key: string,
  defaultValue = false,
): Promise<boolean> {
  const raw = await getConfig(key);
  if (!raw) return defaultValue;
  return raw === "true" || raw === "1";
}
