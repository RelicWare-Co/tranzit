import {
	Badge,
	Button,
	Grid,
	Group,
	NumberInput,
	Paper,
	Select,
	Table,
	TextInput,
	Checkbox,
	Tooltip,
	ActionIcon,
} from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "#/features/admin/components/ui/EmptyState";
import { StatusBadge } from "#/features/admin/components/ui/StatusBadge";
import { TableSkeleton } from "#/features/admin/components/ui/TableSkeleton";
import { weekdayColors, weekdayLabels, validateTime } from "#/features/admin/components/configuracion/constants";
import type { ScheduleTemplate } from "#/features/admin/components/hooks/useConfigSnapshot";
import { useConfigMutations } from "#/features/admin/components/hooks/useConfigMutations";

interface TemplateSectionProps {
	templates: ScheduleTemplate[];
	isLoading: boolean;
	onRefresh: () => Promise<void>;
}

export function TemplateSection({
	templates,
	isLoading,
	onRefresh,
}: TemplateSectionProps) {
	const mutations = useConfigMutations({ onSuccess: onRefresh });
	const [editingId, setEditingId] = useState<string | null>(null);

	const form = useForm({
		initialValues: {
			id: "",
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
		},
		validate: {
			weekday: (value) =>
				value < 0 || value > 6 ? "Día inválido (0-6)" : null,
			slotDurationMinutes: (value) =>
				value < 5 || value > 240 ? "Debe estar entre 5 y 240 min" : null,
			bufferMinutes: (value) =>
				value < 0 || value > 60 ? "Debe estar entre 0 y 60 min" : null,
			slotCapacityLimit: (value) =>
				value !== undefined && value < 1 ? "Debe ser mayor a 0" : null,
			morningStart: (value) => validateTime(value, "Hora inicio mañana"),
			morningEnd: (value) => validateTime(value, "Hora fin mañana"),
			afternoonStart: (value) => validateTime(value, "Hora inicio tarde"),
			afternoonEnd: (value) => validateTime(value, "Hora fin tarde"),
		},
	});

	const isEditing = !!editingId;

	const resetForm = () => {
		form.reset();
		setEditingId(null);
	};

	const handleSubmit = async () => {
		const validation = form.validate();
		if (validation.hasErrors) return;

		const values = form.values;
		const payload = {
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
		};

		if (editingId) {
			await mutations.updateTemplate(editingId, payload);
		} else {
			await mutations.createTemplate(payload);
		}
		resetForm();
	};

	const handleEdit = (template: ScheduleTemplate) => {
		setEditingId(template.id);
		form.setValues({
			id: template.id,
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
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const handleDelete = async (template: ScheduleTemplate) => {
		if (!window.confirm(`¿Eliminar template de ${weekdayLabels[template.weekday]}?`)) return;
		if (editingId === template.id) resetForm();
		await mutations.removeTemplate(template.id);
	};

	return (
		<div className="space-y-6">
			<Paper
				withBorder
				className={`p-5 rounded-xl border-zinc-200/60 ${isEditing ? "bg-amber-50/30 border-amber-200/60" : "bg-zinc-50/50"}`}
			>
				{isEditing && (
					<Group gap={6} className="mb-4">
						<Badge color="amber" variant="light" radius="sm">
							<Edit3 size={12} className="mr-1" />
							Editando template
						</Badge>
					</Group>
				)}
				<Grid>
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<Select
							label="Día de la semana"
							placeholder="Selecciona"
							data={Object.entries(weekdayLabels).map(([value, label]) => ({
								value,
								label,
							}))}
							{...form.getInputProps("weekday")}
						/>
					</Grid.Col>
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<NumberInput
							label="Duración del slot (min)"
							placeholder="20"
							min={5}
							max={240}
							{...form.getInputProps("slotDurationMinutes")}
						/>
					</Grid.Col>
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<NumberInput
							label="Buffer (min)"
							placeholder="0"
							min={0}
							max={60}
							{...form.getInputProps("bufferMinutes")}
						/>
					</Grid.Col>
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<NumberInput
							label="Capacidad máxima"
							placeholder="Ilimitada"
							min={1}
							{...form.getInputProps("slotCapacityLimit")}
						/>
					</Grid.Col>
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<TimeInput
							label="Inicio mañana"
							{...form.getInputProps("morningStart")}
							error={form.errors.morningStart}
						/>
					</Grid.Col>
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<TimeInput
							label="Fin mañana"
							{...form.getInputProps("morningEnd")}
							error={form.errors.morningEnd}
						/>
					</Grid.Col>
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<TimeInput
							label="Inicio tarde"
							{...form.getInputProps("afternoonStart")}
							error={form.errors.afternoonStart}
						/>
					</Grid.Col>
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<TimeInput
							label="Fin tarde"
							{...form.getInputProps("afternoonEnd")}
							error={form.errors.afternoonEnd}
						/>
					</Grid.Col>
					<Grid.Col span={12}>
						<TextInput
							label="Notas"
							placeholder="Notas opcionales sobre este template..."
							{...form.getInputProps("notes")}
						/>
					</Grid.Col>
					<Grid.Col span={12}>
						<Group justify="space-between" align="center">
							<Checkbox
								label="Habilitado"
								description="Activar este template"
								{...form.getInputProps("isEnabled", {
									type: "checkbox",
								})}
							/>
							<Group>
								{isEditing && (
									<Button variant="default" onClick={resetForm}>
										Cancelar
									</Button>
								)}
								<Button
									onClick={() => void handleSubmit()}
									leftSection={
										isEditing ? <Edit3 size={16} /> : <Plus size={16} />
									}
								>
									{isEditing ? "Actualizar" : "Crear template"}
								</Button>
							</Group>
						</Group>
					</Grid.Col>
				</Grid>
			</Paper>

			<div>
				<h3 className="text-sm font-semibold text-zinc-900 mb-3">
					Templates configurados
				</h3>
				<Table.ScrollContainer minWidth={780}>
					<Table
						withTableBorder
						withColumnBorders
						className="border-zinc-200"
						styles={{ thead: { backgroundColor: "#f9fafb" } }}
					>
						<Table.Thead>
							<Table.Tr>
								<Table.Th className="text-xs font-semibold text-zinc-600">
									Día
								</Table.Th>
								<Table.Th className="text-xs font-semibold text-zinc-600">
									Duración
								</Table.Th>
								<Table.Th className="text-xs font-semibold text-zinc-600">
									Buffer
								</Table.Th>
								<Table.Th className="text-xs font-semibold text-zinc-600">
									Capacidad
								</Table.Th>
								<Table.Th className="text-xs font-semibold text-zinc-600">
									Horarios
								</Table.Th>
								<Table.Th className="text-xs font-semibold text-zinc-600">
									Estado
								</Table.Th>
								<Table.Th className="text-xs font-semibold text-zinc-600">
									Acciones
								</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{isLoading ? (
								<>
									<TableSkeleton />
									<TableSkeleton />
									<TableSkeleton />
								</>
							) : templates.length === 0 ? (
								<Table.Tr>
									<Table.Td colSpan={7}>
										<EmptyState
											icon={() => <span className="text-xl">⚙️</span>}
											title="Sin templates"
											description="Crea tu primer template de agenda para comenzar"
										/>
									</Table.Td>
								</Table.Tr>
							) : (
								templates.map((template) => (
									<Table.Tr
										key={template.id}
										className="hover:bg-zinc-50/80 transition-colors"
									>
										<Table.Td>
											<Badge
												className={`${weekdayColors[template.weekday]} border font-medium`}
												radius="sm"
											>
												{weekdayLabels[template.weekday]}
											</Badge>
										</Table.Td>
										<Table.Td className="text-sm">
											{template.slotDurationMinutes} min
										</Table.Td>
										<Table.Td className="text-sm">
											{template.bufferMinutes} min
										</Table.Td>
										<Table.Td className="text-sm">
											{template.slotCapacityLimit ?? (
												<span className="text-zinc-400 italic">
													Ilimitada
												</span>
											)}
										</Table.Td>
										<Table.Td className="text-sm">
											<Group gap={8}>
												{template.morningStart &&
													template.morningEnd && (
														<Badge
															variant="light"
															color="blue"
															radius="sm"
															size="sm"
														>
															{template.morningStart} -{" "}
															{template.morningEnd}
														</Badge>
													)}
												{template.afternoonStart &&
													template.afternoonEnd && (
														<Badge
															variant="light"
															color="orange"
															radius="sm"
															size="sm"
														>
															{template.afternoonStart} -{" "}
															{template.afternoonEnd}
														</Badge>
													)}
											</Group>
										</Table.Td>
										<Table.Td>
											<StatusBadge active={template.isEnabled} />
										</Table.Td>
										<Table.Td>
											<Group gap={6}>
												<Tooltip label="Editar">
													<ActionIcon
														variant="light"
														color="blue"
														onClick={() => handleEdit(template)}
														className="transition-transform duration-150 hover:scale-110"
													>
														<Edit3 size={16} />
													</ActionIcon>
												</Tooltip>
												<Tooltip label="Eliminar">
													<ActionIcon
														variant="light"
														color="red"
														onClick={() => handleDelete(template)}
														className="transition-transform duration-150 hover:scale-110"
													>
														<Trash2 size={16} />
													</ActionIcon>
												</Tooltip>
											</Group>
										</Table.Td>
									</Table.Tr>
								))
							)}
						</Table.Tbody>
					</Table>
				</Table.ScrollContainer>
			</div>
		</div>
	);
}
