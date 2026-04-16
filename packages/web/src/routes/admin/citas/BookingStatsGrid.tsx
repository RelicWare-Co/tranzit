import { Card, Grid, Stack, Text } from "@mantine/core";

type Stats = {
	citasHoy: number;
	confirmadas: number;
	pendientes: number;
	canceladas: number;
};

export function BookingStatsGrid({ stats }: { stats: Stats }) {
	return (
		<Grid gap="md">
			<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
				<Card
					radius="xl"
					p="lg"
					bg="white"
					style={{ border: "1px solid #e5e7eb" }}
				>
					<Stack gap="xs">
						<Text size="sm" c="#6b7280" fw={500}>
							Citas Hoy
						</Text>
						<Text
							style={{
								fontSize: "28px",
								fontWeight: 800,
								color: "#111827",
								letterSpacing: "-1px",
							}}
						>
							{stats.citasHoy}
						</Text>
					</Stack>
				</Card>
			</Grid.Col>
			<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
				<Card
					radius="xl"
					p="lg"
					bg="white"
					style={{ border: "1px solid #e5e7eb" }}
				>
					<Stack gap="xs">
						<Text size="sm" c="#6b7280" fw={500}>
							Confirmadas
						</Text>
						<Text
							style={{
								fontSize: "28px",
								fontWeight: 800,
								color: "#16a34a",
								letterSpacing: "-1px",
							}}
						>
							{stats.confirmadas}
						</Text>
					</Stack>
				</Card>
			</Grid.Col>
			<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
				<Card
					radius="xl"
					p="lg"
					bg="white"
					style={{ border: "1px solid #e5e7eb" }}
				>
					<Stack gap="xs">
						<Text size="sm" c="#6b7280" fw={500}>
							Pendientes
						</Text>
						<Text
							style={{
								fontSize: "28px",
								fontWeight: 800,
								color: "#f59e0b",
								letterSpacing: "-1px",
							}}
						>
							{stats.pendientes}
						</Text>
					</Stack>
				</Card>
			</Grid.Col>
			<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
				<Card
					radius="xl"
					p="lg"
					bg="white"
					style={{ border: "1px solid #e5e7eb" }}
				>
					<Stack gap="xs">
						<Text size="sm" c="#6b7280" fw={500}>
							Canceladas
						</Text>
						<Text
							style={{
								fontSize: "28px",
								fontWeight: 800,
								color: "#e03131",
								letterSpacing: "-1px",
							}}
						>
							{stats.canceladas}
						</Text>
					</Stack>
				</Card>
			</Grid.Col>
		</Grid>
	);
}
