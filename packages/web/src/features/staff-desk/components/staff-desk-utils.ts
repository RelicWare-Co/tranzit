import type { orpcClient } from "#/shared/lib/orpc-client";

type StaffDeskCase = Awaited<
	ReturnType<typeof orpcClient.staffDesk.queue>
>["cases"][number];

export type DeskCasePhase =
	| "ready"
	| "reviewing"
	| "ready_to_complete"
	| "completed"
	| "cancelled"
	| "expired";

export const PHASE_DETAILS: Record<
	DeskCasePhase,
	{ label: string; color: string; description: string }
> = {
	ready: {
		label: "Por recibir",
		color: "blue",
		description:
			"Confirma la presencia del ciudadano para iniciar la atención.",
	},
	reviewing: {
		label: "En revisión",
		color: "violet",
		description: "Valida identidad y requisitos físicos del trámite.",
	},
	ready_to_complete: {
		label: "Listo para finalizar",
		color: "teal",
		description: "Los requisitos ya fueron validados.",
	},
	completed: {
		label: "Finalizado",
		color: "teal",
		description: "La atención quedó registrada y el cupo fue liberado.",
	},
	cancelled: {
		label: "Cerrado sin completar",
		color: "gray",
		description: "La atención no continuó y no consume capacidad.",
	},
	expired: {
		label: "Hold vencido",
		color: "orange",
		description: "La reserva temporal ya no estaba vigente.",
	},
};

function getEligibilityRecord(
	deskCase: StaffDeskCase,
	key: "staffCheckIn" | "staffReview",
) {
	const value = deskCase.request.eligibilityResult[key];
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function getTimestamp(value: unknown) {
	return typeof value === "string" && value.length > 0 ? value : null;
}

export function getDeskEvidence(deskCase: StaffDeskCase) {
	const checkIn = getEligibilityRecord(deskCase, "staffCheckIn");
	const review = getEligibilityRecord(deskCase, "staffReview");
	return {
		checkedInAt: getTimestamp(checkIn?.checkedInAt),
		reviewedAt: getTimestamp(review?.reviewedAt),
		reviewPassed: review?.passed === true,
	};
}

export function getCasePhase(deskCase: StaffDeskCase): DeskCasePhase {
	if (deskCase.status === "expired") return "expired";
	if (
		deskCase.status === "cancelled" ||
		deskCase.request.status === "cancelled"
	) {
		return "cancelled";
	}
	if (deskCase.status === "attended" && deskCase.isActive === false) {
		return "completed";
	}
	const evidence = getDeskEvidence(deskCase);
	if (evidence.reviewPassed) return "ready_to_complete";
	if (evidence.checkedInAt) return "reviewing";
	return "ready";
}

export function formatDateTime(value: Date | string | null | undefined) {
	if (!value) return "Sin fecha registrada";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "Sin fecha registrada";
	return date.toLocaleString("es-CO", {
		dateStyle: "medium",
		timeStyle: "short",
	});
}

export function getBogotaIsoDate() {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/Bogota",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(new Date());
	const byType = new Map(parts.map((part) => [part.type, part.value]));
	return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

export function getBogotaNowMinutes(): number {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/Bogota",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).formatToParts(new Date());
	const byType = new Map(parts.map((part) => [part.type, part.value]));
	const hour = Number(byType.get("hour"));
	const minute = Number(byType.get("minute"));
	return hour * 60 + minute;
}

export function getBogotaNowLabel(): string {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/Bogota",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).formatToParts(new Date());
	const byType = new Map(parts.map((part) => [part.type, part.value]));
	return `${byType.get("hour")}:${byType.get("minute")}`;
}

export function parseSlotMinutes(time: string): number {
	const [hours, minutes] = time.split(":").map(Number);
	return (hours || 0) * 60 + (minutes || 0);
}

export function isFutureDate(deskCase: StaffDeskCase): boolean {
	return deskCase.slot.slotDate !== getBogotaIsoDate();
}

export function isOverdue(deskCase: StaffDeskCase): boolean {
	if (isFutureDate(deskCase)) return false;
	if (getCasePhase(deskCase) !== "ready") return false;
	return parseSlotMinutes(deskCase.slot.startTime) <= getBogotaNowMinutes();
}

export function isInAttentionNow(deskCase: StaffDeskCase): boolean {
	if (isFutureDate(deskCase)) return false;
	const phase = getCasePhase(deskCase);
	return phase === "reviewing" || phase === "ready_to_complete";
}

export function isUpcoming(deskCase: StaffDeskCase): boolean {
	if (getCasePhase(deskCase) !== "ready") return false;
	if (isFutureDate(deskCase)) return true;
	return parseSlotMinutes(deskCase.slot.startTime) > getBogotaNowMinutes();
}

export type CaseSection = "now" | "upcoming" | "completed" | "incidents";

export function getCaseSection(deskCase: StaffDeskCase): CaseSection {
	const phase = getCasePhase(deskCase);
	if (phase === "completed") return "completed";
	if (phase === "cancelled" || phase === "expired") return "incidents";
	if (isInAttentionNow(deskCase) || isOverdue(deskCase)) return "now";
	return "upcoming";
}

export const SECTION_DETAILS: Record<
	CaseSection,
	{ label: string; hint: string }
> = {
	now: { label: "Ahora", hint: "En atención o retrasadas" },
	upcoming: {
		label: "Próximas",
		hint: "Citas agendadas aún no iniciadas",
	},
	completed: { label: "Finalizadas", hint: "Trámites cerrados" },
	incidents: {
		label: "Incidencias",
		hint: "Canceladas o con hold vencido",
	},
};

export function sortCasesByStart(cases: StaffDeskCase[]): StaffDeskCase[] {
	return [...cases].sort(
		(a, b) =>
			a.slot.startTime.localeCompare(b.slot.startTime) ||
			a.slot.endTime.localeCompare(b.slot.endTime),
	);
}

export function groupCasesBySection(
	cases: StaffDeskCase[],
): Record<CaseSection, StaffDeskCase[]> {
	const groups: Record<CaseSection, StaffDeskCase[]> = {
		now: [],
		upcoming: [],
		completed: [],
		incidents: [],
	};
	for (const deskCase of cases) {
		groups[getCaseSection(deskCase)].push(deskCase);
	}
	return groups;
}

export function findNextUpCase(cases: StaffDeskCase[]): StaffDeskCase | null {
	const sorted = sortCasesByStart(cases);
	const inAttention = sorted.find(isInAttentionNow);
	if (inAttention) return inAttention;
	const overdue = sorted.find(isOverdue);
	if (overdue) return overdue;
	const upcoming = sorted.find(isUpcoming);
	return upcoming ?? null;
}

export function getErrorMessage(error: unknown, fallback: string) {
	if (error instanceof Error && error.message) return error.message;
	if (error && typeof error === "object" && "message" in error) {
		const message = (error as { message?: unknown }).message;
		if (typeof message === "string" && message) return message;
	}
	return fallback;
}
