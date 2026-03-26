/**
 * DEV ONLY — Manually set a patient's subscription tier for local testing.
 *
 * Usage:
 *   npx tsx drizzle/dev-set-premium.ts <patient-email> <tier>
 *
 * Tiers:
 *   free           — no premium access
 *   health_plus    — document upload, AI extraction, 50 coach msgs/mo
 *   health_pro     — everything unlimited + family profiles + PDF export
 *   trial          — resets trial so it appears "active" (sets trialStartedAt = now, no sub)
 *
 * Examples:
 *   npx tsx drizzle/dev-set-premium.ts test@example.com health_plus
 *   npx tsx drizzle/dev-set-premium.ts test@example.com health_pro
 *   npx tsx drizzle/dev-set-premium.ts test@example.com free
 *   npx tsx drizzle/dev-set-premium.ts test@example.com trial
 *
 * To upgrade ALL patients at once (useful for testing):
 *   npx tsx drizzle/dev-set-premium.ts --all health_plus
 */

import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const VALID_TIERS = ["free", "health_plus", "health_pro", "trial"] as const;
type Tier = (typeof VALID_TIERS)[number];

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("Usage: npx tsx drizzle/dev-set-premium.ts <email|--all> <tier>");
    console.log("Tiers:", VALID_TIERS.join(" | "));
    process.exit(1);
  }

  const [target, tierArg] = args;
  const tier = tierArg as Tier;

  if (!VALID_TIERS.includes(tier)) {
    console.error(`Unknown tier '${tier}'. Valid: ${VALID_TIERS.join(", ")}`);
    process.exit(1);
  }

  // Expiry: 1 year from now (far future for dev testing)
  const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  let sql: string;

  if (tier === "trial") {
    // Reset trial: clear subscription, set trialStartedAt = now (21-day window starts fresh)
    sql = target === "--all"
      ? `UPDATE patients SET subscription_tier = 'free', subscription_expires_at = NULL, trial_started_at = ${now}`
      : `UPDATE patients SET subscription_tier = 'free', subscription_expires_at = NULL, trial_started_at = ${now} WHERE email = '${target}'`;
  } else if (tier === "free") {
    sql = target === "--all"
      ? `UPDATE patients SET subscription_tier = 'free', subscription_expires_at = NULL, trial_started_at = NULL`
      : `UPDATE patients SET subscription_tier = 'free', subscription_expires_at = NULL, trial_started_at = NULL WHERE email = '${target}'`;
  } else {
    // health_plus or health_pro — set tier + expiry 1 year out
    sql = target === "--all"
      ? `UPDATE patients SET subscription_tier = '${tier}', subscription_expires_at = ${expiresAt}`
      : `UPDATE patients SET subscription_tier = '${tier}', subscription_expires_at = ${expiresAt} WHERE email = '${target}'`;
  }

  const result = await client.execute(sql);

  if (result.rowsAffected === 0) {
    if (target === "--all") {
      console.log("⚠️  No patients found in DB yet.");
    } else {
      console.log(`⚠️  No patient found with email '${target}'. Check the email address.`);
      // List available patients
      const rows = await client.execute("SELECT email, subscription_tier FROM patients LIMIT 20");
      if (rows.rows.length > 0) {
        console.log("\nAvailable patients:");
        rows.rows.forEach((r) => console.log(`  ${r.email}  [${r.subscription_tier ?? "free"}]`));
      }
    }
  } else {
    const label = tier === "trial" ? "21-day trial (reset)" : tier === "free" ? "Free" : `${tier} (expires ${new Date(expiresAt).toLocaleDateString()})`;
    console.log(`✅ Updated ${result.rowsAffected} patient(s) → ${label}`);
  }

  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
