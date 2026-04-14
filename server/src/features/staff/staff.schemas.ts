const WEEKDAY_MIN = 0;
const WEEKDAY_MAX = 6;

const isValidWeekday = (w: number) =>
	Number.isInteger(w) && w >= WEEKDAY_MIN && w <= WEEKDAY_MAX;

export const isValidTimeFormat = (t: string | null | undefined): boolean => {
	if (!t) return true;
	return /^\d{2}:\d{2}$/.test(t) && t >= "00:00" && t <= "23:59";
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

export const errorResponse = (code: string, message: string, status: number) =>
	new Response(JSON.stringify({ code, message }), {
		status,
		headers: { "Content-Type": "application/json" },
	});

export const validateWeeklyAvailability = (
	wa: unknown,
):
	| { valid: true; parsed: Record<string, unknown> }
	| { valid: false; error: string } => {
	if (wa === undefined || wa === null) {
		return { valid: true, parsed: {} };
	}

	if (typeof wa !== "object" || Array.isArray(wa)) {
		return { valid: false, error: "weeklyAvailability must be an object" };
	}

	const parsed = wa as Record<string, unknown>;
	const days = Object.keys(parsed);

	for (const day of days) {
		const dayNum = parseInt(day, 10);
		if (!isValidWeekday(dayNum)) {
			return {
				valid: false,
				error: `Invalid weekday key: ${day}. Must be 0-6.`,
			};
		}

		const dayConfig = parsed[day];
		if (typeof dayConfig !== "object" || dayConfig === null) {
			return {
				valid: false,
				error: `weeklyAvailability.${day} must be an object`,
			};
		}

		const config = dayConfig as Record<string, unknown>;

		if (config.enabled !== undefined && typeof config.enabled !== "boolean") {
			return {
				valid: false,
				error: `weeklyAvailability.${day}.enabled must be a boolean`,
			};
		}

		const timeFields = [
			"morningStart",
			"morningEnd",
			"afternoonStart",
			"afternoonEnd",
		];

		for (const field of timeFields) {
			if (config[field] !== undefined) {
				if (typeof config[field] !== "string") {
					return {
						valid: false,
						error: `weeklyAvailability.${day}.${field} must be a string`,
					};
				}
				if (!isValidTimeFormat(config[field] as string)) {
					return {
						valid: false,
						error: `weeklyAvailability.${day}.${field} must be in HH:MM format`,
					};
				}
			}
		}

		const morningStart = config.morningStart as string | undefined;
		const morningEnd = config.morningEnd as string | undefined;
		if (
			morningStart &&
			morningEnd &&
			!isValidTimeWindow(morningStart, morningEnd)
		) {
			return {
				valid: false,
				error: `weeklyAvailability.${day}.morningEnd must be after morningStart`,
			};
		}

		const afternoonStart = config.afternoonStart as string | undefined;
		const afternoonEnd = config.afternoonEnd as string | undefined;
		if (
			afternoonStart &&
			afternoonEnd &&
			!isValidTimeWindow(afternoonStart, afternoonEnd)
		) {
			return {
				valid: false,
				error: `weeklyAvailability.${day}.afternoonEnd must be after afternoonStart`,
			};
		}
	}

	return { valid: true, parsed };
};
