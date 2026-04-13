import { and, eq, sql } from "drizzle-orm";
import {
	type CapacityConflict,
	checkCapacity,
	consumeCapacity,
	countActiveSlotBookings,
	countActiveStaffBookingsOnDate,
	releaseCapacity,
	resolveStaffAvailabilityAndCapacity,
} from "../../features/bookings/capacity.service";
import { db, schema } from "../../lib/db";
import { rpc } from "../context";
import {
	assertOptimisticConcurrency,
	checkIdempotencyKey,
	generateOccurrences,
	hashPayload,
	isDateOnOrAfter,
	parseBooleanLike,
	parseIdempotencyKey,
	parseIfMatch,
	parseRRule,
	type RecurrenceRule,
	requireAdminAccess,
	resolveCachedIdempotencyResponse,
	storeIdempotencyKey,
	throwCapacityConflict,
	throwIdempotencyAwareError,
	throwRpcError,
} from "../shared";

export function createReservationSeriesRouter() {
	return {
		create: rpc.handler(async ({ context, input }) => {
			const session = await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			const body = (input ?? {}) as {
				recurrenceRule?: RecurrenceRule | string;
				slotId?: string;
				staffUserId?: string;
				startDate?: string;
				endDate?: string;
				timezone?: string;
				notes?: string | null;
				metadata?: Record<string, unknown>;
			};
			const idempotencyKey = parseIdempotencyKey(
				context.headers.get("idempotency-key"),
			);
			const idempotencyPayload = body;

			if (idempotencyKey) {
				const check = await checkIdempotencyKey(
					idempotencyKey,
					"create_series",
					null,
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

			if (!body.recurrenceRule) {
				await throwIdempotencyAwareError({
					key: idempotencyKey,
					operation: "create_series",
					targetId: null,
					payload: idempotencyPayload,
					code: "MISSING_REQUIRED_FIELDS",
					status: 422,
					message: "recurrenceRule is required",
				});
			}
			if (!body.slotId) {
				await throwIdempotencyAwareError({
					key: idempotencyKey,
					operation: "create_series",
					targetId: null,
					payload: idempotencyPayload,
					code: "MISSING_REQUIRED_FIELDS",
					status: 422,
					message: "slotId is required",
				});
			}
			if (!body.staffUserId) {
				await throwIdempotencyAwareError({
					key: idempotencyKey,
					operation: "create_series",
					targetId: null,
					payload: idempotencyPayload,
					code: "MISSING_REQUIRED_FIELDS",
					status: 422,
					message: "staffUserId is required",
				});
			}
			if (!body.startDate || !body.endDate) {
				await throwIdempotencyAwareError({
					key: idempotencyKey,
					operation: "create_series",
					targetId: null,
					payload: idempotencyPayload,
					code: "MISSING_REQUIRED_FIELDS",
					status: 422,
					message: "startDate and endDate are required",
				});
			}
			const startDate = body.startDate ?? "";
			const endDate = body.endDate ?? "";
			const slotId = body.slotId ?? "";
			const staffUserId = body.staffUserId ?? "";

			if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
				await throwIdempotencyAwareError({
					key: idempotencyKey,
					operation: "create_series",
					targetId: null,
					payload: idempotencyPayload,
					code: "INVALID_DATE",
					status: 422,
					message: "startDate must be YYYY-MM-DD",
				});
			}
			if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
				await throwIdempotencyAwareError({
					key: idempotencyKey,
					operation: "create_series",
					targetId: null,
					payload: idempotencyPayload,
					code: "INVALID_DATE",
					status: 422,
					message: "endDate must be YYYY-MM-DD",
				});
			}
			if (endDate < startDate) {
				await throwIdempotencyAwareError({
					key: idempotencyKey,
					operation: "create_series",
					targetId: null,
					payload: idempotencyPayload,
					code: "INVALID_DATE",
					status: 422,
					message: "endDate must be >= startDate",
				});
			}

			const baseSlot = await db.query.appointmentSlot.findFirst({
				where: eq(schema.appointmentSlot.id, slotId),
			});
			if (!baseSlot) {
				await throwIdempotencyAwareError({
					key: idempotencyKey,
					operation: "create_series",
					targetId: null,
					payload: idempotencyPayload,
					code: "NOT_FOUND",
					status: 404,
					message: "Base slot not found",
				});
			}

			const staff = await db.query.staffProfile.findFirst({
				where: eq(schema.staffProfile.userId, staffUserId),
			});
			if (!staff) {
				await throwIdempotencyAwareError({
					key: idempotencyKey,
					operation: "create_series",
					targetId: null,
					payload: idempotencyPayload,
					code: "NOT_FOUND",
					status: 404,
					message: "Staff profile not found",
				});
			}

			const rule =
				typeof body.recurrenceRule === "string"
					? parseRRule(body.recurrenceRule)
					: body.recurrenceRule;

			if (
				!rule ||
				!["daily", "weekly", "biweekly", "monthly"].includes(rule.frequency)
			) {
				await throwIdempotencyAwareError({
					key: idempotencyKey,
					operation: "create_series",
					targetId: null,
					payload: idempotencyPayload,
					code: "INVALID_RULE",
					status: 422,
					message: "frequency must be daily/weekly/biweekly/monthly",
				});
			}
			const recurrenceRule: RecurrenceRule = rule ?? {
				frequency: "daily",
			};
			const baseSlotRecord = baseSlot as NonNullable<typeof baseSlot>;

			const timezone = body.timezone || "America/Bogota";
			const existingBookings = await db.query.booking.findMany({
				where: and(
					eq(schema.booking.staffUserId, staffUserId),
					eq(schema.booking.isActive, true),
				),
			});
			const existingSlotIds = existingBookings.map((booking) => booking.slotId);
			const existingSlots =
				existingSlotIds.length > 0
					? await db.query.appointmentSlot.findMany({
							where: sql`${schema.appointmentSlot.id} IN ${existingSlotIds}`,
						})
					: [];
			const existingOccurrenceKeys = new Set(
				existingSlots.map((slot) => `${slot.slotDate}|${slot.startTime}`),
			);

			const occurrences = generateOccurrences(
				recurrenceRule,
				startDate,
				endDate,
				existingOccurrenceKeys,
				baseSlotRecord.startTime,
			);
			if (occurrences.length === 0) {
				await throwIdempotencyAwareError({
					key: idempotencyKey,
					operation: "create_series",
					targetId: null,
					payload: idempotencyPayload,
					code: "NO_OCCURRENCES",
					status: 422,
					message: "No valid occurrences in date range",
				});
			}

			const slotIds: string[] = [];
			for (const date of occurrences) {
				let slot = await db.query.appointmentSlot.findFirst({
					where: and(
						eq(schema.appointmentSlot.slotDate, date),
						eq(schema.appointmentSlot.startTime, baseSlotRecord.startTime),
					),
				});

				if (!slot) {
					const newSlotId = crypto.randomUUID();
					const now = new Date();
					await db.insert(schema.appointmentSlot).values({
						id: newSlotId,
						slotDate: date,
						startTime: baseSlotRecord.startTime,
						endTime: baseSlotRecord.endTime,
						status: "open",
						capacityLimit: baseSlotRecord.capacityLimit,
						generatedFrom: "series",
						metadata: { seriesId: "pending" },
						createdAt: now,
						updatedAt: now,
					});

					slot = await db.query.appointmentSlot.findFirst({
						where: eq(schema.appointmentSlot.id, newSlotId),
					});
				}

				if (slot) slotIds.push(slot.id);
			}

			const seriesId = crypto.randomUUID();
			const now = new Date();
			await db.insert(schema.bookingSeries).values({
				id: seriesId,
				kind: "administrative",
				recurrenceRule: recurrenceRule as unknown as Record<string, unknown>,
				timezone,
				isActive: true,
				metadata: body.metadata ?? {},
				notes: body.notes ?? null,
				createdByUserId: session.user.id,
				createdAt: now,
				updatedAt: now,
			});

			const createdBookingIds: string[] = [];
			const conflicts: CapacityConflict[] = [];
			for (const slotId of slotIds) {
				const result = await consumeCapacity(
					slotId,
					staffUserId,
					"administrative",
					null,
					null,
					session.user.id,
					null,
					null,
				);

				if (!result.success) {
					conflicts.push(...result.conflicts);
				} else if (result.bookingId) {
					createdBookingIds.push(result.bookingId);
					await db
						.update(schema.booking)
						.set({ seriesKey: seriesId, updatedAt: new Date() })
						.where(eq(schema.booking.id, result.bookingId));
				}
			}

			if (conflicts.length > 0 && createdBookingIds.length === 0) {
				await db
					.delete(schema.bookingSeries)
					.where(eq(schema.bookingSeries.id, seriesId));

				if (idempotencyKey) {
					await storeIdempotencyKey(
						idempotencyKey,
						"create_series",
						null,
						hashPayload(idempotencyPayload),
						409,
						{
							code: "CAPACITY_CONFLICT",
							message: "Insufficient capacity for this operation",
							conflicts,
						},
					);
				}
				throwCapacityConflict(conflicts);
			}

			const series = await db.query.bookingSeries.findFirst({
				where: eq(schema.bookingSeries.id, seriesId),
			});
			const responseBody = {
				series,
				instanceCount: createdBookingIds.length,
				bookingIds: createdBookingIds,
				warnings:
					conflicts.length > 0
						? ["Some instances could not be created due to capacity conflicts"]
						: [],
			};

			if (idempotencyKey) {
				await storeIdempotencyKey(
					idempotencyKey,
					"create_series",
					null,
					hashPayload(idempotencyPayload),
					201,
					responseBody,
				);
			}

			return responseBody;
		}),
		list: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			const payload = (input ?? {}) as {
				isActive?: boolean | string;
				kind?: string;
			};

			const conditions = [];
			const isActive = parseBooleanLike(payload.isActive);
			if (payload.isActive !== undefined && isActive !== undefined) {
				conditions.push(eq(schema.bookingSeries.isActive, isActive));
			}
			if (payload.kind) {
				conditions.push(eq(schema.bookingSeries.kind, payload.kind));
			}

			let seriesList: Awaited<
				ReturnType<typeof db.query.bookingSeries.findMany>
			>;
			if (conditions.length > 0) {
				seriesList = await db.query.bookingSeries.findMany({
					where: and(...conditions),
				});
			} else {
				seriesList = await db.query.bookingSeries.findMany();
			}

			return await Promise.all(
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
		}),
		get: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			const payload = input as { id: string };

			const series = await db.query.bookingSeries.findFirst({
				where: eq(schema.bookingSeries.id, payload.id),
			});
			if (!series) {
				throwRpcError("NOT_FOUND", 404, "Series not found");
			}

			const bookings = await db.query.booking.findMany({
				where: eq(schema.booking.seriesKey, payload.id),
			});
			const instances = await Promise.all(
				bookings.map(async (booking) => {
					const slot = await db.query.appointmentSlot.findFirst({
						where: eq(schema.appointmentSlot.id, booking.slotId),
					});
					return { ...booking, slot };
				}),
			);

			return { series, instances };
		}),
		instances: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			const payload = input as {
				id: string;
				status?: string;
				isActive?: boolean | string;
			};

			const conditions = [eq(schema.booking.seriesKey, payload.id)];
			if (payload.status) {
				conditions.push(eq(schema.booking.status, payload.status));
			}
			const isActive = parseBooleanLike(payload.isActive);
			if (payload.isActive !== undefined && isActive !== undefined) {
				conditions.push(eq(schema.booking.isActive, isActive));
			}

			const bookings = await db.query.booking.findMany({
				where: and(...conditions),
			});
			return await Promise.all(
				bookings.map(async (booking) => {
					const slot = await db.query.appointmentSlot.findFirst({
						where: eq(schema.appointmentSlot.id, booking.slotId),
					});
					return { ...booking, slot };
				}),
			);
		}),
		update: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			const payload = input as {
				id: string;
				staffUserId?: string;
				notes?: string | null;
				metadata?: Record<string, unknown>;
				force?: boolean;
			};
			const ifMatch = parseIfMatch(context.headers.get("if-match"));

			const series = await db.query.bookingSeries.findFirst({
				where: eq(schema.bookingSeries.id, payload.id),
			});
			if (!series) {
				throwRpcError("NOT_FOUND", 404, "Series not found");
			}
			assertOptimisticConcurrency(series.updatedAt, ifMatch);

			const activeBookings = await db.query.booking.findMany({
				where: and(
					eq(schema.booking.seriesKey, payload.id),
					eq(schema.booking.isActive, true),
				),
			});

			const forceUpdate = payload.force === true;
			const toUpdate = activeBookings.filter((booking) => {
				if (forceUpdate) return true;
				const snapshot = booking.snapshot as Record<string, unknown> | null;
				return !snapshot?.detached;
			});

			const updatedIds: string[] = [];
			const now = new Date();

			if (payload.staffUserId !== undefined) {
				const targetStaff = await db.query.staffProfile.findFirst({
					where: eq(schema.staffProfile.userId, payload.staffUserId),
				});
				if (!targetStaff) {
					throwRpcError("NOT_FOUND", 404, "Target staff profile not found");
				}

				const reassignmentConflicts: Array<{
					bookingId: string;
					conflicts: CapacityConflict[];
				}> = [];

				for (const booking of toUpdate) {
					if (booking.staffUserId === payload.staffUserId) continue;
					const capacityCheck = await checkCapacity(
						booking.slotId,
						payload.staffUserId,
					);
					const conflicts = capacityCheck.conflicts.filter(
						(conflict) => conflict.type !== "GLOBAL_OVER_CAPACITY",
					);
					if (conflicts.length > 0) {
						reassignmentConflicts.push({
							bookingId: booking.id,
							conflicts,
						});
					}
				}

				if (reassignmentConflicts.length > 0) {
					throwRpcError(
						"CAPACITY_CONFLICT",
						409,
						"Cannot update series staff assignment due to staff availability/capacity conflicts",
						{ conflicts: reassignmentConflicts },
					);
				}
			}

			if (payload.staffUserId !== undefined) {
				for (const booking of toUpdate) {
					await db
						.update(schema.booking)
						.set({
							staffUserId: payload.staffUserId,
							updatedAt: now,
						})
						.where(eq(schema.booking.id, booking.id));
					updatedIds.push(booking.id);
				}
			}

			if (payload.notes !== undefined) {
				for (const booking of toUpdate) {
					await db
						.update(schema.booking)
						.set({
							notes: payload.notes,
							updatedAt: now,
						})
						.where(eq(schema.booking.id, booking.id));
				}
			}

			if (payload.metadata !== undefined) {
				const currentMetadata =
					(series.metadata as Record<string, unknown>) || {};
				await db
					.update(schema.bookingSeries)
					.set({
						metadata: { ...currentMetadata, ...payload.metadata },
						updatedAt: now,
					})
					.where(eq(schema.bookingSeries.id, payload.id));
			}

			return {
				seriesId: payload.id,
				updatedCount: updatedIds.length,
				skippedCount: activeBookings.length - toUpdate.length,
				updatedInstanceIds: updatedIds,
			};
		}),
		updateFromDate: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			const payload = input as {
				id: string;
				effectiveFrom?: string;
				staffUserId?: string;
				notes?: string | null;
			};

			if (!payload.effectiveFrom) {
				throwRpcError(
					"MISSING_REQUIRED_FIELDS",
					422,
					"effectiveFrom is required (YYYY-MM-DD)",
				);
			}
			if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.effectiveFrom)) {
				throwRpcError("INVALID_DATE", 422, "effectiveFrom must be YYYY-MM-DD");
			}

			const series = await db.query.bookingSeries.findFirst({
				where: eq(schema.bookingSeries.id, payload.id),
			});
			if (!series) {
				throwRpcError("NOT_FOUND", 404, "Series not found");
			}

			const timezone = series.timezone || "America/Bogota";
			const effectiveFrom = payload.effectiveFrom ?? "";
			const activeBookings = await db.query.booking.findMany({
				where: and(
					eq(schema.booking.seriesKey, payload.id),
					eq(schema.booking.isActive, true),
				),
			});

			const slotIds = activeBookings.map((booking) => booking.slotId);
			const slots =
				slotIds.length > 0
					? await db.query.appointmentSlot.findMany({
							where: sql`${schema.appointmentSlot.id} IN ${slotIds}`,
						})
					: [];
			const slotDateMap = new Map(
				slots.map((slot) => [slot.id, slot.slotDate]),
			);

			const toUpdate = activeBookings.filter((booking) => {
				const slotDate = slotDateMap.get(booking.slotId);
				if (!slotDate) return false;
				return isDateOnOrAfter(slotDate, effectiveFrom, timezone);
			});

			const updatedIds: string[] = [];
			const now = new Date();

			if (payload.staffUserId !== undefined) {
				const targetStaff = await db.query.staffProfile.findFirst({
					where: eq(schema.staffProfile.userId, payload.staffUserId),
				});
				if (!targetStaff) {
					throwRpcError("NOT_FOUND", 404, "Target staff profile not found");
				}

				const reassignmentConflicts: Array<{
					bookingId: string;
					conflicts: CapacityConflict[];
				}> = [];
				for (const booking of toUpdate) {
					if (booking.staffUserId === payload.staffUserId) continue;
					const capacityCheck = await checkCapacity(
						booking.slotId,
						payload.staffUserId,
					);
					const conflicts = capacityCheck.conflicts.filter(
						(conflict) => conflict.type !== "GLOBAL_OVER_CAPACITY",
					);
					if (conflicts.length > 0) {
						reassignmentConflicts.push({
							bookingId: booking.id,
							conflicts,
						});
					}
				}

				if (reassignmentConflicts.length > 0) {
					throwRpcError(
						"CAPACITY_CONFLICT",
						409,
						"Cannot update series staff assignment due to staff availability/capacity conflicts",
						{ conflicts: reassignmentConflicts },
					);
				}
			}

			if (payload.staffUserId !== undefined) {
				for (const booking of toUpdate) {
					await db
						.update(schema.booking)
						.set({
							staffUserId: payload.staffUserId,
							updatedAt: now,
						})
						.where(eq(schema.booking.id, booking.id));
					updatedIds.push(booking.id);
				}
			}

			if (payload.notes !== undefined) {
				for (const booking of toUpdate) {
					await db
						.update(schema.booking)
						.set({
							notes: payload.notes,
							updatedAt: now,
						})
						.where(eq(schema.booking.id, booking.id));
				}
			}

			return {
				seriesId: payload.id,
				effectiveFrom: payload.effectiveFrom,
				updatedCount: updatedIds.length,
				updatedInstanceIds: updatedIds,
			};
		}),
		release: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			const payload = input as { id: string; reason?: string };
			const idempotencyKey = parseIdempotencyKey(
				context.headers.get("idempotency-key"),
			);
			const idempotencyPayload = {
				seriesId: payload.id,
				reason: payload.reason,
			};

			if (idempotencyKey) {
				const check = await checkIdempotencyKey(
					idempotencyKey,
					"release_series",
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

			const series = await db.query.bookingSeries.findFirst({
				where: eq(schema.bookingSeries.id, payload.id),
			});
			if (!series) {
				await throwIdempotencyAwareError({
					key: idempotencyKey,
					operation: "release_series",
					targetId: payload.id,
					payload: idempotencyPayload,
					code: "NOT_FOUND",
					status: 404,
					message: "Series not found",
				});
			}

			const activeBookings = await db.query.booking.findMany({
				where: and(
					eq(schema.booking.seriesKey, payload.id),
					eq(schema.booking.isActive, true),
				),
			});

			const releasedIds: string[] = [];
			for (const booking of activeBookings) {
				const result = await releaseCapacity(
					booking.id,
					(payload.reason ?? "cancelled") as
						| "cancelled"
						| "expired"
						| "attended",
				);
				if (result.success) releasedIds.push(booking.id);
			}

			await db
				.update(schema.bookingSeries)
				.set({
					isActive: false,
					updatedAt: new Date(),
				})
				.where(eq(schema.bookingSeries.id, payload.id));

			const responseBody = {
				seriesId: payload.id,
				releasedCount: releasedIds.length,
				releasedInstanceIds: releasedIds,
			};

			if (idempotencyKey) {
				await storeIdempotencyKey(
					idempotencyKey,
					"release_series",
					payload.id,
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
				id: string;
				targetSlotId?: string;
				targetStaffUserId?: string;
			};
			const idempotencyKey = parseIdempotencyKey(
				context.headers.get("idempotency-key"),
			);
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
								eq(
									schema.appointmentSlot.startTime,
									targetSlotRecord.startTime,
								),
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
		}),
	};
}
