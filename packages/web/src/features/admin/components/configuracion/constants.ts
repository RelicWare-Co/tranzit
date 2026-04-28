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
