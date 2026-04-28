export type BookingFilters = {
	dateFrom: string;
	dateTo: string;
	status: string;
	isActive: "all" | "true" | "false";
};

export const defaultBookingFilters: BookingFilters = {
	dateFrom: "",
	dateTo: "",
	status: "",
	isActive: "true",
};

export type ReservationSeriesFilters = {
	isActive: "all" | "true" | "false";
};

export const defaultSeriesFilters: ReservationSeriesFilters = {
	isActive: "true",
};

export type ReservationInstance = {
	id: string;
	slotId: string;
	staffUserId: string | null;
	status: string;
	isActive: boolean;
	notes: string | null;
	slot?: {
		slotDate?: string;
		startTime?: string;
		endTime?: string;
	} | null;
};

export function isReservationInstance(
	value: unknown,
): value is ReservationInstance {
	if (!value || typeof value !== "object") return false;
	const instance = value as Record<string, unknown>;
	return (
		typeof instance.id === "string" &&
		typeof instance.slotId === "string" &&
		typeof instance.status === "string" &&
		typeof instance.isActive === "boolean"
	);
}
