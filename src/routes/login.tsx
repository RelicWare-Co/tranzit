import {
	Alert,
	Anchor,
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
import { useState } from "react";
import pb from "#/lib/pb";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate();
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

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
			await pb
				.collection("users")
				.authWithPassword(values.email, values.password);
			navigate({ to: "/" });
		} catch (err) {
			setError("Credenciales inválidas. Por favor intenta de nuevo.");
		} finally {
			setLoading(false);
		}
	});

	return (
		<Container size="xs" py="xl">
			<Card shadow="sm" padding="xl" radius="md" withBorder>
				<Stack gap="lg">
					<Stack gap="xs" align="center">
						<Title order={2}>Iniciar Sesión</Title>
						<Text size="sm" c="dimmed">
							Ingresa tus credenciales para acceder
						</Text>
					</Stack>

					{error && (
						<Alert icon={<AlertCircle size={16} />} color="red" radius="md">
							{error}
						</Alert>
					)}

					<form onSubmit={handleSubmit}>
						<Stack gap="md">
							<TextInput
								label="Correo electrónico"
								placeholder="tu@email.com"
								required
								{...form.getInputProps("email")}
							/>

							<PasswordInput
								label="Contraseña"
								placeholder="Tu contraseña"
								required
								{...form.getInputProps("password")}
							/>

							<Button
								type="submit"
								fullWidth
								leftSection={<LogIn size={16} />}
								loading={loading}
								color="teal"
							>
								Iniciar Sesión
							</Button>
						</Stack>
					</form>

					<Text size="sm" ta="center" c="dimmed">
						¿No tienes cuenta?{" "}
						<Anchor component={Link} to="/" fw={500}>
							Volver al inicio
						</Anchor>
					</Text>
				</Stack>
			</Card>
		</Container>
	);
}
