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

	const getColor = () => {
		if (!isActive) return "gray";
		if (percentage >= 90) return "red";
		if (percentage >= 70) return "yellow";
		return "teal";
	};

	if (!isActive) {
		return (
			<Box>
				<Text size="xs" c="gray.5" fw={500} mb={4}>
					Inactivo
				</Text>
				<Progress value={0} color="gray.3" size={6} radius="xl" />
			</Box>
		);
	}

	return (
		<Box>
			<Group justify="space-between" mb={4}>
				<Text size="xs" c="gray.7" fw={600}>
					<span className="font-mono tabular-nums">{current}</span> /{" "}
					<span className="font-mono tabular-nums">{max}</span> citas
				</Text>
				<Text
					size="xs"
					c={`${getColor()}.6`}
					fw={700}
					className="font-mono tabular-nums"
				>
					{Math.round(percentage)}%
				</Text>
			</Group>
			<Progress value={percentage} color={getColor()} size={6} radius="xl" />
		</Box>
	);
}
