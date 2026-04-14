import { and, eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import {
	checkIdempotencyKey,
	hashPayload,
	parseIdempotencyKey,
	resolveCachedIdempotencyResponse,
	storeIdempotencyKey,
	throwCapacityConflict,
	throwIdempotencyAwareError,
	throwRpcError,
} from "../../orpc/shared";
import {
	type CapacityConflict,
	countActiveSlotBookings,
	countActiveStaffBookingsOnDate,
	resolveStaffAvailabilityAndCapacity,
} from "../bookings/capacity.service";

export async function moveReservationSeries(params: {
	input: {
		id: string;
		targetSlotId?: string;
		targetStaffUserId?: string;
	};
	idempotencyKeyHeader?: string | null;
}) {
	const payload = params.input;
	const idempotencyKey = parseIdempotencyKey(params.idempotencyKeyHeader);
	const idempotencyPayload = {
		seriesId: payload.id,
		targetSlotId: payload.targetSlotId,
		targetStaffUserId: payload.targetStaffUserId,
	};

	if (idempotencyKey) {
		const check = await checkIdempotencyKey(
			idempotencyKey,
			"move_series",
			payload.id,
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
			operation: "move_series",
			targetId: payload.id,
			payload: idempotencyPayload,
			code: "MISSING_REQUIRED_FIELDS",
			status: 422,
			message: "targetSlotId is required",
		});
	}
	const targetSlotId = payload.targetSlotId ?? "";

	const series = await db.query.bookingSeries.findFirst({
		where: eq(schema.bookingSeries.id, payload.id),
	});
	if (!series) {
		await throwIdempotencyAwareError({
			key: idempotencyKey,
			operation: "move_series",
			targetId: payload.id,
			payload: idempotencyPayload,
			code: "NOT_FOUND",
			status: 404,
			message: "Series not found",
		});
	}

	const targetSlot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, targetSlotId),
	});
	if (!targetSlot) {
		await throwIdempotencyAwareError({
			key: idempotencyKey,
			operation: "move_series",
			targetId: payload.id,
			payload: idempotencyPayload,
			code: "NOT_FOUND",
			status: 404,
			message: "Target slot not found",
		});
	}
	const targetSlotRecord = targetSlot as NonNullable<typeof targetSlot>;

	const activeBookings = await db.query.booking.findMany({
		where: and(
			eq(schema.booking.seriesKey, payload.id),
			eq(schema.booking.isActive, true),
		),
	});
	if (activeBookings.length === 0) {
		await throwIdempotencyAwareError({
			key: idempotencyKey,
			operation: "move_series",
			targetId: payload.id,
			payload: idempotencyPayload,
			code: "NO_ACTIVE_INSTANCES",
			status: 422,
			message: "Series has no active instances to move",
		});
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
					payload.targetStaffUserId || booking.staffUserId;
				let destinationSlot = await tx.query.appointmentSlot.findFirst({
					where: and(
						eq(schema.appointmentSlot.slotDate, currentSlot.slotDate),
						eq(schema.appointmentSlot.startTime, targetSlotRecord.startTime),
					),
				});

				if (!destinationSlot) {
					const destinationSlotId = crypto.randomUUID();
					await tx.insert(schema.appointmentSlot).values({
						id: destinationSlotId,
						slotDate: currentSlot.slotDate,
						startTime: targetSlotRecord.startTime,
						endTime: targetSlotRecord.endTime,
						status: "open",
						capacityLimit: targetSlotRecord.capacityLimit,
						generatedFrom: "series",
						metadata: {
							movedFromSeriesId: payload.id,
							targetSlotTemplateId: targetSlotRecord.id,
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
					"move_series",
					payload.id,
					hashPayload(idempotencyPayload),
					errorObj.status,
					{
						code: errorObj.code,
						message: errorObj.message ?? "Series move failed",
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
				errorObj.message ?? "Series move failed",
			);
		}
		throw err;
	}

	const responseBody = {
		seriesId: payload.id,
		movedCount: movedIds.length,
		movedInstanceIds: movedIds,
		targetSlotId: payload.targetSlotId,
		targetStaffUserId: payload.targetStaffUserId,
	};

	if (idempotencyKey) {
		await storeIdempotencyKey(
			idempotencyKey,
			"move_series",
			payload.id,
			hashPayload(idempotencyPayload),
			200,
			responseBody,
		);
	}

	return responseBody;
}
