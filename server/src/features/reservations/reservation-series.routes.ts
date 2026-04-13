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
 * - POST /api/admin/reservations/:bookingId/move - Move single instance
 *
 * Scope semantics:
 * - full_series: all active instances of the series
 * - single: only the specific instance
 * - from_date: only instances >= effectiveFrom date
 *
 * Capacity is consumed per instance immediately on create.
 * Detached (excepcionated) instances are not affected by series updates unless
 * explicitly forced.
 *
 * Idempotency:
 * - POST /api/admin/reservation-series: accepts Idempotency-Key header
 * - POST /api/admin/reservations/:id/move: accepts Idempotency-Key header
 * - POST /api/admin/reservations/:id/release: accepts Idempotency-Key header
 * - PATCH /api/admin/reservation-series/:id: accepts If-Match header for optimistic concurrency
 * - PATCH /api/admin/reservations/:bookingId: accepts If-Match header for optimistic concurrency
 *
 * Integrity guards:
 * - VAL-ADM-025: Admin mutation endpoints reject non-admin booking kinds
 * - VAL-ADM-022: Mutations reject reservations in non-mutable state (cancelled/released/attended)
 */

import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db, schema } from "../../lib/db";
import {
	type CapacityConflict,
	checkCapacity,
	consumeCapacity,
	countActiveSlotBookings,
	countActiveStaffBookingsOnDate,
	releaseCapacity,
	resolveStaffAvailabilityAndCapacity,
} from "../bookings/capacity.service";

type AppVariables = {
	user: { id: string; role: string | null; [key: string]: unknown } | null;
	session: { id: string; [key: string]: unknown } | null;
};

const app = new Hono<{ Variables: AppVariables }>();
const instanceApp = new Hono<{ Variables: AppVariables }>();

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

// Idempotency key expiration time (24 hours)
const IDEMPOTENCY_KEY_TTL_MS = 24 * 60 * 60 * 1000;

// =============================================================================
// IDEMPOTENCY HELPERS
// =============================================================================

/**
 * Generate a hash of the payload for idempotency comparison.
 */
function hashPayload(payload: unknown): string {
	const normalized = JSON.stringify(
		payload,
		Object.keys(payload as object).sort(),
	);
	return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

/**
 * Check if an idempotency key exists and is valid.
 * Returns { exists: true, response } if key exists with same payload.
 * Returns { exists: true, conflict: true } if key exists with different payload.
 * Returns { exists: false } if key doesn't exist.
 */
async function checkIdempotencyKey(
	key: string,
	operation: string,
	targetId: string | null,
	payloadHash: string,
): Promise<
	| {
			exists: true;
			response?: { status: number; body: unknown };
			conflict?: boolean;
	  }
	| { exists: false }
> {
	const now = new Date();

	// Check if key exists
	const existing = await db.query.idempotencyKey.findFirst({
		where: eq(schema.idempotencyKey.key, key),
	});

	if (!existing) {
		return { exists: false };
	}

	// Check if expired
	if (existing.expiresAt && existing.expiresAt < now) {
		// Expired, treat as doesn't exist
		await db
			.delete(schema.idempotencyKey)
			.where(eq(schema.idempotencyKey.id, existing.id));
		return { exists: false };
	}

	// Check if same operation and target
	if (existing.operation !== operation || existing.targetId !== targetId) {
		// Same key used for different operation/target - conflict
		return {
			exists: true,
			conflict: true,
		};
	}

	// Check if payload matches
	if (existing.payloadHash !== payloadHash) {
		// Same key with different payload - conflict
		return {
			exists: true,
			conflict: true,
		};
	}

	// Same key, same operation, same payload - return cached response
	return {
		exists: true,
		response: {
			status: existing.responseStatus,
			body: existing.responseBody,
		},
	};
}

/**
 * Store an idempotency key with the response.
 */
async function storeIdempotencyKey(
	key: string,
	operation: string,
	targetId: string | null,
	payloadHash: string,
	responseStatus: number,
	responseBody: unknown,
): Promise<void> {
	const now = new Date();
	const expiresAt = new Date(now.getTime() + IDEMPOTENCY_KEY_TTL_MS);

	// Delete any existing key with same value (shouldn't happen but safety first)
	await db
		.delete(schema.idempotencyKey)
		.where(eq(schema.idempotencyKey.key, key));

	await db.insert(schema.idempotencyKey).values({
		id: crypto.randomUUID(),
		key,
		operation,
		targetId,
		payloadHash,
		responseStatus,
		responseBody: responseBody as Record<string, unknown>,
		createdAt: now,
		expiresAt,
	});
}

/**
 * Parse Idempotency-Key header, return null if missing or invalid.
 */
function parseIdempotencyKey(header: string | null | undefined): string | null {
	if (!header) return null;
	// Keys should be between 8 and 128 characters
	if (header.length < 8 || header.length > 128) return null;
	// Only allow alphanumeric and hyphens
	if (!/^[a-zA-Z0-9-]+$/.test(header)) return null;
	return header;
}

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
			case "FREQ":
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
						SU: 0,
						MO: 1,
						TU: 2,
						WE: 3,
						TH: 4,
						FR: 5,
						SA: 6,
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
	existingOccurrenceKeys: Set<string>,
	slotStartTime: string,
): string[] {
	const dates: string[] = [];
	const start = new Date(`${startDate}T00:00:00`);
	const untilDate =
		rule.untilDate && rule.untilDate < endDate ? rule.untilDate : endDate;
	const end = new Date(`${untilDate}T23:59:59`);

	let count = 0;
	const maxCount = rule.count || 365;
	const interval = rule.interval && rule.interval > 0 ? rule.interval : 1;

	const formatDate = (date: Date) => {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	};

	if (
		rule.frequency === "weekly" &&
		rule.byDayOfWeek &&
		rule.byDayOfWeek.length > 0
	) {
		const byDays = new Set(rule.byDayOfWeek);
		const current = new Date(start);
		while (current <= end && count < maxCount) {
			const daysSinceStart = Math.floor(
				(current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
			);
			const weekIndex = Math.floor(daysSinceStart / 7);
			const onIntervalWeek = weekIndex % interval === 0;
			const dateStr = formatDate(current);
			const key = `${dateStr}|${slotStartTime}`;

			if (
				onIntervalWeek &&
				byDays.has(current.getDay()) &&
				!existingOccurrenceKeys.has(key)
			) {
				dates.push(dateStr);
				count += 1;
			}

			current.setDate(current.getDate() + 1);
		}

		return dates;
	}

	const current = new Date(start);

	while (current <= end && count < maxCount) {
		const dateStr = formatDate(current);
		const key = `${dateStr}|${slotStartTime}`;

		if (!existingOccurrenceKeys.has(key)) {
			dates.push(dateStr);
			count++;
		}

		switch (rule.frequency) {
			case "daily":
				current.setDate(current.getDate() + interval);
				break;
			case "weekly":
				current.setDate(current.getDate() + interval * 7);
				break;
			case "biweekly":
				current.setDate(current.getDate() + 14);
				break;
			case "monthly":
				current.setMonth(current.getMonth() + interval);
				break;
		}
	}

	return dates;
}

/**
 * Check if a date is >= effectiveFrom using timezone.
 */
function isDateOnOrAfter(
	dateStr: string,
	effectiveFrom: string,
	_timezone: string,
): boolean {
	return dateStr >= effectiveFrom;
}

// =============================================================================
// BOOKING KIND GUARD (VAL-ADM-025)
// =============================================================================

/**
 * Check if a booking is an administrative reservation.
 * Returns error response if not admin, null if valid.
 */
function checkAdminBookingKind(
	booking: typeof schema.booking.$inferSelect,
): Response | null {
	if (booking.kind !== "administrative") {
		return errorResponse(
			"BOOKING_KIND_NOT_ADMIN",
			"Only administrative reservations can be mutated via this endpoint",
			409,
		);
	}
	return null;
}

// =============================================================================
// NON-MUTABLE STATE VALIDATION (VAL-ADM-022)
// =============================================================================

/**
 * Check if a booking is in a non-mutable state.
 * Returns error response if not mutable, null if valid.
 */
function checkMutableState(
	booking: typeof schema.booking.$inferSelect,
): Response | null {
	if (!booking.isActive) {
		return errorResponse(
			"BOOKING_NOT_MUTABLE",
			`Cannot mutate inactive reservation (status: ${booking.status})`,
			409,
		);
	}

	// Check for terminal states
	const nonMutableStatuses = ["cancelled", "released", "attended"];
	if (nonMutableStatuses.includes(booking.status)) {
		return errorResponse(
			"BOOKING_NOT_MUTABLE",
			`Cannot mutate reservation in status: ${booking.status}`,
			409,
		);
	}

	return null;
}

// =============================================================================
// OPTIMISTIC CONCURRENCY CONTROL
// =============================================================================

/**
 * Parse If-Match header as version (updatedAt timestamp).
 * Returns null if header is missing (skip check), or the expected version.
 */
function parseIfMatch(header: string | null | undefined): string | null {
	if (!header) return null;
	// If-Match typically contains an ETag or version
	// We use updatedAt timestamp as version
	return header.replace(/^"/, "").replace(/"$/, "");
}

/**
 * Check optimistic concurrency for a booking or series.
 * Returns error response if version mismatch, null if OK.
 */
function checkOptimisticConcurrency(
	currentUpdatedAt: Date,
	expectedVersion: string | null,
): Response | null {
	if (!expectedVersion) return null;

	const expected = new Date(expectedVersion).getTime();
	const current = currentUpdatedAt.getTime();

	if (Number.isNaN(expected)) return null; // Invalid date format, skip check
	if (current > expected) {
		return new Response(
			JSON.stringify({
				code: "PRECONDITION_FAILED",
				message: "Resource has been modified since requested version",
			}),
			{
				status: 412,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	return null;
}

// =============================================================================
// SERIES CREATION
// =============================================================================

/**
 * POST /api/admin/reservation-series
 *
 * Create a recurring administrative reservation series.
 *
 * Headers:
 * - Idempotency-Key: optional, for idempotent replay
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
 * Returns 409 Idempotency-Key conflict if key reused with different payload.
 */
app.post("/", async (c) => {
	const body = await c.req.json();
	const idempotencyKeyHeader = parseIdempotencyKey(
		c.req.header("Idempotency-Key"),
	);

	// Check idempotency
	if (idempotencyKeyHeader) {
		const payloadHash = hashPayload(body);
		const check = await checkIdempotencyKey(
			idempotencyKeyHeader,
			"create_series",
			null,
			payloadHash,
		);

		if (check.exists) {
			if (check.conflict) {
				return errorResponse(
					"IDEMPOTENCY_KEY_CONFLICT",
					"Idempotency-Key was already used with a different payload",
					409,
				);
			}
			if (check.response) {
				return c.json(
					check.response.body,
					check.response.status as 200 | 201 | 400 | 404 | 409 | 422,
				);
			}
		}
	}

	// Validate required fields
	if (!body.recurrenceRule) {
		const errResp = errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"recurrenceRule is required",
			422,
		);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"create_series",
				null,
				hashPayload(body),
				422,
				{
					code: "MISSING_REQUIRED_FIELDS",
					message: "recurrenceRule is required",
				},
			);
		}
		return errResp;
	}
	if (!body.slotId) {
		const errResp = errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"slotId is required",
			422,
		);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"create_series",
				null,
				hashPayload(body),
				422,
				{ code: "MISSING_REQUIRED_FIELDS", message: "slotId is required" },
			);
		}
		return errResp;
	}
	if (!body.staffUserId) {
		const errResp = errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"staffUserId is required",
			422,
		);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"create_series",
				null,
				hashPayload(body),
				422,
				{ code: "MISSING_REQUIRED_FIELDS", message: "staffUserId is required" },
			);
		}
		return errResp;
	}
	if (!body.startDate || !body.endDate) {
		const errResp = errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"startDate and endDate are required",
			422,
		);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"create_series",
				null,
				hashPayload(body),
				422,
				{
					code: "MISSING_REQUIRED_FIELDS",
					message: "startDate and endDate are required",
				},
			);
		}
		return errResp;
	}

	// Validate dates
	if (!/^\d{4}-\d{2}-\d{2}$/.test(body.startDate)) {
		const errResp = errorResponse(
			"INVALID_DATE",
			"startDate must be YYYY-MM-DD",
			422,
		);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"create_series",
				null,
				hashPayload(body),
				422,
				{ code: "INVALID_DATE", message: "startDate must be YYYY-MM-DD" },
			);
		}
		return errResp;
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(body.endDate)) {
		const errResp = errorResponse(
			"INVALID_DATE",
			"endDate must be YYYY-MM-DD",
			422,
		);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"create_series",
				null,
				hashPayload(body),
				422,
				{ code: "INVALID_DATE", message: "endDate must be YYYY-MM-DD" },
			);
		}
		return errResp;
	}
	if (body.endDate < body.startDate) {
		const errResp = errorResponse(
			"INVALID_DATE",
			"endDate must be >= startDate",
			422,
		);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"create_series",
				null,
				hashPayload(body),
				422,
				{ code: "INVALID_DATE", message: "endDate must be >= startDate" },
			);
		}
		return errResp;
	}

	// Validate slot exists
	const baseSlot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, body.slotId),
	});
	if (!baseSlot) {
		const errResp = errorResponse("NOT_FOUND", "Base slot not found", 404);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"create_series",
				null,
				hashPayload(body),
				404,
				{ code: "NOT_FOUND", message: "Base slot not found" },
			);
		}
		return errResp;
	}

	// Validate staff exists
	const staff = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, body.staffUserId),
	});
	if (!staff) {
		const errResp = errorResponse("NOT_FOUND", "Staff profile not found", 404);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"create_series",
				null,
				hashPayload(body),
				404,
				{ code: "NOT_FOUND", message: "Staff profile not found" },
			);
		}
		return errResp;
	}

	// Parse recurrence rule
	const rule: RecurrenceRule =
		typeof body.recurrenceRule === "string"
			? parseRRule(body.recurrenceRule)
			: body.recurrenceRule;

	if (!["daily", "weekly", "biweekly", "monthly"].includes(rule.frequency)) {
		const errResp = errorResponse(
			"INVALID_RULE",
			"frequency must be daily/weekly/biweekly/monthly",
			422,
		);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"create_series",
				null,
				hashPayload(body),
				422,
				{
					code: "INVALID_RULE",
					message: "frequency must be daily/weekly/biweekly/monthly",
				},
			);
		}
		return errResp;
	}

	const timezone = body.timezone || "America/Bogota";

	// Find existing booking occurrences for this staff to avoid duplicates
	const existingBookings = await db.query.booking.findMany({
		where: and(
			eq(schema.booking.staffUserId, body.staffUserId),
			eq(schema.booking.isActive, true),
		),
	});
	const existingSlotIds = existingBookings.map((b) => b.slotId);
	const existingSlots =
		existingSlotIds.length > 0
			? await db.query.appointmentSlot.findMany({
					where: sql`${schema.appointmentSlot.id} IN ${existingSlotIds}`,
				})
			: [];
	const existingOccurrenceKeys = new Set(
		existingSlots.map((slot) => `${slot.slotDate}|${slot.startTime}`),
	);

	// Generate occurrence dates
	const occurrences = generateOccurrences(
		rule,
		body.startDate,
		body.endDate,
		existingOccurrenceKeys,
		baseSlot.startTime,
	);

	if (occurrences.length === 0) {
		const errResp = errorResponse(
			"NO_OCCURRENCES",
			"No valid occurrences in date range",
			422,
		);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"create_series",
				null,
				hashPayload(body),
				422,
				{
					code: "NO_OCCURRENCES",
					message: "No valid occurrences in date range",
				},
			);
		}
		return errResp;
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

	let responseStatus = 201;
	let responseBody: Record<string, unknown>;

	if (conflicts.length > 0 && createdBookingIds.length === 0) {
		// All failed - rollback series
		await db
			.delete(schema.bookingSeries)
			.where(eq(schema.bookingSeries.id, seriesId));
		responseStatus = 409;
		responseBody = {
			code: "CAPACITY_CONFLICT",
			message: "Insufficient capacity for this operation",
			conflicts,
		};
	} else {
		// Fetch the created series
		const series = await db.query.bookingSeries.findFirst({
			where: eq(schema.bookingSeries.id, seriesId),
		});

		responseBody = {
			series,
			instanceCount: createdBookingIds.length,
			bookingIds: createdBookingIds,
			warnings:
				conflicts.length > 0
					? ["Some instances could not be created due to capacity conflicts"]
					: [],
		};
	}

	// Store idempotency key with response
	if (idempotencyKeyHeader) {
		await storeIdempotencyKey(
			idempotencyKeyHeader,
			"create_series",
			null,
			hashPayload(body),
			responseStatus,
			responseBody,
		);
	}

	return c.json(responseBody, responseStatus as 200 | 201 | 409);
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
 * Headers:
 * - If-Match: optional, version timestamp for optimistic concurrency (VAL-ADM-013)
 *
 * Only affects instances that haven't been individually modified (detached).
 * A flag `force=false` (default) will skip detached instances.
 * With `force=true`, even detached instances will be updated.
 *
 * VAL-ADM-013: Optimistic concurrency control avoids silent overwrites
 */
app.patch("/:id", async (c) => {
	const { id } = c.req.param();
	const body = await c.req.json();
	const ifMatch = parseIfMatch(c.req.header("If-Match"));

	const series = await db.query.bookingSeries.findFirst({
		where: eq(schema.bookingSeries.id, id),
	});

	if (!series) {
		return errorResponse("NOT_FOUND", "Series not found", 404);
	}

	// VAL-ADM-013: Check optimistic concurrency
	const concurrencyCheck = checkOptimisticConcurrency(
		series.updatedAt,
		ifMatch,
	);
	if (concurrencyCheck) {
		return concurrencyCheck;
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

	if (body.staffUserId !== undefined) {
		const targetStaff = await db.query.staffProfile.findFirst({
			where: eq(schema.staffProfile.userId, body.staffUserId),
		});
		if (!targetStaff) {
			return errorResponse("NOT_FOUND", "Target staff profile not found", 404);
		}

		const reassignmentConflicts: Array<{
			bookingId: string;
			conflicts: CapacityConflict[];
		}> = [];

		for (const booking of toUpdate) {
			if (booking.staffUserId === body.staffUserId) {
				continue;
			}
			const capacityCheck = await checkCapacity(
				booking.slotId,
				body.staffUserId,
			);
			const conflicts = capacityCheck.conflicts.filter(
				(conflict) => conflict.type !== "GLOBAL_OVER_CAPACITY",
			);
			if (conflicts.length > 0) {
				reassignmentConflicts.push({ bookingId: booking.id, conflicts });
			}
		}

		if (reassignmentConflicts.length > 0) {
			return new Response(
				JSON.stringify({
					code: "CAPACITY_CONFLICT",
					message:
						"Cannot update series staff assignment due to staff availability/capacity conflicts",
					conflicts: reassignmentConflicts,
				}),
				{
					status: 409,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	}

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
		return errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"effectiveFrom is required (YYYY-MM-DD)",
			422,
		);
	}

	if (!/^\d{4}-\d{2}-\d{2}$/.test(body.effectiveFrom)) {
		return errorResponse(
			"INVALID_DATE",
			"effectiveFrom must be YYYY-MM-DD",
			422,
		);
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
	const slots =
		slotIds.length > 0
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

	if (body.staffUserId !== undefined) {
		const targetStaff = await db.query.staffProfile.findFirst({
			where: eq(schema.staffProfile.userId, body.staffUserId),
		});
		if (!targetStaff) {
			return errorResponse("NOT_FOUND", "Target staff profile not found", 404);
		}

		const reassignmentConflicts: Array<{
			bookingId: string;
			conflicts: CapacityConflict[];
		}> = [];

		for (const booking of toUpdate) {
			if (booking.staffUserId === body.staffUserId) {
				continue;
			}
			const capacityCheck = await checkCapacity(
				booking.slotId,
				body.staffUserId,
			);
			const conflicts = capacityCheck.conflicts.filter(
				(conflict) => conflict.type !== "GLOBAL_OVER_CAPACITY",
			);
			if (conflicts.length > 0) {
				reassignmentConflicts.push({ bookingId: booking.id, conflicts });
			}
		}

		if (reassignmentConflicts.length > 0) {
			return new Response(
				JSON.stringify({
					code: "CAPACITY_CONFLICT",
					message:
						"Cannot update series staff assignment due to staff availability/capacity conflicts",
					conflicts: reassignmentConflicts,
				}),
				{
					status: 409,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	}

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
 *
 * Headers:
 * - Idempotency-Key: optional, for idempotent replay
 *
 * VAL-ADM-006: Release stops consuming capacity immediately
 * VAL-ADM-021: Release updates complete state and prevents reactivation
 */
app.post("/:id/release", async (c) => {
	const { id } = c.req.param();
	const body = await c.req.json();
	const idempotencyKeyHeader = parseIdempotencyKey(
		c.req.header("Idempotency-Key"),
	);

	// Check idempotency
	if (idempotencyKeyHeader) {
		const payloadHash = hashPayload({ seriesId: id, reason: body.reason });
		const check = await checkIdempotencyKey(
			idempotencyKeyHeader,
			"release_series",
			id,
			payloadHash,
		);

		if (check.exists) {
			if (check.conflict) {
				return errorResponse(
					"IDEMPOTENCY_KEY_CONFLICT",
					"Idempotency-Key was already used with a different payload",
					409,
				);
			}
			if (check.response) {
				return c.json(
					check.response.body,
					check.response.status as 200 | 201 | 400 | 404 | 409 | 422,
				);
			}
		}
	}

	const series = await db.query.bookingSeries.findFirst({
		where: eq(schema.bookingSeries.id, id),
	});

	if (!series) {
		const errResp = errorResponse("NOT_FOUND", "Series not found", 404);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"release_series",
				id,
				hashPayload({ seriesId: id, reason: body.reason }),
				404,
				{ code: "NOT_FOUND", message: "Series not found" },
			);
		}
		return errResp;
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
		const result = await releaseCapacity(
			booking.id,
			body.reason || "cancelled",
		);
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

	const responseBody = {
		seriesId: id,
		releasedCount: releasedIds.length,
		releasedInstanceIds: releasedIds,
	};

	// Store idempotency key with response
	if (idempotencyKeyHeader) {
		await storeIdempotencyKey(
			idempotencyKeyHeader,
			"release_series",
			id,
			hashPayload({ seriesId: id, reason: body.reason }),
			200,
			responseBody,
		);
	}

	return c.json(responseBody);
});

// =============================================================================
// INSTANCE-LEVEL OPERATIONS
// =============================================================================

/**
 * GET /api/admin/reservations/:bookingId
 * Get a single reservation instance.
 */
instanceApp.get("/:bookingId", async (c) => {
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
 * Headers:
 * - If-Match: optional, version timestamp for optimistic concurrency (VAL-ADM-013)
 *
 * After this operation, the instance is marked as "detached" and won't be
 * affected by series-level updates unless force=true is used.
 *
 * VAL-ADM-013: Optimistic concurrency control avoids silent overwrites
 * VAL-ADM-025: Rejects non-administrative booking kinds
 * VAL-ADM-022: Rejects non-mutable state bookings
 */
instanceApp.patch("/:bookingId", async (c) => {
	const { bookingId } = c.req.param();
	const body = await c.req.json();
	const ifMatch = parseIfMatch(c.req.header("If-Match"));

	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	if (!booking) {
		return errorResponse("NOT_FOUND", "Reservation not found", 404);
	}

	// VAL-ADM-013: Check optimistic concurrency
	const concurrencyCheck = checkOptimisticConcurrency(
		booking.updatedAt,
		ifMatch,
	);
	if (concurrencyCheck) {
		return concurrencyCheck;
	}

	// VAL-ADM-022: Check booking is in mutable state
	const mutableGuard = checkMutableState(booking);
	if (mutableGuard) {
		return mutableGuard;
	}

	// VAL-ADM-025: Verify kind is administrative
	const kindGuard = checkAdminBookingKind(booking);
	if (kindGuard) {
		return kindGuard;
	}

	const now = new Date();
	const updates: Partial<typeof schema.booking.$inferInsert> = {
		updatedAt: now,
	};

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
 *
 * Headers:
 * - Idempotency-Key: optional, for idempotent replay
 *
 * VAL-ADM-025: Rejects non-administrative booking kinds
 * VAL-ADM-021: Release updates complete state and prevents reactivation
 */
instanceApp.post("/:bookingId/release", async (c) => {
	const { bookingId } = c.req.param();
	const body = await c.req.json();
	const idempotencyKeyHeader = parseIdempotencyKey(
		c.req.header("Idempotency-Key"),
	);

	// Check idempotency
	if (idempotencyKeyHeader) {
		const payloadHash = hashPayload({ bookingId, reason: body.reason });
		const check = await checkIdempotencyKey(
			idempotencyKeyHeader,
			"release",
			bookingId,
			payloadHash,
		);

		if (check.exists) {
			if (check.conflict) {
				return errorResponse(
					"IDEMPOTENCY_KEY_CONFLICT",
					"Idempotency-Key was already used with a different payload",
					409,
				);
			}
			if (check.response) {
				return c.json(
					check.response.body,
					check.response.status as 200 | 201 | 400 | 404 | 409 | 422,
				);
			}
		}
	}

	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	if (!booking) {
		const errResp = errorResponse("NOT_FOUND", "Reservation not found", 404);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"release",
				bookingId,
				hashPayload({ bookingId, reason: body.reason }),
				404,
				{ code: "NOT_FOUND", message: "Reservation not found" },
			);
		}
		return errResp;
	}

	if (
		!body.reason ||
		!["cancelled", "expired", "attended"].includes(body.reason)
	) {
		const errResp = errorResponse(
			"INVALID_REASON",
			"reason must be 'cancelled', 'expired', or 'attended'",
			422,
		);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"release",
				bookingId,
				hashPayload({ bookingId, reason: body.reason }),
				422,
				{
					code: "INVALID_REASON",
					message: "reason must be 'cancelled', 'expired', or 'attended'",
				},
			);
		}
		return errResp;
	}

	// VAL-ADM-025: Check booking kind is administrative
	const kindGuard = checkAdminBookingKind(booking);
	if (kindGuard) {
		if (idempotencyKeyHeader) {
			const body2 = await kindGuard.json();
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"release",
				bookingId,
				hashPayload({ bookingId, reason: body.reason }),
				kindGuard.status,
				body2,
			);
		}
		return kindGuard;
	}

	// VAL-ADM-022: Check booking is in mutable state (already done by releaseCapacity idempotency)
	// but we need to check before release to report correctly
	const mutableGuard = checkMutableState(booking);
	if (mutableGuard) {
		if (idempotencyKeyHeader) {
			const body2 = await mutableGuard.json();
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"release",
				bookingId,
				hashPayload({ bookingId, reason: body.reason }),
				mutableGuard.status,
				body2,
			);
		}
		return mutableGuard;
	}

	const result = await releaseCapacity(bookingId, body.reason);

	if (!result.success && !result.alreadyReleased) {
		const errorCode =
			result.error === "Booking not found" ? "NOT_FOUND" : "RELEASE_FAILED";
		const errResp = errorResponse(
			errorCode,
			result.error ?? "Unknown error",
			errorCode === "NOT_FOUND" ? 404 : 422,
		);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"release",
				bookingId,
				hashPayload({ bookingId, reason: body.reason }),
				errResp.status,
				{ code: errorCode, message: result.error },
			);
		}
		return errResp;
	}

	const updated = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	const responseBody = {
		booking: updated,
		alreadyReleased: result.alreadyReleased,
	};

	// Store idempotency key with response
	if (idempotencyKeyHeader) {
		await storeIdempotencyKey(
			idempotencyKeyHeader,
			"release",
			bookingId,
			hashPayload({ bookingId, reason: body.reason }),
			200,
			responseBody,
		);
	}

	return c.json(responseBody);
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
 *
 * Headers:
 * - Idempotency-Key: optional, for idempotent replay
 *
 * VAL-ADM-005: Move recalculates capacity origin/destination
 * VAL-ADM-016: Idempotency avoids double effect
 */
app.post("/:id/move", async (c) => {
	const { id } = c.req.param();
	const body = await c.req.json();
	const idempotencyKeyHeader = parseIdempotencyKey(
		c.req.header("Idempotency-Key"),
	);

	// Check idempotency
	if (idempotencyKeyHeader) {
		const payloadHash = hashPayload({
			seriesId: id,
			targetSlotId: body.targetSlotId,
			targetStaffUserId: body.targetStaffUserId,
		});
		const check = await checkIdempotencyKey(
			idempotencyKeyHeader,
			"move_series",
			id,
			payloadHash,
		);

		if (check.exists) {
			if (check.conflict) {
				return errorResponse(
					"IDEMPOTENCY_KEY_CONFLICT",
					"Idempotency-Key was already used with a different payload",
					409,
				);
			}
			if (check.response) {
				return c.json(
					check.response.body,
					check.response.status as 200 | 201 | 400 | 404 | 409 | 422,
				);
			}
		}
	}

	if (!body.targetSlotId) {
		const errResp = errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"targetSlotId is required",
			422,
		);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"move_series",
				id,
				hashPayload({
					seriesId: id,
					targetSlotId: body.targetSlotId,
					targetStaffUserId: body.targetStaffUserId,
				}),
				422,
				{
					code: "MISSING_REQUIRED_FIELDS",
					message: "targetSlotId is required",
				},
			);
		}
		return errResp;
	}

	const series = await db.query.bookingSeries.findFirst({
		where: eq(schema.bookingSeries.id, id),
	});

	if (!series) {
		const errResp = errorResponse("NOT_FOUND", "Series not found", 404);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"move_series",
				id,
				hashPayload({
					seriesId: id,
					targetSlotId: body.targetSlotId,
					targetStaffUserId: body.targetStaffUserId,
				}),
				404,
				{ code: "NOT_FOUND", message: "Series not found" },
			);
		}
		return errResp;
	}

	// Validate target slot exists
	const targetSlot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, body.targetSlotId),
	});
	if (!targetSlot) {
		const errResp = errorResponse("NOT_FOUND", "Target slot not found", 404);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"move_series",
				id,
				hashPayload({
					seriesId: id,
					targetSlotId: body.targetSlotId,
					targetStaffUserId: body.targetStaffUserId,
				}),
				404,
				{ code: "NOT_FOUND", message: "Target slot not found" },
			);
		}
		return errResp;
	}

	// Get all active bookings for this series
	const activeBookings = await db.query.booking.findMany({
		where: and(
			eq(schema.booking.seriesKey, id),
			eq(schema.booking.isActive, true),
		),
	});

	if (activeBookings.length === 0) {
		const errResp = errorResponse(
			"NO_ACTIVE_INSTANCES",
			"Series has no active instances to move",
			422,
		);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"move_series",
				id,
				hashPayload({
					seriesId: id,
					targetSlotId: body.targetSlotId,
					targetStaffUserId: body.targetStaffUserId,
				}),
				422,
				{
					code: "NO_ACTIVE_INSTANCES",
					message: "Series has no active instances to move",
				},
			);
		}
		return errResp;
	}

	let movedIds: string[] = [];

	try {
		movedIds = await db.transaction(async (tx) => {
			const now = new Date();
			const moved: string[] = [];

			for (const booking of activeBookings) {
				if (!booking.staffUserId) {
					throw {
						code: "INVALID_STATE",
						status: 422,
						message: "Booking has no staff assigned",
					};
				}

				const currentSlot = await tx.query.appointmentSlot.findFirst({
					where: eq(schema.appointmentSlot.id, booking.slotId),
				});

				if (!currentSlot) {
					throw {
						code: "INVALID_STATE",
						status: 422,
						message: "Current slot not found for booking",
					};
				}

				const destinationStaffUserId =
					body.targetStaffUserId || booking.staffUserId;

				let destinationSlot = await tx.query.appointmentSlot.findFirst({
					where: and(
						eq(schema.appointmentSlot.slotDate, currentSlot.slotDate),
						eq(schema.appointmentSlot.startTime, targetSlot.startTime),
					),
				});

				if (!destinationSlot) {
					const destinationSlotId = crypto.randomUUID();
					await tx.insert(schema.appointmentSlot).values({
						id: destinationSlotId,
						slotDate: currentSlot.slotDate,
						startTime: targetSlot.startTime,
						endTime: targetSlot.endTime,
						status: "open",
						capacityLimit: targetSlot.capacityLimit,
						generatedFrom: "series",
						metadata: {
							movedFromSeriesId: id,
							targetSlotTemplateId: targetSlot.id,
						},
						createdAt: now,
						updatedAt: now,
					});

					destinationSlot = await tx.query.appointmentSlot.findFirst({
						where: eq(schema.appointmentSlot.id, destinationSlotId),
					});
				}

				if (!destinationSlot) {
					throw {
						code: "INVALID_STATE",
						status: 422,
						message: "Failed to resolve destination slot",
					};
				}

				const globalUsed = await countActiveSlotBookings(
					tx,
					destinationSlot.id,
					booking.id,
				);
				if (
					destinationSlot.capacityLimit !== null &&
					globalUsed >= destinationSlot.capacityLimit
				) {
					throw {
						code: "CAPACITY_CONFLICT",
						status: 409,
						conflicts: [
							{
								type: "GLOBAL_OVER_CAPACITY",
								details: `Destination slot reached capacity (${destinationSlot.capacityLimit})`,
							},
						] as CapacityConflict[],
					};
				}

				const staffResolution = await resolveStaffAvailabilityAndCapacity(
					tx,
					destinationStaffUserId,
					destinationSlot.slotDate,
					destinationSlot.startTime,
					destinationSlot.endTime,
				);

				if (!staffResolution.available) {
					throw {
						code: "CAPACITY_CONFLICT",
						status: 409,
						conflicts: [
							{
								type: "STAFF_UNAVAILABLE",
								details:
									staffResolution.reason ?? "Destination staff unavailable",
							},
						] as CapacityConflict[],
					};
				}

				const staffUsed = await countActiveStaffBookingsOnDate(
					tx,
					destinationStaffUserId,
					destinationSlot.slotDate,
					booking.id,
				);
				if (staffUsed >= staffResolution.staffCapacity) {
					throw {
						code: "CAPACITY_CONFLICT",
						status: 409,
						conflicts: [
							{
								type: "STAFF_OVER_CAPACITY",
								details: `Destination staff reached daily capacity (${staffResolution.staffCapacity})`,
							},
						] as CapacityConflict[],
					};
				}

				await tx
					.update(schema.booking)
					.set({
						slotId: destinationSlot.id,
						staffUserId: destinationStaffUserId,
						statusReason: "Moved by administrative series operation",
						updatedAt: now,
					})
					.where(eq(schema.booking.id, booking.id));

				moved.push(booking.id);
			}

			return moved;
		});
	} catch (err) {
		const payloadHash = hashPayload({
			seriesId: id,
			targetSlotId: body.targetSlotId,
			targetStaffUserId: body.targetStaffUserId,
		});

		if (err && typeof err === "object" && "code" in err && "status" in err) {
			const errorObj = err as {
				code: string;
				status: number;
				message?: string;
				conflicts?: CapacityConflict[];
			};

			const response =
				errorObj.code === "CAPACITY_CONFLICT"
					? conflictResponse(errorObj.conflicts ?? [])
					: errorResponse(
							errorObj.code,
							errorObj.message ?? "Series move failed",
							errorObj.status,
						);

			if (idempotencyKeyHeader) {
				const responseBody = await response.json();
				await storeIdempotencyKey(
					idempotencyKeyHeader,
					"move_series",
					id,
					payloadHash,
					errorObj.status,
					responseBody,
				);
			}

			return response;
		}

		throw err;
	}

	const responseBody = {
		seriesId: id,
		movedCount: movedIds.length,
		movedInstanceIds: movedIds,
		targetSlotId: body.targetSlotId,
		targetStaffUserId: body.targetStaffUserId,
	};

	// Store idempotency key with response
	if (idempotencyKeyHeader) {
		await storeIdempotencyKey(
			idempotencyKeyHeader,
			"move_series",
			id,
			hashPayload({
				seriesId: id,
				targetSlotId: body.targetSlotId,
				targetStaffUserId: body.targetStaffUserId,
			}),
			200,
			responseBody,
		);
	}

	return c.json(responseBody);
});

/**
 * POST /api/admin/reservations/:bookingId/move
 * Move a single instance to a new slot.
 *
 * Headers:
 * - Idempotency-Key: optional, for idempotent replay
 *
 * VAL-ADM-005: Move recalculates capacity origin/destination
 * VAL-ADM-016: Idempotency avoids double effect
 * VAL-ADM-025: Rejects non-administrative booking kinds
 * VAL-ADM-022: Rejects non-mutable state bookings
 */
instanceApp.post("/:bookingId/move", async (c) => {
	const { bookingId } = c.req.param();
	const body = await c.req.json();
	const idempotencyKeyHeader = parseIdempotencyKey(
		c.req.header("Idempotency-Key"),
	);

	// Check idempotency
	if (idempotencyKeyHeader) {
		const payloadHash = hashPayload({
			bookingId,
			targetSlotId: body.targetSlotId,
			targetStaffUserId: body.targetStaffUserId,
		});
		const check = await checkIdempotencyKey(
			idempotencyKeyHeader,
			"move",
			bookingId,
			payloadHash,
		);

		if (check.exists) {
			if (check.conflict) {
				return errorResponse(
					"IDEMPOTENCY_KEY_CONFLICT",
					"Idempotency-Key was already used with a different payload",
					409,
				);
			}
			if (check.response) {
				return c.json(
					check.response.body,
					check.response.status as 200 | 201 | 400 | 404 | 409 | 422,
				);
			}
		}
	}

	if (!body.targetSlotId) {
		const errResp = errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"targetSlotId is required",
			422,
		);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"move",
				bookingId,
				hashPayload({
					bookingId,
					targetSlotId: body.targetSlotId,
					targetStaffUserId: body.targetStaffUserId,
				}),
				422,
				{
					code: "MISSING_REQUIRED_FIELDS",
					message: "targetSlotId is required",
				},
			);
		}
		return errResp;
	}

	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	if (!booking) {
		const errResp = errorResponse("NOT_FOUND", "Reservation not found", 404);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"move",
				bookingId,
				hashPayload({
					bookingId,
					targetSlotId: body.targetSlotId,
					targetStaffUserId: body.targetStaffUserId,
				}),
				404,
				{ code: "NOT_FOUND", message: "Reservation not found" },
			);
		}
		return errResp;
	}

	// VAL-ADM-022: Check booking is in mutable state
	const mutableGuard = checkMutableState(booking);
	if (mutableGuard) {
		if (idempotencyKeyHeader) {
			const body2 = await mutableGuard.json();
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"move",
				bookingId,
				hashPayload({
					bookingId,
					targetSlotId: body.targetSlotId,
					targetStaffUserId: body.targetStaffUserId,
				}),
				mutableGuard.status,
				body2,
			);
		}
		return mutableGuard;
	}

	// VAL-ADM-025: Check booking kind is administrative
	const kindGuard = checkAdminBookingKind(booking);
	if (kindGuard) {
		if (idempotencyKeyHeader) {
			const body2 = await kindGuard.json();
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"move",
				bookingId,
				hashPayload({
					bookingId,
					targetSlotId: body.targetSlotId,
					targetStaffUserId: body.targetStaffUserId,
				}),
				kindGuard.status,
				body2,
			);
		}
		return kindGuard;
	}

	// Validate target slot exists
	const targetSlot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, body.targetSlotId),
	});
	if (!targetSlot) {
		const errResp = errorResponse("NOT_FOUND", "Target slot not found", 404);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"move",
				bookingId,
				hashPayload({
					bookingId,
					targetSlotId: body.targetSlotId,
					targetStaffUserId: body.targetStaffUserId,
				}),
				404,
				{ code: "NOT_FOUND", message: "Target slot not found" },
			);
		}
		return errResp;
	}

	if (!booking.staffUserId) {
		const errResp = errorResponse(
			"INVALID_STATE",
			"Booking has no staff assigned",
			422,
		);
		if (idempotencyKeyHeader) {
			await storeIdempotencyKey(
				idempotencyKeyHeader,
				"move",
				bookingId,
				hashPayload({
					bookingId,
					targetSlotId: body.targetSlotId,
					targetStaffUserId: body.targetStaffUserId,
				}),
				422,
				{ code: "INVALID_STATE", message: "Booking has no staff assigned" },
			);
		}
		return errResp;
	}

	const staffUserId = body.targetStaffUserId || booking.staffUserId;

	try {
		await db.transaction(async (tx) => {
			const currentBooking = await tx.query.booking.findFirst({
				where: eq(schema.booking.id, bookingId),
			});

			if (!currentBooking?.isActive) {
				throw {
					code: "BOOKING_NOT_MUTABLE",
					status: 409,
					message: "Reservation is no longer mutable",
				};
			}

			const destinationSlot = await tx.query.appointmentSlot.findFirst({
				where: eq(schema.appointmentSlot.id, body.targetSlotId),
			});
			if (!destinationSlot) {
				throw {
					code: "NOT_FOUND",
					status: 404,
					message: "Target slot not found",
				};
			}

			const globalUsed = await countActiveSlotBookings(
				tx,
				destinationSlot.id,
				currentBooking.id,
			);
			if (
				destinationSlot.capacityLimit !== null &&
				globalUsed >= destinationSlot.capacityLimit
			) {
				throw {
					code: "CAPACITY_CONFLICT",
					status: 409,
					conflicts: [
						{
							type: "GLOBAL_OVER_CAPACITY",
							details: `Destination slot reached capacity (${destinationSlot.capacityLimit})`,
						},
					] as CapacityConflict[],
				};
			}

			const staffResolution = await resolveStaffAvailabilityAndCapacity(
				tx,
				staffUserId,
				destinationSlot.slotDate,
				destinationSlot.startTime,
				destinationSlot.endTime,
			);
			if (!staffResolution.available) {
				throw {
					code: "CAPACITY_CONFLICT",
					status: 409,
					conflicts: [
						{
							type: "STAFF_UNAVAILABLE",
							details:
								staffResolution.reason ?? "Destination staff unavailable",
						},
					] as CapacityConflict[],
				};
			}

			const staffUsed = await countActiveStaffBookingsOnDate(
				tx,
				staffUserId,
				destinationSlot.slotDate,
				currentBooking.id,
			);
			if (staffUsed >= staffResolution.staffCapacity) {
				throw {
					code: "CAPACITY_CONFLICT",
					status: 409,
					conflicts: [
						{
							type: "STAFF_OVER_CAPACITY",
							details: `Destination staff reached daily capacity (${staffResolution.staffCapacity})`,
						},
					] as CapacityConflict[],
				};
			}

			await tx
				.update(schema.booking)
				.set({
					slotId: destinationSlot.id,
					staffUserId: staffUserId,
					statusReason: "Moved by administrative instance operation",
					updatedAt: new Date(),
				})
				.where(eq(schema.booking.id, bookingId));
		});
	} catch (err) {
		const payloadHash = hashPayload({
			bookingId,
			targetSlotId: body.targetSlotId,
			targetStaffUserId: body.targetStaffUserId,
		});

		if (err && typeof err === "object" && "code" in err && "status" in err) {
			const errorObj = err as {
				code: string;
				status: number;
				message?: string;
				conflicts?: CapacityConflict[];
			};
			const response =
				errorObj.code === "CAPACITY_CONFLICT"
					? conflictResponse(errorObj.conflicts ?? [])
					: errorResponse(
							errorObj.code,
							errorObj.message ?? "Reservation move failed",
							errorObj.status,
						);

			if (idempotencyKeyHeader) {
				const responseBody = await response.json();
				await storeIdempotencyKey(
					idempotencyKeyHeader,
					"move",
					bookingId,
					payloadHash,
					errorObj.status,
					responseBody,
				);
			}

			return response;
		}

		throw err;
	}

	const updated = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	// Store idempotency key with response
	if (idempotencyKeyHeader) {
		await storeIdempotencyKey(
			idempotencyKeyHeader,
			"move",
			bookingId,
			hashPayload({
				bookingId,
				targetSlotId: body.targetSlotId,
				targetStaffUserId: body.targetStaffUserId,
			}),
			200,
			updated,
		);
	}

	return c.json(updated);
});

export { app as reservationSeriesApp, instanceApp as reservationInstanceApp };
