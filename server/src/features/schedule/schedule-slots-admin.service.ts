import { and, eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import { throwRpcError } from "../../orpc/shared";
import { isValidDateFormat as isValidScheduleDateFormat } from "./schedule.schemas";
import {
	formatDateLocal,
	generateSlotsForWindow,
	getEffectiveSchedule,
} from "./schedule.service";

export async function generateScheduleSlots(input: {
	dateFrom?: string;
	dateTo?: string;
	maxDays?: number;
	ifNoneMatchHeader?: string | null;
}) {
	const body = input;
	if (!body.dateFrom || !body.dateTo) {
		throwRpcError(
			"MISSING_REQUIRED_FIELDS",
			422,
			"dateFrom and dateTo are required",
		);
	}

	if (!isValidScheduleDateFormat(body.dateFrom)) {
		throwRpcError(
			"INVALID_DATE",
			422,
			"dateFrom must be a valid date in YYYY-MM-DD format",
		);
	}
	if (!isValidScheduleDateFormat(body.dateTo)) {
		throwRpcError(
			"INVALID_DATE",
			422,
			"dateTo must be a valid date in YYYY-MM-DD format",
		);
	}

	const fromDate = new Date(`${body.dateFrom}T00:00:00`);
	const toDate = new Date(`${body.dateTo}T00:00:00`);

	if (toDate < fromDate) {
		throwRpcError(
			"INVALID_DATE_RANGE",
			422,
			"dateTo must be greater than or equal to dateFrom",
		);
	}

	const maxDays = Math.min(Number(body.maxDays ?? 31), 90);
	const diffTime = toDate.getTime() - fromDate.getTime();
	const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

	if (diffDays > maxDays) {
		throwRpcError(
			"DATE_RANGE_TOO_LARGE",
			422,
			`Date range exceeds maximum of ${maxDays} days. Please use a smaller range or increase maxDays.`,
		);
	}

	const idempotencyToken = body.ifNoneMatchHeader;
	const generatedSlotIds: string[] = [];
	const skippedDates: string[] = [];
	const errors: { date: string; code: string; message: string }[] = [];

	const currentDate = new Date(fromDate);
	while (currentDate <= toDate) {
		const dateStr = formatDateLocal(currentDate);
		const { schedule } = await getEffectiveSchedule(dateStr);

		if (!schedule || schedule.windows.length === 0) {
			skippedDates.push(dateStr);
			currentDate.setDate(currentDate.getDate() + 1);
			continue;
		}

		const existingSlots = await db.query.appointmentSlot.findMany({
			where: eq(schema.appointmentSlot.slotDate, dateStr),
		});
		const existingKeySet = new Set(
			existingSlots.map((slot) => `${slot.startTime}-${slot.endTime}`),
		);

		const allSlots: { startTime: string; endTime: string }[] = [];
		try {
			for (const window of schedule.windows) {
				const windowSlots = generateSlotsForWindow(
					window,
					schedule.slotDurationMinutes,
					schedule.bufferMinutes,
				);
				allSlots.push(...windowSlots);
			}
		} catch (err) {
			errors.push({
				date: dateStr,
				code: "INVALID_SCHEDULE_CONFIGURATION",
				message:
					err instanceof Error
						? err.message
						: "Invalid schedule configuration for slot generation",
			});
			currentDate.setDate(currentDate.getDate() + 1);
			continue;
		}

		const newSlots = allSlots.filter(
			(slot) => !existingKeySet.has(`${slot.startTime}-${slot.endTime}`),
		);

		if (newSlots.length > 0) {
			const now = new Date();
			const insertedSlots = await db
				.insert(schema.appointmentSlot)
				.values(
					newSlots.map((slot) => ({
						id: crypto.randomUUID(),
						slotDate: dateStr,
						startTime: slot.startTime,
						endTime: slot.endTime,
						status: "open",
						capacityLimit: schedule.slotCapacityLimit,
						generatedFrom: schedule.generatedFrom,
						createdAt: now,
						updatedAt: now,
					})),
				)
				.returning();

			generatedSlotIds.push(...insertedSlots.map((slot) => slot.id));
		}

		currentDate.setDate(currentDate.getDate() + 1);
	}

	return {
		dateFrom: body.dateFrom,
		dateTo: body.dateTo,
		generatedCount: generatedSlotIds.length,
		skippedDatesCount: skippedDates.length,
		generatedSlotIds,
		skippedDates: skippedDates.length > 0 ? skippedDates : undefined,
		errors: errors.length > 0 ? errors : undefined,
		idempotentReplay:
			generatedSlotIds.length === 0 || Boolean(idempotencyToken),
	};
}

export async function listScheduleSlotsByDate(date?: string) {
	if (!date) {
		throwRpcError(
			"MISSING_REQUIRED_FIELDS",
			422,
			"date query parameter is required (YYYY-MM-DD)",
		);
	}

	if (!isValidScheduleDateFormat(date)) {
		throwRpcError(
			"INVALID_DATE",
			422,
			"date must be a valid date in YYYY-MM-DD format (including leap year validation)",
		);
	}

	const { schedule, override } = await getEffectiveSchedule(date);
	if (!schedule || schedule.windows.length === 0) {
		return {
			date,
			slots: [],
			generatedFrom: override ? "override" : "base",
			isClosed: override?.isClosed ?? true,
			count: 0,
		};
	}

	const existingSlots = await db.query.appointmentSlot.findMany({
		where: eq(schema.appointmentSlot.slotDate, date),
	});
	const existingKeySet = new Set(
		existingSlots.map((slot) => `${slot.startTime}-${slot.endTime}`),
	);

	const allSlots: { startTime: string; endTime: string }[] = [];
	for (const window of schedule.windows) {
		const windowSlots = generateSlotsForWindow(
			window,
			schedule.slotDurationMinutes,
			schedule.bufferMinutes,
		);
		allSlots.push(...windowSlots);
	}

	const newSlots = allSlots.filter(
		(slot) => !existingKeySet.has(`${slot.startTime}-${slot.endTime}`),
	);
	if (newSlots.length > 0) {
		const now = new Date();
		await db.insert(schema.appointmentSlot).values(
			newSlots.map((slot) => ({
				id: crypto.randomUUID(),
				slotDate: date,
				startTime: slot.startTime,
				endTime: slot.endTime,
				status: "open",
				capacityLimit: schedule.slotCapacityLimit,
				generatedFrom: schedule.generatedFrom,
				createdAt: now,
				updatedAt: now,
			})),
		);
	}

	const allSlotsForDate = await db.query.appointmentSlot.findMany({
		where: eq(schema.appointmentSlot.slotDate, date),
		orderBy: (slot, { asc }) => [asc(slot.startTime)],
	});

	const slotIds = allSlotsForDate.map((slot) => slot.id);
	const slotIdsSet = new Set(slotIds);
	const activeBookings = await db.query.booking.findMany({
		where: and(eq(schema.booking.isActive, true)),
	});

	const bookingCountBySlot = new Map<string, number>();
	for (const booking of activeBookings) {
		if (slotIdsSet.has(booking.slotId)) {
			const current = bookingCountBySlot.get(booking.slotId) ?? 0;
			bookingCountBySlot.set(booking.slotId, current + 1);
		}
	}

	const slotsWithCapacity = allSlotsForDate.map((slot) => ({
		id: slot.id,
		slotDate: slot.slotDate,
		startTime: slot.startTime,
		endTime: slot.endTime,
		status: slot.status,
		capacityLimit: slot.capacityLimit,
		reservedCount: bookingCountBySlot.get(slot.id) ?? 0,
		remainingCapacity:
			slot.capacityLimit !== null
				? Math.max(
						0,
						slot.capacityLimit - (bookingCountBySlot.get(slot.id) ?? 0),
					)
				: null,
		generatedFrom: slot.generatedFrom,
	}));

	return {
		date,
		slots: slotsWithCapacity,
		generatedFrom: schedule.generatedFrom,
		isClosed: false,
		count: slotsWithCapacity.length,
	};
}
