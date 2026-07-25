import { Badge, Code, rem, Stack } from "@mantine/core";

interface ActorBadgeProps {
	actorType: string;
	actorUserId: string | null;
}

export function ActorBadge({ actorType, actorUserId }: ActorBadgeProps) {
	const color =
		actorType === "admin" ? "blue" : actorType === "citizen" ? "green" : "gray";

	return (
		<Stack gap={4}>
			<Badge color={color} size="sm" variant="light">
				{actorType}
			</Badge>
			{actorUserId ? (
				<Code style={{ fontSize: rem(10), wordBreak: "break-all" }}>
					{actorUserId.slice(0, 8)}...
				</Code>
			) : null}
		</Stack>
	);
}
