import {
	Alert,
	Button,
	NumberInput,
	Select,
	Switch,
	Textarea,
} from "@mantine/core";
import { TimePicker } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { AlertCircle, CalendarClock, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { PremiumModal } from "#/features/admin/components";
import classes from "#/features/admin/components/configuracion/Configuracion.module.css";
import {
	validateScheduleTimeFields,
	weekdayLabels,
} from "#/features/admin/components/configuracion/constants";
import { getErrorMessage } from "#/features/admin/components/errors";
import type { ScheduleTemplate } from "#/features/admin/components/hooks/useConfigSnapshot";

type TemplatePayload = {
	weekday: number;
	slotDurationMinutes: number;
	bufferMinutes: number;
	slotCapacityLimit: number | null;
	isEnabled: boolean;
	morningStart: string | null;
	morningEnd: string | null;
	afternoonStart: string | null;
	afternoonEnd: string | null;
	notes: string | null;
};

interface ScheduleTemplateModalProps {
	opened: boolean;
	onClose: () => void;
	mode: "create" | "edit";
	template?: ScheduleTemplate;
	onCreate: (payload: TemplatePayload) => Promise<void>;
	onUpdate: (
		id: string,
		payload: Omit<TemplatePayload, "weekday">,
	) => Promise<void>;
}

const EMPTY_VALUES = {
	weekday: 1,
	slotDurationMinutes: 20,
	bufferMinutes: 0,
	slotCapacityLimit: undefined as number | undefined,
	isEnabled: true,
	morningStart: "",
	morningEnd: "",
	afternoonStart: "",
	afternoonEnd: "",
	notes: "",
};

const TIME_PICKER_LABELS = {
	hoursInputLabel: "Horas",
	minutesInputLabel: "Minutos",
	clearButtonProps: { "aria-label": "Limpiar hora" } as const,
};

const weekdayOptions = Object.entries(weekdayLabels).map(([value, label]) => ({
	value,
	label,
}));

export function ScheduleTemplateModal({
	opened,
	onClose,
	mode,
	template,
	onCreate,
	onUpdate,
}: ScheduleTemplateModalProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	const form = useForm({
		initialValues: EMPTY_VALUES,
		validate: (values) => {
			const errors: Record<string, string | null> = {
				weekday:
					values.weekday < 0 || values.weekday > 6
						? "Día inválido (0-6)"
						: null,
				slotDurationMinutes:
					values.slotDurationMinutes < 5 || values.slotDurationMinutes > 240
						? "Debe estar entre 5 y 240 min"
						: null,
				bufferMinutes:
					values.bufferMinutes < 0 || values.bufferMinutes > 60
						? "Debe estar entre 0 y 60 min"
						: null,
				slotCapacityLimit:
					values.slotCapacityLimit !== undefined && values.slotCapacityLimit < 1
						? "Debe ser mayor a 0"
						: null,
			};

			const timeErrors = validateScheduleTimeFields({
				morningStart: values.morningStart,
				morningEnd: values.morningEnd,
				afternoonStart: values.afternoonStart,
				afternoonEnd: values.afternoonEnd,
			});

			for (const [field, message] of Object.entries(timeErrors)) {
				errors[field] = message;
			}

			return errors;
		},
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset form when modal opens or template changes
	useEffect(() => {
		if (!opened) return;

		setSubmitError(null);

		if (mode === "edit" && template) {
			form.setValues({
				weekday: template.weekday,
				slotDurationMinutes: template.slotDurationMinutes,
				bufferMinutes: template.bufferMinutes,
				slotCapacityLimit:
					template.slotCapacityLimit === null
						? undefined
						: template.slotCapacityLimit,
				isEnabled: template.isEnabled,
				morningStart: template.morningStart ?? "",
				morningEnd: template.morningEnd ?? "",
				afternoonStart: template.afternoonStart ?? "",
				afternoonEnd: template.afternoonEnd ?? "",
				notes: template.notes ?? "",
			});
			return;
		}

		form.setValues(EMPTY_VALUES);
	}, [opened, mode, template]);

	const handleClose = () => {
		if (isSubmitting) return;
		onClose();
	};

	const buildPayload = (values: typeof form.values): TemplatePayload => ({
		weekday: values.weekday,
		slotDurationMinutes: values.slotDurationMinutes,
		bufferMinutes: values.bufferMinutes,
		slotCapacityLimit: values.slotCapacityLimit ?? null,
		isEnabled: values.isEnabled,
		morningStart: values.morningStart || null,
		morningEnd: values.morningEnd || null,
		afternoonStart: values.afternoonStart || null,
		afternoonEnd: values.afternoonEnd || null,
		notes: values.notes || null,
	});

	const handleSubmit = async (values: typeof form.values) => {
		setSubmitError(null);
		setIsSubmitting(true);

		try {
			const payload = buildPayload(values);

			if (mode === "edit" && template) {
				const { weekday: _weekday, ...updatePayload } = payload;
				await onUpdate(template.id, updatePayload);
			} else {
				await onCreate(payload);
			}

			form.reset();
			onClose();
		} catch (error) {
			setSubmitError(
				getErrorMessage(error, "No se pudo guardar la plantilla de agenda"),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const title =
		mode === "edit" && template
			? `Editar plantilla — ${weekdayLabels[template.weekday]}`
			: "Crear plantilla de agenda";

	return (
		<PremiumModal
			opened={opened}
			onClose={handleClose}
			title={title}
			subtitle="Configura una regla semanal de atención."
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
						<h3 className={classes.formSectionTitle}>Regla base</h3>
						<p className={classes.formSectionDescription}>
							Elige el día y los límites que se aplicarán a cada slot.
						</p>
					</div>
					<div className={classes.formGrid}>
						{mode === "edit" && template ? (
							<div className={classes.readonlyDay}>
								<span className={classes.readonlyLabel}>Día de la semana</span>
								<span className={classes.readonlyValue}>
									{weekdayLabels[template.weekday]}
								</span>
							</div>
						) : (
							<Select
								label="Día de la semana"
								placeholder="Selecciona un día"
								data={weekdayOptions}
								disabled={isSubmitting}
								value={String(form.values.weekday)}
								onChange={(value) =>
									form.setFieldValue("weekday", Number(value ?? 1))
								}
								error={form.errors.weekday}
							/>
						)}
						<NumberInput
							label="Duración del slot"
							description="Entre 5 y 240 minutos"
							suffix=" min"
							min={5}
							max={240}
							disabled={isSubmitting}
							{...form.getInputProps("slotDurationMinutes")}
						/>
						<NumberInput
							label="Tiempo entre slots"
							description="Pausa antes de la siguiente cita"
							suffix=" min"
							min={0}
							max={60}
							disabled={isSubmitting}
							{...form.getInputProps("bufferMinutes")}
						/>
						<NumberInput
							label="Capacidad máxima"
							description="Déjalo vacío para no limitar"
							placeholder="Sin límite"
							min={1}
							disabled={isSubmitting}
							{...form.getInputProps("slotCapacityLimit")}
						/>
					</div>
				</section>

				<section className={classes.formSection}>
					<div className={classes.formSectionHeading}>
						<h3 className={classes.formSectionTitle}>Ventanas de atención</h3>
						<p className={classes.formSectionDescription}>
							Agrupa cada jornada con su hora de inicio y fin. Puedes dejar una
							jornada vacía.
						</p>
					</div>
					<div className={classes.windowGrid}>
						<span className={classes.windowLabel}>Mañana</span>
						<TimePicker
							label="Inicio mañana"
							withDropdown
							minutesStep={5}
							clearable
							disabled={isSubmitting}
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
							disabled={isSubmitting}
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
							disabled={isSubmitting}
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
							disabled={isSubmitting}
							value={form.values.afternoonEnd}
							onChange={(value) => form.setFieldValue("afternoonEnd", value)}
							error={form.errors.afternoonEnd}
							{...TIME_PICKER_LABELS}
						/>
					</div>
				</section>

				<section className={classes.formSection}>
					<div className={classes.formSectionHeading}>
						<h3 className={classes.formSectionTitle}>Estado y contexto</h3>
					</div>
					<div className={classes.formGrid}>
						<Switch
							label="Plantilla habilitada"
							description="Permite generar disponibilidad con esta regla"
							disabled={isSubmitting}
							className={classes.switchControl}
							{...form.getInputProps("isEnabled", { type: "checkbox" })}
						/>
						<Textarea
							label="Notas internas"
							placeholder="Agrega contexto para el equipo"
							rows={2}
							disabled={isSubmitting}
							{...form.getInputProps("notes")}
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
							mode === "edit" ? <Save size={16} /> : <CalendarClock size={16} />
						}
					>
						{mode === "edit" ? "Guardar cambios" : "Crear plantilla"}
					</Button>
				</div>
			</form>
		</PremiumModal>
	);
}
