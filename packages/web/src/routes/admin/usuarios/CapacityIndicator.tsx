import { Box, Group, Progress, Text } from "@mantine/core";

export function CapacityIndicator({
	current,
	max,
	isActive,
}: {
	current: number;
	max: number;
	isActive: boolean;
}) {
	const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;

	if (!isActive) {
		return (
			<Box>
				<Text size="xs" c="gray.5" fw={600} mb={4}>
					Inactivo
				</Text>
				<Progress value={0} color="gray.3" size={8} radius="xl" />
			</Box>
		);
	}

	return (
		<Box>
			<Group justify="space-between" mb={4}>
				<Text size="xs" c="gray.7" fw={600}>
					{current} / {max} citas
				</Text>
				<Text size="xs" c={percentage >= 90 ? "red.6" : "teal.6"} fw={700}>
					{Math.round(percentage)}%
				</Text>
			</Group>
			<Progress
				value={percentage}
				color={
					percentage >= 90 ? "red.6" : percentage >= 70 ? "yellow.6" : "teal.6"
				}
				size={8}
				radius="xl"
			/>
		</Box>
	);
}
