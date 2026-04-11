import { Hono } from "hono";
import { db, schema } from "./db";
import { eq, and } from "drizzle-orm";

type AppVariables = {
	user: { id: string; role: string | null; [key: string]: unknown } | null;
	session: { id: string; [key: string]: unknown } | null;
};

const app = new Hono<{ Variables: AppVariables }>();

// =============================================================================
// SHARED TYPES & ERROR HELPERS
// =============================================================================

const WEEKDAY_MIN = 0;
const WEEKDAY_MAX = 6;

const isValidWeekday = (w: number) =>
	Number.isInteger(w) && w >= WEEKDAY_MIN && w <= WEEKDAY_MAX;

const isValidTimeFormat = (t: string | null | undefined): boolean => {
	if (!t) return true; // nullable fields are valid
	// HH:MM format (24-hour)
	return /^\d{2}:\d{2}$/.test(t) && t >= "00:00" && t <= "23:59";
};

const isValidDateFormat = (d: string): boolean => {
	// YYYY-MM-DD format
	if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
	const date = new Date(d);
	return !Number.isNaN(date.getTime());
};

const isValidTimeWindow = (
	start: string | null | undefined,
	end: string | null | undefined,
): boolean => {
	if (!start || !end) return true;
	return start < end;
};

const errorResponse = (code: string, message: string, status: number) =>
	new Response(JSON.stringify({ code, message }), {
		status,
		headers: { "Content-Type": "application/json" },
	});

// =============================================================================
// SCHEDULE TEMPLATES CRUD
// =============================================================================

/**
 * POST /api/admin/schedule/templates
 * Create a new schedule template.
 *
 * Validation:
 * - weekday: required, integer 0-6, unique
 * - slotDurationMinutes: required, > 0
 * - time windows: morningEnd > morningStart, afternoonEnd > afternoonStart
 *   afternoonStart >= morningEnd
 */
app.post("/templates", async (c) => {
	const body = await c.req.json();

	// Validate required fields
	if (body.weekday === undefined || body.slotDurationMinutes === undefined) {
		return errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"weekday and slotDurationMinutes are required",
			422,
		);
	}

	const weekday = Number(body.weekday);
	const slotDurationMinutes = Number(body.slotDurationMinutes);

	// Validate weekday range
	if (!isValidWeekday(weekday)) {
		return errorResponse(
			"INVALID_WEEKDAY",
			`weekday must be an integer between ${WEEKDAY_MIN} and ${WEEKDAY_MAX}`,
			422,
		);
	}

	// Validate slotDurationMinutes > 0
	if (!Number.isInteger(slotDurationMinutes) || slotDurationMinutes <= 0) {
		return errorResponse(
			"INVALID_SLOT_DURATION",
			"slotDurationMinutes must be a positive integer",
			422,
		);
	}

	// Validate time formats
	const { morningStart, morningEnd, afternoonStart, afternoonEnd } = body;
	if (
		!isValidTimeFormat(morningStart) ||
		!isValidTimeFormat(morningEnd) ||
		!isValidTimeFormat(afternoonStart) ||
		!isValidTimeFormat(afternoonEnd)
	) {
		return errorResponse("INVALID_TIME_FORMAT", "Invalid time format (HH:MM)", 422);
	}

	// Validate time windows
	if (
		!isValidTimeWindow(morningStart, morningEnd) ||
		!isValidTimeWindow(afternoonStart, afternoonEnd) ||
		!isValidTimeWindow(morningEnd, afternoonStart)
	) {
		return errorResponse(
			"INVALID_TIME_WINDOW",
			"morningEnd must be before afternoonStart, and each window must have start < end",
			422,
		);
	}

	// Check for duplicate weekday
	const existing = await db.query.scheduleTemplate.findFirst({
		where: eq(schema.scheduleTemplate.weekday, weekday),
	});
	if (existing) {
		return errorResponse(
			"DUPLICATE_WEEKDAY",
			`A schedule template for weekday ${weekday} already exists`,
			409,
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

	const created = await db.query.scheduleTemplate.findFirst({
		where: eq(schema.scheduleTemplate.id, id),
	});

	return c.json(created, 201);
});

/**
 * GET /api/admin/schedule/templates
 * List all schedule templates.
 */
app.get("/templates", async (c) => {
	const templates = await db.query.scheduleTemplate.findMany({
		orderBy: (t, { asc }) => [asc(t.weekday)],
	});
	return c.json(templates);
});

/**
 * GET /api/admin/schedule/templates/:id
 * Get a single schedule template by ID.
 */
app.get("/templates/:id", async (c) => {
	const { id } = c.req.param();

	const template = await db.query.scheduleTemplate.findFirst({
		where: eq(schema.scheduleTemplate.id, id),
	});

	if (!template) {
		return errorResponse("NOT_FOUND", "Schedule template not found", 404);
	}

	return c.json(template);
});

/**
 * PATCH /api/admin/schedule/templates/:id
 * Update a schedule template.
 *
 * Validation:
 * - time windows must remain valid if provided
 * - slotDurationMinutes must remain > 0 if provided
 */
app.patch("/templates/:id", async (c) => {
	const { id } = c.req.param();
	const body = await c.req.json();

	// Check existence
	const existing = await db.query.scheduleTemplate.findFirst({
		where: eq(schema.scheduleTemplate.id, id),
	});
	if (!existing) {
		return errorResponse("NOT_FOUND", "Schedule template not found", 404);
	}

	// Build update object
	const updates: Partial<typeof schema.scheduleTemplate.$inferInsert> = {
		updatedAt: new Date(),
	};

	// Validate and set weekday if provided
	if (body.weekday !== undefined) {
		const weekday = Number(body.weekday);
		if (!isValidWeekday(weekday)) {
			return errorResponse(
				"INVALID_WEEKDAY",
				`weekday must be an integer between ${WEEKDAY_MIN} and ${WEEKDAY_MAX}`,
				422,
			);
		}
		// If there's another template with this weekday (excluding current record)
		const othersWithWeekday = await db.query.scheduleTemplate.findFirst({
			where: and(
				eq(schema.scheduleTemplate.weekday, weekday),
			),
		});
		if (othersWithWeekday && othersWithWeekday.id !== id) {
			return errorResponse(
				"DUPLICATE_WEEKDAY",
				`A schedule template for weekday ${weekday} already exists`,
				409,
			);
		}
		updates.weekday = weekday;
	}

	// Validate and set slotDurationMinutes if provided
	if (body.slotDurationMinutes !== undefined) {
		const slotDurationMinutes = Number(body.slotDurationMinutes);
		if (
			!Number.isInteger(slotDurationMinutes) ||
			slotDurationMinutes <= 0
		) {
			return errorResponse(
				"INVALID_SLOT_DURATION",
				"slotDurationMinutes must be a positive integer",
				422,
			);
		}
		updates.slotDurationMinutes = slotDurationMinutes;
	}

	// Validate time formats if provided
	const morningStart = body.morningStart ?? existing.morningStart;
	const morningEnd = body.morningEnd ?? existing.morningEnd;
	const afternoonStart = body.afternoonStart ?? existing.afternoonStart;
	const afternoonEnd = body.afternoonEnd ?? existing.afternoonEnd;

	if (
		!isValidTimeFormat(body.morningStart ?? null) ||
		!isValidTimeFormat(body.morningEnd ?? null) ||
		!isValidTimeFormat(body.afternoonStart ?? null) ||
		!isValidTimeFormat(body.afternoonEnd ?? null)
	) {
		return errorResponse("INVALID_TIME_FORMAT", "Invalid time format (HH:MM)", 422);
	}

	// Validate time windows if any time fields are provided
	if (body.morningStart !== undefined || body.morningEnd !== undefined) {
		if (!isValidTimeWindow(morningStart, morningEnd)) {
			return errorResponse(
				"INVALID_TIME_WINDOW",
				"morningEnd must be after morningStart",
				422,
			);
		}
	}
	if (body.afternoonStart !== undefined || body.afternoonEnd !== undefined) {
		if (!isValidTimeWindow(afternoonStart, afternoonEnd)) {
			return errorResponse(
				"INVALID_TIME_WINDOW",
				"afternoonEnd must be after afternoonStart",
				422,
			);
		}
	}
	if (
		body.morningEnd !== undefined ||
		body.afternoonStart !== undefined
	) {
		if (!isValidTimeWindow(morningEnd, afternoonStart)) {
			return errorResponse(
				"INVALID_TIME_WINDOW",
				"afternoonStart must be after morningEnd",
				422,
			);
		}
	}

	if (body.morningStart !== undefined) updates.morningStart = body.morningStart;
	if (body.morningEnd !== undefined) updates.morningEnd = body.morningEnd;
	if (body.afternoonStart !== undefined) updates.afternoonStart = body.afternoonStart;
	if (body.afternoonEnd !== undefined) updates.afternoonEnd = body.afternoonEnd;
	if (body.bufferMinutes !== undefined) updates.bufferMinutes = body.bufferMinutes;
	if (body.slotCapacityLimit !== undefined) updates.slotCapacityLimit = body.slotCapacityLimit;
	if (body.notes !== undefined) updates.notes = body.notes;
	if (body.isEnabled !== undefined) updates.isEnabled = body.isEnabled;

	await db
		.update(schema.scheduleTemplate)
		.set(updates)
		.where(eq(schema.scheduleTemplate.id, id));

	const updated = await db.query.scheduleTemplate.findFirst({
		where: eq(schema.scheduleTemplate.id, id),
	});

	return c.json(updated);
});

/**
 * DELETE /api/admin/schedule/templates/:id
 * Delete a schedule template.
 */
app.delete("/templates/:id", async (c) => {
	const { id } = c.req.param();

	const existing = await db.query.scheduleTemplate.findFirst({
		where: eq(schema.scheduleTemplate.id, id),
	});
	if (!existing) {
		return errorResponse("NOT_FOUND", "Schedule template not found", 404);
	}

	await db.delete(schema.scheduleTemplate).where(eq(schema.scheduleTemplate.id, id));

	return c.body(null, 204);
});

// =============================================================================
// CALENDAR OVERRIDES CRUD
// =============================================================================

/**
 * POST /api/admin/schedule/overrides
 * Create a new calendar override.
 *
 * Validation:
 * - overrideDate: required, valid YYYY-MM-DD format, unique
 * - isClosed cannot be true while having opening hours/flags
 * - time windows must be valid if provided
 */
app.post("/overrides", async (c) => {
	const body = await c.req.json();

	// Validate required fields
	if (!body.overrideDate) {
		return errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"overrideDate is required",
			422,
		);
	}

	// Validate date format
	if (!isValidDateFormat(body.overrideDate)) {
		return errorResponse(
			"INVALID_DATE",
			"overrideDate must be a valid date in YYYY-MM-DD format",
			422,
		);
	}

	// Check for duplicate date
	const existing = await db.query.calendarOverride.findFirst({
		where: eq(schema.calendarOverride.overrideDate, body.overrideDate),
	});
	if (existing) {
		return errorResponse(
			"DUPLICATE_OVERRIDE_DATE",
			`An override for date ${body.overrideDate} already exists`,
			409,
		);
	}

	// Validate isClosed contradiction
	const isClosed = body.isClosed ?? false;
	const hasOpeningHours =
		body.morningStart ||
		body.morningEnd ||
		body.afternoonStart ||
		body.afternoonEnd ||
		body.morningEnabled === true ||
		body.afternoonEnabled === true;

	if (isClosed && hasOpeningHours) {
		return errorResponse(
			"INVALID_CLOSED_STATE",
			"Cannot set isClosed=true while providing opening hours or enabling morning/afternoon",
			422,
		);
	}

	// Validate time formats
	const { morningStart, morningEnd, afternoonStart, afternoonEnd } = body;
	if (
		!isValidTimeFormat(morningStart) ||
		!isValidTimeFormat(morningEnd) ||
		!isValidTimeFormat(afternoonStart) ||
		!isValidTimeFormat(afternoonEnd)
	) {
		return errorResponse("INVALID_TIME_FORMAT", "Invalid time format (HH:MM)", 422);
	}

	// Validate time windows
	if (
		!isValidTimeWindow(morningStart, morningEnd) ||
		!isValidTimeWindow(afternoonStart, afternoonEnd) ||
		!isValidTimeWindow(morningEnd, afternoonStart)
	) {
		return errorResponse(
			"INVALID_TIME_WINDOW",
			"morningEnd must be before afternoonStart, and each window must have start < end",
			422,
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
		createdByUserId: c.get("user")?.id ?? null,
		createdAt: now,
		updatedAt: now,
	});

	const created = await db.query.calendarOverride.findFirst({
		where: eq(schema.calendarOverride.id, id),
	});

	return c.json(created, 201);
});

/**
 * GET /api/admin/schedule/overrides
 * List calendar overrides, optionally filtered by date.
 */
app.get("/overrides", async (c) => {
	const date = c.req.query("date");

	let overrides: (typeof schema.calendarOverride.$inferSelect)[];
	if (date) {
		if (!isValidDateFormat(date)) {
			return errorResponse(
				"INVALID_DATE",
				"date query parameter must be a valid date in YYYY-MM-DD format",
				422,
			);
		}
		overrides = await db.query.calendarOverride.findMany({
			where: eq(schema.calendarOverride.overrideDate, date),
		});
	} else {
		overrides = await db.query.calendarOverride.findMany({
			orderBy: (o, { asc }) => [asc(o.overrideDate)],
		});
	}
	return c.json(overrides);
});

/**
 * GET /api/admin/schedule/overrides/:id
 * Get a single calendar override by ID.
 */
app.get("/overrides/:id", async (c) => {
	const { id } = c.req.param();

	const override = await db.query.calendarOverride.findFirst({
		where: eq(schema.calendarOverride.id, id),
	});

	if (!override) {
		return errorResponse("NOT_FOUND", "Calendar override not found", 404);
	}

	return c.json(override);
});

/**
 * PATCH /api/admin/schedule/overrides/:id
 * Update a calendar override.
 */
app.patch("/overrides/:id", async (c) => {
	const { id } = c.req.param();
	const body = await c.req.json();

	// Check existence
	const existing = await db.query.calendarOverride.findFirst({
		where: eq(schema.calendarOverride.id, id),
	});
	if (!existing) {
		return errorResponse("NOT_FOUND", "Calendar override not found", 404);
	}

	// Validate date format if provided
	if (body.overrideDate !== undefined) {
		if (!isValidDateFormat(body.overrideDate)) {
			return errorResponse(
				"INVALID_DATE",
				"overrideDate must be a valid date in YYYY-MM-DD format",
				422,
			);
		}
		// Check uniqueness (excluding current record)
		const conflict = await db.query.calendarOverride.findFirst({
			where: and(
				eq(schema.calendarOverride.overrideDate, body.overrideDate),
			),
		});
		if (conflict && conflict.id !== id) {
			return errorResponse(
				"DUPLICATE_OVERRIDE_DATE",
				`An override for date ${body.overrideDate} already exists`,
				409,
			);
		}
	}

	// Validate isClosed contradiction if being updated
	const isClosed = body.isClosed ?? existing.isClosed;
	const hasOpeningHours =
		body.morningStart ||
		body.morningEnd ||
		body.afternoonStart ||
		body.afternoonEnd ||
		body.morningEnabled === true ||
		body.afternoonEnabled === true;

	if (isClosed && hasOpeningHours) {
		return errorResponse(
			"INVALID_CLOSED_STATE",
			"Cannot set isClosed=true while providing opening hours or enabling morning/afternoon",
			422,
		);
	}

	// Validate time formats
	const morningStart = body.morningStart ?? existing.morningStart;
	const morningEnd = body.morningEnd ?? existing.morningEnd;
	const afternoonStart = body.afternoonStart ?? existing.afternoonStart;
	const afternoonEnd = body.afternoonEnd ?? existing.afternoonEnd;

	if (
		!isValidTimeFormat(body.morningStart ?? null) ||
		!isValidTimeFormat(body.morningEnd ?? null) ||
		!isValidTimeFormat(body.afternoonStart ?? null) ||
		!isValidTimeFormat(body.afternoonEnd ?? null)
	) {
		return errorResponse("INVALID_TIME_FORMAT", "Invalid time format (HH:MM)", 422);
	}

	// Validate time windows
	if (
		!isValidTimeWindow(morningStart, morningEnd) ||
		!isValidTimeWindow(afternoonStart, afternoonEnd) ||
		!isValidTimeWindow(morningEnd, afternoonStart)
	) {
		return errorResponse(
			"INVALID_TIME_WINDOW",
			"morningEnd must be before afternoonStart, and each window must have start < end",
			422,
		);
	}

	const updates: Partial<typeof schema.calendarOverride.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (body.overrideDate !== undefined) updates.overrideDate = body.overrideDate;
	if (body.isClosed !== undefined) updates.isClosed = body.isClosed;
	if (body.morningEnabled !== undefined) updates.morningEnabled = body.morningEnabled;
	if (body.morningStart !== undefined) updates.morningStart = body.morningStart;
	if (body.morningEnd !== undefined) updates.morningEnd = body.morningEnd;
	if (body.afternoonEnabled !== undefined) updates.afternoonEnabled = body.afternoonEnabled;
	if (body.afternoonStart !== undefined) updates.afternoonStart = body.afternoonStart;
	if (body.afternoonEnd !== undefined) updates.afternoonEnd = body.afternoonEnd;
	if (body.slotDurationMinutes !== undefined) updates.slotDurationMinutes = body.slotDurationMinutes;
	if (body.bufferMinutes !== undefined) updates.bufferMinutes = body.bufferMinutes;
	if (body.slotCapacityLimit !== undefined) updates.slotCapacityLimit = body.slotCapacityLimit;
	if (body.reason !== undefined) updates.reason = body.reason;

	await db
		.update(schema.calendarOverride)
		.set(updates)
		.where(eq(schema.calendarOverride.id, id));

	const updated = await db.query.calendarOverride.findFirst({
		where: eq(schema.calendarOverride.id, id),
	});

	return c.json(updated);
});

/**
 * DELETE /api/admin/schedule/overrides/:id
 * Delete a calendar override.
 */
app.delete("/overrides/:id", async (c) => {
	const { id } = c.req.param();

	const existing = await db.query.calendarOverride.findFirst({
		where: eq(schema.calendarOverride.id, id),
	});
	if (!existing) {
		return errorResponse("NOT_FOUND", "Calendar override not found", 404);
	}

	await db.delete(schema.calendarOverride).where(eq(schema.calendarOverride.id, id));

	return c.body(null, 204);
});

export { app as scheduleApp };
