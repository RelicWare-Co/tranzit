import { z } from "zod";

const WEEKDAY_MIN = 0;
const WEEKDAY_MAX = 6;

const timeFormatRegex = /^\d{2}:\d{2}$/;

const isValidTimeValue = (t: string) => t >= "00:00" && t <= "23:59";

export const isValidTimeFormat = (t: string | null | undefined): boolean => {
	if (!t) return true;
	return timeFormatRegex.test(t) && isValidTimeValue(t);
};

export const isValidDateFormat = (d: string): boolean => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;

	const year = parseInt(d.substring(0, 4), 10);
	const month = parseInt(d.substring(5, 7), 10);
	const day = parseInt(d.substring(8, 10), 10);

	if (year < 1 || year > 9999) return false;
	if (month < 1 || month > 12) return false;

	const daysInMonth = new Date(year, month, 0).getDate();
	if (day < 1 || day > daysInMonth) return false;

	if (month === 2 && day === 29) {
		const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
		if (!isLeap) return false;
	}

	return true;
};

export const isValidTimeWindow = (
	start: string | null | undefined,
	end: string | null | undefined,
): boolean => {
	if (!start || !end) return true;
	return start < end;
};

const isValidWeekday = (w: number) =>
	Number.isInteger(w) && w >= WEEKDAY_MIN && w <= WEEKDAY_MAX;

// Zod schemas for type-safe validation
const timeFieldSchema = z
	.string()
	.regex(timeFormatRegex, "must be in HH:MM format")
	.refine(isValidTimeValue, "must be between 00:00 and 23:59");

const dayConfigSchema = z.object({
	enabled: z.boolean().optional(),
	morningStart: timeFieldSchema.optional(),
	morningEnd: timeFieldSchema.optional(),
	afternoonStart: timeFieldSchema.optional(),
	afternoonEnd: timeFieldSchema.optional(),
});

const weeklyAvailabilitySchema = z
	.record(z.string(), dayConfigSchema)
	.refine((record) => {
		for (const key of Object.keys(record)) {
			const dayNum = parseInt(key, 10);
			if (!isValidWeekday(dayNum)) {
				return false;
			}
		}
		return true;
	}, "weekday keys must be 0-6")
	.refine((record) => {
		for (const [key, config] of Object.entries(record)) {
			if (
				config.morningStart &&
				config.morningEnd &&
				config.morningStart >= config.morningEnd
			) {
				return false;
			}
			if (
				config.afternoonStart &&
				config.afternoonEnd &&
				config.afternoonStart >= config.afternoonEnd
			) {
				return false;
			}
		}
		return true;
	}, "end time must be after start time");

export const validateWeeklyAvailability = (
	wa: unknown,
):
	| { valid: true; parsed: Record<string, unknown> }
	| { valid: false; error: string } => {
	if (wa === undefined || wa === null) {
		return { valid: true, parsed: {} };
	}

	const result = weeklyAvailabilitySchema.safeParse(wa);
	if (!result.success) {
		const firstError = result.error.errors[0];
		const path = firstError.path.length > 0 ? `.${firstError.path.join(".")}` : "";
		return { valid: false, error: `weeklyAvailability${path}: ${firstError.message}` };
	}

	return { valid: true, parsed: result.data };
};

// Export schemas for reuse
export { weeklyAvailabilitySchema, dayConfigSchema, timeFieldSchema };
