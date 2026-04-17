import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import {
	assertOptimisticConcurrency,
	isDateOnOrAfter,
	throwRpcError,
} from "../../orpc/shared";
import { buildSeriesSummary, createAuditEvent } from "../audit/audit.service";
import type { CapacityConflict } from "../bookings/capacity.types";
import { checkCapacity } from "../bookings/capacity-check.service";

async function assertStaffReassignmentCapacity(
	bookings: Array<typeof schema.booking.$inferSelect>,
	targetStaffUserId: string,
) {
	const targetStaff = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, targetStaffUserId),
	});
	if (!targetStaff) {
		throwRpcError("NOT_FOUND", 404, "Target staff profile not found");
	}

	const reassignmentConflicts: Array<{
		bookingId: string;
		conflicts: CapacityConflict[];
	}> = [];
	for (const booking of bookings) {
		if (booking.staffUserId === targetStaffUserId) continue;
		const capacityCheck = await checkCapacity(
			booking.slotId,
			targetStaffUserId,
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

export async function updateReservationSeries(params: {
	input: {
		id: string;
		staffUserId?: string;
		notes?: string | null;
		metadata?: Record<string, unknown>;
		force?: boolean;
	};
	ifMatch: string | null;
}) {
	const payload = params.input;
	const series = await db.query.bookingSeries.findFirst({
		where: eq(schema.bookingSeries.id, payload.id),
	});
	if (!series) {
		throwRpcError("NOT_FOUND", 404, "Series not found");
	}
	assertOptimisticConcurrency(series.updatedAt, params.ifMatch);

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
		await assertStaffReassignmentCapacity(toUpdate, payload.staffUserId);
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
		const currentMetadata = (series.metadata as Record<string, unknown>) || {};
		await db
			.update(schema.bookingSeries)
			.set({
				metadata: { ...currentMetadata, ...payload.metadata },
				updatedAt: now,
			})
			.where(eq(schema.bookingSeries.id, payload.id));
	}

	// Create audit event for series update
	await createAuditEvent({
		actorType: "admin",
		entityType: "booking_series",
		entityId: payload.id,
		action: "update",
		summary: buildSeriesSummary("series updated", {
			updatedCount: updatedIds.length,
			staffUserId: payload.staffUserId,
			notes: payload.notes,
		}),
		payload: {
			id: payload.id,
			staffUserId: payload.staffUserId,
			notes: payload.notes ?? null,
			metadata: payload.metadata ?? null,
			force: payload.force ?? false,
			updatedCount: updatedIds.length,
			skippedCount: activeBookings.length - toUpdate.length,
			updatedInstanceIds: updatedIds,
		},
	});

	return {
		seriesId: payload.id,
		updatedCount: updatedIds.length,
		skippedCount: activeBookings.length - toUpdate.length,
		updatedInstanceIds: updatedIds,
	};
}

export async function updateReservationSeriesFromDate(input: {
	id: string;
	effectiveFrom?: string;
	staffUserId?: string;
	notes?: string | null;
}) {
	if (!input.effectiveFrom) {
		throwRpcError(
			"MISSING_REQUIRED_FIELDS",
			422,
			"effectiveFrom is required (YYYY-MM-DD)",
		);
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) {
		throwRpcError("INVALID_DATE", 422, "effectiveFrom must be YYYY-MM-DD");
	}

	const series = await db.query.bookingSeries.findFirst({
		where: eq(schema.bookingSeries.id, input.id),
	});
	if (!series) {
		throwRpcError("NOT_FOUND", 404, "Series not found");
	}

	const timezone = series.timezone || "America/Bogota";
	const effectiveFrom = input.effectiveFrom ?? "";
	const activeBookings = await db.query.booking.findMany({
		where: and(
			eq(schema.booking.seriesKey, input.id),
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
	const slotDateMap = new Map(slots.map((slot) => [slot.id, slot.slotDate]));

	const toUpdate = activeBookings.filter((booking) => {
		const slotDate = slotDateMap.get(booking.slotId);
		if (!slotDate) return false;
		return isDateOnOrAfter(slotDate, effectiveFrom, timezone);
	});

	const updatedIds: string[] = [];
	const now = new Date();

	if (input.staffUserId !== undefined) {
		await assertStaffReassignmentCapacity(toUpdate, input.staffUserId);
	}

	if (input.staffUserId !== undefined) {
		for (const booking of toUpdate) {
			await db
				.update(schema.booking)
				.set({
					staffUserId: input.staffUserId,
					updatedAt: now,
				})
				.where(eq(schema.booking.id, booking.id));
			updatedIds.push(booking.id);
		}
	}

	if (input.notes !== undefined) {
		for (const booking of toUpdate) {
			await db
				.update(schema.booking)
				.set({
					notes: input.notes,
					updatedAt: now,
				})
				.where(eq(schema.booking.id, booking.id));
		}
	}

	// Create audit event for series update from date
	await createAuditEvent({
		actorType: "admin",
		entityType: "booking_series",
		entityId: input.id,
		action: "update",
		summary: buildSeriesSummary("series updated from date", {
			effectiveFrom: input.effectiveFrom,
			updatedCount: updatedIds.length,
			staffUserId: input.staffUserId,
		}),
		payload: {
			id: input.id,
			effectiveFrom: input.effectiveFrom,
			staffUserId: input.staffUserId,
			notes: input.notes ?? null,
			updatedCount: updatedIds.length,
			updatedInstanceIds: updatedIds,
		},
	});

	return {
		seriesId: input.id,
		effectiveFrom: input.effectiveFrom,
		updatedCount: updatedIds.length,
		updatedInstanceIds: updatedIds,
	};
}
