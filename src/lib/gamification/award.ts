/**
 * src/lib/gamification/award.ts
 *
 * Core gamification engine — Phase A (passive events, HLD §6.1).
 *
 * awardPoints() is:
 *   - Idempotent: (eventType, proofId) unique index prevents double-award
 *   - Capped: per-event daily/weekly caps enforced before insert
 *   - Abuse-checked: flagged actors are silently skipped (no points, no error)
 *   - Streak-aware: DAILY_CHECKIN updates streaks table
 *
 * Phase-A events and default point values (overridable via gamification_config table):
 *   PROFILE_COMPLETED    50pts  (once per patient)
 *   CONSENT_GRANTED      10pts  (once per purpose)
 *   NEWS_READ_5          30pts  (once per week)
 *   DAILY_CHECKIN        10pts  (once per day)
 *   PROFILE_PHOTO_ADDED  20pts  (once per patient)
 *   SHARE_PROFILE        10pts  (max 3/day)
 *
 * Phase-B events (appointment/review verified by CRM) are gated behind
 * the `gamification_phase_b` feature flag — they arrive via CRM outbox.
 */

import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  pointEvents,
  userPoints,
  streaks,
  gamificationConfig,
  abuseFlags,
  badges,
  userBadges,
} from "@/db/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ActorType = "patient" | "user";

export type PhaseAEventType =
  | "PROFILE_COMPLETED"
  | "CONSENT_GRANTED"
  | "NEWS_READ_5"
  | "DAILY_CHECKIN"
  | "PROFILE_PHOTO_ADDED"
  | "SHARE_PROFILE";

export interface AwardPointsInput {
  actorId: string;
  actorType: ActorType;
  eventType: PhaseAEventType;
  /** Idempotency key — unique per eventType. Examples:
   *  PROFILE_COMPLETED  → patientId
   *  CONSENT_GRANTED    → `${patientId}:${purpose}`
   *  NEWS_READ_5        → `${patientId}:${weekISO}`   e.g. "2026-W11"
   *  DAILY_CHECKIN      → `${patientId}:${YYYY-MM-DD}`
   *  PROFILE_PHOTO_ADDED → patientId
   *  SHARE_PROFILE       → `${patientId}:${YYYY-MM-DD}:${n}`
   */
  proofId: string;
  proofType: string;
  deviceFpHash?: string;
}

export interface AwardResult {
  awarded: boolean;
  points: number;
  totalPoints: number;
  reason?: string; // if awarded=false, why
}

// ─────────────────────────────────────────────────────────────────────────────
// Default point values (overridden by gamification_config table)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_POINTS: Record<PhaseAEventType, number> = {
  PROFILE_COMPLETED: 50,
  CONSENT_GRANTED: 10,
  NEWS_READ_5: 30,
  DAILY_CHECKIN: 10,
  PROFILE_PHOTO_ADDED: 20,
  SHARE_PROFILE: 10,
};

// Per-event daily caps (0 = no cap / one-time events handled by proofId uniqueness)
const DAILY_CAPS: Partial<Record<PhaseAEventType, number>> = {
  SHARE_PROFILE: 3,   // max 3 share events per day
  DAILY_CHECKIN: 1,   // proofId already encodes date, but belt+suspenders
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Load admin-configured point value, falling back to DEFAULT_POINTS. */
async function resolvePoints(eventType: PhaseAEventType): Promise<number> {
  try {
    const rows = await db
      .select({ value: gamificationConfig.value })
      .from(gamificationConfig)
      .where(eq(gamificationConfig.key, `points.${eventType}`))
      .limit(1);
    if (rows.length > 0) {
      const parsed = parseInt(rows[0].value, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch {
    // DB error — use default
  }
  return DEFAULT_POINTS[eventType];
}

/** Returns true if actor has an active abuse flag. */
async function isAbuseFlagged(actorId: string, actorType: ActorType): Promise<boolean> {
  try {
    const rows = await db
      .select({ id: abuseFlags.id })
      .from(abuseFlags)
      .where(
        and(
          eq(abuseFlags.actorId, actorId),
          eq(abuseFlags.actorType, actorType),
          // null resolvedAt = still active flag
          sql`${abuseFlags.resolvedAt} IS NULL`,
        ),
      )
      .limit(1);
    return rows.length > 0;
  } catch {
    return false; // fail open — don't block legitimate actors on DB error
  }
}

/** Count how many times actor fired eventType today (UTC). */
async function dailyCount(
  actorId: string,
  actorType: ActorType,
  eventType: PhaseAEventType,
): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  try {
    const rows = await db
      .select({ id: pointEvents.id })
      .from(pointEvents)
      .where(
        and(
          eq(pointEvents.actorId, actorId),
          eq(pointEvents.actorType, actorType),
          eq(pointEvents.eventType, eventType),
          gte(pointEvents.createdAt, todayStart),
        ),
      );
    return rows.length;
  } catch {
    return 0;
  }
}

/** Upsert user_points — add delta to totalPoints + lifetimePoints, update level. */
async function upsertUserPoints(
  actorId: string,
  actorType: ActorType,
  delta: number,
): Promise<number> {
  // Try update first
  const existing = await db
    .select({ totalPoints: userPoints.totalPoints, lifetimePoints: userPoints.lifetimePoints })
    .from(userPoints)
    .where(and(eq(userPoints.actorId, actorId), eq(userPoints.actorType, actorType)))
    .limit(1);

  if (existing.length > 0) {
    const newTotal = existing[0].totalPoints + delta;
    const newLifetime = existing[0].lifetimePoints + delta;
    const newLevel = Math.floor(newLifetime / 100) + 1; // simple: 100pts = 1 level
    await db
      .update(userPoints)
      .set({
        totalPoints: newTotal,
        lifetimePoints: newLifetime,
        level: newLevel,
        lastUpdated: new Date(),
      })
      .where(and(eq(userPoints.actorId, actorId), eq(userPoints.actorType, actorType)));
    return newTotal;
  } else {
    await db.insert(userPoints).values({
      actorId,
      actorType,
      totalPoints: delta,
      lifetimePoints: delta,
      level: 1,
    });
    return delta;
  }
}

/** Update or create streak for DAILY_CHECKIN events. */
async function updateStreak(actorId: string, actorType: ActorType): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86400 * 1000);

  const existing = await db
    .select({
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak,
      lastActivityDate: streaks.lastActivityDate,
    })
    .from(streaks)
    .where(and(eq(streaks.actorId, actorId), eq(streaks.actorType, actorType)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(streaks).values({
      actorId,
      actorType,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: today,
    });
    return;
  }

  const row = existing[0];
  const lastDate = row.lastActivityDate;

  // Already checked in today — no-op (proofId idempotency handles points, streak is separate)
  if (lastDate && lastDate.getTime() >= today.getTime()) return;

  // Consecutive day → extend streak; gap → reset to 1
  const wasYesterday = lastDate && lastDate.getTime() >= yesterday.getTime();
  const newStreak = wasYesterday ? row.currentStreak + 1 : 1;
  const newLongest = Math.max(row.longestStreak, newStreak);

  await db
    .update(streaks)
    .set({
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActivityDate: today,
    })
    .where(and(eq(streaks.actorId, actorId), eq(streaks.actorType, actorType)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge award helpers (Phase-A milestone badges)
// ─────────────────────────────────────────────────────────────────────────────

/** Badges awarded at lifetime point milestones */
const MILESTONE_BADGES: { slug: string; threshold: number }[] = [
  { slug: "first_points", threshold: 1 },
  { slug: "century_club", threshold: 100 },
  { slug: "gold_member", threshold: 500 },
];

async function checkMilestoneBadges(
  actorId: string,
  actorType: ActorType,
  lifetimePoints: number,
): Promise<void> {
  for (const { slug, threshold } of MILESTONE_BADGES) {
    if (lifetimePoints < threshold) continue;
    try {
      const badgeRows = await db
        .select({ id: badges.id })
        .from(badges)
        .where(eq(badges.slug, slug))
        .limit(1);
      if (!badgeRows.length) continue;

      // Insert — unique constraint (actorId, actorType, badgeId) prevents duplicates
      await db
        .insert(userBadges)
        .values({
          actorId,
          actorType,
          badgeId: badgeRows[0].id,
          earnedAt: new Date(),
        })
        .onConflictDoNothing();
    } catch {
      // Badge award failure must never block points award
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Award points to an actor for a Phase-A gamification event.
 *
 * Idempotent — calling twice with the same (eventType, proofId) will
 * return `{ awarded: false, reason: "duplicate" }` on the second call.
 *
 * Never throws — all errors are caught and returned as `{ awarded: false }`.
 */
export async function awardPoints(input: AwardPointsInput): Promise<AwardResult> {
  const { actorId, actorType, eventType, proofId, proofType, deviceFpHash } = input;

  try {
    // 1. Abuse check
    if (await isAbuseFlagged(actorId, actorType)) {
      return { awarded: false, points: 0, totalPoints: 0, reason: "abuse_flagged" };
    }

    // 2. Daily cap check
    const cap = DAILY_CAPS[eventType];
    if (cap !== undefined) {
      const count = await dailyCount(actorId, actorType, eventType);
      if (count >= cap) {
        return { awarded: false, points: 0, totalPoints: 0, reason: "daily_cap_reached" };
      }
    }

    // 3. Resolve point value
    const points = await resolvePoints(eventType);

    // 4. Insert point_event (unique constraint on eventType+proofId — throws on duplicate)
    await db.insert(pointEvents).values({
      actorId,
      actorType,
      eventType,
      points,
      proofId,
      proofType,
      deviceFpHash: deviceFpHash ?? null,
    });

    // 5. Upsert running total
    const totalPoints = await upsertUserPoints(actorId, actorType, points);

    // 6. Streak update for check-in events
    if (eventType === "DAILY_CHECKIN") {
      await updateStreak(actorId, actorType);
    }

    // 7. Milestone badge check (non-blocking)
    const lifetimeRows = await db
      .select({ lifetimePoints: userPoints.lifetimePoints })
      .from(userPoints)
      .where(and(eq(userPoints.actorId, actorId), eq(userPoints.actorType, actorType)))
      .limit(1);
    if (lifetimeRows.length > 0) {
      checkMilestoneBadges(actorId, actorType, lifetimeRows[0].lifetimePoints).catch(() => {});
    }

    return { awarded: true, points, totalPoints };
  } catch (err: any) {
    // Unique constraint violation = idempotent duplicate
    if (err?.message?.includes("UNIQUE constraint failed")) {
      return { awarded: false, points: 0, totalPoints: 0, reason: "duplicate" };
    }
    console.error("[Gamification] awardPoints error:", err);
    return { awarded: false, points: 0, totalPoints: 0, reason: "error" };
  }
}

/**
 * Get current points + streak for an actor (for API responses).
 */
export async function getActorStats(actorId: string, actorType: ActorType) {
  const [pointsRow, streakRow] = await Promise.all([
    db
      .select({
        totalPoints: userPoints.totalPoints,
        lifetimePoints: userPoints.lifetimePoints,
        level: userPoints.level,
      })
      .from(userPoints)
      .where(and(eq(userPoints.actorId, actorId), eq(userPoints.actorType, actorType)))
      .limit(1),
    db
      .select({
        currentStreak: streaks.currentStreak,
        longestStreak: streaks.longestStreak,
        lastActivityDate: streaks.lastActivityDate,
      })
      .from(streaks)
      .where(and(eq(streaks.actorId, actorId), eq(streaks.actorType, actorType)))
      .limit(1),
  ]);

  return {
    totalPoints: pointsRow[0]?.totalPoints ?? 0,
    lifetimePoints: pointsRow[0]?.lifetimePoints ?? 0,
    level: pointsRow[0]?.level ?? 1,
    currentStreak: streakRow[0]?.currentStreak ?? 0,
    longestStreak: streakRow[0]?.longestStreak ?? 0,
    lastActivityDate: streakRow[0]?.lastActivityDate ?? null,
  };
}
