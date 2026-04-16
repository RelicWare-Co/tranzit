CREATE TABLE `idempotency_key` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`operation` text NOT NULL,
	`target_id` text,
	`payload_hash` text NOT NULL,
	`response_status` integer NOT NULL,
	`response_body` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idempotency_key_key_unique` ON `idempotency_key` (`key`);--> statement-breakpoint
CREATE INDEX `idempotency_key_key_idx` ON `idempotency_key` (`key`);--> statement-breakpoint
CREATE INDEX `idempotency_key_expires_idx` ON `idempotency_key` (`expires_at`);