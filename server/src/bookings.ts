/**
 * Bookings API - Combined Capacity Accounting Engine Integration
 *
 * Provides HTTP endpoints for booking operations:
 * - POST /api/admin/bookings - Create a booking (hold or confirmed)
 * - GET /api/admin/bookings - List bookings
 * - GET /api/admin/bookings/:id - Get a booking
 * - POST /api/admin/bookings/:id/confirm - Confirm a held booking
 * - POST /api/admin/bookings/:id/release - Release a booking (cancel/expire/attend)
 * - POST /api/admin/bookings/:id/reassign - Reassign to different staff
 *
 * All mutations use the combined capacity accounting engine to ensure:
 * - Booking only succeeds if both global AND staff capacity are available
 * - Over-capacity returns 409 CONFLICT
 * - Release is idempotent
 */

import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import {
	type CapacityConflict,
	checkCapacity,
	confirmBooking,
	consumeCapacity,
	executeBulkReassignments,
	previewReassignment,
	previewReassignments,
	reassignBooking,
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
// BOOKING CREATION
// =============================================================================

/**
 * POST /api/admin/bookings
 * Create a new booking (hold or confirmed).
 *
 * Request body:
 * - slotId: required, ID of the appointment slot
 * - staffUserId: required, ID of the staff user
 * - kind: required, "citizen" | "administrative"
 * - requestId: optional, for citizen bookings (links to service_request)
 * - citizenUserId: optional, for citizen bookings
 * - holdExpiresAt: optional, ISO timestamp for hold expiration
 *
 * Returns 201 with booking on success.
 * Returns 409 CONFLICT if global or staff capacity exceeded.
 */
app.post("/", async (c) => {
	const body = await c.req.json();

	// Validate required fields
	if (!body.slotId) {
		return errorResponse("MISSING_REQUIRED_FIELDS", "slotId is required", 422);
	}

	if (!body.staffUserId) {
		return errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"staffUserId is required",
			422,
		);
	}

	if (!body.kind || !["citizen", "administrative"].includes(body.kind)) {
		return errorResponse(
			"INVALID_KIND",
			"kind must be 'citizen' or 'administrative'",
			422,
		);
	}

	// Validate slot exists
	const slot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, body.slotId),
	});

	if (!slot) {
		return errorResponse("NOT_FOUND", "Appointment slot not found", 404);
	}

	// Validate staff exists
	const staff = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, body.staffUserId),
	});

	if (!staff) {
		return errorResponse("NOT_FOUND", "Staff profile not found", 404);
	}

	// Parse hold expiration if provided
	let holdExpiresAt: Date | null = null;
	if (body.holdExpiresAt) {
		holdExpiresAt = new Date(body.holdExpiresAt);
		if (Number.isNaN(holdExpiresAt.getTime())) {
			return errorResponse(
				"INVALID_DATE",
				"holdExpiresAt must be a valid ISO timestamp",
				422,
			);
		}
	}

	// Attempt to consume capacity and create booking
	const result = await consumeCapacity(
		body.slotId,
		body.staffUserId,
		body.kind,
		body.requestId ?? null,
		body.citizenUserId ?? null,
		c.get("user")?.id ?? null,
		body.holdToken ?? crypto.randomUUID(), // Generate hold token
		holdExpiresAt,
	);

	if (!result.success) {
		return conflictResponse(result.conflicts);
	}

	// Fetch the created booking
	if (!result.bookingId) {
		return errorResponse("INTERNAL_ERROR", "Booking ID not returned", 500);
	}

	const created = await db.query.booking.findFirst({
		where: eq(schema.booking.id, result.bookingId),
	});

	return c.json(created, 201);
});

/**
 * GET /api/admin/bookings
 * List bookings with optional filters.
 *
 * Query params:
 * - slotId: filter by slot
 * - staffUserId: filter by staff
 * - requestId: filter by request
 * - citizenUserId: filter by citizen
 * - kind: filter by kind
 * - status: filter by status
 * - isActive: filter by active state
 * - dateFrom: filter by slot date range start
 * - dateTo: filter by slot date range end
 */
app.get("/", async (c) => {
	const {
		slotId,
		staffUserId,
		requestId,
		citizenUserId,
		kind,
		status,
		isActive,
		dateFrom,
		dateTo,
	} = c.req.query();

	// Build conditions
	const conditions = [];

	if (slotId) {
		conditions.push(eq(schema.booking.slotId, slotId));
	}
	if (staffUserId) {
		conditions.push(eq(schema.booking.staffUserId, staffUserId));
	}
	if (requestId) {
		conditions.push(eq(schema.booking.requestId, requestId));
	}
	if (citizenUserId) {
		conditions.push(eq(schema.booking.citizenUserId, citizenUserId));
	}
	if (kind) {
		conditions.push(eq(schema.booking.kind, kind));
	}
	if (status) {
		conditions.push(eq(schema.booking.status, status));
	}
	if (isActive !== undefined) {
		conditions.push(eq(schema.booking.isActive, isActive === "true"));
	}

	let bookings: Awaited<ReturnType<typeof db.query.booking.findMany>>;
	if (conditions.length > 0) {
		bookings = await db.query.booking.findMany({
			where: and(...conditions),
		});
	} else {
		bookings = await db.query.booking.findMany();
	}

	// If date filters are provided, filter by slot date
	if (dateFrom || dateTo) {
		// Get all slots to filter
		const slotIds = bookings.map((b) => b.slotId);
		if (slotIds.length > 0) {
			const slots = await db.query.appointmentSlot.findMany({
				where: and(
					dateFrom ? eq(schema.appointmentSlot.slotDate, dateFrom) : undefined,
					// Note: This is simplified; in production you'd want proper range query
				),
			});

			const slotDateMap = new Map(slots.map((s) => [s.id, s.slotDate]));

			bookings = bookings.filter((b) => {
				const date = slotDateMap.get(b.slotId);
				if (!date) return false;
				if (dateFrom && date < dateFrom) return false;
				if (dateTo && date > dateTo) return false;
				return true;
			});
		}
	}

	// Enrich with slot and staff info
	const enrichedBookings = await Promise.all(
		bookings.map(async (booking) => {
			const slot = await db.query.appointmentSlot.findFirst({
				where: eq(schema.appointmentSlot.id, booking.slotId),
			});
			const staffUser = booking.staffUserId
				? await db.query.user.findFirst({
						where: eq(schema.user.id, booking.staffUserId),
					})
				: null;

			return {
				...booking,
				slot: slot ?? null,
				staff: staffUser
					? {
							id: staffUser.id,
							name: staffUser.name,
							email: staffUser.email,
						}
					: null,
			};
		}),
	);

	return c.json(enrichedBookings);
});

/**
 * GET /api/admin/bookings/:id
 * Get a single booking by ID.
 */
app.get("/:id", async (c) => {
	const { id } = c.req.param();

	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, id),
	});

	if (!booking) {
		return errorResponse("NOT_FOUND", "Booking not found", 404);
	}

	// Enrich with slot and staff info
	const slot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, booking.slotId),
	});
	const staffUser = booking.staffUserId
		? await db.query.user.findFirst({
				where: eq(schema.user.id, booking.staffUserId),
			})
		: null;

	return c.json({
		...booking,
		slot: slot ?? null,
		staff: staffUser
			? {
					id: staffUser.id,
					name: staffUser.name,
					email: staffUser.email,
				}
			: null,
	});
});

/**
 * GET /api/admin/bookings/:id/capacity
 * Check capacity availability for booking at a specific slot/staff.
 * Returns current capacity state without creating a booking.
 */
app.get("/:id/capacity", async (c) => {
	const { id } = c.req.param();

	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, id),
	});

	if (!booking) {
		return errorResponse("NOT_FOUND", "Booking not found", 404);
	}

	if (!booking.staffUserId) {
		return errorResponse("INVALID_STATE", "Booking has no staff assigned", 422);
	}

	const capacityCheck = await checkCapacity(
		booking.slotId,
		booking.staffUserId,
	);

	return c.json(capacityCheck);
});

// =============================================================================
// BOOKING TRANSITIONS
// =============================================================================

/**
 * POST /api/admin/bookings/:id/confirm
 * Confirm a held booking (transition from held to confirmed).
 */
app.post("/:id/confirm", async (c) => {
	const { id } = c.req.param();

	const result = await confirmBooking(id);

	if (!result.success) {
		const errorCode =
			result.error === "Booking not found"
				? "NOT_FOUND"
				: "CONFIRMATION_FAILED";
		return errorResponse(
			errorCode,
			result.error ?? "Unknown error",
			errorCode === "NOT_FOUND" ? 404 : 422,
		);
	}

	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, id),
	});

	return c.json(booking);
});

/**
 * POST /api/admin/bookings/:id/release
 * Release a booking (cancel, expire, or mark as attended).
 *
 * Request body:
 * - reason: required, "cancelled" | "expired" | "attended"
 */
app.post("/:id/release", async (c) => {
	const { id } = c.req.param();
	const body = await c.req.json();

	if (
		!body.reason ||
		!["cancelled", "expired", "attended"].includes(body.reason)
	) {
		return errorResponse(
			"INVALID_REASON",
			"reason must be 'cancelled', 'expired', or 'attended'",
			422,
		);
	}

	const result = await releaseCapacity(id, body.reason);

	if (!result.success && !result.alreadyReleased) {
		const errorCode =
			result.error === "Booking not found" ? "NOT_FOUND" : "RELEASE_FAILED";
		return errorResponse(
			errorCode,
			result.error ?? "Unknown error",
			errorCode === "NOT_FOUND" ? 404 : 422,
		);
	}

	// Fetch updated booking
	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, id),
	});

	return c.json({
		booking,
		alreadyReleased: result.alreadyReleased,
	});
});

// =============================================================================
// REASSIGNMENT
// =============================================================================

/**
 * POST /api/admin/bookings/:id/reassign
 * Reassign a booking to a different staff member.
 *
 * Request body:
 * - targetStaffUserId: required, ID of the target staff user
 */
app.post("/:id/reassign", async (c) => {
	const { id } = c.req.param();
	const body = await c.req.json();

	if (!body.targetStaffUserId) {
		return errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"targetStaffUserId is required",
			422,
		);
	}

	// Validate target staff exists
	const targetStaff = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, body.targetStaffUserId),
	});

	if (!targetStaff) {
		return errorResponse("NOT_FOUND", "Target staff profile not found", 404);
	}

	const result = await reassignBooking(id, body.targetStaffUserId);

	if (!result.success) {
		if (result.error === "Booking not found") {
			return errorResponse(
				"NOT_FOUND",
				result.error ?? "Booking not found",
				404,
			);
		}
		if (
			result.error === "STALE_ACTIVE_BOOKING" ||
			result.error === "Cannot reassign inactive booking"
		) {
			// Get current active booking for the request to provide reference
			const booking = await db.query.booking.findFirst({
				where: eq(schema.booking.id, id),
			});
			let currentActiveBookingId: string | null = null;
			if (booking?.requestId) {
				const serviceRequest = await db.query.serviceRequest.findFirst({
					where: eq(schema.serviceRequest.id, booking.requestId),
				});
				currentActiveBookingId = serviceRequest?.activeBookingId ?? null;
			}
			return c.json(
				{
					code: "STALE_ACTIVE_BOOKING",
					message: result.error,
					currentActiveBookingId,
				},
				409,
			);
		}
		if (
			result.error === "Target staff is not active or not assignable" ||
			result.error === "Target staff is unavailable on this date" ||
			result.error === "STAFF_NOT_ASSIGNABLE" ||
			result.error === "STAFF_UNAVAILABLE"
		) {
			return c.json(
				{
					code: "STAFF_NOT_ASSIGNABLE",
					message: result.error,
					conflicts: result.conflicts,
				},
				409,
			);
		}
		if (result.error === "Target staff lacks capacity") {
			return conflictResponse(result.conflicts);
		}
		return errorResponse(
			"REASSIGNMENT_FAILED",
			result.error ?? "Unknown error",
			422,
		);
	}

	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, id),
	});

	return c.json(booking);
});

/**
 * POST /api/admin/bookings/:id/reassign/preview
 * Preview a reassignment without applying it.
 *
 * Request body:
 * - targetStaffUserId: required, ID of the target staff user
 *
 * Returns dry run result with conflicts and warnings, no side effects.
 */
app.post("/:id/reassign/preview", async (c) => {
	const { id } = c.req.param();
	const body = await c.req.json();

	if (!body.targetStaffUserId) {
		return errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"targetStaffUserId is required",
			422,
		);
	}

	const preview = await previewReassignment(id, body.targetStaffUserId);

	return c.json({
		dryRun: true,
		...preview,
	});
});

/**
 * POST /api/admin/bookings/reassignments/preview
 * Preview bulk reassignments without applying them.
 *
 * Request body:
 * - reassignments: required, array of { bookingId, targetStaffUserId }
 *
 * Returns eligible, excluded, and conflicts per booking.
 */
app.post("/reassignments/preview", async (c) => {
	const body = await c.req.json();

	if (!body.reassignments || !Array.isArray(body.reassignments)) {
		return errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"reassignments array is required",
			422,
		);
	}

	if (body.reassignments.length === 0) {
		return errorResponse(
			"BATCH_SCOPE_REQUIRED",
			"At least one reassignment is required",
			422,
		);
	}

	// Limit batch size
	const MAX_BATCH_SIZE = 100;
	if (body.reassignments.length > MAX_BATCH_SIZE) {
		return errorResponse(
			"BATCH_LIMIT_EXCEEDED",
			`Maximum batch size is ${MAX_BATCH_SIZE}`,
			422,
		);
	}

	// Validate no duplicate booking IDs
	const bookingIds = body.reassignments.map(
		(r: { bookingId: string }) => r.bookingId,
	);
	const uniqueBookingIds = new Set(bookingIds);
	if (bookingIds.length !== uniqueBookingIds.size) {
		return errorResponse(
			"INVALID_SCOPE",
			"Duplicate bookingId values in batch",
			422,
		);
	}

	const preview = await previewReassignments(
		body.reassignments.map(
			(r: { bookingId: string; targetStaffUserId: string }) => ({
				bookingId: r.bookingId,
				targetStaffUserId: r.targetStaffUserId,
			}),
		),
	);

	return c.json({
		dryRun: true,
		...preview,
	});
});

/**
 * POST /api/admin/bookings/reassignments
 * Execute bulk reassignments.
 *
 * Request body:
 * - reassignments: required, array of { bookingId, targetStaffUserId }
 * - executionMode: optional, "best_effort" (default) or "atomic"
 *
 * best_effort: applies each item, fails don't affect others
 * atomic: all succeed or all fail
 */
app.post("/reassignments", async (c) => {
	const body = await c.req.json();

	if (!body.reassignments || !Array.isArray(body.reassignments)) {
		return errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"reassignments array is required",
			422,
		);
	}

	if (body.reassignments.length === 0) {
		return errorResponse(
			"BATCH_SCOPE_REQUIRED",
			"At least one reassignment is required",
			422,
		);
	}

	// Limit batch size
	const MAX_BATCH_SIZE = 100;
	if (body.reassignments.length > MAX_BATCH_SIZE) {
		return errorResponse(
			"BATCH_LIMIT_EXCEEDED",
			`Maximum batch size is ${MAX_BATCH_SIZE}`,
			422,
		);
	}

	// Validate no duplicate booking IDs
	const bookingIds = body.reassignments.map(
		(r: { bookingId: string }) => r.bookingId,
	);
	const uniqueBookingIds = new Set(bookingIds);
	if (bookingIds.length !== uniqueBookingIds.size) {
		return errorResponse(
			"INVALID_SCOPE",
			"Duplicate bookingId values in batch",
			422,
		);
	}

	const executionMode = body.executionMode ?? "best_effort";
	if (!["best_effort", "atomic"].includes(executionMode)) {
		return errorResponse(
			"INVALID_EXECUTION_MODE",
			"executionMode must be 'best_effort' or 'atomic'",
			422,
		);
	}

	const result = await executeBulkReassignments(
		body.reassignments.map(
			(r: { bookingId: string; targetStaffUserId: string }) => ({
				bookingId: r.bookingId,
				targetStaffUserId: r.targetStaffUserId,
			}),
		),
		executionMode,
	);

	// Determine appropriate HTTP status
	const status =
		result.failedCount === 0 ? 200 : result.appliedCount === 0 ? 409 : 207; // Multi-status for partial success

	return c.json(result, status);
});

// =============================================================================
// AVAILABILITY CHECKS
// =============================================================================

/**
 * GET /api/admin/bookings/availability?slotId=xxx&staffUserId=yyy
 * Check if a booking can be made for the given slot and staff.
 * Returns capacity details without creating a booking.
 */
app.get("/availability/check", async (c) => {
	const slotId = c.req.query("slotId");
	const staffUserId = c.req.query("staffUserId");

	if (!slotId || !staffUserId) {
		return errorResponse(
			"MISSING_REQUIRED_FIELDS",
			"slotId and staffUserId query parameters are required",
			422,
		);
	}

	const capacityCheck = await checkCapacity(slotId, staffUserId);

	return c.json(capacityCheck);
});

export { app as bookingsApp };
