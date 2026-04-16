import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import type {
	CapacityConflict,
	CapacityMutationResult,
} from "./capacity.types";
import { isUniqueConstraintError } from "./capacity.utils";
import {
	checkCapacity,
	countActiveSlotBookings,
	countActiveStaffBookingsOnDate,
	resolveStaffAvailabilityAndCapacity,
} from "./capacity-check.service";

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

	const capacityCheck = await checkCapacity(slotId, staffUserId);

	if (!capacityCheck.available) {
		return {
			success: false,
			conflicts: capacityCheck.conflicts,
			error: "Capacity not available",
		};
	}

	try {
		const result = await db.transaction(async (tx) => {
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
			const message = err instanceof Error ? err.message : String(err);

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

export async function releaseCapacity(
	bookingId: string,
	reason: "cancelled" | "expired" | "attended",
): Promise<{
	success: boolean;
	alreadyReleased: boolean;
	error?: string;
}> {
	const now = new Date();

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

	if (!booking.isActive) {
		return {
			success: true,
			alreadyReleased: true,
		};
	}

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

	await db
		.update(schema.booking)
		.set(updates)
		.where(eq(schema.booking.id, bookingId));

	if (booking.requestId) {
		const serviceRequest = await db.query.serviceRequest.findFirst({
			where: eq(schema.serviceRequest.id, booking.requestId),
		});

		if (serviceRequest?.activeBookingId === bookingId) {
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
