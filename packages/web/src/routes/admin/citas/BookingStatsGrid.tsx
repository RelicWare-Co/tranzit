import { Stack, Text } from "@mantine/core";
import { adminUi } from "../_shared/admin-ui";

type Stats = {
	citasHoy: number;
	confirmadas: number;
	pendientes: number;
	canceladas: number;
};

function Cell({
	label,
	value,
	valueClass,
	className,
}: {
	label: string;
	value: number;
	valueClass: string;
	className?: string;
}) {
	return (
		<Stack
			gap={4}
			className={`min-w-0 items-center text-center sm:items-start sm:text-left ${className ?? ""}`}
		>
			<Text className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
				{label}
			</Text>
			<Text
				className={`${adminUi.monoStat} text-2xl font-semibold leading-none sm:text-[1.5rem] ${valueClass}`}
			>
				{value}
			</Text>
		</Stack>
	);
}

/** Franja de KPI: cuatro columnas iguales en escritorio; en móvil 2×2 equilibrado. */
export function BookingStatsGrid({ stats }: { stats: Stats }) {
	return (
		<div className="grid w-full min-w-0 grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 sm:gap-x-0 sm:gap-y-0 sm:divide-x sm:divide-zinc-200/75">
			<Cell
				label="Hoy"
				value={stats.citasHoy}
				valueClass="text-zinc-900"
				className="px-0.5 sm:px-2.5 sm:py-0.5"
			/>
			<Cell
				label="Confirmadas"
				value={stats.confirmadas}
				valueClass="text-emerald-700"
				className="px-0.5 sm:px-2.5 sm:py-0.5"
			/>
			<Cell
				label="Pendientes"
				value={stats.pendientes}
				valueClass="text-amber-700"
				className="px-0.5 sm:px-2.5 sm:py-0.5"
			/>
			<Cell
				label="Canceladas"
				value={stats.canceladas}
				valueClass="text-red-700"
				className="px-0.5 sm:px-2.5 sm:py-0.5"
			/>
		</div>
	);
}
