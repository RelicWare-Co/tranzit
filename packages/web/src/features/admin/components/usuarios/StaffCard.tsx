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

	const isActive = profile.isActive;
	const isAssignable = profile.isAssignable;

	return (
		<Card
			radius="lg"
			p="md"
			shadow="none"
			className={`cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.99] ${
				isSelected
					? "border-red-500 bg-red-50/60 ring-1 ring-red-500/30"
					: "border-zinc-200 bg-white hover:border-zinc-300"
			} ${!isActive ? "opacity-70" : ""}`}
			onClick={onClick}
		>
			<Group align="flex-start" gap="md">
				<Avatar
					size="md"
					radius="lg"
					className={
						isActive
							? "bg-red-50 font-semibold text-red-700 ring-1 ring-red-100"
							: "bg-zinc-100 font-semibold text-zinc-500 ring-1 ring-zinc-200"
					}
				>
					{initials}
				</Avatar>
				<Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
					<Group justify="space-between" wrap="nowrap">
						<Text
							fw={600}
							size="sm"
							className={isActive ? "text-zinc-900" : "text-zinc-400"}
							lineClamp={1}
						>
							{profile.user?.name || "Usuario"}
						</Text>
						{isActive ? (
							<Badge
								color="teal"
								variant="light"
								size="xs"
								leftSection={<CheckCircle2 size={10} strokeWidth={2.5} />}
								styles={{ root: { textTransform: "none", fontWeight: 600 } }}
							>
								Activo
							</Badge>
						) : (
							<Badge
								color="gray"
								variant="light"
								size="xs"
								leftSection={<UserX size={10} strokeWidth={2.5} />}
								styles={{ root: { textTransform: "none", fontWeight: 600 } }}
							>
								Inactivo
							</Badge>
						)}
					</Group>
					<Text size="xs" c="dimmed" lineClamp={1}>
						{profile.user?.email}
					</Text>
					{isAssignable ? (
						<Badge
							color="red"
							variant="light"
							size="xs"
							styles={{ root: { textTransform: "none", fontWeight: 600 } }}
						>
							Recibe citas
						</Badge>
					) : (
						<Badge
							color="gray"
							variant="light"
							size="xs"
							styles={{ root: { textTransform: "none", fontWeight: 600 } }}
						>
							No asignable
						</Badge>
					)}
					<CapacityIndicator
						current={currentBookings}
						max={profile.defaultDailyCapacity}
						isActive={isActive && isAssignable}
					/>
				</Stack>
			</Group>
		</Card>
	);
}
