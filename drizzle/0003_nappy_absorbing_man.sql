CREATE TABLE `doctor_hospital_affiliations` (
	`id` text PRIMARY KEY NOT NULL,
	`doctor_id` text NOT NULL,
	`hospital_id` text NOT NULL,
	`role` text DEFAULT 'Visiting Consultant' NOT NULL,
	`schedule` text,
	`fee_min` real,
	`fee_max` real,
	`is_primary` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `doctor_hospital_affiliation_unique_idx` ON `doctor_hospital_affiliations` (`doctor_id`,`hospital_id`);--> statement-breakpoint
ALTER TABLE `doctors` ADD `slug` text NOT NULL;--> statement-breakpoint
ALTER TABLE `doctors` ADD `specialties` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `doctors` ADD `qualifications` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `doctors` ADD `languages` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `doctors` ADD `consultation_hours` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `city` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `state` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `email` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `avatar_url` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `fee_min` real;--> statement-breakpoint
ALTER TABLE `doctors` ADD `fee_max` real;--> statement-breakpoint
ALTER TABLE `doctors` ADD `rating` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `doctors` ADD `review_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `doctors` ADD `verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `doctors` ADD `updated_at` integer DEFAULT (unixepoch() * 1000);--> statement-breakpoint
CREATE UNIQUE INDEX `doctors_slug_unique` ON `doctors` (`slug`);
