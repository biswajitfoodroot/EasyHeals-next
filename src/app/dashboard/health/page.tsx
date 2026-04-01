/**
 * /dashboard/health — P5 Health Hub
 *
 * Server component: loads enabled feature flags from DB, passes as FlagsContext
 * so sub-tabs render synchronously (no flash of loading state).
 *
 * Sub-tabs: Timeline | Coach | Documents | Rewards
 * Each tab is hidden if its feature flag is OFF.
 * If ALL flags are OFF: shows a "Coming Soon" state.
 */

import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { HealthHubClient } from "./HealthHubClient";

export const revalidate = 300; // re-check flags every 5 min

export default async function HealthPage() {
  // Pre-fetch flags server-side (avoids client-side waterfall / flash)
  const [healthMemory, aiHealthCoach, gamificationUi, wearableSync] = await Promise.all([
    isFeatureEnabled("health_memory"),
    isFeatureEnabled("ai_health_coach"),
    isFeatureEnabled("gamification_ui"),
    isFeatureEnabled("wearable_sync"),
  ]);

  const flags = {
    health_memory: healthMemory,
    ai_health_coach: aiHealthCoach,
    gamification_ui: gamificationUi,
    wearable_sync: wearableSync,
  };

  return <HealthHubClient flags={flags} />;
}
