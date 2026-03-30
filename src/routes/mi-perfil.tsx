import {
	Avatar,
	Badge,
	Box,
	Button,
	Card,
	Container,
	Divider,
	Grid,
	Group,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	Calendar,
	Clock,
	Edit3,
	LogOut,
	Mail,
	MapPin,
	Phone,
	User,
} from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "../lib/AuthContext";

export const Route = createFileRoute("/mi-perfil")({
	component: ProfilePage,
});

function ProfilePage() {
	const { user, isAuthenticated, isLoading, logout } = useAuth();
	const navigate = useNavigate();

	// Redirect to login if not authenticated
	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			navigate({ to: "/login" });
		}
	}, [isAuthenticated, isLoading, navigate]);

	if (isLoading) {
		return (
			<Box bg="#f8f9fa" mih="100vh" py={60}>
				<Container size="lg">
					<Card
						p={60}
						radius="xl"
						bg="white"
						style={{
							border: "1px solid #e5e7eb",
							boxShadow:
								"0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.025)",
						}}
					>
						<Stack align="center" gap="md">
							<Box
								style={{
									width: 64,
									height: 64,
									borderRadius: "50%",
									backgroundColor: "#f3f4f6",
									animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
								}}
							/>
							<Box
								style={{
									width: 200,
									height: 24,
									borderRadius: 8,
									backgroundColor: "#f3f4f6",
									animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
									animationDelay: "0.1s",
								}}
							/>
							<Box
								style={{
									width: 150,
									height: 16,
									borderRadius: 8,
									backgroundColor: "#f3f4f6",
									animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
									animationDelay: "0.2s",
								}}
							/>
						</Stack>
					</Card>
				</Container>
			</Box>
		);
	}

	if (!isAuthenticated || !user) {
		return null;
	}

	const initials = user.name
		? user.name
				.split(" ")
				.map((n: string) => n[0])
				.join("")
				.slice(0, 2)
				.toUpperCase()
		: user.email?.[0].toUpperCase() || "U";

	const handleLogout = () => {
		logout();
		navigate({ to: "/" });
	};

	// Mock appointments data - in a real app, this would come from an API
	const appointments = [
		{
			id: "1",
			date: "15 de Enero, 2025",
			time: "10:00 AM",
			service: "Renovación de Licencia",
			status: "confirmada",
			location: "Sede Principal - Calle 26 # 28-41",
		},
	];

	return (
		<Box bg="#f8f9fa" mih="100vh" py={60}>
			<Container size="lg">
				<Stack gap="xl">
					{/* Profile Header */}
					<Card
						p={40}
						radius="xl"
						bg="white"
						style={{
							border: "1px solid #e5e7eb",
							boxShadow:
								"0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.025)",
						}}
					>
						<Grid gutter="xl">
							<Grid.Col span={{ base: 12, md: 4 }}>
								<Stack align="center" gap="md">
									<Avatar
										size={120}
										radius="xl"
										color="#e03131"
										style={{
											backgroundColor: "#fef2f2",
											border: "3px solid #e03131",
											fontWeight: 800,
											fontSize: "48px",
										}}
									>
										{initials}
									</Avatar>
									<Badge
										size="lg"
										color="green"
										variant="light"
										leftSection={
											<Box
												style={{
													width: 8,
													height: 8,
													borderRadius: "50%",
													backgroundColor: "#22c55e",
												}}
											/>
										}
										style={{
											textTransform: "none",
											fontWeight: 600,
										}}
									>
										Activo
									</Badge>
								</Stack>
							</Grid.Col>

							<Grid.Col span={{ base: 12, md: 8 }}>
								<Stack gap="md">
									<Group justify="space-between" align="flex-start">
										<Box>
											<Title
												order={2}
												c="#111827"
												style={{
													letterSpacing: "-1px",
													fontWeight: 800,
													fontSize: "28px",
												}}
											>
												{user.name || "Usuario"}
											</Title>
											<Text size="sm" c="#6b7280" mt={4}>
												{user.email}
											</Text>
										</Box>
										<Group gap="sm">
											<Button
												variant="light"
												color="gray"
												size="sm"
												leftSection={<Edit3 size={16} />}
												style={{
													borderRadius: "8px",
													fontWeight: 600,
												}}
											>
												Editar
											</Button>
											<Button
												variant="light"
												color="red"
												size="sm"
												leftSection={<LogOut size={16} />}
												onClick={handleLogout}
												style={{
													borderRadius: "8px",
													fontWeight: 600,
												}}
											>
												Cerrar Sesión
											</Button>
										</Group>
									</Group>

									<Divider my="md" />

									<Grid gutter="md">
										<Grid.Col span={{ base: 12, sm: 6 }}>
											<Group gap="sm">
												<Box
													style={{
														width: 40,
														height: 40,
														borderRadius: "10px",
														backgroundColor: "#f3f4f6",
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
													}}
												>
													<Mail size={20} color="#6b7280" />
												</Box>
												<Stack gap={0}>
													<Text size="xs" c="#9ca3af" fw={500}>
														Correo electrónico
													</Text>
													<Text size="sm" c="#111827" fw={600}>
														{user.email}
													</Text>
												</Stack>
											</Group>
										</Grid.Col>
										<Grid.Col span={{ base: 12, sm: 6 }}>
											<Group gap="sm">
												<Box
													style={{
														width: 40,
														height: 40,
														borderRadius: "10px",
														backgroundColor: "#f3f4f6",
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
													}}
												>
													<User size={20} color="#6b7280" />
												</Box>
												<Stack gap={0}>
													<Text size="xs" c="#9ca3af" fw={500}>
														Tipo de cuenta
													</Text>
													<Text size="sm" c="#111827" fw={600}>
														Ciudadano
													</Text>
												</Stack>
											</Group>
										</Grid.Col>
										<Grid.Col span={{ base: 12, sm: 6 }}>
											<Group gap="sm">
												<Box
													style={{
														width: 40,
														height: 40,
														borderRadius: "10px",
														backgroundColor: "#f3f4f6",
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
													}}
												>
													<Phone size={20} color="#6b7280" />
												</Box>
												<Stack gap={0}>
													<Text size="xs" c="#9ca3af" fw={500}>
														Teléfono
													</Text>
													<Text size="sm" c="#111827" fw={600}>
														{user.phone || "No registrado"}
													</Text>
												</Stack>
											</Group>
										</Grid.Col>
										<Grid.Col span={{ base: 12, sm: 6 }}>
											<Group gap="sm">
												<Box
													style={{
														width: 40,
														height: 40,
														borderRadius: "10px",
														backgroundColor: "#f3f4f6",
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
													}}
												>
													<MapPin size={20} color="#6b7280" />
												</Box>
												<Stack gap={0}>
													<Text size="xs" c="#9ca3af" fw={500}>
														Ubicación
													</Text>
													<Text size="sm" c="#111827" fw={600}>
														Tuluá, Valle del Cauca
													</Text>
												</Stack>
											</Group>
										</Grid.Col>
									</Grid>
								</Stack>
							</Grid.Col>
						</Grid>
					</Card>

					{/* Appointments Section */}
					<Card
						p={40}
						radius="xl"
						bg="white"
						style={{
							border: "1px solid #e5e7eb",
							boxShadow:
								"0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.025)",
						}}
					>
						<Group justify="space-between" align="center" mb="lg">
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
										fontSize: "22px",
									}}
								>
									Mis Citas Agendadas
								</Title>
							</Group>
							<Button
								component={Link}
								to="/agendar"
								variant="light"
								color="red"
								size="sm"
								leftSection={<Calendar size={16} />}
								style={{
									borderRadius: "8px",
									fontWeight: 600,
								}}
							>
								Agendar nueva cita
							</Button>
						</Group>

						{appointments.length > 0 ? (
							<Stack gap="md">
								{appointments.map((appointment) => (
									<Card
										key={appointment.id}
										p="md"
										radius="lg"
										bg="#f9fafb"
										style={{
											border: "1px solid #e5e7eb",
										}}
									>
										<Group justify="space-between" align="flex-start">
											<Group gap="md">
												<Box
													style={{
														width: 56,
														height: 56,
														borderRadius: "12px",
														backgroundColor: "white",
														border: "1px solid #e5e7eb",
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
														flexDirection: "column",
													}}
												>
													<Text size="xs" c="#9ca3af" fw={600}>
														ENE
													</Text>
													<Text
														size="xl"
														c="#111827"
														fw={800}
														style={{ lineHeight: 1 }}
													>
														15
													</Text>
												</Box>
												<Stack gap={4}>
													<Text size="md" c="#111827" fw={700}>
														{appointment.service}
													</Text>
													<Group gap="xs">
														<Badge
															size="sm"
															color="green"
															variant="light"
															style={{
																textTransform: "none",
																fontWeight: 600,
															}}
														>
															Confirmada
														</Badge>
														<Group gap={4}>
															<Clock size={14} color="#9ca3af" />
															<Text size="sm" c="#6b7280">
																{appointment.time}
															</Text>
														</Group>
													</Group>
													<Text size="sm" c="#6b7280">
														{appointment.location}
													</Text>
												</Stack>
											</Group>
										</Group>
									</Card>
								))}
							</Stack>
						) : (
							<Card
								p={40}
								radius="lg"
								bg="#f9fafb"
								style={{
									border: "1px dashed #e5e7eb",
									textAlign: "center",
								}}
							>
								<Stack align="center" gap="md">
									<Box
										style={{
											width: 64,
											height: 64,
											borderRadius: "16px",
											backgroundColor: "white",
											border: "1px solid #e5e7eb",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										<Calendar size={28} color="#d1d5db" />
									</Box>
									<Stack gap={4} align="center">
										<Text size="md" c="#111827" fw={600}>
											No tienes citas agendadas
										</Text>
										<Text size="sm" c="#6b7280" maw={300}>
											Programa tu primera cita para realizar trámites de
											movilidad de manera rápida y sencilla
										</Text>
									</Stack>
									<Button
										component={Link}
										to="/agendar"
										variant="light"
										color="red"
										size="md"
										leftSection={<Calendar size={18} />}
										mt="md"
										style={{
											borderRadius: "8px",
											fontWeight: 600,
										}}
									>
										Agendar mi primera cita
									</Button>
								</Stack>
							</Card>
						)}
					</Card>
				</Stack>
			</Container>
		</Box>
	);
}
