import { Badge, Box, Group } from "@mantine/core";

interface StatusBadgeProps {
	active: boolean;
	activeLabel?: string;
	inactiveLabel?: string;
}

export function StatusBadge({
	active,
	activeLabel = "Activo",
	inactiveLabel = "Inactivo",
}: StatusBadgeProps) {
	return (
		<Badge
			variant="light"
			color={active ? "teal" : "gray"}
			radius="sm"
			className="font-medium"
		>
			{active ? (
				<Group gap={4}>
					<Box className="w-1.5 h-1.5 rounded-full bg-teal-500" />
					{activeLabel}
				</Group>
			) : (
				<Group gap={4}>
					<Box className="w-1.5 h-1.5 rounded-full bg-gray-400" />
					{inactiveLabel}
				</Group>
			)}
		</Badge>
	);
}
