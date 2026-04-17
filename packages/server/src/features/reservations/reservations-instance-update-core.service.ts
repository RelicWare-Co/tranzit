import { eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import {
	assertAdminBookingKind,
	assertMutableState,
	assertOptimisticConcurrency,
	throwCapacityConflict,
	throwRpcError,
} from "../../orpc/shared";
import { checkCapacity } from "../bookings/capacity-check.service";

export async function updateReservationInstance(input: {
	bookingId: string;
	staffUserId?: string;
	notes?: string | null;
	ifMatch: string | null;
}) {
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

	return await db.query.booking.findFirst({
		where: eq(schema.booking.id, input.bookingId),
	});
}
