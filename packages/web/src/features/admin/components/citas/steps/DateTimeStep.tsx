import { Select } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { CalendarDays, CheckCircle2, Clock } from "lucide-react";
import { cx } from "#/shared/lib/cx";
import { FormField } from "#/features/admin/components";
import type { UseFormReturnType } from "@mantine/form";
import type { BookingKind } from "../types";

interface DateTimeStepProps {
	form: UseFormReturnType<{
		bookingKind: BookingKind;
		procedureId: string;
		date: Date | null;
		slotId: string;
		staffUserId: string;
	}>;
	slotOptions: { value: string; label: string }[];
	isCurrent: boolean;
	isCompleted: boolean;
	isPreviousCompleted: boolean;
	goToStep: (step: "type" | "procedure" | "datetime" | "staff") => void;
}

export function DateTimeStep({
	form,
	slotOptions,
	isCurrent,
	isCompleted,
	isPreviousCompleted,
	goToStep,
}: DateTimeStepProps) {
	const values = form.getValues();

	return (
		<button
			type="button"
			disabled={!isPreviousCompleted}
			onClick={() => goToStep("datetime")}
			className={cx(
				"w-full text-left rounded-xl border p-4 transition-all duration-200",
				isCurrent
					? "border-zinc-300 bg-white shadow-sm"
					: "border-zinc-200 bg-zinc-50/50 hover:border-zinc-300",
				isCompleted && !isCurrent && "border-emerald-200",
				!isPreviousCompleted && "opacity-50 cursor-not-allowed",
			)}
		>
			<div className="flex items-center gap-3 mb-3">
				<div
					className={cx(
						"flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors",
						isCompleted
							? "bg-emerald-100 text-emerald-700"
							: "bg-zinc-100 text-zinc-600",
					)}
				>
					{isCompleted ? <CheckCircle2 size={16} /> : "3"}
				</div>
				<div>
					<div className="font-medium text-sm text-zinc-900">
						Fecha y hora
					</div>
					<div className="text-xs text-zinc-500">
						Selecciona el día y horario disponible
					</div>
				</div>
			</div>

			{isCurrent && isPreviousCompleted && (
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
					<FormField
						label="Fecha"
						helper="Selecciona una fecha disponible"
						required
					>
						<DatePickerInput
							placeholder="Seleccionar fecha"
							key={form.key("date")}
							{...form.getInputProps("date")}
							minDate={new Date()}
							radius="lg"
							size="md"
							leftSection={
								<CalendarDays size={16} className="text-zinc-400" />
							}
							className={cx(
								"transition-all duration-200",
								values.date && "border-emerald-500/50",
							)}
						/>
					</FormField>

					<FormField
						label="Horario"
						helper={
							!values.date
								? "Primero selecciona una fecha"
								: slotOptions.length === 0
									? "No hay horarios disponibles para esta fecha"
									: "Selecciona un horario"
						}
						required
					>
						<Select
							placeholder={
								!values.date
									? "Selecciona fecha primero"
									: "Seleccionar horario"
							}
							key={form.key("slotId")}
							{...form.getInputProps("slotId")}
							data={slotOptions}
							disabled={!values.date || slotOptions.length === 0}
							nothingFoundMessage="No hay horarios disponibles"
							radius="lg"
							size="md"
							leftSection={
								<Clock size={16} className="text-zinc-400" />
							}
							className={cx(
								"transition-all duration-200",
								values.slotId && "border-emerald-500/50",
							)}
							onChange={(val) => {
								form.setFieldValue("slotId", val ?? "");
								if (val) goToStep("staff");
							}}
						/>
					</FormField>
				</div>
			)}

			{!isCurrent && isCompleted && (
				<div className="mt-2 flex items-center gap-2">
					<span className="text-sm text-zinc-600">
						{values.date?.toLocaleDateString("es-CO", {
							weekday: "long",
							year: "numeric",
							month: "long",
							day: "numeric",
						})}
						{" - "}
						{slotOptions.find((s) => s.value === values.slotId)?.label}
					</span>
					<button
						type="button"
						onClick={() => goToStep("datetime")}
						className="text-xs text-zinc-500 hover:text-zinc-700 underline"
					>
						Cambiar
					</button>
				</div>
			)}
		</button>
	);
}
