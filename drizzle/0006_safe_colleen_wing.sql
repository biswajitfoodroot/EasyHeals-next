CREATE TABLE `hospital_listing_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`hospital_id` text NOT NULL,
	`package_name` text NOT NULL,
	`procedure_name` text,
	`department` text,
	`price_min` real,
	`price_max` real,
	`currency` text DEFAULT 'INR' NOT NULL,
	`inclusions` text,
	`exclusions` text,
	`length_of_stay` text,
	`source` text DEFAULT 'admin_ingestion' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hospital_listing_package_unique_idx` ON `hospital_listing_packages` (`hospital_id`,`package_name`);--> statement-breakpoint
CREATE TABLE `ingestion_field_confidences` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`field_key` text NOT NULL,
	`extracted_value` text,
	`source_type` text,
	`source_url` text,
	`confidence` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`job_id`) REFERENCES `ingestion_jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_field_confidence_unique_idx` ON `ingestion_field_confidences` (`job_id`,`entity_type`,`entity_id`,`field_key`);--> statement-breakpoint
CREATE TABLE `ingestion_package_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`hospital_candidate_id` text,
	`package_name` text NOT NULL,
	`procedure_name` text,
	`department` text,
	`price_min` real,
	`price_max` real,
	`currency` text DEFAULT 'INR' NOT NULL,
	`inclusions` text,
	`exclusions` text,
	`length_of_stay` text,
	`outlier_flags` text DEFAULT '[]',
	`raw_payload` text,
	`ai_confidence` real,
	`merge_action` text DEFAULT 'review' NOT NULL,
	`apply_status` text DEFAULT 'draft' NOT NULL,
	`review_status` text DEFAULT 'draft' NOT NULL,
	`reviewed_by_user_id` text,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`job_id`) REFERENCES `ingestion_jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hospital_candidate_id`) REFERENCES `ingestion_hospital_candidates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ingestion_research_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by_user_id` text,
	`query` text NOT NULL,
	`source_title` text,
	`source_url` text NOT NULL,
	`source_type` text DEFAULT 'google_result' NOT NULL,
	`queue_status` text DEFAULT 'queued' NOT NULL,
	`next_action` text DEFAULT 'scrape_website' NOT NULL,
	`linked_job_id` text,
	`failure_reason` text,
	`task_payload` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_job_id`) REFERENCES `ingestion_jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
DROP INDEX `sessions_user_idx`;--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
DROP INDEX "contributor_trust_user_idx";--> statement-breakpoint
DROP INDEX "departments_name_unique";--> statement-breakpoint
DROP INDEX "doctor_hospital_affiliation_unique_idx";--> statement-breakpoint
DROP INDEX "doctors_slug_unique";--> statement-breakpoint
DROP INDEX "hospital_accounts_email_idx";--> statement-breakpoint
DROP INDEX "hospital_accounts_hospital_email_idx";--> statement-breakpoint
DROP INDEX "hospital_listing_package_unique_idx";--> statement-breakpoint
DROP INDEX "hospitals_slug_unique";--> statement-breakpoint
DROP INDEX "hospitals_google_place_id_unique";--> statement-breakpoint
DROP INDEX "hospitals_city_name_idx";--> statement-breakpoint
DROP INDEX "hospitals_slug_unique_idx";--> statement-breakpoint
DROP INDEX "ingestion_doctor_candidate_unique_idx";--> statement-breakpoint
DROP INDEX "ingestion_field_confidence_unique_idx";--> statement-breakpoint
DROP INDEX "ingestion_hospital_candidate_unique_idx";--> statement-breakpoint
DROP INDEX "package_feature_key_idx";--> statement-breakpoint
DROP INDEX "packages_code_unique";--> statement-breakpoint
DROP INDEX "roles_code_unique";--> statement-breakpoint
DROP INDEX "sessions_session_token_unique";--> statement-breakpoint
DROP INDEX "sessions_user_idx";--> statement-breakpoint
DROP INDEX "taxonomy_parent_child_idx";--> statement-breakpoint
DROP INDEX "taxonomy_nodes_slug_unique";--> statement-breakpoint
DROP INDEX "user_role_unique_idx";--> statement-breakpoint
DROP INDEX "users_email_idx";--> statement-breakpoint
DROP INDEX "users_google_id_idx";--> statement-breakpoint
ALTER TABLE `ingestion_doctor_candidates` ALTER COLUMN "apply_status" TO "apply_status" text NOT NULL DEFAULT 'draft';--> statement-breakpoint
CREATE UNIQUE INDEX `contributor_trust_user_idx` ON `contributor_trust` (`contributor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `departments_name_unique` ON `departments` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `doctor_hospital_affiliation_unique_idx` ON `doctor_hospital_affiliations` (`doctor_id`,`hospital_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `doctors_slug_unique` ON `doctors` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospital_accounts_email_idx` ON `hospital_accounts` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospital_accounts_hospital_email_idx` ON `hospital_accounts` (`hospital_id`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospitals_slug_unique` ON `hospitals` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospitals_google_place_id_unique` ON `hospitals` (`google_place_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospitals_city_name_idx` ON `hospitals` (`city`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospitals_slug_unique_idx` ON `hospitals` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_doctor_candidate_unique_idx` ON `ingestion_doctor_candidates` (`job_id`,`full_name`,`specialization`);--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_hospital_candidate_unique_idx` ON `ingestion_hospital_candidates` (`job_id`,`name`,`city`);--> statement-breakpoint
CREATE UNIQUE INDEX `package_feature_key_idx` ON `package_features` (`package_id`,`feature_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `packages_code_unique` ON `packages` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `roles_code_unique` ON `roles` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_session_token_unique` ON `sessions` (`session_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_parent_child_idx` ON `taxonomy_edges` (`parent_node_id`,`child_node_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_nodes_slug_unique` ON `taxonomy_nodes` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_role_unique_idx` ON `user_role_map` (`user_id`,`role_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_google_id_idx` ON `users` (`google_id`);--> statement-breakpoint
ALTER TABLE `ingestion_doctor_candidates` ADD `consultation_fee` real;--> statement-breakpoint
ALTER TABLE `ingestion_doctor_candidates` ADD `consultation_days` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `ingestion_doctor_candidates` ADD `opd_timing` text;--> statement-breakpoint
ALTER TABLE `ingestion_doctor_candidates` ADD `outlier_flags` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `ingestion_doctor_candidates` ADD `review_status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestion_doctor_candidates` ADD `reviewed_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `ingestion_doctor_candidates` ADD `reviewed_at` integer;--> statement-breakpoint
ALTER TABLE `ingestion_hospital_candidates` ALTER COLUMN "apply_status" TO "apply_status" text NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `ingestion_hospital_candidates` ADD `address_data` text;--> statement-breakpoint
ALTER TABLE `ingestion_hospital_candidates` ADD `contact_numbers` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `ingestion_hospital_candidates` ADD `whatsapp` text;--> statement-breakpoint
ALTER TABLE `ingestion_hospital_candidates` ADD `social_links` text;--> statement-breakpoint
ALTER TABLE `ingestion_hospital_candidates` ADD `operating_hours` text;--> statement-breakpoint
ALTER TABLE `ingestion_hospital_candidates` ADD `departments` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `ingestion_hospital_candidates` ADD `major_services` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `ingestion_hospital_candidates` ADD `key_facilities` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `ingestion_hospital_candidates` ADD `unique_offerings` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `ingestion_hospital_candidates` ADD `source_links` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `ingestion_hospital_candidates` ADD `outlier_flags` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `ingestion_hospital_candidates` ADD `review_status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestion_hospital_candidates` ADD `reviewed_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `ingestion_hospital_candidates` ADD `reviewed_at` integer;--> statement-breakpoint
ALTER TABLE `ingestion_service_candidates` ALTER COLUMN "apply_status" TO "apply_status" text NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `ingestion_service_candidates` ADD `source_links` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `ingestion_service_candidates` ADD `outlier_flags` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `ingestion_service_candidates` ADD `merge_action` text DEFAULT 'review' NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestion_service_candidates` ADD `review_status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestion_service_candidates` ADD `reviewed_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `ingestion_service_candidates` ADD `reviewed_at` integer;--> statement-breakpoint
ALTER TABLE `ingestion_service_candidates` ADD `updated_at` integer DEFAULT (unixepoch() * 1000);--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "password_hash" TO "password_hash" text;--> statement-breakpoint
ALTER TABLE `users` ADD `google_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `google_avatar` text;--> statement-breakpoint
ALTER TABLE `users` ADD `entity_type` text;--> statement-breakpoint
ALTER TABLE `users` ADD `entity_id` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `ai_enriched_at` integer;--> statement-breakpoint
ALTER TABLE `doctors` ADD `ai_review_summary` text;--> statement-breakpoint
ALTER TABLE `ingestion_sources` ADD `updated_at` integer DEFAULT (unixepoch() * 1000);