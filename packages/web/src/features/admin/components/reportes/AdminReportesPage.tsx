import { Button, Card, Group, Loader, Stack, Text } from "@mantine/core";
import { RefreshCw, Users } from "lucide-react";
import { AdminPageHeader } from "#/features/admin/components/AdminPageHeader";
import { adminUi } from "#/features/admin/components/admin-ui";
import { BookingsSection } from "./bookings";
import { StatsOverview } from "./StatsOverview";
import { SeriesSection } from "./series";
import { useReportesData } from "./useReportesData";

export function AdminReportesPage() {
	const {
		sessionQuery,
		bookingsQuery,
		seriesQuery,
		seriesInstancesQuery,
		refreshAll,
		isRunning,
		actionResult,
		setActionResult,
		bookingFiltersDraft,
		setBookingFiltersDraft,
		bookingFilters,
		setBookingFilters,
		seriesFilters,
		setSeriesFilters,
		selectedBookingId,
		setSelectedBookingId,
		selectedSeriesId,
		setSelectedSeriesId,
		selectedInstanceId,
		setSelectedInstanceId,
		staffOptions,
		selectedSeries,
		instances,
		totalBookings,
		confirmedBookings,
		heldBookings,
		activeSeries,
		runAction,
		createSeries,
		asNullableText,
	} = useReportesData();

	return (
		<Stack gap="xl">
			<AdminPageHeader
				title="Reportes y operaciones"
				description="Gestión operativa de citas, series de reserva e instancias administrativas."
				actions={
					<Button
						leftSection={<RefreshCw size={16} />}
						onClick={() => void refreshAll()}
						variant="light"
						size="sm"
					>
						Refrescar
					</Button>
				}
			/>

			{(sessionQuery.isPending || !sessionQuery.data) && (
				<Group justify="center" py="xl">
					<Loader size="sm" />
				</Group>
			)}

			{sessionQuery.data && (
				<>
					{/* Session Card */}
					<Card className={adminUi.callout} radius="lg" p="md" shadow="none">
						<Group gap="md" wrap="nowrap">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-zinc-200">
								<Users size={18} className="text-red-700" strokeWidth={1.75} />
							</div>
							<Stack gap={0}>
								<Text className="text-sm font-semibold text-[var(--text-primary)]">
									Sesión activa
								</Text>
								<Text size="sm" className="text-[var(--text-secondary)]">
									{sessionQuery.data.user.email} (
									{sessionQuery.data.user.role ?? "sin rol"})
								</Text>
							</Stack>
						</Group>
					</Card>

					{/* Stats */}
					<StatsOverview
						confirmedBookings={confirmedBookings}
						heldBookings={heldBookings}
						totalBookings={totalBookings}
						activeSeries={activeSeries}
					/>

					{/* Bookings */}
					<BookingsSection
						filtersDraft={bookingFiltersDraft}
						setFiltersDraft={setBookingFiltersDraft}
						_filters={bookingFilters}
						setFilters={setBookingFilters}
						bookingsQuery={bookingsQuery}
						selectedBookingId={selectedBookingId}
						setSelectedBookingId={setSelectedBookingId}
						staffOptions={staffOptions}
						isRunning={isRunning}
						runAction={runAction}
					/>

					{/* Series */}
					<SeriesSection
						seriesQuery={seriesQuery}
						selectedSeriesId={selectedSeriesId}
						setSelectedSeriesId={setSelectedSeriesId}
						selectedInstanceId={selectedInstanceId}
						setSelectedInstanceId={setSelectedInstanceId}
						instances={instances}
						seriesInstancesQuery={seriesInstancesQuery}
						staffOptions={staffOptions}
						isRunning={isRunning}
						runAction={runAction}
						createSeries={createSeries}
						seriesFilters={seriesFilters}
						setSeriesFilters={setSeriesFilters}
						selectedSeries={selectedSeries}
						asNullableText={asNullableText}
					/>

					{/* Action Result */}
					{actionResult ? (
						<Card className={adminUi.callout} radius="lg" p="md" shadow="none">
							<Stack gap="xs">
								<Group justify="space-between">
									<Text
										fw={600}
										size="sm"
										className="text-[var(--text-primary)]"
									>
										Resultado de la operación
									</Text>
									<Button
										variant="subtle"
										size="xs"
										onClick={() => setActionResult(null)}
									>
										Cerrar
									</Button>
								</Group>
								<Text
									component="pre"
									fz="xs"
									style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
									className="text-[var(--text-secondary)]"
								>
									{JSON.stringify(actionResult, null, 2)}
								</Text>
							</Stack>
						</Card>
					) : null}
				</>
			)}
		</Stack>
	);
}
