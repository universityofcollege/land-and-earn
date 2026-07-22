ALTER TABLE `policies` ADD `effective_end` text;--> statement-breakpoint
ALTER TABLE `policies` ADD `version` text DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE `policies` ADD `source_document_id` text REFERENCES documents(id);