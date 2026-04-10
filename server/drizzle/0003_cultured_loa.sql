DROP INDEX `verification_identifier_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `verification_identifier_unique_idx` ON `verification` (`identifier`);