import { Alert, Box, LoadingOverlay, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	FormActionButton,
	FormActions,
	PremiumModal,
} from "#/features/admin/components";
import { getErrorMessage } from "#/features/admin/components/errors";
import { formatDateLocal } from "#/features/admin/components/dates";
import { orpcClient } from "#/shared/lib/orpc-client";
import type { BookingKind } from "./types";
import { BookingTypeStep } from "./steps/BookingTypeStep";
import { ProcedureStep } from "./steps/ProcedureStep";
import { DateTimeStep } from "./steps/DateTimeStep";
import { StaffStep } from "./steps/StaffStep";

interface NewBookingModalProps {
	opened: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

export function NewBookingModal({
	opened,
	onClose,
	onSuccess,
}: NewBookingModalProps) {
	const [activeStep, setActiveStep] = useState<
		"type" | "procedure" | "datetime" | "staff"
	>("type");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			bookingKind: "administrative" as BookingKind,
			procedureId: "",
			date: null as Date | null,
			slotId: "",
			staffUserId: "",
		},
		validate: {
			procedureId: (value, values) =>
				values.bookingKind === "citizen" && !value
					? "Seleccioná un trámite"
					: null,
			date: (value) => (!value ? "Seleccioná una fecha" : null),
			slotId: (value) => (!value ? "Seleccioná un horario" : null),
			staffUserId: (value) =>
				!value ? "Seleccioná un funcionario" : null,
		},
	});

	// Reset form when modal opens
	useEffect(() => {
		if (!opened) return;
		form.reset();
		setActiveStep("type");
		setError(null);
		setSuccess(false);
		setLoading(false);
	}, [opened]);

	// Reset slot when date changes
	useEffect(() => {
		if (!opened) return;
		form.setFieldValue("slotId", "");
	}, [form.values.date]);

	// Queries
	const staffQuery = useQuery({
		queryKey: ["admin", "citas", "staff-list"],
		enabled: opened,
		queryFn: async () =>
			await orpcClient.admin.staff.list({ isActive: true }),
	});

	const proceduresQuery = useQuery({
		queryKey: ["admin", "citas", "procedures-list"],
		enabled: opened,
		queryFn: async () =>
			await orpcClient.admin.procedures.list({ isActive: true }),
	});

	const dateStr = form.values.date ? formatDateLocal(form.values.date) : "";

	const slotsQuery = useQuery({
		queryKey: ["admin", "citas", "slots", dateStr],
		enabled: opened && !!dateStr,
		queryFn: async () =>
			await orpcClient.admin.schedule.slots.list({ date: dateStr }),
	});

	const staffOptions = useMemo(
		() =>
			(staffQuery.data ?? [])
				.filter(
					(staff) =>
						staff.isActive &&
						staff.isAssignable &&
						staff.user,
				)
				.map((staff) => ({
					value: staff.userId,
					label: staff.user?.name || staff.user?.email || staff.userId,
				})),
		[staffQuery.data],
	);

	const procedureOptions = useMemo(
		() =>
			(proceduresQuery.data ?? []).map((procedure) => ({
				value: procedure.id,
				label: procedure.name || procedure.slug,
			})),
		[proceduresQuery.data],
	);

	const availableSlots = useMemo(
		() =>
			(slotsQuery.data?.slots ?? []).filter(
				(slot) =>
					slot.status === "open" &&
					(slot.remainingCapacity === null ||
						slot.remainingCapacity > 0),
			),
		[slotsQuery.data?.slots],
	);

	const slotOptions = useMemo(
		() =>
			availableSlots.map((slot) => {
				const capacityLabel =
					slot.remainingCapacity === null
						? "sin límite"
						: `${slot.remainingCapacity} cupos`;
				return {
					value: slot.id,
					label: `${slot.startTime.slice(0, 5)} - ${slot.endTime.slice(0, 5)} (${capacityLabel})`,
				};
			}),
		[availableSlots],
	);

	// Step state derived from form values
	const values = form.getValues();
	const steps = useMemo(
		() => ({
			type: { completed: true, current: activeStep === "type" },
			procedure: {
				completed: !!values.procedureId,
				current: activeStep === "procedure",
			},
			datetime: {
				completed: !!values.date && !!values.slotId,
				current: activeStep === "datetime",
			},
			staff: {
				completed: !!values.staffUserId,
				current: activeStep === "staff",
			},
		}),
		[activeStep, values],
	);

	const progress = useMemo(() => {
		let completed = 1;
		if (values.procedureId) completed++;
		if (values.date && values.slotId) completed++;
		if (values.staffUserId) completed++;
		return (completed / 4) * 100;
	}, [values]);

	const canSubmit =
		values.procedureId &&
		values.date &&
		values.slotId &&
		values.staffUserId &&
		!loading;

	const handleSubmit = async () => {
		const validation = await form.validate();
		if (validation.hasErrors) {
			setError("Por favor completa todos los campos requeridos.");
			return;
		}

		setLoading(true);
		setError(null);
		setSuccess(false);

		try {
			await orpcClient.admin.bookings.create({
				slotId: values.slotId,
				staffUserId: values.staffUserId,
				kind: values.bookingKind,
			});

			setSuccess(true);
			onSuccess();

			setTimeout(() => {
				onClose();
			}, 1200);
		} catch (createError) {
			setError(
				getErrorMessage(
					createError,
					"No se pudo crear la cita. Valida disponibilidad y permisos.",
				),
			);
		} finally {
			setLoading(false);
		}
	};

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

				{/* Progress bar */}
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

					<BookingTypeStep
						form={form}
						isCurrent={steps.type.current}
						isCompleted={steps.type.completed}
						goToStep={setActiveStep}
					/>

					<ProcedureStep
						form={form}
						procedureOptions={procedureOptions}
						isCurrent={steps.procedure.current}
						isCompleted={steps.procedure.completed}
						isPreviousCompleted={steps.type.completed}
						goToStep={setActiveStep}
					/>

					<DateTimeStep
						form={form}
						slotOptions={slotOptions}
						isCurrent={steps.datetime.current}
						isCompleted={steps.datetime.completed}
						isPreviousCompleted={steps.procedure.completed}
						goToStep={setActiveStep}
					/>

					<StaffStep
						form={form}
						staffOptions={staffOptions}
						isCurrent={steps.staff.current}
						isCompleted={steps.staff.completed}
						isPreviousCompleted={steps.datetime.completed}
						goToStep={setActiveStep}
					/>

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
							onClick={() => void handleSubmit()}
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
