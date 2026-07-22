ALTER TABLE `interns` ADD `supervisor_name` text;--> statement-breakpoint
ALTER TABLE `interns` ADD `supervisor_email` text;--> statement-breakpoint
ALTER TABLE `reminder_drafts` ADD `recipient_name` text;--> statement-breakpoint
ALTER TABLE `reminder_drafts` ADD `recipient_email` text;--> statement-breakpoint
ALTER TABLE `reminder_drafts` ADD `recipient_role` text DEFAULT 'Employer of record' NOT NULL;