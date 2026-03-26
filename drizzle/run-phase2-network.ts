/**
 * Migration — Phase 2 Network (also covers Phase 1 provider management tables)
 * Creates all provider_agreements, commission_entries, and Phase 2 tables
 * with their full Phase 2 schema directly (idempotent, safe to re-run).
 */
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const STATEMENTS = [
  // ── coordinator_permissions (Phase 1) ────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS coordinator_permissions (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    can_view_kpis integer NOT NULL DEFAULT 0,
    can_view_providers integer NOT NULL DEFAULT 1,
    can_edit_providers integer NOT NULL DEFAULT 0,
    can_view_agreements integer NOT NULL DEFAULT 1,
    can_edit_agreements integer NOT NULL DEFAULT 0,
    can_view_kyc integer NOT NULL DEFAULT 1,
    can_approve_kyc integer NOT NULL DEFAULT 0,
    can_view_users integer NOT NULL DEFAULT 0,
    can_manage_users integer NOT NULL DEFAULT 0,
    notes text,
    updated_at integer DEFAULT (unixepoch() * 1000),
    created_at integer DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS coord_perm_user_idx ON coordinator_permissions (user_id)`,

  // ── provider_agreements (Phase 2 full schema) ─────────────────────────────
  `CREATE TABLE IF NOT EXISTS provider_agreements (
    id text PRIMARY KEY NOT NULL,
    hospital_id text REFERENCES hospitals(id) ON DELETE CASCADE,
    doctor_id text REFERENCES doctors(id) ON DELETE CASCADE,
    entity_type text NOT NULL DEFAULT 'hospital',
    entity_id text,
    agreement_type text NOT NULL DEFAULT 'network_partnership',
    scope_json text,
    terms_version text NOT NULL DEFAULT 'v1',
    custom_terms text,
    status text NOT NULL DEFAULT 'draft',
    published_at integer,
    accepted_at integer,
    accepted_by_user_id text REFERENCES users(id),
    accepted_ip text,
    rejected_at integer,
    rejection_reason text,
    expires_at integer,
    tier_code text,
    commission_percent integer,
    commission_flat integer,
    revenue_share_notes text,
    created_by text REFERENCES users(id),
    notes text,
    created_at integer DEFAULT (unixepoch() * 1000),
    updated_at integer DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS agreement_hospital_idx ON provider_agreements (hospital_id)`,
  `CREATE INDEX IF NOT EXISTS agreement_doctor_idx ON provider_agreements (doctor_id)`,
  `CREATE INDEX IF NOT EXISTS agreement_status_idx ON provider_agreements (status)`,
  `CREATE INDEX IF NOT EXISTS agreement_entity_id_idx ON provider_agreements (entity_id)`,

  // ── agreement_events ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS agreement_events (
    id text PRIMARY KEY NOT NULL,
    agreement_id text NOT NULL REFERENCES provider_agreements(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    actor_id text,
    actor_type text,
    note text,
    created_at integer DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS agreement_event_idx ON agreement_events (agreement_id)`,

  // ── commission_entries (Phase 2 full schema) ──────────────────────────────
  `CREATE TABLE IF NOT EXISTS commission_entries (
    id text PRIMARY KEY NOT NULL,
    agreement_id text NOT NULL REFERENCES provider_agreements(id),
    hospital_id text REFERENCES hospitals(id),
    doctor_id text REFERENCES doctors(id),
    appointment_id text REFERENCES appointments(id),
    referral_case_id text,
    amount_paise integer NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    notes text,
    entered_by text REFERENCES users(id),
    locked_at integer,
    notified_at integer,
    provider_accepted_at integer,
    disputed_at integer,
    paid_at integer,
    created_at integer DEFAULT (unixepoch() * 1000),
    updated_at integer DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS commission_agreement_idx ON commission_entries (agreement_id)`,
  `CREATE INDEX IF NOT EXISTS commission_hospital_idx ON commission_entries (hospital_id)`,
  `CREATE INDEX IF NOT EXISTS commission_status_idx ON commission_entries (status)`,

  // ── commission_disputes ───────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS commission_disputes (
    id text PRIMARY KEY NOT NULL,
    entry_id text NOT NULL REFERENCES commission_entries(id),
    raised_by_user_id text REFERENCES users(id),
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'open',
    resolution text,
    resolved_by_user_id text REFERENCES users(id),
    resolved_at integer,
    created_at integer DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS dispute_entry_idx ON commission_disputes (entry_id)`,

  // ── referral_cases ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS referral_cases (
    id text PRIMARY KEY NOT NULL,
    referral_code text UNIQUE,
    patient_id text REFERENCES patients(id),
    patient_name text,
    patient_phone text,
    source_type text NOT NULL DEFAULT 'doctor',
    referring_provider_id text,
    referring_organization_id text,
    referral_type text NOT NULL DEFAULT 'doctor_to_hospital',
    clinical_category text,
    suspected_condition text,
    urgency text NOT NULL DEFAULT 'routine',
    clinical_notes text,
    destination_mode text NOT NULL DEFAULT 'selected_provider',
    selected_destination_provider_id text,
    selected_destination_org_id text,
    destination_city text,
    destination_state text,
    outstation_required integer DEFAULT 0,
    accommodation_required integer DEFAULT 0,
    estimated_price_min integer,
    estimated_price_max integer,
    status text NOT NULL DEFAULT 'draft',
    status_reason text,
    consent_obtained integer DEFAULT 0,
    consent_obtained_at integer,
    closed_at integer,
    created_by_user_id text REFERENCES users(id),
    created_at integer DEFAULT (unixepoch() * 1000),
    updated_at integer DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS referral_status_idx ON referral_cases (status)`,
  `CREATE INDEX IF NOT EXISTS referral_referring_org_idx ON referral_cases (referring_organization_id)`,
  `CREATE INDEX IF NOT EXISTS referral_dest_org_idx ON referral_cases (selected_destination_org_id)`,
  `CREATE INDEX IF NOT EXISTS referral_urgency_idx ON referral_cases (urgency)`,

  // ── referral_case_events ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS referral_case_events (
    id text PRIMARY KEY NOT NULL,
    referral_case_id text NOT NULL REFERENCES referral_cases(id) ON DELETE CASCADE,
    event_type text NOT NULL DEFAULT 'note_added',
    created_by_actor_type text,
    created_by_actor_id text,
    note text,
    metadata_json text,
    created_at integer DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS referral_event_case_idx ON referral_case_events (referral_case_id)`,

  // ── referral_documents ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS referral_documents (
    id text PRIMARY KEY NOT NULL,
    referral_case_id text NOT NULL REFERENCES referral_cases(id) ON DELETE CASCADE,
    document_type text NOT NULL DEFAULT 'report',
    file_url text NOT NULL,
    file_name text,
    uploaded_by_user_id text REFERENCES users(id),
    created_at integer DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS referral_doc_case_idx ON referral_documents (referral_case_id)`,

  // ── provider_payout_profiles ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS provider_payout_profiles (
    id text PRIMARY KEY NOT NULL,
    entity_id text NOT NULL UNIQUE,
    entity_type text NOT NULL DEFAULT 'hospital',
    beneficiary_name text,
    bank_account_number text,
    ifsc_code text,
    upi_id text,
    pan_number text,
    status text NOT NULL DEFAULT 'pending',
    verified_by_user_id text REFERENCES users(id),
    verified_at integer,
    created_at integer DEFAULT (unixepoch() * 1000),
    updated_at integer DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS payout_profile_entity_idx ON provider_payout_profiles (entity_id)`,

  // ── provider_referral_preferences ────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS provider_referral_preferences (
    id text PRIMARY KEY NOT NULL,
    entity_id text NOT NULL,
    entity_type text NOT NULL DEFAULT 'hospital',
    accepts_incoming integer DEFAULT 1,
    referral_specialties text,
    default_response_sla_mins integer DEFAULT 60,
    accepted_geographies text,
    accepted_referral_types text,
    indicative_price_json text,
    requires_preapproval integer DEFAULT 0,
    updated_at integer DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS ref_pref_entity_idx ON provider_referral_preferences (entity_id)`,

  // ── billable_events ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS billable_events (
    id text PRIMARY KEY NOT NULL,
    referral_case_id text REFERENCES referral_cases(id),
    appointment_id text REFERENCES appointments(id),
    hospital_id text REFERENCES hospitals(id),
    billing_amount integer,
    currency text NOT NULL DEFAULT 'INR',
    source text NOT NULL,
    file_url text,
    verification_status text NOT NULL DEFAULT 'pending',
    verified_by_user_id text REFERENCES users(id),
    verified_at integer,
    notes text,
    created_at integer DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS billable_hospital_idx ON billable_events (hospital_id)`,
  `CREATE INDEX IF NOT EXISTS billable_referral_idx ON billable_events (referral_case_id)`,

  // ── payout_batches ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS payout_batches (
    id text PRIMARY KEY NOT NULL,
    batch_ref text UNIQUE,
    status text NOT NULL DEFAULT 'draft',
    total_amount_paise integer NOT NULL DEFAULT 0,
    entry_count integer NOT NULL DEFAULT 0,
    created_by_user_id text REFERENCES users(id),
    approved_by_user_id text REFERENCES users(id),
    approved_at integer,
    paid_at integer,
    notes text,
    created_at integer DEFAULT (unixepoch() * 1000),
    updated_at integer DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS payout_batch_status_idx ON payout_batches (status)`,
];

async function main() {
  console.log("Running Phase 2 Network migration...\n");
  let ok = 0, skipped = 0, failed = 0;

  for (const sql of STATEMENTS) {
    const preview = sql.replace(/\s+/g, " ").trim().slice(0, 90);
    try {
      await client.execute(sql);
      console.log(`✓ ${preview}`);
      ok++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes("duplicate column") ||
        msg.includes("already exists") ||
        msg.includes("UNIQUE constraint")
      ) {
        console.log(`- SKIP: ${preview.slice(0, 70)}`);
        skipped++;
      } else {
        console.error(`✗ FAILED: ${preview}`);
        console.error(`  ${msg}`);
        failed++;
      }
    }
  }

  console.log(`\n──────────────────────────────────────`);
  console.log(`Done: ${ok} applied, ${skipped} skipped, ${failed} failed`);
  await client.close();

  if (failed > 0) process.exit(1);
}

void main();
