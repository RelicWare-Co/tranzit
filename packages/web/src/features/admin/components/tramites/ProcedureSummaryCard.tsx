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
			radius="lg"
			p="md"
			shadow="none"
			className={`cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.99] ${
				selected
					? "border-red-500 bg-red-50/60 ring-1 ring-red-500/30"
					: "border-zinc-200 bg-white hover:border-zinc-300"
			} ${!procedure.isActive ? "opacity-70" : ""}`}
		>
			<Stack gap="xs">
				<Group justify="space-between" wrap="nowrap">
					<Text fw={700} lineClamp={2} className="text-zinc-900">
						{procedure.name}
					</Text>
					<Badge
						variant="light"
						color={procedure.isActive ? "teal" : "gray"}
						size="sm"
					>
						{procedure.isActive ? "Activo" : "Inactivo"}
					</Badge>
				</Group>
				<Text size="xs" className="font-mono text-zinc-500">
					{procedure.slug}
				</Text>
				<Group gap="xs" wrap="nowrap">
					{procedure.requiresVehicle && (
						<Badge
							color="orange"
							variant="light"
							size="xs"
							leftSection={<Car size={10} strokeWidth={2} />}
							styles={{ root: { textTransform: "none", fontWeight: 600 } }}
						>
							Vehículo
						</Badge>
					)}
					<Badge
						color={docCount > 0 ? "dark" : "gray"}
						variant="light"
						size="xs"
						leftSection={<FileCheck size={10} strokeWidth={2} />}
						styles={{ root: { textTransform: "none", fontWeight: 600 } }}
					>
						{docCount} {docCount === 1 ? "requisito" : "requisitos"}
					</Badge>
				</Group>
			</Stack>
		</Card>
	);
}
