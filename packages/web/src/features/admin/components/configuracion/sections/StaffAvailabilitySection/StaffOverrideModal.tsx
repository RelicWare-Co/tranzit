import { Alert, Button, NumberInput, Switch, Textarea } from "@mantine/core";
import { DatePickerInput, TimePicker } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { AlertCircle, Save, UserRoundCog } from "lucide-react";
import { useEffect, useState } from "react";
import { PremiumModal } from "#/features/admin/components";
import classes from "#/features/admin/components/configuracion/Configuracion.module.css";
import {
	isTimeBefore,
	validateTime,
} from "#/features/admin/components/configuracion/constants";
import { getErrorMessage } from "#/features/admin/components/errors";
import type { StaffDateOverride } from "#/features/admin/components/hooks/useStaffOverrides";

type StaffOverridePayload = {
	overrideDate: string;
	isAvailable: boolean;
	capacityOverride?: number | undefined;
	availableStartTime?: string | null;
	availableEndTime?: string | null;
	notes?: string | null;
};

interface StaffOverrideModalProps {
	opened: boolean;
	onClose: () => void;
	staffName: string;
	override?: StaffDateOverride;
	onCreate: (payload: StaffOverridePayload) => Promise<void>;
	onUpdate: (
		overrideId: string,
		payload: StaffOverridePayload,
	) => Promise<void>;
}

const EMPTY_VALUES = {
	overrideDate: "",
	isAvailable: true,
	capacityOverride: undefined as number | undefined,
	availableStartTime: "",
	availableEndTime: "",
	notes: "",
};

const TIME_PICKER_LABELS = {
	hoursInputLabel: "Horas",
	minutesInputLabel: "Minutos",
	clearButtonProps: { "aria-label": "Limpiar hora" } as const,
};

export function StaffOverrideModal({
	opened,
	onClose,
	staffName,
	override,
	onCreate,
	onUpdate,
}: StaffOverrideModalProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const isEditing = override !== undefined;

	const form = useForm({
		initialValues: EMPTY_VALUES,
		validate: (values) => ({
			overrideDate: values.overrideDate ? null : "La fecha es obligatoria",
			capacityOverride:
				values.capacityOverride !== undefined && values.capacityOverride < 1
					? "Debe ser mayor a 0"
					: null,
			availableStartTime: validateTime(
				values.availableStartTime,
				"Hora de inicio",
			),
			availableEndTime:
				validateTime(values.availableEndTime, "Hora de fin") ??
				(values.availableStartTime &&
				values.availableEndTime &&
				!isTimeBefore(values.availableStartTime, values.availableEndTime)
					? "La hora de fin debe ser posterior al inicio"
					: null),
		}),
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: synchronize modal form with selected override
	useEffect(() => {
		if (!opened) return;
		setSubmitError(null);

		if (override) {
			form.setValues({
				overrideDate: override.overrideDate,
				isAvailable: override.isAvailable,
				capacityOverride: override.capacityOverride ?? undefined,
				availableStartTime: override.availableStartTime ?? "",
				availableEndTime: override.availableEndTime ?? "",
				notes: override.notes ?? "",
			});
			return;
		}

		form.setValues(EMPTY_VALUES);
	}, [opened, override]);

	const handleClose = () => {
		if (!isSubmitting) onClose();
	};

	const handleSubmit = async (values: typeof form.values) => {
		setSubmitError(null);
		setIsSubmitting(true);

		const payload: StaffOverridePayload = {
			overrideDate: values.overrideDate,
			isAvailable: values.isAvailable,
			capacityOverride: values.capacityOverride,
			availableStartTime: values.availableStartTime || null,
			availableEndTime: values.availableEndTime || null,
			notes: values.notes || null,
		};

		try {
			if (override) await onUpdate(override.id, payload);
			else await onCreate(payload);
			onClose();
		} catch (error) {
			setSubmitError(
				getErrorMessage(error, "No se pudo guardar la disponibilidad"),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const availabilityFieldsDisabled = !form.values.isAvailable || isSubmitting;

	return (
		<PremiumModal
			opened={opened}
			onClose={handleClose}
			title={isEditing ? "Editar disponibilidad" : "Nueva disponibilidad"}
			subtitle={`Regla puntual para ${staffName}.`}
			size="lg"
			closeOnClickOutside={!isSubmitting}
			closeOnEscape={!isSubmitting}
			classNames={{
				content: classes.modalContent,
				header: classes.modalHeader,
				body: classes.modalBody,
			}}
		>
			<form
				onSubmit={form.onSubmit(handleSubmit)}
				className={classes.modalForm}
			>
				{submitError ? (
					<Alert
						color="red"
						variant="light"
						radius="md"
						icon={<AlertCircle size={16} />}
						mt="lg"
					>
						{submitError}
					</Alert>
				) : null}

				<section className={classes.formSection}>
					<div className={classes.formSectionHeading}>
						<h3 className={classes.formSectionTitle}>Fecha y estado</h3>
						<p className={classes.formSectionDescription}>
							Define si el funcionario podrá recibir asignaciones ese día.
						</p>
					</div>
					<div className={classes.formGrid}>
						<DatePickerInput
							label="Fecha"
							placeholder="Selecciona una fecha"
							locale="es"
							valueFormat="DD/MM/YYYY"
							clearable
							disabled={isSubmitting}
							value={form.values.overrideDate || null}
							onChange={(value) =>
								form.setFieldValue("overrideDate", value || "")
							}
							error={form.errors.overrideDate}
						/>
						<Switch
							label="Disponible para asignaciones"
							description="Desactívalo para bloquear la fecha completa"
							className={classes.switchControl}
							disabled={isSubmitting}
							{...form.getInputProps("isAvailable", { type: "checkbox" })}
						/>
					</div>
				</section>

				<section className={classes.formSection}>
					<div className={classes.formSectionHeading}>
						<h3 className={classes.formSectionTitle}>Límites de atención</h3>
						<p className={classes.formSectionDescription}>
							Los campos vacíos conservan la disponibilidad habitual del
							funcionario.
						</p>
					</div>
					<div className={classes.formGridThree}>
						<TimePicker
							label="Hora de inicio"
							withDropdown
							minutesStep={5}
							clearable
							disabled={availabilityFieldsDisabled}
							value={form.values.availableStartTime}
							onChange={(value) =>
								form.setFieldValue("availableStartTime", value)
							}
							error={form.errors.availableStartTime}
							{...TIME_PICKER_LABELS}
						/>
						<TimePicker
							label="Hora de fin"
							withDropdown
							minutesStep={5}
							clearable
							disabled={availabilityFieldsDisabled}
							value={form.values.availableEndTime}
							onChange={(value) =>
								form.setFieldValue("availableEndTime", value)
							}
							error={form.errors.availableEndTime}
							{...TIME_PICKER_LABELS}
						/>
						<NumberInput
							label="Capacidad máxima"
							description="Citas durante la fecha"
							placeholder="Sin cambio"
							min={1}
							disabled={availabilityFieldsDisabled}
							{...form.getInputProps("capacityOverride")}
						/>
					</div>
				</section>

				<section className={classes.formSection}>
					<div className={classes.formSectionHeading}>
						<h3 className={classes.formSectionTitle}>Contexto interno</h3>
					</div>
					<Textarea
						label="Notas"
						placeholder="Ej. vacaciones, incapacidad o jornada especial"
						rows={2}
						disabled={isSubmitting}
						{...form.getInputProps("notes")}
					/>
				</section>

				<div className={classes.modalActions}>
					<Button
						variant="default"
						type="button"
						onClick={handleClose}
						disabled={isSubmitting}
					>
						Cancelar
					</Button>
					<Button
						type="submit"
						loading={isSubmitting}
						leftSection={
							isEditing ? <Save size={16} /> : <UserRoundCog size={16} />
						}
					>
						{isEditing ? "Guardar cambios" : "Crear excepción"}
					</Button>
				</div>
			</form>
		</PremiumModal>
	);
}
