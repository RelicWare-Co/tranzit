import {
	Alert,
	Badge,
	Button,
	Code,
	Collapse,
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
	RefreshCw,
} from "lucide-react";
import { useCallback, useState } from "react";
import { orpcClient } from "../../../lib/orpc-client";
import { AdminPageHeader } from "../_shared/-AdminPageHeader";
import { getErrorMessage } from "../_shared/-errors";

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
	{ value: "booking", label: "booking" },
	{ value: "schedule_template", label: "schedule_template" },
	{ value: "calendar_override", label: "calendar_override" },
	{ value: "staff_profile", label: "staff_profile" },
	{ value: "staff_date_override", label: "staff_date_override" },
	{ value: "procedure_type", label: "procedure_type" },
	{ value: "service_request", label: "service_request" },
	{ value: "booking_series", label: "booking_series" },
];

// Common actions observed in the system
const actions = [
	{ value: "create", label: "create" },
	{ value: "update", label: "update" },
	{ value: "remove", label: "remove" },
	{ value: "confirm", label: "confirm" },
	{ value: "cancel", label: "cancel" },
	{ value: "release", label: "release" },
	{ value: "reassign", label: "reassign" },
	{ value: "hold", label: "hold" },
	{ value: "status_booking_held_to_confirmed", label: "status transition" },
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

function JsonPayloadViewer({
	payload,
	summary,
}: {
	payload: Record<string, unknown>;
	summary: string;
}) {
	const [expanded, setExpanded] = useState(false);

	return (
		<Stack gap="xs">
			<Text size="sm" c="dimmed">
				{summary}
			</Text>
			<Button
				variant="subtle"
				size="xs"
				onClick={() => setExpanded(!expanded)}
				leftSection={
					expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />
				}
				justify="flex-start"
				p={0}
				h="auto"
			>
				{expanded ? "Ocultar payload" : "Ver payload"}
			</Button>
			<Collapse expanded={expanded}>
				<Paper withBorder p="xs" bg="gray.0">
					<pre
						style={{
							fontSize: rem(11),
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
							margin: 0,
							maxHeight: 300,
							overflow: "auto",
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
				<Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>
					{actorUserId}
				</Text>
			) : null}
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
	}, []);

	const totalPages = auditQuery.data
		? Math.ceil(auditQuery.data.total / pageSize)
		: 0;

	const activeFiltersCount = Object.values(filters).filter(
		(v) => v !== "",
	).length;

	return (
		<Stack gap="xl">
			<AdminPageHeader
				title="Auditoría"
				description="Consulta y filtra el registro de auditoría de todas las operaciones del sistema."
				actions={
					<Group>
						{activeFiltersCount > 0 ? (
							<Badge color="blue" variant="light">
								{activeFiltersCount} filtro(s) activo(s)
							</Badge>
						) : null}
						<Button
							leftSection={<RefreshCw size={16} />}
							onClick={() => void refreshAll()}
							variant="light"
						>
							Refrescar
						</Button>
					</Group>
				}
			/>

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

			{/* Filters */}
			<Paper withBorder p="md">
				<Stack gap="md">
					<Title order={5}>Filtros</Title>
					<Grid>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<Select
								label="Tipo de entidad"
								placeholder="Todas"
								value={filtersDraft.entityType || null}
								onChange={(value) =>
									setFiltersDraft((prev) => ({
										...prev,
										entityType: value ?? "",
									}))
								}
								data={entityTypes}
								clearable
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<Select
								label="Acción"
								placeholder="Todas"
								value={filtersDraft.action || null}
								onChange={(value) =>
									setFiltersDraft((prev) => ({
										...prev,
										action: value ?? "",
									}))
								}
								data={actions}
								clearable
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<TextInput
								label="ID de actor (usuario)"
								placeholder="Filtrar por ID de usuario"
								value={filtersDraft.actorUserId}
								onChange={(event) =>
									setFiltersDraft((prev) => ({
										...prev,
										actorUserId: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 6 }}>
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
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 6 }}>
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
							/>
						</Grid.Col>
					</Grid>
					<Group justify="flex-end">
						<Button
							variant="default"
							onClick={() => {
								setFiltersDraft(defaultFilters);
								setFilters(defaultFilters);
								setCurrentPage(0);
							}}
						>
							Limpiar filtros
						</Button>
						<Button
							onClick={() => {
								setFilters(filtersDraft);
								setCurrentPage(0);
							}}
						>
							Aplicar filtros
						</Button>
					</Group>
				</Stack>
			</Paper>

			{/* Results table */}
			<Paper withBorder p="md">
				<Stack gap="md">
					<Group justify="space-between">
						<Title order={5}>
							Registros de auditoría{" "}
							{auditQuery.data ? (
								<Text component="span" c="dimmed" size="sm">
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
						<Alert color="red" icon={<AlertCircle size={16} />}>
							{getErrorMessage(
								auditQuery.error,
								"No se pudieron cargar los registros de auditoría",
							)}
						</Alert>
					) : null}

					{auditQuery.data && auditQuery.data.entries.length === 0 ? (
						<Alert color="gray" variant="light">
							No se encontraron registros de auditoría con los filtros actuales.
						</Alert>
					) : null}

					{auditQuery.data && auditQuery.data.entries.length > 0 ? (
						<>
							<Table.ScrollContainer minWidth={1100}>
								<Table striped withTableBorder withColumnBorders>
									<Table.Thead>
										<Table.Tr>
											<Table.Th>Fecha</Table.Th>
											<Table.Th>Actor</Table.Th>
											<Table.Th>Entidad</Table.Th>
											<Table.Th>Acción</Table.Th>
											<Table.Th>Resumen</Table.Th>
										</Table.Tr>
									</Table.Thead>
									<Table.Tbody>
										{auditQuery.data.entries.map((entry) => (
											<>
												<Table.Tr
													key={entry.id}
													style={{
														background:
															expandedRowId === entry.id
																? "var(--mantine-color-gray-0)"
																: undefined,
													}}
												>
													<Table.Td>
														<Stack gap={2}>
															<Text size="sm">
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
														<Stack gap={2}>
															<Badge size="sm" variant="light">
																{entry.entityType}
															</Badge>
															<Code
																style={{
																	wordBreak: "break-all",
																	fontSize: "var(--mantine-font-size-xs)",
																}}
															>
																{entry.entityId}
															</Code>
														</Stack>
													</Table.Td>
													<Table.Td>
														<Badge
															color={
																entry.action === "create"
																	? "green"
																	: entry.action === "update"
																		? "blue"
																		: entry.action === "remove"
																			? "red"
																			: entry.action === "confirm"
																				? "teal"
																				: entry.action === "cancel"
																					? "orange"
																					: entry.action === "release"
																						? "yellow"
																						: entry.action === "reassign"
																							? "violet"
																							: "gray"
															}
															size="sm"
														>
															{entry.action}
														</Badge>
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
															<Paper withBorder p="sm" bg="gray.0">
																<JsonPayloadViewer
																	payload={entry.payload}
																	summary=""
																/>
																{entry.ipAddress || entry.userAgent ? (
																	<Stack gap="xs" mt="sm">
																		{entry.ipAddress ? (
																			<Text size="xs" c="dimmed">
																				<strong>IP:</strong> {entry.ipAddress}
																			</Text>
																		) : null}
																		{entry.userAgent ? (
																			<Text
																				size="xs"
																				c="dimmed"
																				style={{ wordBreak: "break-all" }}
																			>
																				<strong>User-Agent:</strong>{" "}
																				{entry.userAgent}
																			</Text>
																		) : null}
																	</Stack>
																) : null}
															</Paper>
														</Collapse>
													</Table.Td>
												</Table.Tr>
											</>
										))}
									</Table.Tbody>
								</Table>
							</Table.ScrollContainer>

							{/* Pagination */}
							<Group justify="space-between" align="center">
								<Text size="sm" c="dimmed">
									Mostrando {auditQuery.data.entries.length} de{" "}
									{auditQuery.data.total} registros
								</Text>
								<Group>
									<Button
										variant="light"
										size="sm"
										disabled={currentPage === 0}
										onClick={() => setCurrentPage((p) => p - 1)}
									>
										Anterior
									</Button>
									<Text size="sm">
										Página {currentPage + 1} de {totalPages || 1}
									</Text>
									<Button
										variant="light"
										size="sm"
										disabled={currentPage >= totalPages - 1}
										onClick={() => setCurrentPage((p) => p + 1)}
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
