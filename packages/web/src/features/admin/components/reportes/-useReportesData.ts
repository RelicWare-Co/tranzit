import { notifications } from "@mantine/notifications";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "#/features/admin/components/-errors";
import { orpcClient } from "#/shared/lib/orpc-client";
import {
	type BookingFilters,
	defaultBookingFilters,
	defaultSeriesFilters,
	isReservationInstance,
	type ReservationSeriesFilters,
} from "./-types";

const SESSION_QUERY_KEY = ["admin", "reportes", "session"] as const;
const STAFF_QUERY_KEY = ["admin", "reportes", "staff"] as const;

function asNullableText(value: string): string | null {
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function notifySuccess(message: string) {
	notifications.show({
		color: "teal",
		title: "Éxito",
		message,
		position: "top-right",
	});
}

function notifyError(error: unknown, fallback: string) {
	notifications.show({
		color: "red",
		title: "Error",
		message: getErrorMessage(error, fallback),
		position: "top-right",
	});
}

export function useReportesData() {
	const queryClient = useQueryClient();

	const [isRunning, setIsRunning] = useState<string | null>(null);
	const [actionResult, setActionResult] = useState<unknown | null>(null);

	const [bookingFiltersDraft, setBookingFiltersDraft] =
		useState<BookingFilters>(defaultBookingFilters);
	const [bookingFilters, setBookingFilters] = useState<BookingFilters>(
		defaultBookingFilters,
	);

	const [seriesFilters, setSeriesFilters] =
		useState<ReservationSeriesFilters>(defaultSeriesFilters);

	const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
		null,
	);
	const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
	const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
		null,
	);

	const sessionQuery = useQuery({
		queryKey: SESSION_QUERY_KEY,
		queryFn: async () => await orpcClient.session.get(),
	});

	const staffQuery = useQuery({
		queryKey: STAFF_QUERY_KEY,
		queryFn: async () => await orpcClient.admin.staff.list({}),
	});

	const bookingsQuery = useQuery({
		queryKey: ["admin", "reportes", "bookings", bookingFilters],
		queryFn: async () => {
			const payload: Parameters<typeof orpcClient.admin.bookings.list>[0] = {};
			if (bookingFilters.dateFrom) payload.dateFrom = bookingFilters.dateFrom;
			if (bookingFilters.dateTo) payload.dateTo = bookingFilters.dateTo;
			if (bookingFilters.status) payload.status = bookingFilters.status;
			if (bookingFilters.isActive !== "all") {
				payload.isActive = bookingFilters.isActive === "true";
			}
			return await orpcClient.admin.bookings.list(payload);
		},
	});

	const seriesQuery = useQuery({
		queryKey: ["admin", "reportes", "series", seriesFilters],
		queryFn: async () => {
			const payload: Parameters<
				typeof orpcClient.admin.reservationSeries.list
			>[0] = {};
			if (seriesFilters.isActive !== "all") {
				payload.isActive = seriesFilters.isActive;
			}
			return await orpcClient.admin.reservationSeries.list(payload);
		},
	});

	const seriesInstancesQuery = useQuery({
		queryKey: ["admin", "reportes", "series-instances", selectedSeriesId],
		enabled: Boolean(selectedSeriesId),
		queryFn: async () =>
			await orpcClient.admin.reservationSeries.instances({
				id: selectedSeriesId ?? "",
				isActive: true,
			}),
	});

	const refreshAll = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: ["admin", "reportes", "bookings"],
			}),
			queryClient.invalidateQueries({
				queryKey: ["admin", "reportes", "series"],
			}),
			queryClient.invalidateQueries({
				queryKey: ["admin", "reportes", "series-instances", selectedSeriesId],
			}),
		]);
	}, [queryClient, selectedSeriesId]);

	const staffOptions = useMemo(
		() =>
			(staffQuery.data ?? []).map((staff) => ({
				value: staff.userId,
				label: staff.user?.name || staff.user?.email || staff.userId,
			})),
		[staffQuery.data],
	);

	const selectedBooking = useMemo(
		() =>
			(bookingsQuery.data ?? []).find(
				(booking) => booking.id === selectedBookingId,
			) ?? null,
		[bookingsQuery.data, selectedBookingId],
	);

	const selectedSeries = useMemo(
		() =>
			(seriesQuery.data ?? []).find(
				(series) => series.id === selectedSeriesId,
			) ?? null,
		[seriesQuery.data, selectedSeriesId],
	);

	const instances = useMemo(
		() => (seriesInstancesQuery.data ?? []).filter(isReservationInstance),
		[seriesInstancesQuery.data],
	);

	const selectedInstance = useMemo(
		() =>
			instances.find((instance) => instance.id === selectedInstanceId) ?? null,
		[instances, selectedInstanceId],
	);

	// Auto-select first item when data changes
	useEffect(() => {
		if (!bookingsQuery.data?.length) {
			setSelectedBookingId(null);
			return;
		}
		if (
			!selectedBookingId ||
			!bookingsQuery.data.some((booking) => booking.id === selectedBookingId)
		) {
			setSelectedBookingId(bookingsQuery.data[0]?.id ?? null);
		}
	}, [bookingsQuery.data, selectedBookingId]);

	useEffect(() => {
		if (!seriesQuery.data?.length) {
			setSelectedSeriesId(null);
			return;
		}
		if (
			!selectedSeriesId ||
			!seriesQuery.data.some((series) => series.id === selectedSeriesId)
		) {
			setSelectedSeriesId(seriesQuery.data[0]?.id ?? null);
		}
	}, [seriesQuery.data, selectedSeriesId]);

	useEffect(() => {
		if (!instances.length) {
			setSelectedInstanceId(null);
			return;
		}
		if (
			!selectedInstanceId ||
			!instances.some((instance) => instance.id === selectedInstanceId)
		) {
			setSelectedInstanceId(instances[0]?.id ?? null);
		}
	}, [instances, selectedInstanceId]);

	const runAction = async (
		actionId: string,
		action: () => Promise<unknown>,
		successMessage: string,
		errorFallback: string,
	) => {
		setActionResult(null);
		setIsRunning(actionId);
		try {
			const response = await action();
			setActionResult(response);
			notifySuccess(successMessage);
			await refreshAll();
			return response;
		} catch (error) {
			notifyError(error, errorFallback);
			throw error;
		} finally {
			setIsRunning(null);
		}
	};

	const createSeries = async (values: {
		recurrenceRule: string;
		slotId: string;
		staffUserId: string;
		startDate: string;
		endDate: string;
		notes: string | null;
	}) => {
		return runAction(
			"create-series",
			async () =>
				await orpcClient.admin.reservationSeries.create({
					recurrenceRule: values.recurrenceRule,
					slotId: values.slotId,
					staffUserId: values.staffUserId,
					startDate: values.startDate,
					endDate: values.endDate,
					notes: values.notes,
				}),
			"Serie creada correctamente.",
			"No se pudo crear la serie.",
		);
	};

	const totalBookings = bookingsQuery.data?.length ?? 0;
	const confirmedBookings =
		bookingsQuery.data?.filter((b) => b.status === "confirmed").length ?? 0;
	const heldBookings =
		bookingsQuery.data?.filter((b) => b.status === "held").length ?? 0;
	const activeSeries = seriesQuery.data?.filter((s) => s.isActive).length ?? 0;

	return {
		// Queries
		sessionQuery,
		staffQuery,
		bookingsQuery,
		seriesQuery,
		seriesInstancesQuery,
		refreshAll,

		// State
		isRunning,
		actionResult,
		setActionResult,

		// Filters
		bookingFiltersDraft,
		setBookingFiltersDraft,
		bookingFilters,
		setBookingFilters,
		seriesFilters,
		setSeriesFilters,

		// Selection
		selectedBookingId,
		setSelectedBookingId,
		selectedSeriesId,
		setSelectedSeriesId,
		selectedInstanceId,
		setSelectedInstanceId,

		// Derived
		staffOptions,
		selectedBooking,
		selectedSeries,
		instances,
		selectedInstance,

		// Stats
		totalBookings,
		confirmedBookings,
		heldBookings,
		activeSeries,

		// Actions
		runAction,
		createSeries,
		asNullableText,
	};
}
