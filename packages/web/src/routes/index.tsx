import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	Calendar,
	CheckCircle2,
	Clock,
	Clock3,
	FileText,
	MapPin,
	Shield,
	Sparkles,
	Star,
	TrendingUp,
	Users,
	Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card } from "../components/ui";
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

// Count-up animation hook
function useCountUp(target: string, duration = 2000, isVisible = false) {
	const [displayValue, setDisplayValue] = useState("0");
	const hasAnimated = useRef(false);

	useEffect(() => {
		if (!isVisible || hasAnimated.current) return;
		hasAnimated.current = true;

		const numericMatch = target.match(/[0-9.]+/);
		if (!numericMatch) {
			setDisplayValue(target);
			return;
		}

		const targetNum = Number.parseFloat(numericMatch[0]);
		const isDecimal = target.includes(".");
		const startTime = performance.now();

		const animate = (currentTime: number) => {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const easeProgress = 1 - (1 - progress) ** 3;
			const current = targetNum * easeProgress;

			if (isDecimal) {
				setDisplayValue(current.toFixed(1));
			} else {
				setDisplayValue(Math.floor(current).toString());
			}

			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				setDisplayValue(
					target.replace(
						/[0-9.]+/,
						isDecimal ? targetNum.toFixed(1) : targetNum.toString(),
					),
				);
			}
		};

		requestAnimationFrame(animate);
	}, [target, duration, isVisible]);

	return displayValue;
}

// Stat Card Component
function StatCard({
	stat,
	index,
}: {
	stat: {
		id: string;
		value: string;
		suffix: string;
		label: string;
		icon: React.ComponentType<{
			size?: number;
			className?: string;
			strokeWidth?: number;
		}>;
		variant: "brand" | "success" | "info" | "purple";
	};
	index: number;
}) {
	const { ref, isVisible } = useScrollAnimation(0.2);
	const countValue = useCountUp(stat.value, 2000, isVisible);

	const variantStyles = {
		brand: {
			bg: "var(--brand-100)",
			icon: "var(--brand-600)",
		},
		success: {
			bg: "var(--success-100)",
			icon: "var(--success-600)",
		},
		info: {
			bg: "var(--info-100)",
			icon: "var(--info-600)",
		},
		purple: {
			bg: "oklch(96% 0.03 290)",
			icon: "oklch(55% 0.15 290)",
		},
	};

	const styles = variantStyles[stat.variant];

	return (
		<div ref={ref} className="flex-1 min-w-[200px]">
			<AnimatedSection delay={index * 100}>
				<Card variant="elevated" padding="lg" className="text-center group">
					<div
						className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 transition-transform duration-500"
						style={{
							backgroundColor: styles.bg,
						}}
					>
						<stat.icon
							size={28}
							strokeWidth={1.5}
							style={{ color: styles.icon }}
							className="transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
						/>
					</div>

					<div
						className="font-['Sora'] font-extrabold tracking-tight"
						style={{
							fontSize: "clamp(2rem, 3vw, 3rem)",
							color: "var(--text-primary)",
							lineHeight: 1,
							fontVariantNumeric: "tabular-nums",
						}}
					>
						{countValue}
						<span
							className="text-lg font-semibold ml-1"
							style={{ color: styles.icon, opacity: 0.8 }}
						>
							{stat.suffix}
						</span>
					</div>

					<p
						className="text-sm font-medium mt-3"
						style={{ color: "var(--text-secondary)" }}
					>
						{stat.label}
					</p>
				</Card>
			</AnimatedSection>
		</div>
	);
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

// Service Card Component
function ServiceCard({
	service,
	index,
}: {
	service: {
		id: string;
		icon: React.ComponentType<{
			size?: number;
			className?: string;
			strokeWidth?: number;
		}>;
		title: string;
		description: string;
		variant: "brand" | "success" | "info" | "purple";
	};
	index: number;
}) {
	const variantStyles = {
		brand: {
			bg: "var(--brand-100)",
			icon: "var(--brand-600)",
		},
		success: {
			bg: "var(--success-100)",
			icon: "var(--success-600)",
		},
		info: {
			bg: "var(--info-100)",
			icon: "var(--info-600)",
		},
		purple: {
			bg: "oklch(96% 0.03 290)",
			icon: "oklch(55% 0.15 290)",
		},
	};

	const styles = variantStyles[service.variant];

	return (
		<AnimatedSection delay={index * 100}>
			<Card
				variant="elevated"
				padding="lg"
				className="h-full group cursor-pointer transition-transform duration-500 hover:-translate-y-1"
			>
				<div
					className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3"
					style={{ backgroundColor: styles.bg }}
				>
					<service.icon
						size={28}
						strokeWidth={1.5}
						style={{ color: styles.icon }}
					/>
				</div>
				<h3
					className="font-['Sora'] text-xl font-bold mb-3"
					style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}
				>
					{service.title}
				</h3>
				<p
					className="text-sm font-medium leading-relaxed"
					style={{ color: "var(--text-secondary)" }}
				>
					{service.description}
				</p>
			</Card>
		</AnimatedSection>
	);
}

// Testimonial Card Component
function TestimonialCard({
	testimonial,
	index,
}: {
	testimonial: {
		id: string;
		name: string;
		role: string;
		content: string;
		initials: string;
		rating: number;
	};
	index: number;
}) {
	return (
		<AnimatedSection delay={index * 150}>
			<Card
				variant="elevated"
				padding="lg"
				className="h-full transition-transform duration-500 hover:-translate-y-1"
			>
				<div className="flex flex-col h-full">
					<div
						className="w-12 h-12 rounded-full flex items-center justify-center mb-5"
						style={{ backgroundColor: "var(--brand-100)" }}
					>
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							aria-label="Quote icon"
						>
							<path
								d="M4 14c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2M4 14v4c0 1.1.9 2 2 2h16M4 14l2.5 2.5M20 14l-2.5 2.5"
								stroke="var(--brand-600)"
								strokeWidth="1.5"
								strokeLinecap="round"
							/>
						</svg>
					</div>

					<div className="flex mb-4">
						{Array.from({ length: 5 }).map((_, i) => (
							<Star
								key={i}
								size={16}
								className={i < testimonial.rating ? "fill-current" : ""}
								style={{
									color:
										i < testimonial.rating
											? "var(--warning-500)"
											: "var(--neutral-300)",
								}}
							/>
						))}
					</div>

					<p
						className="text-base font-medium leading-relaxed flex-1 italic"
						style={{ color: "var(--text-secondary)" }}
					>
						"{testimonial.content}"
					</p>

					<div
						className="flex items-center gap-3 mt-6 pt-4 border-t"
						style={{ borderColor: "var(--border-subtle)" }}
					>
						<div
							className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
							style={{
								backgroundColor: "var(--brand-100)",
								color: "var(--brand-700)",
							}}
						>
							{testimonial.initials}
						</div>
						<div>
							<p
								className="font-semibold text-sm"
								style={{ color: "var(--text-primary)" }}
							>
								{testimonial.name}
							</p>
							<p
								className="text-xs font-medium"
								style={{ color: "var(--text-tertiary)" }}
							>
								{testimonial.role}
							</p>
						</div>
					</div>
				</div>
			</Card>
		</AnimatedSection>
	);
}

// Floating Background Orbs Component
function FloatingOrbs() {
	return (
		<>
			<div
				className="absolute pointer-events-none"
				style={{
					top: "-15%",
					left: "-10%",
					width: "65vw",
					height: "65vw",
					maxWidth: "900px",
					maxHeight: "900px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, oklch(60% 0.15 25 / 0.08) 0%, oklch(60% 0.15 25 / 0.02) 40%, transparent 70%)",
					filter: "blur(80px)",
					animation: "orbFloat1 20s ease-in-out infinite",
				}}
			/>
			<div
				className="absolute pointer-events-none"
				style={{
					bottom: "-25%",
					right: "-15%",
					width: "55vw",
					height: "55vw",
					maxWidth: "800px",
					maxHeight: "800px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, oklch(65% 0.15 145 / 0.06) 0%, oklch(65% 0.15 145 / 0.01) 40%, transparent 70%)",
					filter: "blur(100px)",
					animation: "orbFloat2 25s ease-in-out infinite",
				}}
			/>
			<div
				className="absolute pointer-events-none"
				style={{
					top: "40%",
					right: "20%",
					width: "40vw",
					height: "40vw",
					maxWidth: "600px",
					maxHeight: "600px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, oklch(60% 0.15 25 / 0.05) 0%, transparent 60%)",
					filter: "blur(60px)",
					animation: "orbFloat3 18s ease-in-out infinite",
				}}
			/>
			<style>{`
				@keyframes orbFloat1 {
					0%, 100% { transform: translate(0, 0) scale(1); }
					33% { transform: translate(5vw, 8vh) scale(1.05); }
					66% { transform: translate(-3vw, 5vh) scale(0.95); }
				}
				@keyframes orbFloat2 {
					0%, 100% { transform: translate(0, 0) scale(1); }
					33% { transform: translate(-4vw, -6vh) scale(1.08); }
					66% { transform: translate(6vw, -3vh) scale(0.92); }
				}
				@keyframes orbFloat3 {
					0%, 100% { transform: translate(0, 0) scale(1); }
					50% { transform: translate(-8vw, 10vh) scale(1.1); }
				}
			`}</style>
		</>
	);
}

// Alternative Background Orbs (for services section)
function AlternativeOrbs() {
	return (
		<>
			<div
				className="absolute pointer-events-none"
				style={{
					top: "-20%",
					left: "-15%",
					width: "70vw",
					height: "70vw",
					maxWidth: "1000px",
					maxHeight: "1000px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, oklch(60% 0.12 250 / 0.06) 0%, oklch(60% 0.12 250 / 0.02) 40%, transparent 70%)",
					filter: "blur(90px)",
					animation: "orbFloatAlt1 22s ease-in-out infinite",
				}}
			/>
			<div
				className="absolute pointer-events-none"
				style={{
					bottom: "-30%",
					right: "-20%",
					width: "60vw",
					height: "60vw",
					maxWidth: "900px",
					maxHeight: "900px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, oklch(65% 0.1 200 / 0.05) 0%, oklch(65% 0.1 200 / 0.01) 40%, transparent 70%)",
					filter: "blur(110px)",
					animation: "orbFloatAlt2 28s ease-in-out infinite",
				}}
			/>
			<div
				className="absolute pointer-events-none"
				style={{
					top: "45%",
					right: "10%",
					width: "45vw",
					height: "45vw",
					maxWidth: "700px",
					maxHeight: "700px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, oklch(55% 0.12 270 / 0.04) 0%, transparent 60%)",
					filter: "blur(70px)",
					animation: "orbFloatAlt3 20s ease-in-out infinite",
				}}
			/>
			<div
				className="absolute pointer-events-none"
				style={{
					top: "10%",
					right: "35%",
					width: "30vw",
					height: "30vw",
					maxWidth: "500px",
					maxHeight: "500px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, oklch(65% 0.1 180 / 0.05) 0%, oklch(65% 0.1 180 / 0.02) 50%, transparent 70%)",
					filter: "blur(60px)",
					animation: "orbFloatAlt4 24s ease-in-out infinite",
				}}
			/>
			<style>{`
				@keyframes orbFloatAlt1 {
					0%, 100% { transform: translate(0, 0) scale(1); }
					33% { transform: translate(6vw, 10vh) scale(1.08); }
					66% { transform: translate(-4vw, 6vh) scale(0.95); }
				}
				@keyframes orbFloatAlt2 {
					0%, 100% { transform: translate(0, 0) scale(1); }
					33% { transform: translate(-6vw, -8vh) scale(1.05); }
					66% { transform: translate(8vw, -4vh) scale(0.92); }
				}
				@keyframes orbFloatAlt3 {
					0%, 100% { transform: translate(0, 0) scale(1); }
					50% { transform: translate(-10vw, 12vh) scale(1.12); }
				}
				@keyframes orbFloatAlt4 {
					0%, 100% { transform: translate(0, 0) scale(1); }
					25% { transform: translate(8vw, -6vh) scale(1.06); }
					75% { transform: translate(-6vw, 8vh) scale(0.94); }
				}
			`}</style>
		</>
	);
}

// CTA Section Orbs
function CtaOrbs() {
	return (
		<>
			<div
				className="absolute pointer-events-none"
				style={{
					top: "-40%",
					left: "-15%",
					width: "75vw",
					height: "75vw",
					maxWidth: "900px",
					maxHeight: "900px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, oklch(60% 0.15 25 / 0.18) 0%, oklch(60% 0.15 25 / 0.08) 40%, transparent 70%)",
					filter: "blur(100px)",
					animation: "ctaOrbFloat1 20s ease-in-out infinite",
				}}
			/>
			<div
				className="absolute pointer-events-none"
				style={{
					bottom: "-35%",
					right: "-15%",
					width: "65vw",
					height: "65vw",
					maxWidth: "800px",
					maxHeight: "800px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, oklch(65% 0.15 145 / 0.12) 0%, oklch(65% 0.15 145 / 0.04) 40%, transparent 70%)",
					filter: "blur(120px)",
					animation: "ctaOrbFloat2 25s ease-in-out infinite",
				}}
			/>
			<div
				className="absolute pointer-events-none"
				style={{
					top: "30%",
					right: "25%",
					width: "35vw",
					height: "35vw",
					maxWidth: "500px",
					maxHeight: "500px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, oklch(60% 0.12 250 / 0.1) 0%, oklch(60% 0.12 250 / 0.03) 50%, transparent 70%)",
					filter: "blur(80px)",
					animation: "ctaOrbFloat3 18s ease-in-out infinite",
				}}
			/>
			<style>{`
				@keyframes ctaOrbFloat1 {
					0%, 100% { transform: translate(0, 0) scale(1); }
					33% { transform: translate(5vw, 8vh) scale(1.05); }
					66% { transform: translate(-3vw, 5vh) scale(0.95); }
				}
				@keyframes ctaOrbFloat2 {
					0%, 100% { transform: translate(0, 0) scale(1); }
					33% { transform: translate(-4vw, -6vh) scale(1.08); }
					66% { transform: translate(6vw, -3vh) scale(0.92); }
				}
				@keyframes ctaOrbFloat3 {
					0%, 100% { transform: translate(0, 0) scale(1); }
					50% { transform: translate(-8vw, 10vh) scale(1.1); }
				}
			`}</style>
		</>
	);
}

// Grid Pattern Background
function GridPattern() {
	return (
		<div
			className="absolute inset-0 pointer-events-none"
			style={{
				backgroundImage: `
					linear-gradient(oklch(0% 0 0 / 0.02) 1px, transparent 1px),
					linear-gradient(90deg, oklch(0% 0 0 / 0.02) 1px, transparent 1px)
				`,
				backgroundSize: "60px 60px",
				maskImage:
					"radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 70%)",
				WebkitMaskImage:
					"radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 70%)",
			}}
		/>
	);
}

function LandingPage() {
	const { isAuthenticated, user } = useAuth();

	const stats = [
		{
			id: "stat-1",
			value: "15",
			suffix: "K+",
			label: "Trámites completados",
			icon: Users,
			variant: "brand" as const,
		},
		{
			id: "stat-2",
			value: "4.9",
			suffix: "/5",
			label: "Satisfacción del usuario",
			icon: Star,
			variant: "success" as const,
		},
		{
			id: "stat-3",
			value: "24",
			suffix: "h",
			label: "Disponibilidad",
			icon: Clock3,
			variant: "info" as const,
		},
		{
			id: "stat-4",
			value: "98",
			suffix: "%",
			label: "Tasa de resolución",
			icon: TrendingUp,
			variant: "purple" as const,
		},
	];

	const services = [
		{
			id: "svc-1",
			icon: Calendar,
			title: "Agendar Cita",
			description: "Programa tu visita en minutos. Sin filas, sin esperas.",
			variant: "brand" as const,
		},
		{
			id: "svc-2",
			icon: FileText,
			title: "Renovación de Licencia",
			description: "Renueva tu licencia de conducir de forma rápida y segura.",
			variant: "success" as const,
		},
		{
			id: "svc-3",
			icon: Shield,
			title: "Trámites de Tránsito",
			description: "Gestiona comparendos, matrículas y más documentación.",
			variant: "info" as const,
		},
		{
			id: "svc-4",
			icon: MapPin,
			title: "Puntos de Atención",
			description: "Encuentra la sede más cercana con toda la información.",
			variant: "purple" as const,
		},
	];

	const testimonials = [
		{
			id: "test-1",
			name: "María González",
			role: "Comerciante",
			content:
				"Agendar mi cita fue increíblemente fácil. En menos de 5 minutos tenía todo listo.",
			initials: "MG",
			rating: 5,
		},
		{
			id: "test-2",
			name: "Carlos Rodríguez",
			role: "Transportista",
			content:
				"Antes perdía horas en filas. Ahora llego a mi hora exacta y todo fluye perfecto.",
			initials: "CR",
			rating: 5,
		},
		{
			id: "test-3",
			name: "Ana Patricia",
			role: "Profesora",
			content:
				"La plataforma es intuitiva y el personal muy atento. Gran servicio para Tuluá.",
			initials: "AP",
			rating: 5,
		},
	];

	return (
		<div style={{ backgroundColor: "var(--bg-primary)" }}>
			{/* Hero Section */}
			<section
				className="relative min-h-screen overflow-hidden"
				style={{
					background: `linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-primary) 100%)`,
					paddingTop: "100px",
				}}
			>
				<GridPattern />
				<FloatingOrbs />

				<div
					className="container-xl relative z-10"
					style={{
						paddingTop: "var(--space-24)",
						paddingBottom: "var(--space-24)",
					}}
				>
					<div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
						{/* Hero Content */}
						<div className="lg:col-span-7">
							<AnimatedSection>
								<Badge variant="brand" size="lg" className="mb-6">
									<Sparkles size={14} className="mr-2" />
									Nuevo sistema digital 2025
								</Badge>

								<h1
									className="font-['Sora'] font-extrabold tracking-tight mb-6"
									style={{
										fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
										lineHeight: 1.1,
										color: "var(--text-primary)",
									}}
								>
									Tu trámite de{" "}
									<span
										style={{
											background: `linear-gradient(135deg, var(--brand-500) 0%, var(--brand-700) 100%)`,
											WebkitBackgroundClip: "text",
											WebkitTextFillColor: "transparent",
											backgroundClip: "text",
										}}
									>
										movilidad
									</span>
									, simplificado.
								</h1>

								<p
									className="font-['Public_Sans'] text-lg font-medium leading-relaxed mb-10 max-w-xl"
									style={{ color: "var(--text-secondary)" }}
								>
									Agenda citas, consulta estados y gestiona todos tus trámites
									de tránsito en Tuluá desde un solo lugar. Sin filas, sin
									esperas.
								</p>

								<div className="flex flex-wrap gap-4">
									<Link to={isAuthenticated ? "/agendar" : "/login"}>
										<Button size="lg" rightIcon={<ArrowRight size={18} />}>
											{isAuthenticated ? "Agendar ahora" : "Comenzar ahora"}
										</Button>
									</Link>
									<Link to="/agendar">
										<Button size="lg" variant="secondary">
											Ver servicios
										</Button>
									</Link>
								</div>
							</AnimatedSection>
						</div>

						{/* Hero Visual - Floating Cards */}
						<div className="lg:col-span-5 hidden lg:block">
							<AnimatedSection delay={200}>
								<div className="relative p-5">
									{/* Main Floating Card */}
									<div
										className="transition-transform duration-500 hover:rotate-0 hover:-translate-y-2"
										style={{
											backgroundColor: "oklch(100% 0 0 / 0.7)",
											borderRadius: "var(--radius-2xl)",
											padding: "4px",
											border: "1px solid var(--border-subtle)",
											backdropFilter: "blur(12px)",
											boxShadow: "var(--shadow-floating)",
											transform: "rotate(-2deg)",
										}}
									>
										<div
											style={{
												backgroundColor: "var(--bg-elevated)",
												borderRadius: "calc(var(--radius-2xl) - 2px)",
												padding: "var(--space-8)",
												border: "1px solid var(--border-subtle)",
											}}
										>
											<div className="flex items-center gap-4 mb-4">
												<div
													className="w-13 h-13 rounded-xl flex items-center justify-center"
													style={{ backgroundColor: "var(--brand-100)" }}
												>
													<CheckCircle2
														size={26}
														style={{ color: "var(--brand-600)" }}
														strokeWidth={2}
													/>
												</div>
												<div>
													<p
														className="font-['Sora'] text-lg font-bold"
														style={{ color: "var(--text-primary)" }}
													>
														Cita Confirmada
													</p>
													<p
														className="text-sm font-medium"
														style={{ color: "var(--text-secondary)" }}
													>
														Renovación de Licencia
													</p>
												</div>
											</div>

											<div
												className="border-t"
												style={{ borderColor: "var(--border-subtle)" }}
											/>

											<div className="flex items-center gap-2 mt-4">
												<Calendar
													size={16}
													style={{ color: "var(--text-tertiary)" }}
												/>
												<p
													className="text-sm font-medium"
													style={{ color: "var(--text-secondary)" }}
												>
													Viernes, 15 de Enero
												</p>
											</div>
											<div className="flex items-center gap-2 mt-2">
												<Clock
													size={16}
													style={{ color: "var(--text-tertiary)" }}
												/>
												<p
													className="text-sm font-medium"
													style={{ color: "var(--text-secondary)" }}
												>
													10:30 AM
												</p>
											</div>
										</div>
									</div>

									{/* Secondary Floating Card */}
									<div
										className="absolute -bottom-10 -right-5"
										style={{
											backgroundColor: "oklch(100% 0 0 / 0.9)",
											borderRadius: "var(--radius-xl)",
											padding: "var(--space-5) var(--space-6)",
											border: "1px solid var(--border-subtle)",
											backdropFilter: "blur(12px)",
											boxShadow: "var(--shadow-floating)",
											transform: "rotate(3deg)",
											zIndex: 2,
										}}
									>
										<div className="flex items-center gap-3">
											<div
												className="w-10 h-10 rounded-xl flex items-center justify-center"
												style={{ backgroundColor: "var(--success-100)" }}
											>
												<Zap
													size={20}
													style={{ color: "var(--success-600)" }}
												/>
											</div>
											<div>
												<p
													className="font-['Sora'] text-sm font-bold"
													style={{ color: "var(--text-primary)" }}
												>
													Atención Rápida
												</p>
												<p
													className="text-xs font-medium"
													style={{ color: "var(--text-tertiary)" }}
												>
													Promedio 15 min
												</p>
											</div>
										</div>
									</div>
								</div>
							</AnimatedSection>
						</div>
					</div>
				</div>
			</section>

			{/* Stats Section */}
			<section
				className="relative py-24 overflow-hidden"
				style={{
					background: `linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-secondary) 50%, var(--bg-elevated) 100%)`,
				}}
			>
				<div
					className="absolute inset-0 pointer-events-none"
					style={{
						backgroundImage: `
							linear-gradient(oklch(0% 0 0 / 0.015) 1px, transparent 1px),
							linear-gradient(90deg, oklch(0% 0 0 / 0.015) 1px, transparent 1px)
						`,
						backgroundSize: "80px 80px",
						maskImage:
							"radial-gradient(ellipse 90% 80% at 50% 50%, black 40%, transparent 80%)",
						WebkitMaskImage:
							"radial-gradient(ellipse 90% 80% at 50% 50%, black 40%, transparent 80%)",
					}}
				/>

				<div className="container-xl relative z-10">
					<AnimatedSection>
						<div className="text-center mb-16">
							<Badge variant="brand" className="mb-4">
								Resultados Reales
							</Badge>
							<h2
								className="font-['Sora'] text-3xl md:text-4xl font-extrabold tracking-tight"
								style={{ color: "var(--text-primary)" }}
							>
								Impacto medible en Tuluá
							</h2>
						</div>
					</AnimatedSection>

					<div className="flex flex-wrap gap-6 justify-center">
						{stats.map((stat, index) => (
							<StatCard key={stat.id} stat={stat} index={index} />
						))}
					</div>
				</div>
			</section>

			{/* Services Section */}
			<section className="relative py-32 overflow-hidden">
				<div
					className="absolute inset-0"
					style={{
						background: `linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-inset) 50%, var(--bg-secondary) 100%)`,
						zIndex: 0,
					}}
				>
					<AlternativeOrbs />
				</div>

				<div className="container-xl relative z-10">
					<AnimatedSection>
						<div className="text-center mb-16">
							<Badge variant="brand" className="mb-4">
								Servicios Disponibles
							</Badge>
							<h2
								className="font-['Sora'] text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6"
								style={{ color: "var(--text-primary)", lineHeight: 1.1 }}
							>
								Todo lo que necesitas
								<br />
								<span
									style={{
										background: `linear-gradient(135deg, var(--brand-500) 0%, var(--brand-700) 100%)`,
										WebkitBackgroundClip: "text",
										WebkitTextFillColor: "transparent",
										backgroundClip: "text",
									}}
								>
									en un solo lugar
								</span>
							</h2>
							<p
								className="font-['Public_Sans'] text-lg font-medium max-w-xl mx-auto"
								style={{ color: "var(--text-secondary)" }}
							>
								Gestiona tus trámites de forma digital, rápida y segura.
							</p>
						</div>
					</AnimatedSection>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
						{services.map((service, index) => (
							<ServiceCard key={service.id} service={service} index={index} />
						))}
					</div>
				</div>
			</section>

			{/* Upcoming Appointment Section */}
			{isAuthenticated && (
				<section
					className="py-20"
					style={{ backgroundColor: "var(--bg-elevated)" }}
				>
					<div className="container-lg">
						<AnimatedSection>
							<div
								style={{
									backgroundColor: "oklch(97% 0.03 25 / 0.5)",
									borderRadius: "var(--radius-2xl)",
									padding: "4px",
									border: "1px solid oklch(60% 0.15 25 / 0.15)",
								}}
							>
								<div
									className="p-8 md:p-10"
									style={{
										backgroundColor: "var(--bg-elevated)",
										borderRadius: "calc(var(--radius-2xl) - 2px)",
									}}
								>
									<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
										<div className="flex items-center gap-6">
											<div
												className="w-20 h-20 rounded-2xl flex items-center justify-center font-extrabold text-2xl"
												style={{
													backgroundColor: "var(--brand-100)",
													color: "var(--brand-700)",
													border: "3px solid var(--brand-500)",
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
											</div>
											<div>
												<Badge variant="success" size="md" className="mb-2">
													Próxima Cita Confirmada
												</Badge>
												<h3
													className="font-['Sora'] text-xl font-bold"
													style={{ color: "var(--text-primary)" }}
												>
													Renovación de Licencia
												</h3>
												<div className="flex flex-wrap gap-6 mt-3">
													<div className="flex items-center gap-2">
														<Calendar
															size={18}
															style={{ color: "var(--text-tertiary)" }}
														/>
														<span
															className="font-semibold"
															style={{ color: "var(--text-secondary)" }}
														>
															Viernes, 15 de Enero 2025
														</span>
													</div>
													<div className="flex items-center gap-2">
														<Clock
															size={18}
															style={{ color: "var(--text-tertiary)" }}
														/>
														<span
															className="font-semibold"
															style={{ color: "var(--text-secondary)" }}
														>
															10:30 AM
														</span>
													</div>
												</div>
											</div>
										</div>
										<Link to="/mi-perfil">
											<Button variant="secondary">Ver detalles</Button>
										</Link>
									</div>
								</div>
							</div>
						</AnimatedSection>
					</div>
				</section>
			)}

			{/* Testimonials Section */}
			<section
				className="py-32"
				style={{ backgroundColor: "var(--bg-primary)" }}
			>
				<div className="container-lg">
					<AnimatedSection>
						<div className="text-center mb-16">
							<Badge variant="brand" className="mb-4">
								Testimonios
							</Badge>
							<h2
								className="font-['Sora'] text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight"
								style={{ color: "var(--text-primary)" }}
							>
								Lo que dicen nuestros usuarios
							</h2>
						</div>
					</AnimatedSection>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						{testimonials.map((testimonial, index) => (
							<TestimonialCard
								key={testimonial.id}
								testimonial={testimonial}
								index={index}
							/>
						))}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section
				className="relative py-32 overflow-hidden"
				style={{ backgroundColor: "var(--neutral-900)" }}
			>
				<div
					className="absolute inset-0 pointer-events-none"
					style={{
						backgroundImage: `
							linear-gradient(oklch(100% 0 0 / 0.03) 1px, transparent 1px),
							linear-gradient(90deg, oklch(100% 0 0 / 0.03) 1px, transparent 1px)
						`,
						backgroundSize: "60px 60px",
						maskImage:
							"radial-gradient(ellipse 80% 60% at 50% 40%, black 40%, transparent 80%)",
						WebkitMaskImage:
							"radial-gradient(ellipse 80% 60% at 50% 40%, black 40%, transparent 80%)",
					}}
				/>
				<CtaOrbs />

				<div className="container-lg relative z-10">
					<AnimatedSection>
						<div className="text-center">
							<h2
								className="font-['Sora'] text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6"
								style={{ color: "var(--text-inverse)", lineHeight: 1.1 }}
							>
								Listo para agendar tu
								<br />
								<span style={{ color: "var(--brand-400)" }}>primera cita?</span>
							</h2>
							<p
								className="font-['Public_Sans'] text-xl font-medium max-w-2xl mx-auto mb-10"
								style={{ color: "oklch(100% 0 0 / 0.7)" }}
							>
								Únete a miles de ciudadanos que ya gestionan sus trámites de
								forma digital.
							</p>
							<Link to={isAuthenticated ? "/agendar" : "/login"}>
								<Button size="lg" rightIcon={<ArrowRight size={20} />}>
									{isAuthenticated ? "Agendar ahora" : "Crear cuenta gratis"}
								</Button>
							</Link>
						</div>
					</AnimatedSection>
				</div>
			</section>

			{/* Footer */}
			<footer
				className="py-16"
				style={{ backgroundColor: "var(--bg-primary)" }}
			>
				<div className="container-lg">
					<AnimatedSection>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
							{/* Logo & Description */}
							<div className="lg:col-span-1">
								<div className="flex items-center gap-3 mb-4">
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
											stroke="var(--success-600)"
											strokeWidth="5"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
										<path
											d="M29 9C29 9 24 6 19 10C14 14 17 20 23 20C29 20 31 26 27 31C23 36 15 33 15 33"
											stroke="var(--brand-600)"
											strokeWidth="5"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
									<h4
										className="font-['Sora'] text-xl font-extrabold"
										style={{ color: "var(--text-primary)" }}
									>
										SIMUT
									</h4>
								</div>
								<p
									className="text-sm font-medium max-w-xs"
									style={{ color: "var(--text-secondary)" }}
								>
									Sistema de Movilidad de Tuluá. Modernizando la gestión de
									trámites de tránsito para todos los ciudadanos.
								</p>
							</div>

							{/* Services */}
							<div>
								<h5
									className="font-['Sora'] text-sm font-bold uppercase tracking-wider mb-4"
									style={{ color: "var(--text-primary)" }}
								>
									Servicios
								</h5>
								<ul className="space-y-2">
									<li>
										<Link
											to="/agendar"
											className="text-sm font-medium transition-colors hover:underline"
											style={{ color: "var(--text-secondary)" }}
										>
											Agendar Cita
										</Link>
									</li>
									<li>
										<span
											className="text-sm font-medium"
											style={{ color: "var(--text-secondary)" }}
										>
											Consultar Estado
										</span>
									</li>
									<li>
										<span
											className="text-sm font-medium"
											style={{ color: "var(--text-secondary)" }}
										>
											Requisitos
										</span>
									</li>
								</ul>
							</div>

							{/* Account */}
							<div>
								<h5
									className="font-['Sora'] text-sm font-bold uppercase tracking-wider mb-4"
									style={{ color: "var(--text-primary)" }}
								>
									Cuenta
								</h5>
								<ul className="space-y-2">
									<li>
										<Link
											to="/login"
											className="text-sm font-medium transition-colors hover:underline"
											style={{ color: "var(--text-secondary)" }}
										>
											Iniciar Sesión
										</Link>
									</li>
									{isAuthenticated && (
										<li>
											<Link
												to="/mi-perfil"
												className="text-sm font-medium transition-colors hover:underline"
												style={{ color: "var(--text-secondary)" }}
											>
												Mi Perfil
											</Link>
										</li>
									)}
								</ul>
							</div>

							{/* Contact */}
							<div>
								<h5
									className="font-['Sora'] text-sm font-bold uppercase tracking-wider mb-4"
									style={{ color: "var(--text-primary)" }}
								>
									Contacto
								</h5>
								<ul className="space-y-2">
									<li className="flex items-center gap-2">
										<MapPin
											size={16}
											style={{ color: "var(--text-tertiary)" }}
										/>
										<span
											className="text-sm font-medium"
											style={{ color: "var(--text-secondary)" }}
										>
											Calle 26 # 28-41, Tuluá
										</span>
									</li>
									<li className="flex items-center gap-2">
										<Clock
											size={16}
											style={{ color: "var(--text-tertiary)" }}
										/>
										<span
											className="text-sm font-medium"
											style={{ color: "var(--text-secondary)" }}
										>
											Lun - Vie: 8:00 AM - 4:00 PM
										</span>
									</li>
								</ul>
							</div>
						</div>

						<div
							className="border-t mt-12 pt-8"
							style={{ borderColor: "var(--border-subtle)" }}
						>
							<p
								className="text-xs font-medium text-center"
								style={{ color: "var(--text-tertiary)" }}
							>
								2025 SIMUT - Sistema de Movilidad de Tuluá. Todos los derechos
								reservados.
							</p>
						</div>
					</AnimatedSection>
				</div>
			</footer>
		</div>
	);
}

export default LandingPage;
