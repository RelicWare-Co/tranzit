import { eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import { throwRpcError } from "../../shared/orpc";

export async function getReservationInstance(bookingId: string) {
	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
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
}
