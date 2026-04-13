CREATE TABLE `app_setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updated_by_user_id` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `appointment_slot` (
	`id` text PRIMARY KEY NOT NULL,
	`slot_date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`capacity_limit` integer,
	`generated_from` text DEFAULT 'base' NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appointment_slot_unique_idx` ON `appointment_slot` (`slot_date`,`start_time`);--> statement-breakpoint
CREATE INDEX `appointment_slot_date_idx` ON `appointment_slot` (`slot_date`);--> statement-breakpoint
CREATE INDEX `appointment_slot_status_idx` ON `appointment_slot` (`status`);--> statement-breakpoint
CREATE TABLE `audit_event` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_type` text NOT NULL,
	`actor_user_id` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`summary` text,
	`payload` text DEFAULT '{}',
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_event_entity_idx` ON `audit_event` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_event_actor_idx` ON `audit_event` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `audit_event_action_idx` ON `audit_event` (`action`);--> statement-breakpoint
CREATE TABLE `booking` (
	`id` text PRIMARY KEY NOT NULL,
	`slot_id` text NOT NULL,
	`request_id` text,
	`citizen_user_id` text,
	`staff_user_id` text,
	`created_by_user_id` text,
	`source_booking_id` text,
	`kind` text NOT NULL,
	`status` text NOT NULL,
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
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_hold_token_unique` ON `booking` (`hold_token`);--> statement-breakpoint
CREATE INDEX `booking_slot_status_idx` ON `booking` (`slot_id`,`status`);--> statement-breakpoint
CREATE INDEX `booking_request_idx` ON `booking` (`request_id`);--> statement-breakpoint
CREATE INDEX `booking_citizen_idx` ON `booking` (`citizen_user_id`);--> statement-breakpoint
CREATE INDEX `booking_staff_idx` ON `booking` (`staff_user_id`);--> statement-breakpoint
CREATE INDEX `booking_kind_status_idx` ON `booking` (`kind`,`status`);--> statement-breakpoint
CREATE INDEX `booking_hold_expiry_idx` ON `booking` (`hold_expires_at`);--> statement-breakpoint
CREATE INDEX `booking_series_idx` ON `booking` (`series_key`);--> statement-breakpoint
CREATE TABLE `calendar_override` (
	`id` text PRIMARY KEY NOT NULL,
	`override_date` text NOT NULL,
	`is_closed` integer DEFAULT false NOT NULL,
	`morning_enabled` integer DEFAULT true NOT NULL,
	`morning_start` text,
	`morning_end` text,
	`afternoon_enabled` integer DEFAULT true NOT NULL,
	`afternoon_start` text,
	`afternoon_end` text,
	`slot_duration_minutes` integer,
	`buffer_minutes` integer,
	`slot_capacity_limit` integer,
	`reason` text,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_override_override_date_unique` ON `calendar_override` (`override_date`);--> statement-breakpoint
CREATE INDEX `calendar_override_date_idx` ON `calendar_override` (`override_date`);--> statement-breakpoint
CREATE TABLE `notification_delivery` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`template_key` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`recipient` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`payload` text DEFAULT '{}',
	`last_attempt_at` integer,
	`sent_at` integer,
	`error_message` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notification_entity_idx` ON `notification_delivery` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `notification_status_idx` ON `notification_delivery` (`status`);--> statement-breakpoint
CREATE TABLE `procedure_type` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`requires_vehicle` integer DEFAULT false NOT NULL,
	`allows_physical_documents` integer DEFAULT true NOT NULL,
	`allows_digital_documents` integer DEFAULT true NOT NULL,
	`instructions` text,
	`eligibility_schema` text DEFAULT '{}',
	`form_schema` text DEFAULT '{}',
	`document_schema` text DEFAULT '{}',
	`policy_schema` text DEFAULT '{}',
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `procedure_type_slug_unique` ON `procedure_type` (`slug`);--> statement-breakpoint
CREATE INDEX `procedure_type_active_idx` ON `procedure_type` (`is_active`);--> statement-breakpoint
CREATE INDEX `procedure_type_slug_idx` ON `procedure_type` (`slug`);--> statement-breakpoint
CREATE TABLE `request_document` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`requirement_key` text NOT NULL,
	`label` text NOT NULL,
	`delivery_mode` text NOT NULL,
	`storage_key` text,
	`file_name` text,
	`mime_type` text,
	`file_size_bytes` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`reviewed_by_user_id` text,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `service_request`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `request_document_requirement_unique_idx` ON `request_document` (`request_id`,`requirement_key`);--> statement-breakpoint
CREATE INDEX `request_document_status_idx` ON `request_document` (`status`);--> statement-breakpoint
CREATE TABLE `schedule_template` (
	`id` text PRIMARY KEY NOT NULL,
	`weekday` integer NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`morning_start` text,
	`morning_end` text,
	`afternoon_start` text,
	`afternoon_end` text,
	`slot_duration_minutes` integer NOT NULL,
	`buffer_minutes` integer DEFAULT 0 NOT NULL,
	`slot_capacity_limit` integer,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_template_weekday_unique_idx` ON `schedule_template` (`weekday`);--> statement-breakpoint
CREATE INDEX `schedule_template_enabled_idx` ON `schedule_template` (`is_enabled`);--> statement-breakpoint
CREATE TABLE `service_request` (
	`id` text PRIMARY KEY NOT NULL,
	`procedure_type_id` text NOT NULL,
	`citizen_user_id` text,
	`email` text NOT NULL,
	`phone` text,
	`document_type` text,
	`document_number` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`document_mode` text,
	`draft_data` text DEFAULT '{}',
	`eligibility_result` text DEFAULT '{}',
	`requirements_snapshot` text DEFAULT '{}',
	`submitted_snapshot` text DEFAULT '{}',
	`verified_at` integer,
	`confirmed_at` integer,
	`cancelled_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`procedure_type_id`) REFERENCES `procedure_type`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`citizen_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `service_request_status_idx` ON `service_request` (`status`);--> statement-breakpoint
CREATE INDEX `service_request_citizen_idx` ON `service_request` (`citizen_user_id`);--> statement-breakpoint
CREATE INDEX `service_request_email_idx` ON `service_request` (`email`);--> statement-breakpoint
CREATE INDEX `service_request_procedure_idx` ON `service_request` (`procedure_type_id`);--> statement-breakpoint
CREATE TABLE `staff_date_override` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_user_id` text NOT NULL,
	`override_date` text NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	`capacity_override` integer,
	`notes` text,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`staff_user_id`) REFERENCES `staff_profile`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_date_override_unique_idx` ON `staff_date_override` (`staff_user_id`,`override_date`);--> statement-breakpoint
CREATE INDEX `staff_date_override_date_idx` ON `staff_date_override` (`override_date`);--> statement-breakpoint
CREATE TABLE `staff_profile` (
	`user_id` text PRIMARY KEY NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_assignable` integer DEFAULT true NOT NULL,
	`default_daily_capacity` integer DEFAULT 25 NOT NULL,
	`weekly_availability` text DEFAULT '{}',
	`notes` text,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `staff_profile_active_idx` ON `staff_profile` (`is_active`);--> statement-breakpoint
CREATE INDEX `staff_profile_assignable_idx` ON `staff_profile` (`is_assignable`);--> statement-breakpoint
ALTER TABLE `user` ADD `first_name` text;--> statement-breakpoint
ALTER TABLE `user` ADD `last_name` text;--> statement-breakpoint
ALTER TABLE `user` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `user` ADD `document_type` text;--> statement-breakpoint
ALTER TABLE `user` ADD `document_number` text;--> statement-breakpoint
ALTER TABLE `user` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `last_access_at` integer;--> statement-breakpoint
CREATE INDEX `user_role_idx` ON `user` (`role`);--> statement-breakpoint
CREATE INDEX `user_status_idx` ON `user` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_document_unique_idx` ON `user` (`document_type`,`document_number`);