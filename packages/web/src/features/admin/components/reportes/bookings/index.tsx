import { Alert, EmptyState } from "@mantine/core";
import { AlertCircle, CalendarSearch } from "lucide-react";
import { useState } from "react";
import { getErrorMessage } from "#/features/admin/components/errors";
import classes from "../Reportes.module.css";
import { ReportSectionHeader } from "../ReportSectionHeader";
import type { BookingFilters } from "../types";
import { BookingActionsPanel } from "./BookingActionsPanel";
import { BookingFilters as BookingFiltersComponent } from "./BookingFilters";
import { BookingTable } from "./BookingTable";

interface BookingItem {
	id: string;
	status: string;
	isActive: boolean;
	slotId: string;
	slot?: {
		slotDate?: string;
		startTime?: string;
		endTime?: string;
	} | null;
	staff?: {
		name?: string | null;
		email?: string | null;
	} | null;
	request?: {
		email?: string | null;
		procedureType?: {
			name?: string | null;
		} | null;
		citizen?: {
			name?: string | null;
			email?: string | null;
		} | null;
	} | null;
}

interface BookingsSectionProps {
	filtersDraft: BookingFilters;
	setFiltersDraft: (filters: BookingFilters) => void;
	_filters: BookingFilters;
	setFilters: (filters: BookingFilters) => void;
	bookingsQuery: {
		data?: BookingItem[];
		isLoading: boolean;
		isError: boolean;
		error: unknown;
	};
	selectedBookingId: string | null;
	setSelectedBookingId: (id: string | null) => void;
	staffOptions: Array<{ value: string; label: string }>;
	isRunning: string | null;
	runAction: (
		actionId: string,
		action: () => Promise<unknown>,
		successMessage: string,
		errorFallback: string,
	) => Promise<unknown>;
}

export function BookingsSection({
	filtersDraft,
	setFiltersDraft,
	setFilters,
	bookingsQuery,
	selectedBookingId,
	setSelectedBookingId,
	staffOptions,
	isRunning,
	runAction,
}: BookingsSectionProps) {
	const [releaseReason, setReleaseReason] = useState<
		"cancelled" | "expired" | "attended"
	>("cancelled");
	const [reassignTargetStaffId, setReassignTargetStaffId] = useState("");

	const selectedBooking =
		bookingsQuery.data?.find((booking) => booking.id === selectedBookingId) ??
		null;

	const handleApplyFilters = (filters: BookingFilters) => {
		setFiltersDraft(filters);
		setFilters(filters);
	};

	return (
		<div className={classes.sectionStack}>
			<ReportSectionHeader
				title="Citas de la agenda"
				description="Consulta las reservas que consumen capacidad, revisa su contexto y ejecuta acciones sobre una cita seleccionada."
				count={bookingsQuery.data?.length ?? 0}
				countLabel="citas"
			/>

			<BookingFiltersComponent
				filters={filtersDraft}
				onApply={handleApplyFilters}
				isLoading={bookingsQuery.isLoading}
			/>

			{bookingsQuery.isError ? (
				<Alert color="red" icon={<AlertCircle size={18} />} radius="md">
					{getErrorMessage(
						bookingsQuery.error,
						"No se pudieron cargar las citas",
					)}
				</Alert>
			) : null}

			<div className={classes.bookingWorkspace}>
				<BookingTable
					bookings={bookingsQuery.data ?? []}
					selectedBookingId={selectedBookingId}
					onSelectBooking={setSelectedBookingId}
					isLoading={bookingsQuery.isLoading}
				/>

				{selectedBooking ? (
					<BookingActionsPanel
						key={selectedBooking.id}
						selectedBooking={selectedBooking}
						isRunning={isRunning}
						runAction={runAction}
						staffOptions={staffOptions}
						releaseReason={releaseReason}
						onReleaseReasonChange={setReleaseReason}
						reassignTargetStaffId={reassignTargetStaffId}
						onReassignTargetChange={setReassignTargetStaffId}
					/>
				) : (
					<div className={classes.emptySelection}>
						<EmptyState
							icon={<CalendarSearch size={28} />}
							title="Selecciona una cita"
							description="El detalle y las acciones disponibles aparecerán aquí."
							size="sm"
							withIndicatorBackground
						/>
					</div>
				)}
			</div>
		</div>
	);
}
