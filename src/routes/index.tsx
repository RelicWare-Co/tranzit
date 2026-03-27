import {
	Badge,
	Box,
	Button,
	Card,
	Container,
	Divider,
	Group,
	Paper,
	SimpleGrid,
	Stack,
	Text,
	ThemeIcon,
	Title,
} from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import {
	Bus,
	CalendarDays,
	CarFront,
	Check,
	ChevronRight,
	FileText,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: LandingPage });

function LandingPage() {
	return (
		<Box
			style={{
				backgroundColor: "#f4f6f8",
				minHeight: "100vh",
				paddingBottom: "100px",
			}}
		>
			{/* Hero Section (Red Banner) */}
			<Box
				style={{
					backgroundColor: "#ef4444",
					position: "relative",
					overflow: "hidden",
					paddingTop: "5rem",
					paddingBottom: "8rem",
				}}
			>
				{/* Background decorative spotlight */}
				<Box
					style={{
						position: "absolute",
						top: "-50%",
						right: "10%",
						width: "800px",
						height: "800px",
						borderRadius: "50%",
						background:
							"radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 60%)",
						zIndex: 0,
					}}
				/>
				<Container size="lg" style={{ position: "relative", zIndex: 1 }}>
					<Group justify="space-between" align="center">
						<Stack gap={8} maw={600}>
							<Title
								order={1}
								c="white"
								size="h1"
								fw={700}
								style={{ letterSpacing: "-0.5px", fontSize: "2.5rem" }}
							>
								Agenda tu Trámite de Movilidad
							</Title>
							<Text c="white" size="lg" fw={400} style={{ fontSize: "1.1rem" }}>
								Gestión ágil y segura para tus trámites de tránsito.
							</Text>
						</Stack>
						<Box
							visibleFrom="sm"
							style={{ position: "relative", width: "300px", height: "100px" }}
						>
							{/* Dashed line SVG */}
							<svg
								width="250"
								height="80"
								viewBox="0 0 250 80"
								style={{
									position: "absolute",
									bottom: 0,
									left: 0,
									zIndex: 0,
									opacity: 0.6,
								}}
							>
								<title>Dashed path</title>
								<path
									d="M 0 80 Q 150 50 250 10"
									fill="none"
									stroke="white"
									strokeWidth="3"
									strokeDasharray="6 8"
								/>
							</svg>
							{/* Bus Icon */}
							<Box
								style={{ position: "absolute", top: -10, right: 0, zIndex: 2 }}
							>
								<Bus size={56} color="white" strokeWidth={1.5} />
							</Box>
							{/* Car Icon */}
							<Box
								style={{
									position: "absolute",
									bottom: -10,
									right: 60,
									zIndex: 2,
								}}
							>
								<CarFront size={32} color="white" strokeWidth={1.5} />
							</Box>
						</Box>
					</Group>
				</Container>
			</Box>

			<Container
				size="lg"
				style={{ marginTop: "-4.5rem", position: "relative", zIndex: 10 }}
			>
				{/* Quick Actions Card */}
				<Paper
					shadow="xs"
					radius="md"
					p="lg"
					withBorder
					style={{ backgroundColor: "white", borderColor: "#e5e7eb" }}
				>
					<SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xl">
						{/* Action 1 */}
						<Group wrap="nowrap" align="center" gap="md">
							<ThemeIcon
								size={54}
								radius="md"
								color="red.6"
								variant="light"
								style={{ backgroundColor: "#fee2e2" }}
							>
								<CalendarDays size={28} color="#ef4444" strokeWidth={1.5} />
							</ThemeIcon>
							<div>
								<Text fw={700} size="md" c="dark.9" mb={2}>
									Solicitar Cita
								</Text>
								<Text size="sm" c="gray.6">
									Agenda tu turno en linea.
								</Text>
							</div>
						</Group>

						{/* Action 2 */}
						<Group
							wrap="nowrap"
							align="center"
							gap="md"
							style={{
								borderLeft: "1px solid #e5e7eb",
								paddingLeft: "1.5rem",
							}}
							className="action-col-2"
						>
							<ThemeIcon size={54} radius="xl" color="green.6" variant="filled">
								<Check size={32} color="white" strokeWidth={2.5} />
							</ThemeIcon>
							<div>
								<Text fw={700} size="md" c="dark.9" mb={2}>
									Consultar Estado
								</Text>
								<Text size="sm" c="gray.6">
									Revisa el estado de tu solicitud.
								</Text>
							</div>
						</Group>

						{/* Action 3 */}
						<Group
							wrap="nowrap"
							align="center"
							gap="md"
							style={{
								borderLeft: "1px solid #e5e7eb",
								paddingLeft: "1.5rem",
							}}
							className="action-col-3"
						>
							<ThemeIcon
								size={54}
								radius="md"
								color="dark.8"
								variant="outline"
								style={{ borderWidth: 2, backgroundColor: "transparent" }}
							>
								<FileText size={28} color="#343a40" strokeWidth={1.5} />
							</ThemeIcon>
							<div>
								<Text fw={700} size="md" c="dark.9" mb={2}>
									Requisitos y Guías
								</Text>
								<Text size="sm" c="gray.6">
									Información para tus trámites.
								</Text>
							</div>
						</Group>
					</SimpleGrid>
				</Paper>

				{/* Mis Citas Agendadas */}
				<Box mt={50}>
					<Title order={2} size="h3" c="dark.9" mb="xl" fw={700}>
						Mis Citas Agendadas
					</Title>

					<Card
						shadow="xs"
						radius="md"
						p={0}
						withBorder
						bg="white"
						style={{ borderColor: "#e5e7eb" }}
					>
						{/* Card Header */}
						<Group
							px="xl"
							py="md"
							style={{ borderBottom: "1px solid #e5e7eb" }}
							gap="xs"
						>
							<ThemeIcon size={24} radius="xl" color="green.6" variant="filled">
								<Check size={16} strokeWidth={3} />
							</ThemeIcon>
							<Text fw={600} size="md" c="dark.9">
								Próxima Cita{" "}
								<span
									style={{
										color: "#16a34a",
										borderBottom: "2px solid #16a34a",
										marginLeft: "4px",
									}}
								>
									Confirmada
								</span>
							</Text>
						</Group>

						{/* Card Body */}
						<Box px="xl" py="lg" bg="white">
							<Group justify="space-between" align="center" wrap="nowrap">
								<Stack gap="md" style={{ flexGrow: 1 }}>
									<Text fw={700} size="lg" c="dark.9">
										Martes, 15 Febrero 2022 • 10:30 AM
									</Text>
									<Divider color="#e5e7eb" w="100%" />
									<Text size="md" c="dark.9">
										<span style={{ fontWeight: 600 }}>Trámite:</span> Renovación
										de Licencia.
									</Text>
								</Stack>
								<Stack
									align="flex-end"
									justify="space-between"
									gap="xl"
									pl="xl"
									style={{
										borderLeft:
											"1px solid transparent" /* Keep layout stable */,
									}}
								>
									<Badge
										color="green.6"
										variant="filled"
										size="lg"
										radius="xl"
										px="md"
										style={{
											textTransform: "none",
											fontWeight: 600,
											fontSize: "14px",
											height: "30px",
										}}
									>
										Confirmada
									</Badge>
									<Button
										color="red.5"
										radius="md"
										size="sm"
										rightSection={<ChevronRight size={16} />}
										style={{ fontWeight: 500, backgroundColor: "#ef4444" }}
									>
										Ver Detalles
									</Button>
								</Stack>
							</Group>
						</Box>
					</Card>
				</Box>
			</Container>

			{/* Bottom Waves SVG (Pale green matching the image) */}
			<Box
				style={{
					position: "fixed",
					bottom: 0,
					left: 0,
					right: 0,
					zIndex: 0,
					pointerEvents: "none",
				}}
			>
				<svg
					viewBox="0 0 1440 320"
					style={{
						width: "100%",
						height: "auto",
						display: "block",
						marginBottom: "-10px",
					}}
				>
					<title>Background waves</title>
					<path
						fill="#dcfce7"
						fillOpacity="0.5"
						d="M0,224L60,213.3C120,203,240,181,360,186.7C480,192,600,224,720,229.3C840,235,960,213,1080,186.7C1200,160,1320,128,1380,112L1440,96L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
					></path>
				</svg>
				<svg
					viewBox="0 0 1440 320"
					style={{
						width: "100%",
						height: "auto",
						display: "block",
						position: "absolute",
						bottom: 0,
						left: 0,
						zIndex: -1,
					}}
				>
					<title>Background waves</title>
					<path
						fill="#bbf7d0"
						fillOpacity="0.3"
						d="M0,128L60,149.3C120,171,240,213,360,202.7C480,192,600,128,720,106.7C840,85,960,107,1080,133.3C1200,160,1320,192,1380,208L1440,224L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
					></path>
				</svg>
			</Box>

			{/* Custom CSS to handle responsive borders */}
			<style>{`
				@media (max-width: 768px) {
					.action-col-2, .action-col-3 {
						border-left: none !important;
						padding-left: 0 !important;
						border-top: 1px solid #e5e7eb;
						padding-top: 1.5rem;
					}
				}
			`}</style>
		</Box>
	);
}
