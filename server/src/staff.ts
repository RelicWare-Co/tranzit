import { and, eq } from "drizzle-orm";
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

// =============================================================================
// WEEKLY AVAILABILITY VALIDATION
// =============================================================================

/**
 * Validates the weeklyAvailability JSON structure.
 * Expected: { "0": { "enabled": true, "morningStart": "08:00", ... }, "1": {...}, ... }
 * Weekdays are 0-6 (Sunday-Saturday).
 */
const validateWeeklyAvailability = (
	wa: unknown,
): { valid: true; parsed: Record<string, unknown> } | { valid: false; error: string } => {
	if (wa === undefined || wa === null) {
		return { valid: true, parsed: {} };
	}

	if (typeof wa !== "object" || Array.isArray(wa)) {
		return { valid: false, error: "weeklyAvailability must be an object" };
	}

	const parsed = wa as Record<string, unknown>;
	const days = Object.keys(parsed);

	for (const day of days) {
		// Check that keys are valid weekday numbers
		const dayNum = parseInt(day, 10);
		if (!isValidWeekday(dayNum)) {
			return {
				valid: false,
				error: `Invalid weekday key: ${day}. Must be 0-6.`,
			};
		}

		const dayConfig = parsed[day];
		if (typeof dayConfig !== "object" || dayConfig === null) {
			return {
				valid: false,
				error: `weeklyAvailability.${day} must be an object`,
			};
		}

		const config = dayConfig as Record<string, unknown>;

		// If enabled is present, it must be a boolean
		if (config.enabled !== undefined && typeof config.enabled !== "boolean") {
			return {
				valid: false,
				error: `weeklyAvailability.${day}.enabled must be a boolean`,
			};
		}

		// Validate time formats if present
		const timeFields = [
			"morningStart",
			"morningEnd",
			"afternoonStart",
			"afternoonEnd",
		];
		for (const field of timeFields) {
			if (config[field] !== undefined) {
				if (typeof config[field] !== "string") {
					return {
						valid: false,
						error: `weeklyAvailability.${day}.${field} must be a string`,
					};
				}
				if (!isValidTimeFormat(config[field] as string)) {
					return {
						valid: false,
						error: `weeklyAvailability.${day}.${field} must be in HH:MM format`,
					};
				}
			}
		}
	}

	return { valid: true, parsed };
};

// =============================================================================
// STAFF PROFILE CRUD
// =============================================================================

/**
 * POST /api/admin/staff
 * Create a new staff profile.
 *
 * Validation:
 * - userId: required, must exist in user table
 * - isActive: optional, defaults to true
 * - isAssignable: optional, defaults to true
 * - defaultDailyCapacity: optional, must be > 0 if provided
 * - weeklyAvailability: optional, must be valid JSON structure if provided
 */
app.post("/", async (c) => {
	const body = await c.req.json();

	// Validate required fields
	if (!body.userId) {
		return errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"userId is required",
			422,
		);
	}

	// Check if user exists
	const user = await db.query.user.findFirst({
		where: eq(schema.user.id, body.userId),
	});
	if (!user) {
		return errorResponse(
			"USER_NOT_FOUND",
			`User with id ${body.userId} does not exist`,
			422,
		);
	}

	// Check if staff profile already exists
	const existingProfile = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, body.userId),
	});
	if (existingProfile) {
		return errorResponse(
			"STAFF_PROFILE_EXISTS",
			`A staff profile for user ${body.userId} already exists`,
			409,
		);
	}

	// Validate defaultDailyCapacity > 0 if provided
	if (body.defaultDailyCapacity !== undefined) {
		const capacity = Number(body.defaultDailyCapacity);
		if (!Number.isInteger(capacity) || capacity <= 0) {
			return errorResponse(
				"INVALID_CAPACITY",
				"defaultDailyCapacity must be a positive integer",
				422,
			);
		}
	}

	// Validate weeklyAvailability structure
	const weeklyAvResult = validateWeeklyAvailability(body.weeklyAvailability);
	if (!weeklyAvResult.valid) {
		return errorResponse("INVALID_WEEKLY_AVAILABILITY", weeklyAvResult.error, 422);
	}

	const now = new Date();

	await db.insert(schema.staffProfile).values({
		userId: body.userId,
		isActive: body.isActive ?? true,
		isAssignable: body.isAssignable ?? true,
		defaultDailyCapacity: body.defaultDailyCapacity ?? 25,
		weeklyAvailability: weeklyAvResult.parsed,
		notes: body.notes ?? null,
		metadata: body.metadata ?? {},
		createdAt: now,
		updatedAt: now,
	});

	const created = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, body.userId),
	});

	// Get user details for response
	const createdWithUser = {
		...created,
		user: user
			? {
					id: user.id,
					name: user.name,
					email: user.email,
					role: user.role,
				}
			: null,
	};

	return c.json(createdWithUser, 201);
});

/**
 * GET /api/admin/staff
 * List all staff profiles, optionally filtered by isActive.
 */
app.get("/", async (c) => {
	const isActiveFilter = c.req.query("isActive");

	let profiles: Awaited<ReturnType<typeof db.query.staffProfile.findMany>>;
	if (isActiveFilter !== undefined) {
		const isActive = isActiveFilter === "true";
		profiles = await db.query.staffProfile.findMany({
			where: eq(schema.staffProfile.isActive, isActive),
			orderBy: (sp, { asc }) => [asc(sp.userId)],
		});
	} else {
		profiles = await db.query.staffProfile.findMany({
			orderBy: (sp, { asc }) => [asc(sp.userId)],
		});
	}

	// Enrich with user data
	const enrichedProfiles = await Promise.all(
		profiles.map(async (profile) => {
			const user = await db.query.user.findFirst({
				where: eq(schema.user.id, profile.userId),
			});
			return {
				...profile,
				user: user
					? {
							id: user.id,
							name: user.name,
							email: user.email,
							role: user.role,
						}
					: null,
			};
		}),
	);

	return c.json(enrichedProfiles);
});

/**
 * GET /api/admin/staff/:userId
 * Get a single staff profile by userId.
 */
app.get("/:userId", async (c) => {
	const { userId } = c.req.param();

	const profile = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, userId),
	});

	if (!profile) {
		return errorResponse("NOT_FOUND", "Staff profile not found", 404);
	}

	// Get user details
	const user = await db.query.user.findFirst({
		where: eq(schema.user.id, userId),
	});

	const enrichedProfile = {
		...profile,
		user: user
			? {
					id: user.id,
					name: user.name,
					email: user.email,
					role: user.role,
				}
			: null,
	};

	return c.json(enrichedProfile);
});

/**
 * PATCH /api/admin/staff/:userId
 * Update a staff profile.
 *
 * Validation:
 * - defaultDailyCapacity: must be > 0 if provided
 * - weeklyAvailability: must be valid JSON structure if provided
 * - isActive/isAssignable: boolean if provided
 */
app.patch("/:userId", async (c) => {
	const { userId } = c.req.param();
	const body = await c.req.json();

	// Check existence
	const existing = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, userId),
	});
	if (!existing) {
		return errorResponse("NOT_FOUND", "Staff profile not found", 404);
	}

	// Validate defaultDailyCapacity > 0 if provided
	if (body.defaultDailyCapacity !== undefined) {
		const capacity = Number(body.defaultDailyCapacity);
		if (!Number.isInteger(capacity) || capacity <= 0) {
			return errorResponse(
				"INVALID_CAPACITY",
				"defaultDailyCapacity must be a positive integer",
				422,
			);
		}
	}

	// Validate weeklyAvailability structure if provided
	if (body.weeklyAvailability !== undefined) {
		const weeklyAvResult = validateWeeklyAvailability(body.weeklyAvailability);
		if (!weeklyAvResult.valid) {
			return errorResponse(
				"INVALID_WEEKLY_AVAILABILITY",
				weeklyAvResult.error,
				422,
			);
		}
	}

	// Validate isActive and isAssignable are booleans if provided
	if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
		return errorResponse(
			"INVALID_FIELD_TYPE",
			"isActive must be a boolean",
			422,
		);
	}
	if (body.isAssignable !== undefined && typeof body.isAssignable !== "boolean") {
		return errorResponse(
			"INVALID_FIELD_TYPE",
			"isAssignable must be a boolean",
			422,
		);
	}

	// Build update object
	const updates: Partial<typeof schema.staffProfile.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (body.isActive !== undefined) updates.isActive = body.isActive;
	if (body.isAssignable !== undefined) updates.isAssignable = body.isAssignable;
	if (body.defaultDailyCapacity !== undefined)
		updates.defaultDailyCapacity = body.defaultDailyCapacity;
	if (body.weeklyAvailability !== undefined) {
		const weeklyAvResult = validateWeeklyAvailability(body.weeklyAvailability);
		// Already validated above, so we know it's valid
		if (weeklyAvResult.valid) {
			updates.weeklyAvailability = weeklyAvResult.parsed as Record<string, unknown>;
		}
	}
	if (body.notes !== undefined) updates.notes = body.notes;
	if (body.metadata !== undefined) updates.metadata = body.metadata;

	await db
		.update(schema.staffProfile)
		.set(updates)
		.where(eq(schema.staffProfile.userId, userId));

	const updated = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, userId),
	});

	// Get user details
	const user = await db.query.user.findFirst({
		where: eq(schema.user.id, userId),
	});

	const enrichedProfile = {
		...updated,
		user: user
			? {
					id: user.id,
					name: user.name,
					email: user.email,
					role: user.role,
				}
			: null,
	};

	return c.json(enrichedProfile);
});

/**
 * DELETE /api/admin/staff/:userId
 * Delete a staff profile.
 */
app.delete("/:userId", async (c) => {
	const { userId } = c.req.param();

	const existing = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, userId),
	});
	if (!existing) {
		return errorResponse("NOT_FOUND", "Staff profile not found", 404);
	}

	// Check for active bookings associated with this staff
	const activeBookings = await db.query.booking.findMany({
		where: and(
			eq(schema.booking.staffUserId, userId),
			eq(schema.booking.isActive, true),
		),
	});
	if (activeBookings.length > 0) {
		return errorResponse(
			"STAFF_HAS_ACTIVE_BOOKINGS",
			"Cannot delete staff profile with active bookings. Please reassign or cancel them first.",
			409,
		);
	}

	await db
		.delete(schema.staffProfile)
		.where(eq(schema.staffProfile.userId, userId));

	return c.body(null, 204);
});

// =============================================================================
// STAFF DATE OVERRIDE CRUD
// =============================================================================

/**
 * POST /api/admin/staff/:userId/date-overrides
 * Create a new date override for a staff member.
 *
 * Validation:
 * - overrideDate: required, valid YYYY-MM-DD format
 * - isAvailable: optional, defaults to true
 * - capacityOverride: optional, must be > 0 if provided
 * - availableStartTime/availableEndTime: optional, must be valid HH:MM if provided
 * - availableEndTime > availableStartTime if both provided
 *
 * This performs an UPSERT to handle the uniqueness constraint.
 */
app.post("/:userId/date-overrides", async (c) => {
	const { userId } = c.req.param();
	const body = await c.req.json();

	// Check staff profile exists
	const staffProfile = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, userId),
	});
	if (!staffProfile) {
		return errorResponse("NOT_FOUND", "Staff profile not found", 404);
	}

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

	// Validate capacityOverride > 0 if provided
	if (body.capacityOverride !== undefined) {
		const capacity = Number(body.capacityOverride);
		if (!Number.isInteger(capacity) || capacity <= 0) {
			return errorResponse(
				"INVALID_CAPACITY",
				"capacityOverride must be a positive integer",
				422,
			);
		}
	}

	// Validate time formats
	const availableStartTime = body.availableStartTime;
	const availableEndTime = body.availableEndTime;

	if (!isValidTimeFormat(availableStartTime)) {
		return errorResponse(
			"INVALID_TIME_FORMAT",
			"availableStartTime must be in HH:MM format",
			422,
		);
	}
	if (!isValidTimeFormat(availableEndTime)) {
		return errorResponse(
			"INVALID_TIME_FORMAT",
			"availableEndTime must be in HH:MM format",
			422,
		);
	}

	// Validate time window
	if (availableStartTime && availableEndTime) {
		if (!isValidTimeWindow(availableStartTime, availableEndTime)) {
			return errorResponse(
				"INVALID_TIME_WINDOW",
				"availableEndTime must be after availableStartTime",
				422,
			);
		}
	}

	// If isAvailable=false, we shouldn't also provide time windows (contradictory)
	if (body.isAvailable === false && (availableStartTime || availableEndTime)) {
		return errorResponse(
			"INVALID_OVERRIDE_STATE",
			"Cannot set time windows when isAvailable=false",
			422,
		);
	}

	const now = new Date();
	const actorUserId = c.get("user")?.id ?? null;

	// Check if override already exists for this staff+date
	const existingOverride = await db.query.staffDateOverride.findFirst({
		where: and(
			eq(schema.staffDateOverride.staffUserId, userId),
			eq(schema.staffDateOverride.overrideDate, body.overrideDate),
		),
	});

	if (existingOverride) {
		// Perform upsert
		const updates: Partial<typeof schema.staffDateOverride.$inferInsert> = {
			updatedAt: now,
		};

		if (body.isAvailable !== undefined)
			updates.isAvailable = body.isAvailable;
		if (body.capacityOverride !== undefined)
			updates.capacityOverride = body.capacityOverride;
		if (body.availableStartTime !== undefined)
			updates.availableStartTime = body.availableStartTime;
		if (body.availableEndTime !== undefined)
			updates.availableEndTime = body.availableEndTime;
		if (body.notes !== undefined) updates.notes = body.notes;

		await db
			.update(schema.staffDateOverride)
			.set(updates)
			.where(eq(schema.staffDateOverride.id, existingOverride.id));

		const updated = await db.query.staffDateOverride.findFirst({
			where: eq(schema.staffDateOverride.id, existingOverride.id),
		});

		return c.json(updated);
	}

	// Create new override
	const id = crypto.randomUUID();

	await db.insert(schema.staffDateOverride).values({
		id,
		staffUserId: userId,
		overrideDate: body.overrideDate,
		isAvailable: body.isAvailable ?? true,
		capacityOverride: body.capacityOverride ?? null,
		availableStartTime: availableStartTime ?? null,
		availableEndTime: availableEndTime ?? null,
		notes: body.notes ?? null,
		createdByUserId: actorUserId,
		createdAt: now,
		updatedAt: now,
	});

	const created = await db.query.staffDateOverride.findFirst({
		where: eq(schema.staffDateOverride.id, id),
	});

	return c.json(created, 201);
});

/**
 * GET /api/admin/staff/:userId/date-overrides
 * List date overrides for a staff member, optionally filtered by date.
 */
app.get("/:userId/date-overrides", async (c) => {
	const { userId } = c.req.param();
	const date = c.req.query("date");

	// Check staff profile exists
	const staffProfile = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, userId),
	});
	if (!staffProfile) {
		return errorResponse("NOT_FOUND", "Staff profile not found", 404);
	}

	let overrides: Awaited<ReturnType<typeof db.query.staffDateOverride.findMany>>;
	if (date) {
		if (!isValidDateFormat(date)) {
			return errorResponse(
				"INVALID_DATE",
				"date query parameter must be a valid date in YYYY-MM-DD format",
				422,
			);
		}
		overrides = await db.query.staffDateOverride.findMany({
			where: and(
				eq(schema.staffDateOverride.staffUserId, userId),
				eq(schema.staffDateOverride.overrideDate, date),
			),
		});
	} else {
		overrides = await db.query.staffDateOverride.findMany({
			where: eq(schema.staffDateOverride.staffUserId, userId),
			orderBy: (o, { asc }) => [asc(o.overrideDate)],
		});
	}

	return c.json(overrides);
});

/**
 * GET /api/admin/staff/:userId/date-overrides/:overrideId
 * Get a single date override by ID.
 */
app.get("/:userId/date-overrides/:overrideId", async (c) => {
	const { userId, overrideId } = c.req.param();

	// Check staff profile exists
	const staffProfile = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, userId),
	});
	if (!staffProfile) {
		return errorResponse("NOT_FOUND", "Staff profile not found", 404);
	}

	const override = await db.query.staffDateOverride.findFirst({
		where: and(
			eq(schema.staffDateOverride.id, overrideId),
			eq(schema.staffDateOverride.staffUserId, userId),
		),
	});

	if (!override) {
		return errorResponse("NOT_FOUND", "Staff date override not found", 404);
	}

	return c.json(override);
});

/**
 * PATCH /api/admin/staff/:userId/date-overrides/:overrideId
 * Update a date override.
 */
app.patch("/:userId/date-overrides/:overrideId", async (c) => {
	const { userId, overrideId } = c.req.param();
	const body = await c.req.json();

	// Check staff profile exists
	const staffProfile = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, userId),
	});
	if (!staffProfile) {
		return errorResponse("NOT_FOUND", "Staff profile not found", 404);
	}

	// Check override exists
	const existing = await db.query.staffDateOverride.findFirst({
		where: and(
			eq(schema.staffDateOverride.id, overrideId),
			eq(schema.staffDateOverride.staffUserId, userId),
		),
	});
	if (!existing) {
		return errorResponse("NOT_FOUND", "Staff date override not found", 404);
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
		// Check uniqueness if changing date (excluding current record)
		if (body.overrideDate !== existing.overrideDate) {
			const conflict = await db.query.staffDateOverride.findFirst({
				where: and(
					eq(schema.staffDateOverride.staffUserId, userId),
					eq(schema.staffDateOverride.overrideDate, body.overrideDate),
				),
			});
			if (conflict) {
				return errorResponse(
					"DUPLICATE_OVERRIDE_DATE",
					`An override for date ${body.overrideDate} already exists for this staff member`,
					409,
				);
			}
		}
	}

	// Validate capacityOverride > 0 if provided
	if (body.capacityOverride !== undefined) {
		const capacity = Number(body.capacityOverride);
		if (!Number.isInteger(capacity) || capacity <= 0) {
			return errorResponse(
				"INVALID_CAPACITY",
				"capacityOverride must be a positive integer",
				422,
			);
		}
	}

	// Validate time formats
	const availableStartTime = body.availableStartTime ?? existing.availableStartTime;
	const availableEndTime = body.availableEndTime ?? existing.availableEndTime;

	if (!isValidTimeFormat(body.availableStartTime ?? null)) {
		return errorResponse(
			"INVALID_TIME_FORMAT",
			"availableStartTime must be in HH:MM format",
			422,
		);
	}
	if (!isValidTimeFormat(body.availableEndTime ?? null)) {
		return errorResponse(
			"INVALID_TIME_FORMAT",
			"availableEndTime must be in HH:MM format",
			422,
		);
	}

	// Validate time window
	if (availableStartTime && availableEndTime) {
		if (!isValidTimeWindow(availableStartTime, availableEndTime)) {
			return errorResponse(
				"INVALID_TIME_WINDOW",
				"availableEndTime must be after availableStartTime",
				422,
			);
		}
	}

	// If isAvailable=false, we shouldn't also have time windows (contradictory)
	const isAvailable = body.isAvailable ?? existing.isAvailable;
	if (isAvailable === false && (availableStartTime || availableEndTime)) {
		return errorResponse(
			"INVALID_OVERRIDE_STATE",
			"Cannot set time windows when isAvailable=false",
			422,
		);
	}

	// Build update object
	const updates: Partial<typeof schema.staffDateOverride.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (body.overrideDate !== undefined) updates.overrideDate = body.overrideDate;
	if (body.isAvailable !== undefined) updates.isAvailable = body.isAvailable;
	if (body.capacityOverride !== undefined)
		updates.capacityOverride = body.capacityOverride;
	if (body.availableStartTime !== undefined)
		updates.availableStartTime = body.availableStartTime;
	if (body.availableEndTime !== undefined)
		updates.availableEndTime = body.availableEndTime;
	if (body.notes !== undefined) updates.notes = body.notes;

	await db
		.update(schema.staffDateOverride)
		.set(updates)
		.where(eq(schema.staffDateOverride.id, overrideId));

	const updated = await db.query.staffDateOverride.findFirst({
		where: eq(schema.staffDateOverride.id, overrideId),
	});

	return c.json(updated);
});

/**
 * DELETE /api/admin/staff/:userId/date-overrides/:overrideId
 * Delete a date override.
 */
app.delete("/:userId/date-overrides/:overrideId", async (c) => {
	const { userId, overrideId } = c.req.param();

	// Check staff profile exists
	const staffProfile = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, userId),
	});
	if (!staffProfile) {
		return errorResponse("NOT_FOUND", "Staff profile not found", 404);
	}

	// Check override exists
	const existing = await db.query.staffDateOverride.findFirst({
		where: and(
			eq(schema.staffDateOverride.id, overrideId),
			eq(schema.staffDateOverride.staffUserId, userId),
		),
	});
	if (!existing) {
		return errorResponse("NOT_FOUND", "Staff date override not found", 404);
	}

	await db
		.delete(schema.staffDateOverride)
		.where(eq(schema.staffDateOverride.id, overrideId));

	return c.body(null, 204);
});

// =============================================================================
// STAFF EFFECTIVE AVAILABILITY & CAPACITY
// =============================================================================

/**
 * GET /api/admin/staff/:userId/effective-availability?date=YYYY-MM-DD
 *
 * Returns the effective availability and capacity for a staff member on a given date.
 * Resolution order:
 * 1. If staff is inactive (isActive=false) -> unavailable
 * 2. If staff is not assignable (isAssignable=false) -> unavailable
 * 3. If staff_date_override exists for date:
 *    - If isAvailable=false -> unavailable
 *    - If isAvailable=true with time window -> only that window
 *    - capacityOverride if present overrides defaultDailyCapacity
 * 4. Fall back to weeklyAvailability from profile, then to defaultDailyCapacity
 *
 * Timezone: Uses the date parameter as-is (assumes local/Colombia timezone for this system)
 */
app.get("/:userId/effective-availability", async (c) => {
	const { userId } = c.req.param();
	const date = c.req.query("date");

	if (!date) {
		return errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"date query parameter is required (YYYY-MM-DD)",
			422,
		);
	}

	// Validate date format
	if (!isValidDateFormat(date)) {
		return errorResponse(
			"INVALID_DATE",
			"date must be a valid date in YYYY-MM-DD format",
			422,
		);
	}

	// Get staff profile
	const staffProfile = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, userId),
	});
	if (!staffProfile) {
		return errorResponse("NOT_FOUND", "Staff profile not found", 404);
	}

	// Step 1 & 2: Check isActive and isAssignable
	const isActive = staffProfile.isActive;
	const isAssignable = staffProfile.isAssignable;

	if (!isActive || !isAssignable) {
		return c.json({
			userId,
			date,
			isAvailable: false,
			reason: !isActive ? "STAFF_INACTIVE" : "STAFF_NOT_ASSIGNABLE",
			dailyCapacity: 0,
			availableWindow: null,
		});
	}

	// Step 3: Check for date override
	const override = await db.query.staffDateOverride.findFirst({
		where: and(
			eq(schema.staffDateOverride.staffUserId, userId),
			eq(schema.staffDateOverride.overrideDate, date),
		),
	});

	if (override) {
		if (!override.isAvailable) {
			return c.json({
				userId,
				date,
				isAvailable: false,
				reason: "DATE_OVERRIDE_UNAVAILABLE",
				dailyCapacity: 0,
				availableWindow: null,
			});
		}

		// Has override with isAvailable=true
		const effectiveCapacity =
			override.capacityOverride ?? staffProfile.defaultDailyCapacity;
		const window =
			override.availableStartTime && override.availableEndTime
				? {
						start: override.availableStartTime,
						end: override.availableEndTime,
					}
				: null;

		return c.json({
			userId,
			date,
			isAvailable: true,
			reason: "DATE_OVERRIDE",
			dailyCapacity: effectiveCapacity,
			availableWindow: window,
		});
	}

	// Step 4: Fall back to weeklyAvailability
	const weekday = new Date(`${date}T00:00:00`).getDay();
	const weeklyAv = (staffProfile.weeklyAvailability ??
		{}) as Record<string, { enabled?: boolean; morningStart?: string; morningEnd?: string; afternoonStart?: string; afternoonEnd?: string }>;
	const dayConfig = weeklyAv[String(weekday)];

	// Default: fully available with defaultDailyCapacity
	if (!dayConfig || dayConfig.enabled !== false) {
		return c.json({
			userId,
			date,
			isAvailable: true,
			reason: "DEFAULT",
			dailyCapacity: staffProfile.defaultDailyCapacity,
			availableWindow: null, // Full day
		});
	}

	// Day is disabled in weekly availability
	if (dayConfig.enabled === false) {
		return c.json({
			userId,
			date,
			isAvailable: false,
			reason: "WEEKLY_AVAILABILITY_DISABLED",
			dailyCapacity: 0,
			availableWindow: null,
		});
	}

	// Day has specific windows configured
	const window =
		(dayConfig.morningStart &&
		dayConfig.morningEnd &&
		dayConfig.afternoonStart &&
		dayConfig.afternoonEnd
			? {
					morning: { start: dayConfig.morningStart, end: dayConfig.morningEnd },
					afternoon: {
						start: dayConfig.afternoonStart,
						end: dayConfig.afternoonEnd,
					},
				}
			: dayConfig.morningStart && dayConfig.morningEnd
				? { start: dayConfig.morningStart, end: dayConfig.morningEnd }
				: null);

	return c.json({
		userId,
		date,
		isAvailable: true,
		reason: "WEEKLY_AVAILABILITY",
		dailyCapacity: staffProfile.defaultDailyCapacity,
		availableWindow: window,
	});
});

/**
 * Helper to check if a slot time falls within staff's available window on a given date.
 * Used by booking logic to validate staff assignment.
 */
export const isSlotWithinStaffAvailability = async (
	staffUserId: string,
	date: string,
	slotStartTime: string,
	slotEndTime: string,
): Promise<{
	available: boolean;
	reason?: string;
}> => {
	// Get effective availability
	const result = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, staffUserId),
	});

	if (!result) {
		return { available: false, reason: "STAFF_NOT_FOUND" };
	}

	if (!result.isActive) {
		return { available: false, reason: "STAFF_INACTIVE" };
	}

	if (!result.isAssignable) {
		return { available: false, reason: "STAFF_NOT_ASSIGNABLE" };
	}

	// Check date override
	const override = await db.query.staffDateOverride.findFirst({
		where: and(
			eq(schema.staffDateOverride.staffUserId, staffUserId),
			eq(schema.staffDateOverride.overrideDate, date),
		),
	});

	if (override) {
		if (!override.isAvailable) {
			return { available: false, reason: "STAFF_UNAVAILABLE_ON_DATE" };
		}

		// Check time window if present
		if (override.availableStartTime && override.availableEndTime) {
			if (slotStartTime < override.availableStartTime) {
				return { available: false, reason: "STAFF_OUTSIDE_AVAILABLE_WINDOW" };
			}
			if (slotEndTime > override.availableEndTime) {
				return { available: false, reason: "STAFF_OUTSIDE_AVAILABLE_WINDOW" };
			}
		}

		return { available: true };
	}

	// Check weekly availability
	const weekday = new Date(`${date}T00:00:00`).getDay();
	const weeklyAv = (result.weeklyAvailability ??
		{}) as Record<string, { enabled?: boolean; morningStart?: string; morningEnd?: string; afternoonStart?: string; afternoonEnd?: string }>;
	const dayConfig = weeklyAv[String(weekday)];

	if (dayConfig && dayConfig.enabled === false) {
		return { available: false, reason: "STAFF_WEEKLY_UNAVAILABLE" };
	}

	// If dayConfig has specific windows, check against them
	if (dayConfig && (dayConfig.morningStart || dayConfig.afternoonStart)) {
		// Check if slot is within morning or afternoon windows
		const inMorning =
			dayConfig.morningStart &&
			dayConfig.morningEnd &&
			slotStartTime >= dayConfig.morningStart &&
			slotEndTime <= dayConfig.morningEnd;
		const inAfternoon =
			dayConfig.afternoonStart &&
			dayConfig.afternoonEnd &&
			slotStartTime >= dayConfig.afternoonStart &&
			slotEndTime <= dayConfig.afternoonEnd;

		if (!inMorning && !inAfternoon) {
			return { available: false, reason: "STAFF_OUTSIDE_AVAILABLE_WINDOW" };
		}
	}

	return { available: true };
};

/**
 * Get the effective daily capacity for a staff member on a given date.
 * Used by booking logic to track capacity consumption.
 */
export const getEffectiveDailyCapacity = async (
	staffUserId: string,
	date: string,
): Promise<number> => {
	// Get staff profile
	const profile = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, staffUserId),
	});

	if (!profile) {
		return 0;
	}

	// Check if inactive
	if (!profile.isActive || !profile.isAssignable) {
		return 0;
	}

	// Check date override
	const override = await db.query.staffDateOverride.findFirst({
		where: and(
			eq(schema.staffDateOverride.staffUserId, staffUserId),
			eq(schema.staffDateOverride.overrideDate, date),
		),
	});

	if (override) {
		if (!override.isAvailable) {
			return 0;
		}
		return override.capacityOverride ?? profile.defaultDailyCapacity;
	}

	// Check weekly availability
	const weekday = new Date(`${date}T00:00:00`).getDay();
	const weeklyAv = (profile.weeklyAvailability ??
		{}) as Record<string, { enabled?: boolean }>;
	const dayConfig = weeklyAv[String(weekday)];

	if (dayConfig && dayConfig.enabled === false) {
		return 0;
	}

	return profile.defaultDailyCapacity;
};

export { app as staffApp };
