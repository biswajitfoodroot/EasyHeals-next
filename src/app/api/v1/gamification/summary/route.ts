/**
 * GET /api/v1/gamification/summary
 *
 * Returns all data the RewardsTab needs in one call:
 *   - totalPoints, lifetimePoints, level
 *   - currentStreak, longestStreak
 *   - checkedInToday (boolean)
 *   - rank (city rank from user_points, null if opted out)
 *   - leaderboard (top-10 in city with isYou flag, alias masked)
 *
 * Auth:  eh_patient_session cookie
 * Flag:  gamification_ui (returns 423 if OFF)
 */

import { and, desc, eq, gte, sql as drizzleSql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { pointEvents, userPoints, streaks, patients } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { requireFeatureFlag } from "@/lib/config/feature-flags";
import { getActorStats } from "@/lib/gamification/award";
import { withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const blocked = await requireFeatureFlag("gamification_ui");
  if (blocked) return blocked;

  const session = await requirePatientSession(req);
  const { patientId } = session;

  // Core stats
  const stats = await getActorStats(patientId, "patient");

  // Was there a DAILY_CHECKIN today (UTC)?
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayCheckin = await db
    .select({ id: pointEvents.id })
    .from(pointEvents)
    .where(
      and(
        eq(pointEvents.actorId, patientId),
        eq(pointEvents.actorType, "patient"),
        eq(pointEvents.eventType, "DAILY_CHECKIN"),
        gte(pointEvents.createdAt, todayStart),
      ),
    )
    .limit(1);
  const checkedInToday = todayCheckin.length > 0;

  // City-scoped leaderboard: top 10 by totalPoints where city matches patient's city
  // We join via patients table to get city, then filter to same city
  const patientRow = await db
    .select({ city: patients.city })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  const patientCity = patientRow[0]?.city ?? null;

  // Leaderboard: top 10 in same city (or globally if city unknown)
  // Join user_points → patients to filter by city + opt-out
  const leaderRows = await db
    .select({
      actorId: userPoints.actorId,
      totalPoints: userPoints.totalPoints,
      displayAlias: patients.displayAlias,
    })
    .from(userPoints)
    .innerJoin(patients, eq(userPoints.actorId, patients.id))
    .where(
      and(
        eq(userPoints.actorType, "patient"),
        eq(patients.leaderboardOptOut, false),
        patientCity
          ? eq(patients.city, patientCity)
          : drizzleSql`1=1`,
      ),
    )
    .orderBy(desc(userPoints.totalPoints))
    .limit(10);

  // Determine this patient's city rank
  let rank: number | null = null;
  const myIndex = leaderRows.findIndex((r) => r.actorId === patientId);
  if (myIndex >= 0) {
    rank = myIndex + 1;
  }

  const leaderboard = leaderRows.map((row) => ({
    alias: row.displayAlias ?? "Anonymous",
    points: row.totalPoints,
    isYou: row.actorId === patientId,
  }));

  return NextResponse.json({
    data: {
      totalPoints: stats.totalPoints,
      lifetimePoints: stats.lifetimePoints,
      level: stats.level,
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      checkedInToday,
      rank,
      leaderboard,
    },
  });
});
