import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import {
	type CapacityConflict,
	checkCapacity,
	countActiveSlotBookings,
	countActiveStaffBookingsOnDate,
	releaseCapacity,
	resolveStaffAvailabilityAndCapacity,
} from "../../features/bookings/capacity.service";
import { db, schema } from "../../lib/db";
import { rpc } from "../context";
import {
	assertAdminBookingKind,
	assertMutableState,
	assertOptimisticConcurrency,
	checkIdempotencyKey,
	hashPayload,
	parseIdempotencyKey,
	parseIfMatch,
	requireAdminAccess,
	resolveCachedIdempotencyResponse,
	storeIdempotencyKey,
	throwCapacityConflict,
	throwIdempotencyAwareError,
	throwRpcError,
} from "../shared";

export function createReservationsRouter() {
	return {
		get: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			const payload = input as { bookingId: string };

			const booking = await db.query.booking.findFirst({
				where: eq(schema.booking.id, payload.bookingId),
			});
			if (!booking) {
				throwRpcError("NOT_FOUND", 404, "Reservation not found");
			}

			const slot = await db.query.appointmentSlot.findFirst({
				where: eq(schema.appointmentSlot.id, booking.slotId),
			});
			const series = booking.seriesKey
				? await db.query.bookingSeries.findFirst({
						where: eq(schema.bookingSeries.id, booking.seriesKey),
					})
				: null;

			return { ...booking, slot, series };
		}),
		update: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			const payload = input as {
				bookingId: string;
				staffUserId?: string;
				notes?: string | null;
			};
			const ifMatch = parseIfMatch(context.headers.get("if-match"));

			const booking = await db.query.booking.findFirst({
				where: eq(schema.booking.id, payload.bookingId),
			});
			if (!booking) {
				throwRpcError("NOT_FOUND", 404, "Reservation not found");
			}

			assertOptimisticConcurrency(booking.updatedAt, ifMatch);
			assertMutableState(booking);
			assertAdminBookingKind(booking);

			const now = new Date();
			const updates: Partial<typeof schema.booking.$inferInsert> = {
				updatedAt: now,
			};

			if (payload.staffUserId !== undefined) {
				const capacityCheck = await checkCapacity(
					booking.slotId,
					payload.staffUserId,
				);
				if (!capacityCheck.available) {
					throwCapacityConflict(capacityCheck.conflicts);
				}
				updates.staffUserId = payload.staffUserId;
			}

			if (payload.notes !== undefined) {
				updates.notes = payload.notes;
			}

			const currentSnapshot =
				(booking.snapshot as Record<string, unknown>) || {};
			updates.snapshot = {
				...currentSnapshot,
				detached: true,
				detachedAt: now.toISOString(),
				detachedFromSeries: booking.seriesKey,
			};

			await db
				.update(schema.booking)
				.set(updates)
				.where(eq(schema.booking.id, payload.bookingId));

			return await db.query.booking.findFirst({
				where: eq(schema.booking.id, payload.bookingId),
			});
		}),
		release: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			const payload = input as { bookingId: string; reason?: string };
			const idempotencyKey = parseIdempotencyKey(
				context.headers.get("idempotency-key"),
			);
			const idempotencyPayload = {
				bookingId: payload.bookingId,
				reason: payload.reason,
			};

			if (idempotencyKey) {
				const check = await checkIdempotencyKey(
					idempotencyKey,
					"release",
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

			const booking = await db.query.booking.findFirst({
				where: eq(schema.booking.id, payload.bookingId),
			});
			if (!booking) {
				await throwIdempotencyAwareError({
					key: idempotencyKey,
					operation: "release",
					targetId: payload.bookingId,
					payload: idempotencyPayload,
					code: "NOT_FOUND",
					status: 404,
					message: "Reservation not found",
				});
			}
			const bookingRecord = booking as NonNullable<typeof booking>;

			if (
				!payload.reason ||
				!["cancelled", "expired", "attended"].includes(payload.reason)
			) {
				await throwIdempotencyAwareError({
					key: idempotencyKey,
					operation: "release",
					targetId: payload.bookingId,
					payload: idempotencyPayload,
					code: "INVALID_REASON",
					status: 422,
					message: "reason must be 'cancelled', 'expired', or 'attended'",
				});
			}

			try {
				assertAdminBookingKind(bookingRecord);
				assertMutableState(bookingRecord);
			} catch (error) {
				if (idempotencyKey && error instanceof ORPCError) {
					await storeIdempotencyKey(
						idempotencyKey,
						"release",
						payload.bookingId,
						hashPayload(idempotencyPayload),
						error.status,
						{ code: error.code, message: error.message },
					);
				}
				throw error;
			}

			const result = await releaseCapacity(
				payload.bookingId,
				payload.reason as "cancelled" | "expired" | "attended",
			);

			if (!result.success && !result.alreadyReleased) {
				const code =
					result.error === "Booking not found" ? "NOT_FOUND" : "RELEASE_FAILED";
				await throwIdempotencyAwareError({
					key: idempotencyKey,
					operation: "release",
					targetId: payload.bookingId,
					payload: idempotencyPayload,
					code,
					status: code === "NOT_FOUND" ? 404 : 422,
					message: result.error ?? "Unknown error",
				});
			}

			const updated = await db.query.booking.findFirst({
				where: eq(schema.booking.id, payload.bookingId),
			});
			if (!updated) {
				throwRpcError("NOT_FOUND", 404, "Reservation not found");
			}
			const responseBody = {
				booking: updated,
				alreadyReleased: result.alreadyReleased,
			};

			if (idempotencyKey) {
				await storeIdempotencyKey(
					idempotencyKey,
					"release",
					payload.bookingId,
					hashPayload(idempotencyPayload),
					200,
					responseBody,
				);
			}

			return responseBody;
		}),
		move: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			const payload = input as {
				bookingId: string;
				targetSlotId?: string;
				targetStaffUserId?: string;
			};
			const idempotencyKey = parseIdempotencyKey(
				context.headers.get("idempotency-key"),
			);
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
		}),
	};
}
