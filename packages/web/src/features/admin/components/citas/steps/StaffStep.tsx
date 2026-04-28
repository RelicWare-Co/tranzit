import { Select } from "@mantine/core";
import { CheckCircle2, MapPin } from "lucide-react";
import { cx } from "#/shared/lib/cx";
import { FormField } from "#/features/admin/components";
import type { UseFormReturnType } from "@mantine/form";
import type { BookingKind } from "../types";

interface StaffStepProps {
	form: UseFormReturnType<{
		bookingKind: BookingKind;
		procedureId: string;
		date: Date | null;
		slotId: string;
		staffUserId: string;
	}>;
	staffOptions: { value: string; label: string }[];
	isCurrent: boolean;
	isCompleted: boolean;
	isPreviousCompleted: boolean;
	goToStep: (step: "type" | "procedure" | "datetime" | "staff") => void;
}

export function StaffStep({
	form,
	staffOptions,
	isCurrent,
	isCompleted,
	isPreviousCompleted,
	goToStep,
}: StaffStepProps) {
	const value = form.getValues().staffUserId;

	return (
		<button
			type="button"
			disabled={!isPreviousCompleted}
			onClick={() => goToStep("staff")}
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
					{isCompleted ? <CheckCircle2 size={16} /> : "4"}
				</div>
				<div>
					<div className="font-medium text-sm text-zinc-900">
						Funcionario
					</div>
					<div className="text-xs text-zinc-500">
						Asigna un encargado para la cita
					</div>
				</div>
			</div>

			{isCurrent && isPreviousCompleted && (
				<FormField
					label="Encargado"
					helper="Selecciona el funcionario que atenderá la cita"
					required
				>
					<Select
						placeholder="Buscar funcionario..."
						key={form.key("staffUserId")}
						{...form.getInputProps("staffUserId")}
						data={staffOptions}
						searchable
						nothingFoundMessage="No se encontraron funcionarios"
						radius="lg"
						size="md"
						leftSection={
							<MapPin size={16} className="text-zinc-400" />
						}
						className={cx(
							"transition-all duration-200",
							value && "border-emerald-500/50",
						)}
					/>
				</FormField>
			)}

			{!isCurrent && isCompleted && (
				<div className="mt-2 flex items-center gap-2">
					<span className="text-sm text-zinc-600">
						{
							staffOptions.find((s) => s.value === value)?.label
						}
					</span>
					<button
						type="button"
						onClick={() => goToStep("staff")}
						className="text-xs text-zinc-500 hover:text-zinc-700 underline"
					>
						Cambiar
					</button>
				</div>
			)}
		</button>
	);
}
