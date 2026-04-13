import {
	Avatar,
	Badge,
	Box,
	Button,
	Card,
	Grid,
	Group,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Calendar, ClipboardList, Users } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";

export const Route = createFileRoute("/admin/")({
	component: AdminDashboard,
});

// Stat Card Component
function StatCard({
	value,
	label,
	icon: Icon,
	color,
	iconColor,
}: {
	value: string;
	label: string;
	icon: React.ComponentType<{ size?: number; color?: string }>;
	color: string;
	iconColor: string;
}) {
	return (
		<Card
			radius="xl"
			p="xl"
			bg="white"
			h="100%"
			style={{
				border: "1px solid #e5e7eb",
				boxShadow:
					"0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.025)",
			}}
		>
			<Stack gap="md">
				<Box
					style={{
						width: "56px",
						height: "56px",
						borderRadius: "16px",
						backgroundColor: color,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Icon size={28} color={iconColor} />
				</Box>
				<Stack gap={0}>
					<Text
						style={{
							fontSize: "32px",
							fontWeight: 800,
							color: "#111827",
							letterSpacing: "-1px",
							lineHeight: 1,
						}}
					>
						{value}
					</Text>
					<Text size="sm" c="#6b7280" fw={500}>
						{label}
					</Text>
				</Stack>
			</Stack>
		</Card>
	);
}

function AdminDashboard() {
	const { user } = useAuth();

	const stats = [
		{
			value: "1,247",
			label: "Citas hoy",
			icon: Calendar,
			color: "#fef2f2",
			iconColor: "#e03131",
		},
		{
			value: "8,932",
			label: "Usuarios registrados",
			icon: Users,
			color: "#dcfce7",
			iconColor: "#16a34a",
		},
		{
			value: "156",
			label: "Trámites pendientes",
			icon: ClipboardList,
			color: "#eff6ff",
			iconColor: "#2563eb",
		},
		{
			value: "98.2%",
			label: "Tasa de cumplimiento",
			icon: BarChart3,
			color: "#f5f3ff",
			iconColor: "#7c3aed",
		},
	];

	const recentAppointments = [
		{
			id: "1",
			name: "María González",
			service: "Renovación de Licencia",
			date: "Hoy, 10:30 AM",
			status: "confirmada",
		},
		{
			id: "2",
			name: "Carlos Rodríguez",
			service: "Traspaso de Propiedad",
			date: "Hoy, 11:00 AM",
			status: "en_proceso",
		},
		{
			id: "3",
			name: "Ana Patricia",
			service: "Matrícula Inicial",
			date: "Hoy, 11:30 AM",
			status: "confirmada",
		},
		{
			id: "4",
			name: "Juan Pérez",
			service: "Certificado de Tradición",
			date: "Hoy, 2:00 PM",
			status: "pendiente",
		},
	];

	return (
		<Stack gap="xl">
			{/* Welcome Section */}
			<Box>
				<Title
					order={1}
					c="#111827"
					style={{
						letterSpacing: "-1px",
						fontWeight: 800,
						fontSize: "32px",
					}}
				>
					Panel de Administración
				</Title>
				<Text size="lg" c="#6b7280" mt="xs">
					Bienvenido, {user?.name || user?.email}. Aquí puedes gestionar todas
					las operaciones del sistema.
				</Text>
			</Box>

			{/* Stats Grid */}
			<Grid gap="md">
				{stats.map((stat) => (
					<Grid.Col key={stat.label} span={{ base: 6, md: 3 }}>
						<StatCard {...stat} />
					</Grid.Col>
				))}
			</Grid>

			{/* Recent Appointments */}
			<Card
				radius="xl"
				p="xl"
				bg="white"
				style={{
					border: "1px solid #e5e7eb",
					boxShadow:
						"0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.025)",
				}}
			>
				<Group justify="space-between" mb="lg">
					<Group gap="sm">
						<Box
							style={{
								width: 40,
								height: 40,
								borderRadius: "10px",
								backgroundColor: "#fef2f2",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Calendar size={20} color="#e03131" />
						</Box>
						<Title
							order={3}
							c="#111827"
							style={{
								letterSpacing: "-0.5px",
								fontWeight: 700,
								fontSize: "20px",
							}}
						>
							Citas Recientes
						</Title>
					</Group>
					<Button
						variant="light"
						color="red"
						size="sm"
						style={{
							borderRadius: "8px",
							fontWeight: 600,
						}}
					>
						Ver todas
					</Button>
				</Group>

				<Stack gap="md">
					{recentAppointments.map((appointment) => (
						<Group
							key={appointment.id}
							justify="space-between"
							style={{
								padding: "16px",
								borderRadius: "12px",
								backgroundColor: "#f9fafb",
								border: "1px solid #e5e7eb",
							}}
						>
							<Group gap="md">
								<Avatar
									size="md"
									radius="xl"
									color="#e03131"
									style={{
										backgroundColor: "#fef2f2",
										fontWeight: 700,
									}}
								>
									{appointment.name
										.split(" ")
										.map((n) => n[0])
										.join("")
										.slice(0, 2)
										.toUpperCase()}
								</Avatar>
								<Stack gap={2}>
									<Text fw={600} c="#111827">
										{appointment.name}
									</Text>
									<Text size="sm" c="#6b7280">
										{appointment.service}
									</Text>
								</Stack>
							</Group>
							<Group gap="md">
								<Text size="sm" c="#6b7280">
									{appointment.date}
								</Text>
								<Badge
									color={
										appointment.status === "confirmada"
											? "green"
											: appointment.status === "en_proceso"
												? "blue"
												: "yellow"
									}
									variant="light"
									size="sm"
									style={{
										textTransform: "none",
										fontWeight: 600,
									}}
								>
									{appointment.status === "confirmada"
										? "Confirmada"
										: appointment.status === "en_proceso"
											? "En proceso"
											: "Pendiente"}
								</Badge>
							</Group>
						</Group>
					))}
				</Stack>
			</Card>
		</Stack>
	);
}
