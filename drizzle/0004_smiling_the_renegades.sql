CREATE TABLE `ingestion_doctor_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`hospital_candidate_id` text,
	`full_name` text NOT NULL,
	`normalized_name` text,
	`specialization` text,
	`qualifications` text DEFAULT '[]',
	`languages` text DEFAULT '[]',
	`phone` text,
	`email` text,
	`years_of_experience` integer,
	`fee_min` real,
	`fee_max` real,
	`schedule` text,
	`raw_payload` text,
	`ai_confidence` real,
	`match_doctor_id` text,
	`merge_action` text DEFAULT 'review' NOT NULL,
	`apply_status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`job_id`) REFERENCES `ingestion_jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hospital_candidate_id`) REFERENCES `ingestion_hospital_candidates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_doctor_candidate_unique_idx` ON `ingestion_doctor_candidates` (`job_id`,`full_name`,`specialization`);--> statement-breakpoint
CREATE TABLE `ingestion_hospital_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text,
	`city` text,
	`state` text,
	`country` text DEFAULT 'India',
	`address_line_1` text,
	`phone` text,
	`email` text,
	`website` text,
	`specialties` text DEFAULT '[]',
	`services` text DEFAULT '[]',
	`description` text,
	`rating` real,
	`review_count` integer,
	`latitude` real,
	`longitude` real,
	`raw_payload` text,
	`ai_confidence` real,
	`match_hospital_id` text,
	`merge_action` text DEFAULT 'review' NOT NULL,
	`apply_status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`job_id`) REFERENCES `ingestion_jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_hospital_candidate_unique_idx` ON `ingestion_hospital_candidates` (`job_id`,`name`,`city`);--> statement-breakpoint
CREATE TABLE `ingestion_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`requested_by_user_id` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`source_url` text NOT NULL,
	`search_query` text,
	`target_city` text,
	`run_mode` text DEFAULT 'website_google' NOT NULL,
	`summary` text,
	`ai_merged_payload` text,
	`error_message` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ingestion_service_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`hospital_candidate_id` text,
	`service_name` text NOT NULL,
	`category` text,
	`description` text,
	`raw_payload` text,
	`ai_confidence` real,
	`apply_status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`job_id`) REFERENCES `ingestion_jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hospital_candidate_id`) REFERENCES `ingestion_hospital_candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ingestion_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_url` text,
	`title` text,
	`snippet` text,
	`raw_content` text,
	`structured_payload` text,
	`confidence` real,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`job_id`) REFERENCES `ingestion_jobs`(`id`) ON UPDATE no action ON DELETE no action
);
