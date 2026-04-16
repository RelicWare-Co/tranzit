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
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Lock, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import { orpc } from "../../lib/orpc-client";
import { ADMIN_ACCENT, adminUi } from "./_shared/admin-ui";

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
			backgroundColor: "#fafafa",
			border: "1px solid #e4e4e7",
			borderRadius: 12,
			color: "#18181b",
			fontWeight: 500,
			"&:focus": {
				borderColor: ADMIN_ACCENT,
				boxShadow: "0 0 0 2px rgba(201, 42, 42, 0.18)",
			},
		},
		label: {
			fontWeight: 600,
			color: "#3f3f46",
			marginBottom: 6,
			letterSpacing: "-0.02em",
		},
	};

	if (shouldCheckOnboarding && onboardingStatusQuery.isPending) {
		return (
			<Box className={adminUi.pageBg}>
				<Container size="xs" className="py-24 sm:py-32">
					<Card className={`${adminUi.surface} p-10`} shadow="none">
						<Stack gap="md" align="center">
							<Badge variant="light" color="red" size="lg">
								Verificando acceso
							</Badge>
							<Text size="sm" className="text-center text-zinc-500">
								Cargando el estado administrativo antes de mostrar el
								formulario.
							</Text>
						</Stack>
					</Card>
				</Container>
			</Box>
		);
	}

	if (
		shouldCheckOnboarding &&
		(onboardingStatusQuery.data?.adminExists === false ||
			onboardingStatusQuery.isError)
	) {
		return (
			<Box className={adminUi.pageBg}>
				<Container size="sm" className="py-16 sm:py-24">
					<Card className={`${adminUi.surface} p-8 sm:p-10`} shadow="none">
						<Stack gap="xl">
							<Stack gap="xs" align="flex-start">
								<Box
									className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
									style={{ backgroundColor: ADMIN_ACCENT }}
								>
									<ShieldCheck
										size={24}
										className="text-white"
										strokeWidth={1.75}
									/>
								</Box>
								<Title
									order={2}
									className="text-2xl font-semibold tracking-tight text-zinc-900"
								>
									Configurar administrador
								</Title>
								<Text size="sm" className="leading-relaxed text-zinc-500">
									No hay administradores en el sistema. Tu cuenta puede ser
									elevada a administrador principal.
								</Text>
								<Badge variant="light" color="teal" size="lg">
									Primer administrador
								</Badge>
							</Stack>

							{error ? (
								<Alert
									icon={<AlertCircle size={16} />}
									color="red"
									radius="md"
									variant="light"
									className="border border-red-200/80"
								>
									{error}
								</Alert>
							) : null}

							<Stack gap="sm">
								<Button
									fullWidth
									size="md"
									loading={onboardingMutation.isPending}
									onClick={handleOnboard}
									color="red"
									radius="md"
									className="font-semibold"
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
		<Box className={`${adminUi.pageBg} flex min-h-[100dvh]`}>
			<div className="relative hidden w-[42%] min-w-[320px] flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-zinc-100 lg:flex">
				<div
					className="pointer-events-none absolute inset-0 opacity-[0.35]"
					style={{
						background:
							"radial-gradient(ellipse 90% 70% at 20% 20%, rgba(201,42,42,0.35), transparent 55%), radial-gradient(ellipse 80% 60% at 80% 80%, rgba(63,63,70,0.5), transparent 50%)",
					}}
				/>
				<div className="relative z-[1]">
					<Text className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">
						SIMUT Tuluá
					</Text>
					<Title
						order={2}
						className="mt-6 max-w-sm text-3xl font-semibold tracking-tight text-white"
					>
						Backoffice operativo
					</Title>
					<Text className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-400">
						Acceso restringido para personal autorizado. Las acciones quedan
						sujetas a auditoría del sistema.
					</Text>
				</div>
				<Text className="relative z-[1] text-xs text-zinc-500">
					Usá credenciales internas emitidas por la entidad.
				</Text>
			</div>

			<div className="flex flex-1 items-center justify-center px-4 py-14 sm:px-8">
				<Container size="xs" className="w-full max-w-md p-0">
					<Card className={`${adminUi.surface} p-8 sm:p-10`} shadow="none">
						<Stack gap="xl">
							<Stack gap="xs" align="flex-start">
								<Box
									className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl lg:hidden"
									style={{
										backgroundColor: ADMIN_ACCENT,
										boxShadow:
											"inset 0 1px 0 rgba(255,255,255,0.2), 0 12px 28px -16px rgba(201,42,42,0.65)",
									}}
								>
									<Lock size={22} className="text-white" strokeWidth={1.75} />
								</Box>
								<Title
									order={2}
									className="text-2xl font-semibold tracking-tight text-zinc-900"
								>
									Acceso administrativo
								</Title>
								<Text size="sm" className="leading-relaxed text-zinc-500">
									Ingresá tus credenciales internas para abrir el backoffice.
								</Text>
							</Stack>

							{error ? (
								<Alert
									icon={<AlertCircle size={16} />}
									color="red"
									radius="md"
									variant="light"
									className="border border-red-200/80"
								>
									{error}
								</Alert>
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
										radius="md"
										className="mt-2 font-semibold"
									>
										Iniciar sesión
									</Button>
								</Stack>
							</form>

							<Text size="sm" ta="center" className="text-zinc-500">
								<Anchor
									component={Link}
									to="/"
									fw={600}
									className="text-zinc-800 underline decoration-zinc-300 underline-offset-4"
								>
									Volver al portal ciudadano
								</Anchor>
							</Text>
						</Stack>
					</Card>
				</Container>
			</div>
		</Box>
	);
}
