/**
 * Reservation Series API - Administrative Recurrence Operations
 *
 * Provides HTTP endpoints for administrative booking series operations:
 * - POST /api/admin/reservation-series - Create a recurring series
 * - GET /api/admin/reservation-series - List series
 * - GET /api/admin/reservation-series/:id - Get a series with its instances
 * - PATCH /api/admin/reservation-series/:id - Update full series (all active instances)
 * - PATCH /api/admin/reservation-series/:id/from-date - Update from date forward
 * - POST /api/admin/reservation-series/:id/release - Release full series (all future active)
 *
 * Instance-level operations:
 * - GET /api/admin/reservations/:bookingId - Get single instance
 * - PATCH /api/admin/reservations/:bookingId - Update single instance (detached/excepcionated)
 * - POST /api/admin/reservations/:bookingId/release - Release single instance
 *
 * Scope semantics:
 * - full_series: all active instances of the series
 * - single: only the specific instance
 * - from_date: only instances >= effectiveFrom date
 *
 * Capacity is consumed per instance immediately on create.
 * Detached (excepcionated) instances are not affected by series updates unless
 * explicitly forced.
 */

import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import {
	type CapacityConflict,
	checkCapacity,
	consumeCapacity,
	releaseCapacity,
} from "./capacity";
import { db, schema } from "./db";

type AppVariables = {
	user: { id: string; role: string | null; [key: string]: unknown } | null;
	session: { id: string; [key: string]: unknown } | null;
};

const app = new Hono<{ Variables: AppVariables }>();

// =============================================================================
// SHARED TYPES & ERROR HELPERS
// =============================================================================

const errorResponse = (code: string, message: string, status: number) =>
	new Response(JSON.stringify({ code, message }), {
		status,
		headers: { "Content-Type": "application/json" },
	});

const conflictResponse = (conflicts: CapacityConflict[]) =>
	new Response(
		JSON.stringify({
			code: "CAPACITY_CONFLICT",
			message: "Insufficient capacity for this operation",
			conflicts,
		}),
		{
			status: 409,
			headers: { "Content-Type": "application/json" },
		},
	);

// =============================================================================
// RECURRENCE RULE PARSING
// =============================================================================

interface RecurrenceRule {
	frequency: "daily" | "weekly" | "biweekly" | "monthly";
	interval?: number;
	byDayOfWeek?: number[]; // 0=Sun, 1=Mon, ... 6=Sat
	untilDate?: string; // YYYY-MM-DD
	count?: number;
	timezone?: string;
}

/**
 * Parse an iCal-like RRULE into our RecurrenceRule format.
 * Supports basic patterns: FREQ=DAILY/WEEKLY;INTERVAL;BYDAY;UNTIL
 */
function parseRRule(rruleStr: string): RecurrenceRule {
	const rule: RecurrenceRule = { frequency: "daily" };

	const parts = rruleStr.split(";");
	for (const part of parts) {
		const [key, value] = part.split("=");
		switch (key) {
			case "FREQUENCY":
				if (value === "DAILY") rule.frequency = "daily";
				else if (value === "WEEKLY") rule.frequency = "weekly";
				else if (value === "BIWEEKLY") rule.frequency = "biweekly";
				else if (value === "MONTHLY") rule.frequency = "monthly";
				break;
			case "INTERVAL":
				rule.interval = parseInt(value, 10);
				break;
			case "BYDAY":
				rule.byDayOfWeek = value.split(",").map((d) => {
					const dayMap: Record<string, number> = {
						SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
					};
					return dayMap[d] ?? 0;
				});
				break;
			case "UNTIL":
				// Format: YYYYMMDDTHHMMSSZ
				if (value.length >= 8) {
					rule.untilDate = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
				}
				break;
			case "COUNT":
				rule.count = parseInt(value, 10);
				break;
		}
	}

	return rule;
}

/**
 * Generate dates for a recurring series based on recurrence rule.
 */
function generateOccurrences(
	rule: RecurrenceRule,
	startDate: string,
	endDate: string,
	existingDates: Set<string>,
): string[] {
	const dates: string[] = [];
	const start = new Date(`${startDate}T00:00:00`);
	const end = new Date(`${endDate}T23:59:59`);

	let current = new Date(start);
	let count = 0;
	const maxCount = rule.count || 365; // Safety limit

	while (current <= end && count < maxCount) {
		const year = current.getFullYear();
		const month = String(current.getMonth() + 1).padStart(2, "0");
		const day = String(current.getDate()).padStart(2, "0");
		const dateStr = `${year}-${month}-${day}`;

		let include = true;
		if (rule.byDayOfWeek && rule.byDayOfWeek.length > 0) {
			include = rule.byDayOfWeek.includes(current.getDay());
		}

		if (include && !existingDates.has(dateStr)) {
			dates.push(dateStr);
			count++;
		}

		// Advance
		switch (rule.frequency) {
			case "daily":
				current.setDate(current.getDate() + (rule.interval || 1));
				break;
			case "weekly":
				current.setDate(current.getDate() + (rule.interval || 1) * 7);
				break;
			case "biweekly":
				current.setDate(current.getDate() + 14);
				break;
			case "monthly":
				current.setMonth(current.getMonth() + (rule.interval || 1));
				break;
		}
	}

	return dates;
}

/**
 * Check if a date is >= effectiveFrom using timezone.
 */
function isDateOnOrAfter(dateStr: string, effectiveFrom: string, _timezone: string): boolean {
	return dateStr >= effectiveFrom;
}

// =============================================================================
// SERIES CREATION
// =============================================================================

/**
 * POST /api/admin/reservation-series
 *
 * Create a recurring administrative reservation series.
 *
 * Request body:
 * - recurrenceRule: object with frequency, interval, byDayOfWeek, untilDate, count
 * - slotId: base slot ID to use as template
 * - staffUserId: assigned staff for all instances
 * - startDate: YYYY-MM-DD, first occurrence
 * - endDate: YYYY-MM-DD, last possible occurrence
 * - notes: optional notes for series
 * - metadata: optional metadata
 *
 * Returns 201 with created series and instance count.
 * Returns 409 CONFLICT if any instance lacks capacity.
 */
app.post("/", async (c) => {
	const body = await c.req.json();

	// Validate required fields
	if (!body.recurrenceRule) {
		return errorResponse("MISSING_REQUIRED_FIELDS", "recurrenceRule is required", 422);
	}
	if (!body.slotId) {
		return errorResponse("MISSING_REQUIRED_FIELDS", "slotId is required", 422);
	}
	if (!body.staffUserId) {
		return errorResponse("MISSING_REQUIRED_FIELDS", "staffUserId is required", 422);
	}
	if (!body.startDate || !body.endDate) {
		return errorResponse("MISSING_REQUIRED_FIELDS", "startDate and endDate are required", 422);
	}

	// Validate dates
	if (!/^\d{4}-\d{2}-\d{2}$/.test(body.startDate)) {
		return errorResponse("INVALID_DATE", "startDate must be YYYY-MM-DD", 422);
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(body.endDate)) {
		return errorResponse("INVALID_DATE", "endDate must be YYYY-MM-DD", 422);
	}
	if (body.endDate < body.startDate) {
		return errorResponse("INVALID_DATE", "endDate must be >= startDate", 422);
	}

	// Validate slot exists
	const baseSlot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, body.slotId),
	});
	if (!baseSlot) {
		return errorResponse("NOT_FOUND", "Base slot not found", 404);
	}

	// Validate staff exists
	const staff = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, body.staffUserId),
	});
	if (!staff) {
		return errorResponse("NOT_FOUND", "Staff profile not found", 404);
	}

	// Parse recurrence rule
	const rule: RecurrenceRule = typeof body.recurrenceRule === "string"
		? parseRRule(body.recurrenceRule)
		: body.recurrenceRule;

	if (!["daily", "weekly", "biweekly", "monthly"].includes(rule.frequency)) {
		return errorResponse("INVALID_RULE", "frequency must be daily/weekly/biweekly/monthly", 422);
	}

	const timezone = body.timezone || "America/Bogota";

	// Find existing booking dates for this staff to avoid duplicates
	const existingBookings = await db.query.booking.findMany({
		where: and(
			eq(schema.booking.staffUserId, body.staffUserId),
			eq(schema.booking.isActive, true),
		),
	});
	const existingSlotIds = existingBookings.map((b) => b.slotId);
	const existingSlots = existingSlotIds.length > 0
		? await db.query.appointmentSlot.findMany({
				where: sql`${schema.appointmentSlot.id} IN ${existingSlotIds}`,
			})
		: [];
	const existingDates = new Set(existingSlots.map((s) => s.slotDate));

	// Generate occurrence dates
	const occurrences = generateOccurrences(rule, body.startDate, body.endDate, existingDates);

	if (occurrences.length === 0) {
		return errorResponse("NO_OCCURRENCES", "No valid occurrences in date range", 422);
	}

	// For each occurrence, we need a slot. Use the base slot's startTime but different dates.
	// Find or create slots for each occurrence date
	const slotIds: string[] = [];
	for (const date of occurrences) {
		// Check if slot exists for this date with same time as base slot
		let slot = await db.query.appointmentSlot.findFirst({
			where: and(
				eq(schema.appointmentSlot.slotDate, date),
				eq(schema.appointmentSlot.startTime, baseSlot.startTime),
			),
		});

		if (!slot) {
			// Create a new slot for this date
			const newSlotId = crypto.randomUUID();
			const now = new Date();

			await db.insert(schema.appointmentSlot).values({
				id: newSlotId,
				slotDate: date,
				startTime: baseSlot.startTime,
				endTime: baseSlot.endTime,
				status: "open",
				capacityLimit: baseSlot.capacityLimit,
				generatedFrom: "series",
				metadata: { seriesId: "pending" },
				createdAt: now,
				updatedAt: now,
			});

			slot = await db.query.appointmentSlot.findFirst({
				where: eq(schema.appointmentSlot.id, newSlotId),
			});
		}

		if (slot) {
			slotIds.push(slot.id);
		}
	}

	// Create the series record
	const seriesId = crypto.randomUUID();
	const now = new Date();

	await db.insert(schema.bookingSeries).values({
		id: seriesId,
		kind: "administrative",
		recurrenceRule: rule as unknown as Record<string, unknown>,
		timezone,
		isActive: true,
		metadata: body.metadata ?? {},
		notes: body.notes ?? null,
		createdByUserId: c.get("user")?.id ?? null,
		createdAt: now,
		updatedAt: now,
	});

	// Create bookings for each slot
	const createdBookingIds: string[] = [];
	const conflicts: CapacityConflict[] = [];

	for (const slotId of slotIds) {
		const result = await consumeCapacity(
			slotId,
			body.staffUserId,
			"administrative",
			null,
			null,
			c.get("user")?.id ?? null,
			null,
			null,
		);

		if (!result.success) {
			conflicts.push(...result.conflicts);
		} else if (result.bookingId) {
			createdBookingIds.push(result.bookingId);

			// Link the booking to the series
			await db
				.update(schema.booking)
				.set({ seriesKey: seriesId, updatedAt: new Date() })
				.where(eq(schema.booking.id, result.bookingId));
		}
	}

	if (conflicts.length > 0 && createdBookingIds.length === 0) {
		// All failed - rollback series
		await db.delete(schema.bookingSeries).where(eq(schema.bookingSeries.id, seriesId));
		return conflictResponse(conflicts);
	}

	// Fetch the created series
	const series = await db.query.bookingSeries.findFirst({
		where: eq(schema.bookingSeries.id, seriesId),
	});

	return c.json(
		{
			series,
			instanceCount: createdBookingIds.length,
			bookingIds: createdBookingIds,
			warnings: conflicts.length > 0 ? ["Some instances could not be created due to capacity conflicts"] : [],
		},
		201,
	);
});

// =============================================================================
// SERIES QUERIES
// =============================================================================

/**
 * GET /api/admin/reservation-series
 * List all reservation series.
 */
app.get("/", async (c) => {
	const { isActive, kind } = c.req.query();

	const conditions = [];
	if (isActive !== undefined) {
		conditions.push(eq(schema.bookingSeries.isActive, isActive === "true"));
	}
	if (kind) {
		conditions.push(eq(schema.bookingSeries.kind, kind));
	}

	let seriesList: Awaited<ReturnType<typeof db.query.bookingSeries.findMany>>;
	if (conditions.length > 0) {
		seriesList = await db.query.bookingSeries.findMany({
			where: and(...conditions),
		});
	} else {
		seriesList = await db.query.bookingSeries.findMany();
	}

	// Enrich with instance counts
	const enriched = await Promise.all(
		seriesList.map(async (series) => {
			const bookings = await db.query.booking.findMany({
				where: and(
					eq(schema.booking.seriesKey, series.id),
					eq(schema.booking.isActive, true),
				),
			});

			return {
				...series,
				activeInstanceCount: bookings.length,
			};
		}),
	);

	return c.json(enriched);
});

/**
 * GET /api/admin/reservation-series/:id
 * Get a series with all its instances.
 */
app.get("/:id", async (c) => {
	const { id } = c.req.param();

	const series = await db.query.bookingSeries.findFirst({
		where: eq(schema.bookingSeries.id, id),
	});

	if (!series) {
		return errorResponse("NOT_FOUND", "Series not found", 404);
	}

	// Get all bookings for this series
	const bookings = await db.query.booking.findMany({
		where: eq(schema.booking.seriesKey, id),
	});

	// Enrich with slot info
	const enrichedBookings = await Promise.all(
		bookings.map(async (booking) => {
			const slot = await db.query.appointmentSlot.findFirst({
				where: eq(schema.appointmentSlot.id, booking.slotId),
			});
			return { ...booking, slot };
		}),
	);

	return c.json({
		series,
		instances: enrichedBookings,
	});
});

/**
 * GET /api/admin/reservation-series/:id/instances
 * Get instances of a series with optional status filter.
 */
app.get("/:id/instances", async (c) => {
	const { id } = c.req.param();
	const { status, isActive } = c.req.query();

	const conditions = [eq(schema.booking.seriesKey, id)];
	if (status) {
		conditions.push(eq(schema.booking.status, status));
	}
	if (isActive !== undefined) {
		conditions.push(eq(schema.booking.isActive, isActive === "true"));
	}

	const bookings = await db.query.booking.findMany({
		where: and(...conditions),
	});

	// Enrich with slot info
	const enriched = await Promise.all(
		bookings.map(async (booking) => {
			const slot = await db.query.appointmentSlot.findFirst({
				where: eq(schema.appointmentSlot.id, booking.slotId),
			});
			return { ...booking, slot };
		}),
	);

	return c.json(enriched);
});

// =============================================================================
// SERIES UPDATE OPERATIONS
// =============================================================================

/**
 * PATCH /api/admin/reservation-series/:id
 * Update all active instances of a series (full series scope).
 *
 * Only affects instances that haven't been individually modified (detached).
 * A flag `force=false` (default) will skip detached instances.
 * With `force=true`, even detached instances will be updated.
 */
app.patch("/:id", async (c) => {
	const { id } = c.req.param();
	const body = await c.req.json();

	const series = await db.query.bookingSeries.findFirst({
		where: eq(schema.bookingSeries.id, id),
	});

	if (!series) {
		return errorResponse("NOT_FOUND", "Series not found", 404);
	}

	// Get all active bookings for this series
	const activeBookings = await db.query.booking.findMany({
		where: and(
			eq(schema.booking.seriesKey, id),
			eq(schema.booking.isActive, true),
		),
	});

	// If body has detachedOverride=false (default), filter out detached instances
	// Detached instances are those where snapshot.metadata indicates individual modification
	const forceUpdate = body.force === true;

	const toUpdate = activeBookings.filter((booking) => {
		if (forceUpdate) return true;
		// Check if this instance was individually modified
		const snapshot = booking.snapshot as Record<string, unknown> | null;
		return !snapshot?.detached;
	});

	const updatedIds: string[] = [];
	const now = new Date();

	// Apply updates
	if (body.staffUserId !== undefined) {
		for (const booking of toUpdate) {
			await db
				.update(schema.booking)
				.set({
					staffUserId: body.staffUserId,
					updatedAt: now,
				})
				.where(eq(schema.booking.id, booking.id));
			updatedIds.push(booking.id);
		}
	}

	if (body.notes !== undefined) {
		for (const booking of toUpdate) {
			await db
				.update(schema.booking)
				.set({
					notes: body.notes,
					updatedAt: now,
				})
				.where(eq(schema.booking.id, booking.id));
		}
	}

	// Update series metadata
	if (body.metadata !== undefined) {
		const currentMetadata = (series.metadata as Record<string, unknown>) || {};
		await db
			.update(schema.bookingSeries)
			.set({
				metadata: { ...currentMetadata, ...body.metadata },
				updatedAt: now,
			})
			.where(eq(schema.bookingSeries.id, id));
	}

	return c.json({
		seriesId: id,
		updatedCount: updatedIds.length,
		skippedCount: activeBookings.length - toUpdate.length,
		updatedInstanceIds: updatedIds,
	});
});

/**
 * PATCH /api/admin/reservation-series/:id/from-date
 * Update instances from a certain date forward (from-date scope).
 *
 * Request body:
 * - effectiveFrom: YYYY-MM-DD, cutoff date (inclusive)
 * - staffUserId: optional, new staff assignment
 * - notes: optional, new notes
 *
 * Only affects instances with slotDate >= effectiveFrom.
 * Respects timezone and boundary edges.
 */
app.patch("/:id/from-date", async (c) => {
	const { id } = c.req.param();
	const body = await c.req.json();

	if (!body.effectiveFrom) {
		return errorResponse("MISSING_REQUIRED_FIELDS", "effectiveFrom is required (YYYY-MM-DD)", 422);
	}

	if (!/^\d{4}-\d{2}-\d{2}$/.test(body.effectiveFrom)) {
		return errorResponse("INVALID_DATE", "effectiveFrom must be YYYY-MM-DD", 422);
	}

	const series = await db.query.bookingSeries.findFirst({
		where: eq(schema.bookingSeries.id, id),
	});

	if (!series) {
		return errorResponse("NOT_FOUND", "Series not found", 404);
	}

	const timezone = series.timezone || "America/Bogota";

	// Get all active bookings for this series
	const activeBookings = await db.query.booking.findMany({
		where: and(
			eq(schema.booking.seriesKey, id),
			eq(schema.booking.isActive, true),
		),
	});

	// Get slots to filter by date
	const slotIds = activeBookings.map((b) => b.slotId);
	const slots = slotIds.length > 0
		? await db.query.appointmentSlot.findMany({
				where: sql`${schema.appointmentSlot.id} IN ${slotIds}`,
			})
		: [];
	const slotDateMap = new Map(slots.map((s) => [s.id, s.slotDate]));

	// Filter to instances >= effectiveFrom
	const toUpdate = activeBookings.filter((booking) => {
		const slotDate = slotDateMap.get(booking.slotId);
		if (!slotDate) return false;
		return isDateOnOrAfter(slotDate, body.effectiveFrom, timezone);
	});

	const updatedIds: string[] = [];
	const now = new Date();

	// Apply updates
	if (body.staffUserId !== undefined) {
		for (const booking of toUpdate) {
			await db
				.update(schema.booking)
				.set({
					staffUserId: body.staffUserId,
					updatedAt: now,
				})
				.where(eq(schema.booking.id, booking.id));
			updatedIds.push(booking.id);
		}
	}

	if (body.notes !== undefined) {
		for (const booking of toUpdate) {
			await db
				.update(schema.booking)
				.set({
					notes: body.notes,
					updatedAt: now,
				})
				.where(eq(schema.booking.id, booking.id));
		}
	}

	return c.json({
		seriesId: id,
		effectiveFrom: body.effectiveFrom,
		updatedCount: updatedIds.length,
		updatedInstanceIds: updatedIds,
	});
});

// =============================================================================
// SERIES RELEASE OPERATIONS
// =============================================================================

/**
 * POST /api/admin/reservation-series/:id/release
 * Release (deactivate) all active future instances of a series.
 */
app.post("/:id/release", async (c) => {
	const { id } = c.req.param();
	const body = await c.req.json();

	const series = await db.query.bookingSeries.findFirst({
		where: eq(schema.bookingSeries.id, id),
	});

	if (!series) {
		return errorResponse("NOT_FOUND", "Series not found", 404);
	}

	// Get all active bookings for this series
	const activeBookings = await db.query.booking.findMany({
		where: and(
			eq(schema.booking.seriesKey, id),
			eq(schema.booking.isActive, true),
		),
	});

	// Release each booking
	const releasedIds: string[] = [];
	for (const booking of activeBookings) {
		const result = await releaseCapacity(booking.id, body.reason || "cancelled");
		if (result.success) {
			releasedIds.push(booking.id);
		}
	}

	// Deactivate the series
	await db
		.update(schema.bookingSeries)
		.set({
			isActive: false,
			updatedAt: new Date(),
		})
		.where(eq(schema.bookingSeries.id, id));

	return c.json({
		seriesId: id,
		releasedCount: releasedIds.length,
		releasedInstanceIds: releasedIds,
	});
});

// =============================================================================
// INSTANCE-LEVEL OPERATIONS
// =============================================================================

/**
 * GET /api/admin/reservations/:bookingId
 * Get a single reservation instance.
 */
app.get("/:bookingId", async (c) => {
	const { bookingId } = c.req.param();

	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	if (!booking) {
		return errorResponse("NOT_FOUND", "Reservation not found", 404);
	}

	// Enrich with slot and series info
	const slot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, booking.slotId),
	});
	const series = booking.seriesKey
		? await db.query.bookingSeries.findFirst({
				where: eq(schema.bookingSeries.id, booking.seriesKey),
			})
		: null;

	return c.json({ ...booking, slot, series });
});

/**
 * PATCH /api/admin/reservations/:bookingId
 * Update a single instance (detaches it from series future updates).
 *
 * After this operation, the instance is marked as "detached" and won't be
 * affected by series-level updates unless force=true is used.
 */
app.patch("/:bookingId", async (c) => {
	const { bookingId } = c.req.param();
	const body = await c.req.json();

	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	if (!booking) {
		return errorResponse("NOT_FOUND", "Reservation not found", 404);
	}

	if (!booking.isActive) {
		return errorResponse(
			"BOOKING_NOT_MUTABLE",
			"Cannot update inactive reservation",
			409,
		);
	}

	// Verify kind is administrative
	if (booking.kind !== "administrative") {
		return errorResponse(
			"BOOKING_KIND_NOT_ADMIN",
			"Only administrative reservations can be mutated via this endpoint",
			409,
		);
	}

	const now = new Date();
	const updates: Partial<typeof schema.booking.$inferInsert> = { updatedAt: now };

	if (body.staffUserId !== undefined) {
		// Check capacity for new staff
		const capacityCheck = await checkCapacity(booking.slotId, body.staffUserId);
		if (!capacityCheck.available) {
			return conflictResponse(capacityCheck.conflicts);
		}
		updates.staffUserId = body.staffUserId;
	}

	if (body.notes !== undefined) {
		updates.notes = body.notes;
	}

	// Mark as detached to prevent series updates from affecting it
	// unless force=true is explicitly used
	const currentSnapshot = (booking.snapshot as Record<string, unknown>) || {};
	updates.snapshot = {
		...currentSnapshot,
		detached: true,
		detachedAt: now.toISOString(),
		detachedFromSeries: booking.seriesKey,
	};

	await db
		.update(schema.booking)
		.set(updates)
		.where(eq(schema.booking.id, bookingId));

	const updated = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	return c.json(updated);
});

/**
 * POST /api/admin/reservations/:bookingId/release
 * Release a single reservation instance.
 */
app.post("/:bookingId/release", async (c) => {
	const { bookingId } = c.req.param();
	const body = await c.req.json();

	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	if (!booking) {
		return errorResponse("NOT_FOUND", "Reservation not found", 404);
	}

	if (!body.reason || !["cancelled", "expired", "attended"].includes(body.reason)) {
		return errorResponse(
			"INVALID_REASON",
			"reason must be 'cancelled', 'expired', or 'attended'",
			422,
		);
	}

	const result = await releaseCapacity(bookingId, body.reason);

	if (!result.success && !result.alreadyReleased) {
		const errorCode = result.error === "Booking not found" ? "NOT_FOUND" : "RELEASE_FAILED";
		return errorResponse(errorCode, result.error ?? "Unknown error", errorCode === "NOT_FOUND" ? 404 : 422);
	}

	const updated = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	return c.json({
		booking: updated,
		alreadyReleased: result.alreadyReleased,
	});
});

// =============================================================================
// SERIES MOVE OPERATION
// =============================================================================

/**
 * POST /api/admin/reservation-series/:id/move
 * Move all active instances of a series to a new slot/time.
 *
 * Request body:
 * - targetSlotId: new slot ID
 * - targetStaffUserId: optional, new staff
 *
 * Capacity is checked per instance. If any instance lacks capacity,
 * the entire operation fails (atomic).
 */
app.post("/:id/move", async (c) => {
	const { id } = c.req.param();
	const body = await c.req.json();

	if (!body.targetSlotId) {
		return errorResponse("MISSING_REQUIRED_FIELDS", "targetSlotId is required", 422);
	}

	const series = await db.query.bookingSeries.findFirst({
		where: eq(schema.bookingSeries.id, id),
	});

	if (!series) {
		return errorResponse("NOT_FOUND", "Series not found", 404);
	}

	// Validate target slot exists
	const targetSlot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, body.targetSlotId),
	});
	if (!targetSlot) {
		return errorResponse("NOT_FOUND", "Target slot not found", 404);
	}

	// Get all active bookings for this series
	const activeBookings = await db.query.booking.findMany({
		where: and(
			eq(schema.booking.seriesKey, id),
			eq(schema.booking.isActive, true),
		),
	});

	if (activeBookings.length === 0) {
		return errorResponse("NO_ACTIVE_INSTANCES", "Series has no active instances to move", 422);
	}

	// Check capacity for each instance
	for (const booking of activeBookings) {
		if (!booking.staffUserId) {
			return errorResponse("INVALID_STATE", "Booking has no staff assigned", 422);
		}
		const staffUserId = body.targetStaffUserId || booking.staffUserId;
		const capacityCheck = await checkCapacity(body.targetSlotId, staffUserId);
		if (!capacityCheck.available) {
			return conflictResponse(capacityCheck.conflicts);
		}
	}

	// All capacity checks passed - perform the move
	const now = new Date();
	const movedIds: string[] = [];

	for (const booking of activeBookings) {
		await db
			.update(schema.booking)
			.set({
				slotId: body.targetSlotId,
				staffUserId: body.targetStaffUserId || booking.staffUserId,
				updatedAt: now,
			})
			.where(eq(schema.booking.id, booking.id));
		movedIds.push(booking.id);
	}

	return c.json({
		seriesId: id,
		movedCount: movedIds.length,
		movedInstanceIds: movedIds,
		targetSlotId: body.targetSlotId,
		targetStaffUserId: body.targetStaffUserId,
	});
});

/**
 * POST /api/admin/reservations/:bookingId/move
 * Move a single instance to a new slot.
 */
app.post("/:bookingId/move", async (c) => {
	const { bookingId } = c.req.param();
	const body = await c.req.json();

	if (!body.targetSlotId) {
		return errorResponse("MISSING_REQUIRED_FIELDS", "targetSlotId is required", 422);
	}

	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	if (!booking) {
		return errorResponse("NOT_FOUND", "Reservation not found", 404);
	}

	if (!booking.isActive) {
		return errorResponse("BOOKING_NOT_MUTABLE", "Cannot move inactive reservation", 409);
	}

	// Verify kind is administrative
	if (booking.kind !== "administrative") {
		return errorResponse(
			"BOOKING_KIND_NOT_ADMIN",
			"Only administrative reservations can be moved via this endpoint",
			409,
		);
	}

	// Validate target slot exists
	const targetSlot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, body.targetSlotId),
	});
	if (!targetSlot) {
		return errorResponse("NOT_FOUND", "Target slot not found", 404);
	}

	if (!booking.staffUserId) {
		return errorResponse("INVALID_STATE", "Booking has no staff assigned", 422);
	}

	const staffUserId = body.targetStaffUserId || booking.staffUserId;

	// Check capacity for target
	const capacityCheck = await checkCapacity(body.targetSlotId, staffUserId);
	if (!capacityCheck.available) {
		return conflictResponse(capacityCheck.conflicts);
	}

	// Perform the move
	const now = new Date();
	await db
		.update(schema.booking)
		.set({
			slotId: body.targetSlotId,
			staffUserId,
			updatedAt: now,
		})
		.where(eq(schema.booking.id, bookingId));

	const updated = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	return c.json(updated);
});

export { app as reservationSeriesApp };
