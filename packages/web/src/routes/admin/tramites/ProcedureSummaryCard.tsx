import { Badge, Card, Group, Stack, Text } from "@mantine/core";
import { Car, FileCheck } from "lucide-react";
import type { ProcedureType } from "./types";

export function ProcedureSummaryCard({
	procedure,
	selected,
	onSelect,
}: {
	procedure: ProcedureType;
	selected: boolean;
	onSelect: () => void;
}) {
	const docCount =
		(procedure.documentSchema?.requirements as unknown[])?.length ?? 0;

	return (
		<Card
			onClick={onSelect}
			radius="xl"
			p="lg"
			bg={selected ? "#fef2f2" : "white"}
			style={{
				cursor: "pointer",
				border: selected ? "2px solid #e03131" : "1px solid #e5e7eb",
			}}
		>
			<Stack gap="xs">
				<Group justify="space-between" wrap="nowrap">
					<Text fw={700} lineClamp={1}>
						{procedure.name}
					</Text>
					<Badge variant="light" color={procedure.isActive ? "teal" : "gray"}>
						{procedure.isActive ? "Activo" : "Inactivo"}
					</Badge>
				</Group>
				<Text size="xs" c="dimmed">
					{procedure.slug}
				</Text>
				<Group gap="xs">
					{procedure.requiresVehicle && (
						<Badge
							color="orange"
							variant="light"
							leftSection={<Car size={10} />}
						>
							Vehículo
						</Badge>
					)}
					<Badge
						color={docCount > 0 ? "cyan" : "gray"}
						variant="light"
						leftSection={<FileCheck size={10} />}
					>
						{docCount} requisitos
					</Badge>
				</Group>
			</Stack>
		</Card>
	);
}
