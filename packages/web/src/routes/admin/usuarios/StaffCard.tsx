import { Avatar, Badge, Card, Group, Stack, Text } from "@mantine/core";
import { CheckCircle2, UserX } from "lucide-react";
import { adminUi } from "../_shared/admin-ui";
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
			shadow="none"
			className={`${adminUi.surface} cursor-pointer transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px active:scale-[0.99] ${
				isSelected
					? "border-red-600/35 bg-gradient-to-br from-red-50/90 to-white ring-1 ring-red-600/20"
					: "border-zinc-200/90 bg-white"
			}`}
			onClick={onClick}
		>
			<Group align="flex-start" gap="md">
				<Avatar
					size="lg"
					radius="xl"
					className={
						profile.isActive
							? "border border-red-100 bg-red-50 font-bold text-red-800"
							: "border border-zinc-200 bg-zinc-100 font-semibold text-zinc-500"
					}
				>
					{initials}
				</Avatar>
				<Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
					<Group justify="space-between" wrap="nowrap">
						<Text
							fw={700}
							className={profile.isActive ? "text-zinc-900" : "text-zinc-400"}
							lineClamp={1}
						>
							{profile.user?.name || "Usuario"}
						</Text>
						{profile.isActive ? (
							<Badge
								color="teal"
								variant="light"
								size="sm"
								leftSection={<CheckCircle2 size={12} strokeWidth={2} />}
								styles={{ root: { textTransform: "none", fontWeight: 600 } }}
							>
								Activo
							</Badge>
						) : (
							<Badge
								color="gray"
								variant="light"
								size="sm"
								leftSection={<UserX size={12} strokeWidth={2} />}
								styles={{ root: { textTransform: "none", fontWeight: 600 } }}
							>
								Inactivo
							</Badge>
						)}
					</Group>
					<Text size="xs" c="dimmed" lineClamp={1}>
						{profile.user?.email}
					</Text>
					<Badge
						color={profile.isAssignable ? "red" : "gray"}
						variant="light"
						size="sm"
						styles={{ root: { textTransform: "none", fontWeight: 600 } }}
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
