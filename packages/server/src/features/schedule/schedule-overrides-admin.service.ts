import { and, eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import { throwRpcError } from "../../orpc/shared";
import { buildScheduleSummary, createAuditEvent } from "../audit/audit.service";
import {
	isValidDateFormat as isValidScheduleDateFormat,
	isValidTimeFormat as isValidScheduleTimeFormat,
	isValidTimeWindow as isValidScheduleTimeWindow,
	parseNonNegativeInteger,
	parsePositiveInteger,
} from "./schedule.schemas";

export async function listCalendarOverrides(input?: { date?: string }) {
	const payload = (input ?? {}) as { date?: string };

	if (payload.date) {
		if (!isValidScheduleDateFormat(payload.date)) {
			throwRpcError(
				"INVALID_DATE",
				422,
				"date query parameter must be a valid date in YYYY-MM-DD format",
			);
		}
		return await db.query.calendarOverride.findMany({
			where: eq(schema.calendarOverride.overrideDate, payload.date),
		});
	}

	return await db.query.calendarOverride.findMany({
		orderBy: (override, { asc }) => [asc(override.overrideDate)],
	});
}

export interface CreateCalendarOverrideInput {
	overrideDate?: string;
	isClosed?: boolean;
	morningEnabled?: boolean;
	morningStart?: string | null;
	morningEnd?: string | null;
	afternoonEnabled?: boolean;
	afternoonStart?: string | null;
	afternoonEnd?: string | null;
	slotDurationMinutes?: number | null;
	bufferMinutes?: number | null;
	slotCapacityLimit?: number | null;
	reason?: string | null;
}

export async function createCalendarOverride(params: {
	input: CreateCalendarOverrideInput;
	createdByUserId: string;
	ipAddress?: string | null;
	userAgent?: string | null;
}) {
	const body = params.input;
	if (!body.overrideDate) {
		throwRpcError("MISSING_REQUIRED_FIELDS", 422, "overrideDate is required");
	}

	if (!isValidScheduleDateFormat(body.overrideDate)) {
		throwRpcError(
			"INVALID_DATE",
			422,
			"overrideDate must be a valid date in YYYY-MM-DD format",
		);
	}

	const existing = await db.query.calendarOverride.findFirst({
		where: eq(schema.calendarOverride.overrideDate, body.overrideDate),
	});
	if (existing) {
		throwRpcError(
			"DUPLICATE_OVERRIDE_DATE",
			409,
			`An override for date ${body.overrideDate} already exists`,
		);
	}

	const isClosed = body.isClosed ?? false;
	const hasOpeningHours =
		body.morningStart ||
		body.morningEnd ||
		body.afternoonStart ||
		body.afternoonEnd ||
		body.morningEnabled === true ||
		body.afternoonEnabled === true;

	if (isClosed && hasOpeningHours) {
		throwRpcError(
			"INVALID_CLOSED_STATE",
			422,
			"Cannot set isClosed=true while providing opening hours or enabling morning/afternoon",
		);
	}

	if (
		body.slotDurationMinutes !== undefined &&
		body.slotDurationMinutes !== null
	) {
		const slotDurationMinutes = parsePositiveInteger(body.slotDurationMinutes);
		if (slotDurationMinutes === null) {
			throwRpcError(
				"INVALID_SLOT_DURATION",
				422,
				"slotDurationMinutes must be a positive integer or null",
			);
		}
	}

	if (body.bufferMinutes !== undefined && body.bufferMinutes !== null) {
		const bufferMinutes = parseNonNegativeInteger(body.bufferMinutes);
		if (bufferMinutes === null) {
			throwRpcError(
				"INVALID_BUFFER_MINUTES",
				422,
				"bufferMinutes must be a non-negative integer or null",
			);
		}
	}

	if (body.slotCapacityLimit !== undefined && body.slotCapacityLimit !== null) {
		const slotCapacityLimit = parsePositiveInteger(body.slotCapacityLimit);
		if (slotCapacityLimit === null) {
			throwRpcError(
				"INVALID_SLOT_CAPACITY",
				422,
				"slotCapacityLimit must be a positive integer or null",
			);
		}
	}

	const { morningStart, morningEnd, afternoonStart, afternoonEnd } = body;
	if (
		!isValidScheduleTimeFormat(morningStart) ||
		!isValidScheduleTimeFormat(morningEnd) ||
		!isValidScheduleTimeFormat(afternoonStart) ||
		!isValidScheduleTimeFormat(afternoonEnd)
	) {
		throwRpcError("INVALID_TIME_FORMAT", 422, "Invalid time format (HH:MM)");
	}

	if (
		!isValidScheduleTimeWindow(morningStart, morningEnd) ||
		!isValidScheduleTimeWindow(afternoonStart, afternoonEnd) ||
		!isValidScheduleTimeWindow(morningEnd, afternoonStart)
	) {
		throwRpcError(
			"INVALID_TIME_WINDOW",
			422,
			"morningEnd must be before afternoonStart, and each window must have start < end",
		);
	}

	const id = crypto.randomUUID();
	const now = new Date();

	await db.insert(schema.calendarOverride).values({
		id,
		overrideDate: body.overrideDate,
		isClosed,
		morningEnabled: body.morningEnabled ?? true,
		morningStart: morningStart ?? null,
		morningEnd: morningEnd ?? null,
		afternoonEnabled: body.afternoonEnabled ?? true,
		afternoonStart: afternoonStart ?? null,
		afternoonEnd: afternoonEnd ?? null,
		slotDurationMinutes: body.slotDurationMinutes ?? null,
		bufferMinutes: body.bufferMinutes ?? null,
		slotCapacityLimit: body.slotCapacityLimit ?? null,
		reason: body.reason ?? null,
		createdByUserId: params.createdByUserId,
		createdAt: now,
		updatedAt: now,
	});

	// Create audit event for override creation
	await createAuditEvent({
		actorType: "admin",
		actorUserId: params.createdByUserId,
		entityType: "calendar_override",
		entityId: id,
		action: "create",
		summary: buildScheduleSummary("override", "created", {
			date: body.overrideDate,
			isClosed,
		}),
		payload: {
			overrideDate: body.overrideDate,
			isClosed,
			morningEnabled: body.morningEnabled ?? true,
			afternoonEnabled: body.afternoonEnabled ?? true,
			slotDurationMinutes: body.slotDurationMinutes ?? null,
			bufferMinutes: body.bufferMinutes ?? null,
			slotCapacityLimit: body.slotCapacityLimit ?? null,
			reason: body.reason ?? null,
		},
		ipAddress: params.ipAddress ?? null,
		userAgent: params.userAgent ?? null,
	});

	return await db.query.calendarOverride.findFirst({
		where: eq(schema.calendarOverride.id, id),
	});
}

export async function getCalendarOverride(id: string) {
	const override = await db.query.calendarOverride.findFirst({
		where: eq(schema.calendarOverride.id, id),
	});

	if (!override) {
		throwRpcError("NOT_FOUND", 404, "Calendar override not found");
	}

	return override;
}

export interface UpdateCalendarOverrideInput {
	id: string;
	overrideDate?: string;
	isClosed?: boolean;
	morningEnabled?: boolean;
	morningStart?: string | null;
	morningEnd?: string | null;
	afternoonEnabled?: boolean;
	afternoonStart?: string | null;
	afternoonEnd?: string | null;
	slotDurationMinutes?: number | null;
	bufferMinutes?: number | null;
	slotCapacityLimit?: number | null;
	reason?: string | null;
}

export async function updateCalendarOverride(
	payload: UpdateCalendarOverrideInput,
	options?: { ipAddress?: string | null; userAgent?: string | null },
) {
	const existing = await db.query.calendarOverride.findFirst({
		where: eq(schema.calendarOverride.id, payload.id),
	});
	if (!existing) {
		throwRpcError("NOT_FOUND", 404, "Calendar override not found");
	}

	if (payload.overrideDate !== undefined) {
		if (!isValidScheduleDateFormat(payload.overrideDate)) {
			throwRpcError(
				"INVALID_DATE",
				422,
				"overrideDate must be a valid date in YYYY-MM-DD format",
			);
		}
		const conflict = await db.query.calendarOverride.findFirst({
			where: and(
				eq(schema.calendarOverride.overrideDate, payload.overrideDate),
			),
		});
		if (conflict && conflict.id !== payload.id) {
			throwRpcError(
				"DUPLICATE_OVERRIDE_DATE",
				409,
				`An override for date ${payload.overrideDate} already exists`,
			);
		}
	}

	const isClosed = payload.isClosed ?? existing.isClosed;
	const effectiveMorningEnabled =
		payload.morningEnabled ?? existing.morningEnabled;
	const effectiveAfternoonEnabled =
		payload.afternoonEnabled ?? existing.afternoonEnabled;
	const effectiveMorningStart = payload.morningStart ?? existing.morningStart;
	const effectiveMorningEnd = payload.morningEnd ?? existing.morningEnd;
	const effectiveAfternoonStart =
		payload.afternoonStart ?? existing.afternoonStart;
	const effectiveAfternoonEnd = payload.afternoonEnd ?? existing.afternoonEnd;

	const hasOpeningHours =
		(effectiveMorningEnabled && effectiveMorningStart && effectiveMorningEnd) ||
		(effectiveAfternoonEnabled &&
			effectiveAfternoonStart &&
			effectiveAfternoonEnd);

	if (isClosed && hasOpeningHours) {
		throwRpcError(
			"INVALID_CLOSED_STATE",
			422,
			"Cannot set isClosed=true while providing opening hours or enabling morning/afternoon",
		);
	}

	if (payload.slotDurationMinutes !== undefined) {
		if (payload.slotDurationMinutes !== null) {
			const slotDurationMinutes = parsePositiveInteger(
				payload.slotDurationMinutes,
			);
			if (slotDurationMinutes === null) {
				throwRpcError(
					"INVALID_SLOT_DURATION",
					422,
					"slotDurationMinutes must be a positive integer or null",
				);
			}
		}
	}

	if (payload.bufferMinutes !== undefined) {
		if (payload.bufferMinutes !== null) {
			const bufferMinutes = parseNonNegativeInteger(payload.bufferMinutes);
			if (bufferMinutes === null) {
				throwRpcError(
					"INVALID_BUFFER_MINUTES",
					422,
					"bufferMinutes must be a non-negative integer or null",
				);
			}
		}
	}

	if (payload.slotCapacityLimit !== undefined) {
		if (payload.slotCapacityLimit !== null) {
			const slotCapacityLimit = parsePositiveInteger(payload.slotCapacityLimit);
			if (slotCapacityLimit === null) {
				throwRpcError(
					"INVALID_SLOT_CAPACITY",
					422,
					"slotCapacityLimit must be a positive integer or null",
				);
			}
		}
	}

	const morningStart = payload.morningStart ?? existing.morningStart;
	const morningEnd = payload.morningEnd ?? existing.morningEnd;
	const afternoonStart = payload.afternoonStart ?? existing.afternoonStart;
	const afternoonEnd = payload.afternoonEnd ?? existing.afternoonEnd;

	if (
		!isValidScheduleTimeFormat(payload.morningStart ?? null) ||
		!isValidScheduleTimeFormat(payload.morningEnd ?? null) ||
		!isValidScheduleTimeFormat(payload.afternoonStart ?? null) ||
		!isValidScheduleTimeFormat(payload.afternoonEnd ?? null)
	) {
		throwRpcError("INVALID_TIME_FORMAT", 422, "Invalid time format (HH:MM)");
	}

	if (
		!isValidScheduleTimeWindow(morningStart, morningEnd) ||
		!isValidScheduleTimeWindow(afternoonStart, afternoonEnd) ||
		!isValidScheduleTimeWindow(morningEnd, afternoonStart)
	) {
		throwRpcError(
			"INVALID_TIME_WINDOW",
			422,
			"morningEnd must be before afternoonStart, and each window must have start < end",
		);
	}

	const updates: Partial<typeof schema.calendarOverride.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (payload.overrideDate !== undefined) {
		updates.overrideDate = payload.overrideDate;
	}
	if (payload.isClosed !== undefined) updates.isClosed = payload.isClosed;
	if (payload.morningEnabled !== undefined) {
		updates.morningEnabled = payload.morningEnabled;
	}
	if (payload.morningStart !== undefined) {
		updates.morningStart = payload.morningStart;
	}
	if (payload.morningEnd !== undefined) {
		updates.morningEnd = payload.morningEnd;
	}
	if (payload.afternoonEnabled !== undefined) {
		updates.afternoonEnabled = payload.afternoonEnabled;
	}
	if (payload.afternoonStart !== undefined) {
		updates.afternoonStart = payload.afternoonStart;
	}
	if (payload.afternoonEnd !== undefined) {
		updates.afternoonEnd = payload.afternoonEnd;
	}
	if (payload.slotDurationMinutes !== undefined) {
		updates.slotDurationMinutes =
			payload.slotDurationMinutes === null
				? null
				: parsePositiveInteger(payload.slotDurationMinutes);
	}
	if (payload.bufferMinutes !== undefined) {
		updates.bufferMinutes =
			payload.bufferMinutes === null
				? null
				: parseNonNegativeInteger(payload.bufferMinutes);
	}
	if (payload.slotCapacityLimit !== undefined) {
		updates.slotCapacityLimit =
			payload.slotCapacityLimit === null
				? null
				: parsePositiveInteger(payload.slotCapacityLimit);
	}
	if (payload.reason !== undefined) {
		updates.reason = payload.reason;
	}

	await db
		.update(schema.calendarOverride)
		.set(updates)
		.where(eq(schema.calendarOverride.id, payload.id));

	// Create audit event for override update
	await createAuditEvent({
		actorType: "admin",
		entityType: "calendar_override",
		entityId: payload.id,
		action: "update",
		summary: buildScheduleSummary("override", "updated", {
			date: updates.overrideDate ?? existing.overrideDate,
			isClosed: updates.isClosed ?? existing.isClosed,
		}),
		payload: {
			id: payload.id,
			changes: updates,
		},
		ipAddress: options?.ipAddress ?? null,
		userAgent: options?.userAgent ?? null,
	});

	return await db.query.calendarOverride.findFirst({
		where: eq(schema.calendarOverride.id, payload.id),
	});
}

export async function removeCalendarOverride(
	id: string,
	options?: { ipAddress?: string | null; userAgent?: string | null },
) {
	const existing = await db.query.calendarOverride.findFirst({
		where: eq(schema.calendarOverride.id, id),
	});
	if (!existing) {
		throwRpcError("NOT_FOUND", 404, "Calendar override not found");
	}

	// Create audit event before deletion
	await createAuditEvent({
		actorType: "admin",
		entityType: "calendar_override",
		entityId: id,
		action: "delete",
		summary: buildScheduleSummary("override", "deleted", {
			date: existing.overrideDate,
			isClosed: existing.isClosed,
		}),
		payload: {
			id,
			overrideDate: existing.overrideDate,
			wasClosed: existing.isClosed,
		},
		ipAddress: options?.ipAddress ?? null,
		userAgent: options?.userAgent ?? null,
	});

	await db
		.delete(schema.calendarOverride)
		.where(eq(schema.calendarOverride.id, id));

	return { success: true };
}
