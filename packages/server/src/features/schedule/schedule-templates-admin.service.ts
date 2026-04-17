import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import { throwRpcError } from "../../orpc/shared";
import { buildScheduleSummary, createAuditEvent } from "../audit/audit.service";
import {
	isValidTimeFormat as isValidScheduleTimeFormat,
	isValidTimeWindow as isValidScheduleTimeWindow,
	isValidWeekday,
	parseNonNegativeInteger,
	parsePositiveInteger,
	WEEKDAY_MAX,
	WEEKDAY_MIN,
} from "./schedule.schemas";

export async function listScheduleTemplates() {
	return await db.query.scheduleTemplate.findMany({
		orderBy: (template, { asc }) => [asc(template.weekday)],
	});
}

export interface CreateScheduleTemplateInput {
	weekday?: number;
	slotDurationMinutes?: number;
	bufferMinutes?: number;
	slotCapacityLimit?: number | null;
	isEnabled?: boolean;
	morningStart?: string | null;
	morningEnd?: string | null;
	afternoonStart?: string | null;
	afternoonEnd?: string | null;
	notes?: string | null;
}

export async function createScheduleTemplate(
	input: CreateScheduleTemplateInput,
) {
	const body = input;
	if (body.weekday === undefined || body.slotDurationMinutes === undefined) {
		throwRpcError(
			"MISSING_REQUIRED_FIELDS",
			422,
			"weekday and slotDurationMinutes are required",
		);
	}

	const weekday = Number(body.weekday);
	const slotDurationMinutes = parsePositiveInteger(body.slotDurationMinutes);

	if (!isValidWeekday(weekday)) {
		throwRpcError(
			"INVALID_WEEKDAY",
			422,
			`weekday must be an integer between ${WEEKDAY_MIN} and ${WEEKDAY_MAX}`,
		);
	}

	if (slotDurationMinutes === null) {
		throwRpcError(
			"INVALID_SLOT_DURATION",
			422,
			"slotDurationMinutes must be a positive integer",
		);
	}

	if (body.bufferMinutes !== undefined) {
		const bufferMinutes = parseNonNegativeInteger(body.bufferMinutes);
		if (bufferMinutes === null) {
			throwRpcError(
				"INVALID_BUFFER_MINUTES",
				422,
				"bufferMinutes must be a non-negative integer",
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

	const existing = await db.query.scheduleTemplate.findFirst({
		where: eq(schema.scheduleTemplate.weekday, weekday),
	});
	if (existing) {
		throwRpcError(
			"DUPLICATE_WEEKDAY",
			409,
			`A schedule template for weekday ${weekday} already exists`,
		);
	}

	const id = crypto.randomUUID();
	const now = new Date();

	await db.insert(schema.scheduleTemplate).values({
		id,
		weekday,
		isEnabled: body.isEnabled ?? true,
		morningStart: morningStart ?? null,
		morningEnd: morningEnd ?? null,
		afternoonStart: afternoonStart ?? null,
		afternoonEnd: afternoonEnd ?? null,
		slotDurationMinutes,
		bufferMinutes: body.bufferMinutes ?? 0,
		slotCapacityLimit: body.slotCapacityLimit ?? null,
		notes: body.notes ?? null,
		createdAt: now,
		updatedAt: now,
	});

	// Create audit event for template creation
	await createAuditEvent({
		actorType: "admin",
		entityType: "schedule_template",
		entityId: id,
		action: "create",
		summary: buildScheduleSummary("template", "created", {
			weekday,
			isEnabled: body.isEnabled ?? true,
		}),
		payload: {
			weekday,
			isEnabled: body.isEnabled ?? true,
			slotDurationMinutes,
			bufferMinutes: body.bufferMinutes ?? 0,
			slotCapacityLimit: body.slotCapacityLimit ?? null,
			morningStart,
			morningEnd,
			afternoonStart,
			afternoonEnd,
			notes: body.notes ?? null,
		},
	});

	return await db.query.scheduleTemplate.findFirst({
		where: eq(schema.scheduleTemplate.id, id),
	});
}

export async function getScheduleTemplate(id: string) {
	const template = await db.query.scheduleTemplate.findFirst({
		where: eq(schema.scheduleTemplate.id, id),
	});

	if (!template) {
		throwRpcError("NOT_FOUND", 404, "Schedule template not found");
	}

	return template;
}

export interface UpdateScheduleTemplateInput {
	id: string;
	weekday?: number;
	slotDurationMinutes?: number;
	bufferMinutes?: number;
	slotCapacityLimit?: number | null;
	morningStart?: string | null;
	morningEnd?: string | null;
	afternoonStart?: string | null;
	afternoonEnd?: string | null;
	notes?: string | null;
	isEnabled?: boolean;
}

export async function updateScheduleTemplate(
	payload: UpdateScheduleTemplateInput,
) {
	const existing = await db.query.scheduleTemplate.findFirst({
		where: eq(schema.scheduleTemplate.id, payload.id),
	});
	if (!existing) {
		throwRpcError("NOT_FOUND", 404, "Schedule template not found");
	}

	const updates: Partial<typeof schema.scheduleTemplate.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (payload.weekday !== undefined) {
		const weekday = Number(payload.weekday);
		if (!isValidWeekday(weekday)) {
			throwRpcError(
				"INVALID_WEEKDAY",
				422,
				`weekday must be an integer between ${WEEKDAY_MIN} and ${WEEKDAY_MAX}`,
			);
		}

		const othersWithWeekday = await db.query.scheduleTemplate.findFirst({
			where: and(
				eq(schema.scheduleTemplate.weekday, weekday),
				sql`${schema.scheduleTemplate.id} <> ${payload.id}`,
			),
		});
		if (othersWithWeekday) {
			throwRpcError(
				"DUPLICATE_WEEKDAY",
				409,
				`A schedule template for weekday ${weekday} already exists`,
			);
		}

		updates.weekday = weekday;
	}

	if (payload.slotDurationMinutes !== undefined) {
		const slotDurationMinutes = parsePositiveInteger(
			payload.slotDurationMinutes,
		);
		if (slotDurationMinutes === null) {
			throwRpcError(
				"INVALID_SLOT_DURATION",
				422,
				"slotDurationMinutes must be a positive integer",
			);
		}
		updates.slotDurationMinutes = slotDurationMinutes;
	}

	if (payload.bufferMinutes !== undefined) {
		const bufferMinutes = parseNonNegativeInteger(payload.bufferMinutes);
		if (bufferMinutes === null) {
			throwRpcError(
				"INVALID_BUFFER_MINUTES",
				422,
				"bufferMinutes must be a non-negative integer",
			);
		}
		updates.bufferMinutes = bufferMinutes;
	}

	if (payload.slotCapacityLimit !== undefined) {
		if (payload.slotCapacityLimit === null) {
			updates.slotCapacityLimit = null;
		} else {
			const slotCapacityLimit = parsePositiveInteger(payload.slotCapacityLimit);
			if (slotCapacityLimit === null) {
				throwRpcError(
					"INVALID_SLOT_CAPACITY",
					422,
					"slotCapacityLimit must be a positive integer or null",
				);
			}
			updates.slotCapacityLimit = slotCapacityLimit;
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

	if (payload.morningStart !== undefined || payload.morningEnd !== undefined) {
		if (!isValidScheduleTimeWindow(morningStart, morningEnd)) {
			throwRpcError(
				"INVALID_TIME_WINDOW",
				422,
				"morningEnd must be after morningStart",
			);
		}
	}
	if (
		payload.afternoonStart !== undefined ||
		payload.afternoonEnd !== undefined
	) {
		if (!isValidScheduleTimeWindow(afternoonStart, afternoonEnd)) {
			throwRpcError(
				"INVALID_TIME_WINDOW",
				422,
				"afternoonEnd must be after afternoonStart",
			);
		}
	}
	if (
		payload.morningEnd !== undefined ||
		payload.afternoonStart !== undefined
	) {
		if (!isValidScheduleTimeWindow(morningEnd, afternoonStart)) {
			throwRpcError(
				"INVALID_TIME_WINDOW",
				422,
				"afternoonStart must be after morningEnd",
			);
		}
	}

	if (payload.morningStart !== undefined) {
		updates.morningStart = payload.morningStart;
	}
	if (payload.morningEnd !== undefined) {
		updates.morningEnd = payload.morningEnd;
	}
	if (payload.afternoonStart !== undefined) {
		updates.afternoonStart = payload.afternoonStart;
	}
	if (payload.afternoonEnd !== undefined) {
		updates.afternoonEnd = payload.afternoonEnd;
	}
	if (payload.notes !== undefined) updates.notes = payload.notes;
	if (payload.isEnabled !== undefined) {
		updates.isEnabled = payload.isEnabled;
	}

	await db
		.update(schema.scheduleTemplate)
		.set(updates)
		.where(eq(schema.scheduleTemplate.id, payload.id));

	// Create audit event for template update
	await createAuditEvent({
		actorType: "admin",
		entityType: "schedule_template",
		entityId: payload.id,
		action: "update",
		summary: buildScheduleSummary("template", "updated", {
			weekday: updates.weekday ?? existing.weekday,
			isEnabled: updates.isEnabled ?? existing.isEnabled,
		}),
		payload: {
			id: payload.id,
			changes: updates,
		},
	});

	return await db.query.scheduleTemplate.findFirst({
		where: eq(schema.scheduleTemplate.id, payload.id),
	});
}

export async function removeScheduleTemplate(id: string) {
	const existing = await db.query.scheduleTemplate.findFirst({
		where: eq(schema.scheduleTemplate.id, id),
	});
	if (!existing) {
		throwRpcError("NOT_FOUND", 404, "Schedule template not found");
	}

	// Create audit event before deletion
	await createAuditEvent({
		actorType: "admin",
		entityType: "schedule_template",
		entityId: id,
		action: "delete",
		summary: buildScheduleSummary("template", "deleted", {
			weekday: existing.weekday,
		}),
		payload: {
			id,
			weekday: existing.weekday,
			wasEnabled: existing.isEnabled,
		},
	});

	await db
		.delete(schema.scheduleTemplate)
		.where(eq(schema.scheduleTemplate.id, id));

	return { success: true };
}
