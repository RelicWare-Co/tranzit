import { Select } from "@mantine/core";
import { CheckCircle2, FileText } from "lucide-react";
import { cx } from "#/shared/lib/cx";
import { FormField } from "#/features/admin/components";
import type { UseFormReturnType } from "@mantine/form";
import type { BookingKind } from "../types";

interface ProcedureStepProps {
	form: UseFormReturnType<{
		bookingKind: BookingKind;
		procedureId: string;
		date: Date | null;
		slotId: string;
		staffUserId: string;
	}>;
	procedureOptions: { value: string; label: string }[];
	isCurrent: boolean;
	isCompleted: boolean;
	isPreviousCompleted: boolean;
	goToStep: (step: "type" | "procedure" | "datetime" | "staff") => void;
}

export function ProcedureStep({
	form,
	procedureOptions,
	isCurrent,
	isCompleted,
	isPreviousCompleted,
	goToStep,
}: ProcedureStepProps) {
	const value = form.getValues().procedureId;

	return (
		<button
			type="button"
			disabled={!isPreviousCompleted}
			onClick={() => goToStep("procedure")}
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
					{isCompleted ? <CheckCircle2 size={16} /> : "2"}
				</div>
				<div>
					<div className="font-medium text-sm text-zinc-900">Trámite</div>
					<div className="text-xs text-zinc-500">
						Selecciona el tipo de trámite
					</div>
				</div>
			</div>

			{isCurrent && isPreviousCompleted && (
				<FormField
					label="Tipo de trámite"
					helper="Selecciona el trámite que se va a realizar"
					required
				>
					<Select
						placeholder="Buscar trámite..."
						key={form.key("procedureId")}
						{...form.getInputProps("procedureId")}
						data={procedureOptions}
						searchable
						nothingFoundMessage="No se encontraron trámites"
						radius="lg"
						size="md"
						leftSection={
							<FileText size={16} className="text-zinc-400" />
						}
						className={cx(
							"transition-all duration-200",
							value && "border-emerald-500/50",
						)}
						onChange={(val) => {
							form.setFieldValue("procedureId", val ?? "");
							if (val) goToStep("datetime");
						}}
					/>
				</FormField>
			)}

			{!isCurrent && isCompleted && (
				<div className="mt-2 flex items-center gap-2">
					<span className="text-sm text-zinc-600">
						{
							procedureOptions.find((p) => p.value === value)?.label ||
							"Trámite seleccionado"
						}
					</span>
					<button
						type="button"
						onClick={() => goToStep("procedure")}
						className="text-xs text-zinc-500 hover:text-zinc-700 underline"
					>
						Cambiar
					</button>
				</div>
			)}
		</button>
	);
}
