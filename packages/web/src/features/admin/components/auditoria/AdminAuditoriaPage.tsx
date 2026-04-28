import {
	Alert,
	Badge,
	Box,
	Button,
	Code,
	Collapse,
	Divider,
	Grid,
	Group,
	Loader,
	Paper,
	rem,
	Select,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import {
	AlertCircle,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Filter,
	RefreshCw,
	Search,
	XCircle,
} from "lucide-react";
import { Fragment, useCallback, useState } from "react";
import { orpcClient } from "#/shared/lib/orpc-client";
import { AdminPageHeader } from "#/features/admin/components/AdminPageHeader";
import { adminUi } from "#/features/admin/components/admin-ui";
import { getErrorMessage } from "#/features/admin/components/errors";

type AuditFilters = {
	entityType: string;
	actorUserId: string;
	action: string;
	dateFrom: string;
	dateTo: string;
};

const defaultFilters: AuditFilters = {
	entityType: "",
	actorUserId: "",
	action: "",
	dateFrom: "",
	dateTo: "",
};

// Common entity types observed in the system
const entityTypes = [
	{ value: "booking", label: "Booking" },
	{ value: "schedule_template", label: "Schedule Template" },
	{ value: "calendar_override", label: "Calendar Override" },
	{ value: "staff_profile", label: "Staff Profile" },
	{ value: "staff_date_override", label: "Staff Date Override" },
	{ value: "procedure_type", label: "Procedure Type" },
	{ value: "service_request", label: "Service Request" },
	{ value: "booking_series", label: "Booking Series" },
];

// Common actions observed in the system
const actions = [
	{ value: "create", label: "Create" },
	{ value: "update", label: "Update" },
	{ value: "remove", label: "Remove" },
	{ value: "confirm", label: "Confirm" },
	{ value: "cancel", label: "Cancel" },
	{ value: "release", label: "Release" },
	{ value: "reassign", label: "Reassign" },
	{ value: "hold", label: "Hold" },
	{ value: "status_booking_held_to_confirmed", label: "Status Transition" },
];

function formatDate(date: string | Date): string {
	const d = new Date(date);
	return d.toLocaleDateString("es-CO", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
}

function formatTime(date: string | Date): string {
	const d = new Date(date);
	return d.toLocaleTimeString("es-CO", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function stringifyJson(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

interface FilterBarProps {
	children: React.ReactNode;
	onApply: () => void;
	onClear: () => void;
}

function FilterBar({ children, onApply, onClear }: FilterBarProps) {
	return (
		<Paper withBorder radius="lg" p="md" shadow="sm">
			<Stack gap="md">
				<Group gap="sm" wrap="nowrap">
					<Box className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-100">
						<Filter size={16} className="text-red-700" strokeWidth={1.75} />
					</Box>
					<Title order={5} className="text-sm font-semibold text-zinc-900">
						Filtros de auditoría
					</Title>
				</Group>
				{children}
				<Group justify="flex-end" gap="sm">
					<Button
						variant="default"
						size="sm"
						onClick={onClear}
						leftSection={<XCircle size={14} />}
					>
						Limpiar
					</Button>
					<Button
						size="sm"
						onClick={onApply}
						leftSection={<Search size={14} />}
					>
						Aplicar filtros
					</Button>
				</Group>
			</Stack>
		</Paper>
	);
}

function JsonPayloadViewer({ payload }: { payload: Record<string, unknown> }) {
	const [expanded, setExpanded] = useState(false);

	const hasPayload = Object.keys(payload).length > 0;

	if (!hasPayload) {
		return (
			<Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
				Sin payload adicional
			</Text>
		);
	}

	return (
		<Stack gap="xs">
			<Button
				variant="subtle"
				size="compact-xs"
				onClick={() => setExpanded(!expanded)}
				leftSection={
					expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />
				}
			>
				{expanded ? "Ocultar payload JSON" : "Ver payload JSON"}
			</Button>
			<Collapse expanded={expanded}>
				<Paper withBorder p="sm" bg="gray.0" radius="md">
					<pre
						style={{
							fontSize: rem(11),
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
							margin: 0,
							maxHeight: 300,
							overflow: "auto",
							fontFamily: "monospace",
						}}
					>
						{stringifyJson(payload)}
					</pre>
				</Paper>
			</Collapse>
		</Stack>
	);
}

function ActorBadge({
	actorType,
	actorUserId,
}: {
	actorType: string;
	actorUserId: string | null;
}) {
	const color =
		actorType === "admin" ? "blue" : actorType === "citizen" ? "green" : "gray";

	return (
		<Stack gap={4}>
			<Badge color={color} size="sm" variant="light">
				{actorType}
			</Badge>
			{actorUserId ? (
				<Code style={{ fontSize: rem(10), wordBreak: "break-all" }}>
					{actorUserId.slice(0, 8)}...
				</Code>
			) : null}
		</Stack>
	);
}

function getActionBadgeColor(action: string): string {
	switch (action) {
		case "create":
			return "green";
		case "update":
			return "blue";
		case "remove":
		case "delete":
			return "red";
		case "confirm":
			return "teal";
		case "cancel":
			return "orange";
		case "release":
			return "yellow";
		case "reassign":
			return "violet";
		case "hold":
			return "cyan";
		default:
			if (action.startsWith("status")) return "indigo";
			return "gray";
	}
}

function ActionBadge({ action }: { action: string }) {
	return (
		<Badge color={getActionBadgeColor(action)} size="sm" variant="light">
			{action}
		</Badge>
	);
}

interface EntityCellProps {
	entityType: string;
	entityId: string;
}

function EntityCell({ entityType, entityId }: EntityCellProps) {
	return (
		<Stack gap={4}>
			<Badge size="sm" variant="outline" color="gray">
				{entityType}
			</Badge>
			<Code
				style={{
					wordBreak: "break-all",
					fontSize: rem(10),
					background: "var(--mantine-color-gray-0)",
					padding: "2px 6px",
					borderRadius: "4px",
				}}
			>
				{entityId.slice(0, 12)}...
			</Code>
		</Stack>
	);
}

export function AdminAuditoriaPage() {
	const [globalError] = useState<string | null>(null);
	const [globalNotice] = useState<string | null>(null);

	const [filtersDraft, setFiltersDraft] =
		useState<AuditFilters>(defaultFilters);
	const [filters, setFilters] = useState<AuditFilters>(defaultFilters);
	const [currentPage, setCurrentPage] = useState(0);
	const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
	const pageSize = 20;

	const fetchAuditEvents = useCallback(async () => {
		const payload: Parameters<typeof orpcClient.admin.audit.list>[0] = {};
		if (filters.entityType) payload.entityType = filters.entityType;
		if (filters.actorUserId) payload.actorUserId = filters.actorUserId;
		if (filters.action) payload.action = filters.action;
		if (filters.dateFrom) payload.dateFrom = filters.dateFrom;
		if (filters.dateTo) payload.dateTo = filters.dateTo;
		payload.limit = pageSize;
		payload.offset = currentPage * pageSize;
		payload.orderBy = "createdAt";
		payload.orderDir = "desc";

		return await orpcClient.admin.audit.list(payload);
	}, [filters, currentPage]);

	const auditQuery = useQuery({
		queryKey: ["admin", "auditoria", "list", filters, currentPage],
		queryFn: fetchAuditEvents,
	});

	const refreshAll = useCallback(() => {
		setCurrentPage(0);
		setExpandedRowId(null);
	}, []);

	const totalPages = auditQuery.data
		? Math.ceil(auditQuery.data.total / pageSize)
		: 0;

	const activeFiltersCount = Object.values(filters).filter(
		(v) => v !== "",
	).length;

	const handleApplyFilters = () => {
		setFilters(filtersDraft);
		setCurrentPage(0);
		setExpandedRowId(null);
	};

	const handleClearFilters = () => {
		setFiltersDraft(defaultFilters);
		setFilters(defaultFilters);
		setCurrentPage(0);
		setExpandedRowId(null);
	};

	return (
		<Stack gap="xl">
			<AdminPageHeader
				title="Auditoría"
				description="Consulta y filtra el registro de auditoría de todas las operaciones del sistema."
				actions={
					<Group>
						{activeFiltersCount > 0 ? (
							<Badge color="blue" variant="light" size="sm">
								{activeFiltersCount} filtro(s) activo(s)
							</Badge>
						) : null}
						<Button
							leftSection={<RefreshCw size={16} />}
							onClick={() => void refreshAll()}
							variant="light"
							size="sm"
						>
							Refrescar
						</Button>
					</Group>
				}
			/>

			{globalError ? (
				<Alert
					color="red"
					variant="light"
					icon={<AlertCircle size={16} />}
					radius="md"
				>
					{globalError}
				</Alert>
			) : null}

			{globalNotice ? (
				<Alert
					color="teal"
					variant="light"
					icon={<CheckCircle2 size={16} />}
					radius="md"
				>
					{globalNotice}
				</Alert>
			) : null}

			{/* Filters */}
			<FilterBar onApply={handleApplyFilters} onClear={handleClearFilters}>
				<Grid gap="md">
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<Select
							label="Tipo de entidad"
							placeholder="Todas las entidades"
							value={filtersDraft.entityType || null}
							onChange={(value) =>
								setFiltersDraft((prev) => ({
									...prev,
									entityType: value ?? "",
								}))
							}
							data={entityTypes}
							clearable
							size="sm"
						/>
					</Grid.Col>
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<Select
							label="Acción"
							placeholder="Todas las acciones"
							value={filtersDraft.action || null}
							onChange={(value) =>
								setFiltersDraft((prev) => ({
									...prev,
									action: value ?? "",
								}))
							}
							data={actions}
							clearable
							size="sm"
						/>
					</Grid.Col>
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<TextInput
							label="ID de actor"
							placeholder="Filtrar por usuario"
							value={filtersDraft.actorUserId}
							onChange={(event) =>
								setFiltersDraft((prev) => ({
									...prev,
									actorUserId: event.currentTarget.value,
								}))
							}
							size="sm"
						/>
					</Grid.Col>
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<TextInput
							label="Desde"
							type="date"
							value={filtersDraft.dateFrom}
							onChange={(event) =>
								setFiltersDraft((prev) => ({
									...prev,
									dateFrom: event.currentTarget.value,
								}))
							}
							size="sm"
						/>
					</Grid.Col>
					<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
						<TextInput
							label="Hasta"
							type="date"
							value={filtersDraft.dateTo}
							onChange={(event) =>
								setFiltersDraft((prev) => ({
									...prev,
									dateTo: event.currentTarget.value,
								}))
							}
							size="sm"
						/>
					</Grid.Col>
				</Grid>
			</FilterBar>

			{/* Results table */}
			<Paper withBorder radius="lg" p="md" shadow="sm">
				<Stack gap="md">
					<Group justify="space-between" wrap="nowrap">
						<Title order={5} className="text-sm font-semibold text-zinc-900">
							Registros de auditoría
							{auditQuery.data ? (
								<Text component="span" c="dimmed" size="sm" ml="xs">
									({auditQuery.data.total} total)
								</Text>
							) : null}
						</Title>
					</Group>

					{auditQuery.isPending ? (
						<Group justify="center" py="xl">
							<Loader size="sm" />
						</Group>
					) : null}

					{auditQuery.isError ? (
						<Alert
							color="red"
							variant="light"
							icon={<AlertCircle size={16} />}
							radius="md"
						>
							{getErrorMessage(
								auditQuery.error,
								"No se pudieron cargar los registros de auditoría",
							)}
						</Alert>
					) : null}

					{auditQuery.data &&
					auditQuery.data.entries.length === 0 &&
					!auditQuery.isPending ? (
						<Paper
							className={`${adminUi.surface} text-center`}
							radius="lg"
							p={48}
							shadow="none"
						>
							<Stack align="center" gap="md">
								<Box className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 ring-1 ring-zinc-200">
									<Filter
										size={22}
										className="text-zinc-400"
										strokeWidth={1.5}
									/>
								</Box>
								<Text className="text-base font-semibold text-zinc-900">
									No se encontraron registros
								</Text>
								<Text
									size="sm"
									className="max-w-sm leading-relaxed text-zinc-500"
								>
									No hay registros de auditoría con los filtros actuales. Ajustá
									los filtros o realizá una operación para generar actividad.
								</Text>
							</Stack>
						</Paper>
					) : null}

					{auditQuery.data && auditQuery.data.entries.length > 0 ? (
						<>
							<Table.ScrollContainer minWidth={1100}>
								<Table
									striped
									withTableBorder
									withColumnBorders
									fz="sm"
									highlightOnHover
								>
									<Table.Thead>
										<Table.Tr>
											<Table.Th className={adminUi.tableHeader}>
												Fecha y hora
											</Table.Th>
											<Table.Th className={adminUi.tableHeader}>Actor</Table.Th>
											<Table.Th className={adminUi.tableHeader}>
												Entidad
											</Table.Th>
											<Table.Th className={adminUi.tableHeader}>
												Acción
											</Table.Th>
											<Table.Th className={adminUi.tableHeader}>
												Resumen
											</Table.Th>
										</Table.Tr>
									</Table.Thead>
									<Table.Tbody>
												{auditQuery.data.entries.map((entry) => (
													<Fragment key={entry.id}>
														<Table.Tr
													style={{
														background:
															expandedRowId === entry.id
																? "var(--mantine-color-gray-0)"
																: undefined,
													}}
												>
													<Table.Td>
														<Stack gap={2}>
															<Text size="sm" fw={500}>
																{formatDate(entry.createdAt)}
															</Text>
															<Text size="xs" c="dimmed">
																{formatTime(entry.createdAt)}
															</Text>
														</Stack>
													</Table.Td>
													<Table.Td>
														<ActorBadge
															actorType={entry.actorType}
															actorUserId={entry.actorUserId}
														/>
													</Table.Td>
													<Table.Td>
														<EntityCell
															entityType={entry.entityType}
															entityId={entry.entityId}
														/>
													</Table.Td>
													<Table.Td>
														<ActionBadge action={entry.action} />
													</Table.Td>
													<Table.Td>
														<Stack gap="xs">
															<Text size="sm" lineClamp={2}>
																{entry.summary}
															</Text>
															<Button
																variant="subtle"
																size="compact-xs"
																onClick={() =>
																	setExpandedRowId(
																		expandedRowId === entry.id
																			? null
																			: entry.id,
																	)
																}
																leftSection={
																	expandedRowId === entry.id ? (
																		<ChevronUp size={12} />
																	) : (
																		<ChevronDown size={12} />
																	)
																}
															>
																{expandedRowId === entry.id
																	? "Ocultar detalles"
																	: "Ver detalles"}
															</Button>
														</Stack>
													</Table.Td>
												</Table.Tr>
												<Table.Tr>
													<Table.Td colSpan={5}>
														<Collapse expanded={expandedRowId === entry.id}>
															<Paper withBorder p="md" bg="gray.0" radius="md">
																<Stack gap="md">
																	<Title
																		order={6}
																		className="text-xs font-semibold text-zinc-700 uppercase tracking-wider"
																	>
																		Payload
																	</Title>
																	<JsonPayloadViewer payload={entry.payload} />

																	{(entry.ipAddress || entry.userAgent) && (
																		<>
																			<Divider />
																			<Title
																				order={6}
																				className="text-xs font-semibold text-zinc-700 uppercase tracking-wider"
																			>
																				Metadatos
																			</Title>
																			<Stack gap="xs">
																				{entry.ipAddress && (
																					<Text size="xs" c="dimmed">
																						<Text component="span" fw={500}>
																							IP:{" "}
																						</Text>
																						{entry.ipAddress}
																					</Text>
																				)}
																				{entry.userAgent && (
																					<Text size="xs" c="dimmed">
																						<Text component="span" fw={500}>
																							User-Agent:{" "}
																						</Text>
																						<Text
																							component="span"
																							style={{
																								wordBreak: "break-all",
																								fontFamily: "monospace",
																								fontSize: rem(11),
																							}}
																						>
																							{entry.userAgent}
																						</Text>
																					</Text>
																				)}
																			</Stack>
																		</>
																	)}
																</Stack>
															</Paper>
														</Collapse>
													</Table.Td>
													</Table.Tr>
													</Fragment>
											))}
									</Table.Tbody>
								</Table>
							</Table.ScrollContainer>

							{/* Pagination */}
							<Group justify="space-between" align="center" wrap="nowrap">
								<Text size="sm" c="dimmed">
									Mostrando {auditQuery.data.entries.length} de{" "}
									{auditQuery.data.total} registros
								</Text>
								<Group gap="sm">
									<Button
										variant="light"
										size="sm"
										disabled={currentPage === 0}
										onClick={() => {
											setCurrentPage((p) => p - 1);
											setExpandedRowId(null);
										}}
									>
										Anterior
									</Button>
									<Text size="sm" className="font-mono">
										{currentPage + 1} / {totalPages || 1}
									</Text>
									<Button
										variant="light"
										size="sm"
										disabled={currentPage >= totalPages - 1}
										onClick={() => {
											setCurrentPage((p) => p + 1);
											setExpandedRowId(null);
										}}
									>
										Siguiente
									</Button>
								</Group>
							</Group>
						</>
					) : null}
				</Stack>
			</Paper>
		</Stack>
	);
}
