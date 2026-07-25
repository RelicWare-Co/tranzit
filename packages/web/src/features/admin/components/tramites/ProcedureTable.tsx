import {
	ActionIcon,
	Badge,
	Group,
	Loader,
	Menu,
	Table,
	Text,
	Tooltip,
	UnstyledButton,
} from "@mantine/core";
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	CarFront,
	CheckCircle2,
	ClipboardList,
	Copy,
	Edit3,
	FileCheck2,
	MoreHorizontal,
	PowerOff,
	Trash2,
} from "lucide-react";
import classes from "./Tramites.module.css";
import type { ProcedureType } from "./types";

export type ProcedureSortKey = "name" | "status" | "requirements";
export type ProcedureSortDirection = "asc" | "desc";

interface ProcedureTableProps {
	procedures: ProcedureType[];
	sortKey: ProcedureSortKey;
	sortDirection: ProcedureSortDirection;
	isMutatingId: string | null;
	onSort: (key: ProcedureSortKey) => void;
	onEdit: (procedure: ProcedureType) => void;
	onDuplicate: (procedure: ProcedureType) => void;
	onToggleActive: (procedure: ProcedureType, nextActive: boolean) => void;
	onDelete: (procedure: ProcedureType) => void;
}

export function ProcedureTable({
	procedures,
	sortKey,
	sortDirection,
	isMutatingId,
	onSort,
	onEdit,
	onDuplicate,
	onToggleActive,
	onDelete,
}: ProcedureTableProps) {
	return (
		<div className={classes.tableFrame}>
			<Table.ScrollContainer minWidth={760} className={classes.tableScroll}>
				<Table className={classes.table} verticalSpacing="sm">
					<Table.Thead>
						<Table.Tr>
							<SortableHeader
								label="Trámite"
								column="name"
								sortKey={sortKey}
								sortDirection={sortDirection}
								onSort={onSort}
							/>
							<SortableHeader
								label="Configuración"
								column="requirements"
								sortKey={sortKey}
								sortDirection={sortDirection}
								onSort={onSort}
							/>
							<SortableHeader
								label="Estado"
								column="status"
								sortKey={sortKey}
								sortDirection={sortDirection}
								onSort={onSort}
							/>
							<Table.Th className={classes.actionsHeader}>Acciones</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{procedures.map((procedure) => {
							const requirementCount = getRequirementCount(procedure);
							const fieldCount = getFieldCount(procedure);
							const isMutating = isMutatingId === procedure.id;

							return (
								<Table.Tr
									key={procedure.id}
									className={classes.tableRow}
									data-inactive={!procedure.isActive || undefined}
								>
									<Table.Td>
										<div className={classes.procedureCell}>
											<Text className={classes.procedureName} lineClamp={2}>
												{procedure.name}
											</Text>
											{procedure.description ? (
												<Text size="xs" c="dimmed" lineClamp={1}>
													{procedure.description}
												</Text>
											) : null}
											<code className={classes.slug}>{procedure.slug}</code>
										</div>
									</Table.Td>
									<Table.Td>
										<div className={classes.configurationList}>
											<span>
												<FileCheck2 size={15} aria-hidden="true" />
												{requirementCount}{" "}
												{requirementCount === 1 ? "requisito" : "requisitos"}
											</span>
											<span>
												<ClipboardList size={15} aria-hidden="true" />
												{fieldCount} {fieldCount === 1 ? "campo" : "campos"}
											</span>
											{procedure.requiresVehicle ? (
												<span>
													<CarFront size={15} aria-hidden="true" />
													Con vehículo
												</span>
											) : null}
										</div>
									</Table.Td>
									<Table.Td>
										<Badge
											variant="light"
											color={procedure.isActive ? "teal" : "gray"}
											size="md"
											leftSection={
												procedure.isActive ? (
													<CheckCircle2 size={12} aria-hidden="true" />
												) : (
													<PowerOff size={12} aria-hidden="true" />
												)
											}
										>
											{procedure.isActive ? "Activo" : "Inactivo"}
										</Badge>
									</Table.Td>
									<Table.Td>
										<Group gap={4} wrap="nowrap" justify="flex-end">
											<Tooltip label={`Editar ${procedure.name}`}>
												<ActionIcon
													variant="subtle"
													color="gray"
													size="lg"
													aria-label={`Editar ${procedure.name}`}
													onClick={() => onEdit(procedure)}
													disabled={isMutating}
													className={classes.rowAction}
												>
													<Edit3 size={17} aria-hidden="true" />
												</ActionIcon>
											</Tooltip>
											<Menu position="bottom-end" withinPortal>
												<Menu.Target>
													<ActionIcon
														variant="subtle"
														color="gray"
														size="lg"
														aria-label={`Más acciones para ${procedure.name}`}
														disabled={isMutating}
														className={classes.rowAction}
													>
														{isMutating ? (
															<Loader size={16} />
														) : (
															<MoreHorizontal size={18} aria-hidden="true" />
														)}
													</ActionIcon>
												</Menu.Target>
												<Menu.Dropdown>
													<Menu.Label>Administrar trámite</Menu.Label>
													<Menu.Item
														leftSection={<Copy size={15} aria-hidden="true" />}
														onClick={() => onDuplicate(procedure)}
													>
														Duplicar configuración
													</Menu.Item>
													<Menu.Item
														leftSection={
															procedure.isActive ? (
																<PowerOff size={15} aria-hidden="true" />
															) : (
																<CheckCircle2 size={15} aria-hidden="true" />
															)
														}
														onClick={() =>
															onToggleActive(procedure, !procedure.isActive)
														}
													>
														{procedure.isActive ? "Desactivar" : "Activar"}
													</Menu.Item>
													<Menu.Divider />
													<Menu.Item
														color="red"
														leftSection={
															<Trash2 size={15} aria-hidden="true" />
														}
														onClick={() => onDelete(procedure)}
													>
														Eliminar
													</Menu.Item>
												</Menu.Dropdown>
											</Menu>
										</Group>
									</Table.Td>
								</Table.Tr>
							);
						})}
					</Table.Tbody>
				</Table>
			</Table.ScrollContainer>
		</div>
	);
}

function SortableHeader({
	label,
	column,
	sortKey,
	sortDirection,
	onSort,
}: {
	label: string;
	column: ProcedureSortKey;
	sortKey: ProcedureSortKey;
	sortDirection: ProcedureSortDirection;
	onSort: (key: ProcedureSortKey) => void;
}) {
	const isActive = sortKey === column;
	const ariaSort = isActive
		? sortDirection === "asc"
			? "ascending"
			: "descending"
		: "none";

	return (
		<Table.Th aria-sort={ariaSort}>
			<UnstyledButton
				type="button"
				onClick={() => onSort(column)}
				className={classes.sortButton}
				aria-label={`${label}: ordenar ${
					isActive && sortDirection === "asc" ? "descendente" : "ascendente"
				}`}
			>
				<span>{label}</span>
				{isActive ? (
					sortDirection === "asc" ? (
						<ArrowUp size={14} aria-hidden="true" />
					) : (
						<ArrowDown size={14} aria-hidden="true" />
					)
				) : (
					<ArrowUpDown size={14} aria-hidden="true" />
				)}
			</UnstyledButton>
		</Table.Th>
	);
}

function getRequirementCount(procedure: ProcedureType): number {
	return (
		(procedure.documentSchema?.requirements as unknown[] | undefined)?.length ??
		0
	);
}

function getFieldCount(procedure: ProcedureType): number {
	return (procedure.formSchema?.fields as unknown[] | undefined)?.length ?? 0;
}
