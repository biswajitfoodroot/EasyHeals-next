/**
 * Migration — role_permissions table
 * Creates the table and seeds it with current default permission levels.
 * Safe to re-run (idempotent).
 */
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const CREATE = `
CREATE TABLE IF NOT EXISTS role_permissions (
  role         text PRIMARY KEY NOT NULL,
  hospitals    text NOT NULL DEFAULT 'none',
  doctors      text NOT NULL DEFAULT 'none',
  ai_research  text NOT NULL DEFAULT 'none',
  provider_mgmt text NOT NULL DEFAULT 'none',
  user_mgmt    text NOT NULL DEFAULT 'none',
  portal       text NOT NULL DEFAULT 'none',
  updated_at   integer DEFAULT (unixepoch() * 1000),
  updated_by   text REFERENCES users(id)
)`;

// Default permission levels — mirrors the hardcoded ACCESS_MATRIX
const SEEDS: Array<{ role: string; hospitals: string; doctors: string; ai_research: string; provider_mgmt: string; user_mgmt: string; portal: string }> = [
  { role: "owner",          hospitals: "full",    doctors: "full",    ai_research: "full",    provider_mgmt: "full",    user_mgmt: "full",    portal: "none"    },
  { role: "admin",          hospitals: "full",    doctors: "full",    ai_research: "full",    provider_mgmt: "full",    user_mgmt: "limited", portal: "none"    },
  { role: "admin_manager",  hospitals: "full",    doctors: "full",    ai_research: "full",    provider_mgmt: "none",    user_mgmt: "limited", portal: "none"    },
  { role: "admin_editor",   hospitals: "full",    doctors: "full",    ai_research: "full",    provider_mgmt: "none",    user_mgmt: "none",    portal: "none"    },
  { role: "advisor",        hospitals: "limited", doctors: "limited", ai_research: "full",    provider_mgmt: "none",    user_mgmt: "none",    portal: "none"    },
  { role: "viewer",         hospitals: "none",    doctors: "none",    ai_research: "none",    provider_mgmt: "none",    user_mgmt: "none",    portal: "none"    },
  { role: "operator",       hospitals: "none",    doctors: "none",    ai_research: "none",    provider_mgmt: "full",    user_mgmt: "none",    portal: "none"    },
  { role: "coordinator",    hospitals: "none",    doctors: "none",    ai_research: "none",    provider_mgmt: "limited", user_mgmt: "none",    portal: "none"    },
  { role: "hospital_admin", hospitals: "limited", doctors: "none",    ai_research: "none",    provider_mgmt: "none",    user_mgmt: "none",    portal: "full"    },
  { role: "doctor",         hospitals: "none",    doctors: "limited", ai_research: "none",    provider_mgmt: "none",    user_mgmt: "none",    portal: "full"    },
  { role: "receptionist",   hospitals: "none",    doctors: "none",    ai_research: "none",    provider_mgmt: "none",    user_mgmt: "none",    portal: "limited" },
];

async function main() {
  console.log("Running role_permissions migration...\n");

  await client.execute(CREATE);
  console.log("✓ Table created (or already exists)");

  let inserted = 0, skipped = 0;
  for (const s of SEEDS) {
    try {
      await client.execute({
        sql: `INSERT OR IGNORE INTO role_permissions
              (role, hospitals, doctors, ai_research, provider_mgmt, user_mgmt, portal)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [s.role, s.hospitals, s.doctors, s.ai_research, s.provider_mgmt, s.user_mgmt, s.portal],
      });
      console.log(`  + seeded: ${s.role}`);
      inserted++;
    } catch {
      skipped++;
    }
  }

  console.log(`\nDone: ${inserted} seeded, ${skipped} already existed`);
  await client.close();
}

void main();
