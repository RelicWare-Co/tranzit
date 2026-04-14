export interface RecurrenceRule {
	frequency: "daily" | "weekly" | "biweekly" | "monthly";
	interval?: number;
	byDayOfWeek?: number[];
	untilDate?: string;
	count?: number;
	timezone?: string;
}

export function parseRRule(rruleStr: string): RecurrenceRule {
	const rule: RecurrenceRule = { frequency: "daily" };
	const parts = rruleStr.split(";");

	for (const part of parts) {
		const [key, value] = part.split("=");
		switch (key) {
			case "FREQ":
			case "FREQUENCY":
				if (value === "DAILY") rule.frequency = "daily";
				else if (value === "WEEKLY") rule.frequency = "weekly";
				else if (value === "BIWEEKLY") rule.frequency = "biweekly";
				else if (value === "MONTHLY") rule.frequency = "monthly";
				break;
			case "INTERVAL":
				rule.interval = parseInt(value, 10);
				break;
			case "BYDAY":
				rule.byDayOfWeek = value.split(",").map((day) => {
					const dayMap: Record<string, number> = {
						SU: 0,
						MO: 1,
						TU: 2,
						WE: 3,
						TH: 4,
						FR: 5,
						SA: 6,
					};
					return dayMap[day] ?? 0;
				});
				break;
			case "UNTIL":
				if (value.length >= 8) {
					rule.untilDate = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
				}
				break;
			case "COUNT":
				rule.count = parseInt(value, 10);
				break;
		}
	}

	return rule;
}

export function generateOccurrences(
	rule: RecurrenceRule,
	startDate: string,
	endDate: string,
	existingOccurrenceKeys: Set<string>,
	slotStartTime: string,
): string[] {
	const dates: string[] = [];
	const start = new Date(`${startDate}T00:00:00`);
	const untilDate =
		rule.untilDate && rule.untilDate < endDate ? rule.untilDate : endDate;
	const end = new Date(`${untilDate}T23:59:59`);

	let count = 0;
	const maxCount = rule.count || 365;
	const interval = rule.interval && rule.interval > 0 ? rule.interval : 1;

	const formatDate = (date: Date) => {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	};

	if (
		rule.frequency === "weekly" &&
		rule.byDayOfWeek &&
		rule.byDayOfWeek.length > 0
	) {
		const byDays = new Set(rule.byDayOfWeek);
		const current = new Date(start);
		while (current <= end && count < maxCount) {
			const daysSinceStart = Math.floor(
				(current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
			);
			const weekIndex = Math.floor(daysSinceStart / 7);
			const onIntervalWeek = weekIndex % interval === 0;
			const dateStr = formatDate(current);
			const key = `${dateStr}|${slotStartTime}`;

			if (
				onIntervalWeek &&
				byDays.has(current.getDay()) &&
				!existingOccurrenceKeys.has(key)
			) {
				dates.push(dateStr);
				count += 1;
			}

			current.setDate(current.getDate() + 1);
		}

		return dates;
	}

	const current = new Date(start);
	while (current <= end && count < maxCount) {
		const dateStr = formatDate(current);
		const key = `${dateStr}|${slotStartTime}`;

		if (!existingOccurrenceKeys.has(key)) {
			dates.push(dateStr);
			count += 1;
		}

		switch (rule.frequency) {
			case "daily":
				current.setDate(current.getDate() + interval);
				break;
			case "weekly":
				current.setDate(current.getDate() + interval * 7);
				break;
			case "biweekly":
				current.setDate(current.getDate() + 14);
				break;
			case "monthly":
				current.setMonth(current.getMonth() + interval);
				break;
		}
	}

	return dates;
}

export function isDateOnOrAfter(
	dateStr: string,
	effectiveFrom: string,
	_timezone: string,
): boolean {
	return dateStr >= effectiveFrom;
}
