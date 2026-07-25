import { Checkbox, NumberInput, Select } from "@mantine/core";
import { useMemo } from "react";
import classes from "../Reportes.module.css";

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY";

export interface RRuleValue {
	freq: Frequency;
	interval: number;
	byDay: string[];
	byMonthDay: number | null;
}

interface RRuleBuilderProps {
	value: RRuleValue;
	onChange: (value: RRuleValue) => void;
}

const DAYS = [
	{ value: "MO", label: "Lun" },
	{ value: "TU", label: "Mar" },
	{ value: "WE", label: "Mié" },
	{ value: "TH", label: "Jue" },
	{ value: "FR", label: "Vie" },
	{ value: "SA", label: "Sáb" },
	{ value: "SU", label: "Dom" },
];

const DAY_NAMES = Object.fromEntries(
	DAYS.map((day) => [day.value, day.label.toLowerCase()]),
);

function buildRRuleString(value: RRuleValue): string {
	const parts: string[] = [`FREQ=${value.freq}`];
	if (value.interval > 1) parts.push(`INTERVAL=${value.interval}`);
	if (value.freq === "WEEKLY" && value.byDay.length > 0) {
		parts.push(`BYDAY=${value.byDay.join(",")}`);
	}
	if (value.freq === "MONTHLY" && value.byMonthDay) {
		parts.push(`BYMONTHDAY=${value.byMonthDay}`);
	}
	return parts.join(";");
}

export function useRRuleString(value: RRuleValue): string {
	return useMemo(() => buildRRuleString(value), [value]);
}

export function RRuleBuilder({ value, onChange }: RRuleBuilderProps) {
	const humanPreview = useMemo(() => {
		if (value.freq === "DAILY") {
			return value.interval === 1
				? "La reserva se repetirá todos los días."
				: `La reserva se repetirá cada ${value.interval} días.`;
		}
		if (value.freq === "MONTHLY") {
			const day = value.byMonthDay ?? 1;
			return value.interval === 1
				? `La reserva se repetirá el día ${day} de cada mes.`
				: `La reserva se repetirá el día ${day}, cada ${value.interval} meses.`;
		}

		const dayNames = value.byDay
			.map((day) => DAY_NAMES[day])
			.filter(Boolean)
			.join(", ");
		const frequency =
			value.interval === 1 ? "cada semana" : `cada ${value.interval} semanas`;
		return `La reserva se repetirá ${frequency} los días: ${
			dayNames || "sin días seleccionados"
		}.`;
	}, [value]);

	const toggleDay = (day: string) => {
		const hasDay = value.byDay.includes(day);
		onChange({
			...value,
			byDay: hasDay
				? value.byDay.filter((candidate) => candidate !== day)
				: [...value.byDay, day],
		});
	};

	return (
		<div className={classes.actionSection}>
			<div className={classes.formGrid}>
				<Select
					label="Frecuencia"
					value={value.freq}
					data={[
						{ value: "DAILY", label: "Todos los días" },
						{ value: "WEEKLY", label: "Cada semana" },
						{ value: "MONTHLY", label: "Cada mes" },
					]}
					onChange={(nextValue) => {
						const freq = (nextValue as Frequency) ?? "WEEKLY";
						onChange({
							...value,
							freq,
							byDay:
								freq === "WEEKLY" && value.byDay.length === 0
									? ["MO"]
									: freq !== "WEEKLY"
										? []
										: value.byDay,
						});
					}}
				/>
				<NumberInput
					label="Intervalo"
					description="Cada cuántos días, semanas o meses se repite."
					min={1}
					max={52}
					value={value.interval}
					onChange={(nextValue) =>
						onChange({
							...value,
							interval: typeof nextValue === "number" ? nextValue : 1,
						})
					}
					suffix={
						value.freq === "DAILY"
							? " días"
							: value.freq === "WEEKLY"
								? " semanas"
								: " meses"
					}
				/>
			</div>

			{value.freq === "WEEKLY" ? (
				<fieldset>
					<legend className={classes.actionSectionTitle}>
						Días de atención
					</legend>
					<div className={classes.rruleDays}>
						{DAYS.map((day) => (
							<Checkbox
								key={day.value}
								label={day.label}
								checked={value.byDay.includes(day.value)}
								onChange={() => toggleDay(day.value)}
							/>
						))}
					</div>
				</fieldset>
			) : null}

			{value.freq === "MONTHLY" ? (
				<NumberInput
					label="Día del mes"
					min={1}
					max={31}
					value={value.byMonthDay ?? 1}
					onChange={(nextValue) =>
						onChange({
							...value,
							byMonthDay: typeof nextValue === "number" ? nextValue : 1,
						})
					}
				/>
			) : null}

			<div className={classes.rrulePreview}>{humanPreview}</div>
		</div>
	);
}
