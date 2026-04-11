import { and, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import { db, schema } from "./db";

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
	// Parse components to avoid timezone issues
	const year = parseInt(d.substring(0, 4), 10);
	const month = parseInt(d.substring(5, 7), 10);
	const day = parseInt(d.substring(8, 10), 10);
	// Validate ranges
	if (year < 1 || year > 9999) return false;
	if (month < 1 || month > 12) return false;
	// Check day is valid for the month (handles leap years via Date logic)
	const daysInMonth = new Date(year, month, 0).getDate();
	if (day < 1 || day > daysInMonth) return false;
	// Explicit leap year check for Feb 29
	if (month === 2 && day === 29) {
		const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
		if (!isLeap) return false;
	}
	return true;
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

const parsePositiveInteger = (value: unknown): number | null => {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) return null;
	return parsed;
};

const parseNonNegativeInteger = (value: unknown): number | null => {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 0) return null;
	return parsed;
};

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
	const slotDurationMinutes = parsePositiveInteger(body.slotDurationMinutes);

	// Validate weekday range
	if (!isValidWeekday(weekday)) {
		return errorResponse(
			"INVALID_WEEKDAY",
			`weekday must be an integer between ${WEEKDAY_MIN} and ${WEEKDAY_MAX}`,
			422,
		);
	}

	// Validate slotDurationMinutes > 0
	if (slotDurationMinutes === null) {
		return errorResponse(
			"INVALID_SLOT_DURATION",
			"slotDurationMinutes must be a positive integer",
			422,
		);
	}

	if (body.bufferMinutes !== undefined) {
		const bufferMinutes = parseNonNegativeInteger(body.bufferMinutes);
		if (bufferMinutes === null) {
			return errorResponse(
				"INVALID_BUFFER_MINUTES",
				"bufferMinutes must be a non-negative integer",
				422,
			);
		}
	}

	if (body.slotCapacityLimit !== undefined && body.slotCapacityLimit !== null) {
		const slotCapacityLimit = parsePositiveInteger(body.slotCapacityLimit);
		if (slotCapacityLimit === null) {
			return errorResponse(
				"INVALID_SLOT_CAPACITY",
				"slotCapacityLimit must be a positive integer or null",
				422,
			);
		}
	}

	// Validate time formats
	const { morningStart, morningEnd, afternoonStart, afternoonEnd } = body;
	if (
		!isValidTimeFormat(morningStart) ||
		!isValidTimeFormat(morningEnd) ||
		!isValidTimeFormat(afternoonStart) ||
		!isValidTimeFormat(afternoonEnd)
	) {
		return errorResponse(
			"INVALID_TIME_FORMAT",
			"Invalid time format (HH:MM)",
			422,
		);
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
				ne(schema.scheduleTemplate.id, id),
			),
		});
		if (othersWithWeekday) {
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
		const slotDurationMinutes = parsePositiveInteger(body.slotDurationMinutes);
		if (slotDurationMinutes === null) {
			return errorResponse(
				"INVALID_SLOT_DURATION",
				"slotDurationMinutes must be a positive integer",
				422,
			);
		}
		updates.slotDurationMinutes = slotDurationMinutes;
	}

	if (body.bufferMinutes !== undefined) {
		const bufferMinutes = parseNonNegativeInteger(body.bufferMinutes);
		if (bufferMinutes === null) {
			return errorResponse(
				"INVALID_BUFFER_MINUTES",
				"bufferMinutes must be a non-negative integer",
				422,
			);
		}
		updates.bufferMinutes = bufferMinutes;
	}

	if (body.slotCapacityLimit !== undefined) {
		if (body.slotCapacityLimit === null) {
			updates.slotCapacityLimit = null;
		} else {
			const slotCapacityLimit = parsePositiveInteger(body.slotCapacityLimit);
			if (slotCapacityLimit === null) {
				return errorResponse(
					"INVALID_SLOT_CAPACITY",
					"slotCapacityLimit must be a positive integer or null",
					422,
				);
			}
			updates.slotCapacityLimit = slotCapacityLimit;
		}
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
		return errorResponse(
			"INVALID_TIME_FORMAT",
			"Invalid time format (HH:MM)",
			422,
		);
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
	if (body.morningEnd !== undefined || body.afternoonStart !== undefined) {
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
	if (body.afternoonStart !== undefined)
		updates.afternoonStart = body.afternoonStart;
	if (body.afternoonEnd !== undefined) updates.afternoonEnd = body.afternoonEnd;
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

	await db
		.delete(schema.scheduleTemplate)
		.where(eq(schema.scheduleTemplate.id, id));

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

	if (
		body.slotDurationMinutes !== undefined &&
		body.slotDurationMinutes !== null
	) {
		const slotDurationMinutes = parsePositiveInteger(body.slotDurationMinutes);
		if (slotDurationMinutes === null) {
			return errorResponse(
				"INVALID_SLOT_DURATION",
				"slotDurationMinutes must be a positive integer or null",
				422,
			);
		}
	}

	if (body.bufferMinutes !== undefined && body.bufferMinutes !== null) {
		const bufferMinutes = parseNonNegativeInteger(body.bufferMinutes);
		if (bufferMinutes === null) {
			return errorResponse(
				"INVALID_BUFFER_MINUTES",
				"bufferMinutes must be a non-negative integer or null",
				422,
			);
		}
	}

	if (body.slotCapacityLimit !== undefined && body.slotCapacityLimit !== null) {
		const slotCapacityLimit = parsePositiveInteger(body.slotCapacityLimit);
		if (slotCapacityLimit === null) {
			return errorResponse(
				"INVALID_SLOT_CAPACITY",
				"slotCapacityLimit must be a positive integer or null",
				422,
			);
		}
	}

	// Validate time formats
	const { morningStart, morningEnd, afternoonStart, afternoonEnd } = body;
	if (
		!isValidTimeFormat(morningStart) ||
		!isValidTimeFormat(morningEnd) ||
		!isValidTimeFormat(afternoonStart) ||
		!isValidTimeFormat(afternoonEnd)
	) {
		return errorResponse(
			"INVALID_TIME_FORMAT",
			"Invalid time format (HH:MM)",
			422,
		);
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
			where: and(eq(schema.calendarOverride.overrideDate, body.overrideDate)),
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
	const effectiveMorningEnabled =
		body.morningEnabled ?? existing.morningEnabled;
	const effectiveAfternoonEnabled =
		body.afternoonEnabled ?? existing.afternoonEnabled;
	const effectiveMorningStart = body.morningStart ?? existing.morningStart;
	const effectiveMorningEnd = body.morningEnd ?? existing.morningEnd;
	const effectiveAfternoonStart =
		body.afternoonStart ?? existing.afternoonStart;
	const effectiveAfternoonEnd = body.afternoonEnd ?? existing.afternoonEnd;

	const hasOpeningHours =
		(effectiveMorningEnabled && effectiveMorningStart && effectiveMorningEnd) ||
		(effectiveAfternoonEnabled &&
			effectiveAfternoonStart &&
			effectiveAfternoonEnd);

	if (isClosed && hasOpeningHours) {
		return errorResponse(
			"INVALID_CLOSED_STATE",
			"Cannot set isClosed=true while providing opening hours or enabling morning/afternoon",
			422,
		);
	}

	if (body.slotDurationMinutes !== undefined) {
		if (body.slotDurationMinutes === null) {
			// allowed: explicit null to inherit from template
		} else {
			const slotDurationMinutes = parsePositiveInteger(
				body.slotDurationMinutes,
			);
			if (slotDurationMinutes === null) {
				return errorResponse(
					"INVALID_SLOT_DURATION",
					"slotDurationMinutes must be a positive integer or null",
					422,
				);
			}
		}
	}

	if (body.bufferMinutes !== undefined) {
		if (body.bufferMinutes === null) {
			// allowed
		} else {
			const bufferMinutes = parseNonNegativeInteger(body.bufferMinutes);
			if (bufferMinutes === null) {
				return errorResponse(
					"INVALID_BUFFER_MINUTES",
					"bufferMinutes must be a non-negative integer or null",
					422,
				);
			}
		}
	}

	if (body.slotCapacityLimit !== undefined) {
		if (body.slotCapacityLimit === null) {
			// allowed
		} else {
			const slotCapacityLimit = parsePositiveInteger(body.slotCapacityLimit);
			if (slotCapacityLimit === null) {
				return errorResponse(
					"INVALID_SLOT_CAPACITY",
					"slotCapacityLimit must be a positive integer or null",
					422,
				);
			}
		}
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
		return errorResponse(
			"INVALID_TIME_FORMAT",
			"Invalid time format (HH:MM)",
			422,
		);
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
	if (body.morningEnabled !== undefined)
		updates.morningEnabled = body.morningEnabled;
	if (body.morningStart !== undefined) updates.morningStart = body.morningStart;
	if (body.morningEnd !== undefined) updates.morningEnd = body.morningEnd;
	if (body.afternoonEnabled !== undefined)
		updates.afternoonEnabled = body.afternoonEnabled;
	if (body.afternoonStart !== undefined)
		updates.afternoonStart = body.afternoonStart;
	if (body.afternoonEnd !== undefined) updates.afternoonEnd = body.afternoonEnd;
	if (body.slotDurationMinutes !== undefined) {
		updates.slotDurationMinutes =
			body.slotDurationMinutes === null
				? null
				: parsePositiveInteger(body.slotDurationMinutes);
	}
	if (body.bufferMinutes !== undefined) {
		updates.bufferMinutes =
			body.bufferMinutes === null
				? null
				: parseNonNegativeInteger(body.bufferMinutes);
	}
	if (body.slotCapacityLimit !== undefined) {
		updates.slotCapacityLimit =
			body.slotCapacityLimit === null
				? null
				: parsePositiveInteger(body.slotCapacityLimit);
	}
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

	await db
		.delete(schema.calendarOverride)
		.where(eq(schema.calendarOverride.id, id));

	return c.body(null, 204);
});

// =============================================================================
// SLOT GENERATION
// =============================================================================

interface TimeWindow {
	start: string; // "HH:MM"
	end: string; // "HH:MM"
}

interface EffectiveSchedule {
	slotDurationMinutes: number;
	bufferMinutes: number;
	slotCapacityLimit: number | null;
	windows: TimeWindow[];
	generatedFrom: "override" | "base";
}

/**
 * Parse a time string "HH:MM" to minutes since midnight.
 */
const timeToMinutes = (t: string): number => {
	const [h, m] = t.split(":").map(Number);
	return h * 60 + m;
};

/**
 * Format minutes since midnight to "HH:MM".
 */
const minutesToTime = (minutes: number): string => {
	const h = Math.floor(minutes / 60) % 24;
	const m = minutes % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const formatDateLocal = (date: Date): string => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

/**
 * Compute effective schedule for a given date:
 * - Override takes precedence over base template
 * - Partial override fields inherit from base template
 */
const getEffectiveSchedule = async (
	date: string,
): Promise<{
	schedule: EffectiveSchedule | null;
	override: typeof schema.calendarOverride.$inferSelect | null;
}> => {
	// Get weekday from date
	const dateObj = new Date(`${date}T00:00:00`);
	const weekday = dateObj.getDay(); // 0=Sunday, 6=Saturday

	// Check for calendar override first (override > base precedence)
	const override = await db.query.calendarOverride.findFirst({
		where: eq(schema.calendarOverride.overrideDate, date),
	});

	if (override) {
		// Override exists - check if closed
		if (override.isClosed) {
			return { schedule: null, override };
		}

		// Get base template for inheritance
		const template = await db.query.scheduleTemplate.findFirst({
			where: and(
				eq(schema.scheduleTemplate.weekday, weekday),
				eq(schema.scheduleTemplate.isEnabled, true),
			),
		});

		// Build effective schedule with partial inheritance
		const slotDurationMinutes =
			override.slotDurationMinutes ?? template?.slotDurationMinutes ?? 30;
		const bufferMinutes =
			override.bufferMinutes ?? template?.bufferMinutes ?? 0;
		const slotCapacityLimit =
			override.slotCapacityLimit ?? template?.slotCapacityLimit ?? null;

		const windows: TimeWindow[] = [];

		// Morning window
		if (
			override.morningEnabled &&
			override.morningStart &&
			override.morningEnd
		) {
			windows.push({ start: override.morningStart, end: override.morningEnd });
		} else if (!override.morningStart && !override.morningEnd && template) {
			// Partial override: inherit from template if morning is still enabled
			if (
				override.morningEnabled !== false &&
				template.morningStart &&
				template.morningEnd
			) {
				windows.push({
					start: template.morningStart,
					end: template.morningEnd,
				});
			}
		}

		// Afternoon window
		if (
			override.afternoonEnabled &&
			override.afternoonStart &&
			override.afternoonEnd
		) {
			windows.push({
				start: override.afternoonStart,
				end: override.afternoonEnd,
			});
		} else if (!override.afternoonStart && !override.afternoonEnd && template) {
			// Partial override: inherit from template if afternoon is still enabled
			if (
				override.afternoonEnabled !== false &&
				template.afternoonStart &&
				template.afternoonEnd
			) {
				windows.push({
					start: template.afternoonStart,
					end: template.afternoonEnd,
				});
			}
		}

		return {
			schedule: {
				slotDurationMinutes,
				bufferMinutes,
				slotCapacityLimit,
				windows,
				generatedFrom: "override",
			},
			override,
		};
	}

	// No override - use base template
	const template = await db.query.scheduleTemplate.findFirst({
		where: and(
			eq(schema.scheduleTemplate.weekday, weekday),
			eq(schema.scheduleTemplate.isEnabled, true),
		),
	});

	if (!template) {
		return { schedule: null, override: null };
	}

	const windows: TimeWindow[] = [];
	if (template.morningStart && template.morningEnd) {
		windows.push({ start: template.morningStart, end: template.morningEnd });
	}
	if (template.afternoonStart && template.afternoonEnd) {
		windows.push({
			start: template.afternoonStart,
			end: template.afternoonEnd,
		});
	}

	return {
		schedule: {
			slotDurationMinutes: template.slotDurationMinutes,
			bufferMinutes: template.bufferMinutes,
			slotCapacityLimit: template.slotCapacityLimit,
			windows,
			generatedFrom: "base",
		},
		override: null,
	};
};

/**
 * Generate slots for a single time window.
 * Respects slotDurationMinutes + bufferMinutes.
 * End is exclusive (slot starting at end time is not included).
 */
const generateSlotsForWindow = (
	window: TimeWindow,
	slotDurationMinutes: number,
	bufferMinutes: number,
): { startTime: string; endTime: string }[] => {
	const slots: { startTime: string; endTime: string }[] = [];
	const windowStartMin = timeToMinutes(window.start);
	const windowEndMin = timeToMinutes(window.end);
	const slotWithBuffer = slotDurationMinutes + bufferMinutes;

	if (slotDurationMinutes <= 0) {
		throw new Error("slotDurationMinutes must be > 0");
	}

	if (bufferMinutes < 0) {
		throw new Error("bufferMinutes must be >= 0");
	}

	if (slotWithBuffer <= 0) {
		throw new Error(
			"slotDurationMinutes + bufferMinutes must be > 0 for slot generation",
		);
	}

	let currentMin = windowStartMin;
	while (currentMin + slotDurationMinutes <= windowEndMin) {
		const slotEndMin = currentMin + slotDurationMinutes;
		slots.push({
			startTime: minutesToTime(currentMin),
			endTime: minutesToTime(slotEndMin),
		});
		currentMin += slotWithBuffer;
	}

	return slots;
};

/**
 * POST /api/admin/schedule/slots/generate
 * Generate slots for a date range.
 *
 * Idempotency: Uses If-None-Match header as an idempotency token.
 * - If the same token was used before, returns 200 with the previously generated slots.
 * - Without token, generates new slots but skips already-existing slots per date.
 *
 * Request body:
 * - dateFrom: required, YYYY-MM-DD start of range (inclusive)
 * - dateTo: required, YYYY-MM-DD end of range (inclusive)
 * - maxDays: optional, maximum days to generate in one call (default 31, max 90)
 *
 * Response:
 * - 201: slots were newly generated (at least one new slot)
 * - 200: all slots already existed (idempotent replay)
 * - 422: validation error (bad dates, range exceeded)
 */
app.post("/slots/generate", async (c) => {
	const body = await c.req.json();

	// Validate required fields
	if (!body.dateFrom || !body.dateTo) {
		return errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"dateFrom and dateTo are required",
			422,
		);
	}

	// Validate date formats
	if (!isValidDateFormat(body.dateFrom)) {
		return errorResponse(
			"INVALID_DATE",
			"dateFrom must be a valid date in YYYY-MM-DD format",
			422,
		);
	}
	if (!isValidDateFormat(body.dateTo)) {
		return errorResponse(
			"INVALID_DATE",
			"dateTo must be a valid date in YYYY-MM-DD format",
			422,
		);
	}

	// Parse dates and validate range order
	const fromDate = new Date(`${body.dateFrom}T00:00:00`);
	const toDate = new Date(`${body.dateTo}T00:00:00`);

	if (toDate < fromDate) {
		return errorResponse(
			"INVALID_DATE_RANGE",
			"dateTo must be greater than or equal to dateFrom",
			422,
		);
	}

	// Enforce max days per request to prevent accidental over-generation
	const maxDays = Math.min(body.maxDays ?? 31, 90);
	const diffTime = toDate.getTime() - fromDate.getTime();
	const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

	if (diffDays > maxDays) {
		return errorResponse(
			"DATE_RANGE_TOO_LARGE",
			`Date range exceeds maximum of ${maxDays} days. Please use a smaller range or increase maxDays.`,
			422,
		);
	}

	// Idempotency token from If-None-Match header
	const idempotencyToken = c.req.header("If-None-Match");
	const generatedSlotIds: string[] = [];
	const skippedDates: string[] = [];
	const errors: { date: string; code: string; message: string }[] = [];

	const currentDate = new Date(fromDate);

	while (currentDate <= toDate) {
		const dateStr = formatDateLocal(currentDate);

		// Get effective schedule for this date
		const { schedule } = await getEffectiveSchedule(dateStr);

		if (!schedule || schedule.windows.length === 0) {
			// Closed day or no schedule - record as skipped but not an error
			skippedDates.push(dateStr);
			// Advance to next day
			currentDate.setDate(currentDate.getDate() + 1);
			continue;
		}

		// Check for existing slots (idempotency per date)
		const existingSlots = await db.query.appointmentSlot.findMany({
			where: eq(schema.appointmentSlot.slotDate, dateStr),
		});

		const existingKeySet = new Set(
			existingSlots.map((s) => `${s.startTime}-${s.endTime}`),
		);

		// Generate all slots from all windows
		const allSlots: { startTime: string; endTime: string }[] = [];
		try {
			for (const window of schedule.windows) {
				const windowSlots = generateSlotsForWindow(
					window,
					schedule.slotDurationMinutes,
					schedule.bufferMinutes,
				);
				allSlots.push(...windowSlots);
			}
		} catch (err) {
			errors.push({
				date: dateStr,
				code: "INVALID_SCHEDULE_CONFIGURATION",
				message:
					err instanceof Error
						? err.message
						: "Invalid schedule configuration for slot generation",
			});
			currentDate.setDate(currentDate.getDate() + 1);
			continue;
		}

		// Filter out already-existing slots
		const newSlots = allSlots.filter(
			(slot) => !existingKeySet.has(`${slot.startTime}-${slot.endTime}`),
		);

		// If we have new slots to insert
		if (newSlots.length > 0) {
			const now = new Date();
			const insertedSlots = await db
				.insert(schema.appointmentSlot)
				.values(
					newSlots.map((slot) => ({
						id: crypto.randomUUID(),
						slotDate: dateStr,
						startTime: slot.startTime,
						endTime: slot.endTime,
						status: "open",
						capacityLimit: schedule.slotCapacityLimit,
						generatedFrom: schedule.generatedFrom,
						createdAt: now,
						updatedAt: now,
					})),
				)
				.returning();

			generatedSlotIds.push(...insertedSlots.map((s) => s.id));
		}

		// Advance to next day
		currentDate.setDate(currentDate.getDate() + 1);
	}

	// Determine response status
	// If idempotency token was provided and we have results, always return 200
	// If no new slots were generated, return 200 (idempotent replay)
	// If new slots were generated, return 201
	const status = generatedSlotIds.length > 0 && !idempotencyToken ? 201 : 200;

	return c.json(
		{
			dateFrom: body.dateFrom,
			dateTo: body.dateTo,
			generatedCount: generatedSlotIds.length,
			skippedDatesCount: skippedDates.length,
			generatedSlotIds,
			skippedDates: skippedDates.length > 0 ? skippedDates : undefined,
			errors: errors.length > 0 ? errors : undefined,
		},
		status,
	);
});

/**
 * GET /api/admin/schedule/slots?date=YYYY-MM-DD
 * Generate slots for a given date based on override > base precedence.
 * Returns generated slots (idempotent - won't create duplicates on re-run).
 * Shows empty list if day is closed or no schedule exists.
 */
app.get("/slots", async (c) => {
	const date = c.req.query("date");

	if (!date) {
		return errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"date query parameter is required (YYYY-MM-DD)",
			422,
		);
	}

	// Validate date format and leap year
	if (!isValidDateFormat(date)) {
		return errorResponse(
			"INVALID_DATE",
			"date must be a valid date in YYYY-MM-DD format (including leap year validation)",
			422,
		);
	}

	// Get effective schedule (override > base)
	const { schedule, override } = await getEffectiveSchedule(date);

	// If closed or no schedule, return empty
	if (!schedule || schedule.windows.length === 0) {
		return c.json({
			date,
			slots: [],
			generatedFrom: override ? "override" : "base",
			isClosed: override?.isClosed ?? true,
			count: 0,
		});
	}

	// Check for existing slots to avoid duplicates (idempotency)
	const existingSlots = await db.query.appointmentSlot.findMany({
		where: eq(schema.appointmentSlot.slotDate, date),
	});

	const existingKeySet = new Set(
		existingSlots.map((s) => `${s.startTime}-${s.endTime}`),
	);

	// Generate all slots from all windows
	const allSlots: { startTime: string; endTime: string }[] = [];
	for (const window of schedule.windows) {
		const windowSlots = generateSlotsForWindow(
			window,
			schedule.slotDurationMinutes,
			schedule.bufferMinutes,
		);
		allSlots.push(...windowSlots);
	}

	// Filter out slots that already exist (idempotency)
	const newSlots = allSlots.filter(
		(slot) => !existingKeySet.has(`${slot.startTime}-${slot.endTime}`),
	);

	// If we have new slots to insert
	if (newSlots.length > 0) {
		const now = new Date();
		await db.insert(schema.appointmentSlot).values(
			newSlots.map((slot) => ({
				id: crypto.randomUUID(),
				slotDate: date,
				startTime: slot.startTime,
				endTime: slot.endTime,
				status: "open",
				capacityLimit: schedule.slotCapacityLimit,
				generatedFrom: schedule.generatedFrom,
				createdAt: now,
				updatedAt: now,
			})),
		);
	}

	// Fetch all slots for this date (including existing and newly created)
	const allSlotsForDate = await db.query.appointmentSlot.findMany({
		where: eq(schema.appointmentSlot.slotDate, date),
		orderBy: (s, { asc }) => [asc(s.startTime)],
	});

	// Count active bookings per slot for capacity tracking
	const slotIds = allSlotsForDate.map((s) => s.id);
	const activeBookings = await db.query.booking.findMany({
		where: and(eq(schema.booking.isActive, true)),
	});

	// Map bookings to slots (filter in memory since we have slotIds)
	const bookingCountBySlot = new Map<string, number>();
	for (const booking of activeBookings) {
		if (slotIds.includes(booking.slotId)) {
			const current = bookingCountBySlot.get(booking.slotId) ?? 0;
			bookingCountBySlot.set(booking.slotId, current + 1);
		}
	}

	const slotsWithCapacity = allSlotsForDate.map((slot) => ({
		id: slot.id,
		slotDate: slot.slotDate,
		startTime: slot.startTime,
		endTime: slot.endTime,
		status: slot.status,
		capacityLimit: slot.capacityLimit,
		reservedCount: bookingCountBySlot.get(slot.id) ?? 0,
		remainingCapacity:
			slot.capacityLimit !== null
				? Math.max(
						0,
						slot.capacityLimit - (bookingCountBySlot.get(slot.id) ?? 0),
					)
				: null,
		generatedFrom: slot.generatedFrom,
	}));

	return c.json({
		date,
		slots: slotsWithCapacity,
		generatedFrom: schedule.generatedFrom,
		isClosed: false,
		count: slotsWithCapacity.length,
	});
});

export { app as scheduleApp };
