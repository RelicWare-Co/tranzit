import {
	applyBookingsReassignments,
	checkBookingAvailability,
	confirmExistingBooking,
	createBooking,
	getBooking,
	getBookingCapacity,
	listBookings,
	previewBookingReassignment,
	previewBookingsReassignments,
	reassignExistingBooking,
	releaseExistingBooking,
} from "../../features/bookings/bookings-admin.service";
import { rpc } from "../context";
import { requireAdminAccess } from "../shared";

export function createBookingsRouter() {
	return {
		create: rpc.handler(async ({ context, input }) => {
			const session = await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			return createBooking({
				input: input as Parameters<typeof createBooking>[0]["input"],
				createdByUserId: session.user.id,
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
			return confirmExistingBooking(payload.id);
		}),
		release: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			return releaseExistingBooking(
				input as Parameters<typeof releaseExistingBooking>[0],
			);
		}),
		reassign: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			return reassignExistingBooking(
				input as Parameters<typeof reassignExistingBooking>[0],
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
