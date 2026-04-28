import {
	Badge,
	Button,
	Grid,
	Group,
	NumberInput,
	Paper,
	Table,
	TextInput,
	Checkbox,
	Tooltip,
	ActionIcon,
} from "@mantine/core";
import { DatePickerInput, TimeInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { CalendarX, Edit3, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "#/features/admin/components/ui/EmptyState";
import { TableSkeleton } from "#/features/admin/components/ui/TableSkeleton";
import { validateTime } from "#/features/admin/components/configuracion/constants";
import type { CalendarOverride } from "#/features/admin/components/hooks/useConfigSnapshot";
import { useConfigMutations } from "#/features/admin/components/hooks/useConfigMutations";

interface OverrideSectionProps {
	overrides: CalendarOverride[];
	isLoading: boolean;
	onRefresh: () => Promise<void>;
}

export function OverrideSection({
	overrides,
	isLoading,
	onRefresh,
}: OverrideSectionProps) {
	const mutations = useConfigMutations({ onSuccess: onRefresh });
	const [editingId, setEditingId] = useState<string | null>(null);

	const form = useForm({
		initialValues: {
			id: "",
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
		},
		validate: {
			overrideDate: (value) => (!value ? "La fecha es obligatoria" : null),
			slotDurationMinutes: (value) =>
				value !== undefined && value < 5 ? "Mínimo 5 minutos" : null,
			bufferMinutes: (value) =>
				value !== undefined && value < 0 ? "No puede ser negativo" : null,
			slotCapacityLimit: (value) =>
				value !== undefined && value < 1 ? "Debe ser mayor a 0" : null,
			morningStart: (value) => validateTime(value, "Inicio mañana"),
			morningEnd: (value) => validateTime(value, "Fin mañana"),
			afternoonStart: (value) => validateTime(value, "Inicio tarde"),
			afternoonEnd: (value) => validateTime(value, "Fin tarde"),
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
			overrideDate: values.overrideDate,
			isClosed: values.isClosed,
			morningEnabled: values.morningEnabled,
			afternoonEnabled: values.afternoonEnabled,
			morningStart: values.morningStart || null,
			morningEnd: values.morningEnd || null,
			afternoonStart: values.afternoonStart || null,
			afternoonEnd: values.afternoonEnd || null,
			slotDurationMinutes: values.slotDurationMinutes ?? null,
			bufferMinutes: values.bufferMinutes ?? null,
			slotCapacityLimit: values.slotCapacityLimit ?? null,
			reason: values.reason || null,
		};

		if (editingId) {
			await mutations.updateOverride(editingId, payload);
		} else {
			await mutations.createOverride(payload);
		}
		resetForm();
	};

	const handleEdit = (override: CalendarOverride) => {
		setEditingId(override.id);
		form.setValues({
			id: override.id,
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
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const handleDelete = async (override: CalendarOverride) => {
		const dateStr = new Date(override.overrideDate).toLocaleDateString("es-CO");
		if (!window.confirm(`¿Eliminar excepción de ${dateStr}?`)) return;
		if (editingId === override.id) resetForm();
		await mutations.removeOverride(override.id);
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
							Editando excepción
						</Badge>
					</Group>
				)}
				<Grid>
					<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
						<DatePickerInput
							label="Fecha"
							placeholder="Selecciona una fecha"
							locale="es"
							valueFormat="DD/MM/YYYY"
							clearable
							value={
								form.values.overrideDate
									? new Date(form.values.overrideDate)
									: null
							}
							onChange={(value) => {
								const formatted = value
									? value.toString().split("T")[0]
									: "";
								form.setFieldValue("overrideDate", formatted);
							}}
						/>
					</Grid.Col>
					<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
						<NumberInput
							label="Duración slot (min)"
							placeholder="Usar default"
							min={5}
							{...form.getInputProps("slotDurationMinutes")}
						/>
					</Grid.Col>
					<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
						<NumberInput
							label="Capacidad"
							placeholder="Usar default"
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
							label="Razón / descripción"
							placeholder="Ej: Feriado, Mantenimiento, etc."
							{...form.getInputProps("reason")}
						/>
					</Grid.Col>
					<Grid.Col span={12}>
						<Group>
							<Checkbox
								label="Día cerrado"
								description="No habilitar slots este día"
								{...form.getInputProps("isClosed", {
									type: "checkbox",
								})}
							/>
							<Checkbox
								label="Mañana habilitada"
								{...form.getInputProps("morningEnabled", {
									type: "checkbox",
								})}
								disabled={form.values.isClosed}
							/>
							<Checkbox
								label="Tarde habilitada"
								{...form.getInputProps("afternoonEnabled", {
									type: "checkbox",
								})}
								disabled={form.values.isClosed}
							/>
						</Group>
					</Grid.Col>
					<Grid.Col span={12}>
						<Group justify="flex-end">
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
								{isEditing ? "Actualizar" : "Crear excepción"}
							</Button>
						</Group>
					</Grid.Col>
				</Grid>
			</Paper>

			<div>
				<h3 className="text-sm font-semibold text-zinc-900 mb-3">
					Excepciones configuradas
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
									Fecha
								</Table.Th>
								<Table.Th className="text-xs font-semibold text-zinc-600">
									Estado
								</Table.Th>
								<Table.Th className="text-xs font-semibold text-zinc-600">
									Duración
								</Table.Th>
								<Table.Th className="text-xs font-semibold text-zinc-600">
									Capacidad
								</Table.Th>
								<Table.Th className="text-xs font-semibold text-zinc-600">
									Razón
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
								</>
							) : overrides.length === 0 ? (
								<Table.Tr>
									<Table.Td colSpan={6}>
										<EmptyState
											icon={CalendarX}
											title="Sin excepciones"
											description="No hay excepciones de calendario configuradas"
										/>
									</Table.Td>
								</Table.Tr>
							) : (
								overrides.map((override) => (
									<Table.Tr
										key={override.id}
										className="hover:bg-zinc-50/80 transition-colors"
									>
										<Table.Td className="font-medium">
											{new Date(override.overrideDate).toLocaleDateString(
												"es-CO",
												{
													weekday: "short",
													day: "numeric",
													month: "short",
												},
											)}
										</Table.Td>
										<Table.Td>
											{override.isClosed ? (
												<Badge
													color="red"
													variant="light"
													radius="sm"
												>
													Cerrado
												</Badge>
											) : (
												<Badge
													color="emerald"
													variant="light"
													radius="sm"
												>
													Abierto
												</Badge>
											)}
										</Table.Td>
										<Table.Td className="text-sm">
											{override.slotDurationMinutes ? (
												`${override.slotDurationMinutes} min`
											) : (
												<span className="text-zinc-400">Default</span>
											)}
										</Table.Td>
										<Table.Td className="text-sm">
											{override.slotCapacityLimit ?? (
												<span className="text-zinc-400">Default</span>
											)}
										</Table.Td>
										<Table.Td className="text-sm max-w-xs truncate">
											{override.reason || (
												<span className="text-zinc-400 italic">
													Sin descripción
												</span>
											)}
										</Table.Td>
										<Table.Td>
											<Group gap={6}>
												<Tooltip label="Editar">
													<ActionIcon
														variant="light"
														color="blue"
														onClick={() => handleEdit(override)}
														className="transition-transform duration-150 hover:scale-110"
													>
														<Edit3 size={16} />
													</ActionIcon>
												</Tooltip>
												<Tooltip label="Eliminar">
													<ActionIcon
														variant="light"
														color="red"
														onClick={() => handleDelete(override)}
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
