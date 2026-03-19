/**
 * GET /api/v1/leaderboard/:city
 *
 * P2 Day 3 — City leaderboard (HLD §6.2).
 *
 * Returns top-N patients by totalPoints in a given city.
 * Patient privacy:
 *   - Only displayAlias is shown (e.g. "Priya ****23") — no phone, no full name
 *   - leaderboardOptOut=true patients are excluded
 *   - Zero-point patients are excluded
 *
 * Cache strategy:
 *   - Redis key: `leaderboard:{city}` — JSON, TTL 3600s (1h)
 *   - Refreshed by /api/cron/refresh-leaderboard (hourly) or on cache miss
 *
 * Query params:
 *   ?limit=10   (max 50)
 *
 * Auth: public (no auth required — leaderboard is a trust/engagement signal)
 */

import { and, desc, eq, gt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { userPoints, patients } from "@/db/schema";
import { getRedisClient } from "@/lib/core/redis";

export const dynamic = "force-dynamic";

const CACHE_TTL_SECONDS = 3600; // 1 hour
const MAX_LIMIT = 50;

interface LeaderboardEntry {
  rank: number;
  displayAlias: string;
  totalPoints: number;
  level: number;
  city: string;
}

interface CachedLeaderboard {
  entries: LeaderboardEntry[];
  cachedAt: string;
  city: string;
}

async function fetchFromDb(city: string, limit: number): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select({
      actorId: userPoints.actorId,
      totalPoints: userPoints.totalPoints,
      level: userPoints.level,
      displayAlias: patients.displayAlias,
      city: patients.city,
      leaderboardOptOut: patients.leaderboardOptOut,
    })
    .from(userPoints)
    .innerJoin(
      patients,
      and(
        eq(userPoints.actorId, patients.id),
        eq(userPoints.actorType, "patient"),
      ),
    )
    .where(
      and(
        eq(patients.city, city),
        eq(patients.leaderboardOptOut, false),
        gt(userPoints.totalPoints, 0),
      ),
    )
    .orderBy(desc(userPoints.totalPoints))
    .limit(limit);

  return rows.map((row, i) => ({
    rank: i + 1,
    displayAlias: row.displayAlias ?? `Patient #${String(row.actorId).slice(-4)}`,
    totalPoints: row.totalPoints,
    level: row.level,
    city: row.city ?? city,
  }));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ city: string }> },
) {
  const { city } = await params;
  const decodedCity = decodeURIComponent(city).toLowerCase().trim();

  if (!decodedCity || decodedCity.length > 50) {
    return NextResponse.json({ error: "Invalid city parameter" }, { status: 400 });
  }

  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10) || 10,
    MAX_LIMIT,
  );

  const cacheKey = `leaderboard:${decodedCity}:${limit}`;
  const redis = getRedisClient();

  // Try cache first
  if (redis) {
    try {
      const cached = await redis.get<CachedLeaderboard>(cacheKey);
      if (cached) {
        return NextResponse.json({
          data: cached.entries,
          city: cached.city,
          total: cached.entries.length,
          cachedAt: cached.cachedAt,
          fromCache: true,
        });
      }
    } catch {
      // Redis error — fall through to DB
    }
  }

  // Fetch from DB
  const entries = await fetchFromDb(decodedCity, limit);
  const cachedAt = new Date().toISOString();

  // Populate cache (non-blocking)
  if (redis) {
    redis
      .set(cacheKey, { entries, cachedAt, city: decodedCity } satisfies CachedLeaderboard, {
        ex: CACHE_TTL_SECONDS,
      })
      .catch(() => {});
  }

  return NextResponse.json({
    data: entries,
    city: decodedCity,
    total: entries.length,
    cachedAt,
    fromCache: false,
  });
}
