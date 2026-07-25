import { ActionIcon, Badge, Button, Table, Tooltip } from "@mantine/core";
import {
	CalendarOff,
	Edit3,
	MoonStar,
	Plus,
	SunMedium,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import classes from "#/features/admin/components/configuracion/Configuracion.module.css";
import { ConfigurationSectionHeader } from "#/features/admin/components/configuracion/ConfigurationSectionHeader";
import { ConfirmDeleteModal } from "#/features/admin/components/configuracion/ConfirmDeleteModal";
import { useConfigMutations } from "#/features/admin/components/hooks/useConfigMutations";
import type { CalendarOverride } from "#/features/admin/components/hooks/useConfigSnapshot";
import { EmptyState } from "#/features/admin/components/ui/EmptyState";
import { TableSkeleton } from "#/features/admin/components/ui/TableSkeleton";
import { CalendarOverrideModal } from "./CalendarOverrideModal";

interface OverrideSectionProps {
	overrides: CalendarOverride[];
	isLoading: boolean;
	onRefresh: () => Promise<void>;
}

function formatOverrideDate(date: string) {
	return new Date(`${date}T00:00:00`).toLocaleDateString("es-CO", {
		weekday: "short",
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function OverrideSection({
	overrides,
	isLoading,
	onRefresh,
}: OverrideSectionProps) {
	const mutations = useConfigMutations({ onSuccess: onRefresh });
	const [modalOpened, setModalOpened] = useState(false);
	const [editingOverride, setEditingOverride] =
		useState<CalendarOverride | null>(null);
	const [overrideToDelete, setOverrideToDelete] =
		useState<CalendarOverride | null>(null);

	const openCreateModal = () => {
		setEditingOverride(null);
		setModalOpened(true);
	};

	const openEditModal = (override: CalendarOverride) => {
		setEditingOverride(override);
		setModalOpened(true);
	};

	const closeModal = () => {
		setModalOpened(false);
		setEditingOverride(null);
	};

	const handleDelete = async () => {
		if (!overrideToDelete) return;
		if (editingOverride?.id === overrideToDelete.id) closeModal();
		await mutations.removeOverride(overrideToDelete.id);
	};

	return (
		<div className={classes.sectionStack}>
			<ConfigurationSectionHeader
				title="Excepciones de calendario"
				description="Ajusta una fecha puntual por cierres, jornadas especiales o cambios de capacidad. Estas reglas reemplazan la agenda semanal para ese día."
				meta={`${overrides.length} ${overrides.length === 1 ? "excepción" : "excepciones"}`}
				actions={
					<Button leftSection={<Plus size={16} />} onClick={openCreateModal}>
						Nueva excepción
					</Button>
				}
			/>

			<div className={classes.tableFrame}>
				<Table.ScrollContainer minWidth={760} className={classes.tableScroll}>
					<Table className={classes.table} verticalSpacing="sm">
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Fecha</Table.Th>
								<Table.Th>Operación</Table.Th>
								<Table.Th>Horario especial</Table.Th>
								<Table.Th>Ajustes</Table.Th>
								<Table.Th>Motivo</Table.Th>
								<Table.Th aria-label="Acciones" />
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
											icon={CalendarOff}
											title="No hay excepciones programadas"
											description="La agenda semanal se aplicará sin cambios puntuales."
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
								overrides.map((override) => (
									<Table.Tr key={override.id} className={classes.tableRow}>
										<Table.Td className={classes.primaryCell}>
											{formatOverrideDate(override.overrideDate)}
										</Table.Td>
										<Table.Td>
											<Badge
												color={override.isClosed ? "red" : "teal"}
												variant="light"
												radius="sm"
											>
												{override.isClosed
													? "Día cerrado"
													: "Atención habilitada"}
											</Badge>
										</Table.Td>
										<Table.Td>
											{override.isClosed ? (
												<span className={classes.mutedValue}>No aplica</span>
											) : (
												<div className={classes.shiftList}>
													{override.morningEnabled &&
													override.morningStart &&
													override.morningEnd ? (
														<span className={classes.shift}>
															<SunMedium size={14} />
															{override.morningStart}–{override.morningEnd}
														</span>
													) : null}
													{override.afternoonEnabled &&
													override.afternoonStart &&
													override.afternoonEnd ? (
														<span className={classes.shift}>
															<MoonStar size={14} />
															{override.afternoonStart}–{override.afternoonEnd}
														</span>
													) : null}
													{!override.morningStart &&
													!override.afternoonStart ? (
														<span className={classes.mutedValue}>
															Usar agenda semanal
														</span>
													) : null}
												</div>
											)}
										</Table.Td>
										<Table.Td>
											<div className={classes.shiftList}>
												{override.slotDurationMinutes ? (
													<span className={classes.shift}>
														{override.slotDurationMinutes} min
													</span>
												) : null}
												{override.slotCapacityLimit ? (
													<span className={classes.shift}>
														Cap. {override.slotCapacityLimit}
													</span>
												) : null}
												{!override.slotDurationMinutes &&
												!override.slotCapacityLimit ? (
													<span className={classes.mutedValue}>
														Sin cambios
													</span>
												) : null}
											</div>
										</Table.Td>
										<Table.Td>
											{override.reason || (
												<span className={classes.mutedValue}>Sin motivo</span>
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

			<CalendarOverrideModal
				opened={modalOpened}
				onClose={closeModal}
				override={editingOverride ?? undefined}
				onCreate={mutations.createOverride}
				onUpdate={mutations.updateOverride}
			/>

			<ConfirmDeleteModal
				opened={overrideToDelete !== null}
				onClose={() => setOverrideToDelete(null)}
				title="Eliminar excepción"
				description={`Se eliminará la regla especial del ${overrideToDelete ? formatOverrideDate(overrideToDelete.overrideDate) : "día seleccionado"}.`}
				onConfirm={handleDelete}
			/>
		</div>
	);
}
