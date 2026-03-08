CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_token` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_session_token_unique` ON `sessions` (`session_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
ALTER TABLE `hospitals` ADD `slug` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `hospitals_slug_unique` ON `hospitals` (`slug`);