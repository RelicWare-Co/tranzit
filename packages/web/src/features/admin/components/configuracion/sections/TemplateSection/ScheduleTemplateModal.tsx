import {
	Alert,
	Badge,
	Checkbox,
	Grid,
	NumberInput,
	Select,
	Stack,
	Text,
	TextInput,
} from "@mantine/core";
import { TimePicker } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import {
	FormActionButton,
	FormActions,
	PremiumModal,
} from "#/features/admin/components";
import {
	validateScheduleTimeFields,
	weekdayLabels,
} from "#/features/admin/components/configuracion/constants";
import type { ScheduleTemplate } from "#/features/admin/components/hooks/useConfigSnapshot";
import { getErrorMessage } from "#/features/admin/components/errors";

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
	onUpdate: (id: string, payload: Omit<TemplatePayload, "weekday">) => Promise<void>;
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

	const subtitle =
		mode === "create"
			? "Define horarios y parámetros de slots para un día de la semana"
			: undefined;

	return (
		<PremiumModal
			opened={opened}
			onClose={handleClose}
			title={title}
			subtitle={subtitle}
			size="lg"
		>
			<form onSubmit={form.onSubmit(handleSubmit)}>
				<Stack gap="lg">
					{submitError && (
						<Alert
							color="red"
							variant="light"
							radius="md"
							icon={<AlertCircle size={16} />}
						>
							{submitError}
						</Alert>
					)}

					<Grid>
						<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
							{mode === "edit" && template ? (
								<Stack gap={4}>
									<Text size="sm" fw={500}>
										Día de la semana
									</Text>
									<Badge variant="light" radius="sm" size="lg">
										{weekdayLabels[template.weekday]}
									</Badge>
								</Stack>
							) : (
								<Select
									label="Día de la semana"
									placeholder="Selecciona"
									data={Object.entries(weekdayLabels).map(([value, label]) => ({
										value,
										label,
									}))}
									disabled={isSubmitting}
									{...form.getInputProps("weekday")}
								/>
							)}
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
							<NumberInput
								label="Duración del slot (min)"
								placeholder="20"
								min={5}
								max={240}
								disabled={isSubmitting}
								{...form.getInputProps("slotDurationMinutes")}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
							<NumberInput
								label="Buffer (min)"
								placeholder="0"
								min={0}
								max={60}
								disabled={isSubmitting}
								{...form.getInputProps("bufferMinutes")}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
							<NumberInput
								label="Capacidad máxima"
								placeholder="Ilimitada"
								min={1}
								disabled={isSubmitting}
								{...form.getInputProps("slotCapacityLimit")}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
							<TimePicker
								label="Inicio mañana"
								withDropdown
								minutesStep={5}
								clearable
								disabled={isSubmitting}
								value={form.values.morningStart}
								onChange={(value) =>
									form.setFieldValue("morningStart", value)
								}
								error={form.errors.morningStart}
								{...TIME_PICKER_LABELS}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
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
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
							<TimePicker
								label="Inicio tarde"
								withDropdown
								minutesStep={5}
								clearable
								disabled={isSubmitting}
								value={form.values.afternoonStart}
								onChange={(value) =>
									form.setFieldValue("afternoonStart", value)
								}
								error={form.errors.afternoonStart}
								{...TIME_PICKER_LABELS}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
							<TimePicker
								label="Fin tarde"
								withDropdown
								minutesStep={5}
								clearable
								disabled={isSubmitting}
								value={form.values.afternoonEnd}
								onChange={(value) =>
									form.setFieldValue("afternoonEnd", value)
								}
								error={form.errors.afternoonEnd}
								{...TIME_PICKER_LABELS}
							/>
						</Grid.Col>
						<Grid.Col span={12}>
							<TextInput
								label="Notas"
								placeholder="Notas opcionales sobre este template..."
								disabled={isSubmitting}
								{...form.getInputProps("notes")}
							/>
						</Grid.Col>
						<Grid.Col span={12}>
							<Checkbox
								label="Habilitado"
								description="Activar este template"
								disabled={isSubmitting}
								{...form.getInputProps("isEnabled", { type: "checkbox" })}
							/>
						</Grid.Col>
					</Grid>

					<FormActions align="right">
						<FormActionButton
							variant="secondary"
							type="button"
							onClick={handleClose}
							disabled={isSubmitting}
						>
							Cancelar
						</FormActionButton>
						<FormActionButton
							variant="primary"
							type="submit"
							isLoading={isSubmitting}
						>
							{mode === "edit" ? "Guardar cambios" : "Crear plantilla"}
						</FormActionButton>
					</FormActions>
				</Stack>
			</form>
		</PremiumModal>
	);
}
