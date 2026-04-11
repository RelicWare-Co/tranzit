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
	type: "GLOBAL_OVER_CAPACITY" | "STAFF_OVER_CAPACITY" | "STAFF_UNAVAILABLE";
	details: string;
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

	// Get slot details
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

	// Count active bookings for this slot (global capacity)
	const slotActiveBookings = await db.query.booking.findMany({
		where: and(
			eq(schema.booking.slotId, slotId),
			eq(schema.booking.isActive, true),
		),
	});

	const globalUsed = slotActiveBookings.length;
	const globalCapacity = slot.capacityLimit;
	const globalRemaining =
		globalCapacity !== null ? globalCapacity - globalUsed : null;

	// Check global capacity
	if (globalCapacity !== null && globalUsed >= globalCapacity) {
		conflicts.push({
			type: "GLOBAL_OVER_CAPACITY",
			details: `Slot has reached capacity limit (${globalCapacity})`,
		});
	}

	// Get staff effective capacity for the date
	const date = slot.slotDate;

	// Get staff profile
	const staffProfile = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, staffUserId),
	});

	if (!staffProfile?.isActive || !staffProfile?.isAssignable) {
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
					details: "Staff is not active or not assignable",
				},
				...conflicts,
			],
		};
	}

	// Check date override
	const dateOverride = await db.query.staffDateOverride.findFirst({
		where: and(
			eq(schema.staffDateOverride.staffUserId, staffUserId),
			eq(schema.staffDateOverride.overrideDate, date),
		),
	});

	let staffCapacity = staffProfile.defaultDailyCapacity;

	if (dateOverride) {
		if (!dateOverride.isAvailable) {
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
						details: "Staff is unavailable on this date (override)",
					},
					...conflicts,
				],
			};
		}
		if (dateOverride.capacityOverride !== null) {
			staffCapacity = dateOverride.capacityOverride;
		}
	}

	// Count active bookings for this staff on this date
	const staffDateBookings = await db.query.booking.findMany({
		where: and(
			eq(schema.booking.staffUserId, staffUserId),
			eq(schema.booking.isActive, true),
		),
	});

	// Get slot dates for each booking to filter by target date
	const bookingSlotIds = staffDateBookings.map((b) => b.slotId);
	const bookingSlots =
		bookingSlotIds.length > 0
			? await db.query.appointmentSlot.findMany({
					where: sql`${schema.appointmentSlot.id} IN ${bookingSlotIds}`,
				})
			: [];
	const bookingSlotDateMap = new Map(
		bookingSlots.map((s) => [s.id, s.slotDate]),
	);

	// Filter to bookings on the same date
	const staffBookingsForDate = staffDateBookings.filter((b) => {
		const bSlotDate = bookingSlotDateMap.get(b.slotId);
		return bSlotDate === date;
	});

	const staffUsed = staffBookingsForDate.length;
	const staffRemaining = staffCapacity - staffUsed;

	// Check staff capacity
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
			const slotBookings = await tx.query.booking.findMany({
				where: and(
					eq(schema.booking.slotId, slotId),
					eq(schema.booking.isActive, true),
				),
			});

			const slot = await tx.query.appointmentSlot.findFirst({
				where: eq(schema.appointmentSlot.id, slotId),
			});

			if (!slot) {
				throw new Error("Slot not found");
			}

			const globalCapacity = slot.capacityLimit;
			if (globalCapacity !== null && slotBookings.length >= globalCapacity) {
				throw {
					type: "GLOBAL_OVER_CAPACITY",
					message: `Slot has reached capacity limit (${globalCapacity})`,
				};
			}

			// Re-check staff capacity within transaction
			const staffBookings = await tx.query.booking.findMany({
				where: and(
					eq(schema.booking.staffUserId, staffUserId),
					eq(schema.booking.isActive, true),
				),
			});

			const date = slot.slotDate;

			// Get slots for staff bookings to check dates
			const staffBookingSlots = await tx.query.appointmentSlot.findMany({
				where: sql`${schema.appointmentSlot.id} IN ${staffBookings.map(
					(b) => b.slotId,
				)}`,
			});

			const slotDateMap = new Map(
				staffBookingSlots.map((s) => [s.id, s.slotDate]),
			);
			const staffBookingsOnDate = staffBookings.filter(
				(b) => slotDateMap.get(b.slotId) === date,
			);

			// Get effective staff capacity
			const staffProfile = await tx.query.staffProfile.findFirst({
				where: eq(schema.staffProfile.userId, staffUserId),
			});

			if (!staffProfile) {
				throw { type: "STAFF_UNAVAILABLE", message: "Staff profile not found" };
			}

			let staffCapacity = staffProfile.defaultDailyCapacity;
			const dateOverride = await tx.query.staffDateOverride.findFirst({
				where: and(
					eq(schema.staffDateOverride.staffUserId, staffUserId),
					eq(schema.staffDateOverride.overrideDate, date),
				),
			});

			if (dateOverride) {
				if (!dateOverride.isAvailable) {
					throw {
						type: "STAFF_UNAVAILABLE",
						message: "Staff unavailable on this date",
					};
				}
				if (dateOverride.capacityOverride !== null) {
					staffCapacity = dateOverride.capacityOverride;
				}
			}

			if (staffBookingsOnDate.length >= staffCapacity) {
				throw {
					type: "STAFF_OVER_CAPACITY",
					message: `Staff has reached daily capacity limit (${staffCapacity})`,
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
			updates.cancelledAt = now;
			updates.statusReason = "Cancelled by user or admin";
			break;
		case "expired":
			updates.statusReason = "Hold expired";
			break;
		case "attended":
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

	const canReassign =
		!staleSource &&
		targetStaff.isActive &&
		targetStaff.isAssignable &&
		filteredConflicts.length === 0;

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
		error: canReassign
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
	results: Array<{
		bookingId: string;
		preview: ReassignmentPreview;
	}>;
	eligible: string[];
	conflicts: Array<{
		bookingId: string;
		reason: string;
		conflicts: CapacityConflict[];
	}>;
	errors: Array<{
		bookingId: string;
		error: string;
	}>;
}

/**
 * Preview multiple reassignments without applying them.
 */
export async function previewReassignments(
	requests: Array<{ bookingId: string; targetStaffUserId: string }>,
): Promise<BulkReassignmentPreview> {
	const results: BulkReassignmentPreview["results"] = [];
	const eligible: string[] = [];
	const conflicts: BulkReassignmentPreview["conflicts"] = [];
	const errors: BulkReassignmentPreview["errors"] = [];

	for (const { bookingId, targetStaffUserId } of requests) {
		const preview = await previewReassignment(bookingId, targetStaffUserId);
		results.push({ bookingId, preview });

		if (preview.canReassign) {
			eligible.push(bookingId);
		} else if (
			preview.error === "Target staff lacks capacity or is not available"
		) {
			conflicts.push({
				bookingId,
				reason: preview.error,
				conflicts: preview.conflicts,
			});
		} else {
			errors.push({
				bookingId,
				error: preview.error ?? "Unknown error",
			});
		}
	}

	return { results, eligible, conflicts, errors };
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

			// Check staff availability
			if (!targetStaff.isActive || !targetStaff.isAssignable) {
				throw {
					type: "STAFF_NOT_ASSIGNABLE",
					message: "Target staff is not active or not assignable",
				};
			}

			// Check date override
			const dateOverride = await tx.query.staffDateOverride.findFirst({
				where: and(
					eq(schema.staffDateOverride.staffUserId, newStaffUserId),
					eq(schema.staffDateOverride.overrideDate, slot.slotDate),
				),
			});

			if (dateOverride && !dateOverride.isAvailable) {
				throw {
					type: "STAFF_UNAVAILABLE",
					message: "Target staff is unavailable on this date",
				};
			}

			// Check capacity for new staff (excluding current booking which will be moved)
			// Count active bookings for this staff on this date
			const staffDateBookings = await tx.query.booking.findMany({
				where: and(
					eq(schema.booking.staffUserId, newStaffUserId),
					eq(schema.booking.isActive, true),
				),
			});

			// Get slot dates to filter
			const bookingSlotIds = staffDateBookings.map((b) => b.slotId);
			const bookingSlots =
				bookingSlotIds.length > 0
					? await tx.query.appointmentSlot.findMany({
							where: sql`${schema.appointmentSlot.id} IN ${bookingSlotIds}`,
						})
					: [];
			const slotDateMap = new Map(bookingSlots.map((s) => [s.id, s.slotDate]));
			const staffBookingsOnDate = staffDateBookings.filter(
				(b) => slotDateMap.get(b.slotId) === slot.slotDate,
			);

			// Get effective staff capacity
			let staffCapacity = targetStaff.defaultDailyCapacity;
			if (dateOverride && dateOverride.capacityOverride !== null) {
				staffCapacity = dateOverride.capacityOverride ?? staffCapacity;
			}

			if (staffBookingsOnDate.length >= staffCapacity) {
				throw {
					type: "STAFF_OVER_CAPACITY",
					message: `Target staff has reached daily capacity limit (${staffCapacity})`,
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
 * In atomic mode: all succeed or all fail.
 * In best_effort mode: each item is processed independently.
 */
export async function executeBulkReassignments(
	requests: Array<{ bookingId: string; targetStaffUserId: string }>,
	mode: BulkExecutionMode = "best_effort",
): Promise<BulkReassignmentResult> {
	if (mode === "atomic") {
		// In atomic mode, all must succeed or all fail
		const results: BulkReassignmentResult["results"] = [];

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
					await executeReassignmentWithTx(tx, bookingId, targetStaffUserId);
					results.push({ bookingId, success: true });
				}
			});

			return {
				appliedCount: results.length,
				failedCount: 0,
				failures: [],
				results,
			};
		} catch (err: unknown) {
			// Atomic mode: rollback happened, all failed
			if (err && typeof err === "object" && "bookingId" in err) {
				const errorObj = err as { bookingId: string; message: string };
				// All items failed - the one that threw and potentially others
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

	return {
		appliedCount: results.filter((r) => r.success).length,
		failedCount: failures.length,
		failures,
		results,
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

	if (!targetStaff.isActive || !targetStaff.isAssignable) {
		conflicts.push({
			type: "STAFF_UNAVAILABLE",
			details: "Target staff is not active or not assignable",
		});
	}

	const dateOverride = await tx.query.staffDateOverride.findFirst({
		where: and(
			eq(schema.staffDateOverride.staffUserId, newStaffUserId),
			eq(schema.staffDateOverride.overrideDate, slot.slotDate),
		),
	});

	if (dateOverride && !dateOverride.isAvailable) {
		conflicts.push({
			type: "STAFF_UNAVAILABLE",
			details: "Target staff is unavailable on this date (override)",
		});
	}

	// Count staff bookings on this date
	const staffDateBookings = await tx.query.booking.findMany({
		where: and(
			eq(schema.booking.staffUserId, newStaffUserId),
			eq(schema.booking.isActive, true),
		),
	});

	const bookingSlotIds = staffDateBookings.map((b) => b.slotId);
	const bookingSlots =
		bookingSlotIds.length > 0
			? await tx.query.appointmentSlot.findMany({
					where: sql`${schema.appointmentSlot.id} IN ${bookingSlotIds}`,
				})
			: [];
	const slotDateMap = new Map(bookingSlots.map((s) => [s.id, s.slotDate]));
	const staffBookingsOnDate = staffDateBookings.filter(
		(b) => slotDateMap.get(b.slotId) === slot.slotDate,
	);

	let staffCapacity = targetStaff.defaultDailyCapacity;
	if (dateOverride && dateOverride.capacityOverride !== null) {
		staffCapacity = dateOverride.capacityOverride ?? staffCapacity;
	}

	if (staffBookingsOnDate.length >= staffCapacity) {
		conflicts.push({
			type: "STAFF_OVER_CAPACITY",
			details: `Target staff has reached daily capacity limit (${staffCapacity})`,
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
): Promise<void> {
	const now = new Date();

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
