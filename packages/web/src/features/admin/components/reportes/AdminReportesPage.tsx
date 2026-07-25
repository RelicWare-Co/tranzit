import { Alert, Badge, Button, Skeleton, Tabs, Text } from "@mantine/core";
import {
	AlertCircle,
	CalendarDays,
	RefreshCw,
	Repeat2,
	ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { AdminPageHeader } from "#/features/admin/components/AdminPageHeader";
import { getErrorMessage } from "#/features/admin/components/errors";
import { BookingsSection } from "./bookings";
import { OperationResult } from "./OperationResult";
import classes from "./Reportes.module.css";
import { StatsOverview } from "./StatsOverview";
import { SeriesSection } from "./series";
import { useReportesData } from "./useReportesData";

type ReportsTab = "bookings" | "series";

export function AdminReportesPage() {
	const [activeTab, setActiveTab] = useState<ReportsTab>("bookings");
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

	const isRefreshing =
		bookingsQuery.isFetching ||
		seriesQuery.isFetching ||
		seriesInstancesQuery.isFetching;

	return (
		<div className={classes.page}>
			<div className={classes.pageStack}>
				<AdminPageHeader
					title="Operación y reportes"
					description="Consulta el estado de la agenda y gestiona citas o reservas recurrentes desde un mismo lugar."
					actions={
						<Button
							leftSection={<RefreshCw size={16} />}
							onClick={() => void refreshAll()}
							variant="default"
							loading={isRefreshing}
						>
							Actualizar datos
						</Button>
					}
				/>

				{sessionQuery.isError ? (
					<Alert color="red" icon={<AlertCircle size={18} />} radius="md">
						<Text fw={650}>
							{getErrorMessage(
								sessionQuery.error,
								"No se pudo validar la sesión operativa",
							)}
						</Text>
					</Alert>
				) : null}

				{sessionQuery.isPending ? (
					<div
						className={classes.pageStack}
						role="status"
						aria-label="Cargando reportes"
					>
						<Skeleton height={44} radius="md" />
						<Skeleton height={108} radius="lg" />
						<Skeleton height={520} radius="lg" />
					</div>
				) : null}

				{sessionQuery.data ? (
					<>
						<div className={classes.sessionBar}>
							<span className={classes.sessionIcon}>
								<ShieldCheck size={16} aria-hidden="true" />
							</span>
							<span className={classes.sessionCopy}>
								<span className={classes.sessionLabel}>Sesión operativa</span>
								{" · "}
								{sessionQuery.data.user.email}
							</span>
							<Badge color="gray" variant="light">
								{sessionQuery.data.user.role ?? "Sin rol"}
							</Badge>
						</div>

						<StatsOverview
							confirmedBookings={confirmedBookings}
							heldBookings={heldBookings}
							totalBookings={totalBookings}
							activeSeries={activeSeries}
						/>

						{actionResult ? (
							<OperationResult
								result={actionResult}
								onClose={() => setActionResult(null)}
							/>
						) : null}

						<Tabs
							value={activeTab}
							onChange={(value) =>
								setActiveTab((value as ReportsTab | null) ?? "bookings")
							}
							className={classes.reportsShell}
							classNames={{
								list: classes.tabsList,
								tab: classes.tab,
								panel: classes.tabPanel,
							}}
						>
							<Tabs.List aria-label="Áreas de operación y reportes">
								<Tabs.Tab
									value="bookings"
									leftSection={
										<CalendarDays className={classes.tabIcon} size={17} />
									}
								>
									Citas de la agenda
								</Tabs.Tab>
								<Tabs.Tab
									value="series"
									leftSection={
										<Repeat2 className={classes.tabIcon} size={17} />
									}
								>
									Reservas recurrentes
								</Tabs.Tab>
							</Tabs.List>

							<Tabs.Panel value="bookings">
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
							</Tabs.Panel>

							<Tabs.Panel value="series">
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
							</Tabs.Panel>
						</Tabs>
					</>
				) : null}
			</div>
		</div>
	);
}
