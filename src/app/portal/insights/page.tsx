/**
 * /portal/insights — Provider Insights Dashboard
 *
 * Shows hospital_admin or doctor their own analytics:
 * - Profile views, booking rate, avg rating, completion rate
 * - 7-day trend sparkline (views + bookings)
 * - Gated by provider_insights feature flag
 *
 * Server-rendered with revalidate for caching.
 */

import { InsightsClient } from "./InsightsClient";

export const revalidate = 300; // 5-min ISR

export default function InsightsPage() {
  return <InsightsClient />;
}
