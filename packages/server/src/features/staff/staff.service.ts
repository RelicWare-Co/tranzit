import { and, eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";

export const isSlotWithinStaffAvailability = async (
	staffUserId: string,
	date: string,
	slotStartTime: string,
	slotEndTime: string,
): Promise<{
	available: boolean;
	reason?: string;
}> => {
	const result = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, staffUserId),
	});

	if (!result) {
		return { available: false, reason: "STAFF_NOT_FOUND" };
	}

	if (!result.isActive) {
		return { available: false, reason: "STAFF_INACTIVE" };
	}

	if (!result.isAssignable) {
		return { available: false, reason: "STAFF_NOT_ASSIGNABLE" };
	}

	const override = await db.query.staffDateOverride.findFirst({
		where: and(
			eq(schema.staffDateOverride.staffUserId, staffUserId),
			eq(schema.staffDateOverride.overrideDate, date),
		),
	});

	if (override) {
		if (!override.isAvailable) {
			return { available: false, reason: "STAFF_UNAVAILABLE_ON_DATE" };
		}

		if (override.availableStartTime && override.availableEndTime) {
			if (slotStartTime < override.availableStartTime) {
				return { available: false, reason: "STAFF_OUTSIDE_AVAILABLE_WINDOW" };
			}
			if (slotEndTime > override.availableEndTime) {
				return { available: false, reason: "STAFF_OUTSIDE_AVAILABLE_WINDOW" };
			}
		}

		return { available: true };
	}

	const weekday = new Date(`${date}T00:00:00`).getDay();
	const weeklyAv = (result.weeklyAvailability ?? {}) as Record<
		string,
		{
			enabled?: boolean;
			morningStart?: string;
			morningEnd?: string;
			afternoonStart?: string;
			afternoonEnd?: string;
		}
	>;
	const dayConfig = weeklyAv[String(weekday)];

	if (dayConfig && dayConfig.enabled === false) {
		return { available: false, reason: "STAFF_WEEKLY_UNAVAILABLE" };
	}

	if (dayConfig && (dayConfig.morningStart || dayConfig.afternoonStart)) {
		const inMorning =
			dayConfig.morningStart &&
			dayConfig.morningEnd &&
			slotStartTime >= dayConfig.morningStart &&
			slotEndTime <= dayConfig.morningEnd;
		const inAfternoon =
			dayConfig.afternoonStart &&
			dayConfig.afternoonEnd &&
			slotStartTime >= dayConfig.afternoonStart &&
			slotEndTime <= dayConfig.afternoonEnd;

		if (!inMorning && !inAfternoon) {
			return { available: false, reason: "STAFF_OUTSIDE_AVAILABLE_WINDOW" };
		}
	}

	return { available: true };
};

export const getEffectiveDailyCapacity = async (
	staffUserId: string,
	date: string,
): Promise<number> => {
	const profile = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, staffUserId),
	});

	if (!profile) {
		return 0;
	}

	if (!profile.isActive || !profile.isAssignable) {
		return 0;
	}

	const override = await db.query.staffDateOverride.findFirst({
		where: and(
			eq(schema.staffDateOverride.staffUserId, staffUserId),
			eq(schema.staffDateOverride.overrideDate, date),
		),
	});

	if (override) {
		if (!override.isAvailable) {
			return 0;
		}
		return override.capacityOverride ?? profile.defaultDailyCapacity;
	}

	const weekday = new Date(`${date}T00:00:00`).getDay();
	const weeklyAv = (profile.weeklyAvailability ?? {}) as Record<
		string,
		{ enabled?: boolean }
	>;
	const dayConfig = weeklyAv[String(weekday)];

	if (dayConfig && dayConfig.enabled === false) {
		return 0;
	}

	return profile.defaultDailyCapacity;
};
