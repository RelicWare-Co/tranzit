import {
	Alert,
	Button,
	Checkbox,
	Grid,
	Group,
	Loader,
	NumberInput,
	Paper,
	Select,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { orpcClient } from "../../../lib/orpc-client";
import { AdminPageHeader } from "../_shared/AdminPageHeader";
import { getErrorMessage } from "../_shared/errors";

const CONFIG_SNAPSHOT_QUERY_KEY = [
	"admin",
	"configuracion",
	"snapshot",
] as const;

const weekdayLabels: Record<number, string> = {
	0: "Domingo",
	1: "Lunes",
	2: "Martes",
	3: "Miércoles",
	4: "Jueves",
	5: "Viernes",
	6: "Sábado",
};

async function fetchConfigurationSnapshot() {
	const [templates, overrides, staff] = await Promise.all([
		orpcClient.admin.schedule.templates.list(),
		orpcClient.admin.schedule.overrides.list({}),
		orpcClient.admin.staff.list({}),
	]);

	return { templates, overrides, staff };
}

type ConfigSnapshot = Awaited<ReturnType<typeof fetchConfigurationSnapshot>>;
type ScheduleTemplate = ConfigSnapshot["templates"][number];
type CalendarOverride = ConfigSnapshot["overrides"][number];

async function fetchStaffOverrides(userId: string) {
	return await orpcClient.admin.staff.dateOverrides.list({ userId });
}

type StaffDateOverride = Awaited<
	ReturnType<typeof fetchStaffOverrides>
>[number];

function parseOptionalNumber(value: string): number | undefined {
	if (!value.trim()) return undefined;
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		throw new Error("Valor numérico inválido.");
	}
	return parsed;
}

function parseOptionalNumberOrNull(value: string): number | null | undefined {
	if (value.trim() === "") return null;
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		throw new Error("Valor numérico inválido.");
	}
	return parsed;
}

function asNullableText(value: string): string | null {
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

export function AdminConfiguracionPage() {
	const queryClient = useQueryClient();

	const [globalError, setGlobalError] = useState<string | null>(null);
	const [globalNotice, setGlobalNotice] = useState<string | null>(null);
	const [slotGenerationSummary, setSlotGenerationSummary] = useState<
		unknown | null
	>(null);
	const [availabilityResult, setAvailabilityResult] = useState<unknown | null>(
		null,
	);
	const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

	const [selectedStaffUserId, setSelectedStaffUserId] = useState<string | null>(
		null,
	);

	const [templateForm, setTemplateForm] = useState({
		id: "",
		weekday: "1",
		slotDurationMinutes: "20",
		bufferMinutes: "0",
		slotCapacityLimit: "",
		isEnabled: true,
		morningStart: "",
		morningEnd: "",
		afternoonStart: "",
		afternoonEnd: "",
		notes: "",
	});

	const [overrideForm, setOverrideForm] = useState({
		id: "",
		overrideDate: "",
		isClosed: false,
		morningEnabled: true,
		afternoonEnabled: true,
		morningStart: "",
		morningEnd: "",
		afternoonStart: "",
		afternoonEnd: "",
		slotDurationMinutes: "",
		bufferMinutes: "",
		slotCapacityLimit: "",
		reason: "",
	});

	const [slotGenerationForm, setSlotGenerationForm] = useState({
		dateFrom: "",
		dateTo: "",
		maxDays: "31",
	});

	const [staffOverrideForm, setStaffOverrideForm] = useState({
		overrideId: "",
		overrideDate: "",
		isAvailable: true,
		capacityOverride: "",
		availableStartTime: "",
		availableEndTime: "",
		notes: "",
	});

	const [availabilityDate, setAvailabilityDate] = useState("");

	const snapshotQuery = useQuery({
		queryKey: CONFIG_SNAPSHOT_QUERY_KEY,
		queryFn: fetchConfigurationSnapshot,
	});

	const staffOverridesQuery = useQuery({
		queryKey: [
			"admin",
			"configuracion",
			"staff-overrides",
			selectedStaffUserId,
		],
		enabled: Boolean(selectedStaffUserId),
		queryFn: async () => await fetchStaffOverrides(selectedStaffUserId ?? ""),
	});

	const refreshAll = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: CONFIG_SNAPSHOT_QUERY_KEY }),
			queryClient.invalidateQueries({
				queryKey: [
					"admin",
					"configuracion",
					"staff-overrides",
					selectedStaffUserId,
				],
			}),
		]);
	}, [queryClient, selectedStaffUserId]);

	const staffOptions = useMemo(
		() =>
			(snapshotQuery.data?.staff ?? []).map((staff) => ({
				value: staff.userId,
				label: staff.user?.name || staff.user?.email || staff.userId,
			})),
		[snapshotQuery.data?.staff],
	);

	useEffect(() => {
		if (!snapshotQuery.data?.staff.length) {
			setSelectedStaffUserId(null);
			return;
		}

		if (
			!selectedStaffUserId ||
			!snapshotQuery.data.staff.some(
				(staff) => staff.userId === selectedStaffUserId,
			)
		) {
			setSelectedStaffUserId(snapshotQuery.data.staff[0]?.userId ?? null);
		}
	}, [snapshotQuery.data?.staff, selectedStaffUserId]);

	const clearAlerts = () => {
		setGlobalError(null);
		setGlobalNotice(null);
	};

	const handleMutationError = (error: unknown, fallback: string) => {
		setGlobalError(getErrorMessage(error, fallback));
	};

	const resetTemplateForm = () => {
		setTemplateForm({
			id: "",
			weekday: "1",
			slotDurationMinutes: "20",
			bufferMinutes: "0",
			slotCapacityLimit: "",
			isEnabled: true,
			morningStart: "",
			morningEnd: "",
			afternoonStart: "",
			afternoonEnd: "",
			notes: "",
		});
	};

	const resetOverrideForm = () => {
		setOverrideForm({
			id: "",
			overrideDate: "",
			isClosed: false,
			morningEnabled: true,
			afternoonEnabled: true,
			morningStart: "",
			morningEnd: "",
			afternoonStart: "",
			afternoonEnd: "",
			slotDurationMinutes: "",
			bufferMinutes: "",
			slotCapacityLimit: "",
			reason: "",
		});
	};

	const resetStaffOverrideForm = () => {
		setStaffOverrideForm({
			overrideId: "",
			overrideDate: "",
			isAvailable: true,
			capacityOverride: "",
			availableStartTime: "",
			availableEndTime: "",
			notes: "",
		});
	};

	const submitTemplate = async () => {
		clearAlerts();
		setIsSubmitting("template");
		try {
			const weekday = Number(templateForm.weekday);
			const slotDurationMinutes = Number(templateForm.slotDurationMinutes);
			if (!Number.isInteger(weekday)) {
				throw new Error("weekday debe ser un entero válido.");
			}
			if (!Number.isInteger(slotDurationMinutes) || slotDurationMinutes <= 0) {
				throw new Error("slotDurationMinutes debe ser un entero positivo.");
			}

			const payload = {
				weekday,
				slotDurationMinutes,
				bufferMinutes: parseOptionalNumber(templateForm.bufferMinutes),
				slotCapacityLimit: parseOptionalNumberOrNull(
					templateForm.slotCapacityLimit,
				),
				isEnabled: templateForm.isEnabled,
				morningStart: asNullableText(templateForm.morningStart),
				morningEnd: asNullableText(templateForm.morningEnd),
				afternoonStart: asNullableText(templateForm.afternoonStart),
				afternoonEnd: asNullableText(templateForm.afternoonEnd),
				notes: asNullableText(templateForm.notes),
			};

			if (templateForm.id) {
				await orpcClient.admin.schedule.templates.update({
					id: templateForm.id,
					...payload,
				});
				setGlobalNotice("Template actualizado.");
			} else {
				await orpcClient.admin.schedule.templates.create(payload);
				setGlobalNotice("Template creado.");
			}

			resetTemplateForm();
			await refreshAll();
		} catch (error) {
			handleMutationError(error, "No se pudo guardar el template.");
		} finally {
			setIsSubmitting(null);
		}
	};

	const editTemplate = (template: ScheduleTemplate) => {
		setTemplateForm({
			id: template.id,
			weekday: String(template.weekday),
			slotDurationMinutes: String(template.slotDurationMinutes),
			bufferMinutes: String(template.bufferMinutes),
			slotCapacityLimit:
				template.slotCapacityLimit === null
					? ""
					: String(template.slotCapacityLimit),
			isEnabled: template.isEnabled,
			morningStart: template.morningStart ?? "",
			morningEnd: template.morningEnd ?? "",
			afternoonStart: template.afternoonStart ?? "",
			afternoonEnd: template.afternoonEnd ?? "",
			notes: template.notes ?? "",
		});
	};

	const removeTemplate = async (id: string) => {
		if (!window.confirm("¿Eliminar este template de agenda?")) return;
		clearAlerts();
		setIsSubmitting(`remove-template-${id}`);
		try {
			await orpcClient.admin.schedule.templates.remove({ id });
			if (templateForm.id === id) {
				resetTemplateForm();
			}
			setGlobalNotice("Template eliminado.");
			await refreshAll();
		} catch (error) {
			handleMutationError(error, "No se pudo eliminar el template.");
		} finally {
			setIsSubmitting(null);
		}
	};

	const submitOverride = async () => {
		clearAlerts();
		setIsSubmitting("override");
		try {
			if (!overrideForm.overrideDate) {
				throw new Error("overrideDate es obligatorio.");
			}

			const payload = {
				overrideDate: overrideForm.overrideDate,
				isClosed: overrideForm.isClosed,
				morningEnabled: overrideForm.morningEnabled,
				afternoonEnabled: overrideForm.afternoonEnabled,
				morningStart: asNullableText(overrideForm.morningStart),
				morningEnd: asNullableText(overrideForm.morningEnd),
				afternoonStart: asNullableText(overrideForm.afternoonStart),
				afternoonEnd: asNullableText(overrideForm.afternoonEnd),
				slotDurationMinutes: parseOptionalNumberOrNull(
					overrideForm.slotDurationMinutes,
				),
				bufferMinutes: parseOptionalNumberOrNull(overrideForm.bufferMinutes),
				slotCapacityLimit: parseOptionalNumberOrNull(
					overrideForm.slotCapacityLimit,
				),
				reason: asNullableText(overrideForm.reason),
			};

			if (overrideForm.id) {
				await orpcClient.admin.schedule.overrides.update({
					id: overrideForm.id,
					...payload,
				});
				setGlobalNotice("Override actualizado.");
			} else {
				await orpcClient.admin.schedule.overrides.create(payload);
				setGlobalNotice("Override creado.");
			}

			resetOverrideForm();
			await refreshAll();
		} catch (error) {
			handleMutationError(error, "No se pudo guardar el override.");
		} finally {
			setIsSubmitting(null);
		}
	};

	const editOverride = (override: CalendarOverride) => {
		setOverrideForm({
			id: override.id,
			overrideDate: override.overrideDate,
			isClosed: override.isClosed,
			morningEnabled: override.morningEnabled,
			afternoonEnabled: override.afternoonEnabled,
			morningStart: override.morningStart ?? "",
			morningEnd: override.morningEnd ?? "",
			afternoonStart: override.afternoonStart ?? "",
			afternoonEnd: override.afternoonEnd ?? "",
			slotDurationMinutes:
				override.slotDurationMinutes === null
					? ""
					: String(override.slotDurationMinutes),
			bufferMinutes:
				override.bufferMinutes === null ? "" : String(override.bufferMinutes),
			slotCapacityLimit:
				override.slotCapacityLimit === null
					? ""
					: String(override.slotCapacityLimit),
			reason: override.reason ?? "",
		});
	};

	const removeOverride = async (id: string) => {
		if (!window.confirm("¿Eliminar este override de calendario?")) return;
		clearAlerts();
		setIsSubmitting(`remove-override-${id}`);
		try {
			await orpcClient.admin.schedule.overrides.remove({ id });
			if (overrideForm.id === id) {
				resetOverrideForm();
			}
			setGlobalNotice("Override eliminado.");
			await refreshAll();
		} catch (error) {
			handleMutationError(error, "No se pudo eliminar el override.");
		} finally {
			setIsSubmitting(null);
		}
	};

	const generateSlots = async () => {
		clearAlerts();
		setIsSubmitting("generate-slots");
		setSlotGenerationSummary(null);
		try {
			if (!slotGenerationForm.dateFrom || !slotGenerationForm.dateTo) {
				throw new Error("dateFrom y dateTo son obligatorios.");
			}

			const maxDaysValue = Number(slotGenerationForm.maxDays);
			const response = await orpcClient.admin.schedule.slots.generate({
				dateFrom: slotGenerationForm.dateFrom,
				dateTo: slotGenerationForm.dateTo,
				maxDays: Number.isFinite(maxDaysValue) ? maxDaysValue : undefined,
			});

			setSlotGenerationSummary(response);
			setGlobalNotice("Generación de slots ejecutada.");
			await refreshAll();
		} catch (error) {
			handleMutationError(error, "No se pudieron generar los slots.");
		} finally {
			setIsSubmitting(null);
		}
	};

	const submitStaffOverride = async () => {
		if (!selectedStaffUserId) {
			setGlobalError("Selecciona un funcionario.");
			return;
		}

		clearAlerts();
		setIsSubmitting("staff-override");
		try {
			if (!staffOverrideForm.overrideDate) {
				throw new Error("La fecha del override es obligatoria.");
			}

			const payload = {
				overrideDate: staffOverrideForm.overrideDate,
				isAvailable: staffOverrideForm.isAvailable,
				capacityOverride: parseOptionalNumber(
					staffOverrideForm.capacityOverride,
				),
				availableStartTime: asNullableText(
					staffOverrideForm.availableStartTime,
				),
				availableEndTime: asNullableText(staffOverrideForm.availableEndTime),
				notes: asNullableText(staffOverrideForm.notes),
			};

			if (staffOverrideForm.overrideId) {
				await orpcClient.admin.staff.dateOverrides.update({
					userId: selectedStaffUserId,
					overrideId: staffOverrideForm.overrideId,
					...payload,
				});
				setGlobalNotice("Override de funcionario actualizado.");
			} else {
				await orpcClient.admin.staff.dateOverrides.create({
					userId: selectedStaffUserId,
					...payload,
				});
				setGlobalNotice("Override de funcionario creado.");
			}

			resetStaffOverrideForm();
			await refreshAll();
		} catch (error) {
			handleMutationError(
				error,
				"No se pudo guardar el override de funcionario.",
			);
		} finally {
			setIsSubmitting(null);
		}
	};

	const editStaffOverride = (override: StaffDateOverride) => {
		setStaffOverrideForm({
			overrideId: override.id,
			overrideDate: override.overrideDate,
			isAvailable: override.isAvailable,
			capacityOverride:
				override.capacityOverride === null
					? ""
					: String(override.capacityOverride),
			availableStartTime: override.availableStartTime ?? "",
			availableEndTime: override.availableEndTime ?? "",
			notes: override.notes ?? "",
		});
	};

	const removeStaffOverride = async (overrideId: string) => {
		if (!selectedStaffUserId) return;
		if (!window.confirm("¿Eliminar este override de funcionario?")) return;

		clearAlerts();
		setIsSubmitting(`remove-staff-override-${overrideId}`);
		try {
			await orpcClient.admin.staff.dateOverrides.remove({
				userId: selectedStaffUserId,
				overrideId,
			});

			if (staffOverrideForm.overrideId === overrideId) {
				resetStaffOverrideForm();
			}
			setGlobalNotice("Override de funcionario eliminado.");
			await refreshAll();
		} catch (error) {
			handleMutationError(
				error,
				"No se pudo eliminar el override de funcionario.",
			);
		} finally {
			setIsSubmitting(null);
		}
	};

	const checkEffectiveAvailability = async () => {
		if (!selectedStaffUserId || !availabilityDate) {
			setGlobalError(
				"Selecciona funcionario y fecha para consultar disponibilidad.",
			);
			return;
		}

		clearAlerts();
		setIsSubmitting("effective-availability");
		setAvailabilityResult(null);
		try {
			const response = await orpcClient.admin.staff.effectiveAvailability({
				userId: selectedStaffUserId,
				date: availabilityDate,
			});
			setAvailabilityResult(response);
		} catch (error) {
			handleMutationError(
				error,
				"No se pudo consultar la disponibilidad efectiva.",
			);
		} finally {
			setIsSubmitting(null);
		}
	};

	return (
		<Stack gap="xl">
			<AdminPageHeader
				title="Configuración operativa"
				description="Agenda base, excepciones de calendario y disponibilidad puntual de funcionarios."
				actions={
					<Button
						leftSection={<RefreshCw size={16} />}
						onClick={() => void refreshAll()}
						variant="light"
					>
						Refrescar
					</Button>
				}
			/>

			{snapshotQuery.isPending ? (
				<Group justify="center" py="xl">
					<Loader size="sm" />
				</Group>
			) : null}

			{globalError ? (
				<Alert color="red" icon={<AlertCircle size={16} />}>
					{globalError}
				</Alert>
			) : null}

			{globalNotice ? (
				<Alert color="teal" icon={<CheckCircle2 size={16} />}>
					{globalNotice}
				</Alert>
			) : null}

			{snapshotQuery.isError ? (
				<Alert color="red" icon={<AlertCircle size={16} />}>
					{getErrorMessage(
						snapshotQuery.error,
						"No se pudo cargar la configuración",
					)}
				</Alert>
			) : null}

			<Paper withBorder p="md">
				<Stack>
					<Title order={4}>Templates de agenda</Title>
					<Grid>
						<Grid.Col span={{ base: 12, sm: 3 }}>
							<NumberInput
								label="Día (0-6)"
								value={templateForm.weekday}
								onChange={(value) =>
									setTemplateForm((prev) => ({
										...prev,
										weekday: String(value ?? ""),
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 3 }}>
							<NumberInput
								label="Duración slot"
								value={templateForm.slotDurationMinutes}
								onChange={(value) =>
									setTemplateForm((prev) => ({
										...prev,
										slotDurationMinutes: String(value ?? ""),
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 3 }}>
							<NumberInput
								label="Buffer"
								value={templateForm.bufferMinutes}
								onChange={(value) =>
									setTemplateForm((prev) => ({
										...prev,
										bufferMinutes: String(value ?? ""),
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 3 }}>
							<NumberInput
								label="Capacidad slot"
								value={templateForm.slotCapacityLimit}
								onChange={(value) =>
									setTemplateForm((prev) => ({
										...prev,
										slotCapacityLimit: String(value ?? ""),
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 3 }}>
							<TextInput
								label="Mañana inicio"
								placeholder="07:00"
								value={templateForm.morningStart}
								onChange={(event) =>
									setTemplateForm((prev) => ({
										...prev,
										morningStart: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 3 }}>
							<TextInput
								label="Mañana fin"
								placeholder="12:00"
								value={templateForm.morningEnd}
								onChange={(event) =>
									setTemplateForm((prev) => ({
										...prev,
										morningEnd: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 3 }}>
							<TextInput
								label="Tarde inicio"
								placeholder="13:00"
								value={templateForm.afternoonStart}
								onChange={(event) =>
									setTemplateForm((prev) => ({
										...prev,
										afternoonStart: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 3 }}>
							<TextInput
								label="Tarde fin"
								placeholder="17:00"
								value={templateForm.afternoonEnd}
								onChange={(event) =>
									setTemplateForm((prev) => ({
										...prev,
										afternoonEnd: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={12}>
							<TextInput
								label="Notas"
								value={templateForm.notes}
								onChange={(event) =>
									setTemplateForm((prev) => ({
										...prev,
										notes: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={12}>
							<Group justify="space-between">
								<Checkbox
									label="Habilitado"
									checked={templateForm.isEnabled}
									onChange={(event) =>
										setTemplateForm((prev) => ({
											...prev,
											isEnabled: event.currentTarget.checked,
										}))
									}
								/>
								<Group>
									<Button
										variant="default"
										onClick={resetTemplateForm}
										disabled={!templateForm.id}
									>
										Cancelar edición
									</Button>
									<Button
										loading={isSubmitting === "template"}
										onClick={() => void submitTemplate()}
									>
										{templateForm.id ? "Actualizar" : "Crear"}
									</Button>
								</Group>
							</Group>
						</Grid.Col>
					</Grid>

					<Table.ScrollContainer minWidth={780}>
						<Table striped withTableBorder withColumnBorders>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Día</Table.Th>
									<Table.Th>Duración</Table.Th>
									<Table.Th>Buffer</Table.Th>
									<Table.Th>Capacidad</Table.Th>
									<Table.Th>Ventanas</Table.Th>
									<Table.Th>Estado</Table.Th>
									<Table.Th>Acciones</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{(snapshotQuery.data?.templates ?? []).map((template) => (
									<Table.Tr key={template.id}>
										<Table.Td>
											{weekdayLabels[template.weekday] ?? template.weekday}
										</Table.Td>
										<Table.Td>{template.slotDurationMinutes}</Table.Td>
										<Table.Td>{template.bufferMinutes}</Table.Td>
										<Table.Td>{template.slotCapacityLimit ?? "-"}</Table.Td>
										<Table.Td>
											{template.morningStart ?? "--"} -{" "}
											{template.morningEnd ?? "--"}
											{" / "}
											{template.afternoonStart ?? "--"} -{" "}
											{template.afternoonEnd ?? "--"}
										</Table.Td>
										<Table.Td>
											{template.isEnabled ? "Activo" : "Inactivo"}
										</Table.Td>
										<Table.Td>
											<Group gap="xs">
												<Button
													variant="light"
													size="xs"
													onClick={() => editTemplate(template)}
												>
													Editar
												</Button>
												<Button
													variant="light"
													color="red"
													size="xs"
													loading={
														isSubmitting === `remove-template-${template.id}`
													}
													onClick={() => void removeTemplate(template.id)}
												>
													Eliminar
												</Button>
											</Group>
										</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
					</Table.ScrollContainer>
				</Stack>
			</Paper>

			<Paper withBorder p="md">
				<Stack>
					<Title order={4}>Overrides de calendario</Title>
					<Grid>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<TextInput
								label="Fecha"
								type="date"
								value={overrideForm.overrideDate}
								onChange={(event) =>
									setOverrideForm((prev) => ({
										...prev,
										overrideDate: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<NumberInput
								label="Duración slot"
								value={overrideForm.slotDurationMinutes}
								onChange={(value) =>
									setOverrideForm((prev) => ({
										...prev,
										slotDurationMinutes: String(value ?? ""),
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<NumberInput
								label="Buffer"
								value={overrideForm.bufferMinutes}
								onChange={(value) =>
									setOverrideForm((prev) => ({
										...prev,
										bufferMinutes: String(value ?? ""),
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<NumberInput
								label="Capacidad"
								value={overrideForm.slotCapacityLimit}
								onChange={(value) =>
									setOverrideForm((prev) => ({
										...prev,
										slotCapacityLimit: String(value ?? ""),
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<TextInput
								label="Mañana inicio"
								placeholder="07:00"
								value={overrideForm.morningStart}
								onChange={(event) =>
									setOverrideForm((prev) => ({
										...prev,
										morningStart: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<TextInput
								label="Mañana fin"
								placeholder="12:00"
								value={overrideForm.morningEnd}
								onChange={(event) =>
									setOverrideForm((prev) => ({
										...prev,
										morningEnd: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<TextInput
								label="Tarde inicio"
								placeholder="13:00"
								value={overrideForm.afternoonStart}
								onChange={(event) =>
									setOverrideForm((prev) => ({
										...prev,
										afternoonStart: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<TextInput
								label="Tarde fin"
								placeholder="17:00"
								value={overrideForm.afternoonEnd}
								onChange={(event) =>
									setOverrideForm((prev) => ({
										...prev,
										afternoonEnd: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<Checkbox
								label="Día cerrado"
								checked={overrideForm.isClosed}
								onChange={(event) =>
									setOverrideForm((prev) => ({
										...prev,
										isClosed: event.currentTarget.checked,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<Checkbox
								label="Mañana habilitada"
								checked={overrideForm.morningEnabled}
								onChange={(event) =>
									setOverrideForm((prev) => ({
										...prev,
										morningEnabled: event.currentTarget.checked,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<Checkbox
								label="Tarde habilitada"
								checked={overrideForm.afternoonEnabled}
								onChange={(event) =>
									setOverrideForm((prev) => ({
										...prev,
										afternoonEnabled: event.currentTarget.checked,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={12}>
							<TextInput
								label="Razón"
								value={overrideForm.reason}
								onChange={(event) =>
									setOverrideForm((prev) => ({
										...prev,
										reason: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={12}>
							<Group justify="flex-end">
								<Button
									variant="default"
									onClick={resetOverrideForm}
									disabled={!overrideForm.id}
								>
									Cancelar edición
								</Button>
								<Button
									loading={isSubmitting === "override"}
									onClick={() => void submitOverride()}
								>
									{overrideForm.id ? "Actualizar" : "Crear"}
								</Button>
							</Group>
						</Grid.Col>
					</Grid>

					<Table.ScrollContainer minWidth={820}>
						<Table striped withTableBorder withColumnBorders>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Fecha</Table.Th>
									<Table.Th>Cerrado</Table.Th>
									<Table.Th>Duración</Table.Th>
									<Table.Th>Capacidad</Table.Th>
									<Table.Th>Razón</Table.Th>
									<Table.Th>Acciones</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{(snapshotQuery.data?.overrides ?? []).map((override) => (
									<Table.Tr key={override.id}>
										<Table.Td>{override.overrideDate}</Table.Td>
										<Table.Td>{override.isClosed ? "Sí" : "No"}</Table.Td>
										<Table.Td>{override.slotDurationMinutes ?? "-"}</Table.Td>
										<Table.Td>{override.slotCapacityLimit ?? "-"}</Table.Td>
										<Table.Td>{override.reason ?? "-"}</Table.Td>
										<Table.Td>
											<Group gap="xs">
												<Button
													variant="light"
													size="xs"
													onClick={() => editOverride(override)}
												>
													Editar
												</Button>
												<Button
													variant="light"
													color="red"
													size="xs"
													loading={
														isSubmitting === `remove-override-${override.id}`
													}
													onClick={() => void removeOverride(override.id)}
												>
													Eliminar
												</Button>
											</Group>
										</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
					</Table.ScrollContainer>
				</Stack>
			</Paper>

			<Paper withBorder p="md">
				<Stack>
					<Title order={4}>Generación de slots</Title>
					<Grid>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<TextInput
								label="Desde"
								type="date"
								value={slotGenerationForm.dateFrom}
								onChange={(event) =>
									setSlotGenerationForm((prev) => ({
										...prev,
										dateFrom: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<TextInput
								label="Hasta"
								type="date"
								value={slotGenerationForm.dateTo}
								onChange={(event) =>
									setSlotGenerationForm((prev) => ({
										...prev,
										dateTo: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<NumberInput
								label="Max días"
								value={slotGenerationForm.maxDays}
								onChange={(value) =>
									setSlotGenerationForm((prev) => ({
										...prev,
										maxDays: String(value ?? ""),
									}))
								}
							/>
						</Grid.Col>
					</Grid>
					<Group justify="flex-end">
						<Button
							loading={isSubmitting === "generate-slots"}
							onClick={() => void generateSlots()}
						>
							Generar slots
						</Button>
					</Group>
					{slotGenerationSummary ? (
						<Alert color="blue" variant="light">
							<Text component="pre" fz="xs" style={{ whiteSpace: "pre-wrap" }}>
								{JSON.stringify(slotGenerationSummary, null, 2)}
							</Text>
						</Alert>
					) : null}
				</Stack>
			</Paper>

			<Paper withBorder p="md">
				<Stack>
					<Title order={4}>Disponibilidad por funcionario</Title>
					<Select
						label="Funcionario"
						placeholder="Selecciona funcionario"
						value={selectedStaffUserId}
						onChange={setSelectedStaffUserId}
						data={staffOptions}
					/>

					{selectedStaffUserId ? (
						<>
							<Grid>
								<Grid.Col span={{ base: 12, sm: 4 }}>
									<TextInput
										label="Fecha override"
										type="date"
										value={staffOverrideForm.overrideDate}
										onChange={(event) =>
											setStaffOverrideForm((prev) => ({
												...prev,
												overrideDate: event.currentTarget.value,
											}))
										}
									/>
								</Grid.Col>
								<Grid.Col span={{ base: 12, sm: 4 }}>
									<NumberInput
										label="Capacidad override"
										value={staffOverrideForm.capacityOverride}
										onChange={(value) =>
											setStaffOverrideForm((prev) => ({
												...prev,
												capacityOverride: String(value ?? ""),
											}))
										}
									/>
								</Grid.Col>
								<Grid.Col span={{ base: 12, sm: 4 }}>
									<Checkbox
										label="Disponible"
										checked={staffOverrideForm.isAvailable}
										onChange={(event) =>
											setStaffOverrideForm((prev) => ({
												...prev,
												isAvailable: event.currentTarget.checked,
											}))
										}
									/>
								</Grid.Col>
								<Grid.Col span={{ base: 12, sm: 4 }}>
									<TextInput
										label="Hora inicio"
										placeholder="08:00"
										value={staffOverrideForm.availableStartTime}
										onChange={(event) =>
											setStaffOverrideForm((prev) => ({
												...prev,
												availableStartTime: event.currentTarget.value,
											}))
										}
									/>
								</Grid.Col>
								<Grid.Col span={{ base: 12, sm: 4 }}>
									<TextInput
										label="Hora fin"
										placeholder="17:00"
										value={staffOverrideForm.availableEndTime}
										onChange={(event) =>
											setStaffOverrideForm((prev) => ({
												...prev,
												availableEndTime: event.currentTarget.value,
											}))
										}
									/>
								</Grid.Col>
								<Grid.Col span={{ base: 12, sm: 4 }}>
									<TextInput
										label="Notas"
										value={staffOverrideForm.notes}
										onChange={(event) =>
											setStaffOverrideForm((prev) => ({
												...prev,
												notes: event.currentTarget.value,
											}))
										}
									/>
								</Grid.Col>
							</Grid>

							<Group justify="flex-end">
								<Button
									variant="default"
									onClick={resetStaffOverrideForm}
									disabled={!staffOverrideForm.overrideId}
								>
									Cancelar edición
								</Button>
								<Button
									loading={isSubmitting === "staff-override"}
									onClick={() => void submitStaffOverride()}
								>
									{staffOverrideForm.overrideId ? "Actualizar" : "Crear"}
								</Button>
							</Group>

							{staffOverridesQuery.isLoading ? (
								<Group justify="center" py="md">
									<Loader size="sm" />
								</Group>
							) : null}

							{staffOverridesQuery.isError ? (
								<Alert color="red" icon={<AlertCircle size={16} />}>
									{getErrorMessage(
										staffOverridesQuery.error,
										"No se pudieron cargar los overrides del funcionario",
									)}
								</Alert>
							) : null}

							<Table.ScrollContainer minWidth={780}>
								<Table striped withTableBorder withColumnBorders>
									<Table.Thead>
										<Table.Tr>
											<Table.Th>Fecha</Table.Th>
											<Table.Th>Disponible</Table.Th>
											<Table.Th>Capacidad</Table.Th>
											<Table.Th>Ventana</Table.Th>
											<Table.Th>Notas</Table.Th>
											<Table.Th>Acciones</Table.Th>
										</Table.Tr>
									</Table.Thead>
									<Table.Tbody>
										{(staffOverridesQuery.data ?? []).map((override) => (
											<Table.Tr key={override.id}>
												<Table.Td>{override.overrideDate}</Table.Td>
												<Table.Td>
													{override.isAvailable ? "Sí" : "No"}
												</Table.Td>
												<Table.Td>{override.capacityOverride ?? "-"}</Table.Td>
												<Table.Td>
													{override.availableStartTime ?? "--"} -{" "}
													{override.availableEndTime ?? "--"}
												</Table.Td>
												<Table.Td>{override.notes ?? "-"}</Table.Td>
												<Table.Td>
													<Group gap="xs">
														<Button
															variant="light"
															size="xs"
															onClick={() => editStaffOverride(override)}
														>
															Editar
														</Button>
														<Button
															variant="light"
															color="red"
															size="xs"
															loading={
																isSubmitting ===
																`remove-staff-override-${override.id}`
															}
															onClick={() =>
																void removeStaffOverride(override.id)
															}
														>
															Eliminar
														</Button>
													</Group>
												</Table.Td>
											</Table.Tr>
										))}
									</Table.Tbody>
								</Table>
							</Table.ScrollContainer>

							<Title order={5}>Disponibilidad efectiva</Title>
							<Group align="flex-end">
								<TextInput
									label="Fecha"
									type="date"
									value={availabilityDate}
									onChange={(event) =>
										setAvailabilityDate(event.currentTarget.value)
									}
								/>
								<Button
									loading={isSubmitting === "effective-availability"}
									onClick={() => void checkEffectiveAvailability()}
								>
									Consultar
								</Button>
							</Group>
							{availabilityResult ? (
								<Alert color="blue" variant="light">
									<Text
										component="pre"
										fz="xs"
										style={{ whiteSpace: "pre-wrap" }}
									>
										{JSON.stringify(availabilityResult, null, 2)}
									</Text>
								</Alert>
							) : null}
						</>
					) : (
						<Text c="dimmed" size="sm">
							No hay funcionarios disponibles para configuración.
						</Text>
					)}
				</Stack>
			</Paper>
		</Stack>
	);
}
