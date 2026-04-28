import {
	Alert,
	Avatar,
	Badge,
	Box,
	Button,
	Card,
	Container,
	Divider,
	Group,
	Loader,
	SimpleGrid,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, CalendarClock, Mail, Phone, User } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useAuth } from "#/features/auth/components/AuthContext";
import { orpcClient } from "#/shared/lib/orpc-client";


type CitizenBookingSummary = Awaited<
	ReturnType<typeof orpcClient.citizen.bookings.mine>
>[number];

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

function toDate(value: string | Date | null | undefined): Date | null {
	if (!value) return null;
	const parsed = value instanceof Date ? value : new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value: string | Date | null | undefined): string {
	const parsed = toDate(value);
	if (!parsed) return "-";
	return parsed.toLocaleString("es-CO", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function resolveDisplayStatus(booking: CitizenBookingSummary): string {
	const holdExpiresAtMs = toDate(booking.holdExpiresAt)?.getTime();

	if (
		booking.status === "held" &&
		booking.isActive &&
		holdExpiresAtMs !== undefined &&
		holdExpiresAtMs <= Date.now()
	) {
		return "expired";
	}

	return booking.status;
}

function statusColor(status: string): string {
	switch (status) {
		case "confirmed":
			return "green";
		case "held":
			return "yellow";
		case "expired":
			return "orange";
		case "cancelled":
			return "red";
		default:
			return "gray";
	}
}

function ProfilePage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();

	const bookingsQuery = useQuery({
		queryKey: ["citizen", "bookings", "mine", "all"],
		enabled: isAuthenticated,
		queryFn: async () =>
			await orpcClient.citizen.bookings.mine({ includeInactive: true }),
		refetchOnWindowFocus: true,
	});

	const cancelMutation = useMutation({
		mutationFn: async ({ bookingId }: { bookingId: string }) => {
			return await orpcClient.citizen.bookings.cancel({ bookingId });
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: ["citizen", "bookings", "mine"],
			});
		},
	});

	useEffect(() => {
		if (!authLoading && !isAuthenticated) {
			navigate({ to: "/login" });
		}
	}, [authLoading, isAuthenticated, navigate]);

	const initials = useMemo(() => {
		if (!user) return "U";
		if (user.name?.trim()) {
			return user.name
				.split(" ")
				.map((chunk) => chunk[0] ?? "")
				.join("")
				.slice(0, 2)
				.toUpperCase();
		}
		return user.email?.[0]?.toUpperCase() ?? "U";
	}, [user]);

	if (authLoading || !isAuthenticated || !user) {
		return (
			<Box py={80}>
				<Container size="sm">
					<Group justify="center" gap="sm">
						<Loader size="sm" />
						<Text size="sm" c="dimmed">
							Cargando perfil ciudadano...
						</Text>
					</Group>
				</Container>
			</Box>
		);
	}

	return (
		<Box py={72}>
			<Container size="lg">
				<Stack gap="lg">
					<Card withBorder radius="md" p="xl">
						<Group justify="space-between" align="flex-start" wrap="wrap">
							<Group gap="md" align="center">
								<Avatar size={56} radius="xl" color="red">
									{initials}
								</Avatar>
								<Stack gap={2}>
									<Title order={3}>{user.name || "Ciudadano"}</Title>
									<Text size="sm" c="dimmed">
										Portal ciudadano conectado a backend
									</Text>
								</Stack>
							</Group>

							<Group>
								<Button
									component={Link}
									to="/agendar"
									leftSection={<CalendarClock size={16} />}
								>
									Agendar cita
								</Button>
								<Button
									variant="default"
									onClick={() => {
										void logout().then(() => navigate({ to: "/" }));
									}}
								>
									Cerrar sesión
								</Button>
							</Group>
						</Group>

						<Divider my="md" />

						<SimpleGrid cols={{ base: 1, sm: 3 }}>
							<Group gap="sm">
								<Mail size={16} />
								<Stack gap={0}>
									<Text size="xs" c="dimmed">
										Correo
									</Text>
									<Text size="sm" fw={500}>
										{user.email}
									</Text>
								</Stack>
							</Group>
							<Group gap="sm">
								<User size={16} />
								<Stack gap={0}>
									<Text size="xs" c="dimmed">
										Rol
									</Text>
									<Text size="sm" fw={500}>
										Ciudadano
									</Text>
								</Stack>
							</Group>
							<Group gap="sm">
								<Phone size={16} />
								<Stack gap={0}>
									<Text size="xs" c="dimmed">
										Teléfono
									</Text>
									<Text size="sm" fw={500}>
										{user.phone || "No registrado"}
									</Text>
								</Stack>
							</Group>
						</SimpleGrid>
					</Card>

					<Card withBorder radius="md" p="xl">
						<Stack gap="md">
							<Group justify="space-between">
								<Title order={4}>Mis citas</Title>
								{bookingsQuery.isFetching ? <Loader size="xs" /> : null}
							</Group>

							{bookingsQuery.isError ? (
								<Alert color="red" icon={<AlertCircle size={16} />}>
									{getErrorMessage(
										bookingsQuery.error,
										"No se pudieron cargar tus citas.",
									)}
								</Alert>
							) : null}

							{bookingsQuery.isPending ? (
								<Group gap="sm">
									<Loader size="sm" />
									<Text size="sm" c="dimmed">
										Consultando citas en backend...
									</Text>
								</Group>
							) : null}

							{(bookingsQuery.data ?? []).length > 0 ? (
								<Stack gap="sm">
									{(bookingsQuery.data ?? []).map((booking) => {
										const displayStatus = resolveDisplayStatus(booking);
										const canCancel =
											booking.isActive &&
											(displayStatus === "held" ||
												displayStatus === "confirmed");

										return (
											<Card key={booking.id} withBorder radius="md" p="md">
												<Group justify="space-between" align="flex-start">
													<Stack gap={2}>
														<Text fw={600}>
															{booking.request?.procedure?.name || "Trámite"}
														</Text>
														<Text size="sm" c="dimmed">
															{booking.slot
																? `${booking.slot.slotDate} · ${booking.slot.startTime} - ${booking.slot.endTime}`
																: "Sin horario asociado"}
														</Text>
														<Text size="xs" c="dimmed">
															Creada: {formatDateTime(booking.createdAt)}
														</Text>
														{displayStatus === "held" ? (
															<Text size="xs" c="dimmed">
																Expira: {formatDateTime(booking.holdExpiresAt)}
															</Text>
														) : null}
													</Stack>

													<Stack gap="xs" align="flex-end">
														<Badge color={statusColor(displayStatus)}>
															{displayStatus}
														</Badge>
														{canCancel ? (
															<Button
																size="xs"
																variant="default"
																onClick={() => {
																	void cancelMutation.mutateAsync({
																		bookingId: booking.id,
																	});
																}}
																loading={
																	cancelMutation.isPending &&
																	cancelMutation.variables?.bookingId ===
																		booking.id
																}
															>
																Cancelar
															</Button>
														) : null}
													</Stack>
												</Group>
											</Card>
										);
									})}
								</Stack>
							) : (
								<Text size="sm" c="dimmed">
									Aún no tienes citas registradas. Agenda la primera desde el
									portal.
								</Text>
							)}
						</Stack>
					</Card>
				</Stack>
			</Container>
		</Box>
	);
}
export default ProfilePage;
