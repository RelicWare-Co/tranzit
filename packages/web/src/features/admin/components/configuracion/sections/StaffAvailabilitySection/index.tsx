import {
	ActionIcon,
	Badge,
	Button,
	Select,
	Table,
	Tooltip,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
	CalendarSearch,
	Clock3,
	Edit3,
	Plus,
	Trash2,
	User,
	UserX,
} from "lucide-react";
import { useState } from "react";
import classes from "#/features/admin/components/configuracion/Configuracion.module.css";
import { ConfigurationSectionHeader } from "#/features/admin/components/configuracion/ConfigurationSectionHeader";
import { ConfirmDeleteModal } from "#/features/admin/components/configuracion/ConfirmDeleteModal";
import { getErrorMessage } from "#/features/admin/components/errors";
import { useConfigMutations } from "#/features/admin/components/hooks/useConfigMutations";
import type { ConfigSnapshot } from "#/features/admin/components/hooks/useConfigSnapshot";
import type { StaffDateOverride } from "#/features/admin/components/hooks/useStaffOverrides";
import { EmptyState } from "#/features/admin/components/ui/EmptyState";
import { StatusBadge } from "#/features/admin/components/ui/StatusBadge";
import { TableSkeleton } from "#/features/admin/components/ui/TableSkeleton";
import { orpcClient } from "#/shared/lib/orpc-client";
import { StaffOverrideModal } from "./StaffOverrideModal";

interface StaffAvailabilitySectionProps {
	staff: ConfigSnapshot["staff"];
	staffOverrides: StaffDateOverride[];
	isLoadingOverrides: boolean;
	selectedStaffUserId: string | null;
	onSelectStaff: (userId: string | null) => void;
	onRefresh: () => Promise<void>;
}

type EffectiveAvailability = Awaited<
	ReturnType<typeof orpcClient.admin.staff.effectiveAvailability>
>;

const availabilityReasonLabels: Record<string, string> = {
	DEFAULT: "Disponibilidad habitual",
	DATE_OVERRIDE: "Excepción individual",
	DATE_OVERRIDE_UNAVAILABLE: "Bloqueo individual",
	STAFF_INACTIVE: "Funcionario inactivo",
	STAFF_NOT_ASSIGNABLE: "Funcionario no asignable",
	WEEKLY_AVAILABILITY: "Horario semanal",
	WEEKLY_AVAILABILITY_DISABLED: "Día deshabilitado",
};

function formatDate(date: string) {
	return new Date(`${date}T00:00:00`).toLocaleDateString("es-CO", {
		weekday: "short",
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isTimeRange(value: unknown): value is { start: string; end: string } {
	return (
		isRecord(value) &&
		typeof value.start === "string" &&
		typeof value.end === "string"
	);
}

function formatAvailabilityWindow(window: unknown) {
	if (!window) return "Jornada habitual";
	if (isTimeRange(window)) return `${window.start}–${window.end}`;
	if (
		isRecord(window) &&
		isTimeRange(window.morning) &&
		isTimeRange(window.afternoon)
	) {
		return `${window.morning.start}–${window.morning.end} · ${window.afternoon.start}–${window.afternoon.end}`;
	}
	return "Jornada habitual";
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
	const [modalOpened, setModalOpened] = useState(false);
	const [editingOverride, setEditingOverride] =
		useState<StaffDateOverride | null>(null);
	const [overrideToDelete, setOverrideToDelete] =
		useState<StaffDateOverride | null>(null);
	const [availabilityDate, setAvailabilityDate] = useState("");
	const [availabilityResult, setAvailabilityResult] =
		useState<EffectiveAvailability | null>(null);
	const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

	const staffOptions = staff.map((member) => ({
		value: member.userId,
		label: member.user?.name || member.user?.email || member.userId,
	}));

	const selectedStaff = staff.find(
		(member) => member.userId === selectedStaffUserId,
	);
	const selectedStaffName =
		selectedStaff?.user?.name ||
		selectedStaff?.user?.email ||
		"el funcionario seleccionado";

	const handleStaffChange = (userId: string | null) => {
		onSelectStaff(userId);
		setAvailabilityResult(null);
		setAvailabilityDate("");
		setEditingOverride(null);
		setModalOpened(false);
	};

	const openCreateModal = () => {
		if (!selectedStaffUserId) return;
		setEditingOverride(null);
		setModalOpened(true);
	};

	const openEditModal = (override: StaffDateOverride) => {
		setEditingOverride(override);
		setModalOpened(true);
	};

	const closeModal = () => {
		setModalOpened(false);
		setEditingOverride(null);
	};

	const handleDelete = async () => {
		if (!selectedStaffUserId || !overrideToDelete) return;
		if (editingOverride?.id === overrideToDelete.id) closeModal();
		await mutations.removeStaffOverride(
			selectedStaffUserId,
			overrideToDelete.id,
		);
	};

	const checkEffectiveAvailability = async () => {
		if (!selectedStaffUserId || !availabilityDate) {
			notifications.show({
				title: "Datos incompletos",
				message: "Selecciona un funcionario y una fecha para consultar",
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
		<div className={classes.sectionStack}>
			<ConfigurationSectionHeader
				title="Disponibilidad por funcionario"
				description="Bloquea fechas, limita capacidad o ajusta temporalmente el horario de una persona sin modificar la agenda general."
				meta={
					selectedStaffUserId
						? `${staffOverrides.length} ${staffOverrides.length === 1 ? "excepción" : "excepciones"}`
						: `${staff.length} funcionarios`
				}
				actions={
					<Button
						leftSection={<Plus size={16} />}
						onClick={openCreateModal}
						disabled={!selectedStaffUserId}
					>
						Nueva excepción
					</Button>
				}
			/>

			<div className={classes.selectorBar}>
				<Select
					label="Funcionario"
					placeholder="Busca por nombre o correo"
					value={selectedStaffUserId}
					onChange={handleStaffChange}
					data={staffOptions}
					searchable
					clearable
					nothingFoundMessage="No encontramos coincidencias"
				/>
				<p className={classes.selectorHint}>
					Las reglas individuales solo afectan a la persona seleccionada y
					tienen prioridad sobre su disponibilidad habitual.
				</p>
			</div>

			{selectedStaffUserId ? (
				<>
					<div className={classes.tableFrame}>
						<Table.ScrollContainer
							minWidth={720}
							className={classes.tableScroll}
						>
							<Table className={classes.table} verticalSpacing="sm">
								<Table.Thead>
									<Table.Tr>
										<Table.Th>Fecha</Table.Th>
										<Table.Th>Disponibilidad</Table.Th>
										<Table.Th>Horario</Table.Th>
										<Table.Th>Capacidad</Table.Th>
										<Table.Th>Notas</Table.Th>
										<Table.Th aria-label="Acciones" />
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
													title="Sin excepciones individuales"
													description={`${selectedStaffName} conserva su disponibilidad habitual.`}
													action={
														<Button
															variant="light"
															leftSection={<Plus size={16} />}
															onClick={openCreateModal}
														>
															Nueva excepción
														</Button>
													}
												/>
											</Table.Td>
										</Table.Tr>
									) : (
										staffOverrides.map((override) => (
											<Table.Tr key={override.id} className={classes.tableRow}>
												<Table.Td className={classes.primaryCell}>
													{formatDate(override.overrideDate)}
												</Table.Td>
												<Table.Td>
													<StatusBadge
														active={override.isAvailable}
														activeLabel="Disponible"
														inactiveLabel="Bloqueado"
													/>
												</Table.Td>
												<Table.Td>
													{override.availableStartTime &&
													override.availableEndTime ? (
														<span className={classes.shift}>
															<Clock3 size={14} />
															{override.availableStartTime}–
															{override.availableEndTime}
														</span>
													) : (
														<span className={classes.mutedValue}>
															Jornada habitual
														</span>
													)}
												</Table.Td>
												<Table.Td>
													{override.capacityOverride ?? (
														<span className={classes.mutedValue}>
															Sin cambio
														</span>
													)}
												</Table.Td>
												<Table.Td>
													{override.notes || (
														<span className={classes.mutedValue}>
															Sin notas
														</span>
													)}
												</Table.Td>
												<Table.Td>
													<div className={classes.rowActions}>
														<Tooltip label="Editar excepción">
															<ActionIcon
																variant="subtle"
																aria-label="Editar excepción"
																onClick={() => openEditModal(override)}
																className={classes.rowAction}
															>
																<Edit3 size={17} />
															</ActionIcon>
														</Tooltip>
														<Tooltip label="Eliminar excepción">
															<ActionIcon
																variant="subtle"
																color="red"
																aria-label="Eliminar excepción"
																onClick={() => setOverrideToDelete(override)}
																className={classes.rowAction}
															>
																<Trash2 size={17} />
															</ActionIcon>
														</Tooltip>
													</div>
												</Table.Td>
											</Table.Tr>
										))
									)}
								</Table.Tbody>
							</Table>
						</Table.ScrollContainer>
					</div>

					<section className={classes.utilitySection}>
						<div className={classes.utilityCopy}>
							<h3 className={classes.utilityTitle}>
								Comprobar disponibilidad efectiva
							</h3>
							<p className={classes.utilityDescription}>
								Consulta el resultado final después de combinar el perfil, el
								horario semanal y las excepciones individuales.
							</p>
						</div>
						<div>
							<div className={classes.queryControls}>
								<DatePickerInput
									label="Fecha a consultar"
									placeholder="Selecciona una fecha"
									locale="es"
									valueFormat="DD/MM/YYYY"
									clearable
									value={availabilityDate || null}
									onChange={(value) => {
										setAvailabilityDate(value || "");
										setAvailabilityResult(null);
									}}
								/>
								<Button
									onClick={() => void checkEffectiveAvailability()}
									loading={isCheckingAvailability}
									variant="default"
									leftSection={<CalendarSearch size={16} />}
								>
									Consultar
								</Button>
							</div>

							{availabilityResult ? (
								<div className={classes.resultPanel} aria-live="polite">
									<div className={classes.resultHeader}>
										<strong>
											Resultado para {formatDate(availabilityResult.date)}
										</strong>
										<Badge
											color={availabilityResult.isAvailable ? "teal" : "red"}
											variant="light"
											radius="sm"
										>
											{availabilityResult.isAvailable
												? "Disponible"
												: "No disponible"}
										</Badge>
									</div>
									<div className={classes.resultGrid}>
										<div className={classes.resultItem}>
											<span className={classes.resultLabel}>
												Origen de la regla
											</span>
											<span className={classes.resultValue}>
												{availabilityReasonLabels[availabilityResult.reason] ??
													availabilityResult.reason}
											</span>
										</div>
										<div className={classes.resultItem}>
											<span className={classes.resultLabel}>
												Capacidad diaria
											</span>
											<span className={classes.resultValue}>
												{availabilityResult.dailyCapacity ?? "Sin límite"}
											</span>
										</div>
										<div className={classes.resultItem}>
											<span className={classes.resultLabel}>
												Horario efectivo
											</span>
											<span className={classes.resultValue}>
												{formatAvailabilityWindow(
													availabilityResult.availableWindow,
												)}
											</span>
										</div>
									</div>
								</div>
							) : null}
						</div>
					</section>
				</>
			) : (
				<EmptyState
					icon={User}
					title="Selecciona un funcionario"
					description="Elige una persona para revisar y administrar sus excepciones de disponibilidad."
				/>
			)}

			<StaffOverrideModal
				opened={modalOpened}
				onClose={closeModal}
				staffName={selectedStaffName}
				override={editingOverride ?? undefined}
				onCreate={async (payload) => {
					if (!selectedStaffUserId) return;
					await mutations.createStaffOverride(selectedStaffUserId, payload);
				}}
				onUpdate={async (overrideId, payload) => {
					if (!selectedStaffUserId) return;
					await mutations.updateStaffOverride(
						selectedStaffUserId,
						overrideId,
						payload,
					);
				}}
			/>

			<ConfirmDeleteModal
				opened={overrideToDelete !== null}
				onClose={() => setOverrideToDelete(null)}
				title="Eliminar excepción individual"
				description={`Se eliminará la regla de ${selectedStaffName} para el ${overrideToDelete ? formatDate(overrideToDelete.overrideDate) : "día seleccionado"}.`}
				onConfirm={handleDelete}
			/>
		</div>
	);
}
