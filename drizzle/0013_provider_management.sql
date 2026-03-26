-- Provider Management plane tables
-- Phase 1: coordinator_permissions, provider_agreements, commission_entries

CREATE TABLE IF NOT EXISTS `coordinator_permissions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `can_view_kpis` integer NOT NULL DEFAULT 0,
  `can_view_providers` integer NOT NULL DEFAULT 1,
  `can_edit_providers` integer NOT NULL DEFAULT 0,
  `can_view_agreements` integer NOT NULL DEFAULT 1,
  `can_edit_agreements` integer NOT NULL DEFAULT 0,
  `can_view_kyc` integer NOT NULL DEFAULT 1,
  `can_approve_kyc` integer NOT NULL DEFAULT 0,
  `can_view_users` integer NOT NULL DEFAULT 0,
  `can_manage_users` integer NOT NULL DEFAULT 0,
  `notes` text,
  `updated_at` integer DEFAULT (unixepoch() * 1000),
  `created_at` integer DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS `coord_perm_user_idx` ON `coordinator_permissions` (`user_id`);

CREATE TABLE IF NOT EXISTS `provider_agreements` (
  `id` text PRIMARY KEY NOT NULL,
  `hospital_id` text NOT NULL REFERENCES `hospitals`(`id`) ON DELETE CASCADE,
  `status` text NOT NULL DEFAULT 'draft',
  `tier_code` text,
  `commission_percent` integer,
  `commission_flat` integer,
  `revenue_share_notes` text,
  `signed_at` integer,
  `active_since` integer,
  `expires_at` integer,
  `operator_id` text REFERENCES `users`(`id`),
  `notes` text,
  `created_at` integer DEFAULT (unixepoch() * 1000),
  `updated_at` integer DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS `agreement_hospital_idx` ON `provider_agreements` (`hospital_id`);
CREATE INDEX IF NOT EXISTS `agreement_status_idx` ON `provider_agreements` (`status`);

CREATE TABLE IF NOT EXISTS `commission_entries` (
  `id` text PRIMARY KEY NOT NULL,
  `agreement_id` text NOT NULL REFERENCES `provider_agreements`(`id`),
  `hospital_id` text NOT NULL REFERENCES `hospitals`(`id`),
  `appointment_id` text REFERENCES `appointments`(`id`),
  `amount_paise` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `notes` text,
  `entered_by` text REFERENCES `users`(`id`),
  `paid_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000),
  `updated_at` integer DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS `commission_agreement_idx` ON `commission_entries` (`agreement_id`);
CREATE INDEX IF NOT EXISTS `commission_hospital_idx` ON `commission_entries` (`hospital_id`);
CREATE INDEX IF NOT EXISTS `commission_status_idx` ON `commission_entries` (`status`);
