import type { AdminBooking, BookingByStaff } from "./types";

export function mapBookingsByStaff(bookings: AdminBooking[]): BookingByStaff {
	return bookings.reduce<BookingByStaff>((acc, booking) => {
		if (!booking.staffUserId) {
			return acc;
		}
		if (!acc[booking.staffUserId]) {
			acc[booking.staffUserId] = [];
		}
		acc[booking.staffUserId].push(booking);
		return acc;
	}, {});
}

export function getBookingStatusLabel(status: string): string {
	if (status === "confirmed") return "Confirmada";
	if (status === "held") return "En hold";
	if (status === "cancelled") return "Cancelada";
	if (status === "attended") return "Atendida";
	if (status === "released") return "Liberada";
	return status;
}

export function getBookingStatusColor(status: string): string {
	if (status === "confirmed") return "green";
	if (status === "held") return "yellow";
	if (status === "cancelled") return "red";
	if (status === "attended") return "teal";
	if (status === "released") return "gray";
	return "blue";
}
