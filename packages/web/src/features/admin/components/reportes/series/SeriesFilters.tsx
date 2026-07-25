import { Select } from "@mantine/core";
import classes from "../Reportes.module.css";
import type { ReservationSeriesFilters } from "../types";

interface SeriesFiltersProps {
	filters: ReservationSeriesFilters;
	onChange: (filters: ReservationSeriesFilters) => void;
}

export function SeriesFilters({ filters, onChange }: SeriesFiltersProps) {
	return (
		<div className={classes.seriesFilterBar}>
			<div className={classes.filterCopy}>
				<p className={classes.filterTitle}>Estado de las series</p>
				<p className={classes.filterDescription}>
					Las series inactivas se conservan como historial operativo.
				</p>
			</div>
			<Select
				label="Mostrar"
				value={filters.isActive}
				onChange={(value) =>
					onChange({
						isActive: (value as ReservationSeriesFilters["isActive"]) ?? "all",
					})
				}
				data={[
					{ value: "all", label: "Todas las series" },
					{ value: "true", label: "Solo activas" },
					{ value: "false", label: "Solo inactivas" },
				]}
			/>
		</div>
	);
}
