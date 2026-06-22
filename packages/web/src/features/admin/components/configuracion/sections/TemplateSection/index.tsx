import {
	Badge,
	Button,
	Group,
	Table,
	Tooltip,
	ActionIcon,
} from "@mantine/core";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "#/features/admin/components/ui/EmptyState";
import { StatusBadge } from "#/features/admin/components/ui/StatusBadge";
import { TableSkeleton } from "#/features/admin/components/ui/TableSkeleton";
import {
	weekdayColors,
	weekdayLabels,
} from "#/features/admin/components/configuracion/constants";
import type { ScheduleTemplate } from "#/features/admin/components/hooks/useConfigSnapshot";
import { useConfigMutations } from "#/features/admin/components/hooks/useConfigMutations";
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

	const handleDelete = async (template: ScheduleTemplate) => {
		if (
			!window.confirm(
				`¿Eliminar template de ${weekdayLabels[template.weekday]}?`,
			)
		) {
			return;
		}

		if (editingTemplate?.id === template.id) {
			closeModal();
		}

		await mutations.removeTemplate(template.id);
	};

	return (
		<div className="space-y-6">
			<Group justify="space-between" align="center">
				<h3 className="text-sm font-semibold text-zinc-900">
					Templates configurados
				</h3>
				<Button
					leftSection={<Plus size={16} />}
					onClick={openCreateModal}
				>
					Crear plantilla
				</Button>
			</Group>

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
											<span className="text-zinc-400 italic">Ilimitada</span>
										)}
									</Table.Td>
									<Table.Td className="text-sm">
										<Group gap={8}>
											{template.morningStart && template.morningEnd && (
												<Badge
													variant="light"
													color="blue"
													radius="sm"
													size="sm"
												>
													{template.morningStart} - {template.morningEnd}
												</Badge>
											)}
											{template.afternoonStart && template.afternoonEnd && (
												<Badge
													variant="light"
													color="orange"
													radius="sm"
													size="sm"
												>
													{template.afternoonStart} - {template.afternoonEnd}
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
												aria-label="Editar"
												onClick={() => openEditModal(template)}
													className="transition-transform duration-150 hover:scale-110"
												>
													<Edit3 size={16} />
												</ActionIcon>
											</Tooltip>
											<Tooltip label="Eliminar">
											<ActionIcon
												variant="light"
												color="red"
												aria-label="Eliminar"
												onClick={() => void handleDelete(template)}
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

			<ScheduleTemplateModal
				opened={modalOpened}
				onClose={closeModal}
				mode={modalMode}
				template={editingTemplate}
				onCreate={mutations.createTemplate}
				onUpdate={mutations.updateTemplate}
			/>
		</div>
	);
}
