import { and, eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";

export interface TimeWindow {
	start: string;
	end: string;
}

export interface EffectiveSchedule {
	slotDurationMinutes: number;
	bufferMinutes: number;
	slotCapacityLimit: number | null;
	windows: TimeWindow[];
	generatedFrom: "override" | "base";
}

const timeToMinutes = (t: string): number => {
	const [h, m] = t.split(":").map(Number);
	return h * 60 + m;
};

const minutesToTime = (minutes: number): string => {
	const h = Math.floor(minutes / 60) % 24;
	const m = minutes % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const formatDateLocal = (date: Date): string => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

export const getEffectiveSchedule = async (
	date: string,
): Promise<{
	schedule: EffectiveSchedule | null;
	override: typeof schema.calendarOverride.$inferSelect | null;
}> => {
	const dateObj = new Date(`${date}T00:00:00`);
	const weekday = dateObj.getDay();

	const override = await db.query.calendarOverride.findFirst({
		where: eq(schema.calendarOverride.overrideDate, date),
	});

	if (override) {
		if (override.isClosed) {
			return { schedule: null, override };
		}

		const template = await db.query.scheduleTemplate.findFirst({
			where: and(
				eq(schema.scheduleTemplate.weekday, weekday),
				eq(schema.scheduleTemplate.isEnabled, true),
			),
		});

		const slotDurationMinutes =
			override.slotDurationMinutes ?? template?.slotDurationMinutes ?? 30;
		const bufferMinutes =
			override.bufferMinutes ?? template?.bufferMinutes ?? 0;
		const slotCapacityLimit =
			override.slotCapacityLimit ?? template?.slotCapacityLimit ?? null;

		const windows: TimeWindow[] = [];

		if (
			override.morningEnabled &&
			override.morningStart &&
			override.morningEnd
		) {
			windows.push({ start: override.morningStart, end: override.morningEnd });
		} else if (!override.morningStart && !override.morningEnd && template) {
			if (
				override.morningEnabled !== false &&
				template.morningStart &&
				template.morningEnd
			) {
				windows.push({
					start: template.morningStart,
					end: template.morningEnd,
				});
			}
		}

		if (
			override.afternoonEnabled &&
			override.afternoonStart &&
			override.afternoonEnd
		) {
			windows.push({
				start: override.afternoonStart,
				end: override.afternoonEnd,
			});
		} else if (!override.afternoonStart && !override.afternoonEnd && template) {
			if (
				override.afternoonEnabled !== false &&
				template.afternoonStart &&
				template.afternoonEnd
			) {
				windows.push({
					start: template.afternoonStart,
					end: template.afternoonEnd,
				});
			}
		}

		return {
			schedule: {
				slotDurationMinutes,
				bufferMinutes,
				slotCapacityLimit,
				windows,
				generatedFrom: "override",
			},
			override,
		};
	}

	const template = await db.query.scheduleTemplate.findFirst({
		where: and(
			eq(schema.scheduleTemplate.weekday, weekday),
			eq(schema.scheduleTemplate.isEnabled, true),
		),
	});

	if (!template) {
		return { schedule: null, override: null };
	}

	const windows: TimeWindow[] = [];
	if (template.morningStart && template.morningEnd) {
		windows.push({ start: template.morningStart, end: template.morningEnd });
	}
	if (template.afternoonStart && template.afternoonEnd) {
		windows.push({
			start: template.afternoonStart,
			end: template.afternoonEnd,
		});
	}

	return {
		schedule: {
			slotDurationMinutes: template.slotDurationMinutes,
			bufferMinutes: template.bufferMinutes,
			slotCapacityLimit: template.slotCapacityLimit,
			windows,
			generatedFrom: "base",
		},
		override: null,
	};
};

export const generateSlotsForWindow = (
	window: TimeWindow,
	slotDurationMinutes: number,
	bufferMinutes: number,
): { startTime: string; endTime: string }[] => {
	const slots: { startTime: string; endTime: string }[] = [];
	const windowStartMin = timeToMinutes(window.start);
	const windowEndMin = timeToMinutes(window.end);
	const slotWithBuffer = slotDurationMinutes + bufferMinutes;

	if (slotDurationMinutes <= 0) {
		throw new Error("slotDurationMinutes must be > 0");
	}

	if (bufferMinutes < 0) {
		throw new Error("bufferMinutes must be >= 0");
	}

	if (slotWithBuffer <= 0) {
		throw new Error(
			"slotDurationMinutes + bufferMinutes must be > 0 for slot generation",
		);
	}

	let currentMin = windowStartMin;
	while (currentMin + slotDurationMinutes <= windowEndMin) {
		const slotEndMin = currentMin + slotDurationMinutes;
		slots.push({
			startTime: minutesToTime(currentMin),
			endTime: minutesToTime(slotEndMin),
		});
		currentMin += slotWithBuffer;
	}

	return slots;
};
