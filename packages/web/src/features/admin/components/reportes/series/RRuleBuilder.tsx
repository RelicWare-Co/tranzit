import {
	Checkbox,
	Group,
	NumberInput,
	Select,
	Stack,
	Text,
} from "@mantine/core";
import { useMemo } from "react";

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY";

export interface RRuleValue {
	freq: Frequency;
	interval: number;
	byDay: string[]; // MO, TU, WE, TH, FR, SA, SU
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

function buildRRuleString(value: RRuleValue): string {
	const parts: string[] = [`FREQ=${value.freq}`];
	if (value.interval > 1) {
		parts.push(`INTERVAL=${value.interval}`);
	}
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
	const preview = useRRuleString(value);

	const toggleDay = (day: string) => {
		const has = value.byDay.includes(day);
		onChange({
			...value,
			byDay: has ? value.byDay.filter((d) => d !== day) : [...value.byDay, day],
		});
	};

	return (
		<Stack gap="md">
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<Select
					label="Repetir"
					size="sm"
					value={value.freq}
					data={[
						{ value: "DAILY", label: "Diariamente" },
						{ value: "WEEKLY", label: "Semanalmente" },
						{ value: "MONTHLY", label: "Mensualmente" },
					]}
					onChange={(val) => {
						const freq = (val as Frequency) ?? "WEEKLY";
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
					label="Cada"
					size="sm"
					min={1}
					max={52}
					value={value.interval}
					onChange={(val) =>
						onChange({
							...value,
							interval: typeof val === "number" ? val : 1,
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

			{value.freq === "WEEKLY" && (
				<Stack gap="xs">
					<Text size="sm" fw={500} className="text-[var(--text-primary)]">
						Días de la semana
					</Text>
					<Group gap="xs">
						{DAYS.map((day) => (
							<Checkbox
								key={day.value}
								label={day.label}
								size="sm"
								checked={value.byDay.includes(day.value)}
								onChange={() => toggleDay(day.value)}
							/>
						))}
					</Group>
				</Stack>
			)}

			{value.freq === "MONTHLY" && (
				<NumberInput
					label="Día del mes"
					size="sm"
					min={1}
					max={31}
					value={value.byMonthDay ?? 1}
					onChange={(val) =>
						onChange({
							...value,
							byMonthDay: typeof val === "number" ? val : 1,
						})
					}
				/>
			)}

			<div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2">
				<Text size="xs" className="font-mono text-[var(--text-secondary)]">
					{preview}
				</Text>
			</div>
		</Stack>
	);
}
