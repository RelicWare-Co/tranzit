import { Badge, Button, Group, Loader, Stack, Table, Text } from "@mantine/core";
import { adminUi } from "#/features/admin/components/admin-ui";

interface SeriesTableProps {
	series: Array<{
		id: string;
		isActive: boolean;
		activeInstanceCount?: number | null;
		notes?: string | null;
	}>;
	selectedSeriesId: string | null;
	onSelectSeries: (id: string) => void;
	isLoading: boolean;
	isError: boolean;
	error: unknown;
}

export function SeriesTable({
	series,
	selectedSeriesId,
	onSelectSeries,
	isLoading,
	isError,
	error,
}: SeriesTableProps) {
	if (isError) {
		return (
			<Stack gap="xs" py="md">
				<Text c="red" size="sm">
					Error cargando series
				</Text>
				<Text component="pre" size="xs" c="dimmed">
					{JSON.stringify(error, null, 2)}
				</Text>
			</Stack>
		);
	}

	if (isLoading) {
		return (
			<Group justify="center" py="md">
				<Loader size="sm" />
			</Group>
		);
	}

	if (series.length === 0) {
		return (
			<Text c="dimmed" size="sm" className="text-center" py="md">
				No hay series de reserva.
			</Text>
		);
	}

	return (
		<Table.ScrollContainer minWidth={960}>
			<Table striped withTableBorder withColumnBorders fz="sm">
				<Table.Thead>
					<Table.Tr>
						<Table.Th className={adminUi.tableHeader}>Seleccionar</Table.Th>
						<Table.Th className={adminUi.tableHeader}>ID</Table.Th>
						<Table.Th className={adminUi.tableHeader}>Estado</Table.Th>
						<Table.Th className={adminUi.tableHeader}>Instancias</Table.Th>
						<Table.Th className={adminUi.tableHeader}>Notas</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{series.map((s) => (
						<Table.Tr
							key={s.id}
							className={
								s.id === selectedSeriesId ? "bg-red-50/40" : ""
							}
						>
							<Table.Td>
								<Button
									variant={
										s.id === selectedSeriesId ? "filled" : "light"
									}
									size="xs"
									onClick={() => onSelectSeries(s.id)}
								>
									Usar
								</Button>
							</Table.Td>
							<Table.Td className="font-mono text-xs">
								{s.id.slice(0, 8)}…
							</Table.Td>
							<Table.Td>
								<Badge
									color={s.isActive ? "teal" : "gray"}
									variant="light"
									size="sm"
								>
									{s.isActive ? "Activa" : "Inactiva"}
								</Badge>
							</Table.Td>
							<Table.Td>
								{s.activeInstanceCount ?? "-"}
							</Table.Td>
							<Table.Td>
								<Text size="xs" c="dimmed" truncate maw={240}>
									{s.notes ?? "-"}
								</Text>
							</Table.Td>
						</Table.Tr>
					))}
				</Table.Tbody>
			</Table>
		</Table.ScrollContainer>
	);
}
