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
				backgroundColor: "#f8f9fa",
				minHeight: "100vh",
				paddingBottom: "100px",
			}}
		>
			{/* Hero Section (Premium Red Banner) */}
			<Box
				style={{
					background: "linear-gradient(135deg, #e03131 0%, #c92a2a 100%)",
					position: "relative",
					overflow: "hidden",
					paddingTop: "5rem",
					paddingBottom: "8rem",
				}}
			>
				{/* Noise overlay */}
				<Box
					style={{
						position: "absolute",
						inset: 0,
						backgroundImage:
							"url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.05%22/%3E%3C/svg%3E')",
						pointerEvents: "none",
						zIndex: 0,
					}}
				/>
				{/* Subtle glow */}
				<Box
					style={{
						position: "absolute",
						top: "-50%",
						right: "10%",
						width: "800px",
						height: "800px",
						borderRadius: "50%",
						background:
							"radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%)",
						zIndex: 0,
					}}
				/>
				<Container size="lg" style={{ position: "relative", zIndex: 1 }}>
					<Group justify="space-between" align="center">
						<Stack gap={12} maw={650}>
							<Title
								order={1}
								c="white"
								style={{
									letterSpacing: "-1px",
									fontSize: "3rem",
									lineHeight: 1.1,
									fontWeight: 800,
									textWrap: "balance",
								}}
							>
								Agenda tu Trámite de Movilidad
							</Title>
							<Text
								c="rgba(255,255,255,0.9)"
								size="lg"
								fw={500}
								style={{ fontSize: "1.2rem", letterSpacing: "-0.2px" }}
							>
								Gestión ágil y segura para tus trámites de tránsito en Tuluá.
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
									opacity: 0.8,
								}}
							>
								<title>Dashed path</title>
								<path
									d="M 0 80 Q 150 50 250 10"
									fill="none"
									stroke="white"
									strokeWidth="2"
									strokeDasharray="6 8"
								/>
							</svg>
							{/* Bus Icon */}
							<Box
								style={{
									position: "absolute",
									top: -10,
									right: 0,
									zIndex: 2,
									opacity: 0.9,
								}}
							>
								<Bus size={56} color="white" strokeWidth={2} />
							</Box>
							{/* Car Icon */}
							<Box
								style={{
									position: "absolute",
									bottom: -10,
									right: 60,
									zIndex: 2,
									opacity: 0.9,
								}}
							>
								<CarFront size={32} color="white" strokeWidth={2} />
							</Box>
						</Box>
					</Group>
				</Container>
			</Box>

			<Container
				size="lg"
				style={{ marginTop: "-4.5rem", position: "relative", zIndex: 10 }}
			>
				{/* Quick Actions Card Grid */}
				<Paper
					radius="lg"
					p={0}
					style={{
						backgroundColor: "white",
						border: "1px solid #e5e7eb",
						boxShadow:
							"0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.025)",
						overflow: "hidden",
					}}
				>
					<SimpleGrid cols={{ base: 1, sm: 3 }} spacing={0}>
						{/* Action 1 */}
						<Box
							p="xl"
							style={{
								cursor: "pointer",
								transition: "all 0.2s ease",
								borderBottom: "1px solid #e5e7eb",
							}}
							className="action-card"
						>
							<Group wrap="nowrap" align="flex-start" gap="md">
								<Box
									style={{
										width: 48,
										height: 48,
										borderRadius: 12,
										backgroundColor: "#fee2e2",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										flexShrink: 0,
									}}
								>
									<CalendarDays size={24} color="#e03131" strokeWidth={2} />
								</Box>
								<div>
									<Text
										fw={700}
										size="md"
										c="#111827"
										mb={4}
										style={{ letterSpacing: "-0.3px" }}
									>
										Solicitar Cita
									</Text>
									<Text size="sm" c="#6b7280" style={{ lineHeight: 1.4 }}>
										Agenda tu turno en línea para atención presencial.
									</Text>
								</div>
							</Group>
						</Box>

						{/* Action 2 */}
						<Box
							p="xl"
							style={{
								cursor: "pointer",
								transition: "all 0.2s ease",
							}}
							className="action-card action-border-left"
						>
							<Group wrap="nowrap" align="flex-start" gap="md">
								<Box
									style={{
										width: 48,
										height: 48,
										borderRadius: 12,
										backgroundColor: "#dcfce7",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										flexShrink: 0,
									}}
								>
									<Check size={24} color="#16a34a" strokeWidth={2} />
								</Box>
								<div>
									<Text
										fw={700}
										size="md"
										c="#111827"
										mb={4}
										style={{ letterSpacing: "-0.3px" }}
									>
										Consultar Estado
									</Text>
									<Text size="sm" c="#6b7280" style={{ lineHeight: 1.4 }}>
										Revisa el estado actual de tu solicitud.
									</Text>
								</div>
							</Group>
						</Box>

						{/* Action 3 */}
						<Box
							p="xl"
							style={{
								cursor: "pointer",
								transition: "all 0.2s ease",
							}}
							className="action-card action-border-left"
						>
							<Group wrap="nowrap" align="flex-start" gap="md">
								<Box
									style={{
										width: 48,
										height: 48,
										borderRadius: 12,
										backgroundColor: "#f3f4f6",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										flexShrink: 0,
									}}
								>
									<FileText size={24} color="#4b5563" strokeWidth={2} />
								</Box>
								<div>
									<Text
										fw={700}
										size="md"
										c="#111827"
										mb={4}
										style={{ letterSpacing: "-0.3px" }}
									>
										Requisitos y Guías
									</Text>
									<Text size="sm" c="#6b7280" style={{ lineHeight: 1.4 }}>
										Información necesaria para tus trámites.
									</Text>
								</div>
							</Group>
						</Box>
					</SimpleGrid>
				</Paper>

				{/* Mis Citas Agendadas */}
				<Box mt={60}>
					<Title
						order={2}
						size="h3"
						c="#111827"
						mb="xl"
						fw={800}
						style={{ letterSpacing: "-0.5px" }}
					>
						Mis Citas Agendadas
					</Title>

					<Card
						radius="lg"
						p={0}
						bg="white"
						style={{
							border: "1px solid #e5e7eb",
							boxShadow:
								"0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)",
						}}
					>
						{/* Card Header */}
						<Group
							px="xl"
							py="md"
							style={{
								borderBottom: "1px solid #f3f4f6",
								backgroundColor: "#fafafa",
							}}
							gap="sm"
						>
							<Box
								style={{
									width: 24,
									height: 24,
									borderRadius: 999,
									backgroundColor: "#16a34a",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Check size={14} color="white" strokeWidth={3} />
							</Box>
							<Text fw={600} size="sm" c="#4b5563">
								Próxima Cita
							</Text>
						</Group>

						{/* Card Body */}
						<Box px="xl" py="lg" bg="white">
							<Group justify="space-between" align="center" wrap="nowrap">
								<Stack gap="sm" style={{ flexGrow: 1 }}>
									<Text
										fw={700}
										size="xl"
										c="#111827"
										style={{ letterSpacing: "-0.5px" }}
									>
										Martes, 15 Febrero 2022 • 10:30 AM
									</Text>
									<Divider color="#f3f4f6" w="100%" />
									<Text size="md" c="#4b5563">
										<span style={{ fontWeight: 600, color: "#111827" }}>
											Trámite:
										</span>{" "}
										Renovación de Licencia.
									</Text>
								</Stack>
								<Stack
									align="flex-end"
									justify="space-between"
									gap="xl"
									pl="xl"
								>
									<Badge
										style={{
											backgroundColor: "#dcfce7",
											color: "#166534",
											fontWeight: 600,
											textTransform: "none",
											borderRadius: "9999px",
											padding: "8px 12px",
											height: "auto",
											letterSpacing: "-0.2px",
										}}
									>
										Confirmada
									</Badge>
									<Button
										variant="subtle"
										color="gray"
										radius="md"
										size="sm"
										rightSection={<ChevronRight size={16} />}
										style={{
											fontWeight: 600,
											color: "#111827",
											paddingRight: 0,
										}}
										className="hover-arrow-btn"
									>
										Ver Detalles
									</Button>
								</Stack>
							</Group>
						</Box>
					</Card>
				</Box>
			</Container>

			{/* Custom CSS */}
			<style>{`
				.action-card:hover {
					background-color: #f9fafb;
				}
				.hover-arrow-btn:hover {
					background-color: transparent;
					color: #e03131 !important;
				}
				.hover-arrow-btn:hover .lucide-chevron-right {
					transform: translateX(4px);
					transition: transform 0.2s ease;
				}
				.lucide-chevron-right {
					transition: transform 0.2s ease;
				}
				@media (min-width: 768px) {
					.action-border-left {
						border-left: 1px solid #e5e7eb;
					}
					.action-card {
						border-bottom: none !important;
					}
				}
			`}</style>
		</Box>
	);
}
