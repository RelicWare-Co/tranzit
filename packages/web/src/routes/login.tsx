import {
	Alert,
	Anchor,
	Box,
	Button,
	Card,
	Container,
	Group,
	PinInput,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

type OtpStep = "email" | "verify";

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof (error as { message?: unknown }).message === "string"
	) {
		return (error as { message: string }).message;
	}

	return fallback;
}

function LoginPage() {
	const navigate = useNavigate();
	const {
		sendVerificationOtp,
		signInEmailOtp,
		isAuthenticated,
		isLoading: authLoading,
	} = useAuth();
	const [step, setStep] = useState<OtpStep>("email");
	const [sentEmail, setSentEmail] = useState("");
	const [otpCode, setOtpCode] = useState("");
	const [feedback, setFeedback] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const form = useForm({
		initialValues: {
			name: "",
			email: "",
		},
		validate: {
			email: (value) =>
				/^\S+@\S+\.\S+$/.test(value)
					? null
					: "Ingresa un correo electrónico válido",
		},
	});

	const sendOtpMutation = useMutation({
		mutationFn: async ({ email }: { email: string }) => {
			await sendVerificationOtp(email, "sign-in");
		},
		onSuccess: (_, variables) => {
			setSentEmail(variables.email);
			setStep("verify");
			setOtpCode("");
			setError(null);
			setFeedback("Te enviamos un código OTP de 6 dígitos a tu correo.");
		},
		onError: (mutationError) => {
			setError(
				getErrorMessage(
					mutationError,
					"No se pudo enviar el código OTP. Intenta de nuevo.",
				),
			);
		},
	});

	const verifyOtpMutation = useMutation({
		mutationFn: async (payload: {
			email: string;
			otp: string;
			name?: string;
		}) => {
			await signInEmailOtp(payload.email, payload.otp, payload.name);
		},
		onSuccess: () => {
			setError(null);
			setFeedback(null);
			navigate({ to: "/mi-perfil" });
		},
		onError: (mutationError) => {
			setError(
				getErrorMessage(
					mutationError,
					"Código inválido o expirado. Solicita uno nuevo.",
				),
			);
			setOtpCode("");
		},
	});

	useEffect(() => {
		if (!authLoading && isAuthenticated) {
			navigate({ to: "/mi-perfil" });
		}
	}, [authLoading, isAuthenticated, navigate]);

	const handleSendOtp = form.onSubmit(async (values) => {
		setError(null);
		setFeedback(null);
		await sendOtpMutation.mutateAsync({
			email: values.email.trim().toLowerCase(),
		});
	});

	const handleVerifyOtp = async () => {
		if (otpCode.length !== 6) {
			setError("El código OTP debe tener 6 dígitos.");
			return;
		}

		setError(null);
		setFeedback(null);
		await verifyOtpMutation.mutateAsync({
			email: sentEmail,
			otp: otpCode,
			name: form.values.name.trim() || undefined,
		});
	};

	return (
		<Box mih="100vh" py={96}>
			<Container size="xs">
				<Card withBorder radius="md" p="xl">
					<Stack gap="lg">
						<Stack gap={6}>
							<Group gap="sm" align="center">
								<Mail size={20} />
								<Title order={3}>Acceso ciudadano por OTP</Title>
							</Group>
							<Text size="sm" c="dimmed">
								Usa tu correo para entrar al portal ciudadano sin contraseña.
							</Text>
						</Stack>

						{error ? (
							<Alert
								icon={<AlertCircle size={16} />}
								color="red"
								variant="light"
							>
								{error}
							</Alert>
						) : null}

						{feedback ? (
							<Alert
								icon={<ShieldCheck size={16} />}
								color="green"
								variant="light"
							>
								{feedback}
							</Alert>
						) : null}

						{step === "email" ? (
							<form onSubmit={handleSendOtp}>
								<Stack gap="md">
									<TextInput
										label="Nombre (opcional)"
										placeholder="Ej: Juan Pérez"
										{...form.getInputProps("name")}
									/>
									<TextInput
										required
										type="email"
										label="Correo electrónico"
										placeholder="correo@ejemplo.com"
										{...form.getInputProps("email")}
									/>
									<Button type="submit" loading={sendOtpMutation.isPending}>
										Enviar código OTP
									</Button>
								</Stack>
							</form>
						) : (
							<Stack gap="md">
								<Text size="sm">
									Ingresa el código enviado a <b>{sentEmail}</b>.
								</Text>
								<PinInput
									length={6}
									type="number"
									size="lg"
									value={otpCode}
									onChange={setOtpCode}
								/>
								<Group grow>
									<Button
										variant="default"
										onClick={() => {
											setStep("email");
											setOtpCode("");
											setError(null);
											setFeedback(null);
										}}
									>
										Cambiar correo
									</Button>
									<Button
										onClick={() => {
											setError(null);
											setFeedback(null);
											void sendOtpMutation.mutateAsync({ email: sentEmail });
										}}
										loading={sendOtpMutation.isPending}
									>
										Reenviar OTP
									</Button>
								</Group>
								<Button
									onClick={() => {
										void handleVerifyOtp();
									}}
									disabled={otpCode.length !== 6}
									loading={verifyOtpMutation.isPending}
								>
									Validar e ingresar
								</Button>
							</Stack>
						)}

						<Text size="sm" ta="center" c="dimmed">
							<Anchor component={Link} to="/">
								Volver al inicio
							</Anchor>
						</Text>
					</Stack>
				</Card>
			</Container>
		</Box>
	);
}
