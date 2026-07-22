CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`occurred_at` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`reason` text
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `document_field_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`field_name` text NOT NULL,
	`value_json` text NOT NULL,
	`confidence` integer NOT NULL,
	`source_locator` text NOT NULL,
	`status` text DEFAULT 'extracted' NOT NULL,
	`corrected_value_json` text,
	`reviewed_at` text,
	`reviewer` text,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `field_evidence_document_idx` ON `document_field_evidence` (`document_id`);--> statement-breakpoint
CREATE TABLE `document_packet_links` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`packet_id` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`linked_at` text NOT NULL,
	`actor` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`packet_id`) REFERENCES `packets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `document_links_document_idx` ON `document_packet_links` (`document_id`);--> statement-breakpoint
CREATE INDEX `document_links_packet_idx` ON `document_packet_links` (`packet_id`);--> statement-breakpoint
CREATE TABLE `eligibility_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`claim_id` text NOT NULL,
	`authority_level` text NOT NULL,
	`policy_id` text,
	`result` text NOT NULL,
	`reason` text NOT NULL,
	`confidence` integer NOT NULL,
	`reviewer` text,
	`reviewed_at` text,
	FOREIGN KEY (`claim_id`) REFERENCES `reimbursement_claims`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`policy_id`) REFERENCES `policies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `eligibility_claim_idx` ON `eligibility_checks` (`claim_id`);--> statement-breakpoint
CREATE TABLE `mous` (
	`id` text PRIMARY KEY NOT NULL,
	`employer_id` text NOT NULL,
	`code` text NOT NULL,
	`version` text NOT NULL,
	`effective_start` text NOT NULL,
	`effective_end` text NOT NULL,
	`status` text DEFAULT 'current' NOT NULL,
	`allowed_expenses_json` text DEFAULT '[]' NOT NULL,
	`limits_json` text DEFAULT '{}' NOT NULL,
	`conditions_json` text DEFAULT '[]' NOT NULL,
	`evidence_requirements_json` text DEFAULT '[]' NOT NULL,
	`document_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mous_employer_idx` ON `mous` (`employer_id`);--> statement-breakpoint
CREATE TABLE `program_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`hourly_rate_cents` integer NOT NULL,
	`fiscal_year_start` text NOT NULL,
	`fiscal_year_end` text NOT NULL,
	`invoice_deadline` text NOT NULL,
	`payment_deadline` text NOT NULL,
	`retention_years` integer DEFAULT 7 NOT NULL,
	`po_warning_percent` integer DEFAULT 15 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reimbursement_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`packet_id` text NOT NULL,
	`document_id` text NOT NULL,
	`claim_type` text NOT NULL,
	`description` text NOT NULL,
	`business_purpose` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'Unclassified' NOT NULL,
	`amount_requested_cents` integer NOT NULL,
	`amount_eligible_cents` integer,
	`status` text DEFAULT 'needs_review' NOT NULL,
	`mou_id` text,
	`source_locator` text NOT NULL,
	`confidence` integer NOT NULL,
	FOREIGN KEY (`packet_id`) REFERENCES `packets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mou_id`) REFERENCES `mous`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `claims_packet_idx` ON `reimbursement_claims` (`packet_id`);--> statement-breakpoint
ALTER TABLE `documents` ADD `content_hash` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `classification_confidence` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `extraction_provider` text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `uploader` text DEFAULT 'Program manager' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `source` text DEFAULT 'web_upload' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `processed_at` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `error_message` text;--> statement-breakpoint
CREATE INDEX `documents_hash_idx` ON `documents` (`content_hash`);