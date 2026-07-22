ALTER TABLE `policies` ADD `public_sources_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `policies` ADD `sources_verified_at` text;