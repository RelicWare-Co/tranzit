import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import {
	assertAdminBookingKind,
	assertMutableState,
	checkIdempotencyKey,
	hashPayload,
	parseIdempotencyKey,
	resolveCachedIdempotencyResponse,
	storeIdempotencyKey,
	throwCapacityConflict,
	throwIdempotencyAwareError,
	throwRpcError,
} from "../../shared/orpc";
import { buildBookingSummary, createAuditEvent } from "../audit/audit.service";
import type { CapacityConflict } from "../bookings/capacity.types";
import {
	countActiveSlotBookings,
	countActiveStaffBookingsOnDate,
	resolveStaffAvailabilityAndCapacity,
} from "../bookings/capacity-check.service";

export async function moveReservationInstance(params: {
	input: {
		bookingId: string;
		targetSlotId?: string;
		targetStaffUserId?: string;
	};
	idempotencyKeyHeader?: string | null;
	ipAddress?: string | null;
	userAgent?: string | null;
}) {
	const payload = params.input;
	const idempotencyKey = parseIdempotencyKey(params.idempotencyKeyHeader);
	const idempotencyPayload = {
		bookingId: payload.bookingId,
		targetSlotId: payload.targetSlotId,
		targetStaffUserId: payload.targetStaffUserId,
	};

	if (idempotencyKey) {
		const check = await checkIdempotencyKey(
			idempotencyKey,
			"move",
			payload.bookingId,
			hashPayload(idempotencyPayload),
		);
		if (check.exists) {
			if (check.conflict) {
				throwRpcError(
					"IDEMPOTENCY_KEY_CONFLICT",
					409,
					"Idempotency-Key was already used with a different payload",
				);
			}
			return resolveCachedIdempotencyResponse(check.response);
		}
	}

	if (!payload.targetSlotId) {
		await throwIdempotencyAwareError({
			key: idempotencyKey,
			operation: "move",
			targetId: payload.bookingId,
			payload: idempotencyPayload,
			code: "MISSING_REQUIRED_FIELDS",
			status: 422,
			message: "targetSlotId is required",
		});
	}
	const targetSlotId = payload.targetSlotId ?? "";

	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, payload.bookingId),
	});
	if (!booking) {
		await throwIdempotencyAwareError({
			key: idempotencyKey,
			operation: "move",
			targetId: payload.bookingId,
			payload: idempotencyPayload,
			code: "NOT_FOUND",
			status: 404,
			message: "Reservation not found",
		});
	}
	const bookingRecord = booking as NonNullable<typeof booking>;

	try {
		assertMutableState(bookingRecord);
		assertAdminBookingKind(bookingRecord);
	} catch (error) {
		if (idempotencyKey && error instanceof ORPCError) {
			await storeIdempotencyKey(
				idempotencyKey,
				"move",
				payload.bookingId,
				hashPayload(idempotencyPayload),
				error.status,
				{ code: error.code, message: error.message },
			);
		}
		throw error;
	}

	const targetSlot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, targetSlotId),
	});
	if (!targetSlot) {
		await throwIdempotencyAwareError({
			key: idempotencyKey,
			operation: "move",
			targetId: payload.bookingId,
			payload: idempotencyPayload,
			code: "NOT_FOUND",
			status: 404,
			message: "Target slot not found",
		});
	}

	if (!bookingRecord.staffUserId) {
		await throwIdempotencyAwareError({
			key: idempotencyKey,
			operation: "move",
			targetId: payload.bookingId,
			payload: idempotencyPayload,
			code: "INVALID_STATE",
			status: 422,
			message: "Booking has no staff assigned",
		});
	}

	const currentStaffUserId = bookingRecord.staffUserId ?? "";
	const staffUserId = payload.targetStaffUserId || currentStaffUserId;

	try {
		await db.transaction(async (tx) => {
			const currentBooking = await tx.query.booking.findFirst({
				where: eq(schema.booking.id, payload.bookingId),
			});

			if (!currentBooking?.isActive) {
				throw {
					code: "BOOKING_NOT_MUTABLE",
					status: 409,
					message: "Reservation is no longer mutable",
				};
			}

			const destinationSlot = await tx.query.appointmentSlot.findFirst({
				where: eq(schema.appointmentSlot.id, targetSlotId),
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
					staffUserId,
					statusReason: "Moved by administrative instance operation",
					updatedAt: new Date(),
				})
				.where(eq(schema.booking.id, payload.bookingId));
		});
	} catch (err) {
		if (err && typeof err === "object" && "code" in err) {
			const errorObj = err as {
				code: string;
				status: number;
				message?: string;
				conflicts?: CapacityConflict[];
			};

			if (idempotencyKey) {
				await storeIdempotencyKey(
					idempotencyKey,
					"move",
					payload.bookingId,
					hashPayload(idempotencyPayload),
					errorObj.status,
					{
						code: errorObj.code,
						message: errorObj.message ?? "Reservation move failed",
						conflicts: errorObj.conflicts,
					},
				);
			}

			if (errorObj.code === "CAPACITY_CONFLICT") {
				throwCapacityConflict(errorObj.conflicts ?? []);
			}
			throwRpcError(
				errorObj.code,
				errorObj.status,
				errorObj.message ?? "Reservation move failed",
			);
		}
		throw err;
	}

	const updated = await db.query.booking.findFirst({
		where: eq(schema.booking.id, payload.bookingId),
	});
	if (!updated) {
		throwRpcError("NOT_FOUND", 404, "Reservation not found");
	}

	// Create audit event for instance move
	await createAuditEvent({
		actorType: "admin",
		entityType: "booking",
		entityId: payload.bookingId,
		action: "move",
		summary: buildBookingSummary("moved", payload.bookingId, {
			reason: `to slot ${payload.targetSlotId}`,
		}),
		payload: {
			bookingId: payload.bookingId,
			targetSlotId: payload.targetSlotId,
			targetStaffUserId: payload.targetStaffUserId,
		},
		ipAddress: params.ipAddress ?? null,
		userAgent: params.userAgent ?? null,
	});

	if (idempotencyKey) {
		await storeIdempotencyKey(
			idempotencyKey,
			"move",
			payload.bookingId,
			hashPayload(idempotencyPayload),
			200,
			updated,
		);
	}

	return updated;
}
