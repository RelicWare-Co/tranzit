import { eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import {
	assertAdminBookingKind,
	assertMutableState,
	assertOptimisticConcurrency,
	throwCapacityConflict,
	throwRpcError,
} from "../../shared/orpc";
import { buildBookingSummary, createAuditEvent } from "../audit/audit.service";
import { checkCapacity } from "../bookings/capacity-check.service";

export async function updateReservationInstance(
	input: {
		bookingId: string;
		staffUserId?: string;
		notes?: string | null;
		ifMatch: string | null;
	},
	options?: { ipAddress?: string | null; userAgent?: string | null },
) {
	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, input.bookingId),
	});
	if (!booking) {
		throwRpcError("NOT_FOUND", 404, "Reservation not found");
	}

	assertOptimisticConcurrency(booking.updatedAt, input.ifMatch);
	assertMutableState(booking);
	assertAdminBookingKind(booking);

	const now = new Date();
	const updates: Partial<typeof schema.booking.$inferInsert> = {
		updatedAt: now,
	};

	if (input.staffUserId !== undefined) {
		const capacityCheck = await checkCapacity(
			booking.slotId,
			input.staffUserId,
		);
		if (!capacityCheck.available) {
			throwCapacityConflict(capacityCheck.conflicts);
		}
		updates.staffUserId = input.staffUserId;
	}

	if (input.notes !== undefined) {
		updates.notes = input.notes;
	}

	const currentSnapshot = (booking.snapshot as Record<string, unknown>) || {};
	updates.snapshot = {
		...currentSnapshot,
		detached: true,
		detachedAt: now.toISOString(),
		detachedFromSeries: booking.seriesKey,
	};

	await db
		.update(schema.booking)
		.set(updates)
		.where(eq(schema.booking.id, input.bookingId));

	// Create audit event for instance update
	await createAuditEvent({
		actorType: "admin",
		entityType: "booking",
		entityId: input.bookingId,
		action: "update",
		summary: buildBookingSummary("updated", input.bookingId, {
			staffName: input.staffUserId,
			reason: input.notes,
		}),
		payload: {
			bookingId: input.bookingId,
			staffUserId: input.staffUserId,
			notes: input.notes ?? null,
			detachedFromSeries: booking.seriesKey,
		},
		ipAddress: options?.ipAddress ?? null,
		userAgent: options?.userAgent ?? null,
	});

	return await db.query.booking.findFirst({
		where: eq(schema.booking.id, input.bookingId),
	});
}
