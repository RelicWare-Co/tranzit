import { Badge, Card, Group, Stack, Text } from "@mantine/core";
import { Car, FileCheck } from "lucide-react";
import { adminUi } from "../_shared/admin-ui";
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
			shadow="none"
			className={`${adminUi.surface} cursor-pointer transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px active:scale-[0.99] ${
				selected
					? "border-red-600/35 bg-gradient-to-br from-red-50/90 to-white ring-1 ring-red-600/20"
					: ""
			}`}
		>
			<Stack gap="xs">
				<Group justify="space-between" wrap="nowrap">
					<Text fw={700} lineClamp={1} className="text-zinc-900">
						{procedure.name}
					</Text>
					<Badge variant="light" color={procedure.isActive ? "teal" : "gray"}>
						{procedure.isActive ? "Activo" : "Inactivo"}
					</Badge>
				</Group>
				<Text size="xs" className="font-mono text-zinc-500">
					{procedure.slug}
				</Text>
				<Group gap="xs">
					{procedure.requiresVehicle ? (
						<Badge
							color="orange"
							variant="light"
							leftSection={<Car size={10} strokeWidth={2} />}
							styles={{ root: { textTransform: "none", fontWeight: 600 } }}
						>
							Vehículo
						</Badge>
					) : null}
					<Badge
						color={docCount > 0 ? "dark" : "gray"}
						variant="light"
						leftSection={<FileCheck size={10} strokeWidth={2} />}
						styles={{ root: { textTransform: "none", fontWeight: 600 } }}
					>
						{docCount} requisitos
					</Badge>
				</Group>
			</Stack>
		</Card>
	);
}
