import { and, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import { throwRpcError } from "../../orpc/shared";
import { checkCapacity } from "./capacity-check.service";

export interface ListBookingsInput {
	slotId?: string;
	staffUserId?: string;
	requestId?: string;
	citizenUserId?: string;
	kind?: string;
	status?: string;
	isActive?: boolean;
	dateFrom?: string;
	dateTo?: string;
}

const isValidIsoDate = (date: string): boolean =>
	/^\d{4}-\d{2}-\d{2}$/.test(date);

export async function listBookings(input?: ListBookingsInput) {
	const payload = (input ?? {}) as ListBookingsInput;

	if (payload.dateFrom && !isValidIsoDate(payload.dateFrom)) {
		throwRpcError("INVALID_DATE", 422, "dateFrom must be YYYY-MM-DD");
	}
	if (payload.dateTo && !isValidIsoDate(payload.dateTo)) {
		throwRpcError("INVALID_DATE", 422, "dateTo must be YYYY-MM-DD");
	}
	if (payload.dateFrom && payload.dateTo && payload.dateTo < payload.dateFrom) {
		throwRpcError(
			"INVALID_DATE_RANGE",
			422,
			"dateTo must be greater than or equal to dateFrom",
		);
	}

	const conditions = [];
	if (payload.slotId)
		conditions.push(eq(schema.booking.slotId, payload.slotId));
	if (payload.staffUserId) {
		conditions.push(eq(schema.booking.staffUserId, payload.staffUserId));
	}
	if (payload.requestId) {
		conditions.push(eq(schema.booking.requestId, payload.requestId));
	}
	if (payload.citizenUserId) {
		conditions.push(eq(schema.booking.citizenUserId, payload.citizenUserId));
	}
	if (payload.kind) conditions.push(eq(schema.booking.kind, payload.kind));
	if (payload.status)
		conditions.push(eq(schema.booking.status, payload.status));
	if (payload.isActive !== undefined) {
		conditions.push(eq(schema.booking.isActive, payload.isActive));
	}

	let bookings: Awaited<ReturnType<typeof db.query.booking.findMany>>;
	if (conditions.length > 0) {
		bookings = await db.query.booking.findMany({
			where: and(...conditions),
		});
	} else {
		bookings = await db.query.booking.findMany();
	}

	if (payload.dateFrom || payload.dateTo) {
		const slotDateConditions = [];
		if (payload.dateFrom) {
			slotDateConditions.push(
				gte(schema.appointmentSlot.slotDate, payload.dateFrom),
			);
		}
		if (payload.dateTo) {
			slotDateConditions.push(
				lte(schema.appointmentSlot.slotDate, payload.dateTo),
			);
		}

		const matchingSlots = await db.query.appointmentSlot.findMany({
			where:
				slotDateConditions.length > 0 ? and(...slotDateConditions) : undefined,
		});

		const slotDateMap = new Map(
			matchingSlots.map((slot) => [slot.id, slot.slotDate]),
		);
		bookings = bookings.filter((booking) => slotDateMap.has(booking.slotId));
	}

	return await Promise.all(
		bookings.map(async (booking) => {
			const slot = await db.query.appointmentSlot.findFirst({
				where: eq(schema.appointmentSlot.id, booking.slotId),
			});
			const staffUser = booking.staffUserId
				? await db.query.user.findFirst({
						where: eq(schema.user.id, booking.staffUserId),
					})
				: null;

			return {
				...booking,
				slot: slot ?? null,
				staff: staffUser
					? {
							id: staffUser.id,
							name: staffUser.name,
							email: staffUser.email,
						}
					: null,
			};
		}),
	);
}

export async function getBooking(id: string) {
	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, id),
	});
	if (!booking) {
		throwRpcError("NOT_FOUND", 404, "Booking not found");
	}

	const slot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, booking.slotId),
	});
	const staffUser = booking.staffUserId
		? await db.query.user.findFirst({
				where: eq(schema.user.id, booking.staffUserId),
			})
		: null;

	return {
		...booking,
		slot: slot ?? null,
		staff: staffUser
			? {
					id: staffUser.id,
					name: staffUser.name,
					email: staffUser.email,
				}
			: null,
	};
}

export async function getBookingCapacity(id: string) {
	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, id),
	});
	if (!booking) {
		throwRpcError("NOT_FOUND", 404, "Booking not found");
	}
	if (!booking.staffUserId) {
		throwRpcError("INVALID_STATE", 422, "Booking has no staff assigned");
	}

	return await checkCapacity(booking.slotId, booking.staffUserId);
}

export async function checkBookingAvailability(input: {
	slotId: string;
	staffUserId: string;
}) {
	if (!input.slotId || !input.staffUserId) {
		throwRpcError(
			"MISSING_REQUIRED_FIELDS",
			422,
			"slotId and staffUserId query parameters are required",
		);
	}

	return await checkCapacity(input.slotId, input.staffUserId);
}
