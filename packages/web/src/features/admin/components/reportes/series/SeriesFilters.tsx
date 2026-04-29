import { Select } from "@mantine/core";
import { Filter } from "lucide-react";
import type { ReservationSeriesFilters } from "../types";

interface SeriesFiltersProps {
	filters: ReservationSeriesFilters;
	onChange: (filters: ReservationSeriesFilters) => void;
}

export function SeriesFilters({ filters, onChange }: SeriesFiltersProps) {
	return (
		<div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3">
			<div className="flex items-center gap-2 text-[var(--text-secondary)]">
				<Filter size={14} strokeWidth={1.75} />
				<span className="text-xs font-semibold uppercase tracking-wider">
					Series
				</span>
			</div>
			<Select
				size="sm"
				value={filters.isActive}
				onChange={(value) =>
					onChange({
						isActive: (value as ReservationSeriesFilters["isActive"]) ?? "all",
					})
				}
				data={[
					{ value: "all", label: "Todas" },
					{ value: "true", label: "Activas" },
					{ value: "false", label: "Inactivas" },
				]}
			/>
		</div>
	);
}
