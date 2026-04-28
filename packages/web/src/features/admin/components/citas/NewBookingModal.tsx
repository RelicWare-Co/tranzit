import { Alert, Box, LoadingOverlay, Select, Stack } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import {
	AlertCircle,
	CalendarDays,
	CheckCircle2,
	Clock,
	FileText,
	MapPin,
	User,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
	FormActionButton,
	FormActions,
	FormField,
	PremiumModal,
} from "#/features/admin/components";
import { cx } from "#/shared/lib/cx";
import type { BookingKind } from "./types";

interface NewBookingModalProps {
	opened: boolean;
	onClose: () => void;
	loading: boolean;
	error: string | null;
	success: boolean;
	bookingKind: BookingKind;
	onBookingKindChange: (value: BookingKind) => void;
	selectedProcedure: string | null;
	onProcedureChange: (value: string | null) => void;
	procedureOptions: { value: string; label: string }[];
	selectedDate: Date | null;
	onDateChange: (value: Date | null) => void;
	selectedSlot: string | null;
	onSlotChange: (value: string | null) => void;
	slotOptions: { value: string; label: string }[];
	selectedStaff: string | null;
	onStaffChange: (value: string | null) => void;
	staffOptions: { value: string; label: string }[];
	onSubmit: () => void;
}

export function NewBookingModal({
	opened,
	onClose,
	loading,
	error,
	success,
	bookingKind,
	onBookingKindChange,
	selectedProcedure,
	onProcedureChange,
	procedureOptions,
	selectedDate,
	onDateChange,
	selectedSlot,
	onSlotChange,
	slotOptions,
	selectedStaff,
	onStaffChange,
	staffOptions,
	onSubmit,
}: NewBookingModalProps) {
	const [activeStep, setActiveStep] = useState<
		"type" | "procedure" | "datetime" | "staff"
	>("type");

	// Calcular pasos completados
	const steps = useMemo(() => {
		return {
			type: { completed: true, current: activeStep === "type" },
			procedure: {
				completed: !!selectedProcedure,
				current: activeStep === "procedure",
			},
			datetime: {
				completed: !!selectedDate && !!selectedSlot,
				current: activeStep === "datetime",
			},
			staff: { completed: !!selectedStaff, current: activeStep === "staff" },
		};
	}, [
		activeStep,
		selectedProcedure,
		selectedDate,
		selectedSlot,
		selectedStaff,
	]);

	// Determinar paso actual basado en selecciones
	const goToStep = (step: "type" | "procedure" | "datetime" | "staff") => {
		setActiveStep(step);
	};

	// Progreso del formulario
	const progress = useMemo(() => {
		let completed = 1; // type siempre está seleccionado
		if (selectedProcedure) completed++;
		if (selectedDate && selectedSlot) completed++;
		if (selectedStaff) completed++;
		return (completed / 4) * 100;
	}, [selectedProcedure, selectedDate, selectedSlot, selectedStaff]);

	const canSubmit =
		selectedProcedure &&
		selectedDate &&
		selectedSlot &&
		selectedStaff &&
		!loading;

	return (
		<PremiumModal
			opened={opened}
			onClose={onClose}
			title="Nueva cita"
			subtitle="Completa los pasos para programar una nueva cita"
			size="lg"
		>
			<Box pos="relative">
				<LoadingOverlay
					visible={loading}
					overlayProps={{ blur: 2, backgroundOpacity: 0.5 }}
					loaderProps={{ type: "dots", size: "md", color: "dark" }}
				/>

				{/* Barra de progreso */}
				<div className="mb-6">
					<div className="flex justify-between text-xs font-medium text-zinc-500 mb-2">
						<span>Progreso</span>
						<span>{Math.round(progress)}%</span>
					</div>
					<div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
						<div
							className="h-full bg-zinc-900 transition-all duration-500 ease-out rounded-full"
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>

				<Stack gap="lg">
					{error && (
						<Alert
							color="red"
							variant="light"
							radius="lg"
							icon={<AlertCircle size={18} />}
							className="border border-red-200/50"
						>
							{error}
						</Alert>
					)}

					{success && (
						<Alert
							color="teal"
							variant="light"
							radius="lg"
							icon={<CheckCircle2 size={18} />}
							className="border border-teal-200/50"
						>
							Cita creada correctamente
						</Alert>
					)}

					{/* Paso 1: Tipo de cita */}
					<div
						className={cx(
							"rounded-xl border p-4 transition-all duration-200",
							steps.type.current
								? "border-zinc-300 bg-white shadow-sm"
								: "border-zinc-200 bg-zinc-50/50",
							steps.type.completed &&
								!steps.type.current &&
								"border-emerald-200",
						)}
					>
						<div className="flex items-center gap-3 mb-3">
							<div
								className={cx(
									"flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors",
									steps.type.completed
										? "bg-emerald-100 text-emerald-700"
										: "bg-zinc-100 text-zinc-600",
								)}
							>
								{steps.type.completed ? <CheckCircle2 size={16} /> : "1"}
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

						{steps.type.current && (
							<div className="grid grid-cols-2 gap-3 mt-3">
								<button
									type="button"
									onClick={() => onBookingKindChange("administrative")}
									className={cx(
										"flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
										bookingKind === "administrative"
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
									onClick={() => onBookingKindChange("citizen")}
									className={cx(
										"flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
										bookingKind === "citizen"
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

						{!steps.type.current && (
							<div className="mt-2 flex items-center gap-2">
								<span className="text-sm text-zinc-600">
									{bookingKind === "administrative"
										? "Administrativa"
										: "Ciudadano"}
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

					{/* Paso 2: Trámite */}
					<button
						type="button"
						disabled={!steps.type.completed}
						onClick={() => goToStep("procedure")}
						className={cx(
							"w-full text-left rounded-xl border p-4 transition-all duration-200",
							steps.procedure.current
								? "border-zinc-300 bg-white shadow-sm"
								: "border-zinc-200 bg-zinc-50/50 hover:border-zinc-300",
							steps.procedure.completed &&
								!steps.procedure.current &&
								"border-emerald-200",
							!steps.type.completed && "opacity-50 cursor-not-allowed",
						)}
					>
						<div className="flex items-center gap-3 mb-3">
							<div
								className={cx(
									"flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors",
									steps.procedure.completed
										? "bg-emerald-100 text-emerald-700"
										: "bg-zinc-100 text-zinc-600",
								)}
							>
								{steps.procedure.completed ? <CheckCircle2 size={16} /> : "2"}
							</div>
							<div>
								<div className="font-medium text-sm text-zinc-900">Trámite</div>
								<div className="text-xs text-zinc-500">
									Selecciona el tipo de trámite
								</div>
							</div>
						</div>

						{steps.procedure.current && steps.type.completed && (
							<FormField
								label="Tipo de trámite"
								helper="Selecciona el trámite que se va a realizar"
								required
							>
								<Select
									placeholder="Buscar trámite..."
									value={selectedProcedure}
									onChange={(val) => {
										onProcedureChange(val);
										if (val) goToStep("datetime");
									}}
									data={procedureOptions}
									searchable
									nothingFoundMessage="No se encontraron trámites"
									radius="lg"
									size="md"
									leftSection={<FileText size={16} className="text-zinc-400" />}
									className={cx(
										"transition-all duration-200",
										selectedProcedure && "border-emerald-500/50",
									)}
								/>
							</FormField>
						)}

						{!steps.procedure.current && steps.procedure.completed && (
							<div className="mt-2 flex items-center gap-2">
								<span className="text-sm text-zinc-600">
									{procedureOptions.find((p) => p.value === selectedProcedure)
										?.label || "Trámite seleccionado"}
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

					{/* Paso 3: Fecha y hora */}
					<button
						type="button"
						disabled={!steps.procedure.completed}
						onClick={() => goToStep("datetime")}
						className={cx(
							"w-full text-left rounded-xl border p-4 transition-all duration-200",
							steps.datetime.current
								? "border-zinc-300 bg-white shadow-sm"
								: "border-zinc-200 bg-zinc-50/50 hover:border-zinc-300",
							steps.datetime.completed &&
								!steps.datetime.current &&
								"border-emerald-200",
							!steps.procedure.completed && "opacity-50 cursor-not-allowed",
						)}
					>
						<div className="flex items-center gap-3 mb-3">
							<div
								className={cx(
									"flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors",
									steps.datetime.completed
										? "bg-emerald-100 text-emerald-700"
										: "bg-zinc-100 text-zinc-600",
								)}
							>
								{steps.datetime.completed ? <CheckCircle2 size={16} /> : "3"}
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

						{steps.datetime.current && steps.procedure.completed && (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
								<FormField
									label="Fecha"
									helper="Selecciona una fecha disponible"
									required
								>
									<DatePickerInput
										placeholder="Seleccionar fecha"
										value={selectedDate}
										onChange={(val) => {
											const dateValue = typeof val === "string" ? null : val;
											onDateChange(dateValue);
											onSlotChange(null); // Reset slot when date changes
										}}
										minDate={new Date()}
										radius="lg"
										size="md"
										leftSection={
											<CalendarDays size={16} className="text-zinc-400" />
										}
										className={cx(
											"transition-all duration-200",
											selectedDate && "border-emerald-500/50",
										)}
									/>
								</FormField>

								<FormField
									label="Horario"
									helper={
										!selectedDate
											? "Primero selecciona una fecha"
											: slotOptions.length === 0
												? "No hay horarios disponibles para esta fecha"
												: "Selecciona un horario"
									}
									required
								>
									<Select
										placeholder={
											!selectedDate
												? "Selecciona fecha primero"
												: "Seleccionar horario"
										}
										value={selectedSlot}
										onChange={(val) => {
											onSlotChange(val);
											if (val) goToStep("staff");
										}}
										data={slotOptions}
										disabled={!selectedDate || slotOptions.length === 0}
										nothingFoundMessage="No hay horarios disponibles"
										radius="lg"
										size="md"
										leftSection={<Clock size={16} className="text-zinc-400" />}
										className={cx(
											"transition-all duration-200",
											selectedSlot && "border-emerald-500/50",
										)}
									/>
								</FormField>
							</div>
						)}

						{!steps.datetime.current && steps.datetime.completed && (
							<div className="mt-2 flex items-center gap-2">
								<span className="text-sm text-zinc-600">
									{selectedDate?.toLocaleDateString("es-CO", {
										weekday: "long",
										year: "numeric",
										month: "long",
										day: "numeric",
									})}
									{" - "}
									{slotOptions.find((s) => s.value === selectedSlot)?.label}
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

					{/* Paso 4: Funcionario */}
					<button
						type="button"
						disabled={!steps.datetime.completed}
						onClick={() => goToStep("staff")}
						className={cx(
							"w-full text-left rounded-xl border p-4 transition-all duration-200",
							steps.staff.current
								? "border-zinc-300 bg-white shadow-sm"
								: "border-zinc-200 bg-zinc-50/50 hover:border-zinc-300",
							steps.staff.completed &&
								!steps.staff.current &&
								"border-emerald-200",
							!steps.datetime.completed && "opacity-50 cursor-not-allowed",
						)}
					>
						<div className="flex items-center gap-3 mb-3">
							<div
								className={cx(
									"flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors",
									steps.staff.completed
										? "bg-emerald-100 text-emerald-700"
										: "bg-zinc-100 text-zinc-600",
								)}
							>
								{steps.staff.completed ? <CheckCircle2 size={16} /> : "4"}
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

						{steps.staff.current && steps.datetime.completed && (
							<FormField
								label="Encargado"
								helper="Selecciona el funcionario que atenderá la cita"
								required
							>
								<Select
									placeholder="Buscar funcionario..."
									value={selectedStaff}
									onChange={onStaffChange}
									data={staffOptions}
									searchable
									nothingFoundMessage="No se encontraron funcionarios"
									radius="lg"
									size="md"
									leftSection={<MapPin size={16} className="text-zinc-400" />}
									className={cx(
										"transition-all duration-200",
										selectedStaff && "border-emerald-500/50",
									)}
								/>
							</FormField>
						)}

						{!steps.staff.current && steps.staff.completed && (
							<div className="mt-2 flex items-center gap-2">
								<span className="text-sm text-zinc-600">
									{staffOptions.find((s) => s.value === selectedStaff)?.label}
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

					<FormActions align="right">
						<FormActionButton
							variant="secondary"
							onClick={onClose}
							disabled={loading}
						>
							Cancelar
						</FormActionButton>
						<FormActionButton
							variant="primary"
							isLoading={loading}
							onClick={onSubmit}
							disabled={!canSubmit}
							leftSection={<CheckCircle2 size={18} strokeWidth={1.5} />}
						>
							Confirmar cita
						</FormActionButton>
					</FormActions>
				</Stack>
			</Box>
		</PremiumModal>
	);
}
