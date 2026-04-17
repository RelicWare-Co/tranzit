import { and, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import type { CapacityCheck, CapacityConflict, DbLike } from "./capacity.types";
import { slotFitsWindow } from "./capacity.utils";

export async function resolveStaffAvailabilityAndCapacity(
	dbLike: DbLike,
	staffUserId: string,
	slotDate: string,
	slotStartTime: string,
	slotEndTime: string,
): Promise<{
	available: boolean;
	staffCapacity: number;
	reason?: string;
}> {
	const staffProfile = await dbLike.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, staffUserId),
	});

	if (!staffProfile) {
		return {
			available: false,
			staffCapacity: 0,
			reason: "Staff profile not found",
		};
	}

	if (!staffProfile.isActive || !staffProfile.isAssignable) {
		return {
			available: false,
			staffCapacity: 0,
			reason: "Staff is not active or not assignable",
		};
	}

	const dateOverride = await dbLike.query.staffDateOverride.findFirst({
		where: and(
			eq(schema.staffDateOverride.staffUserId, staffUserId),
			eq(schema.staffDateOverride.overrideDate, slotDate),
		),
	});

	let staffCapacity = staffProfile.defaultDailyCapacity;

	if (dateOverride) {
		if (!dateOverride.isAvailable) {
			return {
				available: false,
				staffCapacity: 0,
				reason: "Staff is unavailable on this date (override)",
			};
		}

		if (dateOverride.capacityOverride !== null) {
			staffCapacity = dateOverride.capacityOverride;
		}

		if (dateOverride.availableStartTime && dateOverride.availableEndTime) {
			if (
				!slotFitsWindow(
					slotStartTime,
					slotEndTime,
					dateOverride.availableStartTime,
					dateOverride.availableEndTime,
				)
			) {
				return {
					available: false,
					staffCapacity: 0,
					reason: "Staff is outside available window for this date",
				};
			}
		}

		return {
			available: true,
			staffCapacity,
		};
	}

	const weekday = new Date(`${slotDate}T00:00:00`).getDay();
	const weeklyAvailability = (staffProfile.weeklyAvailability ?? {}) as Record<
		string,
		{
			enabled?: boolean;
			morningStart?: string;
			morningEnd?: string;
			afternoonStart?: string;
			afternoonEnd?: string;
		}
	>;

	const dayConfig = weeklyAvailability[String(weekday)];

	if (dayConfig?.enabled === false) {
		return {
			available: false,
			staffCapacity: 0,
			reason: "Staff is unavailable by weekly availability",
		};
	}

	const hasMorningWindow = !!(dayConfig?.morningStart && dayConfig?.morningEnd);
	const hasAfternoonWindow = !!(
		dayConfig?.afternoonStart && dayConfig?.afternoonEnd
	);
	const hasAnyWindow =
		!!dayConfig &&
		(dayConfig.morningStart !== undefined ||
			dayConfig.morningEnd !== undefined ||
			dayConfig.afternoonStart !== undefined ||
			dayConfig.afternoonEnd !== undefined);

	if (hasAnyWindow && !hasMorningWindow && !hasAfternoonWindow) {
		return {
			available: false,
			staffCapacity: 0,
			reason: "Staff has invalid weekly availability window configuration",
		};
	}

	if (hasMorningWindow || hasAfternoonWindow) {
		const inMorning = hasMorningWindow
			? slotFitsWindow(
					slotStartTime,
					slotEndTime,
					dayConfig?.morningStart ?? "00:00",
					dayConfig?.morningEnd ?? "00:00",
				)
			: false;

		const inAfternoon = hasAfternoonWindow
			? slotFitsWindow(
					slotStartTime,
					slotEndTime,
					dayConfig?.afternoonStart ?? "00:00",
					dayConfig?.afternoonEnd ?? "00:00",
				)
			: false;

		if (!inMorning && !inAfternoon) {
			return {
				available: false,
				staffCapacity: 0,
				reason: "Staff is outside weekly availability windows",
			};
		}
	}

	return {
		available: true,
		staffCapacity,
	};
}

export async function countActiveSlotBookings(
	dbLike: DbLike,
	slotId: string,
	excludeBookingId?: string,
): Promise<number> {
	const conditions = [
		eq(schema.booking.slotId, slotId),
		eq(schema.booking.isActive, true),
	];

	if (excludeBookingId) {
		conditions.push(ne(schema.booking.id, excludeBookingId));
	}

	const activeBookings = await dbLike.query.booking.findMany({
		where: and(...conditions),
	});

	return activeBookings.length;
}

export async function countActiveStaffBookingsOnDate(
	dbLike: DbLike,
	staffUserId: string,
	date: string,
	excludeBookingId?: string,
): Promise<number> {
	const conditions = [
		eq(schema.booking.staffUserId, staffUserId),
		eq(schema.booking.isActive, true),
	];

	if (excludeBookingId) {
		conditions.push(ne(schema.booking.id, excludeBookingId));
	}

	const staffBookings = await dbLike.query.booking.findMany({
		where: and(...conditions),
	});

	if (staffBookings.length === 0) return 0;

	const bookingSlotIds = staffBookings.map((booking) => booking.slotId);
	const bookingSlots =
		bookingSlotIds.length > 0
			? await dbLike.query.appointmentSlot.findMany({
					where: sql`${schema.appointmentSlot.id} IN ${bookingSlotIds}`,
				})
			: [];
	const bookingSlotDateMap = new Map(
		bookingSlots.map((slot) => [slot.id, slot.slotDate]),
	);

	return staffBookings.filter((booking) => {
		const bookingSlotDate = bookingSlotDateMap.get(booking.slotId);
		return bookingSlotDate === date;
	}).length;
}

export async function checkCapacity(
	slotId: string,
	staffUserId: string,
): Promise<CapacityCheck> {
	const conflicts: CapacityConflict[] = [];

	const slot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, slotId),
	});

	if (!slot) {
		return {
			available: false,
			globalCapacity: null,
			globalUsed: 0,
			globalRemaining: null,
			staffCapacity: 0,
			staffUsed: 0,
			staffRemaining: 0,
			conflicts: [
				{
					type: "GLOBAL_OVER_CAPACITY",
					details: "Slot not found",
				},
			],
		};
	}

	const globalUsed = await countActiveSlotBookings(db, slotId);
	const globalCapacity = slot.capacityLimit;
	const globalRemaining =
		globalCapacity !== null ? globalCapacity - globalUsed : null;

	if (globalCapacity !== null && globalUsed >= globalCapacity) {
		conflicts.push({
			type: "GLOBAL_OVER_CAPACITY",
			details: `Slot has reached capacity limit (${globalCapacity})`,
		});
	}

	const staffResolution = await resolveStaffAvailabilityAndCapacity(
		db,
		staffUserId,
		slot.slotDate,
		slot.startTime,
		slot.endTime,
	);

	if (!staffResolution.available) {
		return {
			available: false,
			globalCapacity,
			globalUsed,
			globalRemaining,
			staffCapacity: 0,
			staffUsed: 0,
			staffRemaining: 0,
			conflicts: [
				{
					type: "STAFF_UNAVAILABLE",
					details: staffResolution.reason ?? "Staff is unavailable",
				},
				...conflicts,
			],
		};
	}

	const staffCapacity = staffResolution.staffCapacity;
	const staffUsed = await countActiveStaffBookingsOnDate(
		db,
		staffUserId,
		slot.slotDate,
	);
	const staffRemaining = staffCapacity - staffUsed;

	if (staffUsed >= staffCapacity) {
		conflicts.push({
			type: "STAFF_OVER_CAPACITY",
			details: `Staff has reached daily capacity limit (${staffCapacity})`,
		});
	}

	return {
		available: conflicts.length === 0,
		globalCapacity,
		globalUsed,
		globalRemaining,
		staffCapacity,
		staffUsed,
		staffRemaining,
		conflicts,
	};
}
