CREATE TABLE `activity_hours` (
	`id` text PRIMARY KEY NOT NULL,
	`packet_id` text NOT NULL,
	`category` text NOT NULL,
	`hours` real NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`packet_id`) REFERENCES `packets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`employer_id` text NOT NULL,
	`packet_id` text,
	`kind` text NOT NULL,
	`file_name` text NOT NULL,
	`r2_key` text,
	`status` text NOT NULL,
	`amount_cents` integer,
	`period_start` text,
	`period_end` text,
	`extracted_json` text DEFAULT '{}' NOT NULL,
	`uploaded_at` text NOT NULL,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`packet_id`) REFERENCES `packets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `documents_packet_idx` ON `documents` (`packet_id`);--> statement-breakpoint
CREATE TABLE `employers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`county` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_email` text NOT NULL,
	`arrangement` text NOT NULL,
	`mou_code` text NOT NULL,
	`mou_status` text DEFAULT 'current' NOT NULL,
	`pay_schedule` text DEFAULT 'Biweekly' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `interns` (
	`id` text PRIMARY KEY NOT NULL,
	`employer_id` text NOT NULL,
	`name` text NOT NULL,
	`county` text NOT NULL,
	`placement` text NOT NULL,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `packet_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`packet_id` text NOT NULL,
	`severity` integer NOT NULL,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`owner_role` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`packet_id`) REFERENCES `packets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `packet_exceptions_packet_idx` ON `packet_exceptions` (`packet_id`);--> statement-breakpoint
CREATE TABLE `packets` (
	`id` text PRIMARY KEY NOT NULL,
	`employer_id` text NOT NULL,
	`purchase_order_id` text NOT NULL,
	`intern_id` text,
	`label` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`status` text NOT NULL,
	`priority` integer DEFAULT 2 NOT NULL,
	`due_date` text NOT NULL,
	`invoice_number` text,
	`invoice_amount_cents` integer DEFAULT 0 NOT NULL,
	`wage_amount_cents` integer DEFAULT 0 NOT NULL,
	`business_amount_cents` integer DEFAULT 0 NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`received_at` text,
	`approved_at` text,
	`paid_at` text,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`intern_id`) REFERENCES `interns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `po_events` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_order_id` text NOT NULL,
	`packet_id` text,
	`event_type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`reference` text NOT NULL,
	`occurred_at` text NOT NULL,
	`actor` text NOT NULL,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`packet_id`) REFERENCES `packets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `policies` (
	`id` text PRIMARY KEY NOT NULL,
	`level` text NOT NULL,
	`title` text NOT NULL,
	`code` text NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`effective_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`employer_id` text NOT NULL,
	`po_number` text NOT NULL,
	`original_amount_cents` integer NOT NULL,
	`amendment_amount_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`issued_at` text NOT NULL,
	`effective_end` text NOT NULL,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_po_number_unique` ON `purchase_orders` (`po_number`);--> statement-breakpoint
CREATE INDEX `purchase_orders_employer_idx` ON `purchase_orders` (`employer_id`);--> statement-breakpoint
CREATE TABLE `reminder_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`employer_id` text NOT NULL,
	`packet_id` text,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`reviewed_at` text,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`packet_id`) REFERENCES `packets`(`id`) ON UPDATE no action ON DELETE no action
);
