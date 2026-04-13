export const WEEKDAY_MIN = 0;
export const WEEKDAY_MAX = 6;

export const isValidWeekday = (w: number) =>
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

export const parsePositiveInteger = (value: unknown): number | null => {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) return null;
	return parsed;
};

export const parseNonNegativeInteger = (value: unknown): number | null => {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 0) return null;
	return parsed;
};
