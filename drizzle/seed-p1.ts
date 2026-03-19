/**
 * P1 Seed Script
 *
 * Seeds the following tables with safe defaults for soft launch:
 *   - feature_flags: P1 flags ON, P2/P3 flags OFF
 *   - system_config: rate limits, OTP TTL, dedup windows
 *   - gamification_config: point values for Phase-A events
 *   - badges: 8 starter badges (Phase-A catalogue)
 *
 * IDEMPOTENT — uses INSERT OR IGNORE (Drizzle onConflictDoNothing).
 * Safe to re-run after deploys without duplicating rows.
 *
 * Run:
 *   npx tsx drizzle/seed-p1.ts
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { randomUUID } from "crypto";

// ─── DB connection (uses same env as app) ─────────────────────────────────────

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("❌ TURSO_DATABASE_URL is not set");
  process.exit(1);
}

const client = createClient({ url, authToken });
const db = drizzle(client, { schema });

// ─── Feature Flags ────────────────────────────────────────────────────────────

const FEATURE_FLAGS: Array<{
  key: string;
  enabled: boolean;
  description: string;
  phase: string;
}> = [
  // P1 — ON
  { key: "patient_registration", enabled: true, description: "OTP sign-up and patient profile creation", phase: "p1" },
  { key: "lead_booking", enabled: true, description: "Legacy /api/book endpoint", phase: "p1" },
  { key: "fts_search", enabled: true, description: "FTS5 full-text search for hospitals and doctors", phase: "p1" },
  { key: "audit_logging", enabled: true, description: "Audit log writes to audit_logs table", phase: "p1" },
  { key: "gamification_points", enabled: true, description: "Phase-A passive point events (schema only, APIs in P2)", phase: "p1" },
  // P2 — OFF
  { key: "appointment_booking", enabled: false, description: "Real-time slot booking for hospitals/doctors", phase: "p2" },
  { key: "whatsapp_notifications", enabled: false, description: "WhatsApp Business API notifications", phase: "p2" },
  { key: "token_queue", enabled: false, description: "Live token queue management in hospital portal", phase: "p2" },
  { key: "mass_broadcast", enabled: false, description: "Hospital mass broadcast tool", phase: "p2" },
  { key: "gamification_phase_b", enabled: false, description: "Verified appointment/review gamification events", phase: "p2" },
  { key: "paid_membership", enabled: false, description: "Patient paid tier with premium features", phase: "p2" },
  { key: "provider_analytics", enabled: false, description: "Analytics dashboard for hospital/doctor portals", phase: "p2" },
  { key: "crm_integration", enabled: false, description: "CRM event bus and webhook integrations", phase: "p2" },
  // P3 — OFF
  { key: "emr_lite", enabled: false, description: "Lightweight electronic medical records", phase: "p3" },
  { key: "lab_test_ordering", enabled: false, description: "Lab test booking and result delivery", phase: "p3" },
  { key: "video_consultation", enabled: false, description: "Multi-participant video consultation room", phase: "p3" },
];

// ─── System Config ────────────────────────────────────────────────────────────

const SYSTEM_CONFIG: Array<{
  key: string;
  value: string;
  description: string;
  category: string;
}> = [
  // Rate limits
  { key: "rate_limit_lead_per_hour", value: "5", description: "Max lead submissions per IP per hour", category: "rate_limit" },
  { key: "rate_limit_otp_per_phone_per_hour", value: "3", description: "Max OTP requests per phone per hour", category: "rate_limit" },
  { key: "rate_limit_search_per_minute", value: "30", description: "Max search requests per IP per minute", category: "rate_limit" },
  // OTP settings
  { key: "otp_ttl_seconds", value: "300", description: "OTP expiry time in seconds (5 minutes)", category: "general" },
  { key: "otp_max_attempts", value: "3", description: "Max failed OTP attempts before lockout", category: "general" },
  // Lead dedup
  { key: "lead_dedup_window_seconds", value: "604800", description: "Lead dedup window (7 days) — same patient+hospital within this window = duplicate", category: "general" },
  // AI
  { key: "ai_timeout_ms", value: "8000", description: "Gemini API call timeout in milliseconds", category: "general" },
  { key: "ai_cost_limit_usd_per_day", value: "5.00", description: "Max AI spend per day in USD before AI_COST_LIMIT error", category: "general" },
  // Pagination
  { key: "max_hospitals_per_page", value: "20", description: "Max hospitals returned per search/listing page", category: "general" },
  { key: "max_doctors_per_page", value: "20", description: "Max doctors returned per search/listing page", category: "general" },
  // SEO
  { key: "sitemap_revalidate_seconds", value: "3600", description: "Sitemap ISR revalidation interval", category: "seo" },
];

// ─── Gamification Config ──────────────────────────────────────────────────────

const GAMIFICATION_CONFIG: Array<{
  key: string;
  value: string;
  description: string;
}> = [
  // Phase-A event point values
  { key: "points.PROFILE_COMPLETED", value: "50", description: "Points awarded for completing patient profile" },
  { key: "points.CONSENT_GRANTED", value: "10", description: "Points awarded on first consent grant" },
  { key: "points.NEWS_READ_5", value: "30", description: "Points awarded per week for reading 5 health articles" },
  { key: "points.DAILY_CHECKIN", value: "10", description: "Points awarded for daily check-in" },
  { key: "points.PROFILE_PHOTO_ADDED", value: "20", description: "Points awarded for adding profile photo" },
  { key: "points.SHARE_PROFILE", value: "10", description: "Points awarded for sharing a hospital/doctor profile" },
  // Caps
  { key: "cap.SHARE_PROFILE_PER_DAY", value: "3", description: "Max SHARE_PROFILE events per day" },
  { key: "cap.NEWS_READ_5_PER_WEEK", value: "1", description: "Max NEWS_READ_5 awards per week" },
  // Level thresholds (cumulative lifetime points)
  { key: "level.1.threshold", value: "0", description: "Level 1 (Newcomer) — 0 lifetime points" },
  { key: "level.2.threshold", value: "100", description: "Level 2 (Explorer) — 100 lifetime points" },
  { key: "level.3.threshold", value: "300", description: "Level 3 (Advocate) — 300 lifetime points" },
  { key: "level.4.threshold", value: "700", description: "Level 4 (Champion) — 700 lifetime points" },
  { key: "level.5.threshold", value: "1500", description: "Level 5 (Guardian) — 1500 lifetime points" },
];

// ─── Badges ───────────────────────────────────────────────────────────────────

const BADGES: Array<{
  slug: string;
  name: string;
  description: string;
  tier: string;
  phaseRequired: string;
}> = [
  { slug: "first-step", name: "First Step", description: "Created your EasyHeals patient profile", tier: "bronze", phaseRequired: "phase-a" },
  { slug: "consent-giver", name: "Consent Giver", description: "Granted consent for personalised health guidance", tier: "bronze", phaseRequired: "phase-a" },
  { slug: "health-reader", name: "Health Reader", description: "Read 5 health articles in a week", tier: "bronze", phaseRequired: "phase-a" },
  { slug: "daily-champion", name: "Daily Champion", description: "Checked in for 7 consecutive days", tier: "silver", phaseRequired: "phase-a" },
  { slug: "profile-complete", name: "Profile Complete", description: "Completed your full patient profile", tier: "silver", phaseRequired: "phase-a" },
  { slug: "community-share", name: "Community Sharer", description: "Shared a hospital or doctor profile", tier: "bronze", phaseRequired: "phase-a" },
  // Phase-B badges (schema in P1, awarded in P2)
  { slug: "first-appointment", name: "First Appointment", description: "Booked your first appointment via EasyHeals", tier: "silver", phaseRequired: "phase-b" },
  { slug: "verified-reviewer", name: "Verified Reviewer", description: "Left a verified review after your appointment", tier: "gold", phaseRequired: "phase-b" },
];

// ─── Seed runners ─────────────────────────────────────────────────────────────

async function seedFeatureFlags() {
  console.log("  Seeding feature_flags...");
  let inserted = 0;
  for (const flag of FEATURE_FLAGS) {
    await db
      .insert(schema.featureFlags)
      .values(flag)
      .onConflictDoNothing();
    inserted++;
  }
  console.log(`  ✓ ${inserted} feature flags`);
}

async function seedSystemConfig() {
  console.log("  Seeding system_config...");
  let inserted = 0;
  for (const config of SYSTEM_CONFIG) {
    await db
      .insert(schema.systemConfig)
      .values(config)
      .onConflictDoNothing();
    inserted++;
  }
  console.log(`  ✓ ${inserted} system config rows`);
}

async function seedGamificationConfig() {
  console.log("  Seeding gamification_config...");
  let inserted = 0;
  for (const config of GAMIFICATION_CONFIG) {
    await db
      .insert(schema.gamificationConfig)
      .values(config)
      .onConflictDoNothing();
    inserted++;
  }
  console.log(`  ✓ ${inserted} gamification config rows`);
}

async function seedBadges() {
  console.log("  Seeding badges...");
  let inserted = 0;
  for (const badge of BADGES) {
    await db
      .insert(schema.badges)
      .values({ id: randomUUID(), ...badge })
      .onConflictDoNothing();
    inserted++;
  }
  console.log(`  ✓ ${inserted} badges`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Running P1 seed script...");
  try {
    await seedFeatureFlags();
    await seedSystemConfig();
    await seedGamificationConfig();
    await seedBadges();
    console.log("\n✅ P1 seed complete");
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
