export const weekdayLabels: Record<number, string> = {
	0: "Domingo",
	1: "Lunes",
	2: "Martes",
	3: "Miércoles",
	4: "Jueves",
	5: "Viernes",
	6: "Sábado",
};

export const weekdayColors: Record<number, string> = {
	0: "bg-rose-100 text-rose-700 border-rose-200",
	1: "bg-emerald-100 text-emerald-700 border-emerald-200",
	2: "bg-emerald-100 text-emerald-700 border-emerald-200",
	3: "bg-emerald-100 text-emerald-700 border-emerald-200",
	4: "bg-emerald-100 text-emerald-700 border-emerald-200",
	5: "bg-emerald-100 text-emerald-700 border-emerald-200",
	6: "bg-amber-100 text-amber-700 border-amber-200",
};

export const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

export function validateTime(
	value: string | undefined,
	fieldName: string,
): string | null {
	if (!value || value.trim() === "") return null;
	if (!timeRegex.test(value)) return `${fieldName} debe tener formato HH:MM`;
	return null;
}

export function isTimeBefore(start: string, end: string): boolean {
	return start < end;
}

export function validateMorningWindow(
	morningStart: string,
	morningEnd: string,
): string | null {
	if (!morningStart || !morningEnd) return null;
	if (!isTimeBefore(morningStart, morningEnd)) {
		return "El fin de mañana debe ser posterior al inicio";
	}
	return null;
}

export function validateAfternoonWindow(
	afternoonStart: string,
	afternoonEnd: string,
): string | null {
	if (!afternoonStart || !afternoonEnd) return null;
	if (!isTimeBefore(afternoonStart, afternoonEnd)) {
		return "El fin de tarde debe ser posterior al inicio";
	}
	return null;
}

export function validateMorningBeforeAfternoon(
	morningEnd: string,
	afternoonStart: string,
): string | null {
	if (!morningEnd || !afternoonStart) return null;
	if (!isTimeBefore(morningEnd, afternoonStart)) {
		return "El inicio de tarde debe ser posterior al fin de mañana";
	}
	return null;
}

export interface ScheduleTimeFields {
	morningStart: string;
	morningEnd: string;
	afternoonStart: string;
	afternoonEnd: string;
}

export function validateScheduleTimeFields(
	values: ScheduleTimeFields,
): Partial<Record<keyof ScheduleTimeFields, string>> {
	const errors: Partial<Record<keyof ScheduleTimeFields, string>> = {};

	const morningStartError = validateTime(
		values.morningStart,
		"Hora inicio mañana",
	);
	if (morningStartError) errors.morningStart = morningStartError;

	const morningEndError = validateTime(values.morningEnd, "Hora fin mañana");
	if (morningEndError) errors.morningEnd = morningEndError;

	const afternoonStartError = validateTime(
		values.afternoonStart,
		"Hora inicio tarde",
	);
	if (afternoonStartError) errors.afternoonStart = afternoonStartError;

	const afternoonEndError = validateTime(values.afternoonEnd, "Hora fin tarde");
	if (afternoonEndError) errors.afternoonEnd = afternoonEndError;

	const morningWindowError = validateMorningWindow(
		values.morningStart,
		values.morningEnd,
	);
	if (morningWindowError) {
		errors.morningEnd = morningWindowError;
	}

	const afternoonWindowError = validateAfternoonWindow(
		values.afternoonStart,
		values.afternoonEnd,
	);
	if (afternoonWindowError) {
		errors.afternoonEnd = afternoonWindowError;
	}

	const gapError = validateMorningBeforeAfternoon(
		values.morningEnd,
		values.afternoonStart,
	);
	if (gapError) {
		errors.afternoonStart = gapError;
	}

	return errors;
}
