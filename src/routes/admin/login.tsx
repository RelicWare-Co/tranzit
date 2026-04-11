import {
	Alert,
	Anchor,
	Badge,
	Box,
	Button,
	Card,
	Container,
	PasswordInput,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Lock, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext";

export const Route = createFileRoute("/admin/login")({
	component: AdminLoginPage,
});

function AdminLoginPage() {
	const navigate = useNavigate();
	const { login, isAuthenticated, isLoading: authLoading, user } = useAuth();
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [showOnboarding, setShowOnboarding] = useState(false);
	const [onboardingLoading, setOnboardingLoading] = useState(false);

	useEffect(() => {
		if (!authLoading && isAuthenticated) {
			if (user?.role?.includes("admin")) {
				navigate({ to: "/admin" });
				return;
			}
			fetch("/api/admin/onboard/status")
				.then((r) => r.json())
				.then((data) => {
					if (!data.adminExists) {
						setShowOnboarding(true);
					} else {
						navigate({ to: "/admin" });
					}
				})
				.catch(() => {
					setShowOnboarding(true);
				});
			return;
		}
	}, [isAuthenticated, authLoading, navigate, user]);

	const form = useForm({
		initialValues: {
			email: "",
			password: "",
		},
		validate: {
			email: (value) =>
				/^\S+@\S+$/.test(value) ? null : "Correo electrónico inválido",
			password: (value) =>
				value.length < 1 ? "La contraseña es requerida" : null,
		},
	});

	const handleSubmit = form.onSubmit(async (values) => {
		setError("");
		setLoading(true);

		try {
			await login(values.email, values.password);
		} catch (err) {
			setError(
				err instanceof Error && err.message
					? err.message
					: "Credenciales inválidas. Verifica tu correo y contraseña.",
			);
		} finally {
			setLoading(false);
		}
	});

	const handleOnboard = async () => {
		setOnboardingLoading(true);
		setError("");
		try {
			const res = await fetch("/api/admin/onboard", { method: "POST" });
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.message || "Error en el onboarding");
			}
			navigate({ to: "/admin" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error en el onboarding");
		} finally {
			setOnboardingLoading(false);
		}
	};

	const skipOnboarding = () => {
		setShowOnboarding(false);
		navigate({ to: "/admin" });
	};

	const inputStyles = {
		input: {
			backgroundColor: "#f9fafb",
			border: "1px solid #e5e7eb",
			borderRadius: "8px",
			color: "#111827",
			fontWeight: 500,
			"&:focus": {
				borderColor: "#e03131",
				boxShadow: "0 0 0 2px rgba(224, 49, 49, 0.15)",
			},
		},
		label: {
			fontWeight: 600,
			color: "#374151",
			marginBottom: "6px",
			letterSpacing: "-0.2px",
		},
	};

	if (showOnboarding) {
		return (
			<Box bg="#f8f9fa" mih="100vh">
				<Container size="xs">
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
						<Stack gap="xl">
							<Stack gap="xs" align="center" mb="md">
								<Box
									style={{
										width: 48,
										height: 48,
										borderRadius: "12px",
										backgroundColor: "#e03131",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										marginBottom: "16px",
									}}
								>
									<ShieldCheck size={24} color="white" />
								</Box>
								<Title
									order={2}
									c="#111827"
									style={{ letterSpacing: "-1px", fontWeight: 800 }}
								>
									Configurar Administrador
								</Title>
								<Text size="sm" c="#6b7280">
									No hay administradores en el sistema. Tu cuenta puede ser
									elevada a administrador principal.
								</Text>
								<Badge
									variant="light"
									color="green"
									size="lg"
									style={{ marginTop: "8px" }}
								>
									Primer administrador
								</Badge>
							</Stack>

							{error && (
								<Alert
									icon={<AlertCircle size={16} />}
									color="red"
									radius="md"
									style={{
										border: "1px solid #fca5a5",
										backgroundColor: "#fef2f2",
									}}
								>
									{error}
								</Alert>
							)}

							<Stack gap="sm">
								<Button
									fullWidth
									size="md"
									loading={onboardingLoading}
									onClick={handleOnboard}
									color="red"
									style={{
										borderRadius: "8px",
										fontWeight: 600,
										transition: "transform 0.1s ease",
									}}
								>
									Activar como Administrador
								</Button>
								<Button
									fullWidth
									size="md"
									variant="subtle"
									onClick={skipOnboarding}
									loading={onboardingLoading}
									style={{ borderRadius: "8px", fontWeight: 500 }}
								>
									Saltar por ahora
								</Button>
							</Stack>
						</Stack>
					</Card>
				</Container>
			</Box>
		);
	}

	return (
		<Box bg="#f8f9fa" mih="100vh" pt={160} pb={80}>
			<Container size="xs">
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
					<Stack gap="xl">
						<Stack gap="xs" align="center" mb="md">
							<Box
								style={{
									width: 48,
									height: 48,
									borderRadius: "12px",
									backgroundColor: "#e03131",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									marginBottom: "16px",
								}}
							>
								<Lock size={24} color="white" />
							</Box>
							<Title
								order={2}
								c="#111827"
								style={{ letterSpacing: "-1px", fontWeight: 800 }}
							>
								Acceso Administrativo
							</Title>
							<Text size="sm" c="#6b7280">
								Ingresa tus credenciales internas para acceder al backoffice
							</Text>
						</Stack>

						{error && (
							<Alert
								icon={<AlertCircle size={16} />}
								color="red"
								radius="md"
								style={{
									border: "1px solid #fca5a5",
									backgroundColor: "#fef2f2",
								}}
							>
								{error}
							</Alert>
						)}

						<form onSubmit={handleSubmit}>
							<Stack gap="lg">
								<TextInput
									label="Correo electrónico"
									placeholder="admin@simut.local"
									required
									{...form.getInputProps("email")}
									styles={inputStyles}
									size="md"
								/>

								<PasswordInput
									label="Contraseña"
									placeholder="••••••••"
									required
									{...form.getInputProps("password")}
									styles={inputStyles}
									size="md"
								/>

								<Button
									type="submit"
									fullWidth
									size="md"
									color="red"
									loading={loading}
									style={{
										borderRadius: "8px",
										fontWeight: 600,
										marginTop: "8px",
										transition: "transform 0.1s ease",
									}}
								>
									Iniciar sesión
								</Button>
							</Stack>
						</form>

						<Text size="sm" ta="center" c="#6b7280">
							<Anchor component={Link} to="/" fw={600} c="#111827">
								Volver al portal ciudadano
							</Anchor>
						</Text>
					</Stack>
				</Card>
			</Container>
		</Box>
	);
}
