-- Phase 2: Network Activation — Agreements, Referrals, Commissions, Earnings
-- Extends Phase 1 tables + adds all new Phase 2 tables

-- ─────────────────────────────────────────────────────────────────────────────
-- Extend provider_agreements (Phase 1 → Phase 2)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `provider_agreements` ADD COLUMN `doctor_id` text REFERENCES `doctors`(`id`);
ALTER TABLE `provider_agreements` ADD COLUMN `entity_type` text NOT NULL DEFAULT 'hospital';
ALTER TABLE `provider_agreements` ADD COLUMN `agreement_type` text NOT NULL DEFAULT 'network_partnership';
ALTER TABLE `provider_agreements` ADD COLUMN `scope_json` text;
ALTER TABLE `provider_agreements` ADD COLUMN `terms_version` text NOT NULL DEFAULT 'v1';
ALTER TABLE `provider_agreements` ADD COLUMN `custom_terms` text;
ALTER TABLE `provider_agreements` ADD COLUMN `published_at` integer;
ALTER TABLE `provider_agreements` ADD COLUMN `accepted_at` integer;
ALTER TABLE `provider_agreements` ADD COLUMN `accepted_by_user_id` text REFERENCES `users`(`id`);
ALTER TABLE `provider_agreements` ADD COLUMN `accepted_ip` text;
ALTER TABLE `provider_agreements` ADD COLUMN `rejected_at` integer;
ALTER TABLE `provider_agreements` ADD COLUMN `rejection_reason` text;
ALTER TABLE `provider_agreements` ADD COLUMN `created_by` text REFERENCES `users`(`id`);

-- Make hospital_id nullable (agreements may cover solo doctors too)
-- SQLite cannot drop NOT NULL; hospital_id stays as-is (existing rows have it set)
-- New rows for doctor agreements can set hospital_id = NULL via app logic

CREATE INDEX IF NOT EXISTS `agreement_doctor_idx` ON `provider_agreements` (`doctor_id`);

-- ─────────────────────────────────────────────────────────────────────────────
-- agreement_events
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `agreement_events` (
  `id` text PRIMARY KEY NOT NULL,
  `agreement_id` text NOT NULL REFERENCES `provider_agreements`(`id`) ON DELETE CASCADE,
  `event_type` text NOT NULL,
  `actor_id` text,
  `actor_type` text,
  `note` text,
  `created_at` integer DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS `agreement_event_idx` ON `agreement_events` (`agreement_id`);

-- ─────────────────────────────────────────────────────────────────────────────
-- Extend commission_entries (Phase 1 → Phase 2)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `commission_entries` ADD COLUMN `doctor_id` text REFERENCES `doctors`(`id`);
ALTER TABLE `commission_entries` ADD COLUMN `referral_case_id` text;
ALTER TABLE `commission_entries` ADD COLUMN `locked_at` integer;
ALTER TABLE `commission_entries` ADD COLUMN `notified_at` integer;
ALTER TABLE `commission_entries` ADD COLUMN `provider_accepted_at` integer;
ALTER TABLE `commission_entries` ADD COLUMN `disputed_at` integer;

-- ─────────────────────────────────────────────────────────────────────────────
-- commission_disputes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `commission_disputes` (
  `id` text PRIMARY KEY NOT NULL,
  `entry_id` text NOT NULL REFERENCES `commission_entries`(`id`),
  `raised_by_user_id` text REFERENCES `users`(`id`),
  `reason` text NOT NULL,
  `status` text NOT NULL DEFAULT 'open',
  `resolution` text,
  `resolved_by_user_id` text REFERENCES `users`(`id`),
  `resolved_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS `dispute_entry_idx` ON `commission_disputes` (`entry_id`);

-- ─────────────────────────────────────────────────────────────────────────────
-- referral_cases
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `referral_cases` (
  `id` text PRIMARY KEY NOT NULL,
  `referral_code` text UNIQUE NOT NULL,
  `patient_id` text REFERENCES `patients`(`id`),
  `patient_name` text,
  `patient_phone` text,
  `source_type` text NOT NULL DEFAULT 'doctor',
  `referring_provider_id` text,
  `referring_organization_id` text,
  `referral_type` text NOT NULL DEFAULT 'doctor_to_hospital',
  `clinical_category` text,
  `suspected_condition` text,
  `urgency` text NOT NULL DEFAULT 'routine',
  `clinical_notes` text,
  `destination_mode` text NOT NULL DEFAULT 'selected_provider',
  `selected_destination_provider_id` text,
  `selected_destination_org_id` text,
  `destination_city` text,
  `destination_state` text,
  `outstation_required` integer DEFAULT 0,
  `accommodation_required` integer DEFAULT 0,
  `estimated_price_min` integer,
  `estimated_price_max` integer,
  `status` text NOT NULL DEFAULT 'draft',
  `status_reason` text,
  `assigned_coordinator_id` text REFERENCES `users`(`id`),
  `agreement_id` text REFERENCES `provider_agreements`(`id`),
  `consent_given` integer DEFAULT 0,
  `created_by_actor_type` text NOT NULL DEFAULT 'provider_staff',
  `created_by_actor_id` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000),
  `updated_at` integer DEFAULT (unixepoch() * 1000),
  `closed_at` integer
);
CREATE INDEX IF NOT EXISTS `referral_referring_org_idx` ON `referral_cases` (`referring_organization_id`);
CREATE INDEX IF NOT EXISTS `referral_referring_prov_idx` ON `referral_cases` (`referring_provider_id`);
CREATE INDEX IF NOT EXISTS `referral_status_idx` ON `referral_cases` (`status`);
CREATE INDEX IF NOT EXISTS `referral_urgency_idx` ON `referral_cases` (`urgency`);
CREATE INDEX IF NOT EXISTS `referral_coordinator_idx` ON `referral_cases` (`assigned_coordinator_id`);

-- ─────────────────────────────────────────────────────────────────────────────
-- referral_case_events
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `referral_case_events` (
  `id` text PRIMARY KEY NOT NULL,
  `referral_case_id` text NOT NULL REFERENCES `referral_cases`(`id`) ON DELETE CASCADE,
  `event_type` text NOT NULL,
  `event_payload` text,
  `created_by_actor_type` text NOT NULL,
  `created_by_actor_id` text NOT NULL,
  `note` text,
  `created_at` integer DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS `ref_event_case_idx` ON `referral_case_events` (`referral_case_id`);

-- ─────────────────────────────────────────────────────────────────────────────
-- referral_documents
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `referral_documents` (
  `id` text PRIMARY KEY NOT NULL,
  `referral_case_id` text NOT NULL REFERENCES `referral_cases`(`id`) ON DELETE CASCADE,
  `document_id` text,
  `file_name` text,
  `file_url` text,
  `source` text NOT NULL DEFAULT 'uploaded',
  `uploaded_by_actor_id` text,
  `created_at` integer DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS `ref_doc_case_idx` ON `referral_documents` (`referral_case_id`);

-- ─────────────────────────────────────────────────────────────────────────────
-- provider_referral_preferences
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `provider_referral_preferences` (
  `id` text PRIMARY KEY NOT NULL,
  `entity_id` text NOT NULL,
  `entity_type` text NOT NULL DEFAULT 'hospital',
  `accepts_incoming` integer DEFAULT 1,
  `referral_specialties` text,
  `default_response_sla_mins` integer DEFAULT 60,
  `accepted_geographies` text,
  `accepted_referral_types` text,
  `indicative_price_json` text,
  `requires_preapproval` integer DEFAULT 0,
  `updated_at` integer DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS `ref_pref_entity_idx` ON `provider_referral_preferences` (`entity_id`);

-- ─────────────────────────────────────────────────────────────────────────────
-- billable_events
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `billable_events` (
  `id` text PRIMARY KEY NOT NULL,
  `referral_case_id` text REFERENCES `referral_cases`(`id`),
  `appointment_id` text REFERENCES `appointments`(`id`),
  `hospital_id` text REFERENCES `hospitals`(`id`),
  `billing_amount` integer,
  `currency` text NOT NULL DEFAULT 'INR',
  `source` text NOT NULL,
  `file_url` text,
  `verification_status` text NOT NULL DEFAULT 'pending',
  `verified_by_user_id` text REFERENCES `users`(`id`),
  `verified_at` integer,
  `notes` text,
  `created_at` integer DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS `billable_hospital_idx` ON `billable_events` (`hospital_id`);
CREATE INDEX IF NOT EXISTS `billable_referral_idx` ON `billable_events` (`referral_case_id`);

-- ─────────────────────────────────────────────────────────────────────────────
-- provider_payout_profiles
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `provider_payout_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `entity_id` text NOT NULL UNIQUE,
  `entity_type` text NOT NULL DEFAULT 'hospital',
  `beneficiary_name` text,
  `bank_account_number` text,
  `ifsc_code` text,
  `upi_id` text,
  `pan_number` text,
  `status` text NOT NULL DEFAULT 'pending',
  `verified_by_user_id` text REFERENCES `users`(`id`),
  `verified_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000),
  `updated_at` integer DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS `payout_profile_entity_idx` ON `provider_payout_profiles` (`entity_id`);

-- ─────────────────────────────────────────────────────────────────────────────
-- payout_batches
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `payout_batches` (
  `id` text PRIMARY KEY NOT NULL,
  `batch_ref` text UNIQUE NOT NULL,
  `status` text NOT NULL DEFAULT 'draft',
  `total_amount_paise` integer NOT NULL DEFAULT 0,
  `entry_count` integer NOT NULL DEFAULT 0,
  `created_by_user_id` text REFERENCES `users`(`id`),
  `approved_by_user_id` text REFERENCES `users`(`id`),
  `approved_at` integer,
  `paid_at` integer,
  `notes` text,
  `created_at` integer DEFAULT (unixepoch() * 1000),
  `updated_at` integer DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS `payout_batch_status_idx` ON `payout_batches` (`status`);
