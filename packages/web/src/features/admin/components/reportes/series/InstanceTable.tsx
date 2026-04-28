import { Badge, Button, Group, Loader, Table, Text } from "@mantine/core";
import { adminUi } from "#/features/admin/components/admin-ui";
import type { ReservationInstance } from "../types";

interface InstanceTableProps {
	instances: ReservationInstance[];
	selectedInstanceId: string | null;
	onSelectInstance: (id: string) => void;
	isLoading: boolean;
}

function getStatusBadgeProps(status: string) {
	const normalized = status.toLowerCase();
	if (normalized === "confirmed")
		return { color: "teal", variant: "light" as const };
	if (normalized === "held" || normalized === "pending")
		return { color: "yellow", variant: "light" as const };
	if (normalized === "cancelled")
		return { color: "red", variant: "light" as const };
	return { color: "gray", variant: "light" as const };
}

export function InstanceTable({
	instances,
	selectedInstanceId,
	onSelectInstance,
	isLoading,
}: InstanceTableProps) {
	if (isLoading) {
		return (
			<Group justify="center" py="md">
				<Loader size="sm" />
			</Group>
		);
	}

	if (instances.length === 0) {
		return (
			<Text c="dimmed" size="sm" className="text-center" py="md">
				No hay instancias activas para esta serie.
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
						<Table.Th className={adminUi.tableHeader}>Fecha</Table.Th>
						<Table.Th className={adminUi.tableHeader}>Hora</Table.Th>
						<Table.Th className={adminUi.tableHeader}>Estado</Table.Th>
						<Table.Th className={adminUi.tableHeader}>Staff</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{instances.map((instance) => (
						<Table.Tr
							key={instance.id}
							className={
								instance.id === selectedInstanceId ? "bg-red-50/40" : ""
							}
						>
							<Table.Td>
								<Button
									variant={
										instance.id === selectedInstanceId
											? "filled"
											: "light"
									}
									size="xs"
									onClick={() => onSelectInstance(instance.id)}
								>
									Usar
								</Button>
							</Table.Td>
							<Table.Td className="font-mono text-xs">
								{instance.id.slice(0, 8)}…
							</Table.Td>
							<Table.Td>
								{instance.slot?.slotDate ?? "-"}
							</Table.Td>
							<Table.Td>
								{instance.slot?.startTime ?? "--"} -{" "}
								{instance.slot?.endTime ?? "--"}
							</Table.Td>
							<Table.Td>
								<Badge
									{...getStatusBadgeProps(instance.status)}
									size="sm"
								>
									{instance.status}
								</Badge>
							</Table.Td>
							<Table.Td>{instance.staffUserId ?? "-"}</Table.Td>
						</Table.Tr>
					))}
				</Table.Tbody>
			</Table>
		</Table.ScrollContainer>
	);
}
