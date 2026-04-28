import { Group, Select } from "@mantine/core";
import type { ReservationSeriesFilters } from "../types";

interface SeriesFiltersProps {
	filters: ReservationSeriesFilters;
	onChange: (filters: ReservationSeriesFilters) => void;
}

export function SeriesFilters({ filters, onChange }: SeriesFiltersProps) {
	return (
		<Group gap="sm">
			<Select
				label="Filtrar series"
				size="sm"
				value={filters.isActive}
				onChange={(value) =>
					onChange({
						isActive:
							(value as ReservationSeriesFilters["isActive"]) ?? "all",
					})
				}
				data={[
					{ value: "all", label: "Todas" },
					{ value: "true", label: "Activas" },
					{ value: "false", label: "Inactivas" },
				]}
			/>
		</Group>
	);
}
