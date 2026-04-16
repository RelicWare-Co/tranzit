import { Avatar, Badge, Card, Group, Stack, Text } from "@mantine/core";
import { CheckCircle2, UserX } from "lucide-react";
import { CapacityIndicator } from "./CapacityIndicator";
import type { StaffProfile } from "./types";

export function StaffCard({
	profile,
	isSelected,
	onClick,
	currentBookings,
}: {
	profile: StaffProfile;
	isSelected: boolean;
	onClick: () => void;
	currentBookings: number;
}) {
	const initials =
		profile.user?.name
			?.split(" ")
			.map((part) => part[0])
			.join("")
			.slice(0, 2)
			.toUpperCase() || "U";

	return (
		<Card
			radius="xl"
			p="lg"
			bg={isSelected ? "#fef2f2" : "white"}
			style={{
				border: isSelected ? "2px solid #e03131" : "1px solid #e5e7eb",
				cursor: "pointer",
			}}
			onClick={onClick}
		>
			<Group align="flex-start" gap="md">
				<Avatar
					size="lg"
					radius="xl"
					bg={profile.isActive ? "#fef2f2" : "#f3f4f6"}
					c={profile.isActive ? "#e03131" : "#9ca3af"}
				>
					{initials}
				</Avatar>
				<Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
					<Group justify="space-between" wrap="nowrap">
						<Text
							fw={700}
							c={profile.isActive ? "#111827" : "gray.5"}
							lineClamp={1}
						>
							{profile.user?.name || "Usuario"}
						</Text>
						{profile.isActive ? (
							<Badge
								color="teal"
								variant="light"
								size="sm"
								leftSection={<CheckCircle2 size={12} />}
							>
								Activo
							</Badge>
						) : (
							<Badge
								color="gray"
								variant="light"
								size="sm"
								leftSection={<UserX size={12} />}
							>
								Inactivo
							</Badge>
						)}
					</Group>
					<Text size="xs" c="gray.5" lineClamp={1}>
						{profile.user?.email}
					</Text>
					<Badge
						color={profile.isAssignable ? "blue" : "gray"}
						variant="light"
						size="sm"
					>
						{profile.isAssignable ? "Recibe citas" : "No asignable"}
					</Badge>
					<CapacityIndicator
						current={currentBookings}
						max={profile.defaultDailyCapacity}
						isActive={profile.isActive && profile.isAssignable}
					/>
				</Stack>
			</Group>
		</Card>
	);
}
