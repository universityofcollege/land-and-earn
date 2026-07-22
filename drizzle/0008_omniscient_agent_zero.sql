CREATE TABLE `retention_dispositions` (
	`id` text PRIMARY KEY NOT NULL,
	`packet_id` text NOT NULL,
	`eligible_at` text NOT NULL,
	`reason` text NOT NULL,
	`actor` text NOT NULL,
	`document_count` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`error_message` text
);
--> statement-breakpoint
ALTER TABLE `program_settings` ADD `retention_anchor_date` text;--> statement-breakpoint
ALTER TABLE `program_settings` ADD `retention_policy_confirmed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `program_settings` ADD `retention_confirmed_at` text;--> statement-breakpoint
ALTER TABLE `program_settings` ADD `retention_confirmed_by` text;