/**
 * Upstash Redis singleton with circuit breaker.
 *
 * Returns null when Redis is not configured (UPSTASH_REDIS_REST_URL is empty).
 * All callers must handle the null case gracefully — Redis is optional in P1.
 *
 * Circuit breaker: after 3 consecutive failures, skip Redis for 30s.
 */

import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

let _client: Redis | null = null;
let _failCount = 0;
let _circuitOpenUntil = 0;
const FAIL_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 30_000;

function isCircuitOpen(): boolean {
  if (_failCount >= FAIL_THRESHOLD && Date.now() < _circuitOpenUntil) {
    return true;
  }
  if (Date.now() >= _circuitOpenUntil) {
    _failCount = 0; // reset after cooldown
  }
  return false;
}

function recordFailure(): void {
  _failCount++;
  if (_failCount >= FAIL_THRESHOLD) {
    _circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
  }
}

function recordSuccess(): void {
  _failCount = 0;
}

/**
 * Returns the Redis client, or null if Redis is not configured or circuit is open.
 */
export function getRedisClient(): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (isCircuitOpen()) {
    return null;
  }
  if (!_client) {
    _client = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _client;
}

/**
 * Safe Redis GET with circuit breaker. Returns null on any error.
 */
export async function redisGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const result = await redis.get<T>(key);
    recordSuccess();
    return result;
  } catch {
    recordFailure();
    return null;
  }
}

/**
 * Safe Redis SET with optional TTL (seconds). No-op on error.
 */
export async function redisSet(
  key: string,
  value: unknown,
  ttlSeconds?: number,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    if (ttlSeconds !== undefined) {
      await redis.set(key, value, { ex: ttlSeconds });
    } else {
      await redis.set(key, value);
    }
    recordSuccess();
  } catch {
    recordFailure();
  }
}

/**
 * Atomically increments a counter key and sets TTL on first increment.
 * Returns the new count, or null if Redis is unavailable.
 *
 * Uses INCR (atomic) then EXPIRE on count===1 — standard sliding window pattern.
 * TTL is only set on first call to preserve the original window expiry.
 */
export async function redisIncr(key: string, ttlSeconds: number): Promise<number | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ttlSeconds);
    }
    recordSuccess();
    return count;
  } catch {
    recordFailure();
    return null;
  }
}

/**
 * Safe Redis DEL. No-op on error.
 */
export async function redisDel(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.del(key);
    recordSuccess();
  } catch {
    recordFailure();
  }
}
