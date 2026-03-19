CREATE TABLE `contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`contributor_id` text,
	`change_type` text DEFAULT 'update' NOT NULL,
	`field_changed` text,
	`old_value` text,
	`new_value` text NOT NULL,
	`outlier_score` integer DEFAULT 0 NOT NULL,
	`outlier_flags` text DEFAULT '[]',
	`ai_confidence` real,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`reject_reason` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`contributor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contributor_trust` (
	`id` text PRIMARY KEY NOT NULL,
	`contributor_id` text NOT NULL,
	`trust_score` integer DEFAULT 50 NOT NULL,
	`total_edits` integer DEFAULT 0 NOT NULL,
	`approved_edits` integer DEFAULT 0 NOT NULL,
	`rejected_edits` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`contributor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contributor_trust_user_idx` ON `contributor_trust` (`contributor_id`);--> statement-breakpoint
CREATE TABLE `hospital_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`hospital_id` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`contact_name` text NOT NULL,
	`designation` text,
	`otp_verified` integer DEFAULT false NOT NULL,
	`package_tier` text DEFAULT 'free' NOT NULL,
	`package_expires` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hospital_accounts_email_idx` ON `hospital_accounts` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospital_accounts_hospital_email_idx` ON `hospital_accounts` (`hospital_id`,`email`);--> statement-breakpoint
CREATE TABLE `otp_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`otp_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE TABLE `search_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`query_hash` text NOT NULL,
	`detected_intent` text,
	`detected_lang` text,
	`result_count` integer DEFAULT 0 NOT NULL,
	`city` text,
	`created_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
ALTER TABLE `hospitals` ADD `type` text DEFAULT 'hospital' NOT NULL;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `is_private` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `address` text;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `longitude` real;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `phones` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `hospitals` ADD `website` text;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `specialties` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `hospitals` ADD `facilities` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `hospitals` ADD `working_hours` text;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `fees_range` text;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `photos` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `hospitals` ADD `accreditations` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `hospitals` ADD `description` text;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `source` text DEFAULT 'crowd' NOT NULL;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `community_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `contribution_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `claimed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `claimed_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `hospitals` ADD `reg_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `package_tier` text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `google_place_id` text;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `rating` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `review_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `hospitals_google_place_id_unique` ON `hospitals` (`google_place_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospitals_city_name_idx` ON `hospitals` (`city`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospitals_slug_unique_idx` ON `hospitals` (`slug`);
