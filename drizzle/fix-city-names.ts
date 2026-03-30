/**
 * fix-city-names.ts
 *
 * One-time migration: normalize all hospital city values in the DB.
 *
 * Fixes:
 *   "Baner, Pune"                  → "Pune"
 *   "Fatima Nagar, Wanowrie, Pune" → "Pune"
 *   "Pune Camp"                    → "Pune"
 *   "Govind Nagar, Nashik"         → "Nashik"
 *   "Garacharma, Port Blair"        → "Port Blair"
 *   "411001" (pincode only)        → "Unknown"
 *   "Maharashtra" (state name)      → "Unknown"
 *
 * Run: npx tsx drizzle/fix-city-names.ts
 */

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const STATES = new Set([
  "andaman & nicobar islands", "andaman and nicobar islands",
  "andaman & nicobar", "andaman and nicobar",
  "andhra pradesh", "arunachal pradesh", "assam", "bihar",
  "chhattisgarh", "goa", "gujarat", "haryana",
  "himachal pradesh", "jharkhand", "karnataka", "kerala",
  "ladakh", "lakshadweep", "madhya pradesh", "maharashtra",
  "manipur", "meghalaya", "mizoram", "nagaland",
  "odisha", "orissa", "puducherry", "pondicherry",
  "punjab", "rajasthan", "sikkim", "tamil nadu",
  "telangana", "tripura", "uttar pradesh", "uttarakhand",
  "west bengal", "india",
]);

function normalizeCityName(raw: string): string {
  let city = raw.trim();
  if (!city) return "Unknown";

  // 1. Pure 6-digit pincode
  if (/^\d{6}$/.test(city)) return "Unknown";

  // 2. Locality, City → take last comma-segment
  if (city.includes(",")) {
    const segments = city.split(",").map((s: string) => s.trim()).reverse();
    city = "Unknown";
    for (const seg of segments) {
      const clean = seg.replace(/\s+\d{6}$/, "").trim();
      if (!clean || /^\d{6}$/.test(clean)) continue;
      if (STATES.has(clean.toLowerCase())) continue;
      city = clean;
      break;
    }
  }

  // 3. Strip trailing pincode e.g. "Pune 411001"
  city = city.replace(/\s+\d{6}$/, "").trim();

  // 4. State names
  if (STATES.has(city.toLowerCase())) return "Unknown";

  // 5. Locality suffixes
  city = city
    .replace(/\s+Camp$/i, "")
    .replace(/\s+Cantonment$/i, "")
    .replace(/\s+Cantt\.?$/i, "");

  return city.trim() || "Unknown";
}

async function run() {
  const { rows } = await client.execute("SELECT id, city FROM hospitals");
  console.log(`Found ${rows.length} hospital records.`);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const id = row[0] as string;
    const rawCity = row[1] as string;
    const normalized = normalizeCityName(rawCity);

    if (normalized === rawCity) {
      skipped++;
      continue;
    }

    console.log(`  [UPDATE] "${rawCity}" → "${normalized}" (id: ${id})`);
    await client.execute({
      sql: "UPDATE hospitals SET city = ?, updated_at = ? WHERE id = ?",
      args: [normalized, new Date().toISOString(), id],
    });
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (already clean): ${skipped}`);
  await client.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
