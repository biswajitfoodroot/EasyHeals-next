CREATE TABLE `agreement_events` (
	`id` text PRIMARY KEY NOT NULL,
	`agreement_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_id` text,
	`actor_type` text,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`agreement_id`) REFERENCES `provider_agreements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agreement_event_idx` ON `agreement_events` (`agreement_id`);--> statement-breakpoint
CREATE TABLE `ai_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`title` text,
	`messages_encrypted` text NOT NULL,
	`last_message_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ai_conv_patient_idx` ON `ai_conversations` (`patient_id`);--> statement-breakpoint
CREATE INDEX `ai_conv_patient_last_idx` ON `ai_conversations` (`patient_id`,`last_message_at`);--> statement-breakpoint
CREATE TABLE `billable_events` (
	`id` text PRIMARY KEY NOT NULL,
	`referral_case_id` text,
	`appointment_id` text,
	`hospital_id` text,
	`billing_amount` integer,
	`currency` text DEFAULT 'INR' NOT NULL,
	`source` text NOT NULL,
	`file_url` text,
	`verification_status` text DEFAULT 'pending' NOT NULL,
	`verified_by_user_id` text,
	`verified_at` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`referral_case_id`) REFERENCES `referral_cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `billable_hospital_idx` ON `billable_events` (`hospital_id`);--> statement-breakpoint
CREATE INDEX `billable_referral_idx` ON `billable_events` (`referral_case_id`);--> statement-breakpoint
CREATE TABLE `channel_attributions` (
	`id` text PRIMARY KEY NOT NULL,
	`partner_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`attribution_type` text DEFAULT 'onboarding' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`partner_id`) REFERENCES `channel_partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `channel_attr_partner_idx` ON `channel_attributions` (`partner_id`);--> statement-breakpoint
CREATE INDEX `channel_attr_target_idx` ON `channel_attributions` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `channel_partners` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`phone` text,
	`email` text,
	`partner_type` text DEFAULT 'agent' NOT NULL,
	`city` text,
	`state` text,
	`status` text DEFAULT 'active' NOT NULL,
	`fraud_flag` integer DEFAULT false,
	`notes` text,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `channel_partner_status_idx` ON `channel_partners` (`status`);--> statement-breakpoint
CREATE INDEX `channel_partner_type_idx` ON `channel_partners` (`partner_type`);--> statement-breakpoint
CREATE TABLE `chatbot_knowledge` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`key` text NOT NULL,
	`aliases` text DEFAULT '[]',
	`data` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chatbot_knowledge_type_key_idx` ON `chatbot_knowledge` (`type`,`key`);--> statement-breakpoint
CREATE INDEX `chatbot_knowledge_type_idx` ON `chatbot_knowledge` (`type`);--> statement-breakpoint
CREATE TABLE `chatbot_training_examples` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`language` text DEFAULT 'English' NOT NULL,
	`intent` text,
	`subtype` text,
	`input` text NOT NULL,
	`output` text NOT NULL,
	`cluster` text,
	`quality_tag` text,
	`created_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE INDEX `chatbot_training_lang_idx` ON `chatbot_training_examples` (`language`);--> statement-breakpoint
CREATE INDEX `chatbot_training_intent_idx` ON `chatbot_training_examples` (`intent`);--> statement-breakpoint
CREATE INDEX `chatbot_training_subtype_idx` ON `chatbot_training_examples` (`subtype`);--> statement-breakpoint
CREATE TABLE `commission_disputes` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`raised_by_user_id` text,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`resolution` text,
	`resolved_by_user_id` text,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`entry_id`) REFERENCES `commission_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`raised_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `dispute_entry_idx` ON `commission_disputes` (`entry_id`);--> statement-breakpoint
CREATE TABLE `commission_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`agreement_id` text NOT NULL,
	`hospital_id` text,
	`doctor_id` text,
	`appointment_id` text,
	`referral_case_id` text,
	`amount_paise` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`entered_by` text,
	`locked_at` integer,
	`notified_at` integer,
	`provider_accepted_at` integer,
	`disputed_at` integer,
	`paid_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`agreement_id`) REFERENCES `provider_agreements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entered_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `commission_agreement_idx` ON `commission_entries` (`agreement_id`);--> statement-breakpoint
CREATE INDEX `commission_hospital_idx` ON `commission_entries` (`hospital_id`);--> statement-breakpoint
CREATE INDEX `commission_status_idx` ON `commission_entries` (`status`);--> statement-breakpoint
CREATE TABLE `coordinator_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`can_view_kpis` integer DEFAULT false NOT NULL,
	`can_view_providers` integer DEFAULT true NOT NULL,
	`can_edit_providers` integer DEFAULT false NOT NULL,
	`can_view_agreements` integer DEFAULT true NOT NULL,
	`can_edit_agreements` integer DEFAULT false NOT NULL,
	`can_view_kyc` integer DEFAULT true NOT NULL,
	`can_approve_kyc` integer DEFAULT false NOT NULL,
	`can_view_users` integer DEFAULT false NOT NULL,
	`can_manage_users` integer DEFAULT false NOT NULL,
	`notes` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `coord_perm_user_idx` ON `coordinator_permissions` (`user_id`);--> statement-breakpoint
CREATE TABLE `document_access_log` (
	`id` text PRIMARY KEY NOT NULL,
	`share_id` text NOT NULL,
	`accessed_by` text NOT NULL,
	`accessed_at` integer DEFAULT (unixepoch() * 1000),
	`ip_hash` text,
	FOREIGN KEY (`share_id`) REFERENCES `document_shares`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accessed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `doc_access_share_idx` ON `document_access_log` (`share_id`);--> statement-breakpoint
CREATE INDEX `doc_access_user_idx` ON `document_access_log` (`accessed_by`);--> statement-breakpoint
CREATE TABLE `document_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`provider_type` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`document_id`) REFERENCES `health_documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `doc_shares_document_idx` ON `document_shares` (`document_id`);--> statement-breakpoint
CREATE INDEX `doc_shares_patient_idx` ON `document_shares` (`patient_id`);--> statement-breakpoint
CREATE INDEX `doc_shares_provider_idx` ON `document_shares` (`provider_id`);--> statement-breakpoint
CREATE TABLE `entity_access_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`business_name` text,
	`license_number` text,
	`license_type` text,
	`kyc_documents` text DEFAULT '[]',
	`contact_phone` text,
	`contact_email` text,
	`notes` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`review_notes` text,
	`approved_entity_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ear_requester_idx` ON `entity_access_requests` (`requester_id`);--> statement-breakpoint
CREATE INDEX `ear_status_idx` ON `entity_access_requests` (`status`);--> statement-breakpoint
CREATE TABLE `health_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`blob_url` text NOT NULL,
	`file_type` text NOT NULL,
	`doc_type` text,
	`source_name` text,
	`doc_date` integer,
	`title` text,
	`ai_status` text DEFAULT 'pending' NOT NULL,
	`uploaded_at` integer DEFAULT (unixepoch() * 1000),
	`consent_id` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`consent_id`) REFERENCES `consent_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `health_documents_patient_idx` ON `health_documents` (`patient_id`);--> statement-breakpoint
CREATE INDEX `health_documents_patient_status_idx` ON `health_documents` (`patient_id`,`ai_status`);--> statement-breakpoint
CREATE TABLE `health_memory_events` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`source` text NOT NULL,
	`source_ref_id` text,
	`event_type` text NOT NULL,
	`event_date` integer NOT NULL,
	`data_encrypted` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `hme_patient_date_idx` ON `health_memory_events` (`patient_id`,`event_date`);--> statement-breakpoint
CREATE INDEX `hme_patient_type_idx` ON `health_memory_events` (`patient_id`,`event_type`);--> statement-breakpoint
CREATE INDEX `hme_source_ref_idx` ON `health_memory_events` (`source_ref_id`);--> statement-breakpoint
CREATE TABLE `opd_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`doctor_id` text,
	`token_number` integer NOT NULL,
	`patient_name` text,
	`patient_phone` text,
	`status` text DEFAULT 'waiting' NOT NULL,
	`called_at` integer,
	`done_at` integer,
	`notes` text,
	`date` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`provider_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `opd_tokens_provider_date_idx` ON `opd_tokens` (`provider_id`,`date`);--> statement-breakpoint
CREATE INDEX `opd_tokens_doctor_date_idx` ON `opd_tokens` (`doctor_id`,`date`);--> statement-breakpoint
CREATE TABLE `patient_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`street` text,
	`state` text,
	`pincode` text,
	`alt_phone` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patient_addresses_patient_id_unique` ON `patient_addresses` (`patient_id`);--> statement-breakpoint
CREATE INDEX `addr_patient_idx` ON `patient_addresses` (`patient_id`);--> statement-breakpoint
CREATE TABLE `patient_family_links` (
	`id` text PRIMARY KEY NOT NULL,
	`primary_patient_id` text NOT NULL,
	`linked_patient_id` text NOT NULL,
	`relation` text DEFAULT 'Family' NOT NULL,
	`display_name` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`primary_patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`linked_patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `family_links_pair_idx` ON `patient_family_links` (`primary_patient_id`,`linked_patient_id`);--> statement-breakpoint
CREATE INDEX `family_links_primary_idx` ON `patient_family_links` (`primary_patient_id`);--> statement-breakpoint
CREATE INDEX `family_links_linked_idx` ON `patient_family_links` (`linked_patient_id`);--> statement-breakpoint
CREATE TABLE `patient_health_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`height` text,
	`weight` text,
	`blood_group` text,
	`conditions` text,
	`allergies` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patient_health_profiles_patient_id_unique` ON `patient_health_profiles` (`patient_id`);--> statement-breakpoint
CREATE INDEX `hp_patient_idx` ON `patient_health_profiles` (`patient_id`);--> statement-breakpoint
CREATE TABLE `patient_medications` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`name` text NOT NULL,
	`dosage` text,
	`frequency` text,
	`times` text DEFAULT '[]',
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meds_patient_idx` ON `patient_medications` (`patient_id`);--> statement-breakpoint
CREATE INDEX `meds_active_idx` ON `patient_medications` (`patient_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `patient_record_access` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`granted_to_user_id` text NOT NULL,
	`granted_by_user_id` text NOT NULL,
	`hospital_id` text,
	`access_level` text DEFAULT 'metadata' NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`granted_to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`granted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pra_patient_idx` ON `patient_record_access` (`patient_id`);--> statement-breakpoint
CREATE INDEX `pra_grantee_idx` ON `patient_record_access` (`granted_to_user_id`);--> statement-breakpoint
CREATE INDEX `pra_grantor_idx` ON `patient_record_access` (`granted_by_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pra_patient_grantee_hospital_idx` ON `patient_record_access` (`patient_id`,`granted_to_user_id`,`hospital_id`);--> statement-breakpoint
CREATE TABLE `patient_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`patient_id` text NOT NULL,
	`phone_hash` text NOT NULL,
	`phone_encrypted` text,
	`city` text,
	`lang` text DEFAULT 'en' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patient_sessions_token_hash_unique` ON `patient_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `patient_sessions_token_idx` ON `patient_sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `patient_vitals` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`recorded_date` text NOT NULL,
	`weight` text,
	`bp` text,
	`glucose` text,
	`pulse` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vitals_patient_date_idx` ON `patient_vitals` (`patient_id`,`recorded_date`);--> statement-breakpoint
CREATE TABLE `payout_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_ref` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_amount_paise` integer DEFAULT 0 NOT NULL,
	`entry_count` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` text,
	`approved_by_user_id` text,
	`approved_at` integer,
	`paid_at` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payout_batches_batch_ref_unique` ON `payout_batches` (`batch_ref`);--> statement-breakpoint
CREATE INDEX `payout_batch_status_idx` ON `payout_batches` (`status`);--> statement-breakpoint
CREATE TABLE `previsit_briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text,
	`patient_id` text NOT NULL,
	`doctor_id` text,
	`brief_encrypted` text NOT NULL,
	`generated_at` integer DEFAULT (unixepoch() * 1000),
	`viewed_at` integer,
	`consent_id` text,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`consent_id`) REFERENCES `consent_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `previsit_briefs_appointment_id_unique` ON `previsit_briefs` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `previsit_patient_idx` ON `previsit_briefs` (`patient_id`);--> statement-breakpoint
CREATE INDEX `previsit_doctor_idx` ON `previsit_briefs` (`doctor_id`);--> statement-breakpoint
CREATE TABLE `provider_agreements` (
	`id` text PRIMARY KEY NOT NULL,
	`hospital_id` text,
	`doctor_id` text,
	`entity_type` text DEFAULT 'hospital' NOT NULL,
	`agreement_type` text DEFAULT 'network_partnership' NOT NULL,
	`scope_json` text,
	`terms_version` text DEFAULT 'v1' NOT NULL,
	`custom_terms` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`accepted_at` integer,
	`accepted_by_user_id` text,
	`accepted_ip` text,
	`rejected_at` integer,
	`rejection_reason` text,
	`expires_at` integer,
	`tier_code` text,
	`commission_percent` integer,
	`commission_flat` integer,
	`revenue_share_notes` text,
	`created_by` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accepted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agreement_hospital_idx` ON `provider_agreements` (`hospital_id`);--> statement-breakpoint
CREATE INDEX `agreement_doctor_idx` ON `provider_agreements` (`doctor_id`);--> statement-breakpoint
CREATE INDEX `agreement_status_idx` ON `provider_agreements` (`status`);--> statement-breakpoint
CREATE TABLE `provider_payout_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`entity_type` text DEFAULT 'hospital' NOT NULL,
	`beneficiary_name` text,
	`bank_account_number` text,
	`ifsc_code` text,
	`upi_id` text,
	`pan_number` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`verified_by_user_id` text,
	`verified_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`verified_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_payout_profiles_entity_id_unique` ON `provider_payout_profiles` (`entity_id`);--> statement-breakpoint
CREATE INDEX `payout_profile_entity_idx` ON `provider_payout_profiles` (`entity_id`);--> statement-breakpoint
CREATE TABLE `provider_referral_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`entity_type` text DEFAULT 'hospital' NOT NULL,
	`accepts_incoming` integer DEFAULT true,
	`referral_specialties` text,
	`default_response_sla_mins` integer DEFAULT 60,
	`accepted_geographies` text,
	`accepted_referral_types` text,
	`indicative_price_json` text,
	`requires_preapproval` integer DEFAULT false,
	`updated_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE INDEX `ref_pref_entity_idx` ON `provider_referral_preferences` (`entity_id`);--> statement-breakpoint
CREATE TABLE `provider_staff` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`sub_role` text DEFAULT 'receptionist' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`invited_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`provider_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `provider_staff_provider_idx` ON `provider_staff` (`provider_id`);--> statement-breakpoint
CREATE INDEX `provider_staff_user_idx` ON `provider_staff` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `provider_staff_provider_user_idx` ON `provider_staff` (`provider_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `referral_case_events` (
	`id` text PRIMARY KEY NOT NULL,
	`referral_case_id` text NOT NULL,
	`event_type` text NOT NULL,
	`event_payload` text,
	`created_by_actor_type` text DEFAULT 'system' NOT NULL,
	`created_by_actor_id` text DEFAULT '' NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`referral_case_id`) REFERENCES `referral_cases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ref_event_case_idx` ON `referral_case_events` (`referral_case_id`);--> statement-breakpoint
CREATE TABLE `referral_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`referral_code` text,
	`patient_id` text,
	`patient_name` text,
	`patient_phone` text,
	`source_type` text DEFAULT 'doctor' NOT NULL,
	`referring_provider_id` text,
	`referring_organization_id` text,
	`referral_type` text DEFAULT 'doctor_to_hospital' NOT NULL,
	`clinical_category` text,
	`suspected_condition` text,
	`urgency` text DEFAULT 'routine' NOT NULL,
	`clinical_notes` text,
	`destination_mode` text DEFAULT 'selected_provider' NOT NULL,
	`selected_destination_provider_id` text,
	`selected_destination_org_id` text,
	`destination_city` text,
	`destination_state` text,
	`outstation_required` integer DEFAULT false,
	`accommodation_required` integer DEFAULT false,
	`estimated_price_min` integer,
	`estimated_price_max` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`status_reason` text,
	`assigned_coordinator_id` text,
	`agreement_id` text,
	`consent_given` integer DEFAULT false,
	`created_by_actor_type` text DEFAULT 'provider_staff' NOT NULL,
	`created_by_actor_id` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	`closed_at` integer,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_coordinator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agreement_id`) REFERENCES `provider_agreements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_cases_referral_code_unique` ON `referral_cases` (`referral_code`);--> statement-breakpoint
CREATE INDEX `referral_referring_org_idx` ON `referral_cases` (`referring_organization_id`);--> statement-breakpoint
CREATE INDEX `referral_referring_prov_idx` ON `referral_cases` (`referring_provider_id`);--> statement-breakpoint
CREATE INDEX `referral_status_idx` ON `referral_cases` (`status`);--> statement-breakpoint
CREATE INDEX `referral_urgency_idx` ON `referral_cases` (`urgency`);--> statement-breakpoint
CREATE INDEX `referral_coordinator_idx` ON `referral_cases` (`assigned_coordinator_id`);--> statement-breakpoint
CREATE TABLE `referral_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`referral_case_id` text NOT NULL,
	`document_id` text,
	`file_name` text,
	`file_url` text,
	`source` text DEFAULT 'uploaded' NOT NULL,
	`uploaded_by_actor_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`referral_case_id`) REFERENCES `referral_cases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ref_doc_case_idx` ON `referral_documents` (`referral_case_id`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role` text PRIMARY KEY NOT NULL,
	`hospitals` text DEFAULT 'none' NOT NULL,
	`doctors` text DEFAULT 'none' NOT NULL,
	`ai_research` text DEFAULT 'none' NOT NULL,
	`provider_mgmt` text DEFAULT 'none' NOT NULL,
	`user_mgmt` text DEFAULT 'none' NOT NULL,
	`portal` text DEFAULT 'none' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `subscription_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`hospital_id` text NOT NULL,
	`billing_period` text NOT NULL,
	`sms_used` integer DEFAULT 0 NOT NULL,
	`whatsapp_used` integer DEFAULT 0 NOT NULL,
	`ai_reports_used` integer DEFAULT 0 NOT NULL,
	`sms_quota` integer DEFAULT 0 NOT NULL,
	`whatsapp_quota` integer DEFAULT 0 NOT NULL,
	`ai_reports_quota` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sub_usage_hospital_period_idx` ON `subscription_usage` (`hospital_id`,`billing_period`);--> statement-breakpoint
CREATE TABLE `travel_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`referral_case_id` text,
	`patient_name` text,
	`patient_phone` text,
	`destination_city` text,
	`check_in_date` integer,
	`check_out_date` integer,
	`guest_count` integer DEFAULT 1,
	`budget_paise` integer,
	`requirements` text,
	`status` text DEFAULT 'requested' NOT NULL,
	`assigned_coordinator_id` text,
	`commission_paise` integer,
	`notes` text,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`referral_case_id`) REFERENCES `referral_cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_coordinator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `travel_case_referral_idx` ON `travel_cases` (`referral_case_id`);--> statement-breakpoint
CREATE INDEX `travel_case_status_idx` ON `travel_cases` (`status`);--> statement-breakpoint
CREATE TABLE `travel_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`travel_case_id` text NOT NULL,
	`partner_name` text NOT NULL,
	`property_name` text,
	`rate_per_night_paise` integer,
	`total_amount_paise` integer,
	`inclusions` text,
	`distance_from_hospital_km` real,
	`partner_contact_phone` text,
	`status` text DEFAULT 'proposed' NOT NULL,
	`selected_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`travel_case_id`) REFERENCES `travel_cases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `travel_quote_case_idx` ON `travel_quotes` (`travel_case_id`);--> statement-breakpoint
CREATE TABLE `usage_topups` (
	`id` text PRIMARY KEY NOT NULL,
	`hospital_id` text NOT NULL,
	`topup_type` text NOT NULL,
	`quantity_added` integer NOT NULL,
	`amount_paise` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `topup_hospital_idx` ON `usage_topups` (`hospital_id`);--> statement-breakpoint
CREATE INDEX `topup_type_idx` ON `usage_topups` (`topup_type`);--> statement-breakpoint
CREATE TABLE `user_entity_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`permissions` text DEFAULT 'edit' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uep_user_entity_unique_idx` ON `user_entity_permissions` (`user_id`,`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `uep_user_idx` ON `user_entity_permissions` (`user_id`);--> statement-breakpoint
CREATE INDEX `uep_entity_idx` ON `user_entity_permissions` (`entity_type`,`entity_id`);--> statement-breakpoint
DROP INDEX "abuse_flags_actor_idx";--> statement-breakpoint
DROP INDEX "abuse_flags_type_idx";--> statement-breakpoint
DROP INDEX "agreement_event_idx";--> statement-breakpoint
DROP INDEX "ai_conv_patient_idx";--> statement-breakpoint
DROP INDEX "ai_conv_patient_last_idx";--> statement-breakpoint
DROP INDEX "analytics_events_name_idx";--> statement-breakpoint
DROP INDEX "analytics_events_actor_idx";--> statement-breakpoint
DROP INDEX "appointment_slots_doctor_time_idx";--> statement-breakpoint
DROP INDEX "appointment_slots_hospital_time_idx";--> statement-breakpoint
DROP INDEX "appointments_patient_idx";--> statement-breakpoint
DROP INDEX "appointments_doctor_idx";--> statement-breakpoint
DROP INDEX "appointments_hospital_idx";--> statement-breakpoint
DROP INDEX "appointments_status_idx";--> statement-breakpoint
DROP INDEX "appointments_scheduled_idx";--> statement-breakpoint
DROP INDEX "badges_slug_unique";--> statement-breakpoint
DROP INDEX "billable_hospital_idx";--> statement-breakpoint
DROP INDEX "billable_referral_idx";--> statement-breakpoint
DROP INDEX "channel_attr_partner_idx";--> statement-breakpoint
DROP INDEX "channel_attr_target_idx";--> statement-breakpoint
DROP INDEX "channel_partner_status_idx";--> statement-breakpoint
DROP INDEX "channel_partner_type_idx";--> statement-breakpoint
DROP INDEX "chatbot_knowledge_type_key_idx";--> statement-breakpoint
DROP INDEX "chatbot_knowledge_type_idx";--> statement-breakpoint
DROP INDEX "chatbot_training_lang_idx";--> statement-breakpoint
DROP INDEX "chatbot_training_intent_idx";--> statement-breakpoint
DROP INDEX "chatbot_training_subtype_idx";--> statement-breakpoint
DROP INDEX "dispute_entry_idx";--> statement-breakpoint
DROP INDEX "commission_agreement_idx";--> statement-breakpoint
DROP INDEX "commission_hospital_idx";--> statement-breakpoint
DROP INDEX "commission_status_idx";--> statement-breakpoint
DROP INDEX "consent_records_patient_idx";--> statement-breakpoint
DROP INDEX "consent_records_patient_purpose_idx";--> statement-breakpoint
DROP INDEX "consultation_messages_appointment_idx";--> statement-breakpoint
DROP INDEX "consultation_participants_session_idx";--> statement-breakpoint
DROP INDEX "consultation_participants_session_actor_idx";--> statement-breakpoint
DROP INDEX "consultation_room_configs_entity_idx";--> statement-breakpoint
DROP INDEX "consultation_sessions_appointment_idx";--> statement-breakpoint
DROP INDEX "contributor_trust_user_idx";--> statement-breakpoint
DROP INDEX "coord_perm_user_idx";--> statement-breakpoint
DROP INDEX "departments_name_unique";--> statement-breakpoint
DROP INDEX "doctor_hospital_affiliation_unique_idx";--> statement-breakpoint
DROP INDEX "doctors_slug_unique";--> statement-breakpoint
DROP INDEX "doc_access_share_idx";--> statement-breakpoint
DROP INDEX "doc_access_user_idx";--> statement-breakpoint
DROP INDEX "doc_shares_document_idx";--> statement-breakpoint
DROP INDEX "doc_shares_patient_idx";--> statement-breakpoint
DROP INDEX "doc_shares_provider_idx";--> statement-breakpoint
DROP INDEX "ear_requester_idx";--> statement-breakpoint
DROP INDEX "ear_status_idx";--> statement-breakpoint
DROP INDEX "health_documents_patient_idx";--> statement-breakpoint
DROP INDEX "health_documents_patient_status_idx";--> statement-breakpoint
DROP INDEX "hme_patient_date_idx";--> statement-breakpoint
DROP INDEX "hme_patient_type_idx";--> statement-breakpoint
DROP INDEX "hme_source_ref_idx";--> statement-breakpoint
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
DROP INDEX "opd_tokens_provider_date_idx";--> statement-breakpoint
DROP INDEX "opd_tokens_doctor_date_idx";--> statement-breakpoint
DROP INDEX "package_feature_key_idx";--> statement-breakpoint
DROP INDEX "packages_code_unique";--> statement-breakpoint
DROP INDEX "patient_addresses_patient_id_unique";--> statement-breakpoint
DROP INDEX "addr_patient_idx";--> statement-breakpoint
DROP INDEX "family_links_pair_idx";--> statement-breakpoint
DROP INDEX "family_links_primary_idx";--> statement-breakpoint
DROP INDEX "family_links_linked_idx";--> statement-breakpoint
DROP INDEX "patient_health_profiles_patient_id_unique";--> statement-breakpoint
DROP INDEX "hp_patient_idx";--> statement-breakpoint
DROP INDEX "meds_patient_idx";--> statement-breakpoint
DROP INDEX "meds_active_idx";--> statement-breakpoint
DROP INDEX "pra_patient_idx";--> statement-breakpoint
DROP INDEX "pra_grantee_idx";--> statement-breakpoint
DROP INDEX "pra_grantor_idx";--> statement-breakpoint
DROP INDEX "pra_patient_grantee_hospital_idx";--> statement-breakpoint
DROP INDEX "patient_sessions_token_hash_unique";--> statement-breakpoint
DROP INDEX "patient_sessions_token_idx";--> statement-breakpoint
DROP INDEX "vitals_patient_date_idx";--> statement-breakpoint
DROP INDEX "patients_phone_hash_unique";--> statement-breakpoint
DROP INDEX "patients_phone_hash_idx";--> statement-breakpoint
DROP INDEX "patients_city_idx";--> statement-breakpoint
DROP INDEX "patients_google_id_idx";--> statement-breakpoint
DROP INDEX "payment_transactions_razorpay_order_id_unique";--> statement-breakpoint
DROP INDEX "payment_transactions_patient_idx";--> statement-breakpoint
DROP INDEX "payment_transactions_status_idx";--> statement-breakpoint
DROP INDEX "payout_batches_batch_ref_unique";--> statement-breakpoint
DROP INDEX "payout_batch_status_idx";--> statement-breakpoint
DROP INDEX "point_events_type_proof_idx";--> statement-breakpoint
DROP INDEX "point_events_actor_idx";--> statement-breakpoint
DROP INDEX "previsit_briefs_appointment_id_unique";--> statement-breakpoint
DROP INDEX "previsit_patient_idx";--> statement-breakpoint
DROP INDEX "previsit_doctor_idx";--> statement-breakpoint
DROP INDEX "agreement_hospital_idx";--> statement-breakpoint
DROP INDEX "agreement_doctor_idx";--> statement-breakpoint
DROP INDEX "agreement_status_idx";--> statement-breakpoint
DROP INDEX "provider_payout_profiles_entity_id_unique";--> statement-breakpoint
DROP INDEX "payout_profile_entity_idx";--> statement-breakpoint
DROP INDEX "ref_pref_entity_idx";--> statement-breakpoint
DROP INDEX "provider_staff_provider_idx";--> statement-breakpoint
DROP INDEX "provider_staff_user_idx";--> statement-breakpoint
DROP INDEX "provider_staff_provider_user_idx";--> statement-breakpoint
DROP INDEX "ref_event_case_idx";--> statement-breakpoint
DROP INDEX "referral_cases_referral_code_unique";--> statement-breakpoint
DROP INDEX "referral_referring_org_idx";--> statement-breakpoint
DROP INDEX "referral_referring_prov_idx";--> statement-breakpoint
DROP INDEX "referral_status_idx";--> statement-breakpoint
DROP INDEX "referral_urgency_idx";--> statement-breakpoint
DROP INDEX "referral_coordinator_idx";--> statement-breakpoint
DROP INDEX "ref_doc_case_idx";--> statement-breakpoint
DROP INDEX "roles_code_unique";--> statement-breakpoint
DROP INDEX "sessions_session_token_unique";--> statement-breakpoint
DROP INDEX "sessions_user_idx";--> statement-breakpoint
DROP INDEX "specialty_synonyms_canonical_synonym_idx";--> statement-breakpoint
DROP INDEX "specialty_synonyms_synonym_idx";--> statement-breakpoint
DROP INDEX "streaks_actor_idx";--> statement-breakpoint
DROP INDEX "sub_usage_hospital_period_idx";--> statement-breakpoint
DROP INDEX "taxonomy_parent_child_idx";--> statement-breakpoint
DROP INDEX "taxonomy_nodes_slug_unique";--> statement-breakpoint
DROP INDEX "travel_case_referral_idx";--> statement-breakpoint
DROP INDEX "travel_case_status_idx";--> statement-breakpoint
DROP INDEX "travel_quote_case_idx";--> statement-breakpoint
DROP INDEX "topup_hospital_idx";--> statement-breakpoint
DROP INDEX "topup_type_idx";--> statement-breakpoint
DROP INDEX "user_badges_actor_badge_idx";--> statement-breakpoint
DROP INDEX "uep_user_entity_unique_idx";--> statement-breakpoint
DROP INDEX "uep_user_idx";--> statement-breakpoint
DROP INDEX "uep_entity_idx";--> statement-breakpoint
DROP INDEX "user_points_actor_idx";--> statement-breakpoint
DROP INDEX "user_role_unique_idx";--> statement-breakpoint
DROP INDEX "users_email_idx";--> statement-breakpoint
DROP INDEX "users_google_id_idx";--> statement-breakpoint
ALTER TABLE `otp_verifications` ALTER COLUMN "phone" TO "phone" text;--> statement-breakpoint
CREATE INDEX `abuse_flags_actor_idx` ON `abuse_flags` (`actor_id`,`actor_type`);--> statement-breakpoint
CREATE INDEX `abuse_flags_type_idx` ON `abuse_flags` (`flag_type`);--> statement-breakpoint
CREATE INDEX `analytics_events_name_idx` ON `analytics_events` (`event_name`);--> statement-breakpoint
CREATE INDEX `analytics_events_actor_idx` ON `analytics_events` (`actor_id`,`actor_type`);--> statement-breakpoint
CREATE INDEX `appointment_slots_doctor_time_idx` ON `appointment_slots` (`doctor_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `appointment_slots_hospital_time_idx` ON `appointment_slots` (`hospital_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `appointments_patient_idx` ON `appointments` (`patient_id`);--> statement-breakpoint
CREATE INDEX `appointments_doctor_idx` ON `appointments` (`doctor_id`);--> statement-breakpoint
CREATE INDEX `appointments_hospital_idx` ON `appointments` (`hospital_id`);--> statement-breakpoint
CREATE INDEX `appointments_status_idx` ON `appointments` (`status`);--> statement-breakpoint
CREATE INDEX `appointments_scheduled_idx` ON `appointments` (`scheduled_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `badges_slug_unique` ON `badges` (`slug`);--> statement-breakpoint
CREATE INDEX `consent_records_patient_idx` ON `consent_records` (`patient_id`);--> statement-breakpoint
CREATE INDEX `consent_records_patient_purpose_idx` ON `consent_records` (`patient_id`,`purpose`);--> statement-breakpoint
CREATE INDEX `consultation_messages_appointment_idx` ON `consultation_messages` (`appointment_id`,`sent_at`);--> statement-breakpoint
CREATE INDEX `consultation_participants_session_idx` ON `consultation_participants` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `consultation_participants_session_actor_idx` ON `consultation_participants` (`session_id`,`actor_id`,`actor_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `consultation_room_configs_entity_idx` ON `consultation_room_configs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `consultation_sessions_appointment_idx` ON `consultation_sessions` (`appointment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `contributor_trust_user_idx` ON `contributor_trust` (`contributor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `departments_name_unique` ON `departments` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `doctor_hospital_affiliation_unique_idx` ON `doctor_hospital_affiliations` (`doctor_id`,`hospital_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `doctors_slug_unique` ON `doctors` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospital_accounts_email_idx` ON `hospital_accounts` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospital_accounts_hospital_email_idx` ON `hospital_accounts` (`hospital_id`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospital_listing_package_unique_idx` ON `hospital_listing_packages` (`hospital_id`,`package_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospitals_slug_unique` ON `hospitals` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospitals_google_place_id_unique` ON `hospitals` (`google_place_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospitals_city_name_idx` ON `hospitals` (`city`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospitals_slug_unique_idx` ON `hospitals` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_doctor_candidate_unique_idx` ON `ingestion_doctor_candidates` (`job_id`,`full_name`,`specialization`);--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_field_confidence_unique_idx` ON `ingestion_field_confidences` (`job_id`,`entity_type`,`entity_id`,`field_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_hospital_candidate_unique_idx` ON `ingestion_hospital_candidates` (`job_id`,`name`,`city`);--> statement-breakpoint
CREATE UNIQUE INDEX `package_feature_key_idx` ON `package_features` (`package_id`,`feature_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `packages_code_unique` ON `packages` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `patients_phone_hash_unique` ON `patients` (`phone_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `patients_phone_hash_idx` ON `patients` (`phone_hash`);--> statement-breakpoint
CREATE INDEX `patients_city_idx` ON `patients` (`city`);--> statement-breakpoint
CREATE INDEX `patients_google_id_idx` ON `patients` (`google_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_transactions_razorpay_order_id_unique` ON `payment_transactions` (`razorpay_order_id`);--> statement-breakpoint
CREATE INDEX `payment_transactions_patient_idx` ON `payment_transactions` (`patient_id`);--> statement-breakpoint
CREATE INDEX `payment_transactions_status_idx` ON `payment_transactions` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `point_events_type_proof_idx` ON `point_events` (`event_type`,`proof_id`);--> statement-breakpoint
CREATE INDEX `point_events_actor_idx` ON `point_events` (`actor_id`,`actor_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `roles_code_unique` ON `roles` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_session_token_unique` ON `sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `specialty_synonyms_canonical_synonym_idx` ON `specialty_synonyms` (`canonical`,`synonym`);--> statement-breakpoint
CREATE INDEX `specialty_synonyms_synonym_idx` ON `specialty_synonyms` (`synonym`);--> statement-breakpoint
CREATE UNIQUE INDEX `streaks_actor_idx` ON `streaks` (`actor_id`,`actor_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_parent_child_idx` ON `taxonomy_edges` (`parent_node_id`,`child_node_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_nodes_slug_unique` ON `taxonomy_nodes` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_badges_actor_badge_idx` ON `user_badges` (`actor_id`,`actor_type`,`badge_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_points_actor_idx` ON `user_points` (`actor_id`,`actor_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_role_unique_idx` ON `user_role_map` (`user_id`,`role_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_google_id_idx` ON `users` (`google_id`);--> statement-breakpoint
ALTER TABLE `otp_verifications` ADD `phone_hash` text NOT NULL;--> statement-breakpoint
ALTER TABLE `otp_verifications` ADD `used_at` integer;--> statement-breakpoint
ALTER TABLE `otp_verifications` ADD `channel` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `patient_notes` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `consent_record_id` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `source_platform` text DEFAULT 'web';--> statement-breakpoint
ALTER TABLE `appointments` ADD `slot_id` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `consultation_fee` real;--> statement-breakpoint
ALTER TABLE `appointments` ADD `payment_status` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `meeting_url` text;--> statement-breakpoint
ALTER TABLE `doctor_hospital_affiliations` ADD `affiliation_status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `doctor_hospital_affiliations` ADD `invited_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `doctor_hospital_affiliations` ADD `invitation_note` text;--> statement-breakpoint
ALTER TABLE `doctor_hospital_affiliations` ADD `responded_at` integer;--> statement-breakpoint
ALTER TABLE `doctors` ADD `name` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `qualification` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `contact_phone` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `contact_email` text;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `contact_person` text;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `contact_phone` text;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `contact_email` text;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `email_ids` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `hospitals` ADD `accreditation` text;--> statement-breakpoint
ALTER TABLE `ingestion_field_confidences` ADD `review_status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestion_field_confidences` ADD `reviewed_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `ingestion_field_confidences` ADD `reviewed_at` integer;--> statement-breakpoint
ALTER TABLE `ingestion_field_confidences` ADD `last_verified_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `ref_id` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `source_platform` text DEFAULT 'web';--> statement-breakpoint
ALTER TABLE `leads` ADD `phone_hash` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `date_of_birth` integer;--> statement-breakpoint
ALTER TABLE `patients` ADD `gender` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `blood_group` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `google_id` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `google_email` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `google_name` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `google_avatar` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `trial_started_at` integer;--> statement-breakpoint
ALTER TABLE `patients` ADD `subscription_tier` text DEFAULT 'free';--> statement-breakpoint
ALTER TABLE `patients` ADD `subscription_expires_at` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `totp_verified_at` integer;--> statement-breakpoint
ALTER TABLE `taxonomy_nodes` ADD `metadata` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `users` ADD `kyc_status` text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_secret` text;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_recovery_codes` text DEFAULT '[]';