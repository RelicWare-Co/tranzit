import { CheckCircle2, FileText, User } from "lucide-react";
import { cx } from "#/shared/lib/cx";
import type { UseFormReturnType } from "@mantine/form";
import type { BookingKind } from "../types";

interface BookingTypeStepProps {
	form: UseFormReturnType<{
		bookingKind: BookingKind;
		procedureId: string;
		date: Date | null;
		slotId: string;
		staffUserId: string;
	}>;
	isCurrent: boolean;
	isCompleted: boolean;
	goToStep: (step: "type" | "procedure" | "datetime" | "staff") => void;
}

export function BookingTypeStep({
	form,
	isCurrent,
	isCompleted,
	goToStep,
}: BookingTypeStepProps) {
	const value = form.getValues().bookingKind;

	return (
		<div
			className={cx(
				"rounded-xl border p-4 transition-all duration-200",
				isCurrent
					? "border-zinc-300 bg-white shadow-sm"
					: "border-zinc-200 bg-zinc-50/50",
				isCompleted && !isCurrent && "border-emerald-200",
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
					{isCompleted ? <CheckCircle2 size={16} /> : "1"}
				</div>
				<div>
					<div className="font-medium text-sm text-zinc-900">
						Tipo de cita
					</div>
					<div className="text-xs text-zinc-500">
						Selecciona el tipo de agendamiento
					</div>
				</div>
			</div>

			{isCurrent && (
				<div className="grid grid-cols-2 gap-3 mt-3">
					<button
						type="button"
						onClick={() => {
							form.setFieldValue("bookingKind", "administrative");
							goToStep("procedure");
						}}
						className={cx(
							"flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
							value === "administrative"
								? "border-zinc-900 bg-zinc-50"
								: "border-zinc-200 hover:border-zinc-300",
						)}
					>
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
							<FileText size={20} className="text-zinc-600" />
						</div>
						<span className="font-medium text-sm">Administrativa</span>
						<span className="text-xs text-zinc-500">Reserva interna</span>
					</button>

					<button
						type="button"
						onClick={() => {
							form.setFieldValue("bookingKind", "citizen");
							goToStep("procedure");
						}}
						className={cx(
							"flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
							value === "citizen"
								? "border-zinc-900 bg-zinc-50"
								: "border-zinc-200 hover:border-zinc-300",
						)}
					>
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
							<User size={20} className="text-zinc-600" />
						</div>
						<span className="font-medium text-sm">Ciudadano</span>
						<span className="text-xs text-zinc-500">
							Atención al público
						</span>
					</button>
				</div>
			)}

			{!isCurrent && (
				<div className="mt-2 flex items-center gap-2">
					<span className="text-sm text-zinc-600">
						{value === "administrative" ? "Administrativa" : "Ciudadano"}
					</span>
					<button
						type="button"
						onClick={() => goToStep("type")}
						className="text-xs text-zinc-500 hover:text-zinc-700 underline"
					>
						Cambiar
					</button>
				</div>
			)}
		</div>
	);
}
