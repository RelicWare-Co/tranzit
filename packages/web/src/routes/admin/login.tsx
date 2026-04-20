import {
	Anchor,
	Button,
	Card,
	Container,
	PasswordInput,
	Stack,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Building2, Lock, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import { orpc } from "../../lib/orpc-client";
import { Badge } from "../../components/ui";

export const Route = createFileRoute("/admin/login")({
	component: AdminLoginPage,
});

function AdminLoginPage() {
	const navigate = useNavigate();
	const {
		hasRole,
		login,
		isAuthenticated,
		isLoading: authLoading,
		refreshUser,
	} = useAuth();
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
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
								Plataforma administrativa para la gestión de citas y trámites del SIMUT.
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
								No hay administradores en el sistema. Tu cuenta puede ser elevada a administrador principal.
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
											<ShieldCheck size={16} className="text-white" strokeWidth={2} />
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
										No hay administradores en el sistema. Tu cuenta puede ser elevada a administrador principal.
									</p>
									<Badge variant="success">Primer administrador</Badge>
								</Stack>

								{error ? (
									<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
										<div className="flex items-start gap-3">
											<AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
											<p className="font-['Public_Sans'] text-sm text-red-700">{error}</p>
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

	// Login form (default state)
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
							Acceso restringido para personal autorizado. Las acciones quedan sujetas a auditoría del sistema.
						</p>
						<div className="pt-4 border-t border-[var(--neutral-700)]">
							<p className="font-['Public_Sans'] text-xs text-[var(--neutral-500)]">
								Usá credenciales internas emitidas por la entidad.
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Right panel - login form */}
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
									Ingresá tus credenciales internas para abrir el backoffice.
								</p>
							</Stack>

							{error ? (
								<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
									<div className="flex items-start gap-3">
										<AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
										<p className="font-['Public_Sans'] text-sm text-red-700">{error}</p>
									</div>
								</div>
							) : null}

							<form onSubmit={handleSubmit}>
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

									<PasswordInput
										label="Contraseña"
										placeholder="••••••••"
										required
										{...form.getInputProps("password")}
										styles={inputStyles}
										size="md"
										autoComplete="current-password"
									/>

									<Button
										type="submit"
										fullWidth
										size="md"
										color="red"
										loading={loading}
										radius="md"
										className="font-['Sora'] font-semibold"
									>
										Iniciar sesión
									</Button>
								</Stack>
							</form>

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
