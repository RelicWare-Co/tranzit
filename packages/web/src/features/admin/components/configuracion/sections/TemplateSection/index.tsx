import { ActionIcon, Button, Table, Tooltip } from "@mantine/core";
import {
	CalendarClock,
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
import { weekdayLabels } from "#/features/admin/components/configuracion/constants";
import { useConfigMutations } from "#/features/admin/components/hooks/useConfigMutations";
import type { ScheduleTemplate } from "#/features/admin/components/hooks/useConfigSnapshot";
import { EmptyState } from "#/features/admin/components/ui/EmptyState";
import { StatusBadge } from "#/features/admin/components/ui/StatusBadge";
import { TableSkeleton } from "#/features/admin/components/ui/TableSkeleton";
import { ScheduleTemplateModal } from "./ScheduleTemplateModal";

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
	const [modalOpened, setModalOpened] = useState(false);
	const [modalMode, setModalMode] = useState<"create" | "edit">("create");
	const [editingTemplate, setEditingTemplate] = useState<
		ScheduleTemplate | undefined
	>();
	const [templateToDelete, setTemplateToDelete] =
		useState<ScheduleTemplate | null>(null);

	const openCreateModal = () => {
		setModalMode("create");
		setEditingTemplate(undefined);
		setModalOpened(true);
	};

	const openEditModal = (template: ScheduleTemplate) => {
		setModalMode("edit");
		setEditingTemplate(template);
		setModalOpened(true);
	};

	const closeModal = () => {
		setModalOpened(false);
		setEditingTemplate(undefined);
	};

	const handleDelete = async () => {
		if (!templateToDelete) return;
		if (editingTemplate?.id === templateToDelete.id) closeModal();
		await mutations.removeTemplate(templateToDelete.id);
	};

	return (
		<div className={classes.sectionStack}>
			<ConfigurationSectionHeader
				title="Agenda semanal"
				description="Define la duración, capacidad y ventanas de atención que se repiten cada semana. Las excepciones de calendario tienen prioridad sobre estas reglas."
				meta={`${templates.length} ${templates.length === 1 ? "plantilla" : "plantillas"}`}
				actions={
					<Button leftSection={<Plus size={16} />} onClick={openCreateModal}>
						Crear plantilla
					</Button>
				}
			/>

			<div className={classes.tableFrame}>
				<Table.ScrollContainer minWidth={760} className={classes.tableScroll}>
					<Table className={classes.table} verticalSpacing="sm">
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Día</Table.Th>
								<Table.Th>Duración</Table.Th>
								<Table.Th>Buffer</Table.Th>
								<Table.Th>Capacidad</Table.Th>
								<Table.Th>Ventanas de atención</Table.Th>
								<Table.Th>Estado</Table.Th>
								<Table.Th aria-label="Acciones" />
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
											icon={CalendarClock}
											title="Aún no hay una agenda semanal"
											description="Crea la primera plantilla para establecer los horarios base de atención."
											action={
												<Button
													variant="light"
													leftSection={<Plus size={16} />}
													onClick={openCreateModal}
												>
													Crear plantilla
												</Button>
											}
										/>
									</Table.Td>
								</Table.Tr>
							) : (
								templates.map((template) => (
									<Table.Tr key={template.id} className={classes.tableRow}>
										<Table.Td className={classes.primaryCell}>
											{weekdayLabels[template.weekday]}
										</Table.Td>
										<Table.Td>{template.slotDurationMinutes} min</Table.Td>
										<Table.Td>{template.bufferMinutes} min</Table.Td>
										<Table.Td>
											{template.slotCapacityLimit ?? (
												<span className={classes.mutedValue}>Sin límite</span>
											)}
										</Table.Td>
										<Table.Td>
											<div className={classes.shiftList}>
												{template.morningStart && template.morningEnd ? (
													<span className={classes.shift}>
														<SunMedium size={14} />
														{template.morningStart}–{template.morningEnd}
													</span>
												) : null}
												{template.afternoonStart && template.afternoonEnd ? (
													<span className={classes.shift}>
														<MoonStar size={14} />
														{template.afternoonStart}–{template.afternoonEnd}
													</span>
												) : null}
												{!template.morningStart && !template.afternoonStart ? (
													<span className={classes.mutedValue}>
														Sin horario
													</span>
												) : null}
											</div>
										</Table.Td>
										<Table.Td>
											<StatusBadge active={template.isEnabled} />
										</Table.Td>
										<Table.Td>
											<div className={classes.rowActions}>
												<Tooltip label="Editar plantilla">
													<ActionIcon
														variant="subtle"
														aria-label="Editar"
														onClick={() => openEditModal(template)}
														className={classes.rowAction}
													>
														<Edit3 size={17} />
													</ActionIcon>
												</Tooltip>
												<Tooltip label="Eliminar plantilla">
													<ActionIcon
														variant="subtle"
														color="red"
														aria-label="Eliminar"
														onClick={() => setTemplateToDelete(template)}
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

			<ScheduleTemplateModal
				opened={modalOpened}
				onClose={closeModal}
				mode={modalMode}
				template={editingTemplate}
				onCreate={mutations.createTemplate}
				onUpdate={mutations.updateTemplate}
			/>

			<ConfirmDeleteModal
				opened={templateToDelete !== null}
				onClose={() => setTemplateToDelete(null)}
				title="Eliminar plantilla"
				description={`Se eliminará la configuración base de ${templateToDelete ? weekdayLabels[templateToDelete.weekday] : "este día"}.`}
				onConfirm={handleDelete}
			/>
		</div>
	);
}
