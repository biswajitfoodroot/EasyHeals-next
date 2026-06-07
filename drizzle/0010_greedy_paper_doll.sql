CREATE TABLE `ai_embeddings` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text,
	`source_type` text NOT NULL,
	`source_id` text,
	`content_text_enc` text NOT NULL,
	`embedding` text,
	`specialty_tags` text DEFAULT '[]',
	`language_code` text DEFAULT 'en' NOT NULL,
	`retrieval_count` integer DEFAULT 0 NOT NULL,
	`last_retrieved_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_emb_patient_type_idx` ON `ai_embeddings` (`patient_id`,`source_type`);--> statement-breakpoint
CREATE INDEX `ai_emb_system_idx` ON `ai_embeddings` (`source_type`);--> statement-breakpoint
CREATE INDEX `ai_emb_source_idx` ON `ai_embeddings` (`source_id`);--> statement-breakpoint
CREATE TABLE `ai_knowledge_base` (
	`id` text PRIMARY KEY NOT NULL,
	`topic` text NOT NULL,
	`content_enc` text NOT NULL,
	`source_type` text DEFAULT 'seeded' NOT NULL,
	`source_url` text,
	`specialty_tags` text DEFAULT '[]',
	`language_code` text DEFAULT 'en' NOT NULL,
	`embedding` text,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`positive_feedback_count` integer DEFAULT 0 NOT NULL,
	`negative_feedback_count` integer DEFAULT 0 NOT NULL,
	`relevance_score` real DEFAULT 0.5 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`last_updated` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE INDEX `ai_kb_source_type_idx` ON `ai_knowledge_base` (`source_type`,`is_active`);--> statement-breakpoint
CREATE INDEX `ai_kb_relevance_idx` ON `ai_knowledge_base` (`relevance_score`,`is_active`);--> statement-breakpoint
CREATE TABLE `ai_patient_profiles` (
	`patient_id` text PRIMARY KEY NOT NULL,
	`communication_style` text,
	`preferred_response_format` text DEFAULT 'conversational' NOT NULL,
	`preferred_language` text DEFAULT 'en' NOT NULL,
	`health_goals_enc` text,
	`known_concerns_enc` text,
	`active_conditions_enc` text,
	`current_medications_enc` text,
	`risk_factors_enc` text,
	`interaction_count` integer DEFAULT 0 NOT NULL,
	`conversation_count` integer DEFAULT 0 NOT NULL,
	`document_count` integer DEFAULT 0 NOT NULL,
	`profile_confidence` real DEFAULT 0 NOT NULL,
	`last_synthesized_at` integer,
	`synthesis_version` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ai_response_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`turn_index` integer DEFAULT 0 NOT NULL,
	`explicit_rating` text,
	`implicit_signal` text,
	`response_length_chars` integer,
	`response_format` text,
	`topic_tags` text DEFAULT '[]',
	`led_to_action` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_feedback_patient_idx` ON `ai_response_feedback` (`patient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_feedback_positive_idx` ON `ai_response_feedback` (`led_to_action`);--> statement-breakpoint
CREATE TABLE `care_nav_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`symptoms_enc` text NOT NULL,
	`matched_provider_ids` text DEFAULT '[]',
	`selected_provider_id` text,
	`outcome` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `care_nav_patient_idx` ON `care_nav_sessions` (`patient_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `funnel_events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`patient_id` text,
	`event_type` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE INDEX `funnel_session_idx` ON `funnel_events` (`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `funnel_entity_idx` ON `funnel_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `funnel_patient_idx` ON `funnel_events` (`patient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `funnel_event_type_idx` ON `funnel_events` (`event_type`,`created_at`);--> statement-breakpoint
CREATE TABLE `patient_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`reminder_type` text NOT NULL,
	`title` text NOT NULL,
	`body_enc` text,
	`schedule_cron` text,
	`channel` text DEFAULT 'whatsapp' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_ai_generated` integer DEFAULT false NOT NULL,
	`source_event_id` text,
	`last_sent_at` integer,
	`next_fire_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reminders_patient_idx` ON `patient_reminders` (`patient_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `reminders_next_fire_idx` ON `patient_reminders` (`next_fire_at`,`is_active`);--> statement-breakpoint
CREATE TABLE `referral_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`code` text NOT NULL,
	`total_clicks` integer DEFAULT 0 NOT NULL,
	`total_conversions` integer DEFAULT 0 NOT NULL,
	`points_awarded` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_codes_patient_id_unique` ON `referral_codes` (`patient_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `referral_codes_code_unique` ON `referral_codes` (`code`);--> statement-breakpoint
CREATE INDEX `referral_code_idx` ON `referral_codes` (`code`);--> statement-breakpoint
CREATE TABLE `referral_conversions` (
	`id` text PRIMARY KEY NOT NULL,
	`code_id` text NOT NULL,
	`referred_patient_id` text NOT NULL,
	`converted_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`code_id`) REFERENCES `referral_codes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`referred_patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `referral_conv_code_idx` ON `referral_conversions` (`code_id`);--> statement-breakpoint
CREATE TABLE `research_batch_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by_user_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	`done_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`city` text,
	`entity_type` text DEFAULT 'hospital' NOT NULL,
	`items` text DEFAULT '[]',
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `research_batch_jobs_user_idx` ON `research_batch_jobs` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `research_batch_jobs_status_idx` ON `research_batch_jobs` (`status`);--> statement-breakpoint
ALTER TABLE `hospitals` ADD `seo_keywords` text DEFAULT '[]';--> statement-breakpoint
CREATE INDEX `hospitals_directory_idx` ON `hospitals` (`is_active`,`is_private`,`verified`,`rating`);--> statement-breakpoint
ALTER TABLE `ingestion_jobs` ADD `batch_id` text REFERENCES research_batch_jobs(id);--> statement-breakpoint
ALTER TABLE `patient_sessions` ADD `last_active_at` integer;--> statement-breakpoint
ALTER TABLE `patient_sessions` ADD `max_ttl_hours` integer DEFAULT 168 NOT NULL;--> statement-breakpoint
ALTER TABLE `patient_sessions` ADD `extended_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `doctor_aff_lookup_idx` ON `doctor_hospital_affiliations` (`doctor_id`,`is_active`,`affiliation_status`);--> statement-breakpoint
CREATE INDEX `doctors_slug_active_idx` ON `doctors` (`slug`,`is_active`);--> statement-breakpoint
CREATE INDEX `doctors_city_active_rating_idx` ON `doctors` (`is_active`,`city`,`rating`);--> statement-breakpoint
CREATE INDEX `agreements_status_hospital_idx` ON `provider_agreements` (`status`,`hospital_id`);