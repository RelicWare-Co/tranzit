import { Alert, Box, Button, Collapse, Divider, Group, Loader, Paper, Stack, Table, Text, Title } from "@mantine/core";
import { AlertCircle } from "lucide-react";
import { Fragment } from "react";
import { adminUi } from "#/features/admin/components/admin-ui";
import { getErrorMessage } from "#/features/admin/components/errors";
import { JsonPayloadViewer } from "./JsonPayloadViewer";
import { ActorBadge } from "./ActorBadge";
import { ActionBadge } from "./ActionBadge";
import { EntityCell } from "./EntityCell";

interface AuditEntry {
	id: string;
	createdAt: string;
	actorType: string;
	actorUserId: string | null;
	entityType: string;
	entityId: string;
	action: string;
	summary: string;
	payload: Record<string, unknown>;
	ipAddress: string | null;
	userAgent: string | null;
}

interface AuditTableProps {
	entries: AuditEntry[];
	total: number;
	isLoading: boolean;
	isError: boolean;
	error: unknown;
	expandedRowId: string | null;
	onToggleRow: (id: string) => void;
}

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

export function AuditTable({
	entries,
	isLoading,
	isError,
	error,
	expandedRowId,
	onToggleRow,
}: AuditTableProps) {
	if (isLoading) {
		return (
			<Group justify="center" py="xl">
				<Loader size="sm" />
			</Group>
		);
	}

	if (isError) {
		return (
			<Alert
				color="red"
				variant="light"
				icon={<AlertCircle size={16} />}
				radius="md"
			>
				{getErrorMessage(error, "No se pudieron cargar los registros de auditoría")}
			</Alert>
		);
	}

	if (entries.length === 0) {
		return (
			<Paper
				className={`${adminUi.surfaceMuted} text-center`}
				radius="lg"
				p={48}
				shadow="none"
			>
				<Stack align="center" gap="md">
					<Box className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 ring-1 ring-zinc-200">
						<span className="text-xl">🔍</span>
					</Box>
					<Text className="text-base font-semibold text-zinc-900">
						No se encontraron registros
					</Text>
					<Text size="sm" className="max-w-sm leading-relaxed text-zinc-500">
						No hay registros de auditoría con los filtros actuales. Ajustá los
						filtros o realizá una operación para generar actividad.
					</Text>
				</Stack>
			</Paper>
		);
	}

	return (
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
						<Table.Th className={adminUi.tableHeader}>Entidad</Table.Th>
						<Table.Th className={adminUi.tableHeader}>Acción</Table.Th>
						<Table.Th className={adminUi.tableHeader}>Resumen</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{entries.map((entry) => (
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
											onClick={() => onToggleRow(entry.id)}
											leftSection={
												expandedRowId === entry.id ? (
													<span>▲</span>
												) : (
													<span>▼</span>
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
																			fontSize: "11px",
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
	);
}
