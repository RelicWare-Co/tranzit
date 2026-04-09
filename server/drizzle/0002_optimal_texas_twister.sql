CREATE TABLE `booking_series` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text DEFAULT 'administrative' NOT NULL,
	`recurrence_rule` text DEFAULT '{}',
	`timezone` text,
	`is_active` integer DEFAULT true NOT NULL,
	`metadata` text DEFAULT '{}',
	`notes` text,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `booking_series_active_idx` ON `booking_series` (`is_active`);--> statement-breakpoint
DROP INDEX `request_document_requirement_unique_idx`;--> statement-breakpoint
ALTER TABLE `request_document` ADD `is_current` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `request_document` ADD `replaces_document_id` text REFERENCES request_document(id);--> statement-breakpoint
CREATE INDEX `request_document_requirement_idx` ON `request_document` (`request_id`,`requirement_key`);--> statement-breakpoint
CREATE INDEX `request_document_current_idx` ON `request_document` (`request_id`,`requirement_key`,`is_current`);--> statement-breakpoint
ALTER TABLE `procedure_type` ADD `config_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `service_request` ADD `procedure_config_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `service_request` ADD `procedure_snapshot` text DEFAULT '{}';--> statement-breakpoint
ALTER TABLE `staff_date_override` ADD `available_start_time` text;--> statement-breakpoint
ALTER TABLE `staff_date_override` ADD `available_end_time` text;
--> statement-breakpoint
INSERT OR IGNORE INTO `booking_series` (`id`)
SELECT DISTINCT `series_key`
FROM `booking`
WHERE `series_key` IS NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_booking` (
	`id` text PRIMARY KEY NOT NULL,
	`slot_id` text NOT NULL,
	`request_id` text,
	`citizen_user_id` text,
	`staff_user_id` text,
	`created_by_user_id` text,
	`source_booking_id` text,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`hold_token` text,
	`hold_expires_at` integer,
	`series_key` text,
	`status_reason` text,
	`notes` text,
	`snapshot` text DEFAULT '{}',
	`confirmed_at` integer,
	`cancelled_at` integer,
	`attended_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`slot_id`) REFERENCES `appointment_slot`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`request_id`) REFERENCES `service_request`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`citizen_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`staff_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`series_key`) REFERENCES `booking_series`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
INSERT INTO `__new_booking` (
	`id`,
	`slot_id`,
	`request_id`,
	`citizen_user_id`,
	`staff_user_id`,
	`created_by_user_id`,
	`source_booking_id`,
	`kind`,
	`status`,
	`is_active`,
	`hold_token`,
	`hold_expires_at`,
	`series_key`,
	`status_reason`,
	`notes`,
	`snapshot`,
	`confirmed_at`,
	`cancelled_at`,
	`attended_at`,
	`created_at`,
	`updated_at`
)
SELECT
	`b`.`id`,
	`b`.`slot_id`,
	`b`.`request_id`,
	`b`.`citizen_user_id`,
	`b`.`staff_user_id`,
	`b`.`created_by_user_id`,
	`b`.`source_booking_id`,
	`b`.`kind`,
	`b`.`status`,
	CASE
		WHEN `b`.`cancelled_at` IS NOT NULL
			OR `b`.`attended_at` IS NOT NULL
			OR `b`.`status` IN (
				'cancelled',
				'cancelled_by_user',
				'cancelled_by_operation',
				'expired',
				'released',
				'attended',
				'no_show'
			) THEN 0
		WHEN `b`.`request_id` IS NOT NULL AND EXISTS (
			SELECT 1
			FROM `booking` `b2`
			WHERE `b2`.`request_id` = `b`.`request_id`
				AND `b2`.`id` <> `b`.`id`
				AND `b2`.`cancelled_at` IS NULL
				AND `b2`.`attended_at` IS NULL
				AND `b2`.`status` NOT IN (
					'cancelled',
					'cancelled_by_user',
					'cancelled_by_operation',
					'expired',
					'released',
					'attended',
					'no_show'
				)
				AND (
					COALESCE(`b2`.`confirmed_at`, `b2`.`created_at`) > COALESCE(`b`.`confirmed_at`, `b`.`created_at`)
					OR (
						COALESCE(`b2`.`confirmed_at`, `b2`.`created_at`) = COALESCE(`b`.`confirmed_at`, `b`.`created_at`)
						AND `b2`.`id` > `b`.`id`
					)
				)
		) THEN 0
		ELSE 1
	END AS `is_active`,
	`b`.`hold_token`,
	`b`.`hold_expires_at`,
	`b`.`series_key`,
	`b`.`status_reason`,
	`b`.`notes`,
	`b`.`snapshot`,
	`b`.`confirmed_at`,
	`b`.`cancelled_at`,
	`b`.`attended_at`,
	`b`.`created_at`,
	`b`.`updated_at`
FROM `booking` `b`;--> statement-breakpoint
DROP TABLE `booking`;--> statement-breakpoint
ALTER TABLE `__new_booking` RENAME TO `booking`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `booking_hold_token_unique` ON `booking` (`hold_token`);--> statement-breakpoint
CREATE INDEX `booking_slot_status_idx` ON `booking` (`slot_id`,`status`);--> statement-breakpoint
CREATE INDEX `booking_request_idx` ON `booking` (`request_id`);--> statement-breakpoint
CREATE INDEX `booking_citizen_idx` ON `booking` (`citizen_user_id`);--> statement-breakpoint
CREATE INDEX `booking_staff_idx` ON `booking` (`staff_user_id`);--> statement-breakpoint
CREATE INDEX `booking_active_idx` ON `booking` (`is_active`);--> statement-breakpoint
CREATE INDEX `booking_kind_status_idx` ON `booking` (`kind`,`status`);--> statement-breakpoint
CREATE INDEX `booking_hold_expiry_idx` ON `booking` (`hold_expires_at`);--> statement-breakpoint
CREATE INDEX `booking_series_idx` ON `booking` (`series_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `booking_active_request_unique_idx` ON `booking` (`request_id`) WHERE "booking"."request_id" is not null and "booking"."kind" = 'citizen' and "booking"."is_active" = 1;--> statement-breakpoint
ALTER TABLE `service_request` ADD `active_booking_id` text REFERENCES booking(id);--> statement-breakpoint
UPDATE `service_request`
SET `active_booking_id` = (
	SELECT `b`.`id`
	FROM `booking` `b`
	WHERE `b`.`request_id` = `service_request`.`id`
		AND `b`.`is_active` = 1
	ORDER BY COALESCE(`b`.`confirmed_at`, `b`.`created_at`) DESC, `b`.`id` DESC
	LIMIT 1
);--> statement-breakpoint
CREATE INDEX `service_request_active_booking_idx` ON `service_request` (`active_booking_id`);
