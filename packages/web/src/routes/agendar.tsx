import {
	Alert,
	Badge,
	Box,
	Button,
	Card,
	Container,
	Divider,
	Grid,
	Group,
	Loader,
	PinInput,
	Select,
	SimpleGrid,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlertCircle,
	CalendarClock,
	CheckCircle2,
	Clock,
	Mail,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { orpcClient } from "../lib/orpc-client";

export const Route = createFileRoute("/agendar")({
	component: AgendarPage,
});

type CitizenProcedure = Awaited<
	ReturnType<typeof orpcClient.citizen.procedures.list>
>[number];

type SlotsRangeResponse = Awaited<
	ReturnType<typeof orpcClient.citizen.slots.range>
>;

type CitizenBookingSummary = Awaited<
	ReturnType<typeof orpcClient.citizen.bookings.confirm>
>;

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
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateLabel(value: string) {
	return new Date(`${value}T00:00:00`).toLocaleDateString("es-CO", {
		weekday: "long",
		month: "long",
		day: "numeric",
	});
}

function formatDateTime(value: string | Date | null | undefined) {
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

function useHoldCountdown(expiresAt: string | Date | null | undefined) {
	const expiresAtMs = useMemo(
		() => toDate(expiresAt)?.getTime() ?? null,
		[expiresAt],
	);
	const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

	useEffect(() => {
		if (!expiresAtMs) {
			setRemainingSeconds(0);
			return;
		}

		const tick = () => {
			const nextSeconds = Math.max(
				0,
				Math.ceil((expiresAtMs - Date.now()) / 1000),
			);
			setRemainingSeconds(nextSeconds);
		};

		tick();
		const intervalId = window.setInterval(tick, 1000);
		return () => window.clearInterval(intervalId);
	}, [expiresAtMs]);

	return remainingSeconds;
}

function formatSeconds(seconds: number) {
	const safeSeconds = Math.max(0, seconds);
	const minutes = Math.floor(safeSeconds / 60);
	const secs = safeSeconds % 60;
	return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function AgendarPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { user, isAuthenticated, sendVerificationOtp, signInEmailOtp } =
		useAuth();

	const [authenticatedStep, setAuthenticatedStep] = useState(1);
	const [authEmail, setAuthEmail] = useState("");
	const [otpCode, setOtpCode] = useState("");
	const [selectedDate, setSelectedDate] = useState<string | null>(null);
	const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
	const [holdBooking, setHoldBooking] = useState<CitizenBookingSummary | null>(
		null,
	);
	const [feedback, setFeedback] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const currentStep = isAuthenticated ? authenticatedStep : 0;

	const detailsForm = useForm({
		initialValues: {
			procedureTypeId: "",
			plate: "",
			applicantName: "",
			applicantDocument: "",
			documentType: "CC",
			phone: "",
			email: "",
			notes: "",
		},
		validate: {
			procedureTypeId: (value) =>
				value ? null : "Selecciona el trámite a agendar",
			applicantName: (value) =>
				value.trim().length >= 3 ? null : "Ingresa el nombre completo",
			applicantDocument: (value) =>
				value.trim().length >= 5 ? null : "Ingresa un documento válido",
			email: (value) =>
				/^\S+@\S+\.\S+$/.test(value)
					? null
					: "Ingresa un correo electrónico válido",
		},
	});

	const proceduresQuery = useQuery({
		queryKey: ["citizen", "procedures"],
		enabled: isAuthenticated,
		queryFn: async () => await orpcClient.citizen.procedures.list(),
		staleTime: 5 * 60 * 1000,
	});

	const slotsRangeQuery = useQuery({
		queryKey: ["citizen", "slots-range", 14],
		enabled: isAuthenticated && currentStep >= 2,
		queryFn: async () => await orpcClient.citizen.slots.range({ days: 14 }),
		staleTime: 20 * 1000,
	});
	const myBookingsQuery = useQuery({
		queryKey: ["citizen", "bookings", "mine", "active"],
		enabled: isAuthenticated,
		queryFn: async () =>
			await orpcClient.citizen.bookings.mine({ includeInactive: false }),
		staleTime: 20 * 1000,
	});

	const sendOtpMutation = useMutation({
		mutationFn: async (email: string) => {
			await sendVerificationOtp(email, "sign-in");
		},
		onSuccess: (_, email) => {
			setAuthEmail(email);
			setOtpCode("");
			setError(null);
			setFeedback("Enviamos un código OTP de 6 dígitos al correo indicado.");
		},
		onError: (mutationError) => {
			setError(
				getErrorMessage(mutationError, "No fue posible enviar el código OTP."),
			);
		},
	});

	const verifyOtpMutation = useMutation({
		mutationFn: async (payload: { email: string; otp: string }) => {
			await signInEmailOtp(payload.email, payload.otp);
		},
		onSuccess: () => {
			setError(null);
			setFeedback("Sesión validada. Continúa con los datos del trámite.");
			setAuthenticatedStep(1);
		},
		onError: (mutationError) => {
			setError(
				getErrorMessage(
					mutationError,
					"OTP inválido o expirado. Solicita un nuevo código.",
				),
			);
			setOtpCode("");
		},
	});

	const holdMutation = useMutation({
		mutationFn: async () => {
			if (!resolvedSelectedSlotId) {
				throw new Error("Selecciona un horario disponible.");
			}

			return await orpcClient.citizen.bookings.hold({
				procedureTypeId: detailsForm.values.procedureTypeId,
				slotId: resolvedSelectedSlotId,
				plate: detailsForm.values.plate.trim() || undefined,
				applicantName: detailsForm.values.applicantName.trim(),
				applicantDocument: detailsForm.values.applicantDocument.trim(),
				documentType: detailsForm.values.documentType,
				phone: detailsForm.values.phone.trim() || undefined,
				email: detailsForm.values.email.trim().toLowerCase(),
				notes: detailsForm.values.notes.trim() || undefined,
			});
		},
		onSuccess: async (response) => {
			setHoldBooking(response.booking);
			setAuthenticatedStep(3);
			setError(null);
			setFeedback("Reserva temporal creada. Confirma antes de que expire.");
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: ["citizen", "slots-range", 14],
				}),
				queryClient.invalidateQueries({
					queryKey: ["citizen", "bookings", "mine"],
				}),
			]);
		},
		onError: (mutationError) => {
			setError(
				getErrorMessage(
					mutationError,
					"No pudimos crear la reserva temporal para este horario.",
				),
			);
		},
	});

	const confirmMutation = useMutation({
		mutationFn: async () => {
			if (!holdBooking) {
				throw new Error("No hay una reserva temporal para confirmar.");
			}

			return await orpcClient.citizen.bookings.confirm({
				bookingId: holdBooking.id,
			});
		},
		onSuccess: async () => {
			setError(null);
			setFeedback("Cita confirmada correctamente.");
			await queryClient.invalidateQueries({
				queryKey: ["citizen", "bookings", "mine"],
			});
			navigate({ to: "/mi-perfil" });
		},
		onError: (mutationError) => {
			setError(
				getErrorMessage(
					mutationError,
					"No fue posible confirmar la cita. Verifica el estado de la reserva.",
				),
			);
		},
	});

	const cancelHoldMutation = useMutation({
		mutationFn: async () => {
			if (!holdBooking) {
				throw new Error("No hay reserva temporal activa.");
			}

			return await orpcClient.citizen.bookings.cancel({
				bookingId: holdBooking.id,
			});
		},
		onSuccess: async () => {
			setHoldBooking(null);
			setAuthenticatedStep(2);
			setError(null);
			setFeedback("Reserva temporal liberada.");
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: ["citizen", "slots-range", 14],
				}),
				queryClient.invalidateQueries({
					queryKey: ["citizen", "bookings", "mine"],
				}),
			]);
		},
		onError: (mutationError) => {
			setError(
				getErrorMessage(
					mutationError,
					"No fue posible cancelar la reserva temporal.",
				),
			);
		},
	});

	const selectedProcedure = useMemo(() => {
		return (
			(proceduresQuery.data ?? []).find(
				(procedure) => procedure.id === detailsForm.values.procedureTypeId,
			) ?? null
		);
	}, [proceduresQuery.data, detailsForm.values.procedureTypeId]);
	const proceduresById = useMemo(
		() =>
			new Map(
				(proceduresQuery.data ?? []).map((procedure) => [
					procedure.id,
					procedure,
				]),
			),
		[proceduresQuery.data],
	);

	const slotsByDate = useMemo(() => {
		const data =
			(slotsRangeQuery.data as SlotsRangeResponse | undefined)?.daily ?? [];
		return new Map(data.map((day) => [day.date, day]));
	}, [slotsRangeQuery.data]);

	const availableDates = useMemo(() => {
		const daily =
			(slotsRangeQuery.data as SlotsRangeResponse | undefined)?.daily ?? [];
		return daily.filter((day) => day.count > 0);
	}, [slotsRangeQuery.data]);
	const resolvedSelectedDate = useMemo(() => {
		if (selectedDate && slotsByDate.has(selectedDate)) {
			return selectedDate;
		}
		return availableDates[0]?.date ?? null;
	}, [availableDates, selectedDate, slotsByDate]);

	const selectedDaySlots = useMemo(() => {
		if (!resolvedSelectedDate) return [];
		return slotsByDate.get(resolvedSelectedDate)?.slots ?? [];
	}, [resolvedSelectedDate, slotsByDate]);
	const resolvedSelectedSlotId = useMemo(() => {
		if (!selectedSlotId) return null;
		const slotExists = selectedDaySlots.some(
			(slot) => slot.id === selectedSlotId,
		);
		return slotExists ? selectedSlotId : null;
	}, [selectedDaySlots, selectedSlotId]);

	const holdRemainingSeconds = useHoldCountdown(
		holdBooking?.holdExpiresAt ?? null,
	);
	const serverHeldBooking = useMemo(() => {
		const bookings = myBookingsQuery.data ?? [];
		return (
			bookings.find((booking) => booking.isActive && booking.status === "held") ??
			null
		);
	}, [myBookingsQuery.data]);
	const holdExpired =
		Boolean(holdBooking) &&
		holdBooking?.status === "held" &&
		holdRemainingSeconds <= 0;

	useEffect(() => {
		if (!user?.email) return;
		if (!detailsForm.values.email) {
			detailsForm.setFieldValue("email", user.email);
		}
	}, [detailsForm.setFieldValue, detailsForm.values.email, user?.email]);

	useEffect(() => {
		if (!isAuthenticated || !serverHeldBooking) return;
		if (holdBooking?.id === serverHeldBooking.id) return;

		setHoldBooking(serverHeldBooking);
		setSelectedDate(serverHeldBooking.slot?.slotDate ?? null);
		setSelectedSlotId(serverHeldBooking.slot?.id ?? null);
		setAuthenticatedStep(3);
		setFeedback(
			"Recuperamos tu reserva temporal activa. Confírmala antes de que expire.",
		);
	}, [isAuthenticated, serverHeldBooking, holdBooking?.id]);

	const handleValidateOtp = useCallback(() => {
		if (!authEmail) {
			setError("Primero envía el código OTP a un correo válido.");
			return;
		}

		if (otpCode.length !== 6) {
			setError("El código OTP debe tener 6 dígitos.");
			return;
		}

		setError(null);
		setFeedback(null);
		verifyOtpMutation.mutate({ email: authEmail, otp: otpCode });
	}, [authEmail, otpCode, verifyOtpMutation]);

	const handleContinueToSlots = detailsForm.onSubmit((values) => {
		if (selectedProcedure?.requiresVehicle && !values.plate.trim()) {
			detailsForm.setFieldError("plate", "Este trámite requiere placa");
			return;
		}

		setError(null);
		setFeedback(null);
		setAuthenticatedStep(2);
	});

	return (
		<Box py={72}>
			<Container size="lg">
				<Stack gap="lg">
					<Stack gap={4}>
						<Title order={2}>Agendar cita ciudadana</Title>
						<Text size="sm" c="dimmed">
							Flujo conectado a backend: OTP, reserva temporal, confirmación
							real y consulta en perfil.
						</Text>
					</Stack>

					<Group gap="xs">
						<Badge color={currentStep >= 0 ? "red" : "gray"}>1. Acceso</Badge>
						<Badge color={currentStep >= 1 ? "red" : "gray"}>2. Datos</Badge>
						<Badge color={currentStep >= 2 ? "red" : "gray"}>3. Horario</Badge>
						<Badge color={currentStep >= 3 ? "red" : "gray"}>
							4. Confirmar
						</Badge>
					</Group>

					{error ? (
						<Alert color="red" icon={<AlertCircle size={16} />}>
							{error}
						</Alert>
					) : null}
					{feedback ? (
						<Alert color="green" icon={<CheckCircle2 size={16} />}>
							{feedback}
						</Alert>
					) : null}

					{currentStep === 0 ? (
						<Card withBorder radius="md" p="xl">
							<Stack gap="md">
								<Group gap="sm">
									<Mail size={18} />
									<Text fw={600}>Verificación OTP</Text>
								</Group>
								<TextInput
									type="email"
									label="Correo electrónico"
									placeholder="correo@ejemplo.com"
									value={authEmail}
									onChange={(event) => setAuthEmail(event.currentTarget.value)}
								/>
								<Group grow>
									<Button
										leftSection={<Mail size={16} />}
										onClick={() => {
											setError(null);
											setFeedback(null);
											void sendOtpMutation.mutateAsync(
												authEmail.trim().toLowerCase(),
											);
										}}
										loading={sendOtpMutation.isPending}
										disabled={!/^\S+@\S+\.\S+$/.test(authEmail)}
									>
										Enviar OTP
									</Button>
								</Group>
								<PinInput
									length={6}
									type="number"
									value={otpCode}
									onChange={setOtpCode}
								/>
								<Button
									onClick={handleValidateOtp}
									loading={verifyOtpMutation.isPending}
									disabled={otpCode.length !== 6}
								>
									Validar y continuar
								</Button>
							</Stack>
						</Card>
					) : null}

					{currentStep === 1 ? (
						<Card withBorder radius="md" p="xl">
							<form onSubmit={handleContinueToSlots}>
								<Stack gap="md">
									<Select
										required
										label="Trámite"
										placeholder={
											proceduresQuery.isPending
												? "Cargando trámites..."
												: "Selecciona un trámite"
										}
										value={detailsForm.values.procedureTypeId}
										onChange={(value) => {
											const nextProcedureTypeId = value ?? "";
											detailsForm.setFieldValue(
												"procedureTypeId",
												nextProcedureTypeId,
											);

											const requiresVehicle =
												proceduresById.get(nextProcedureTypeId)
													?.requiresVehicle ?? false;
											if (!requiresVehicle && detailsForm.values.plate) {
												detailsForm.setFieldValue("plate", "");
											}
										}}
										data={(proceduresQuery.data ?? []).map(
											(procedure: CitizenProcedure) => ({
												value: procedure.id,
												label: procedure.name,
											}),
										)}
										error={
											proceduresQuery.isError
												? "No pudimos cargar los trámites disponibles"
												: detailsForm.errors.procedureTypeId
										}
									/>

									{selectedProcedure?.requiresVehicle ? (
										<TextInput
											required
											label="Placa"
											placeholder="Ej: ABC123"
											value={detailsForm.values.plate}
											onChange={(event) =>
												detailsForm.setFieldValue(
													"plate",
													event.currentTarget.value.toUpperCase(),
												)
											}
											error={detailsForm.errors.plate}
										/>
									) : null}

									<SimpleGrid cols={{ base: 1, sm: 2 }}>
										<TextInput
											required
											label="Nombre completo"
											placeholder="Ej: Ana Gómez"
											{...detailsForm.getInputProps("applicantName")}
										/>
										<TextInput
											required
											label="Documento"
											placeholder="Número de identificación"
											{...detailsForm.getInputProps("applicantDocument")}
										/>
										<Select
											label="Tipo documento"
											data={[
												{ value: "CC", label: "CC" },
												{ value: "CE", label: "CE" },
												{ value: "PP", label: "Pasaporte" },
											]}
											{...detailsForm.getInputProps("documentType")}
										/>
										<TextInput
											label="Teléfono"
											placeholder="Ej: 3001234567"
											{...detailsForm.getInputProps("phone")}
										/>
									</SimpleGrid>

									<TextInput
										required
										type="email"
										label="Correo de contacto"
										placeholder="correo@ejemplo.com"
										{...detailsForm.getInputProps("email")}
									/>

									<Textarea
										label="Notas (opcional)"
										minRows={2}
										placeholder="Información adicional para la cita"
										{...detailsForm.getInputProps("notes")}
									/>

									<Group justify="space-between">
										<Button
											variant="default"
											onClick={() => setAuthenticatedStep(0)}
										>
											Volver
										</Button>
										<Button type="submit">Continuar a horarios</Button>
									</Group>
								</Stack>
							</form>
						</Card>
					) : null}

					{currentStep === 2 ? (
						<Card withBorder radius="md" p="xl">
							<Stack gap="md">
								<Group justify="space-between" align="center">
									<Text fw={600}>Selecciona fecha y horario</Text>
									{slotsRangeQuery.isFetching ? <Loader size="sm" /> : null}
								</Group>

								{slotsRangeQuery.isPending ? (
									<Group gap="sm">
										<Loader size="sm" />
										<Text size="sm" c="dimmed">
											Cargando disponibilidad real...
										</Text>
									</Group>
								) : null}

								{availableDates.length > 0 ? (
									<>
										<Select
											label="Fecha"
											value={resolvedSelectedDate}
											onChange={(value) => {
												setSelectedDate(value);
												setSelectedSlotId(null);
											}}
											data={availableDates.map((day) => ({
												value: day.date,
												label: formatDateLabel(day.date),
											}))}
										/>

										<SimpleGrid cols={{ base: 1, sm: 2 }}>
											{selectedDaySlots.map((slot) => (
												<Button
													key={slot.id}
													variant={
														resolvedSelectedSlotId === slot.id
															? "filled"
															: "default"
													}
													onClick={() => setSelectedSlotId(slot.id)}
												>
													{slot.startTime} - {slot.endTime} (
													{slot.remainingCapacity ?? "∞"})
												</Button>
											))}
										</SimpleGrid>
									</>
								) : (
									<Alert color="yellow" icon={<CalendarClock size={16} />}>
										No hay cupos disponibles en el rango consultado.
									</Alert>
								)}

								<Divider />

								<Group justify="space-between">
									<Button
										variant="default"
										onClick={() => setAuthenticatedStep(1)}
									>
										Volver a datos
									</Button>
									<Button
										onClick={() => {
											setError(null);
											setFeedback(null);
											void holdMutation.mutateAsync();
										}}
										loading={holdMutation.isPending}
										disabled={!resolvedSelectedSlotId}
									>
										Reservar temporalmente
									</Button>
								</Group>
							</Stack>
						</Card>
					) : null}

					{currentStep === 3 && holdBooking ? (
						<Card withBorder radius="md" p="xl">
							<Stack gap="lg">
								<Alert
									color={holdExpired ? "red" : "yellow"}
									icon={<Clock size={16} />}
								>
									{holdExpired ? (
										<>
											La reserva temporal expiró. Selecciona un nuevo horario.
										</>
									) : (
										<>
											Tu reserva temporal expira en{" "}
											<b>{formatSeconds(holdRemainingSeconds)}</b>.
										</>
									)}
								</Alert>

								<Grid>
									<Grid.Col span={{ base: 12, sm: 6 }}>
										<Text size="sm" c="dimmed">
											Trámite
										</Text>
										<Text fw={600}>
											{holdBooking.request?.procedure?.name ?? "-"}
										</Text>
									</Grid.Col>
									<Grid.Col span={{ base: 12, sm: 6 }}>
										<Text size="sm" c="dimmed">
											Horario
										</Text>
										<Text fw={600}>
											{holdBooking.slot?.slotDate ?? "-"}{" "}
											{holdBooking.slot?.startTime ?? ""}
										</Text>
									</Grid.Col>
									<Grid.Col span={{ base: 12, sm: 6 }}>
										<Text size="sm" c="dimmed">
											Estado
										</Text>
										<Text fw={600}>{holdBooking.status}</Text>
									</Grid.Col>
									<Grid.Col span={{ base: 12, sm: 6 }}>
										<Text size="sm" c="dimmed">
											Expira
										</Text>
										<Text fw={600}>
											{formatDateTime(holdBooking.holdExpiresAt)}
										</Text>
									</Grid.Col>
								</Grid>

								<Group justify="space-between">
									<Button
										variant="default"
										onClick={() => {
											setError(null);
											setFeedback(null);
											void cancelHoldMutation.mutateAsync();
										}}
										loading={cancelHoldMutation.isPending}
									>
										{holdExpired ? "Elegir otro horario" : "Cancelar reserva"}
									</Button>
									<Button
										onClick={() => {
											setError(null);
											setFeedback(null);
											void confirmMutation.mutateAsync();
										}}
										loading={confirmMutation.isPending}
										disabled={holdExpired}
									>
										Confirmar cita
									</Button>
								</Group>
							</Stack>
						</Card>
					) : null}
				</Stack>
			</Container>
		</Box>
	);
}
