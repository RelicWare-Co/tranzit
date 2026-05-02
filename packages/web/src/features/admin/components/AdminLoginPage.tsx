import {
	Anchor,
	Button,
	Card,
	Container,
	PinInput,
	Stack,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Building2, Lock, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "#/shared/components/ui";
import { useAuth } from "#/features/auth/components/AuthContext";
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

function AdminLoginPage() {
	const navigate = useNavigate();
	const {
		hasRole,
		sendVerificationOtp,
		signInEmailOtp,
		isAuthenticated,
		isLoading: authLoading,
		refreshUser,
	} = useAuth();
	const [error, setError] = useState("");
	const [step, setStep] = useState<OtpStep>("email");
	const [sentEmail, setSentEmail] = useState("");
	const [otpCode, setOtpCode] = useState("");
	const [feedback, setFeedback] = useState<string | null>(null);
	const isAdminRole = hasRole("admin");
	const shouldCheckOnboarding = !authLoading && isAuthenticated && !isAdminRole;
	const onboardingStatusQuery = useQuery(
		orpc.admin.onboarding.status.queryOptions({
			enabled: shouldCheckOnboarding,
			retry: false,
		}),
	);
	const onboardingMutation = useMutation(
		orpc.admin.onboarding.bootstrap.mutationOptions(),
	);

	useEffect(() => {
		if (!authLoading && isAuthenticated && isAdminRole) {
			navigate({ to: "/admin" });
			return;
		}
		if (
			shouldCheckOnboarding &&
			onboardingStatusQuery.data?.adminExists === true
		) {
			navigate({ to: "/admin" });
		}
	}, [
		authLoading,
		isAuthenticated,
		isAdminRole,
		navigate,
		onboardingStatusQuery.data?.adminExists,
		shouldCheckOnboarding,
	]);

	const form = useForm({
		initialValues: {
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
			setError("");
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
		mutationFn: async (payload: { email: string; otp: string }) => {
			await signInEmailOtp(payload.email, payload.otp);
		},
		onSuccess: () => {
			setError("");
			setFeedback(null);
			// Navigation handled by useEffect when auth state updates
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

	const handleSendOtp = form.onSubmit(async (values) => {
		setError("");
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
		setError("");
		setFeedback(null);
		await verifyOtpMutation.mutateAsync({
			email: sentEmail,
			otp: otpCode,
		});
	};

	const handleOnboard = async () => {
		setError("");
		try {
			await onboardingMutation.mutateAsync(undefined);
			await refreshUser();
			navigate({ to: "/admin" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error en el onboarding");
		}
	};

	const skipOnboarding = () => {
		navigate({ to: "/admin" });
	};

	const inputStyles = {
		input: {
			backgroundColor: "white",
			border: "1px solid var(--neutral-300)",
			borderRadius: 8,
			color: "var(--neutral-900)",
			fontSize: "0.9375rem",
			padding: "0.625rem 0.875rem",
			"&:focus": {
				borderColor: "var(--brand-500)",
				boxShadow: "0 0 0 3px var(--brand-100)",
			},
		},
		label: {
			fontFamily: "'Sora', sans-serif",
			fontWeight: 600,
			fontSize: "0.8125rem",
			letterSpacing: "-0.01em",
			color: "var(--neutral-700)",
			marginBottom: 6,
		},
		error: {
			fontSize: "0.8125rem",
			marginTop: 4,
		},
	};

	// Loading state
	if (shouldCheckOnboarding && onboardingStatusQuery.isPending) {
		return (
			<div className="flex min-h-[100dvh]">
				{/* Left panel - branding */}
				<div className="relative hidden w-[40%] min-w-[320px] bg-[var(--neutral-900)] p-10 lg:flex">
					<div className="flex flex-col justify-between h-full">
						<div>
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-600)]">
									<Building2 size={20} className="text-white" strokeWidth={2} />
								</div>
								<div>
									<p className="font-['Sora'] text-sm font-bold text-white tracking-tight">
										SIMUT Tuluá
									</p>
									<p className="font-['Public_Sans'] text-xs text-[var(--neutral-400)]">
										Sistema de Gestión
									</p>
								</div>
							</div>
						</div>
						<div className="space-y-4">
							<p className="font-['Sora'] text-2xl font-semibold text-white tracking-tight">
								Backoffice operativo
							</p>
							<p className="font-['Public_Sans'] text-sm text-[var(--neutral-400)] leading-relaxed max-w-sm">
								Plataforma administrativa para la gestión de citas y trámites
								del SIMUT.
							</p>
						</div>
					</div>
				</div>

				{/* Right panel - loading state */}
				<div className="flex flex-1 items-center justify-center bg-[var(--bg-primary)] px-4">
					<Container size="xs" className="w-full max-w-md">
						<Card className="rounded-xl border border-[var(--neutral-200)] bg-white p-10 shadow-sm">
							<Stack gap="lg" align="center">
								<Badge variant="warning">Verificando acceso</Badge>
								<p className="font-['Public_Sans'] text-center text-sm text-[var(--neutral-500)]">
									Cargando el estado administrativo...
								</p>
							</Stack>
						</Card>
					</Container>
				</div>
			</div>
		);
	}

	// Onboarding state
	if (
		shouldCheckOnboarding &&
		(onboardingStatusQuery.data?.adminExists === false ||
			onboardingStatusQuery.isError)
	) {
		return (
			<div className="flex min-h-[100dvh]">
				{/* Left panel - branding */}
				<div className="relative hidden w-[40%] min-w-[320px] bg-[var(--neutral-900)] p-10 lg:flex">
					<div className="flex flex-col justify-between h-full">
						<div>
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-600)]">
									<Building2 size={20} className="text-white" strokeWidth={2} />
								</div>
								<div>
									<p className="font-['Sora'] text-sm font-bold text-white tracking-tight">
										SIMUT Tuluá
									</p>
									<p className="font-['Public_Sans'] text-xs text-[var(--neutral-400)]">
										Sistema de Gestión
									</p>
								</div>
							</div>
						</div>
						<div className="space-y-4">
							<p className="font-['Sora'] text-2xl font-semibold text-white tracking-tight">
								Configurar administrador
							</p>
							<p className="font-['Public_Sans'] text-sm text-[var(--neutral-400)] leading-relaxed max-w-sm">
								No hay administradores en el sistema. Tu cuenta puede ser
								eleva a administrador principal.
							</p>
						</div>
					</div>
				</div>

				{/* Right panel - onboarding form */}
				<div className="flex flex-1 items-center justify-center bg-[var(--bg-primary)] px-4">
					<Container size="xs" className="w-full max-w-md">
						<Card className="rounded-xl border border-[var(--neutral-200)] bg-white p-8 sm:p-10 shadow-sm">
							<Stack gap="xl">
								<Stack gap="sm" align="flex-start">
									<div className="lg:hidden flex items-center gap-2 mb-2">
										<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-600)]">
											<ShieldCheck
												size={16}
												className="text-white"
												strokeWidth={2}
											/>
										</div>
										<span className="font-['Sora'] text-sm font-semibold text-[var(--neutral-900)]">
											SIMUT Tuluá
										</span>
									</div>
									<Title
										order={2}
										className="font-['Sora'] text-2xl font-semibold tracking-tight text-[var(--neutral-900)]"
									>
										Configurar administrador
									</Title>
									<p className="font-['Public_Sans'] text-sm leading-relaxed text-[var(--neutral-500)]">
										No hay administradores en el sistema. Tu cuenta puede ser
										eleva a administrador principal.
									</p>
									<Badge variant="success">Primer administrador</Badge>
								</Stack>

								{error ? (
									<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
										<div className="flex items-start gap-3">
											<AlertCircle
												size={16}
												className="text-red-600 mt-0.5 flex-shrink-0"
											/>
											<p className="font-['Public_Sans'] text-sm text-red-700">
												{error}
											</p>
										</div>
									</div>
								) : null}

								<Stack gap="sm">
									<Button
										fullWidth
										size="md"
										loading={onboardingMutation.isPending}
										onClick={handleOnboard}
										color="red"
										radius="md"
										className="font-['Sora'] font-semibold"
									>
										Activar como administrador
									</Button>
									<Button
										fullWidth
										size="md"
										variant="subtle"
										color="gray"
										onClick={skipOnboarding}
										loading={onboardingMutation.isPending}
										radius="md"
										className="font-['Sora']"
									>
										Saltar por ahora
									</Button>
								</Stack>
							</Stack>
						</Card>
					</Container>
				</div>
			</div>
		);
	}

	// OTP Login form
	return (
		<div className="flex min-h-[100dvh]">
			{/* Left panel - dark branding */}
			<div className="relative hidden w-[40%] min-w-[320px] bg-[var(--neutral-900)] p-10 lg:flex">
				<div className="flex flex-col justify-between h-full">
					<div>
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-600)]">
								<Building2 size={20} className="text-white" strokeWidth={2} />
							</div>
							<div>
								<p className="font-['Sora'] text-sm font-bold text-white tracking-tight">
									SIMUT Tuluá
								</p>
								<p className="font-['Public_Sans'] text-xs text-[var(--neutral-400)]">
									Sistema de Gestión
								</p>
							</div>
						</div>
					</div>
					<div className="space-y-4">
						<p className="font-['Sora'] text-2xl font-semibold text-white tracking-tight">
							Backoffice operativo
						</p>
						<p className="font-['Public_Sans'] text-sm text-[var(--neutral-400)] leading-relaxed max-w-sm">
							Acceso restringido para personal autorizado. Las acciones quedan
							sujetas a auditoría del sistema.
						</p>
						<div className="pt-4 border-t border-[var(--neutral-700)]">
							<p className="font-['Public_Sans'] text-xs text-[var(--neutral-500)]">
								Ingresá con el código OTP enviado a tu correo institucional.
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Right panel - OTP login form */}
			<div className="flex flex-1 items-center justify-center bg-[var(--bg-primary)] px-4">
				<Container size="xs" className="w-full max-w-md">
					<Card className="rounded-xl border border-[var(--neutral-200)] bg-white p-8 sm:p-10 shadow-sm">
						<Stack gap="xl">
							<Stack gap="sm" align="flex-start">
								<div className="lg:hidden flex items-center gap-2 mb-2">
									<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-600)]">
										<Lock size={16} className="text-white" strokeWidth={2} />
									</div>
									<span className="font-['Sora'] text-sm font-semibold text-[var(--neutral-900)]">
										SIMUT Tuluá
									</span>
								</div>
								<Title
									order={2}
									className="font-['Sora'] text-2xl font-semibold tracking-tight text-[var(--neutral-900)]"
								>
									Acceso administrativo
								</Title>
								<p className="font-['Public_Sans'] text-sm leading-relaxed text-[var(--neutral-500)]">
									{step === "email"
										? "Ingresá tu correo institucional para recibir un código de acceso."
										: `Ingresá el código de 6 dígitos enviado a ${sentEmail}`}
								</p>
							</Stack>

							{error ? (
								<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
									<div className="flex items-start gap-3">
										<AlertCircle
											size={16}
											className="text-red-600 mt-0.5 flex-shrink-0"
										/>
										<p className="font-['Public_Sans'] text-sm text-red-700">
											{error}
										</p>
									</div>
								</div>
							) : null}

							{feedback ? (
								<div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
									<div className="flex items-start gap-3">
										<Mail
											size={16}
											className="text-green-600 mt-0.5 flex-shrink-0"
										/>
										<p className="font-['Public_Sans'] text-sm text-green-700">
											{feedback}
										</p>
									</div>
								</div>
							) : null}

							{step === "email" ? (
								<form onSubmit={handleSendOtp}>
									<Stack gap="lg">
										<TextInput
											label="Correo electrónico"
											placeholder="admin@simut.local"
											required
											{...form.getInputProps("email")}
											styles={inputStyles}
											size="md"
											autoComplete="email"
										/>

										<Button
											type="submit"
											fullWidth
											size="md"
											color="red"
											loading={sendOtpMutation.isPending}
											radius="md"
											className="font-['Sora'] font-semibold"
										>
											Enviar código OTP
										</Button>
									</Stack>
								</form>
							) : (
								<Stack gap="lg">
									<div>
										<label
											htmlFor="otp-code"
											className="block font-['Sora'] text-sm font-semibold text-[var(--neutral-700)] mb-2"
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

									<div className="flex gap-3">
										<Button
											variant="default"
											size="md"
											onClick={() => {
												setStep("email");
												setSentEmail("");
												setOtpCode("");
												setError("");
												setFeedback(null);
											}}
											fullWidth
											radius="md"
										>
											Cambiar correo
										</Button>
										<Button
											variant="default"
											size="md"
											onClick={() => {
												setError("");
												setFeedback(null);
												void sendOtpMutation.mutateAsync({ email: sentEmail });
											}}
											loading={sendOtpMutation.isPending}
											fullWidth
											radius="md"
										>
											Reenviar
										</Button>
									</div>

									<Button
										fullWidth
										size="md"
										color="red"
										onClick={handleVerifyOtp}
										disabled={otpCode.length !== 6}
										loading={verifyOtpMutation.isPending}
										radius="md"
										className="font-['Sora'] font-semibold"
									>
										Validar e ingresar
									</Button>
								</Stack>
							)}

							<div className="pt-2">
								<p className="font-['Public_Sans'] text-center text-sm text-[var(--neutral-500)]">
									<Anchor
										component={Link}
										to="/"
										fw={600}
										className="text-[var(--neutral-800)] hover:text-[var(--brand-600)] transition-colors"
									>
										Volver al portal ciudadano
									</Anchor>
								</p>
							</div>
						</Stack>
					</Card>
				</Container>
			</div>
		</div>
	);
}
export default AdminLoginPage;
