import { CalendarDays, CheckCircle2, Clock3, Repeat2 } from "lucide-react";
import type { ReactNode } from "react";
import classes from "./Reportes.module.css";

interface StatsOverviewProps {
	confirmedBookings: number;
	heldBookings: number;
	totalBookings: number;
	activeSeries: number;
}

function Metric({
	icon,
	label,
	value,
	tone,
}: {
	icon: ReactNode;
	label: string;
	value: number;
	tone?: "success" | "warning";
}) {
	return (
		<div className={classes.metric} data-tone={tone}>
			<span className={classes.metricIcon}>{icon}</span>
			<span className={classes.metricLabel}>{label}</span>
			<span className={classes.metricValue}>{value}</span>
		</div>
	);
}

export function StatsOverview({
	confirmedBookings,
	heldBookings,
	totalBookings,
	activeSeries,
}: StatsOverviewProps) {
	return (
		<section className={classes.overview} aria-label="Resumen de la agenda">
			<Metric
				icon={<CalendarDays size={18} aria-hidden="true" />}
				label="Citas en la consulta"
				value={totalBookings}
			/>
			<Metric
				icon={<CheckCircle2 size={18} aria-hidden="true" />}
				label="Confirmadas"
				value={confirmedBookings}
				tone="success"
			/>
			<Metric
				icon={<Clock3 size={18} aria-hidden="true" />}
				label="Holds vigentes"
				value={heldBookings}
				tone="warning"
			/>
			<Metric
				icon={<Repeat2 size={18} aria-hidden="true" />}
				label="Series activas"
				value={activeSeries}
			/>
		</section>
	);
}
