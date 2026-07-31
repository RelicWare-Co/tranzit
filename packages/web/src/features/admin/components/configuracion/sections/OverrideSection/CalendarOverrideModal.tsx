import { Alert, Button, NumberInput, Switch, Textarea } from "@mantine/core";
import { DatePickerInput, TimePicker } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { AlertCircle, CalendarPlus, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { PremiumModal } from "#/features/admin/components";
import classes from "#/features/admin/components/configuracion/Configuracion.module.css";
import { validateScheduleTimeFields } from "#/features/admin/components/configuracion/constants";
import { getErrorMessage } from "#/features/admin/components/errors";
import type { CalendarOverride } from "#/features/admin/components/hooks/useConfigSnapshot";

type CalendarOverridePayload = {
	overrideDate: string;
	isClosed: boolean;
	morningEnabled: boolean;
	afternoonEnabled: boolean;
	morningStart: string | null;
	morningEnd: string | null;
	afternoonStart: string | null;
	afternoonEnd: string | null;
	slotDurationMinutes: number | null;
	bufferMinutes: number | null;
	slotCapacityLimit: number | null;
	reason: string | null;
};

interface CalendarOverrideModalProps {
	opened: boolean;
	onClose: () => void;
	override?: CalendarOverride;
	onCreate: (payload: CalendarOverridePayload) => Promise<void>;
	onUpdate: (id: string, payload: CalendarOverridePayload) => Promise<void>;
}

const EMPTY_VALUES = {
	overrideDate: "",
	isClosed: false,
	morningEnabled: true,
	afternoonEnabled: true,
	morningStart: "",
	morningEnd: "",
	afternoonStart: "",
	afternoonEnd: "",
	slotDurationMinutes: undefined as number | undefined,
	bufferMinutes: undefined as number | undefined,
	slotCapacityLimit: undefined as number | undefined,
	reason: "",
};

const TIME_PICKER_LABELS = {
	hoursInputLabel: "Horas",
	minutesInputLabel: "Minutos",
	clearButtonProps: { "aria-label": "Limpiar hora" } as const,
};

export function CalendarOverrideModal({
	opened,
	onClose,
	override,
	onCreate,
	onUpdate,
}: CalendarOverrideModalProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const isEditing = override !== undefined;

	const form = useForm({
		initialValues: EMPTY_VALUES,
		validate: (values) => {
			const errors: Record<string, string | null> = {
				overrideDate: values.overrideDate ? null : "La fecha es obligatoria",
				slotDurationMinutes:
					values.slotDurationMinutes !== undefined &&
					values.slotDurationMinutes < 5
						? "Mínimo 5 minutos"
						: null,
				bufferMinutes:
					values.bufferMinutes !== undefined && values.bufferMinutes < 0
						? "No puede ser negativo"
						: null,
				slotCapacityLimit:
					values.slotCapacityLimit !== undefined && values.slotCapacityLimit < 1
						? "Debe ser mayor a 0"
						: null,
			};

			if (!values.isClosed) {
				const timeErrors = validateScheduleTimeFields({
					morningStart: values.morningEnabled ? values.morningStart : "",
					morningEnd: values.morningEnabled ? values.morningEnd : "",
					afternoonStart: values.afternoonEnabled ? values.afternoonStart : "",
					afternoonEnd: values.afternoonEnabled ? values.afternoonEnd : "",
				});
				Object.assign(errors, timeErrors);
			}

			return errors;
		},
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: synchronize modal form with selected override
	useEffect(() => {
		if (!opened) return;
		setSubmitError(null);

		if (override) {
			form.setValues({
				overrideDate: override.overrideDate,
				isClosed: override.isClosed,
				morningEnabled: override.morningEnabled,
				afternoonEnabled: override.afternoonEnabled,
				morningStart: override.morningStart ?? "",
				morningEnd: override.morningEnd ?? "",
				afternoonStart: override.afternoonStart ?? "",
				afternoonEnd: override.afternoonEnd ?? "",
				slotDurationMinutes: override.slotDurationMinutes ?? undefined,
				bufferMinutes: override.bufferMinutes ?? undefined,
				slotCapacityLimit: override.slotCapacityLimit ?? undefined,
				reason: override.reason ?? "",
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

		const payload: CalendarOverridePayload = {
			overrideDate: values.overrideDate,
			isClosed: values.isClosed,
			morningEnabled: values.isClosed ? false : values.morningEnabled,
			afternoonEnabled: values.isClosed ? false : values.afternoonEnabled,
			morningStart: values.isClosed ? null : values.morningStart || null,
			morningEnd: values.isClosed ? null : values.morningEnd || null,
			afternoonStart: values.isClosed ? null : values.afternoonStart || null,
			afternoonEnd: values.isClosed ? null : values.afternoonEnd || null,
			slotDurationMinutes: values.slotDurationMinutes ?? null,
			bufferMinutes: values.bufferMinutes ?? null,
			slotCapacityLimit: values.slotCapacityLimit ?? null,
			reason: values.reason || null,
		};

		try {
			if (override) await onUpdate(override.id, payload);
			else await onCreate(payload);
			onClose();
		} catch (error) {
			setSubmitError(getErrorMessage(error, "No se pudo guardar la excepción"));
		} finally {
			setIsSubmitting(false);
		}
	};

	const scheduleDisabled = form.values.isClosed;

	return (
		<PremiumModal
			opened={opened}
			onClose={handleClose}
			title={isEditing ? "Editar excepción de calendario" : "Nueva excepción"}
			subtitle="Define una regla puntual que reemplaza la agenda semanal."
			size="xl"
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
						<h3 className={classes.formSectionTitle}>Fecha y motivo</h3>
						<p className={classes.formSectionDescription}>
							Identifica cuándo aplica el cambio y deja una explicación breve.
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
							value={
								form.values.overrideDate
									? new Date(`${form.values.overrideDate}T00:00:00`)
									: null
							}
							onChange={(value) => {
								const formatted = value ? value.toString().split("T")[0] : "";
								form.setFieldValue("overrideDate", formatted);
							}}
							error={form.errors.overrideDate}
						/>
						<Textarea
							label="Motivo"
							placeholder="Ej. festivo local o mantenimiento"
							rows={2}
							disabled={isSubmitting}
							{...form.getInputProps("reason")}
						/>
					</div>
				</section>

				<section className={classes.formSection}>
					<div className={classes.formSectionHeading}>
						<h3 className={classes.formSectionTitle}>Estado del día</h3>
						<p className={classes.formSectionDescription}>
							Cierra la fecha completa o habilita las jornadas que sí tendrán
							atención.
						</p>
					</div>
					<div className={classes.switchGroup}>
<Switch
						label="Día cerrado"
						description="No se ofrecerán slots durante esta fecha"
						color="red"
						className={`${classes.switchControl} ${classes.fullSpan}`}
						disabled={isSubmitting}
						checked={form.values.isClosed}
						onChange={(event) => {
							const nextClosed = event.currentTarget.checked;
							form.setFieldValue("isClosed", nextClosed);
							if (nextClosed) {
								form.setFieldValue("morningEnabled", false);
								form.setFieldValue("afternoonEnabled", false);
								form.setFieldValue("morningStart", "");
								form.setFieldValue("morningEnd", "");
								form.setFieldValue("afternoonStart", "");
								form.setFieldValue("afternoonEnd", "");
							}
						}}
					/>
					<Switch
						label="Jornada de la mañana"
						description="Permite atención antes del mediodía"
						className={classes.switchControl}
						disabled={scheduleDisabled || isSubmitting}
						{...form.getInputProps("morningEnabled", {
							type: "checkbox",
						})}
					/>
					<Switch
						label="Jornada de la tarde"
						description="Permite atención después del mediodía"
						className={classes.switchControl}
						disabled={scheduleDisabled || isSubmitting}
						{...form.getInputProps("afternoonEnabled", {
							type: "checkbox",
						})}
					/>
					</div>
				</section>

				<section className={classes.formSection}>
					<div className={classes.formSectionHeading}>
						<h3 className={classes.formSectionTitle}>Horario especial</h3>
						<p className={classes.formSectionDescription}>
							Déjalo vacío para conservar el horario de la agenda semanal.
						</p>
					</div>
					<div className={classes.windowGrid}>
						<span className={classes.windowLabel}>Mañana</span>
						<TimePicker
							label="Inicio mañana"
							withDropdown
							minutesStep={5}
							clearable
							disabled={
								scheduleDisabled || !form.values.morningEnabled || isSubmitting
							}
							value={form.values.morningStart}
							onChange={(value) => form.setFieldValue("morningStart", value)}
							error={form.errors.morningStart}
							{...TIME_PICKER_LABELS}
						/>
						<TimePicker
							label="Fin mañana"
							withDropdown
							minutesStep={5}
							clearable
							disabled={
								scheduleDisabled || !form.values.morningEnabled || isSubmitting
							}
							value={form.values.morningEnd}
							onChange={(value) => form.setFieldValue("morningEnd", value)}
							error={form.errors.morningEnd}
							{...TIME_PICKER_LABELS}
						/>
						<span className={classes.windowLabel}>Tarde</span>
						<TimePicker
							label="Inicio tarde"
							withDropdown
							minutesStep={5}
							clearable
							disabled={
								scheduleDisabled ||
								!form.values.afternoonEnabled ||
								isSubmitting
							}
							value={form.values.afternoonStart}
							onChange={(value) => form.setFieldValue("afternoonStart", value)}
							error={form.errors.afternoonStart}
							{...TIME_PICKER_LABELS}
						/>
						<TimePicker
							label="Fin tarde"
							withDropdown
							minutesStep={5}
							clearable
							disabled={
								scheduleDisabled ||
								!form.values.afternoonEnabled ||
								isSubmitting
							}
							value={form.values.afternoonEnd}
							onChange={(value) => form.setFieldValue("afternoonEnd", value)}
							error={form.errors.afternoonEnd}
							{...TIME_PICKER_LABELS}
						/>
					</div>
				</section>

				<section className={classes.formSection}>
					<div className={classes.formSectionHeading}>
						<h3 className={classes.formSectionTitle}>Parámetros especiales</h3>
						<p className={classes.formSectionDescription}>
							Solo completa los valores que deban reemplazar la regla semanal.
						</p>
					</div>
					<div className={classes.formGridThree}>
						<NumberInput
							label="Duración del slot"
							placeholder="Usar regla semanal"
							suffix=" min"
							min={5}
							disabled={isSubmitting}
							{...form.getInputProps("slotDurationMinutes")}
						/>
						<NumberInput
							label="Tiempo entre slots"
							placeholder="Usar regla semanal"
							suffix=" min"
							min={0}
							disabled={isSubmitting}
							{...form.getInputProps("bufferMinutes")}
						/>
						<NumberInput
							label="Capacidad máxima"
							placeholder="Usar regla semanal"
							min={1}
							disabled={isSubmitting}
							{...form.getInputProps("slotCapacityLimit")}
						/>
					</div>
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
							isEditing ? <Save size={16} /> : <CalendarPlus size={16} />
						}
					>
						{isEditing ? "Guardar cambios" : "Crear excepción"}
					</Button>
				</div>
			</form>
		</PremiumModal>
	);
}
