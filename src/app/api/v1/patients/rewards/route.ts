/**
 * GET /api/v1/patients/rewards — Fetch patient gamification stats + badge list
 *
 * Auth: eh_patient_session cookie
 * Returns: total points, streak, rank (coming soon), earned badges, recent events
 */

import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { userPoints, streaks, userBadges, badges, pointEvents } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);
  const { patientId } = session;

  // Get total points
  const [pointsRow] = await db
    .select({ totalPoints: userPoints.totalPoints, lifetimePoints: userPoints.lifetimePoints })
    .from(userPoints)
    .where(and(eq(userPoints.actorId, patientId), eq(userPoints.actorType, "patient")))
    .limit(1);

  // Get streak
  const [streakRow] = await db
    .select({ currentStreak: streaks.currentStreak, longestStreak: streaks.longestStreak })
    .from(streaks)
    .where(and(eq(streaks.actorId, patientId), eq(streaks.actorType, "patient")))
    .limit(1);

  // Get earned badges
  const earnedBadges = await db
    .select({
      badgeId: userBadges.badgeId,
      earnedAt: userBadges.earnedAt,
      name: badges.name,
      description: badges.description,
      icon: badges.iconUrl,
      tier: badges.tier,
    })
    .from(userBadges)
    .innerJoin(badges, eq(userBadges.badgeId, badges.id))
    .where(and(eq(userBadges.actorId, patientId), eq(userBadges.actorType, "patient")))
    .orderBy(desc(userBadges.earnedAt))
    .limit(20);

  // Get recent point events
  const recentEvents = await db
    .select({
      id: pointEvents.id,
      eventType: pointEvents.eventType,
      points: pointEvents.points,
      createdAt: pointEvents.createdAt,
    })
    .from(pointEvents)
    .where(and(eq(pointEvents.actorId, patientId), eq(pointEvents.actorType, "patient")))
    .orderBy(desc(pointEvents.createdAt))
    .limit(10);

  return NextResponse.json({
    data: {
      totalPoints: pointsRow?.totalPoints ?? 0,
      lifetimePoints: pointsRow?.lifetimePoints ?? 0,
      currentStreak: streakRow?.currentStreak ?? 0,
      longestStreak: streakRow?.longestStreak ?? 0,
      cityRank: null, // TODO: leaderboard query in P6
      badges: earnedBadges,
      recentEvents,
    },
  });
});
