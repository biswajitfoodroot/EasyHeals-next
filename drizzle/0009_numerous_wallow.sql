CREATE TABLE `patient_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`patient_id` text,
	`patient_name` text,
	`patient_phone` text,
	`rating` real NOT NULL,
	`title` text,
	`body` text,
	`visit_date` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`moderated_by_user_id` text,
	`moderated_at` integer,
	`moderation_note` text,
	`source` text DEFAULT 'web' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`moderated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pr_entity_idx` ON `patient_reviews` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `pr_status_idx` ON `patient_reviews` (`status`);--> statement-breakpoint
CREATE INDEX `pr_patient_idx` ON `patient_reviews` (`patient_id`);--> statement-breakpoint
ALTER TABLE `doctors` ADD `review_sum` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `doctors` ADD `google_rating` real;--> statement-breakpoint
ALTER TABLE `entity_access_requests` ADD `request_type` text DEFAULT 'claim' NOT NULL;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `review_sum` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `google_rating` real;