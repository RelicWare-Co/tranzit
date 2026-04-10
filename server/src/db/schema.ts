import { relations, sql } from "drizzle-orm";
import {
	type AnySQLiteColumn,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

type JsonValue = Record<string, unknown>;

export const user = sqliteTable(
	"user",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		firstName: text("first_name"),
		lastName: text("last_name"),
		email: text("email").notNull().unique(),
		emailVerified: integer("email_verified", { mode: "boolean" })
			.default(false)
			.notNull(),
		phone: text("phone"),
		documentType: text("document_type"),
		documentNumber: text("document_number"),
		role: text("role"),
		status: text("status").default("active").notNull(),
		image: text("image"),
		lastAccessAt: integer("last_access_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(now)
			.$onUpdate(() => new Date())
			.notNull(),
		banned: integer("banned", { mode: "boolean" }).default(false),
		banReason: text("ban_reason"),
		banExpires: integer("ban_expires", { mode: "timestamp_ms" }),
	},
	(table) => [
		index("user_role_idx").on(table.role),
		index("user_status_idx").on(table.status),
		uniqueIndex("user_document_unique_idx").on(
			table.documentType,
			table.documentNumber,
		),
	],
);

export const session = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		token: text("token").notNull().unique(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		impersonatedBy: text("impersonated_by"),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", {
			mode: "timestamp_ms",
		}),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", {
			mode: "timestamp_ms",
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(now)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const appSetting = sqliteTable("app_setting", {
	key: text("key").primaryKey(),
	value: text("value", { mode: "json" }).$type<JsonValue>().notNull(),
	description: text("description"),
	updatedByUserId: text("updated_by_user_id").references(() => user.id, {
		onDelete: "set null",
	}),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(now)
		.$onUpdate(() => new Date())
		.notNull(),
});

export const procedureType = sqliteTable(
	"procedure_type",
	{
		id: text("id").primaryKey(),
		slug: text("slug").notNull().unique(),
		name: text("name").notNull(),
		description: text("description"),
		isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
		configVersion: integer("config_version").default(1).notNull(),
		requiresVehicle: integer("requires_vehicle", { mode: "boolean" })
			.default(false)
			.notNull(),
		allowsPhysicalDocuments: integer("allows_physical_documents", {
			mode: "boolean",
		})
			.default(true)
			.notNull(),
		allowsDigitalDocuments: integer("allows_digital_documents", {
			mode: "boolean",
		})
			.default(true)
			.notNull(),
		instructions: text("instructions"),
		eligibilitySchema: text("eligibility_schema", { mode: "json" })
			.$type<JsonValue>()
			.default({}),
		formSchema: text("form_schema", { mode: "json" })
			.$type<JsonValue>()
			.default({}),
		documentSchema: text("document_schema", { mode: "json" })
			.$type<JsonValue>()
			.default({}),
		policySchema: text("policy_schema", { mode: "json" })
			.$type<JsonValue>()
			.default({}),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(now)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("procedure_type_active_idx").on(table.isActive),
		index("procedure_type_slug_idx").on(table.slug),
	],
);

export const staffProfile = sqliteTable(
	"staff_profile",
	{
		userId: text("user_id")
			.primaryKey()
			.references(() => user.id, { onDelete: "cascade" }),
		isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
		isAssignable: integer("is_assignable", { mode: "boolean" })
			.default(true)
			.notNull(),
		defaultDailyCapacity: integer("default_daily_capacity")
			.default(25)
			.notNull(),
		weeklyAvailability: text("weekly_availability", { mode: "json" })
			.$type<JsonValue>()
			.default({}),
		notes: text("notes"),
		metadata: text("metadata", { mode: "json" }).$type<JsonValue>().default({}),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(now)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("staff_profile_active_idx").on(table.isActive),
		index("staff_profile_assignable_idx").on(table.isAssignable),
	],
);

export const staffDateOverride = sqliteTable(
	"staff_date_override",
	{
		id: text("id").primaryKey(),
		staffUserId: text("staff_user_id")
			.notNull()
			.references(() => staffProfile.userId, { onDelete: "cascade" }),
		overrideDate: text("override_date").notNull(),
		isAvailable: integer("is_available", { mode: "boolean" })
			.default(true)
			.notNull(),
		capacityOverride: integer("capacity_override"),
		availableStartTime: text("available_start_time"),
		availableEndTime: text("available_end_time"),
		notes: text("notes"),
		createdByUserId: text("created_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(now)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("staff_date_override_unique_idx").on(
			table.staffUserId,
			table.overrideDate,
		),
		index("staff_date_override_date_idx").on(table.overrideDate),
	],
);

export const scheduleTemplate = sqliteTable(
	"schedule_template",
	{
		id: text("id").primaryKey(),
		weekday: integer("weekday").notNull(),
		isEnabled: integer("is_enabled", { mode: "boolean" })
			.default(true)
			.notNull(),
		morningStart: text("morning_start"),
		morningEnd: text("morning_end"),
		afternoonStart: text("afternoon_start"),
		afternoonEnd: text("afternoon_end"),
		slotDurationMinutes: integer("slot_duration_minutes").notNull(),
		bufferMinutes: integer("buffer_minutes").default(0).notNull(),
		slotCapacityLimit: integer("slot_capacity_limit"),
		notes: text("notes"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(now)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("schedule_template_weekday_unique_idx").on(table.weekday),
		index("schedule_template_enabled_idx").on(table.isEnabled),
	],
);

export const calendarOverride = sqliteTable(
	"calendar_override",
	{
		id: text("id").primaryKey(),
		overrideDate: text("override_date").notNull().unique(),
		isClosed: integer("is_closed", { mode: "boolean" })
			.default(false)
			.notNull(),
		morningEnabled: integer("morning_enabled", { mode: "boolean" })
			.default(true)
			.notNull(),
		morningStart: text("morning_start"),
		morningEnd: text("morning_end"),
		afternoonEnabled: integer("afternoon_enabled", { mode: "boolean" })
			.default(true)
			.notNull(),
		afternoonStart: text("afternoon_start"),
		afternoonEnd: text("afternoon_end"),
		slotDurationMinutes: integer("slot_duration_minutes"),
		bufferMinutes: integer("buffer_minutes"),
		slotCapacityLimit: integer("slot_capacity_limit"),
		reason: text("reason"),
		createdByUserId: text("created_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(now)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("calendar_override_date_idx").on(table.overrideDate)],
);

export const serviceRequest = sqliteTable(
	"service_request",
	{
		id: text("id").primaryKey(),
		procedureTypeId: text("procedure_type_id")
			.notNull()
			.references(() => procedureType.id, { onDelete: "restrict" }),
		citizenUserId: text("citizen_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		email: text("email").notNull(),
		phone: text("phone"),
		documentType: text("document_type"),
		documentNumber: text("document_number"),
		status: text("status").default("draft").notNull(),
		procedureConfigVersion: integer("procedure_config_version")
			.default(1)
			.notNull(),
		documentMode: text("document_mode"),
		draftData: text("draft_data", { mode: "json" })
			.$type<JsonValue>()
			.default({}),
		procedureSnapshot: text("procedure_snapshot", { mode: "json" })
			.$type<JsonValue>()
			.default({}),
		eligibilityResult: text("eligibility_result", { mode: "json" })
			.$type<JsonValue>()
			.default({}),
		requirementsSnapshot: text("requirements_snapshot", { mode: "json" })
			.$type<JsonValue>()
			.default({}),
		submittedSnapshot: text("submitted_snapshot", { mode: "json" })
			.$type<JsonValue>()
			.default({}),
		activeBookingId: text("active_booking_id").references(
			(): AnySQLiteColumn => booking.id,
			{
				onDelete: "set null",
			},
		),
		verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
		confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
		cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(now)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("service_request_status_idx").on(table.status),
		index("service_request_citizen_idx").on(table.citizenUserId),
		index("service_request_email_idx").on(table.email),
		index("service_request_procedure_idx").on(table.procedureTypeId),
		index("service_request_active_booking_idx").on(table.activeBookingId),
	],
);

export const requestDocument = sqliteTable(
	"request_document",
	{
		id: text("id").primaryKey(),
		requestId: text("request_id")
			.notNull()
			.references(() => serviceRequest.id, { onDelete: "cascade" }),
		requirementKey: text("requirement_key").notNull(),
		label: text("label").notNull(),
		deliveryMode: text("delivery_mode").notNull(),
		isCurrent: integer("is_current", { mode: "boolean" })
			.default(true)
			.notNull(),
		replacesDocumentId: text("replaces_document_id").references(
			(): AnySQLiteColumn => requestDocument.id,
			{
				onDelete: "set null",
			},
		),
		storageKey: text("storage_key"),
		fileName: text("file_name"),
		mimeType: text("mime_type"),
		fileSizeBytes: integer("file_size_bytes"),
		status: text("status").default("pending").notNull(),
		notes: text("notes"),
		reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(now)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("request_document_requirement_idx").on(
			table.requestId,
			table.requirementKey,
		),
		index("request_document_current_idx").on(
			table.requestId,
			table.requirementKey,
			table.isCurrent,
		),
		index("request_document_status_idx").on(table.status),
	],
);

export const appointmentSlot = sqliteTable(
	"appointment_slot",
	{
		id: text("id").primaryKey(),
		slotDate: text("slot_date").notNull(),
		startTime: text("start_time").notNull(),
		endTime: text("end_time").notNull(),
		status: text("status").default("open").notNull(),
		capacityLimit: integer("capacity_limit"),
		generatedFrom: text("generated_from").default("base").notNull(),
		metadata: text("metadata", { mode: "json" }).$type<JsonValue>().default({}),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(now)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("appointment_slot_unique_idx").on(
			table.slotDate,
			table.startTime,
		),
		index("appointment_slot_date_idx").on(table.slotDate),
		index("appointment_slot_status_idx").on(table.status),
	],
);

export const bookingSeries = sqliteTable(
	"booking_series",
	{
		id: text("id").primaryKey(),
		kind: text("kind").default("administrative").notNull(),
		recurrenceRule: text("recurrence_rule", { mode: "json" })
			.$type<JsonValue>()
			.default({}),
		timezone: text("timezone"),
		isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
		metadata: text("metadata", { mode: "json" }).$type<JsonValue>().default({}),
		notes: text("notes"),
		createdByUserId: text("created_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(now)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("booking_series_active_idx").on(table.isActive)],
);

export const booking = sqliteTable(
	"booking",
	{
		id: text("id").primaryKey(),
		slotId: text("slot_id")
			.notNull()
			.references(() => appointmentSlot.id, { onDelete: "cascade" }),
		requestId: text("request_id").references(
			(): AnySQLiteColumn => serviceRequest.id,
			{
				onDelete: "set null",
			},
		),
		citizenUserId: text("citizen_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		staffUserId: text("staff_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		createdByUserId: text("created_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		sourceBookingId: text("source_booking_id"),
		kind: text("kind").notNull(),
		status: text("status").notNull(),
		isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
		holdToken: text("hold_token").unique(),
		holdExpiresAt: integer("hold_expires_at", { mode: "timestamp_ms" }),
		seriesKey: text("series_key").references(() => bookingSeries.id, {
			onDelete: "set null",
		}),
		statusReason: text("status_reason"),
		notes: text("notes"),
		snapshot: text("snapshot", { mode: "json" }).$type<JsonValue>().default({}),
		confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
		cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
		attendedAt: integer("attended_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(now)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("booking_slot_status_idx").on(table.slotId, table.status),
		index("booking_request_idx").on(table.requestId),
		index("booking_citizen_idx").on(table.citizenUserId),
		index("booking_staff_idx").on(table.staffUserId),
		index("booking_active_idx").on(table.isActive),
		index("booking_kind_status_idx").on(table.kind, table.status),
		index("booking_hold_expiry_idx").on(table.holdExpiresAt),
		index("booking_series_idx").on(table.seriesKey),
		uniqueIndex("booking_active_request_unique_idx")
			.on(table.requestId)
			.where(
				sql`${table.requestId} is not null and ${table.kind} = 'citizen' and ${table.isActive} = 1`,
			),
	],
);

export const notificationDelivery = sqliteTable(
	"notification_delivery",
	{
		id: text("id").primaryKey(),
		channel: text("channel").notNull(),
		templateKey: text("template_key").notNull(),
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id").notNull(),
		recipient: text("recipient").notNull(),
		status: text("status").default("pending").notNull(),
		attemptCount: integer("attempt_count").default(0).notNull(),
		payload: text("payload", { mode: "json" }).$type<JsonValue>().default({}),
		lastAttemptAt: integer("last_attempt_at", { mode: "timestamp_ms" }),
		sentAt: integer("sent_at", { mode: "timestamp_ms" }),
		errorMessage: text("error_message"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(now)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("notification_entity_idx").on(table.entityType, table.entityId),
		index("notification_status_idx").on(table.status),
	],
);

export const auditEvent = sqliteTable(
	"audit_event",
	{
		id: text("id").primaryKey(),
		actorType: text("actor_type").notNull(),
		actorUserId: text("actor_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id").notNull(),
		action: text("action").notNull(),
		summary: text("summary"),
		payload: text("payload", { mode: "json" }).$type<JsonValue>().default({}),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(now)
			.notNull(),
	},
	(table) => [
		index("audit_event_entity_idx").on(table.entityType, table.entityId),
		index("audit_event_actor_idx").on(table.actorUserId),
		index("audit_event_action_idx").on(table.action),
	],
);

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	serviceRequests: many(serviceRequest),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
}));

export const staffProfileRelations = relations(
	staffProfile,
	({ one, many }) => ({
		user: one(user, {
			fields: [staffProfile.userId],
			references: [user.id],
		}),
		dateOverrides: many(staffDateOverride),
	}),
);

export const staffDateOverrideRelations = relations(
	staffDateOverride,
	({ one }) => ({
		staff: one(staffProfile, {
			fields: [staffDateOverride.staffUserId],
			references: [staffProfile.userId],
		}),
	}),
);

export const procedureTypeRelations = relations(procedureType, ({ many }) => ({
	serviceRequests: many(serviceRequest),
}));

export const serviceRequestRelations = relations(
	serviceRequest,
	({ one, many }) => ({
		procedureType: one(procedureType, {
			fields: [serviceRequest.procedureTypeId],
			references: [procedureType.id],
		}),
		citizen: one(user, {
			fields: [serviceRequest.citizenUserId],
			references: [user.id],
		}),
		activeBooking: one(booking, {
			fields: [serviceRequest.activeBookingId],
			references: [booking.id],
		}),
		documents: many(requestDocument),
		bookings: many(booking),
	}),
);

export const requestDocumentRelations = relations(
	requestDocument,
	({ one, many }) => ({
		request: one(serviceRequest, {
			fields: [requestDocument.requestId],
			references: [serviceRequest.id],
		}),
		replacesDocument: one(requestDocument, {
			fields: [requestDocument.replacesDocumentId],
			references: [requestDocument.id],
			relationName: "document_replacement",
		}),
		replacedByDocuments: many(requestDocument, {
			relationName: "document_replacement",
		}),
	}),
);

export const appointmentSlotRelations = relations(
	appointmentSlot,
	({ many }) => ({
		bookings: many(booking),
	}),
);

export const bookingSeriesRelations = relations(bookingSeries, ({ many }) => ({
	bookings: many(booking),
}));

export const bookingRelations = relations(booking, ({ one }) => ({
	slot: one(appointmentSlot, {
		fields: [booking.slotId],
		references: [appointmentSlot.id],
	}),
	request: one(serviceRequest, {
		fields: [booking.requestId],
		references: [serviceRequest.id],
	}),
	citizen: one(user, {
		fields: [booking.citizenUserId],
		references: [user.id],
	}),
	staff: one(user, {
		fields: [booking.staffUserId],
		references: [user.id],
	}),
	series: one(bookingSeries, {
		fields: [booking.seriesKey],
		references: [bookingSeries.id],
	}),
}));
