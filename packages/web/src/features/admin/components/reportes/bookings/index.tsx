import { Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { AlertCircle, Calendar } from "lucide-react";
import { useState } from "react";
import { adminUi } from "#/features/admin/components/admin-ui";
import { getErrorMessage } from "#/features/admin/components/errors";
import type { BookingFilters } from "../types";
import { BookingActionsPanel } from "./BookingActionsPanel";
import { BookingFilters as BookingFiltersComponent } from "./BookingFilters";
import { BookingTable } from "./BookingTable";

interface BookingsSectionProps {
	filtersDraft: BookingFilters;
	setFiltersDraft: (filters: BookingFilters) => void;
	_filters: BookingFilters;
	setFilters: (filters: BookingFilters) => void;
	bookingsQuery: {
		data?: Array<{
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
		}>;
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
		bookingsQuery.data?.find((b) => b.id === selectedBookingId) ?? null;

	const handleApplyFilters = (filters: BookingFilters) => {
		setFiltersDraft(filters);
		setFilters(filters);
	};

	return (
		<Card className={adminUi.surface} radius="lg" p="md" shadow="none">
			<Stack gap="lg">
				{/* Header */}
				<Group justify="space-between" wrap="nowrap">
					<Group gap="md" wrap="nowrap">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-100">
							<Calendar size={20} className="text-red-700" strokeWidth={1.75} />
						</div>
						<Stack gap={0}>
							<Title
								order={4}
								className="text-base font-semibold text-[var(--text-primary)]"
							>
								Citas administrativas
							</Title>
							<Text size="sm" className="text-[var(--text-secondary)]">
								Gestioná reservas individuales con filtros por fecha, estado y
								funcionario.
							</Text>
						</Stack>
					</Group>
					{bookingsQuery.isLoading && <Loader size="sm" />}
				</Group>

				{/* Filters */}
				<BookingFiltersComponent
					filters={filtersDraft}
					onApply={handleApplyFilters}
					isLoading={bookingsQuery.isLoading}
				/>

				{/* Error state */}
				{bookingsQuery.isError ? (
					<div
						className={`${adminUi.callout} flex items-center gap-3 px-4 py-3`}
					>
						<AlertCircle size={16} className="text-red-600 shrink-0" />
						<Text size="sm" className="text-red-700">
							{getErrorMessage(
								bookingsQuery.error,
								"No se pudieron cargar las citas",
							)}
						</Text>
					</div>
				) : null}

				{/* Table */}
				<BookingTable
					bookings={bookingsQuery.data ?? []}
					selectedBookingId={selectedBookingId}
					onSelectBooking={(id) => setSelectedBookingId(id)}
					runAction={runAction}
					releaseReason={releaseReason}
					reassignTargetStaffId={reassignTargetStaffId}
				/>

				{/* Actions */}
				{selectedBooking && (
					<BookingActionsPanel
						selectedBooking={selectedBooking}
						isRunning={isRunning}
						runAction={runAction}
						staffOptions={staffOptions}
						releaseReason={releaseReason}
						onReleaseReasonChange={setReleaseReason}
						reassignTargetStaffId={reassignTargetStaffId}
						onReassignTargetChange={setReassignTargetStaffId}
					/>
				)}
			</Stack>
		</Card>
	);
}
