import { Badge, Code, Stack } from "@mantine/core";

interface EntityCellProps {
	entityType: string;
	entityId: string;
}

export function EntityCell({ entityType, entityId }: EntityCellProps) {
	return (
		<Stack gap={4}>
			<Badge size="sm" variant="outline" color="gray">
				{entityType}
			</Badge>
			<Code
				style={{
					wordBreak: "break-all",
					fontSize: "10px",
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
