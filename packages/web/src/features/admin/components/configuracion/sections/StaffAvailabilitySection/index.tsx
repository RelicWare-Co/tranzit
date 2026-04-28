import {
	Badge,
	Button,
	Checkbox,
	Grid,
	Group,
	NumberInput,
	Paper,
	Select,
	Table,
	Text,
	TextInput,
	Tooltip,
	ActionIcon,
} from "@mantine/core";
import { DatePickerInput, TimeInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { Edit3, Plus, Trash2, User, UserX } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "#/features/admin/components/ui/EmptyState";
import { StatusBadge } from "#/features/admin/components/ui/StatusBadge";
import { TableSkeleton } from "#/features/admin/components/ui/TableSkeleton";
import { validateTime } from "#/features/admin/components/configuracion/constants";
import type { ConfigSnapshot } from "#/features/admin/components/hooks/useConfigSnapshot";
import type { StaffDateOverride } from "#/features/admin/components/hooks/useStaffOverrides";
import { useConfigMutations } from "#/features/admin/components/hooks/useConfigMutations";
import { orpcClient } from "#/shared/lib/orpc-client";
import { getErrorMessage } from "#/features/admin/components/errors";
import { notifications } from "@mantine/notifications";

interface StaffAvailabilitySectionProps {
	staff: ConfigSnapshot["staff"];
	staffOverrides: StaffDateOverride[];
	isLoadingOverrides: boolean;
	selectedStaffUserId: string | null;
	onSelectStaff: (userId: string | null) => void;
	onRefresh: () => Promise<void>;
}

export function StaffAvailabilitySection({
	staff,
	staffOverrides,
	isLoadingOverrides,
	selectedStaffUserId,
	onSelectStaff,
	onRefresh,
}: StaffAvailabilitySectionProps) {
	const mutations = useConfigMutations({ onSuccess: onRefresh });
	const [editingId, setEditingId] = useState<string | null>(null);
	const [availabilityDate, setAvailabilityDate] = useState("");
	const [availabilityResult, setAvailabilityResult] = useState<unknown | null>(
		null,
	);
	const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

	const staffOptions = staff.map((s) => ({
		value: s.userId,
		label: s.user?.name || s.user?.email || s.userId,
	}));

	const selectedStaff = staff.find((s) => s.userId === selectedStaffUserId);

	const form = useForm({
		initialValues: {
			overrideId: "",
			overrideDate: "",
			isAvailable: true,
			capacityOverride: undefined as number | undefined,
			availableStartTime: "",
			availableEndTime: "",
			notes: "",
		},
		validate: {
			overrideDate: (value) => (!value ? "La fecha es obligatoria" : null),
			capacityOverride: (value) =>
				value !== undefined && value < 1 ? "Debe ser mayor a 0" : null,
			availableStartTime: (value) => validateTime(value, "Hora inicio"),
			availableEndTime: (value) => validateTime(value, "Hora fin"),
		},
	});

	const isEditing = !!editingId;

	const resetForm = () => {
		form.reset();
		setEditingId(null);
	};

	const handleSubmit = async () => {
		if (!selectedStaffUserId) {
			notifications.show({
				title: "Funcionario requerido",
				message: "Selecciona un funcionario primero",
				color: "red",
			});
			return;
		}

		const validation = form.validate();
		if (validation.hasErrors) return;

		const values = form.values;
		const payload = {
			overrideDate: values.overrideDate,
			isAvailable: values.isAvailable,
			capacityOverride: values.capacityOverride,
			availableStartTime: values.availableStartTime || null,
			availableEndTime: values.availableEndTime || null,
			notes: values.notes || null,
		};

		if (editingId) {
			await mutations.updateStaffOverride(selectedStaffUserId, editingId, payload);
		} else {
			await mutations.createStaffOverride(selectedStaffUserId, payload);
		}
		resetForm();
	};

	const handleEdit = (override: StaffDateOverride) => {
		setEditingId(override.id);
		form.setValues({
			overrideId: override.id,
			overrideDate: override.overrideDate,
			isAvailable: override.isAvailable,
			capacityOverride: override.capacityOverride ?? undefined,
			availableStartTime: override.availableStartTime ?? "",
			availableEndTime: override.availableEndTime ?? "",
			notes: override.notes ?? "",
		});
	};

	const handleDelete = async (override: StaffDateOverride) => {
		if (!selectedStaffUserId) return;
		const dateStr = new Date(override.overrideDate).toLocaleDateString("es-CO");
		if (!window.confirm(`¿Eliminar excepción de ${dateStr}?`)) return;
		if (editingId === override.id) resetForm();
		await mutations.removeStaffOverride(selectedStaffUserId, override.id);
	};

	const checkEffectiveAvailability = async () => {
		if (!selectedStaffUserId || !availabilityDate) {
			notifications.show({
				title: "Datos incompletos",
				message: "Selecciona funcionario y fecha para consultar",
				color: "red",
			});
			return;
		}

		setIsCheckingAvailability(true);
		setAvailabilityResult(null);

		try {
			const response = await orpcClient.admin.staff.effectiveAvailability({
				userId: selectedStaffUserId,
				date: availabilityDate,
			});
			setAvailabilityResult(response);
		} catch (error) {
			notifications.show({
				title: "Error al consultar",
				message: getErrorMessage(
					error,
					"No se pudo consultar la disponibilidad",
				),
				color: "red",
			});
		} finally {
			setIsCheckingAvailability(false);
		}
	};

	return (
		<div className="space-y-6">
			<Select
				label="Funcionario"
				placeholder="Selecciona un funcionario"
				value={selectedStaffUserId}
				onChange={onSelectStaff}
				data={staffOptions}
				className="max-w-md"
			/>

			{selectedStaffUserId ? (
				<>
					<Paper
						withBorder
						className={`p-5 rounded-xl border-zinc-200/60 ${isEditing ? "bg-amber-50/30 border-amber-200/60" : "bg-zinc-50/50"}`}
					>
						{isEditing && (
							<Group gap={6} className="mb-4">
								<Badge color="amber" variant="light" radius="sm">
									<Edit3 size={12} className="mr-1" />
									Editando disponibilidad
								</Badge>
							</Group>
						)}
						<Grid>
							<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
								<DatePickerInput
									label="Fecha de excepción"
									placeholder="Selecciona una fecha"
									locale="es"
									valueFormat="YYYY-MM-DD"
									clearable
									value={form.values.overrideDate || null}
									onChange={(value) => {
										form.setFieldValue("overrideDate", value || "");
									}}
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
								<NumberInput
									label="Capacidad override"
									placeholder="Sin límite"
									min={1}
									{...form.getInputProps("capacityOverride")}
								/>
							</Grid.Col>
							<Grid.Col
								span={{ base: 12, sm: 6, md: 4 }}
								className="flex items-center"
							>
								<Checkbox
									label="Disponible este día"
									description="Desmarca para bloquear"
									{...form.getInputProps("isAvailable", {
										type: "checkbox",
									})}
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
								<TimeInput
									label="Hora inicio disponible"
									{...form.getInputProps("availableStartTime")}
									error={form.errors.availableStartTime}
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
								<TimeInput
									label="Hora fin disponible"
									{...form.getInputProps("availableEndTime")}
									error={form.errors.availableEndTime}
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
								<TextInput
									label="Notas"
									placeholder="Vacaciones, incapacidad, etc."
									{...form.getInputProps("notes")}
								/>
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
										{isEditing
											? "Actualizar"
											: "Crear excepción"}
									</Button>
								</Group>
							</Grid.Col>
						</Grid>
					</Paper>

					<div>
						<h3 className="text-sm font-semibold text-zinc-900 mb-3">
							Excepciones de {selectedStaff?.user?.name || "funcionario"}
						</h3>
						<Table.ScrollContainer minWidth={780}>
							<Table
								withTableBorder
								withColumnBorders
								className="border-zinc-200"
								styles={{ thead: { backgroundColor: "#f8fafc" } }}
							>
								<Table.Thead>
									<Table.Tr>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Fecha
										</Table.Th>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Disponible
										</Table.Th>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Capacidad
										</Table.Th>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Horario
										</Table.Th>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Notas
										</Table.Th>
										<Table.Th className="text-xs font-semibold text-zinc-600">
											Acciones
										</Table.Th>
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{isLoadingOverrides ? (
										<>
											<TableSkeleton />
											<TableSkeleton />
										</>
									) : staffOverrides.length === 0 ? (
										<Table.Tr>
											<Table.Td colSpan={6}>
												<EmptyState
													icon={UserX}
													title="Sin excepciones"
													description={`${selectedStaff?.user?.name || "Este funcionario"} no tiene excepciones de disponibilidad`}
												/>
											</Table.Td>
										</Table.Tr>
									) : (
										staffOverrides.map((override) => (
											<Table.Tr
												key={override.id}
												className="hover:bg-zinc-50/80 transition-colors"
											>
												<Table.Td className="font-medium">
													{new Date(
														override.overrideDate,
													).toLocaleDateString("es-CO", {
														weekday: "short",
														day: "numeric",
														month: "short",
													})}
												</Table.Td>
												<Table.Td>
													<StatusBadge
														active={override.isAvailable}
														activeLabel="Sí"
														inactiveLabel="No"
													/>
												</Table.Td>
												<Table.Td className="text-sm">
													{override.capacityOverride ?? (
														<span className="text-zinc-400">
															Sin límite
														</span>
													)}
												</Table.Td>
												<Table.Td className="text-sm">
													{override.availableStartTime &&
													override.availableEndTime ? (
														<Badge
															variant="light"
															color="blue"
															radius="sm"
															size="sm"
														>
															{override.availableStartTime} -{" "}
															{override.availableEndTime}
														</Badge>
													) : (
														<span className="text-zinc-400 italic">
															Horario completo
														</span>
													)}
												</Table.Td>
												<Table.Td className="text-sm max-w-xs truncate">
													{override.notes || (
														<span className="text-zinc-400 italic">
															Sin notas
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

					<Paper withBorder className="p-5 rounded-xl border-zinc-200/60">
						<h3 className="text-sm font-semibold text-zinc-900 mb-4">
							Consultar disponibilidad efectiva
						</h3>
						<Group align="flex-end">
							<DatePickerInput
								label="Fecha a consultar"
								placeholder="Selecciona fecha"
								locale="es"
								valueFormat="YYYY-MM-DD"
								clearable
								value={availabilityDate || null}
								onChange={(value) => setAvailabilityDate(value || "")}
							/>
							<Button
								onClick={() => void checkEffectiveAvailability()}
								loading={isCheckingAvailability}
								variant="light"
							>
								Consultar
							</Button>
						</Group>

						{availabilityResult !== null && (
							<Paper
								withBorder
								className="mt-4 p-4 rounded-lg border-zinc-200 bg-zinc-50/50"
							>
								<Text
									component="pre"
									className="text-xs text-slate-700 font-mono whitespace-pre-wrap"
								>
									{JSON.stringify(availabilityResult as object, null, 2)}
								</Text>
							</Paper>
						)}
					</Paper>
				</>
			) : (
				<EmptyState
					icon={User}
					title="Selecciona un funcionario"
					description="Elige un funcionario de la lista para gestionar su disponibilidad"
				/>
			)}
		</div>
	);
}
