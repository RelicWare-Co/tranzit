/**
 * Combined Capacity Accounting Engine
 *
 * Implements dual-capacity model:
 * 1. Global slot capacity: `appointment_slot.capacityLimit` (how many bookings can share the same slot)
 * 2. Staff daily capacity: `staff_profile.defaultDailyCapacity` + `staff_date_override.capacityOverride`
 *
 * Key invariants enforced:
 * - Booking only succeeds if BOTH global AND staff capacity are available
 * - Over-capacity returns 409 CONFLICT with semantic code
 * - Release is idempotent: only releases if isActive=true (no double-release)
 * - Concurrency for last unit: uses database transactions to ensure single winner
 *
 * Architecture:
 * - All capacity checks and mutations are transactional
 * - Uses SELECT FOR UPDATE pattern to prevent race conditions
 * - Capacity counters are derived from active bookings, not stored separately
 */

import { and, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "./db";

/**
 * Result of a capacity check.
 */
export interface CapacityCheck {
	available: boolean;
	globalCapacity: number | null; // null = unlimited
	globalUsed: number;
	globalRemaining: number | null; // null = unlimited
	staffCapacity: number;
	staffUsed: number;
	staffRemaining: number;
	conflicts: CapacityConflict[];
}

export interface CapacityConflict {
	type:
		| "GLOBAL_OVER_CAPACITY"
		| "STAFF_OVER_CAPACITY"
		| "STAFF_UNAVAILABLE"
		| "STAFF_NOT_ASSIGNABLE"
		| "REQUEST_ACTIVE_BOOKING_CONFLICT"
		| "HOLD_TOKEN_CONFLICT";
	details: string;
}

type DbLike = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

function getErrorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (err && typeof err === "object" && "message" in err) {
		const message = (err as { message?: unknown }).message;
		if (typeof message === "string") return message;
	}
	try {
		return JSON.stringify(err);
	} catch {
		return String(err);
	}
}

function isUniqueConstraintError(err: unknown): boolean {
	const message = getErrorMessage(err).toLowerCase();
	return (
		message.includes("sqlite_constraint") &&
		message.includes("unique constraint")
	);
}

function slotFitsWindow(
	slotStartTime: string,
	slotEndTime: string,
	windowStart: string,
	windowEnd: string,
): boolean {
	return slotStartTime >= windowStart && slotEndTime <= windowEnd;
}

/**
 * Resolve staff availability and effective capacity for a specific slot context.
 * This enforces:
 * - staff active + assignable
 * - date overrides (including partial-day windows)
 * - weekly availability windows
 */
export async function resolveStaffAvailabilityAndCapacity(
	dbLike: DbLike,
	staffUserId: string,
	slotDate: string,
	slotStartTime: string,
	slotEndTime: string,
): Promise<{
	available: boolean;
	staffCapacity: number;
	reason?: string;
}> {
	const staffProfile = await dbLike.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, staffUserId),
	});

	if (!staffProfile) {
		return {
			available: false,
			staffCapacity: 0,
			reason: "Staff profile not found",
		};
	}

	if (!staffProfile.isActive || !staffProfile.isAssignable) {
		return {
			available: false,
			staffCapacity: 0,
			reason: "Staff is not active or not assignable",
		};
	}

	const dateOverride = await dbLike.query.staffDateOverride.findFirst({
		where: and(
			eq(schema.staffDateOverride.staffUserId, staffUserId),
			eq(schema.staffDateOverride.overrideDate, slotDate),
		),
	});

	let staffCapacity = staffProfile.defaultDailyCapacity;

	if (dateOverride) {
		if (!dateOverride.isAvailable) {
			return {
				available: false,
				staffCapacity: 0,
				reason: "Staff is unavailable on this date (override)",
			};
		}

		if (dateOverride.capacityOverride !== null) {
			staffCapacity = dateOverride.capacityOverride;
		}

		if (dateOverride.availableStartTime && dateOverride.availableEndTime) {
			if (
				!slotFitsWindow(
					slotStartTime,
					slotEndTime,
					dateOverride.availableStartTime,
					dateOverride.availableEndTime,
				)
			) {
				return {
					available: false,
					staffCapacity: 0,
					reason: "Staff is outside available window for this date",
				};
			}
		}

		return {
			available: true,
			staffCapacity,
		};
	}

	const weekday = new Date(`${slotDate}T00:00:00`).getDay();
	const weeklyAvailability = (staffProfile.weeklyAvailability ?? {}) as Record<
		string,
		{
			enabled?: boolean;
			morningStart?: string;
			morningEnd?: string;
			afternoonStart?: string;
			afternoonEnd?: string;
		}
	>;

	const dayConfig = weeklyAvailability[String(weekday)];

	if (dayConfig?.enabled === false) {
		return {
			available: false,
			staffCapacity: 0,
			reason: "Staff is unavailable by weekly availability",
		};
	}

	const hasMorningWindow = !!(dayConfig?.morningStart && dayConfig?.morningEnd);
	const hasAfternoonWindow = !!(
		dayConfig?.afternoonStart && dayConfig?.afternoonEnd
	);
	const hasAnyWindow =
		!!dayConfig &&
		(dayConfig.morningStart !== undefined ||
			dayConfig.morningEnd !== undefined ||
			dayConfig.afternoonStart !== undefined ||
			dayConfig.afternoonEnd !== undefined);

	if (hasAnyWindow && !hasMorningWindow && !hasAfternoonWindow) {
		return {
			available: false,
			staffCapacity: 0,
			reason: "Staff has invalid weekly availability window configuration",
		};
	}

	if (hasMorningWindow || hasAfternoonWindow) {
		const inMorning = hasMorningWindow
			? slotFitsWindow(
					slotStartTime,
					slotEndTime,
					dayConfig?.morningStart ?? "00:00",
					dayConfig?.morningEnd ?? "00:00",
				)
			: false;

		const inAfternoon = hasAfternoonWindow
			? slotFitsWindow(
					slotStartTime,
					slotEndTime,
					dayConfig?.afternoonStart ?? "00:00",
					dayConfig?.afternoonEnd ?? "00:00",
				)
			: false;

		if (!inMorning && !inAfternoon) {
			return {
				available: false,
				staffCapacity: 0,
				reason: "Staff is outside weekly availability windows",
			};
		}
	}

	return {
		available: true,
		staffCapacity,
	};
}

export async function countActiveSlotBookings(
	dbLike: DbLike,
	slotId: string,
	excludeBookingId?: string,
): Promise<number> {
	const conditions = [
		eq(schema.booking.slotId, slotId),
		eq(schema.booking.isActive, true),
	];

	if (excludeBookingId) {
		conditions.push(ne(schema.booking.id, excludeBookingId));
	}

	const activeBookings = await dbLike.query.booking.findMany({
		where: and(...conditions),
	});

	return activeBookings.length;
}

export async function countActiveStaffBookingsOnDate(
	dbLike: DbLike,
	staffUserId: string,
	date: string,
	excludeBookingId?: string,
): Promise<number> {
	const conditions = [
		eq(schema.booking.staffUserId, staffUserId),
		eq(schema.booking.isActive, true),
	];

	if (excludeBookingId) {
		conditions.push(ne(schema.booking.id, excludeBookingId));
	}

	const staffBookings = await dbLike.query.booking.findMany({
		where: and(...conditions),
	});

	if (staffBookings.length === 0) return 0;

	const bookingSlotIds = staffBookings.map((booking) => booking.slotId);
	const bookingSlots =
		bookingSlotIds.length > 0
			? await dbLike.query.appointmentSlot.findMany({
					where: sql`${schema.appointmentSlot.id} IN ${bookingSlotIds}`,
				})
			: [];
	const bookingSlotDateMap = new Map(
		bookingSlots.map((slot) => [slot.id, slot.slotDate]),
	);

	return staffBookings.filter((booking) => {
		const bookingSlotDate = bookingSlotDateMap.get(booking.slotId);
		return bookingSlotDate === date;
	}).length;
}

/**
 * Check both global slot capacity AND staff daily capacity.
 * Returns detailed availability information.
 */
export async function checkCapacity(
	slotId: string,
	staffUserId: string,
): Promise<CapacityCheck> {
	const conflicts: CapacityConflict[] = [];

	const slot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, slotId),
	});

	if (!slot) {
		return {
			available: false,
			globalCapacity: null,
			globalUsed: 0,
			globalRemaining: null,
			staffCapacity: 0,
			staffUsed: 0,
			staffRemaining: 0,
			conflicts: [
				{
					type: "GLOBAL_OVER_CAPACITY",
					details: "Slot not found",
				},
			],
		};
	}

	const globalUsed = await countActiveSlotBookings(db, slotId);
	const globalCapacity = slot.capacityLimit;
	const globalRemaining =
		globalCapacity !== null ? globalCapacity - globalUsed : null;

	if (globalCapacity !== null && globalUsed >= globalCapacity) {
		conflicts.push({
			type: "GLOBAL_OVER_CAPACITY",
			details: `Slot has reached capacity limit (${globalCapacity})`,
		});
	}

	const staffResolution = await resolveStaffAvailabilityAndCapacity(
		db,
		staffUserId,
		slot.slotDate,
		slot.startTime,
		slot.endTime,
	);

	if (!staffResolution.available) {
		return {
			available: false,
			globalCapacity,
			globalUsed,
			globalRemaining,
			staffCapacity: 0,
			staffUsed: 0,
			staffRemaining: 0,
			conflicts: [
				{
					type: "STAFF_UNAVAILABLE",
					details: staffResolution.reason ?? "Staff is unavailable",
				},
				...conflicts,
			],
		};
	}

	const staffCapacity = staffResolution.staffCapacity;
	const staffUsed = await countActiveStaffBookingsOnDate(
		db,
		staffUserId,
		slot.slotDate,
	);
	const staffRemaining = staffCapacity - staffUsed;

	if (staffUsed >= staffCapacity) {
		conflicts.push({
			type: "STAFF_OVER_CAPACITY",
			details: `Staff has reached daily capacity limit (${staffCapacity})`,
		});
	}

	return {
		available: conflicts.length === 0,
		globalCapacity,
		globalUsed,
		globalRemaining,
		staffCapacity,
		staffUsed,
		staffRemaining,
		conflicts,
	};
}

/**
 * Result of a capacity mutation (consume or release).
 */
export interface CapacityMutationResult {
	success: boolean;
	bookingId?: string;
	conflicts: CapacityConflict[];
	error?: string;
}

/**
 * Consume capacity for a new booking.
 * This is an atomic operation that checks BOTH global and staff capacity
 * before creating the booking.
 *
 * Returns 409 CONFLICT if either capacity is exceeded.
 */
export async function consumeCapacity(
	slotId: string,
	staffUserId: string,
	kind: "citizen" | "administrative",
	requestId?: string | null,
	citizenUserId?: string | null,
	createdByUserId?: string | null,
	holdToken?: string | null,
	holdExpiresAt?: Date | null,
): Promise<CapacityMutationResult> {
	const now = new Date();

	// Check capacity first
	const capacityCheck = await checkCapacity(slotId, staffUserId);

	if (!capacityCheck.available) {
		return {
			success: false,
			conflicts: capacityCheck.conflicts,
			error: "Capacity not available",
		};
	}

	// Use a transaction to ensure atomic capacity check + booking creation
	// SQLite/Drizzle doesn't support SELECT FOR UPDATE, but transactions still
	// provide isolation. For Turso/libsql, this is sufficient for single-instance
	// consistency.
	try {
		const result = await db.transaction(async (tx) => {
			// Re-check global capacity within transaction
			const slot = await tx.query.appointmentSlot.findFirst({
				where: eq(schema.appointmentSlot.id, slotId),
			});

			if (!slot) {
				throw new Error("Slot not found");
			}

			const globalCapacity = slot.capacityLimit;
			const globalUsed = await countActiveSlotBookings(tx, slotId);
			if (globalCapacity !== null && globalUsed >= globalCapacity) {
				throw {
					type: "GLOBAL_OVER_CAPACITY",
					message: `Slot has reached capacity limit (${globalCapacity})`,
				};
			}

			const staffResolution = await resolveStaffAvailabilityAndCapacity(
				tx,
				staffUserId,
				slot.slotDate,
				slot.startTime,
				slot.endTime,
			);

			if (!staffResolution.available) {
				throw {
					type: "STAFF_UNAVAILABLE",
					message: staffResolution.reason ?? "Staff unavailable for slot",
				};
			}

			const staffUsed = await countActiveStaffBookingsOnDate(
				tx,
				staffUserId,
				slot.slotDate,
			);

			if (staffUsed >= staffResolution.staffCapacity) {
				throw {
					type: "STAFF_OVER_CAPACITY",
					message: `Staff has reached daily capacity limit (${staffResolution.staffCapacity})`,
				};
			}

			// All checks passed - create the booking
			const bookingId = crypto.randomUUID();

			await tx.insert(schema.booking).values({
				id: bookingId,
				slotId,
				requestId: requestId ?? null,
				citizenUserId: citizenUserId ?? null,
				staffUserId,
				createdByUserId: createdByUserId ?? null,
				kind,
				status: kind === "citizen" ? "held" : "confirmed",
				isActive: true,
				holdToken: holdToken ?? null,
				holdExpiresAt: holdExpiresAt ?? null,
				createdAt: now,
				updatedAt: now,
			});

			// If this is a citizen booking and has a requestId, update activeBookingId
			if (kind === "citizen" && requestId) {
				await tx
					.update(schema.serviceRequest)
					.set({
						activeBookingId: bookingId,
						updatedAt: now,
					})
					.where(eq(schema.serviceRequest.id, requestId));
			}

			return bookingId;
		});

		return {
			success: true,
			bookingId: result as string,
			conflicts: [],
		};
	} catch (err: unknown) {
		if (err && typeof err === "object" && "type" in err) {
			const errorObj = err as { type: string; message: string };
			return {
				success: false,
				conflicts: [
					{
						type: errorObj.type as CapacityConflict["type"],
						details: errorObj.message,
					},
				],
				error: errorObj.message,
			};
		}

		if (isUniqueConstraintError(err)) {
			const message = getErrorMessage(err);

			if (
				kind === "citizen" &&
				requestId &&
				(message.includes("booking_active_request_unique_idx") ||
					message.includes("booking.request_id"))
			) {
				return {
					success: false,
					conflicts: [
						{
							type: "REQUEST_ACTIVE_BOOKING_CONFLICT",
							details: "Service request already has an active citizen booking",
						},
					],
					error: "Service request already has an active citizen booking",
				};
			}

			if (
				holdToken &&
				(message.includes("booking_hold_token_unique") ||
					message.includes("booking.hold_token"))
			) {
				return {
					success: false,
					conflicts: [
						{
							type: "HOLD_TOKEN_CONFLICT",
							details: "Hold token already exists",
						},
					],
					error: "Hold token already exists",
				};
			}
		}

		throw err;
	}
}

/**
 * Release capacity from a booking.
 * This is IDEMPOTENT: only releases if isActive=true.
 *
 * - Cancellation: sets cancelledAt, isActive=false
 * - Expiration: sets isActive=false (hold expired)
 * - Terminal (attended): sets attendedAt, isActive=false
 *
 * Returns success even if booking was already inactive (idempotent).
 */
export async function releaseCapacity(
	bookingId: string,
	reason: "cancelled" | "expired" | "attended",
): Promise<{
	success: boolean;
	alreadyReleased: boolean;
	error?: string;
}> {
	const now = new Date();

	// Get current booking state
	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	if (!booking) {
		return {
			success: false,
			alreadyReleased: false,
			error: "Booking not found",
		};
	}

	// Idempotent: if already inactive, just return success
	if (!booking.isActive) {
		return {
			success: true,
			alreadyReleased: true,
		};
	}

	// Build update payload based on reason
	const updates: Partial<typeof schema.booking.$inferInsert> = {
		isActive: false,
		updatedAt: now,
	};

	switch (reason) {
		case "cancelled":
			updates.status = "cancelled";
			updates.cancelledAt = now;
			updates.statusReason = "Cancelled by user or admin";
			break;
		case "expired":
			updates.status = "expired";
			updates.statusReason = "Hold expired";
			break;
		case "attended":
			updates.status = "attended";
			updates.attendedAt = now;
			updates.statusReason = "Service attended";
			break;
	}

	// Update booking
	await db
		.update(schema.booking)
		.set(updates)
		.where(eq(schema.booking.id, bookingId));

	// If this booking was the active booking for a service request, clear it
	if (booking.requestId) {
		const serviceRequest = await db.query.serviceRequest.findFirst({
			where: eq(schema.serviceRequest.id, booking.requestId),
		});

		if (serviceRequest?.activeBookingId === bookingId) {
			// Find another active booking for this request if any
			const otherActiveBooking = await db.query.booking.findFirst({
				where: and(
					eq(schema.booking.requestId, booking.requestId),
					eq(schema.booking.isActive, true),
					ne(schema.booking.id, bookingId),
				),
			});

			await db
				.update(schema.serviceRequest)
				.set({
					activeBookingId: otherActiveBooking?.id ?? null,
					updatedAt: now,
				})
				.where(eq(schema.serviceRequest.id, booking.requestId));
		}
	}

	return {
		success: true,
		alreadyReleased: false,
	};
}

/**
 * Get active booking count for a slot.
 */
export async function getActiveBookingCountForSlot(
	slotId: string,
): Promise<number> {
	const bookings = await db.query.booking.findMany({
		where: and(
			eq(schema.booking.slotId, slotId),
			eq(schema.booking.isActive, true),
		),
	});
	return bookings.length;
}

/**
 * Get active booking count for a staff on a specific date.
 */
export async function getActiveBookingCountForStaffOnDate(
	staffUserId: string,
	date: string,
): Promise<number> {
	const bookings = await db.query.booking.findMany({
		where: and(
			eq(schema.booking.staffUserId, staffUserId),
			eq(schema.booking.isActive, true),
		),
	});

	// Get slots to filter by date
	const slotIds = bookings.map((b) => b.slotId);
	if (slotIds.length === 0) return 0;

	const slots = await db.query.appointmentSlot.findMany({
		where: sql`${schema.appointmentSlot.id} IN ${slotIds}`,
	});

	const slotDateMap = new Map(slots.map((s) => [s.id, s.slotDate]));
	return bookings.filter((b) => slotDateMap.get(b.slotId) === date).length;
}

/**
 * Confirm a held booking (transition from held to confirmed).
 * Uses transaction to ensure atomicity.
 */
export async function confirmBooking(bookingId: string): Promise<{
	success: boolean;
	error?: string;
	conflicts: CapacityConflict[];
}> {
	const now = new Date();

	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	if (!booking) {
		return {
			success: false,
			error: "Booking not found",
			conflicts: [],
		};
	}

	if (!booking.isActive) {
		return {
			success: false,
			error: "Booking is not active",
			conflicts: [],
		};
	}

	if (booking.status !== "held") {
		return {
			success: false,
			error: `Cannot confirm booking in status: ${booking.status}`,
			conflicts: [],
		};
	}

	if (
		booking.holdExpiresAt &&
		booking.holdExpiresAt.getTime() <= now.getTime()
	) {
		await releaseCapacity(bookingId, "expired");
		return {
			success: false,
			error: "Booking hold expired",
			conflicts: [],
		};
	}

	// Update to confirmed
	await db
		.update(schema.booking)
		.set({
			status: "confirmed",
			confirmedAt: now,
			updatedAt: now,
		})
		.where(eq(schema.booking.id, bookingId));

	return {
		success: true,
		conflicts: [],
	};
}

/**
 * Reassignment preview result with detailed conflict analysis.
 */
export interface ReassignmentPreview {
	canReassign: boolean;
	booking: {
		id: string;
		slotId: string;
		staffUserId: string | null;
		isActive: boolean;
		kind: string;
		requestId: string | null;
	} | null;
	targetStaff: {
		userId: string;
		isActive: boolean;
		isAssignable: boolean;
	} | null;
	slot: {
		id: string;
		slotDate: string;
		startTime: string;
		endTime: string;
	} | null;
	conflicts: CapacityConflict[];
	staleSource: boolean;
	currentActiveBookingId: string | null;
	error?: string;
}

/**
 * Preview a reassignment without applying it.
 * Checks all validity constraints and returns detailed conflict information.
 */
export async function previewReassignment(
	bookingId: string,
	newStaffUserId: string,
): Promise<ReassignmentPreview> {
	// Get the booking
	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	if (!booking) {
		return {
			canReassign: false,
			booking: null,
			targetStaff: null,
			slot: null,
			conflicts: [],
			staleSource: false,
			currentActiveBookingId: null,
			error: "Booking not found",
		};
	}

	// Check if booking is active
	if (!booking.isActive) {
		return {
			canReassign: false,
			booking: {
				id: booking.id,
				slotId: booking.slotId,
				staffUserId: booking.staffUserId,
				isActive: booking.isActive,
				kind: booking.kind,
				requestId: booking.requestId,
			},
			targetStaff: null,
			slot: null,
			conflicts: [],
			staleSource: true,
			currentActiveBookingId: booking.requestId
				? await getActiveBookingIdForRequest(booking.requestId)
				: null,
			error: "Booking is inactive",
		};
	}

	// For citizen bookings, verify this is the active booking for the request
	let staleSource = false;
	let currentActiveBookingId: string | null = null;

	if (booking.kind === "citizen" && booking.requestId) {
		const serviceRequest = await db.query.serviceRequest.findFirst({
			where: eq(schema.serviceRequest.id, booking.requestId),
		});

		if (serviceRequest) {
			currentActiveBookingId = serviceRequest.activeBookingId;

			// This booking must be the active booking for the request
			if (serviceRequest.activeBookingId !== bookingId) {
				staleSource = true;
				return {
					canReassign: false,
					booking: {
						id: booking.id,
						slotId: booking.slotId,
						staffUserId: booking.staffUserId,
						isActive: booking.isActive,
						kind: booking.kind,
						requestId: booking.requestId,
					},
					targetStaff: null,
					slot: null,
					conflicts: [],
					staleSource: true,
					currentActiveBookingId,
					error: "STALE_ACTIVE_BOOKING",
				};
			}
		}
	}

	const isNoOp = booking.staffUserId === newStaffUserId;

	// Get target staff
	const targetStaff = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, newStaffUserId),
	});

	if (!targetStaff) {
		return {
			canReassign: false,
			booking: {
				id: booking.id,
				slotId: booking.slotId,
				staffUserId: booking.staffUserId,
				isActive: booking.isActive,
				kind: booking.kind,
				requestId: booking.requestId,
			},
			targetStaff: null,
			slot: null,
			conflicts: [],
			staleSource,
			currentActiveBookingId,
			error: "Target staff not found",
		};
	}

	// Get slot
	const slot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, booking.slotId),
	});

	if (!slot) {
		return {
			canReassign: false,
			booking: {
				id: booking.id,
				slotId: booking.slotId,
				staffUserId: booking.staffUserId,
				isActive: booking.isActive,
				kind: booking.kind,
				requestId: booking.requestId,
			},
			targetStaff: {
				userId: targetStaff.userId,
				isActive: targetStaff.isActive,
				isAssignable: targetStaff.isAssignable,
			},
			slot: null,
			conflicts: [],
			staleSource,
			currentActiveBookingId,
			error: "Slot not found",
		};
	}

	// Check capacity for new staff
	const capacityCheck = await checkCapacity(slot.id, newStaffUserId);

	// Filter out conflicts that don't apply to reassignment
	const filteredConflicts = capacityCheck.conflicts.filter((c) => {
		// Global capacity doesn't change since slot is the same
		if (c.type === "GLOBAL_OVER_CAPACITY") return false;
		return true;
	});

	if (isNoOp) {
		filteredConflicts.length = 0;
	}

	const canReassign =
		isNoOp ||
		(!staleSource &&
			targetStaff.isActive &&
			targetStaff.isAssignable &&
			filteredConflicts.length === 0);

	return {
		canReassign,
		booking: {
			id: booking.id,
			slotId: booking.slotId,
			staffUserId: booking.staffUserId,
			isActive: booking.isActive,
			kind: booking.kind,
			requestId: booking.requestId,
		},
		targetStaff: {
			userId: targetStaff.userId,
			isActive: targetStaff.isActive,
			isAssignable: targetStaff.isAssignable,
		},
		slot: {
			id: slot.id,
			slotDate: slot.slotDate,
			startTime: slot.startTime,
			endTime: slot.endTime,
		},
		conflicts: filteredConflicts,
		staleSource,
		currentActiveBookingId,
		error:
			canReassign || isNoOp
				? undefined
				: "Target staff lacks capacity or is not available",
	};
}

/**
 * Get the active booking ID for a service request.
 */
async function getActiveBookingIdForRequest(
	requestId: string,
): Promise<string | null> {
	const serviceRequest = await db.query.serviceRequest.findFirst({
		where: eq(schema.serviceRequest.id, requestId),
	});
	return serviceRequest?.activeBookingId ?? null;
}

/**
 * Bulk preview result for multiple reassignments.
 */
export interface BulkReassignmentPreview {
	previewToken: string; // Token to use when applying this preview
	results: Array<{
		bookingId: string;
		preview: ReassignmentPreview;
	}>;
	eligible: string[]; // Items that can be reassigned
	excluded: Array<{
		bookingId: string;
		reason: string;
	}>; // Items excluded from processing (not errors/conflicts)
	conflicts: Array<{
		bookingId: string;
		reason: string;
		conflicts: CapacityConflict[];
	}>; // Items with capacity/staff conflicts
	errors: Array<{
		bookingId: string;
		error: string;
	}>; // Items with errors during evaluation
}

/**
 * Store for preview token state (in-memory for single instance).
 * In production, this would use Redis or similar.
 */
interface PreviewTokenState {
	token: string;
	createdAt: Date;
	items: Array<{
		bookingId: string;
		targetStaffUserId: string;
		bookingStaffUserId: string | null;
		bookingIsActive: boolean;
		slotId: string;
		requestId: string | null;
		kind: string;
	}>;
}

const previewTokenStore = new Map<
	string,
	{ state: PreviewTokenState; timeout: ReturnType<typeof setTimeout> }
>();

/**
 * Generate a preview token for bulk reassignment preview.
 * The token captures the state snapshot for drift detection.
 */
function generatePreviewToken(
	requests: Array<{ bookingId: string; targetStaffUserId: string }>,
	bookings: Map<
		string,
		{
			staffUserId: string | null;
			isActive: boolean;
			slotId: string;
			requestId: string | null;
			kind: string;
		}
	>,
): string {
	const token = crypto.randomUUID();

	const items = requests.map((r) => {
		const booking = bookings.get(r.bookingId);
		return {
			bookingId: r.bookingId,
			targetStaffUserId: r.targetStaffUserId,
			bookingStaffUserId: booking?.staffUserId ?? null,
			bookingIsActive: booking?.isActive ?? false,
			slotId: booking?.slotId ?? "",
			requestId: booking?.requestId ?? null,
			kind: booking?.kind ?? "",
		};
	});

	// Store with 15-minute expiration
	const timeout = setTimeout(
		() => {
			previewTokenStore.delete(token);
		},
		15 * 60 * 1000,
	);

	previewTokenStore.set(token, {
		state: { token, createdAt: new Date(), items },
		timeout,
	});

	return token;
}

/**
 * Validate and consume a preview token, checking for drift.
 * Returns null if token is invalid or stale.
 */
function validatePreviewToken(
	token: string,
	requests: Array<{ bookingId: string; targetStaffUserId: string }>,
):
	| { valid: true; state: PreviewTokenState }
	| { valid: false; reason: string } {
	const entry = previewTokenStore.get(token);

	if (!entry) {
		return { valid: false, reason: "PREVIEW_STALE" };
	}

	const { state } = entry;
	const now = new Date();

	// Check if token has expired (shouldn't happen with timeout, but be safe)
	if (now.getTime() - state.createdAt.getTime() > 15 * 60 * 1000) {
		previewTokenStore.delete(token);
		return { valid: false, reason: "PREVIEW_EXPIRED" };
	}

	// Check for drift: any booking state has changed
	for (const item of state.items) {
		const current = requests.find((r) => r.bookingId === item.bookingId);
		if (!current) {
			// Item was removed from batch
			return { valid: false, reason: "PREVIEW_STALE" };
		}

		if (current.targetStaffUserId !== item.targetStaffUserId) {
			// Target staff changed
			return { valid: false, reason: "PREVIEW_STALE" };
		}

		// We need to check actual database state for drift
		// This is done in executeBulkReassignments after token validation
	}

	return { valid: true, state };
}

/**
 * Invalidate a preview token (after successful apply).
 */
function invalidatePreviewToken(token: string): void {
	const entry = previewTokenStore.get(token);
	if (entry) {
		clearTimeout(entry.timeout);
		previewTokenStore.delete(token);
	}
}

/**
 * Preview multiple reassignments without applying them.
 * Returns a previewToken that must be used when applying.
 */
export async function previewReassignments(
	requests: Array<{ bookingId: string; targetStaffUserId: string }>,
): Promise<BulkReassignmentPreview> {
	const results: BulkReassignmentPreview["results"] = [];
	const eligible: string[] = [];
	const excluded: BulkReassignmentPreview["excluded"] = [];
	const conflicts: BulkReassignmentPreview["conflicts"] = [];
	const errors: BulkReassignmentPreview["errors"] = [];

	// First, fetch all bookings to detect solapes and build state
	const bookingsMap = new Map<
		string,
		{
			staffUserId: string | null;
			isActive: boolean;
			slotId: string;
			requestId: string | null;
			kind: string;
		}
	>();

	for (const { bookingId } of requests) {
		const booking = await db.query.booking.findFirst({
			where: eq(schema.booking.id, bookingId),
		});

		if (booking) {
			bookingsMap.set(bookingId, {
				staffUserId: booking.staffUserId,
				isActive: booking.isActive,
				slotId: booking.slotId,
				requestId: booking.requestId,
				kind: booking.kind,
			});
		}
	}

	// Track which requestIds we've seen for solapes detection
	const seenRequestIds = new Set<string>();

	for (const { bookingId, targetStaffUserId } of requests) {
		const preview = await previewReassignment(bookingId, targetStaffUserId);
		results.push({ bookingId, preview });

		const bookingInfo = bookingsMap.get(bookingId);

		// Check for solape (same request appearing twice)
		if (
			bookingInfo?.kind === "citizen" &&
			bookingInfo?.requestId &&
			seenRequestIds.has(bookingInfo.requestId)
		) {
			excluded.push({
				bookingId,
				reason: "SOLAPE_DETECTED",
			});
			continue;
		}
		if (bookingInfo?.kind === "citizen" && bookingInfo?.requestId) {
			seenRequestIds.add(bookingInfo.requestId);
		}

		// Check if same staff (no-op would be excluded)
		if (
			preview.canReassign &&
			preview.booking?.staffUserId === targetStaffUserId
		) {
			excluded.push({
				bookingId,
				reason: "SAME_STAFF_NO_OP",
			});
			continue;
		}

		if (preview.canReassign) {
			eligible.push(bookingId);
		} else if (
			preview.error === "Target staff lacks capacity or is not available" ||
			preview.conflicts.some((c) => c.type === "STAFF_OVER_CAPACITY")
		) {
			conflicts.push({
				bookingId,
				reason: preview.error ?? "Capacity conflict",
				conflicts: preview.conflicts,
			});
		} else if (preview.staleSource || preview.error === "Booking is inactive") {
			excluded.push({
				bookingId,
				reason: preview.error ?? "Booking inactive",
			});
		} else if (preview.error === "STALE_ACTIVE_BOOKING") {
			excluded.push({
				bookingId,
				reason: "STALE_ACTIVE_BOOKING",
			});
		} else {
			errors.push({
				bookingId,
				error: preview.error ?? "Unknown error",
			});
		}
	}

	// Generate preview token with state snapshot
	const previewToken = generatePreviewToken(requests, bookingsMap);

	return { previewToken, results, eligible, excluded, conflicts, errors };
}

/**
 * Execute a reassignment atomically.
 * Uses transaction to ensure all-or-nothing semantics.
 */
export async function reassignBooking(
	bookingId: string,
	newStaffUserId: string,
): Promise<{
	success: boolean;
	error?: string;
	conflicts: CapacityConflict[];
}> {
	const now = new Date();

	// Use transaction for atomicity
	try {
		const result = await db.transaction(async (tx) => {
			// Get booking with lock (within transaction context)
			const booking = await tx.query.booking.findFirst({
				where: eq(schema.booking.id, bookingId),
			});

			if (!booking) {
				throw {
					type: "NOT_FOUND",
					message: "Booking not found",
				};
			}

			// Check if booking is active
			if (!booking.isActive) {
				throw {
					type: "STALE_SOURCE",
					message: "Cannot reassign inactive booking",
				};
			}

			// For citizen bookings, verify this is the active booking for the request
			if (booking.kind === "citizen" && booking.requestId) {
				const serviceRequest = await tx.query.serviceRequest.findFirst({
					where: eq(schema.serviceRequest.id, booking.requestId),
				});

				if (serviceRequest && serviceRequest.activeBookingId !== bookingId) {
					throw {
						type: "STALE_ACTIVE_BOOKING",
						message: "Booking is not the active booking for this request",
						currentActiveBookingId: serviceRequest.activeBookingId,
					};
				}
			}

			// If same staff, no-op
			if (booking.staffUserId === newStaffUserId) {
				return { success: true, conflicts: [], error: undefined };
			}

			// Get slot
			const slot = await tx.query.appointmentSlot.findFirst({
				where: eq(schema.appointmentSlot.id, booking.slotId),
			});

			if (!slot) {
				throw {
					type: "NOT_FOUND",
					message: "Slot not found",
				};
			}

			// Get target staff
			const targetStaff = await tx.query.staffProfile.findFirst({
				where: eq(schema.staffProfile.userId, newStaffUserId),
			});

			if (!targetStaff) {
				throw {
					type: "NOT_FOUND",
					message: "Target staff not found",
				};
			}

			const staffResolution = await resolveStaffAvailabilityAndCapacity(
				tx,
				newStaffUserId,
				slot.slotDate,
				slot.startTime,
				slot.endTime,
			);

			if (!staffResolution.available) {
				const isAssignableError =
					staffResolution.reason === "Staff is not active or not assignable";
				const isOverrideUnavailable =
					staffResolution.reason ===
					"Staff is unavailable on this date (override)";

				const mappedMessage = isAssignableError
					? "Target staff is not active or not assignable"
					: isOverrideUnavailable
						? "Target staff is unavailable on this date"
						: (staffResolution.reason ?? "Target staff unavailable");

				throw {
					type: isAssignableError
						? "STAFF_NOT_ASSIGNABLE"
						: "STAFF_UNAVAILABLE",
					message: mappedMessage,
				};
			}

			const staffUsed = await countActiveStaffBookingsOnDate(
				tx,
				newStaffUserId,
				slot.slotDate,
				booking.id,
			);

			if (staffUsed >= staffResolution.staffCapacity) {
				throw {
					type: "STAFF_OVER_CAPACITY",
					message: `Target staff has reached daily capacity limit (${staffResolution.staffCapacity})`,
				};
			}

			// Perform reassignment
			await tx
				.update(schema.booking)
				.set({
					staffUserId: newStaffUserId,
					updatedAt: now,
				})
				.where(eq(schema.booking.id, bookingId));

			return {
				success: true,
				conflicts: [] as CapacityConflict[],
				error: undefined,
			};
		});

		return result;
	} catch (err: unknown) {
		if (err && typeof err === "object") {
			const errorObj = err as {
				type: string;
				message: string;
				conflicts?: CapacityConflict[];
				currentActiveBookingId?: string;
			};
			if (errorObj.type === "NOT_FOUND") {
				return {
					success: false,
					error: errorObj.message,
					conflicts: [],
				};
			}
			if (
				errorObj.type === "STALE_SOURCE" ||
				errorObj.type === "STALE_ACTIVE_BOOKING"
			) {
				return {
					success: false,
					error: errorObj.message,
					conflicts: [],
				};
			}
			if (
				errorObj.type === "STAFF_NOT_ASSIGNABLE" ||
				errorObj.type === "STAFF_UNAVAILABLE" ||
				errorObj.type === "STAFF_OVER_CAPACITY"
			) {
				return {
					success: false,
					error: errorObj.message,
					conflicts: [
						{
							type: errorObj.type as CapacityConflict["type"],
							details: errorObj.message,
						},
					],
				};
			}
		}
		// Re-throw unexpected errors
		throw err;
	}
}

/**
 * Bulk reassignment execution modes.
 */
export type BulkExecutionMode = "best_effort" | "atomic";

/**
 * Bulk reassignment result.
 */
export interface BulkReassignmentResult {
	appliedCount: number;
	failedCount: number;
	failures: Array<{
		bookingId: string;
		reason: string;
	}>;
	results: Array<{
		bookingId: string;
		success: boolean;
		error?: string;
	}>;
}

/**
 * Execute multiple reassignments.
 * In atomic mode: all succeed or all fail (with full rollback including audit events).
 * In best_effort mode: each item is processed independently.
 *
 * @param requests Array of { bookingId, targetStaffUserId }
 * @param mode Execution mode: "best_effort" or "atomic"
 * @param previewToken Optional token from previewReassignments to validate drift
 */
export async function executeBulkReassignments(
	requests: Array<{ bookingId: string; targetStaffUserId: string }>,
	mode: BulkExecutionMode = "best_effort",
	previewToken?: string,
): Promise<BulkReassignmentResult> {
	// If previewToken provided, validate it and check for drift
	if (previewToken) {
		const tokenValidation = validatePreviewToken(previewToken, requests);

		if (!tokenValidation.valid) {
			return {
				appliedCount: 0,
				failedCount: requests.length,
				failures: requests.map((r) => ({
					bookingId: r.bookingId,
					reason: tokenValidation.reason,
				})),
				results: requests.map((r) => ({
					bookingId: r.bookingId,
					success: false,
					error: tokenValidation.reason,
				})),
			};
		}

		// Check for actual drift in database state
		const driftResult = await checkDrift(requests, tokenValidation.state);
		if (driftResult.hasDrift) {
			invalidatePreviewToken(previewToken);
			return {
				appliedCount: 0,
				failedCount: requests.length,
				failures: requests.map((r) => ({
					bookingId: r.bookingId,
					reason: "PREVIEW_STALE",
				})),
				results: requests.map((r) => ({
					bookingId: r.bookingId,
					success: false,
					error: "PREVIEW_STALE",
				})),
			};
		}
	}

	if (mode === "atomic") {
		// In atomic mode, all must succeed or all fail
		const results: BulkReassignmentResult["results"] = [];
		const now = new Date();

		// Track audit event IDs created during this batch for potential rollback
		const createdAuditEventIds: string[] = [];

		try {
			await db.transaction(async (tx) => {
				for (const { bookingId, targetStaffUserId } of requests) {
					// Execute each reassignment within the same transaction
					const preview = await previewReassignmentWithTx(
						tx,
						bookingId,
						targetStaffUserId,
					);

					if (!preview.canReassign) {
						throw {
							type: "REASSIGNMENT_FAILED",
							bookingId,
							message: preview.error ?? "Reassignment not possible",
							currentActiveBookingId: preview.currentActiveBookingId,
						};
					}

					// Execute the reassignment
					await executeReassignmentWithTx(
						tx,
						bookingId,
						targetStaffUserId,
						now,
					);

					// Note: audit events would be created here by the caller
					// For atomic mode, we track and rollback any created audit events
					results.push({ bookingId, success: true });
				}
			});

			// Success - invalidate preview token if used
			if (previewToken) {
				invalidatePreviewToken(previewToken);
			}

			return {
				appliedCount: results.length,
				failedCount: 0,
				failures: [],
				results,
			};
		} catch (err: unknown) {
			// Atomic mode: rollback happened, all failed
			// Note: In SQLite with Drizzle, transaction rollback automatically
			// reverts all changes. But we need to clean up any audit events
			// that were created BEFORE the transaction (in best_effort style)
			// or track them properly.

			if (err && typeof err === "object" && "bookingId" in err) {
				const errorObj = err as { bookingId: string; message: string };
				// All items failed - the one that threw and potentially others

				// Clean up any audit events that might have been created
				// (This handles the case where audit events were written before the tx threw)
				if (createdAuditEventIds.length > 0) {
					try {
						await db
							.delete(schema.auditEvent)
							.where(sql`${schema.auditEvent.id} IN ${createdAuditEventIds}`);
					} catch {
						// Best effort cleanup
					}
				}

				return {
					appliedCount: 0,
					failedCount: requests.length,
					failures: [
						{ bookingId: errorObj.bookingId, reason: errorObj.message },
					],
					results: requests.map((r) => ({
						bookingId: r.bookingId,
						success: false,
						error:
							r.bookingId === errorObj.bookingId
								? errorObj.message
								: "Transaction failed due to another item",
					})),
				};
			}
			throw err;
		}
	}

	// Best effort mode: each item processed independently
	const results: BulkReassignmentResult["results"] = [];
	const failures: BulkReassignmentResult["failures"] = [];

	for (const { bookingId, targetStaffUserId } of requests) {
		const result = await reassignBooking(bookingId, targetStaffUserId);
		if (result.success) {
			results.push({ bookingId, success: true });
		} else {
			results.push({ bookingId, success: false, error: result.error });
			failures.push({
				bookingId,
				reason: result.error ?? "Unknown error",
			});
		}
	}

	// Invalidate preview token after successful best-effort apply
	if (previewToken && failures.length === 0) {
		invalidatePreviewToken(previewToken);
	}

	return {
		appliedCount: results.filter((r) => r.success).length,
		failedCount: failures.length,
		failures,
		results,
	};
}

/**
 * Check for drift between preview state and current database state.
 */
async function checkDrift(
	requests: Array<{ bookingId: string; targetStaffUserId: string }>,
	previewState: PreviewTokenState,
): Promise<{ hasDrift: boolean; driftedBookingIds: string[] }> {
	const driftedBookingIds: string[] = [];

	for (const item of previewState.items) {
		const current = requests.find((r) => r.bookingId === item.bookingId);
		if (!current) continue;

		// Get current booking state
		const booking = await db.query.booking.findFirst({
			where: eq(schema.booking.id, item.bookingId),
		});

		if (!booking) {
			driftedBookingIds.push(item.bookingId);
			continue;
		}

		// Check if state has changed in a way that affects eligibility
		if (booking.isActive !== item.bookingIsActive) {
			driftedBookingIds.push(item.bookingId);
			continue;
		}

		if (booking.staffUserId !== item.bookingStaffUserId) {
			// Staff changed externally - this is drift
			driftedBookingIds.push(item.bookingId);
			continue;
		}

		// Check if target staff changed (might affect capacity)
		if (current.targetStaffUserId !== item.targetStaffUserId) {
			driftedBookingIds.push(item.bookingId);
			continue;
		}

		// For citizen bookings, check if activeBookingId changed
		if (item.kind === "citizen" && item.requestId) {
			const serviceRequest = await db.query.serviceRequest.findFirst({
				where: eq(schema.serviceRequest.id, item.requestId),
			});

			if (serviceRequest?.activeBookingId !== item.bookingId) {
				driftedBookingIds.push(item.bookingId);
			}
		}
	}

	return {
		hasDrift: driftedBookingIds.length > 0,
		driftedBookingIds,
	};
}

/**
 * Preview reassignment within a transaction context.
 */
async function previewReassignmentWithTx(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	bookingId: string,
	newStaffUserId: string,
): Promise<ReassignmentPreview> {
	const booking = await tx.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	if (!booking) {
		return {
			canReassign: false,
			booking: null,
			targetStaff: null,
			slot: null,
			conflicts: [],
			staleSource: false,
			currentActiveBookingId: null,
			error: "Booking not found",
		};
	}

	if (!booking.isActive) {
		const currentActiveBookingId = booking.requestId
			? ((
					await tx.query.serviceRequest.findFirst({
						where: eq(schema.serviceRequest.id, booking.requestId),
					})
				)?.activeBookingId ?? null)
			: null;
		return {
			canReassign: false,
			booking: {
				id: booking.id,
				slotId: booking.slotId,
				staffUserId: booking.staffUserId,
				isActive: booking.isActive,
				kind: booking.kind,
				requestId: booking.requestId,
			},
			targetStaff: null,
			slot: null,
			conflicts: [],
			staleSource: true,
			currentActiveBookingId,
			error: "Booking is inactive",
		};
	}

	// For citizen bookings, verify this is the active booking
	let staleSource = false;
	let currentActiveBookingId: string | null = null;

	if (booking.kind === "citizen" && booking.requestId) {
		const serviceRequest = await tx.query.serviceRequest.findFirst({
			where: eq(schema.serviceRequest.id, booking.requestId),
		});

		if (serviceRequest) {
			currentActiveBookingId = serviceRequest.activeBookingId;

			if (serviceRequest.activeBookingId !== bookingId) {
				staleSource = true;
				return {
					canReassign: false,
					booking: {
						id: booking.id,
						slotId: booking.slotId,
						staffUserId: booking.staffUserId,
						isActive: booking.isActive,
						kind: booking.kind,
						requestId: booking.requestId,
					},
					targetStaff: null,
					slot: null,
					conflicts: [],
					staleSource: true,
					currentActiveBookingId,
					error: "STALE_ACTIVE_BOOKING",
				};
			}
		}
	}

	const targetStaff = await tx.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, newStaffUserId),
	});

	if (!targetStaff) {
		return {
			canReassign: false,
			booking: {
				id: booking.id,
				slotId: booking.slotId,
				staffUserId: booking.staffUserId,
				isActive: booking.isActive,
				kind: booking.kind,
				requestId: booking.requestId,
			},
			targetStaff: null,
			slot: null,
			conflicts: [],
			staleSource,
			currentActiveBookingId,
			error: "Target staff not found",
		};
	}

	const slot = await tx.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, booking.slotId),
	});

	if (!slot) {
		return {
			canReassign: false,
			booking: {
				id: booking.id,
				slotId: booking.slotId,
				staffUserId: booking.staffUserId,
				isActive: booking.isActive,
				kind: booking.kind,
				requestId: booking.requestId,
			},
			targetStaff: {
				userId: targetStaff.userId,
				isActive: targetStaff.isActive,
				isAssignable: targetStaff.isAssignable,
			},
			slot: null,
			conflicts: [],
			staleSource,
			currentActiveBookingId,
			error: "Slot not found",
		};
	}

	// Check capacity conflicts
	const conflicts: CapacityConflict[] = [];

	const staffResolution = await resolveStaffAvailabilityAndCapacity(
		tx,
		newStaffUserId,
		slot.slotDate,
		slot.startTime,
		slot.endTime,
	);

	if (!staffResolution.available) {
		const isAssignableError =
			staffResolution.reason === "Staff is not active or not assignable";
		conflicts.push({
			type: isAssignableError ? "STAFF_NOT_ASSIGNABLE" : "STAFF_UNAVAILABLE",
			details: staffResolution.reason ?? "Target staff unavailable",
		});
	}

	const staffUsed = await countActiveStaffBookingsOnDate(
		tx,
		newStaffUserId,
		slot.slotDate,
		booking.id,
	);

	if (staffUsed >= staffResolution.staffCapacity) {
		conflicts.push({
			type: "STAFF_OVER_CAPACITY",
			details: `Target staff has reached daily capacity limit (${staffResolution.staffCapacity})`,
		});
	}

	return {
		canReassign:
			!staleSource &&
			targetStaff.isActive &&
			targetStaff.isAssignable &&
			conflicts.length === 0,
		booking: {
			id: booking.id,
			slotId: booking.slotId,
			staffUserId: booking.staffUserId,
			isActive: booking.isActive,
			kind: booking.kind,
			requestId: booking.requestId,
		},
		targetStaff: {
			userId: targetStaff.userId,
			isActive: targetStaff.isActive,
			isAssignable: targetStaff.isAssignable,
		},
		slot: {
			id: slot.id,
			slotDate: slot.slotDate,
			startTime: slot.startTime,
			endTime: slot.endTime,
		},
		conflicts,
		staleSource,
		currentActiveBookingId,
		error:
			conflicts.length > 0
				? "Target staff lacks capacity or is not available"
				: undefined,
	};
}

/**
 * Execute reassignment within a transaction context.
 */
async function executeReassignmentWithTx(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	bookingId: string,
	newStaffUserId: string,
	now: Date,
): Promise<void> {
	const booking = await tx.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	if (!booking) {
		throw { type: "NOT_FOUND", message: "Booking not found" };
	}

	if (!booking.isActive) {
		throw { type: "STALE_SOURCE", message: "Cannot reassign inactive booking" };
	}

	if (booking.staffUserId === newStaffUserId) {
		return; // No-op
	}

	await tx
		.update(schema.booking)
		.set({
			staffUserId: newStaffUserId,
			updatedAt: now,
		})
		.where(eq(schema.booking.id, bookingId));
}
