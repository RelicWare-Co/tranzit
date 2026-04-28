import type { ScheduleViewLevel } from "@mantine/schedule";
import { formatDateLocal } from "#/features/admin/components/-dates";
import type { BookingWithRelations } from "./-types";

export function withSeconds(time: string): string {
	return time.length === 5 ? `${time}:00` : time;
}

export function toDateTimeString(date: string, time: string): string {
	return `${date} ${withSeconds(time)}`;
}

export function getDateRange(baseDate: Date, view: ScheduleViewLevel) {
	switch (view) {
		case "day": {
			const value = formatDateLocal(baseDate);
			return { dateFrom: value, dateTo: value };
		}
		case "week": {
			const d = new Date(baseDate);
			const day = d.getDay();
			const diffToMonday = day === 0 ? -6 : 1 - day;
			d.setDate(d.getDate() + diffToMonday);
			const monday = new Date(d);
			const sunday = new Date(d);
			sunday.setDate(monday.getDate() + 6);
			return {
				dateFrom: formatDateLocal(monday),
				dateTo: formatDateLocal(sunday),
			};
		}
		case "month": {
			const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
			const lastDay = new Date(
				baseDate.getFullYear(),
				baseDate.getMonth() + 1,
				0,
			);
			return {
				dateFrom: formatDateLocal(firstDay),
				dateTo: formatDateLocal(lastDay),
			};
		}
		case "year": {
			const firstDay = new Date(baseDate.getFullYear(), 0, 1);
			const lastDay = new Date(baseDate.getFullYear(), 11, 31);
			return {
				dateFrom: formatDateLocal(firstDay),
				dateTo: formatDateLocal(lastDay),
			};
		}
		default: {
			const value = formatDateLocal(baseDate);
			return { dateFrom: value, dateTo: value };
		}
	}
}

export function getEventColor(booking: BookingWithRelations): string {
	if (booking.status === "cancelled") return "red";
	if (booking.status === "held" || booking.status === "hold") return "orange";
	if (booking.kind === "administrative") return "violet";
	return "blue";
}
