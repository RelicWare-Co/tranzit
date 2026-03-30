import {
	Avatar,
	Badge,
	Box,
	Container,
	Divider,
	Grid,
	Group,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	Calendar,
	CheckCircle2,
	Clock,
	FileText,
	MapPin,
	Shield,
	Sparkles,
	Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/AuthContext";

export const Route = createFileRoute("/")({
	component: LandingPage,
});

// Scroll animation hook using IntersectionObserver
function useScrollAnimation(threshold = 0.1) {
	const ref = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setIsVisible(true);
					observer.unobserve(entry.target);
				}
			},
			{ threshold, rootMargin: "0px 0px -50px 0px" },
		);

		if (ref.current) {
			observer.observe(ref.current);
		}

		return () => observer.disconnect();
	}, [threshold]);

	return { ref, isVisible };
}

// Animated section wrapper
function AnimatedSection({
	children,
	className = "",
	delay = 0,
}: {
	children: React.ReactNode;
	className?: string;
	delay?: number;
}) {
	const { ref, isVisible } = useScrollAnimation();

	return (
		<div
			ref={ref}
			className={className}
			style={{
				opacity: isVisible ? 1 : 0,
				transform: isVisible ? "translateY(0)" : "translateY(40px)",
				filter: isVisible ? "blur(0)" : "blur(4px)",
				transition: `all 800ms cubic-bezier(0.32, 0.72, 0, 1) ${delay}ms`,
				willChange: "transform, opacity",
			}}
		>
			{children}
		</div>
	);
}

// Double Bezel Card Component
function BezelCard({
	children,
	className = "",
	style = {},
}: {
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
}) {
	return (
		<div
			className={className}
			style={{
				backgroundColor: "rgba(255, 255, 255, 0.6)",
				borderRadius: "28px",
				padding: "3px",
				border: "1px solid rgba(0, 0, 0, 0.06)",
				boxShadow:
					"0 20px 40px -20px rgba(0, 0, 0, 0.08), 0 8px 16px -8px rgba(0, 0, 0, 0.04)",
				...style,
			}}
		>
			<div
				style={{
					backgroundColor: "#ffffff",
					borderRadius: "25px",
					padding: "32px",
					border: "1px solid rgba(0, 0, 0, 0.04)",
					boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.8)",
					height: "100%",
				}}
			>
				{children}
			</div>
		</div>
	);
}

// Premium Button Component
function PremiumButton({
	children,
	to,
	onClick,
	variant = "primary",
	icon: Icon,
}: {
	children: React.ReactNode;
	to?: string;
	onClick?: () => void;
	variant?: "primary" | "secondary" | "outline";
	icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
	const baseStyles: React.CSSProperties = {
		display: "inline-flex",
		alignItems: "center",
		gap: "12px",
		padding: "16px 28px",
		borderRadius: "9999px",
		fontWeight: 600,
		fontSize: "15px",
		letterSpacing: "-0.2px",
		cursor: "pointer",
		transition: "all 500ms cubic-bezier(0.32, 0.72, 0, 1)",
		backgroundColor:
			variant === "primary"
				? "#e03131"
				: variant === "secondary"
					? "#111827"
					: "transparent",
		color: variant === "outline" ? "#111827" : "#ffffff",
		border:
			variant === "outline" ? "1.5px solid #e5e7eb" : "1.5px solid transparent",
		textDecoration: "none",
	};

	const iconStyles: React.CSSProperties = {
		width: "32px",
		height: "32px",
		borderRadius: "50%",
		backgroundColor:
			variant === "outline"
				? "rgba(0, 0, 0, 0.05)"
				: "rgba(255, 255, 255, 0.15)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		transition: "all 400ms cubic-bezier(0.32, 0.72, 0, 1)",
	};

	const buttonContent = (
		<span className="premium-btn" style={baseStyles}>
			<span>{children}</span>
			{Icon && (
				<span className="premium-btn-icon" style={iconStyles}>
					<Icon size={16} />
				</span>
			)}
		</span>
	);

	if (to) {
		return (
			<Link to={to} style={{ textDecoration: "none", display: "inline-block" }}>
				{buttonContent}
			</Link>
		);
	}

	return (
		<button
			type="button"
			onClick={onClick}
			style={{
				background: "none",
				border: "none",
				padding: 0,
				font: "inherit",
				display: "inline-block",
			}}
		>
			{buttonContent}
		</button>
	);
}

function LandingPage() {
	const { isAuthenticated, user } = useAuth();

	// Stats data
	const stats = [
		{ id: "stat-1", value: "15K+", label: "Trámites completados", suffix: "" },
		{
			id: "stat-2",
			value: "4.9",
			label: "Satisfacción del usuario",
			suffix: "/5",
		},
		{ id: "stat-3", value: "24h", label: "Disponibilidad", suffix: "" },
		{ id: "stat-4", value: "98%", label: "Tasa de resolución", suffix: "" },
	];

	// Services data
	const services = [
		{
			id: "svc-1",
			icon: Calendar,
			title: "Agendar Cita",
			description: "Programa tu visita en minutos. Sin filas, sin esperas.",
			color: "#fef2f2",
			iconColor: "#e03131",
		},
		{
			id: "svc-2",
			icon: FileText,
			title: "Renovación de Licencia",
			description: "Renueva tu licencia de conducir de forma rápida y segura.",
			color: "#dcfce7",
			iconColor: "#16a34a",
		},
		{
			id: "svc-3",
			icon: Shield,
			title: "Trámites de Tránsito",
			description: "Gestiona comparendos, matrículas y más documentación.",
			color: "#eff6ff",
			iconColor: "#2563eb",
		},
		{
			id: "svc-4",
			icon: MapPin,
			title: "Puntos de Atención",
			description: "Encuentra la sede más cercana con toda la información.",
			color: "#f5f3ff",
			iconColor: "#7c3aed",
		},
	];

	// Testimonials data
	const testimonials = [
		{
			id: "test-1",
			name: "María González",
			role: "Comerciante",
			content:
				"Agendar mi cita fue increíblemente fácil. En menos de 5 minutos tenía todo listo.",
			initials: "MG",
		},
		{
			id: "test-2",
			name: "Carlos Rodríguez",
			role: "Transportista",
			content:
				"Antes perdía horas en filas. Ahora llego a mi hora exacta y todo fluye perfecto.",
			initials: "CR",
		},
		{
			id: "test-3",
			name: "Ana Patricia",
			role: "Profesora",
			content:
				"La plataforma es intuitiva y el personal muy atento. Gran servicio para Tuluá.",
			initials: "AP",
		},
	];

	return (
		<Box style={{ backgroundColor: "#fafafa" }}>
			{/* Hero Section */}
			<Box
				style={{
					minHeight: "100dvh",
					position: "relative",
					overflow: "hidden",
					background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
				}}
			>
				{/* Subtle gradient orbs */}
				<Box
					style={{
						position: "absolute",
						top: "-20%",
						left: "-10%",
						width: "60vw",
						height: "60vw",
						borderRadius: "50%",
						background:
							"radial-gradient(circle, rgba(224, 49, 49, 0.08) 0%, transparent 60%)",
						filter: "blur(80px)",
						pointerEvents: "none",
					}}
				/>
				<Box
					style={{
						position: "absolute",
						bottom: "-30%",
						right: "-20%",
						width: "50vw",
						height: "50vw",
						borderRadius: "50%",
						background:
							"radial-gradient(circle, rgba(22, 163, 74, 0.06) 0%, transparent 60%)",
						filter: "blur(100px)",
						pointerEvents: "none",
					}}
				/>

				<Container
					size="xl"
					style={{
						height: "100%",
						position: "relative",
						zIndex: 1,
						paddingTop: "120px",
						paddingBottom: "120px",
					}}
				>
					<Grid gutter={80} align="center">
						<Grid.Col span={{ base: 12, md: 7 }}>
							<AnimatedSection>
								<Badge
									variant="light"
									color="red"
									size="lg"
									radius="xl"
									leftSection={
										<Box style={{ display: "flex", alignItems: "center" }}>
											<Sparkles size={14} />
										</Box>
									}
									style={{
										textTransform: "none",
										fontWeight: 600,
										fontSize: "13px",
										letterSpacing: "-0.2px",
										padding: "10px 16px 10px 12px",
										marginBottom: "24px",
										backgroundColor: "#fef2f2",
										color: "#e03131",
										border: "1px solid rgba(224, 49, 49, 0.15)",
										display: "inline-flex",
										alignItems: "center",
										gap: "6px",
									}}
								>
									Nuevo sistema digital 2025
								</Badge>

								<Title
									order={1}
									style={{
										fontSize: "clamp(40px, 6vw, 72px)",
										fontWeight: 800,
										letterSpacing: "-2.5px",
										lineHeight: 1.1,
										color: "#111827",
										marginBottom: "24px",
									}}
								>
									Tu trámite de{" "}
									<span
										style={{
											background:
												"linear-gradient(135deg, #e03131 0%, #c92a2a 100%)",
											WebkitBackgroundClip: "text",
											WebkitTextFillColor: "transparent",
											backgroundClip: "text",
											display: "inline-block",
										}}
									>
										movilidad
									</span>
									, simplificado.
								</Title>

								<Text
									size="xl"
									style={{
										color: "#4b5563",
										fontWeight: 500,
										lineHeight: 1.6,
										maxWidth: "540px",
										marginBottom: "40px",
										fontSize: "clamp(18px, 2vw, 22px)",
										letterSpacing: "-0.3px",
									}}
								>
									Agenda citas, consulta estados y gestiona todos tus trámites
									de tránsito en Tuluá desde un solo lugar. Sin filas, sin
									esperas.
								</Text>

								<Group gap="md">
									<PremiumButton
										to={isAuthenticated ? "/agendar" : "/login"}
										icon={ArrowRight}
									>
										{isAuthenticated ? "Agendar ahora" : "Comenzar ahora"}
									</PremiumButton>
									<PremiumButton to="/agendar" variant="outline">
										Ver servicios
									</PremiumButton>
								</Group>
							</AnimatedSection>
						</Grid.Col>

						<Grid.Col span={{ base: 12, md: 5 }} visibleFrom="md">
							<AnimatedSection delay={200}>
								<Box
									style={{
										position: "relative",
										padding: "20px",
									}}
								>
									{/* Floating cards composition */}
									<div
										className="floating-card-main"
										style={{
											backgroundColor: "rgba(255, 255, 255, 0.7)",
											borderRadius: "32px",
											padding: "4px",
											border: "1px solid rgba(0, 0, 0, 0.06)",
											backdropFilter: "blur(12px)",
											boxShadow: "0 32px 64px -24px rgba(0, 0, 0, 0.12)",
											transform: "rotate(-2deg)",
											transition:
												"transform 0.6s cubic-bezier(0.32, 0.72, 0, 1)",
										}}
									>
										<Box
											style={{
												backgroundColor: "#ffffff",
												borderRadius: "28px",
												padding: "32px",
												border: "1px solid rgba(0, 0, 0, 0.05)",
											}}
										>
											<Group gap="md" mb="md">
												<Box
													style={{
														width: "52px",
														height: "52px",
														borderRadius: "14px",
														backgroundColor: "#fef2f2",
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
													}}
												>
													<CheckCircle2
														size={26}
														color="#e03131"
														strokeWidth={2}
													/>
												</Box>
												<Stack gap={0}>
													<Text fw={700} c="#111827" size="lg">
														Cita Confirmada
													</Text>
													<Text size="sm" c="#6b7280">
														Renovación de Licencia
													</Text>
												</Stack>
											</Group>
											<Divider my="sm" color="#f3f4f6" />
											<Group gap="xs">
												<Calendar size={16} color="#6b7280" />
												<Text size="sm" c="#4b5563" fw={500}>
													Viernes, 15 de Enero
												</Text>
											</Group>
											<Group gap="xs" mt="xs">
												<Clock size={16} color="#6b7280" />
												<Text size="sm" c="#4b5563" fw={500}>
													10:30 AM
												</Text>
											</Group>
										</Box>
									</div>

									{/* Second floating element */}
									<Box
										style={{
											position: "absolute",
											bottom: "-40px",
											right: "-20px",
											backgroundColor: "rgba(255, 255, 255, 0.9)",
											borderRadius: "24px",
											padding: "20px 24px",
											border: "1px solid rgba(0, 0, 0, 0.06)",
											backdropFilter: "blur(12px)",
											boxShadow: "0 20px 40px -16px rgba(0, 0, 0, 0.1)",
											transform: "rotate(3deg)",
											zIndex: 2,
										}}
									>
										<Group gap="sm">
											<Box
												style={{
													width: "40px",
													height: "40px",
													borderRadius: "12px",
													backgroundColor: "#dcfce7",
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
												}}
											>
												<Zap size={20} color="#16a34a" />
											</Box>
											<Stack gap={0}>
												<Text fw={700} c="#111827" size="sm">
													Atención Rápida
												</Text>
												<Text size="xs" c="#6b7280">
													Promedio 15 min
												</Text>
											</Stack>
										</Group>
									</Box>
								</Box>
							</AnimatedSection>
						</Grid.Col>
					</Grid>
				</Container>

				<style>{`
					.floating-card-main:hover {
						transform: rotate(0deg) translateY(-8px) !important;
					}
				`}</style>
			</Box>

			{/* Stats Section */}
			<Box style={{ padding: "80px 0", backgroundColor: "#ffffff" }}>
				<Container size="xl">
					<AnimatedSection>
						<Grid gutter={40}>
							{stats.map((stat) => (
								<Grid.Col key={stat.id} span={{ base: 6, sm: 3 }}>
									<Box
										style={{
											textAlign: "center",
											padding: "24px",
										}}
									>
										<Text
											style={{
												fontSize: "clamp(32px, 4vw, 48px)",
												fontWeight: 800,
												color: "#111827",
												letterSpacing: "-2px",
												lineHeight: 1,
											}}
										>
											{stat.value}
											<Text
												component="span"
												style={{
													fontSize: "20px",
													color: "#9ca3af",
													fontWeight: 500,
												}}
											>
												{stat.suffix}
											</Text>
										</Text>
										<Text
											size="sm"
											c="#6b7280"
											fw={500}
											mt="sm"
											style={{ letterSpacing: "-0.2px" }}
										>
											{stat.label}
										</Text>
									</Box>
								</Grid.Col>
							))}
						</Grid>
					</AnimatedSection>
				</Container>
			</Box>

			{/* Services Section - Bento Grid Layout */}
			<Box style={{ padding: "120px 0", backgroundColor: "#fafafa" }}>
				<Container size="xl">
					<AnimatedSection>
						<Box style={{ textAlign: "center", marginBottom: "60px" }}>
							<Text
								size="sm"
								fw={700}
								c="#e03131"
								style={{
									textTransform: "uppercase",
									letterSpacing: "2px",
									marginBottom: "16px",
								}}
							>
								Servicios Disponibles
							</Text>
							<Title
								order={2}
								style={{
									fontSize: "clamp(32px, 4vw, 48px)",
									fontWeight: 800,
									letterSpacing: "-1.5px",
									color: "#111827",
									marginBottom: "16px",
								}}
							>
								Todo lo que necesitas
							</Title>
							<Text
								size="lg"
								c="#6b7280"
								maw={600}
								mx="auto"
								style={{ fontWeight: 500, letterSpacing: "-0.2px" }}
							>
								Gestiona tus trámites de forma digital, rápida y segura.
							</Text>
						</Box>
					</AnimatedSection>

					<Grid gutter={24}>
						{services.map((service, index) => (
							<Grid.Col key={service.id} span={{ base: 12, sm: 6, lg: 3 }}>
								<AnimatedSection delay={index * 100}>
									<Box
										className="service-card-wrapper"
										style={{
											cursor: "pointer",
											transition:
												"transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
										}}
									>
										<BezelCard style={{ height: "100%" }}>
											<Stack gap="md" style={{ height: "100%" }}>
												<Box
													className="service-icon"
													style={{
														width: "56px",
														height: "56px",
														borderRadius: "16px",
														backgroundColor: service.color,
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
														transition:
															"all 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
													}}
												>
													<service.icon
														size={28}
														color={service.iconColor}
														strokeWidth={1.5}
													/>
												</Box>
												<Title
													order={3}
													style={{
														fontSize: "20px",
														fontWeight: 700,
														letterSpacing: "-0.5px",
														color: "#111827",
													}}
												>
													{service.title}
												</Title>
												<Text
													size="sm"
													c="#6b7280"
													style={{
														lineHeight: 1.6,
														fontWeight: 500,
													}}
												>
													{service.description}
												</Text>
											</Stack>
										</BezelCard>
									</Box>
								</AnimatedSection>
							</Grid.Col>
						))}
					</Grid>
				</Container>

				<style>{`
					.service-card-wrapper:hover {
						transform: translateY(-4px);
					}
					.service-card-wrapper:hover .service-icon {
						transform: scale(1.1) rotate(-3deg);
					}
				`}</style>
			</Box>

			{/* Upcoming Appointment Section (if authenticated) */}
			{isAuthenticated && (
				<Box style={{ padding: "80px 0", backgroundColor: "#ffffff" }}>
					<Container size="lg">
						<AnimatedSection>
							<Box
								style={{
									backgroundColor: "rgba(254, 242, 242, 0.5)",
									borderRadius: "32px",
									padding: "4px",
									border: "1px solid rgba(224, 49, 49, 0.12)",
								}}
							>
								<Box
									style={{
										backgroundColor: "#ffffff",
										borderRadius: "28px",
										padding: "40px",
									}}
								>
									<Group justify="space-between" align="center" wrap="nowrap">
										<Group gap="xl">
											<Avatar
												size={80}
												radius="xl"
												color="#e03131"
												style={{
													backgroundColor: "#fef2f2",
													border: "3px solid #e03131",
													fontWeight: 800,
													fontSize: "28px",
												}}
											>
												{user?.name
													?.split(" ")
													.map((n: string) => n[0])
													.join("")
													.slice(0, 2)
													.toUpperCase() ||
													user?.email?.[0].toUpperCase() ||
													"U"}
											</Avatar>
											<Stack gap="xs">
												<Badge
													color="green"
													variant="light"
													size="md"
													style={{
														textTransform: "none",
														fontWeight: 600,
														width: "fit-content",
													}}
												>
													Próxima Cita Confirmada
												</Badge>
												<Title order={3} c="#111827" fw={800}>
													Renovación de Licencia
												</Title>
												<Group gap="lg">
													<Group gap="xs">
														<Calendar size={18} color="#6b7280" />
														<Text fw={600} c="#4b5563">
															Viernes, 15 de Enero 2025
														</Text>
													</Group>
													<Group gap="xs">
														<Clock size={18} color="#6b7280" />
														<Text fw={600} c="#4b5563">
															10:30 AM
														</Text>
													</Group>
												</Group>
											</Stack>
										</Group>
										<PremiumButton to="/mi-perfil" variant="secondary">
											Ver detalles
										</PremiumButton>
									</Group>
								</Box>
							</Box>
						</AnimatedSection>
					</Container>
				</Box>
			)}

			{/* Testimonials Section */}
			<Box style={{ padding: "120px 0", backgroundColor: "#fafafa" }}>
				<Container size="lg">
					<AnimatedSection>
						<Box style={{ textAlign: "center", marginBottom: "60px" }}>
							<Text
								size="sm"
								fw={700}
								c="#e03131"
								style={{
									textTransform: "uppercase",
									letterSpacing: "2px",
									marginBottom: "16px",
								}}
							>
								Testimonios
							</Text>
							<Title
								order={2}
								style={{
									fontSize: "clamp(32px, 4vw, 48px)",
									fontWeight: 800,
									letterSpacing: "-1.5px",
									color: "#111827",
								}}
							>
								Lo que dicen nuestros usuarios
							</Title>
						</Box>
					</AnimatedSection>

					<Grid gutter={24}>
						{testimonials.map((testimonial, index) => (
							<Grid.Col key={testimonial.id} span={{ base: 12, md: 4 }}>
								<AnimatedSection delay={index * 150}>
									<Box
										className="testimonial-card-wrapper"
										style={{
											transition:
												"transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
										}}
									>
										<BezelCard style={{ height: "100%" }}>
											<Stack gap="lg" style={{ height: "100%" }}>
												<Box
													style={{
														width: "48px",
														height: "48px",
														borderRadius: "50%",
														backgroundColor: "#fef2f2",
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
													}}
												>
													<svg
														width="24"
														height="24"
														viewBox="0 0 24 24"
														fill="none"
														aria-label="Quote icon"
													>
														<path
															d="M4 14c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2M4 14v4c0 1.1.9 2 2 2h16M4 14l2.5 2.5M20 14l-2.5 2.5"
															stroke="#e03131"
															strokeWidth="1.5"
															strokeLinecap="round"
														/>
													</svg>
												</Box>
												<Text
													size="md"
													c="#374151"
													style={{
														lineHeight: 1.7,
														fontWeight: 500,
														fontStyle: "italic",
													}}
												>
													"{testimonial.content}"
												</Text>
												<Group gap="sm" mt="auto">
													<Avatar
														size="md"
														radius="xl"
														color="#e03131"
														style={{
															backgroundColor: "#fef2f2",
															fontWeight: 700,
															fontSize: "14px",
														}}
													>
														{testimonial.initials}
													</Avatar>
													<Stack gap={0}>
														<Text fw={700} c="#111827" size="sm">
															{testimonial.name}
														</Text>
														<Text size="xs" c="#6b7280" fw={500}>
															{testimonial.role}
														</Text>
													</Stack>
												</Group>
											</Stack>
										</BezelCard>
									</Box>
								</AnimatedSection>
							</Grid.Col>
						))}
					</Grid>
				</Container>

				<style>{`
					.testimonial-card-wrapper:hover {
						transform: translateY(-4px);
					}
				`}</style>
			</Box>

			{/* CTA Section */}
			<Box
				style={{
					padding: "120px 0",
					backgroundColor: "#111827",
					position: "relative",
					overflow: "hidden",
				}}
			>
				{/* Background gradient orbs */}
				<Box
					style={{
						position: "absolute",
						top: "-50%",
						left: "-20%",
						width: "80vw",
						height: "80vw",
						borderRadius: "50%",
						background:
							"radial-gradient(circle, rgba(224, 49, 49, 0.15) 0%, transparent 60%)",
						filter: "blur(120px)",
						pointerEvents: "none",
					}}
				/>
				<Box
					style={{
						position: "absolute",
						bottom: "-30%",
						right: "-10%",
						width: "60vw",
						height: "60vw",
						borderRadius: "50%",
						background:
							"radial-gradient(circle, rgba(22, 163, 74, 0.1) 0%, transparent 60%)",
						filter: "blur(100px)",
						pointerEvents: "none",
					}}
				/>

				<Container size="lg" style={{ position: "relative", zIndex: 1 }}>
					<AnimatedSection>
						<Box style={{ textAlign: "center" }}>
							<Title
								order={2}
								style={{
									fontSize: "clamp(36px, 5vw, 64px)",
									fontWeight: 800,
									letterSpacing: "-2px",
									color: "#ffffff",
									marginBottom: "24px",
									lineHeight: 1.1,
								}}
							>
								Listo para agendar tu
								<br />
								<Text
									component="span"
									style={{
										background:
											"linear-gradient(135deg, #e03131 0%, #ff6b6b 100%)",
										WebkitBackgroundClip: "text",
										WebkitTextFillColor: "transparent",
										backgroundClip: "text",
									}}
								>
									primera cita?
								</Text>
							</Title>
							<Text
								size="xl"
								maw={600}
								mx="auto"
								mb="xl"
								style={{
									color: "rgba(255, 255, 255, 0.7)",
									fontWeight: 500,
									letterSpacing: "-0.2px",
								}}
							>
								Únete a miles de ciudadanos que ya gestionan sus trámites de
								forma digital.
							</Text>
							<PremiumButton
								to={isAuthenticated ? "/agendar" : "/login"}
								icon={ArrowRight}
							>
								{isAuthenticated ? "Agendar ahora" : "Crear cuenta gratis"}
							</PremiumButton>
						</Box>
					</AnimatedSection>
				</Container>
			</Box>

			{/* Footer */}
			<Box style={{ padding: "60px 0", backgroundColor: "#fafafa" }}>
				<Container size="lg">
					<AnimatedSection>
						<Grid gutter={40}>
							<Grid.Col span={{ base: 12, md: 4 }}>
								<Group gap="sm" mb="md">
									<Box
										style={{
											position: "relative",
											width: 36,
											height: 36,
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										<svg
											width="36"
											height="36"
											viewBox="0 0 40 40"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
											aria-label="SIMUT Logo"
										>
											<path
												d="M22 10C22 10 17 8 13 12C9 16 12 21 17 21C22 21 24 26 21 30C18 34 11 31 11 31"
												stroke="#16a34a"
												strokeWidth="5"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
											<path
												d="M29 9C29 9 24 6 19 10C14 14 17 20 23 20C29 20 31 26 27 31C23 36 15 33 15 33"
												stroke="#e03131"
												strokeWidth="5"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</svg>
									</Box>
									<Title order={4} c="#111827" fw={800}>
										SIMUT
									</Title>
								</Group>
								<Text size="sm" c="#6b7280" maw={280}>
									Sistema de Movilidad de Tuluá. Modernizando la gestión de
									trámites de tránsito para todos los ciudadanos.
								</Text>
							</Grid.Col>

							<Grid.Col span={{ base: 6, md: 2 }}>
								<Stack gap="xs">
									<Text fw={700} c="#111827" size="sm" mb="sm">
										Servicios
									</Text>
									<Text component={Link} to="/agendar" size="sm" c="#6b7280">
										Agendar Cita
									</Text>
									<Text size="sm" c="#6b7280">
										Consultar Estado
									</Text>
									<Text size="sm" c="#6b7280">
										Requisitos
									</Text>
								</Stack>
							</Grid.Col>

							<Grid.Col span={{ base: 6, md: 2 }}>
								<Stack gap="xs">
									<Text fw={700} c="#111827" size="sm" mb="sm">
										Cuenta
									</Text>
									<Text component={Link} to="/login" size="sm" c="#6b7280">
										Iniciar Sesión
									</Text>
									{isAuthenticated && (
										<Text
											component={Link}
											to="/mi-perfil"
											size="sm"
											c="#6b7280"
										>
											Mi Perfil
										</Text>
									)}
								</Stack>
							</Grid.Col>

							<Grid.Col span={{ base: 12, md: 4 }}>
								<Stack gap="xs">
									<Text fw={700} c="#111827" size="sm" mb="sm">
										Contacto
									</Text>
									<Group gap="xs">
										<MapPin size={16} color="#6b7280" />
										<Text size="sm" c="#6b7280">
											Calle 26 # 28-41, Tuluá
										</Text>
									</Group>
									<Group gap="xs">
										<Clock size={16} color="#6b7280" />
										<Text size="sm" c="#6b7280">
											Lun - Vie: 8:00 AM - 4:00 PM
										</Text>
									</Group>
								</Stack>
							</Grid.Col>
						</Grid>

						<Divider my="xl" color="#e5e7eb" />

						<Text size="xs" c="#9ca3af" ta="center">
							2025 SIMUT - Sistema de Movilidad de Tuluá. Todos los derechos
							reservados.
						</Text>
					</AnimatedSection>
				</Container>
			</Box>

			<style>{`
				.premium-btn:hover {
					transform: translateY(-2px);
					box-shadow: 0 12px 24px -8px rgba(224, 49, 49, 0.4);
				}
				.premium-btn-outline:hover {
					transform: translateY(-2px);
					box-shadow: 0 12px 24px -8px rgba(0, 0, 0, 0.15);
				}
				.premium-btn:active, .premium-btn-outline:active {
					transform: scale(0.98) translateY(0) !important;
				}
				.premium-btn:hover .premium-btn-icon, .premium-btn-outline:hover .premium-btn-icon {
					transform: translateX(3px) translateY(-1px);
				}
			`}</style>
		</Box>
	);
}
