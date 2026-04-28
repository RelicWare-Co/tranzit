import { and, eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import { parseBooleanLike, throwRpcError } from "../../shared/orpc";

export async function listReservationSeries(input?: {
	isActive?: boolean | string;
	kind?: string;
}) {
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

	let seriesList: Awaited<ReturnType<typeof db.query.bookingSeries.findMany>>;
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
}

export async function getReservationSeries(id: string) {
	const series = await db.query.bookingSeries.findFirst({
		where: eq(schema.bookingSeries.id, id),
	});
	if (!series) {
		throwRpcError("NOT_FOUND", 404, "Series not found");
	}

	const bookings = await db.query.booking.findMany({
		where: eq(schema.booking.seriesKey, id),
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
}

export async function listReservationSeriesInstances(input: {
	id: string;
	status?: string;
	isActive?: boolean | string;
}) {
	const conditions = [eq(schema.booking.seriesKey, input.id)];
	if (input.status) {
		conditions.push(eq(schema.booking.status, input.status));
	}
	const isActive = parseBooleanLike(input.isActive);
	if (input.isActive !== undefined && isActive !== undefined) {
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
}
