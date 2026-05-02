import { Card, SimpleGrid, Stack, Title } from "@mantine/core";
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
		<Stack gap="lg">
			{/* Create Form - Collapsible */}
			<CreateSeriesForm
				staffOptions={staffOptions}
				isRunning={isRunning}
				createSeries={createSeries}
			/>

			{/* Filters */}
			<SeriesFilters filters={seriesFilters} onChange={setSeriesFilters} />

			{/* Two Column Layout */}
			<SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
				{/* Left: Series List */}
				<Card className={adminUi.surface} radius="lg" p="md">
					<Stack gap="md">
						<SeriesTable
							series={seriesQuery.data ?? []}
							selectedSeriesId={selectedSeriesId}
							onSelectSeries={setSelectedSeriesId}
							isLoading={seriesQuery.isLoading}
							isError={seriesQuery.isError}
							error={seriesQuery.error}
						/>
					</Stack>
				</Card>

				{/* Right: Actions + Instances */}
				<Stack gap="lg">
					<SeriesActionsPanel
						selectedSeries={selectedSeries}
						isRunning={isRunning}
						staffOptions={staffOptions}
						runAction={runAction}
						asNullableText={asNullableText}
					/>

					{selectedSeries && (
						<Card className={adminUi.surface} radius="lg" p="md">
							<Stack gap="md">
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
			</SimpleGrid>
		</Stack>
	);
}
