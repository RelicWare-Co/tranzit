import {
	cancelCitizenBooking,
	confirmCitizenBooking,
	createCitizenBookingHold,
	listCitizenBookings,
	listCitizenProcedures,
	listCitizenSlotsRange,
} from "../../features/citizen/citizen-portal.service";
import { rpc } from "../context";
import { requireAuthenticatedSession } from "../shared";

export function createCitizenRouter() {
	return {
		procedures: {
			list: rpc.handler(async () => {
				return listCitizenProcedures();
			}),
		},
		slots: {
			range: rpc.handler(async ({ input }) => {
				return listCitizenSlotsRange(
					(input ?? {}) as Parameters<typeof listCitizenSlotsRange>[0],
				);
			}),
		},
		bookings: {
			hold: rpc.handler(async ({ context, input }) => {
				const session = await requireAuthenticatedSession(context.headers);
				return createCitizenBookingHold(
					{
						id: session.user.id,
						email: session.user.email,
						name: session.user.name,
						phone: null,
					},
					(input ?? {}) as Parameters<typeof createCitizenBookingHold>[1],
				);
			}),
			confirm: rpc.handler(async ({ context, input }) => {
				const session = await requireAuthenticatedSession(context.headers);
				const payload = input as { bookingId: string };
				return confirmCitizenBooking(session.user.id, payload.bookingId);
			}),
			cancel: rpc.handler(async ({ context, input }) => {
				const session = await requireAuthenticatedSession(context.headers);
				const payload = input as { bookingId: string };
				return cancelCitizenBooking(session.user.id, payload.bookingId);
			}),
			mine: rpc.handler(async ({ context, input }) => {
				const session = await requireAuthenticatedSession(context.headers);
				const payload = (input ?? {}) as { includeInactive?: boolean };
				return listCitizenBookings(
					session.user.id,
					payload.includeInactive ?? true,
				);
			}),
		},
	};
}
