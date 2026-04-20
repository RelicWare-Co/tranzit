import { useForm } from "@mantine/form";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Input } from "../components/ui";
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

// Simple PinInput component using native inputs
function PinInput({
	length,
	value,
	onChange,
	disabled,
}: {
	length: number;
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
}) {
	const handleChange = (index: number, digit: string) => {
		const newValue = value.split("");
		newValue[index] = digit;
		const newString = newValue.join("").slice(0, length);
		onChange(newString);

		// Auto-focus next input
		if (digit && index < length - 1) {
			const nextInput = document.getElementById(`pin-${index + 1}`);
			nextInput?.focus();
		}
	};

	const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
		if (e.key === "Backspace" && !value[index] && index > 0) {
			const prevInput = document.getElementById(`pin-${index - 1}`);
			prevInput?.focus();
		}
	};

	return (
		<div
			style={{
				display: "flex",
				gap: "var(--space-3)",
				justifyContent: "center",
			}}
		>
			{Array.from({ length }).map((_, i) => (
				<input
					key={`pin-${value[i] ?? i}`}
					id={`pin-${i}`}
					type="text"
					inputMode="numeric"
					maxLength={1}
					value={value[i] || ""}
					disabled={disabled}
					onChange={(e) => handleChange(i, e.target.value.replace(/\D/g, ""))}
					onKeyDown={(e) => handleKeyDown(i, e)}
					style={{
						width: "3rem",
						height: "3.5rem",
						textAlign: "center",
						fontSize: "var(--text-xl)",
						fontFamily: "var(--font-display)",
						fontWeight: 600,
						border: `2px solid ${value[i] ? "var(--accent-default)" : "var(--border-default)"}`,
						borderRadius: "var(--radius-lg)",
						backgroundColor: "var(--bg-elevated)",
						color: "var(--text-primary)",
						transition: "all var(--duration-fast) var(--ease-out-quart)",
					}}
					onFocus={(e) => {
						e.target.style.borderColor = "var(--accent-default)";
						e.target.style.boxShadow =
							"0 0 0 3px oklch(from var(--accent-default) l c h / 0.12)";
					}}
					onBlur={(e) => {
						e.target.style.borderColor = value[i]
							? "var(--accent-default)"
							: "var(--border-default)";
						e.target.style.boxShadow = "none";
					}}
				/>
			))}
		</div>
	);
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
		<div
			style={{
				minHeight: "100vh",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: "var(--space-6)",
				background: `linear-gradient(135deg, var(--bg-primary) 0%, var(--brand-50) 50%, var(--bg-secondary) 100%)`,
			}}
		>
			<div style={{ width: "100%", maxWidth: "480px" }}>
				<Card variant="elevated" padding="xl">
					<div style={{ textAlign: "center", marginBottom: "var(--space-8)" }}>
						<div
							style={{
								width: "64px",
								height: "64px",
								borderRadius: "var(--radius-xl)",
								background:
									"linear-gradient(135deg, var(--brand-500) 0%, var(--brand-600) 100%)",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								margin: "0 auto var(--space-6)",
								boxShadow: "var(--shadow-md)",
							}}
						>
							<Mail size={28} color="white" />
						</div>
						<h1
							style={{
								fontFamily: "var(--font-display)",
								fontSize: "var(--text-3xl)",
								fontWeight: 700,
								color: "var(--text-primary)",
								marginBottom: "var(--space-2)",
							}}
						>
							Bienvenido
						</h1>
						<p
							style={{
								fontSize: "var(--text-sm)",
								color: "var(--text-secondary)",
								margin: 0,
							}}
						>
							{step === "email"
								? "Ingresa tu correo para acceder al portal ciudadano"
								: `Ingresa el código enviado a ${sentEmail}`}
						</p>
					</div>

					{error && (
						<div style={{ marginBottom: "var(--space-6)" }}>
							<Alert variant="error" title="Error" className="animate-fade-in">
								{error}
							</Alert>
						</div>
					)}

					{feedback && (
						<div style={{ marginBottom: "var(--space-6)" }}>
							<Alert
								variant="success"
								title="Éxito"
								className="animate-fade-in"
							>
								{feedback}
							</Alert>
						</div>
					)}

					{step === "email" ? (
						<form onSubmit={handleSendOtp}>
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									gap: "var(--space-5)",
								}}
							>
								<Input
									label="Nombre (opcional)"
									placeholder="Ej: Juan Pérez"
									size="lg"
									{...form.getInputProps("name")}
								/>
								<Input
									label="Correo electrónico"
									placeholder="correo@ejemplo.com"
									type="email"
									size="lg"
									required
									error={form.errors.email}
									{...form.getInputProps("email")}
								/>
								<Button
									type="submit"
									variant="primary"
									size="lg"
									fullWidth
									isLoading={sendOtpMutation.isPending}
									style={{ marginTop: "var(--space-2)" }}
								>
									Enviar código OTP
								</Button>
							</div>
						</form>
					) : (
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								gap: "var(--space-6)",
							}}
						>
							<div>
								<label
									htmlFor="otp-code"
									style={{
										display: "block",
										fontFamily: "var(--font-display)",
										fontSize: "var(--text-sm)",
										fontWeight: 600,
										color: "var(--text-primary)",
										marginBottom: "var(--space-3)",
										textAlign: "center",
									}}
								>
									Código de verificación
								</label>
								<PinInput
									length={6}
									value={otpCode}
									onChange={setOtpCode}
									disabled={verifyOtpMutation.isPending}
								/>
							</div>

							<div style={{ display: "flex", gap: "var(--space-3)" }}>
								<Button
									variant="secondary"
									size="md"
									leftIcon={<ArrowLeft size={16} />}
									onClick={() => {
										setStep("email");
										setOtpCode("");
										setError(null);
										setFeedback(null);
									}}
									fullWidth
								>
									Cambiar correo
								</Button>
								<Button
									variant="primary"
									size="md"
									onClick={() => {
										setError(null);
										setFeedback(null);
										void sendOtpMutation.mutateAsync({ email: sentEmail });
									}}
									isLoading={sendOtpMutation.isPending}
									fullWidth
								>
									Reenviar
								</Button>
							</div>

							<Button
								variant="primary"
								size="lg"
								onClick={() => {
									void handleVerifyOtp();
								}}
								disabled={otpCode.length !== 6}
								isLoading={verifyOtpMutation.isPending}
								fullWidth
							>
								Validar e ingresar
							</Button>
						</div>
					)}

					<div style={{ textAlign: "center", marginTop: "var(--space-6)" }}>
						<Link
							to="/"
							style={{
								fontSize: "var(--text-sm)",
								color: "var(--text-secondary)",
								textDecoration: "none",
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.color = "var(--text-brand)";
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.color = "var(--text-secondary)";
							}}
						>
							Volver al inicio
						</Link>
					</div>
				</Card>
			</div>
		</div>
	);
}

export default LoginPage;
