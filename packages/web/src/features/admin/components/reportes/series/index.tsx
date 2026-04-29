import { Card, Group, Stack, Text, Title } from "@mantine/core";
import { FileText } from "lucide-react";
import { useMemo } from "react";
import { adminUi } from "#/features/admin/components/admin-ui";
import type { ReservationInstance, ReservationSeriesFilters } from "../types";
import { CreateSeriesForm } from "./CreateSeriesForm";
import { InstanceActionsPanel } from "./InstanceActionsPanel";
import { InstanceTable } from "./InstanceTable";
import { SeriesActionsPanel } from "./SeriesActionsPanel";
import { SeriesFilters } from "./SeriesFilters";
import { SeriesTable } from "./SeriesTable";

interface SeriesSectionProps {
	seriesQuery: {
		data?: Array<{
			id: string;
			isActive: boolean;
			activeInstanceCount?: number | null;
			notes?: string | null;
		}>;
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
	selectedSeries: {
		id: string;
		notes?: string | null;
	} | null;
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
		<Card className={adminUi.surface} radius="lg" p="md" shadow="none">
			<Stack gap="lg">
				{/* Header */}
				<Group justify="space-between" wrap="nowrap">
					<Group gap="md" wrap="nowrap">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-100">
							<FileText size={20} className="text-red-700" strokeWidth={1.75} />
						</div>
						<Stack gap={0}>
							<Title
								order={4}
								className="text-base font-semibold text-[var(--text-primary)]"
							>
								Series de reserva administrativa
							</Title>
							<Text size="sm" className="text-[var(--text-secondary)]">
								Creá y gestioná reservas recurrentes con reglas de recurrencia
								guiadas.
							</Text>
						</Stack>
					</Group>
				</Group>

				{/* Create */}
				<CreateSeriesForm
					staffOptions={staffOptions}
					isRunning={isRunning}
					createSeries={createSeries}
				/>

				{/* Filters */}
				<SeriesFilters filters={seriesFilters} onChange={setSeriesFilters} />

				{/* Series Table */}
				<SeriesTable
					series={seriesQuery.data ?? []}
					selectedSeriesId={selectedSeriesId}
					onSelectSeries={setSelectedSeriesId}
					isLoading={seriesQuery.isLoading}
					isError={seriesQuery.isError}
					error={seriesQuery.error}
				/>

				{/* Series Actions */}
				<SeriesActionsPanel
					selectedSeries={selectedSeries}
					isRunning={isRunning}
					staffOptions={staffOptions}
					runAction={runAction}
					asNullableText={asNullableText}
				/>

				{/* Instances */}
				{selectedSeries && (
					<Card className={adminUi.callout} radius="lg" p="md" shadow="none">
						<Stack gap="lg">
							<Title
								order={5}
								className="text-sm font-semibold text-[var(--text-primary)]"
							>
								Instancias de la serie
							</Title>

							<InstanceTable
								instances={instances}
								selectedInstanceId={selectedInstanceId}
								onSelectInstance={setSelectedInstanceId}
								isLoading={seriesInstancesQuery.isLoading}
							/>

							<InstanceActionsPanel
								selectedInstance={selectedInstance}
								isRunning={isRunning}
								staffOptions={staffOptions}
								runAction={runAction}
								asNullableText={asNullableText}
							/>
						</Stack>
					</Card>
				)}
			</Stack>
		</Card>
	);
}
