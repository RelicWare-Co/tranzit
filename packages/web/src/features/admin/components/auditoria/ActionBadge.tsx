import { Badge } from "@mantine/core";

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

interface ActionBadgeProps {
	action: string;
}

export function ActionBadge({ action }: ActionBadgeProps) {
	return (
		<Badge color={getActionBadgeColor(action)} size="sm" variant="light">
			{action}
		</Badge>
	);
}
