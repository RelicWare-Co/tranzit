import { PinInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "#/features/auth/components/AuthContext";
import { Alert, Button, Card, Input } from "#/shared/components/ui";
import { orpc } from "#/shared/lib/orpc-client";

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
	const queryClient = useQueryClient();
	const {
		sendVerificationOtp,
		signInEmailOtp,
		refreshUser,
		hasRole,
		isAuthenticated,
		isLoading: authLoading,
	} = useAuth();
	const [step, setStep] = useState<OtpStep>("email");
	const [sentEmail, setSentEmail] = useState("");
	const [otpCode, setOtpCode] = useState("");
	const [feedback, setFeedback] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);
	const hasBackofficeAccess =
		hasRole("admin") || hasRole("staff") || hasRole("auditor");
	const shouldFetchOnboarding =
		!authLoading && isAuthenticated && !hasBackofficeAccess;
	const onboardingStatusQueryOptions =
		orpc.admin.onboarding.status.queryOptions({
			enabled: shouldFetchOnboarding,
			retry: false,
		});
	const onboardingStatusQuery = useQuery(onboardingStatusQueryOptions);
	const onboardingMutation = useMutation(
		orpc.admin.onboarding.bootstrap.mutationOptions(),
	);
	const showOnboarding =
		isAuthenticated &&
		!hasBackofficeAccess &&
		onboardingStatusQuery.data?.adminExists === false;
	const isCheckingOnboarding =
		isAuthenticated && !hasBackofficeAccess && onboardingStatusQuery.isLoading;
	const hasOnboardingStatusError =
		isAuthenticated && !hasBackofficeAccess && onboardingStatusQuery.isError;
	const isRedirectingAuthenticatedSession =
		!authLoading &&
		isAuthenticated &&
		(isCompletingOnboarding ||
			hasBackofficeAccess ||
			onboardingStatusQuery.data?.adminExists === true);

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
		if (authLoading || !isAuthenticated || isCompletingOnboarding) return;

		if (hasBackofficeAccess) {
			navigate({ to: "/admin", replace: true });
			return;
		}

		if (onboardingStatusQuery.data?.adminExists === true) {
			navigate({ to: "/mi-perfil", replace: true });
		}
	}, [
		authLoading,
		hasBackofficeAccess,
		isAuthenticated,
		isCompletingOnboarding,
		navigate,
		onboardingStatusQuery.data?.adminExists,
	]);

	const handleSendOtp = form.onSubmit((values) => {
		setError(null);
		setFeedback(null);
		sendOtpMutation.mutate({
			email: values.email.trim().toLowerCase(),
		});
	});

	const handleVerifyOtp = () => {
		if (otpCode.length !== 6) {
			setError("El código OTP debe tener 6 dígitos.");
			return;
		}

		setError(null);
		setFeedback(null);
		verifyOtpMutation.mutate({
			email: sentEmail,
			otp: otpCode,
			name: form.values.name.trim() || undefined,
		});
	};

	const handleOnboard = async () => {
		setError(null);
		setIsCompletingOnboarding(true);

		try {
			await onboardingMutation.mutateAsync(undefined);
			queryClient.setQueryData(onboardingStatusQueryOptions.queryKey, {
				adminExists: true,
			});
			await queryClient.invalidateQueries({
				queryKey: onboardingStatusQueryOptions.queryKey,
				exact: true,
				refetchType: "none",
			});
			await refreshUser();
			navigate({ to: "/admin", replace: true });
		} catch (onboardingError) {
			setIsCompletingOnboarding(false);
			setError(
				getErrorMessage(
					onboardingError,
					"No se pudo activar la cuenta administradora. Intenta de nuevo.",
				),
			);
		}
	};

	if (authLoading || isRedirectingAuthenticatedSession) return null;

	return (
		<div
			style={{
				minHeight: "100vh",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding:
					"calc(var(--space-20) + var(--space-4)) var(--space-6) var(--space-8)",
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
							{showOnboarding ? (
								<ShieldCheck size={28} color="white" />
							) : (
								<Mail size={28} color="white" />
							)}
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
							{showOnboarding ? "Configurar administrador" : "Bienvenido"}
						</h1>
						<p
							style={{
								fontSize: "var(--text-sm)",
								color: "var(--text-secondary)",
								margin: 0,
							}}
						>
							{showOnboarding
								? "No hay administradores. Activa tu cuenta como administrador principal."
								: isAuthenticated
									? "Estamos preparando tu acceso."
									: step === "email"
										? "Ingresa tu correo para acceder a SIMUT"
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

					{isCheckingOnboarding && (
						<div style={{ marginBottom: "var(--space-6)" }}>
							<Alert variant="info" title="Verificando acceso">
								Estamos comprobando la configuración administrativa.
							</Alert>
						</div>
					)}

					{hasOnboardingStatusError && (
						<div style={{ marginBottom: "var(--space-6)" }}>
							<Alert variant="error" title="No pudimos verificar el acceso">
								<div
									style={{
										display: "flex",
										flexDirection: "column",
										gap: "var(--space-3)",
									}}
								>
									<span>
										Intenta consultar nuevamente el estado del sistema.
									</span>
									<Button
										variant="secondary"
										size="sm"
										onClick={() => {
											void onboardingStatusQuery.refetch();
										}}
									>
										Reintentar
									</Button>
								</div>
							</Alert>
						</div>
					)}

					{showOnboarding ? (
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								gap: "var(--space-5)",
							}}
						>
							<Alert variant="success" title="Primer administrador">
								Tu identidad ya fue verificada por OTP. Puedes activar esta
								cuenta como administradora principal del sistema.
							</Alert>
							<Button
								variant="primary"
								size="lg"
								leftIcon={<ShieldCheck size={18} />}
								onClick={() => {
									void handleOnboard();
								}}
								isLoading={onboardingMutation.isPending}
								fullWidth
							>
								Activar como administrador
							</Button>
						</div>
					) : isAuthenticated ? null : step === "email" ? (
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
									type="number"
									inputMode="numeric"
									oneTimeCode
									gap="md"
									size="lg"
									style={{ justifyContent: "center" }}
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
										sendOtpMutation.mutate({ email: sentEmail });
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
								onClick={handleVerifyOtp}
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
