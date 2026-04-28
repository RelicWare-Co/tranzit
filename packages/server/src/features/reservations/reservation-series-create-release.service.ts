import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import {
	checkIdempotencyKey,
	generateOccurrences,
	hashPayload,
	parseIdempotencyKey,
	parseRRule,
	type RecurrenceRule,
	resolveCachedIdempotencyResponse,
	storeIdempotencyKey,
	throwCapacityConflict,
	throwIdempotencyAwareError,
	throwRpcError,
} from "../../shared/orpc";
import { buildSeriesSummary, createAuditEvent } from "../audit/audit.service";
import type { CapacityConflict } from "../bookings/capacity.types";
import {
	consumeCapacity,
	releaseCapacity,
} from "../bookings/capacity-consume.service";

export interface CreateReservationSeriesInput {
	recurrenceRule?: RecurrenceRule | string;
	slotId?: string;
	staffUserId?: string;
	startDate?: string;
	endDate?: string;
	timezone?: string;
	notes?: string | null;
	metadata?: Record<string, unknown>;
}

export async function createReservationSeries(params: {
	input: CreateReservationSeriesInput;
	createdByUserId: string;
	idempotencyKeyHeader?: string | null;
	ipAddress?: string | null;
	userAgent?: string | null;
}) {
	const body = params.input;
	const idempotencyKey = parseIdempotencyKey(params.idempotencyKeyHeader);
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
		createdByUserId: params.createdByUserId,
		createdAt: now,
		updatedAt: now,
	});

	const createdBookingIds: string[] = [];
	const conflicts: CapacityConflict[] = [];
	for (const generatedSlotId of slotIds) {
		const result = await consumeCapacity(
			generatedSlotId,
			staffUserId,
			"administrative",
			null,
			null,
			params.createdByUserId,
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

	// Create audit event for series creation
	await createAuditEvent({
		actorType: "admin",
		actorUserId: params.createdByUserId,
		entityType: "booking_series",
		entityId: seriesId,
		action: "create",
		summary: buildSeriesSummary("series created", {
			recurrenceRule: recurrenceRule,
			instanceCount: createdBookingIds.length,
		}),
		payload: {
			id: seriesId,
			kind: "administrative",
			recurrenceRule,
			timezone,
			notes: body.notes ?? null,
			instanceCount: createdBookingIds.length,
			createdBookingIds,
			warnings:
				conflicts.length > 0
					? ["Some instances could not be created due to capacity conflicts"]
					: [],
		},
		ipAddress: params.ipAddress ?? null,
		userAgent: params.userAgent ?? null,
	});

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
}

export async function releaseReservationSeries(params: {
	input: { id: string; reason?: string };
	idempotencyKeyHeader?: string | null;
	ipAddress?: string | null;
	userAgent?: string | null;
}) {
	const payload = params.input;
	const idempotencyKey = parseIdempotencyKey(params.idempotencyKeyHeader);
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
			(payload.reason ?? "cancelled") as "cancelled" | "expired" | "attended",
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

	// Create audit event for series release
	await createAuditEvent({
		actorType: "admin",
		entityType: "booking_series",
		entityId: payload.id,
		action: "release",
		summary: buildSeriesSummary("series released", {
			releasedCount: releasedIds.length,
			reason: payload.reason,
		}),
		payload: {
			id: payload.id,
			reason: payload.reason ?? null,
			releasedCount: releasedIds.length,
			releasedInstanceIds: releasedIds,
		},
		ipAddress: params.ipAddress ?? null,
		userAgent: params.userAgent ?? null,
	});

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
}
