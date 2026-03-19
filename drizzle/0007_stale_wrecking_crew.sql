CREATE TABLE `abuse_flags` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`flag_type` text NOT NULL,
	`device_fp_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`resolved_at` integer,
	`resolved_by` text,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `abuse_flags_actor_idx` ON `abuse_flags` (`actor_id`,`actor_type`);--> statement-breakpoint
CREATE INDEX `abuse_flags_type_idx` ON `abuse_flags` (`flag_type`);--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_name` text NOT NULL,
	`actor_id` text,
	`actor_type` text,
	`properties` text,
	`session_id` text,
	`ip_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE INDEX `analytics_events_name_idx` ON `analytics_events` (`event_name`);--> statement-breakpoint
CREATE INDEX `analytics_events_actor_idx` ON `analytics_events` (`actor_id`,`actor_type`);--> statement-breakpoint
CREATE TABLE `appointment_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`doctor_id` text,
	`hospital_id` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`is_booked` integer DEFAULT false NOT NULL,
	`appointment_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `appointment_slots_doctor_time_idx` ON `appointment_slots` (`doctor_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `appointment_slots_hospital_time_idx` ON `appointment_slots` (`hospital_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`doctor_id` text,
	`hospital_id` text,
	`type` text DEFAULT 'in_person' NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`scheduled_at` integer,
	`confirmed_at` integer,
	`completed_at` integer,
	`cancelled_at` integer,
	`cancellation_reason` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `appointments_patient_idx` ON `appointments` (`patient_id`);--> statement-breakpoint
CREATE INDEX `appointments_doctor_idx` ON `appointments` (`doctor_id`);--> statement-breakpoint
CREATE INDEX `appointments_hospital_idx` ON `appointments` (`hospital_id`);--> statement-breakpoint
CREATE INDEX `appointments_status_idx` ON `appointments` (`status`);--> statement-breakpoint
CREATE INDEX `appointments_scheduled_idx` ON `appointments` (`scheduled_at`);--> statement-breakpoint
CREATE TABLE `badges` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`tier` text DEFAULT 'bronze' NOT NULL,
	`phase_required` text DEFAULT 'phase-a' NOT NULL,
	`icon_url` text,
	`created_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `badges_slug_unique` ON `badges` (`slug`);--> statement-breakpoint
CREATE TABLE `consent_records` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`purpose` text NOT NULL,
	`version` text DEFAULT '1.0' NOT NULL,
	`granted` integer NOT NULL,
	`granted_at` integer DEFAULT (unixepoch() * 1000),
	`revoked_at` integer,
	`channel` text DEFAULT 'web' NOT NULL,
	`ip_hash` text NOT NULL,
	`user_agent_hash` text,
	`legal_basis` text DEFAULT 'dpdp_consent' NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `consent_records_patient_idx` ON `consent_records` (`patient_id`);--> statement-breakpoint
CREATE INDEX `consent_records_patient_purpose_idx` ON `consent_records` (`patient_id`,`purpose`);--> statement-breakpoint
CREATE TABLE `consultation_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`sender_actor_id` text NOT NULL,
	`sender_actor_type` text NOT NULL,
	`body` text NOT NULL,
	`attachment_url` text,
	`sent_at` integer DEFAULT (unixepoch() * 1000),
	`read_at` integer,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `consultation_messages_appointment_idx` ON `consultation_messages` (`appointment_id`,`sent_at`);--> statement-breakpoint
CREATE TABLE `consultation_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`role` text NOT NULL,
	`invited_at` integer DEFAULT (unixepoch() * 1000),
	`joined_at` integer,
	`left_at` integer,
	`admitted` integer DEFAULT false NOT NULL,
	`recording_consented` integer,
	FOREIGN KEY (`session_id`) REFERENCES `consultation_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `consultation_participants_session_idx` ON `consultation_participants` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `consultation_participants_session_actor_idx` ON `consultation_participants` (`session_id`,`actor_id`,`actor_type`);--> statement-breakpoint
CREATE TABLE `consultation_room_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`provider` text DEFAULT 'jitsi' NOT NULL,
	`max_participants` integer DEFAULT 4 NOT NULL,
	`allowed_participant_types` text DEFAULT '["patient","doctor"]',
	`recording_enabled` integer DEFAULT false NOT NULL,
	`waiting_room_enabled` integer DEFAULT true NOT NULL,
	`auto_admit` integer DEFAULT false NOT NULL,
	`session_timeout_minutes` integer DEFAULT 45 NOT NULL,
	`ai_summary_enabled` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `consultation_room_configs_entity_idx` ON `consultation_room_configs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `consultation_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`provider` text DEFAULT 'jitsi' NOT NULL,
	`room_url` text,
	`room_id` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`recording_url` text,
	`ai_summary` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `consultation_sessions_appointment_idx` ON `consultation_sessions` (`appointment_id`);--> statement-breakpoint
CREATE TABLE `feature_flags` (
	`key` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`description` text,
	`phase` text DEFAULT 'p2' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `gamification_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`phone_hash` text NOT NULL,
	`city` text,
	`device_fp_hash` text,
	`display_alias` text,
	`leaderboard_opt_out` integer DEFAULT false NOT NULL,
	`legal_basis` text DEFAULT 'dpdp_consent' NOT NULL,
	`phone_encrypted` text,
	`preferred_lang` text DEFAULT 'en',
	`abha_id` text,
	`preferred_pharmacy_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patients_phone_hash_unique` ON `patients` (`phone_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `patients_phone_hash_idx` ON `patients` (`phone_hash`);--> statement-breakpoint
CREATE INDEX `patients_city_idx` ON `patients` (`city`);--> statement-breakpoint
CREATE TABLE `payment_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text,
	`hospital_id` text,
	`razorpay_order_id` text,
	`razorpay_payment_id` text,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`purpose` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_transactions_razorpay_order_id_unique` ON `payment_transactions` (`razorpay_order_id`);--> statement-breakpoint
CREATE INDEX `payment_transactions_patient_idx` ON `payment_transactions` (`patient_id`);--> statement-breakpoint
CREATE INDEX `payment_transactions_status_idx` ON `payment_transactions` (`status`);--> statement-breakpoint
CREATE TABLE `point_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`event_type` text NOT NULL,
	`points` integer NOT NULL,
	`proof_id` text NOT NULL,
	`proof_type` text NOT NULL,
	`device_fp_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_events_type_proof_idx` ON `point_events` (`event_type`,`proof_id`);--> statement-breakpoint
CREATE INDEX `point_events_actor_idx` ON `point_events` (`actor_id`,`actor_type`);--> statement-breakpoint
CREATE TABLE `specialty_synonyms` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical` text NOT NULL,
	`synonym` text NOT NULL,
	`lang` text DEFAULT 'en' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `specialty_synonyms_canonical_synonym_idx` ON `specialty_synonyms` (`canonical`,`synonym`);--> statement-breakpoint
CREATE INDEX `specialty_synonyms_synonym_idx` ON `specialty_synonyms` (`synonym`);--> statement-breakpoint
CREATE TABLE `streaks` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`last_activity_date` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `streaks_actor_idx` ON `streaks` (`actor_id`,`actor_type`);--> statement-breakpoint
CREATE TABLE `system_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`category` text DEFAULT 'general' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_badges` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`badge_id` text NOT NULL,
	`earned_at` integer DEFAULT (unixepoch() * 1000),
	`seen` integer DEFAULT false NOT NULL,
	`display_on_profile` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_badges_actor_badge_idx` ON `user_badges` (`actor_id`,`actor_type`,`badge_id`);--> statement-breakpoint
CREATE TABLE `user_points` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`total_points` integer DEFAULT 0 NOT NULL,
	`lifetime_points` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`last_updated` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_points_actor_idx` ON `user_points` (`actor_id`,`actor_type`);--> statement-breakpoint
ALTER TABLE `hospitals` ADD `whatsapp_business_number` text;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `queue_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `broadcast_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `slot_duration_minutes` integer DEFAULT 15;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `max_daily_appointments` integer;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `razorpay_customer_id` text;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `consultation_coordinator_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `leads` ADD `patient_id` text REFERENCES patients(id);--> statement-breakpoint
ALTER TABLE `leads` ADD `consent_record_id` text REFERENCES consent_records(id);--> statement-breakpoint
ALTER TABLE `leads` ADD `assigned_doctor_id` text REFERENCES doctors(id);--> statement-breakpoint
ALTER TABLE `leads` ADD `preferred_slot_date` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `appointment_id` text REFERENCES appointments(id);--> statement-breakpoint
ALTER TABLE `leads` ADD `broadcast_campaign_id` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `whatsapp_sent` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `leads` ADD `easyheal_owner_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `leads` ADD `easyheal_notes` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `prescription_request_id` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `session_type` text DEFAULT 'admin' NOT NULL;