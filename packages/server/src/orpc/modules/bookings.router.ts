import {
	confirmExistingBooking,
	createBooking,
	releaseExistingBooking,
} from "../../features/bookings/bookings-mutations.service";
import {
	checkBookingAvailability,
	getBooking,
	getBookingCapacity,
	listBookings,
} from "../../features/bookings/bookings-read.service";
import {
	applyBookingsReassignments,
	previewBookingReassignment,
	previewBookingsReassignments,
	reassignExistingBooking,
} from "../../features/bookings/bookings-reassign.service";
import { rpc } from "../context";
import { extractClientInfo, requireAdminAccess } from "../shared";

export function createBookingsRouter() {
	return {
		create: rpc.handler(async ({ context, input }) => {
			const session = await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			const clientInfo = extractClientInfo(context.headers);
			return createBooking({
				input: input as Parameters<typeof createBooking>[0]["input"],
				createdByUserId: session.user.id,
				...clientInfo,
			});
		}),
		list: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			return listBookings(input as Parameters<typeof listBookings>[0]);
		}),
		get: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			const payload = input as { id: string };
			return getBooking(payload.id);
		}),
		capacity: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			const payload = input as { id: string };
			return getBookingCapacity(payload.id);
		}),
		confirm: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			const payload = input as { id: string };
			const clientInfo = extractClientInfo(context.headers);
			return confirmExistingBooking(payload.id, clientInfo);
		}),
		release: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			const clientInfo = extractClientInfo(context.headers);
			return releaseExistingBooking(
				input as Parameters<typeof releaseExistingBooking>[0],
				clientInfo,
			);
		}),
		reassign: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			const clientInfo = extractClientInfo(context.headers);
			return reassignExistingBooking(
				input as Parameters<typeof reassignExistingBooking>[0],
				clientInfo,
			);
		}),
		reassignPreview: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			return previewBookingReassignment(
				input as Parameters<typeof previewBookingReassignment>[0],
			);
		}),
		reassignmentsPreview: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			return previewBookingsReassignments(
				input as Parameters<typeof previewBookingsReassignments>[0],
			);
		}),
		reassignmentsApply: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			return applyBookingsReassignments(
				input as Parameters<typeof applyBookingsReassignments>[0],
			);
		}),
		availabilityCheck: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			return checkBookingAvailability(
				input as Parameters<typeof checkBookingAvailability>[0],
			);
		}),
	};
}
