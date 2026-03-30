import {
	Alert,
	Anchor,
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
import { AlertCircle, LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate();
	const { login, isAuthenticated, isLoading: authLoading } = useAuth();
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	// Redirect to profile if already authenticated
	useEffect(() => {
		if (!authLoading && isAuthenticated) {
			navigate({ to: "/mi-perfil" });
		}
	}, [isAuthenticated, authLoading, navigate]);

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
			navigate({ to: "/mi-perfil" });
		} catch (_err) {
			setError("Credenciales inválidas. Por favor intenta de nuevo.");
		} finally {
			setLoading(false);
		}
	});

	const inputStyles = {
		input: {
			backgroundColor: "#f9fafb",
			border: "1px solid #e5e7eb",
			borderRadius: "8px",
			color: "#111827",
			fontWeight: 500,
			"&:focus": {
				borderColor: "#111827",
				boxShadow: "0 0 0 2px rgba(17, 24, 39, 0.1)",
			},
		},
		label: {
			fontWeight: 600,
			color: "#374151",
			marginBottom: "6px",
			letterSpacing: "-0.2px",
		},
	};

	return (
		<Box bg="#f8f9fa" mih="100vh" py={80}>
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
									backgroundColor: "#111827",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									marginBottom: "16px",
								}}
							>
								<LogIn size={24} color="white" />
							</Box>
							<Title
								order={2}
								c="#111827"
								style={{ letterSpacing: "-1px", fontWeight: 800 }}
							>
								Bienvenido de nuevo
							</Title>
							<Text size="sm" c="#6b7280">
								Ingresa tus credenciales para acceder a tu cuenta
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
									placeholder="tu@email.com"
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
									loading={loading}
									style={{
										backgroundColor: "#111827",
										borderRadius: "8px",
										fontWeight: 600,
										marginTop: "8px",
										transition: "transform 0.1s ease",
									}}
									className="login-btn"
								>
									Iniciar Sesión
								</Button>
							</Stack>
						</form>

						<Text size="sm" ta="center" c="#6b7280" mt="md">
							¿No tienes cuenta?{" "}
							<Anchor component={Link} to="/" fw={600} c="#111827">
								Volver al inicio
							</Anchor>
						</Text>
					</Stack>
				</Card>
			</Container>
		</Box>
	);
}
