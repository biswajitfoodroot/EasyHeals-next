-- P2 Day 1 — TOTP for admin + Appointment booking extension
-- Run: npm run db:migrate   (or: drizzle-kit migrate)
-- Idempotent: all ADD COLUMN operations; safe to re-apply if guarded by IF NOT EXISTS (SQLite ignores duplicates via Drizzle)

--> statement-breakpoint
-- ────────────────────────────────────────────────────────────────────────────
-- 1. TOTP columns on users table (HLD §8.2 G-TOTP gate)
--    Mandatory for owner + admin roles before any P2 feature flag activates.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE `users` ADD `totp_secret` text;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_recovery_codes` text DEFAULT '[]';--> statement-breakpoint

-- ────────────────────────────────────────────────────────────────────────────
-- 2. TOTP verification timestamp on sessions table
--    NULL = TOTP not yet validated for this session.
--    Non-null = TOTP passed; full admin access granted.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE `sessions` ADD `totp_verified_at` integer;--> statement-breakpoint

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Extend appointments table (P2 stub created in earlier migration)
--    - consentRecordId: DPDP compliance — link to the patient's consent record
--    - sourcePlatform:  track booking origin (web | crm | agent_portal)
--    - slotId:          FK to appointment_slots (optional — for slot-based bookings)
--    - patientNotes:    free text supplied by patient at booking time
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE `appointments` ADD `patient_notes` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `consent_record_id` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `source_platform` text DEFAULT 'web';--> statement-breakpoint
ALTER TABLE `appointments` ADD `slot_id` text REFERENCES `appointment_slots`(`id`);--> statement-breakpoint
