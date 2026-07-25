import { EmptyState, Tabs } from "@mantine/core";
import { ListTree, Repeat2, Settings2 } from "lucide-react";
import { useMemo } from "react";
import classes from "../Reportes.module.css";
import { ReportSectionHeader } from "../ReportSectionHeader";
import type { ReservationInstance, ReservationSeriesFilters } from "../types";
import { CreateSeriesForm } from "./CreateSeriesForm";
import { InstanceActionsPanel } from "./InstanceActionsPanel";
import { InstanceTable } from "./InstanceTable";
import { SeriesActionsPanel } from "./SeriesActionsPanel";
import { SeriesFilters } from "./SeriesFilters";
import { SeriesTable } from "./SeriesTable";

interface SeriesItem {
	id: string;
	isActive: boolean;
	activeInstanceCount?: number | null;
	notes?: string | null;
}

interface SeriesSectionProps {
	seriesQuery: {
		data?: SeriesItem[];
		isLoading: boolean;
		isError: boolean;
		error: unknown;
	};
	selectedSeriesId: string | null;
	setSelectedSeriesId: (id: string | null) => void;
	selectedInstanceId: string | null;
	setSelectedInstanceId: (id: string | null) => void;
	instances: ReservationInstance[];
	seriesInstancesQuery: {
		isLoading: boolean;
	};
	staffOptions: Array<{ value: string; label: string }>;
	isRunning: string | null;
	runAction: (
		actionId: string,
		action: () => Promise<unknown>,
		successMessage: string,
		errorFallback: string,
	) => Promise<unknown>;
	createSeries: (values: {
		recurrenceRule: string;
		slotId: string;
		staffUserId: string;
		startDate: string;
		endDate: string;
		notes: string | null;
	}) => Promise<unknown>;
	seriesFilters: ReservationSeriesFilters;
	setSeriesFilters: (filters: ReservationSeriesFilters) => void;
	selectedSeries: SeriesItem | null;
	asNullableText: (value: string) => string | null;
}

export function SeriesSection({
	seriesQuery,
	selectedSeriesId,
	setSelectedSeriesId,
	selectedInstanceId,
	setSelectedInstanceId,
	instances,
	seriesInstancesQuery,
	staffOptions,
	isRunning,
	runAction,
	createSeries,
	seriesFilters,
	setSeriesFilters,
	selectedSeries,
	asNullableText,
}: SeriesSectionProps) {
	const selectedInstance = useMemo(
		() =>
			instances.find((instance) => instance.id === selectedInstanceId) ?? null,
		[instances, selectedInstanceId],
	);

	return (
		<div className={classes.sectionStack}>
			<ReportSectionHeader
				title="Reservas recurrentes"
				description="Administra bloqueos administrativos que se repiten y revisa cada instancia generada por una serie."
				count={seriesQuery.data?.length ?? 0}
				countLabel="series"
				actions={
					<CreateSeriesForm
						staffOptions={staffOptions}
						isRunning={isRunning}
						createSeries={createSeries}
					/>
				}
			/>

			<SeriesFilters filters={seriesFilters} onChange={setSeriesFilters} />

			<div className={classes.masterDetail}>
				<section className={classes.masterPane} aria-label="Listado de series">
					<header className={classes.paneHeader}>
						<div>
							<h3 className={classes.paneTitle}>Series configuradas</h3>
							<p className={classes.paneDescription}>
								Selecciona una para revisar sus instancias.
							</p>
						</div>
					</header>
					<SeriesTable
						series={seriesQuery.data ?? []}
						selectedSeriesId={selectedSeriesId}
						onSelectSeries={setSelectedSeriesId}
						isLoading={seriesQuery.isLoading}
						isError={seriesQuery.isError}
						error={seriesQuery.error}
					/>
				</section>

				<section
					className={classes.detailPane}
					aria-label="Detalle de la serie"
				>
					{selectedSeries ? (
						<>
							<header className={classes.actionHeader}>
								<div>
									<p className={classes.actionEyebrow}>Serie seleccionada</p>
									<h3 className={classes.actionTitle}>
										Serie {selectedSeries.id.slice(0, 8)}
									</h3>
									<p className={classes.actionReference}>
										{selectedSeries.activeInstanceCount ?? 0} instancias activas
									</p>
								</div>
							</header>

							<Tabs
								defaultValue="instances"
								classNames={{
									list: classes.detailTabsList,
									tab: classes.detailTab,
								}}
							>
								<Tabs.List aria-label="Detalle y configuración de la serie">
									<Tabs.Tab
										value="instances"
										leftSection={<ListTree size={16} />}
									>
										Instancias
									</Tabs.Tab>
									<Tabs.Tab
										value="settings"
										leftSection={<Settings2 size={16} />}
									>
										Gestionar serie
									</Tabs.Tab>
								</Tabs.List>

								<Tabs.Panel value="instances">
									<div className={classes.sectionStack}>
										<InstanceTable
											instances={instances}
											selectedInstanceId={selectedInstanceId}
											onSelectInstance={setSelectedInstanceId}
											isLoading={seriesInstancesQuery.isLoading}
										/>
										<InstanceActionsPanel
											key={selectedInstance?.id ?? "no-instance"}
											selectedInstance={selectedInstance}
											isRunning={isRunning}
											staffOptions={staffOptions}
											runAction={runAction}
											asNullableText={asNullableText}
										/>
									</div>
								</Tabs.Panel>

								<Tabs.Panel value="settings">
									<SeriesActionsPanel
										key={selectedSeries.id}
										selectedSeries={selectedSeries}
										isRunning={isRunning}
										staffOptions={staffOptions}
										runAction={runAction}
										asNullableText={asNullableText}
									/>
								</Tabs.Panel>
							</Tabs>
						</>
					) : (
						<div className={classes.emptySelection}>
							<EmptyState
								icon={<Repeat2 size={30} />}
								title="Selecciona una serie"
								description="Aquí podrás revisar sus instancias y administrar cambios futuros."
								size="sm"
								withIndicatorBackground
							/>
						</div>
					)}
				</section>
			</div>
		</div>
	);
}
