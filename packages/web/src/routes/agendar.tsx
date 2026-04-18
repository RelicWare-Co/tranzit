import {
	Alert,
	Anchor,
	Badge,
	Box,
	Button,
	Checkbox,
	Container,
	Divider,
	Flex,
	Grid,
	Group,
	Loader,
	Modal,
	PinInput,
	Select,
	SimpleGrid,
	Stack,
	Text,
	TextInput,
	ThemeIcon,
	Title,
	UnstyledButton,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlertCircle,
	CalendarClock,
	CheckCircle2,
	ChevronRight,
	Clock,
	FileText,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { orpcClient } from "../lib/orpc-client";
import classes from "./agendar.module.css";

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

type ProcedureRequirement = {
	key: string;
	label: string;
	isRequired: boolean;
	instructions: string | null;
	downloadUrl: string | null;
};

const BOOKING_STEPS = [
	{
		key: "procedure",
		label: "Trámite",
		description: "Elige el servicio que vas a realizar.",
	},
	{
		key: "requirements",
		label: "Requisitos",
		description: "Revisa formatos y confirma documentos.",
	},
	{
		key: "schedule",
		label: "Horario",
		description: "Selecciona fecha y hora disponible.",
	},
	{
		key: "details",
		label: "Datos",
		description: "Completa tu información y asegura el cupo.",
	},
] as const;

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message) return error.message;
	if (error && typeof error === "object" && "message" in error) {
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

function getProcedureRequirements(procedure: CitizenProcedure | null) {
	if (!procedure) return [];
	const rawSchema = procedure.documentSchema;
	if (!rawSchema || typeof rawSchema !== "object") return [];

	const requirements = (rawSchema as { requirements?: unknown }).requirements;
	if (!Array.isArray(requirements)) return [];

	return requirements
		.map((rawRequirement, index): ProcedureRequirement | null => {
			if (!rawRequirement || typeof rawRequirement !== "object") return null;
			const req = rawRequirement as Record<string, unknown>;
			const key =
				typeof req.key === "string" && req.key.trim().length > 0
					? req.key.trim()
					: `requirement-${index + 1}`;
			const label =
				typeof req.label === "string" && req.label.trim().length > 0
					? req.label.trim()
					: `Requisito ${index + 1}`;
			const instructions =
				typeof req.instructions === "string" &&
				req.instructions.trim().length > 0
					? req.instructions.trim()
					: null;
			const downloadUrlCandidates = [
				req.downloadUrl,
				req.download_url,
				req.templateUrl,
				req.template_url,
				req.url,
			];
			const downloadUrl =
				downloadUrlCandidates.find(
					(candidate) =>
						typeof candidate === "string" && candidate.trim().length > 0,
				) ?? null;

			return {
				key,
				label,
				isRequired: req.required !== false,
				instructions,
				downloadUrl:
					typeof downloadUrl === "string" ? downloadUrl.trim() : null,
			};
		})
		.filter(Boolean) as ProcedureRequirement[];
}

function AgendarPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { user, isAuthenticated, sendVerificationOtp, signInEmailOtp } =
		useAuth();

	const [selectedDate, setSelectedDate] = useState<string | null>(null);
	const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
	const [requirementsAcknowledged, setRequirementsAcknowledged] =
		useState(false);
	const [activeStep, setActiveStep] = useState(0);

	const [holdBooking, setHoldBooking] = useState<CitizenBookingSummary | null>(
		null,
	);

	const [feedback, setFeedback] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
	const [authEmail, setAuthEmail] = useState("");
	const [otpCode, setOtpCode] = useState("");

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
			procedureTypeId: (value) => (value ? null : "Selecciona el trámite"),
			applicantName: (value) =>
				value.trim().length >= 3 ? null : "Ingresa tu nombre",
			applicantDocument: (value) =>
				value.trim().length >= 5 ? null : "Ingresa un documento válido",
			email: (value) =>
				/^\S+@\S+\.\S+$/.test(value) ? null : "Ingresa un correo válido",
			plate: (value, values) => {
				const proc = proceduresById?.get(values.procedureTypeId);
				if (proc?.requiresVehicle && !value.trim()) {
					return "Este trámite requiere placa";
				}
				return null;
			},
		},
	});

	const proceduresQuery = useQuery({
		queryKey: ["citizen", "procedures"],
		queryFn: async () => await orpcClient.citizen.procedures.list(),
		staleTime: 5 * 60 * 1000,
	});

	const proceduresById = useMemo(
		() => new Map((proceduresQuery.data ?? []).map((p) => [p.id, p])),
		[proceduresQuery.data],
	);

	const selectedProcedure = useMemo(() => {
		return proceduresById.get(detailsForm.values.procedureTypeId) ?? null;
	}, [proceduresById, detailsForm.values.procedureTypeId]);

	const procedureRequirements = useMemo(
		() => getProcedureRequirements(selectedProcedure),
		[selectedProcedure],
	);

	const slotsRangeQuery = useQuery({
		queryKey: ["citizen", "slots-range", 14],
		enabled: Boolean(selectedProcedure) && requirementsAcknowledged,
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
		if (selectedDate && slotsByDate.has(selectedDate)) return selectedDate;
		return availableDates[0]?.date ?? null;
	}, [availableDates, selectedDate, slotsByDate]);

	const selectedDaySlots = useMemo(() => {
		if (!resolvedSelectedDate) return [];
		return slotsByDate.get(resolvedSelectedDate)?.slots ?? [];
	}, [resolvedSelectedDate, slotsByDate]);

	const resolvedSelectedSlotId = useMemo(() => {
		if (!selectedSlotId) return null;
		const slotExists = selectedDaySlots.some((s) => s.id === selectedSlotId);
		return slotExists ? selectedSlotId : null;
	}, [selectedDaySlots, selectedSlotId]);

	const maxReachableStep = useMemo(() => {
		if (!selectedProcedure) return 0;
		if (!requirementsAcknowledged) return 1;
		if (!resolvedSelectedSlotId) return 2;
		return 3;
	}, [requirementsAcknowledged, resolvedSelectedSlotId, selectedProcedure]);

	const wizardProgress = useMemo(
		() => Math.round(((activeStep + 1) / BOOKING_STEPS.length) * 100),
		[activeStep],
	);

	useEffect(() => {
		if (activeStep <= maxReachableStep) return;
		setActiveStep(maxReachableStep);
	}, [activeStep, maxReachableStep]);

	useEffect(() => {
		if (!user?.email) return;
		if (!detailsForm.values.email) {
			detailsForm.setFieldValue("email", user.email);
			setAuthEmail(user.email);
		}
	}, [detailsForm.setFieldValue, detailsForm.values.email, user?.email]);

	const serverHeldBooking = useMemo(() => {
		const bookings = myBookingsQuery.data ?? [];
		return (
			bookings.find(
				(booking) => booking.isActive && booking.status === "held",
			) ?? null
		);
	}, [myBookingsQuery.data]);

	useEffect(() => {
		if (!isAuthenticated || !serverHeldBooking) return;
		if (holdBooking?.id === serverHeldBooking.id) return;

		setHoldBooking(serverHeldBooking);
		if (serverHeldBooking.request?.procedure?.id) {
			detailsForm.setFieldValue(
				"procedureTypeId",
				serverHeldBooking.request.procedure.id,
			);
		}
		setRequirementsAcknowledged(true);
		setFeedback("Recuperamos tu reserva temporal activa.");
	}, [
		detailsForm.setFieldValue,
		holdBooking?.id,
		isAuthenticated,
		serverHeldBooking,
	]);

	const holdRemainingSeconds = useHoldCountdown(holdBooking?.holdExpiresAt);
	const holdExpired =
		Boolean(holdBooking) &&
		holdBooking?.status === "held" &&
		holdRemainingSeconds <= 0;

	const sendOtpMutation = useMutation({
		mutationFn: async (email: string) => {
			await sendVerificationOtp(email, "sign-in");
		},
		onSuccess: (_, email) => {
			setAuthEmail(email);
			setOtpCode("");
			setError(null);
		},
		onError: (err) => {
			setError(getErrorMessage(err, "Error al enviar código OTP."));
		},
	});

	const holdMutation = useMutation({
		mutationFn: async () => {
			if (!resolvedSelectedSlotId) throw new Error("Selecciona horario.");
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
			setError(null);
			setFeedback("Cupo asegurado temporalmente.");
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["citizen", "slots-range"] }),
				queryClient.invalidateQueries({
					queryKey: ["citizen", "bookings", "mine"],
				}),
			]);
		},
		onError: (err) => {
			setError(
				getErrorMessage(err, "No pudimos crear la reserva para este horario."),
			);
		},
	});

	const verifyOtpMutation = useMutation({
		mutationFn: async (payload: { email: string; otp: string }) => {
			await signInEmailOtp(payload.email, payload.otp);
		},
		onSuccess: () => {
			setError(null);
			setIsAuthModalOpen(false);
			holdMutation.mutate();
		},
		onError: (err) => {
			setError(getErrorMessage(err, "Código inválido o expirado."));
			setOtpCode("");
		},
	});

	const confirmMutation = useMutation({
		mutationFn: async () => {
			if (!holdBooking) throw new Error("No hay reserva temporal.");
			return await orpcClient.citizen.bookings.confirm({
				bookingId: holdBooking.id,
			});
		},
		onSuccess: async () => {
			setError(null);
			setFeedback("¡Cita confirmada correctamente!");
			await queryClient.invalidateQueries({
				queryKey: ["citizen", "bookings", "mine"],
			});
			navigate({ to: "/mi-perfil" });
		},
		onError: (err) => {
			setError(getErrorMessage(err, "No fue posible confirmar la cita."));
		},
	});

	const cancelHoldMutation = useMutation({
		mutationFn: async () => {
			if (!holdBooking) throw new Error("No hay reserva activa.");
			return await orpcClient.citizen.bookings.cancel({
				bookingId: holdBooking.id,
			});
		},
		onSuccess: async () => {
			setHoldBooking(null);
			setSelectedSlotId(null);
			setActiveStep(selectedProcedure ? 2 : 0);
			setError(null);
			setFeedback("Reserva liberada. Elige otro horario.");
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["citizen", "slots-range"] }),
				queryClient.invalidateQueries({
					queryKey: ["citizen", "bookings", "mine"],
				}),
			]);
		},
		onError: (err) => {
			setError(getErrorMessage(err, "No fue posible cancelar la reserva."));
		},
	});

	const handleReserveClick = detailsForm.onSubmit((values) => {
		if (!resolvedSelectedSlotId) {
			setError("Debes seleccionar una fecha y horario.");
			return;
		}
		setError(null);

		if (!isAuthenticated) {
			setAuthEmail(values.email);
			setIsAuthModalOpen(true);
			sendOtpMutation.mutate(values.email);
			return;
		}
		holdMutation.mutate();
	});

	const goToStep = (nextStep: number) => {
		if (nextStep < 0 || nextStep >= BOOKING_STEPS.length) return;
		if (nextStep > maxReachableStep) return;
		setError(null);
		setActiveStep(nextStep);
	};

	const handleProcedureContinue = () => {
		if (!selectedProcedure) {
			setError("Selecciona un trámite para continuar.");
			return;
		}
		goToStep(1);
	};

	const handleRequirementsContinue = () => {
		if (!requirementsAcknowledged) {
			setError("Confirma que revisaste los requisitos antes de continuar.");
			return;
		}
		goToStep(2);
	};

	const handleSlotsContinue = () => {
		if (!resolvedSelectedSlotId) {
			setError("Selecciona una fecha y horario para continuar.");
			return;
		}
		goToStep(3);
	};

	return (
		<Box py={{ base: 32, md: 64 }} className={classes.root}>
			<Container size="xl">
				{error && (
					<Alert
						color="red"
						icon={<AlertCircle size={16} />}
						mb="xl"
						className={classes.alert}
					>
						{error}
					</Alert>
				)}
				{feedback && !holdBooking && (
					<Alert
						color="green"
						icon={<CheckCircle2 size={16} />}
						mb="xl"
						className={classes.alert}
					>
						{feedback}
					</Alert>
				)}

				{!holdBooking ? (
					<Grid style={{ gap: 48 }}>
						<Grid.Col span={{ base: 12, md: 7, lg: 7 }}>
							<Stack gap="xl">
								<Box>
									<Title order={1} className={classes.pageTitle}>
										Agendar Cita
									</Title>
									<Text
										size="lg"
										c="dimmed"
										mt="xs"
										className={classes.pageSubtitle}
									>
										Avanza paso a paso para reservar sin perderte en el proceso.
									</Text>
								</Box>

								<div className={classes.stepRail}>
									{BOOKING_STEPS.map((step, index) => {
										const state =
											index < activeStep
												? "done"
												: index === activeStep
													? "active"
													: "upcoming";
										const isClickable = index <= maxReachableStep;

										return (
											<UnstyledButton
												key={step.key}
												type="button"
												className={classes.stepRailItem}
												data-state={state}
												data-clickable={isClickable || undefined}
												onClick={() => goToStep(index)}
												disabled={!isClickable}
											>
												<span className={classes.stepRailIndex}>
													{index + 1}
												</span>
												<span className={classes.stepRailText}>
													<Text
														size="xs"
														fw={700}
														tt="uppercase"
														style={{ letterSpacing: 0.6 }}
													>
														{step.label}
													</Text>
													<Text size="xs" c="dimmed">
														{step.description}
													</Text>
												</span>
											</UnstyledButton>
										);
									})}
								</div>

								<div className={`${classes.wizardPanel} ${classes.fadeEnter}`}>
									<div className={classes.progressTrack}>
										<div
											className={classes.progressFill}
											style={{ width: `${wizardProgress}%` }}
										/>
									</div>

									<Group justify="space-between" align="center" my="xl">
										<div>
											<Text
												size="xs"
												c="dimmed"
												tt="uppercase"
												fw={700}
												style={{ letterSpacing: 0.8 }}
											>
												Paso {activeStep + 1} de {BOOKING_STEPS.length}
											</Text>
											<Text fw={700} size="xl" className={classes.stepTitle}>
												{BOOKING_STEPS[activeStep]?.label}
											</Text>
										</div>
										<Badge color="red" variant="light" size="lg" radius="sm">
											{wizardProgress}% completado
										</Badge>
									</Group>

									<form onSubmit={handleReserveClick}>
										<Stack gap="xl">
											{activeStep === 0 && (
												<Box>
													<Text
														fw={600}
														size="xl"
														className={classes.stepTitle}
														mb="xl"
													>
														¿Qué trámite necesitas?
													</Text>
													{proceduresQuery.isPending ? (
														<Loader size="sm" color="red" />
													) : proceduresQuery.data &&
														proceduresQuery.data.length > 0 ? (
														<div className={classes.radioList}>
															{proceduresQuery.data.map((proc) => (
																<UnstyledButton
																	key={proc.id}
																	type="button"
																	className={classes.radioCard}
																	data-checked={
																		detailsForm.values.procedureTypeId ===
																			proc.id || undefined
																	}
																	onClick={() => {
																		const changedProcedure =
																			detailsForm.values.procedureTypeId !==
																			proc.id;
																		detailsForm.setFieldValue(
																			"procedureTypeId",
																			proc.id,
																		);
																		if (changedProcedure) {
																			setRequirementsAcknowledged(false);
																			setSelectedDate(null);
																			setSelectedSlotId(null);
																		}
																		if (!proc.requiresVehicle) {
																			detailsForm.setFieldValue("plate", "");
																		}
																	}}
																>
																	<div className={classes.radioCheck} />
																	<div>
																		<Text fw={600} size="md">
																			{proc.name}
																		</Text>
																		{proc.requiresVehicle && (
																			<Badge
																				color="blue"
																				variant="dot"
																				size="xs"
																				mt={8}
																			>
																				Requiere placa
																			</Badge>
																		)}
																	</div>
																</UnstyledButton>
															))}
														</div>
													) : (
														<Alert
															color="yellow"
															icon={<CalendarClock size={16} />}
														>
															No hay trámites disponibles por ahora.
														</Alert>
													)}
													<Group justify="space-between" mt={40}>
														<Text size="sm" c="dimmed">
															Selecciona un trámite para habilitar el siguiente
															paso.
														</Text>
														<Button
															type="button"
															size="lg"
															color="red"
															disabled={!selectedProcedure}
															onClick={handleProcedureContinue}
															rightSection={<ChevronRight size={18} />}
														>
															Continuar
														</Button>
													</Group>
												</Box>
											)}

											{activeStep === 1 && selectedProcedure && (
												<Box className={classes.fadeEnter}>
													<Text
														fw={600}
														size="xl"
														className={classes.stepTitle}
														mb="xl"
													>
														Requisitos del trámite
													</Text>

													<div className={classes.requirementsBox}>
														{procedureRequirements.length > 0 ? (
															<Stack gap="lg" mb="xl">
																{procedureRequirements.map((req) => (
																	<Box
																		key={req.key}
																		className={classes.requirementItem}
																	>
																		<Group
																			justify="space-between"
																			align="center"
																			wrap="nowrap"
																		>
																			<div>
																				<Text fw={600} size="sm">
																					{req.label}
																				</Text>
																				{req.instructions && (
																					<Text size="sm" c="dimmed" mt={4}>
																						{req.instructions}
																					</Text>
																				)}
																			</div>
																			{req.downloadUrl && (
																				<Anchor
																					href={req.downloadUrl}
																					target="_blank"
																					className={classes.downloadLink}
																				>
																					Descargar formato
																				</Anchor>
																			)}
																		</Group>
																	</Box>
																))}
															</Stack>
														) : (
															<Text size="sm" c="dimmed" fs="italic" mb="xl">
																No hay plantillas requeridas para este trámite.
															</Text>
														)}

														<Checkbox
															size="md"
															color="red"
															label="He revisado los requisitos y llevaré los documentos impresos el día de mi cita."
															checked={requirementsAcknowledged}
															onChange={(e) =>
																setRequirementsAcknowledged(
																	e.currentTarget.checked,
																)
															}
															className={classes.acknowledgeCheck}
														/>
													</div>

													<Group justify="space-between" mt={40}>
														<Button
															type="button"
															variant="subtle"
															color="gray"
															size="lg"
															onClick={() => goToStep(0)}
														>
															Volver
														</Button>
														<Button
															type="button"
															size="lg"
															color="red"
															onClick={handleRequirementsContinue}
															disabled={!requirementsAcknowledged}
															rightSection={<ChevronRight size={18} />}
														>
															Continuar
														</Button>
													</Group>
												</Box>
											)}

											{activeStep === 2 &&
												selectedProcedure &&
												requirementsAcknowledged && (
													<Box className={classes.fadeEnter}>
														<Text
															fw={600}
															size="xl"
															className={classes.stepTitle}
															mb="xl"
														>
															Fecha y horario
														</Text>

														{slotsRangeQuery.isPending ? (
															<Loader size="sm" color="red" />
														) : availableDates.length > 0 ? (
															<Grid
																style={{ gap: "var(--mantine-spacing-xl)" }}
															>
																<Grid.Col span={{ base: 12, sm: 5 }}>
																	<Stack gap="sm" className={classes.dateList}>
																		{availableDates.map((day) => (
																			<UnstyledButton
																				key={day.date}
																				type="button"
																				className={classes.datePill}
																				data-active={
																					resolvedSelectedDate === day.date ||
																					undefined
																				}
																				onClick={() => {
																					setSelectedDate(day.date);
																					setSelectedSlotId(null);
																				}}
																			>
																				<Text
																					size="xs"
																					tt="uppercase"
																					fw={700}
																					className={classes.dateMonth}
																				>
																					{new Date(
																						`${day.date}T00:00:00`,
																					).toLocaleDateString("es-CO", {
																						month: "short",
																					})}
																				</Text>
																				<Text
																					size="xl"
																					fw={700}
																					className={classes.dateDay}
																				>
																					{new Date(
																						`${day.date}T00:00:00`,
																					).getDate()}
																				</Text>
																				<Text
																					size="xs"
																					fw={500}
																					className={classes.dateWeekday}
																				>
																					{new Date(
																						`${day.date}T00:00:00`,
																					).toLocaleDateString("es-CO", {
																						weekday: "short",
																					})}
																				</Text>
																			</UnstyledButton>
																		))}
																	</Stack>
																</Grid.Col>
																<Grid.Col span={{ base: 12, sm: 7 }}>
																	{selectedDaySlots.length > 0 ? (
																		<SimpleGrid cols={2} spacing="md">
																			{selectedDaySlots.map((slot) => (
																				<UnstyledButton
																					key={slot.id}
																					type="button"
																					className={classes.slotButton}
																					data-active={
																						resolvedSelectedSlotId ===
																							slot.id || undefined
																					}
																					onClick={() =>
																						setSelectedSlotId(slot.id)
																					}
																				>
																					<Text
																						fw={600}
																						size="md"
																						ff="monospace"
																						style={{ letterSpacing: 0.5 }}
																					>
																						{slot.startTime}
																					</Text>
																				</UnstyledButton>
																			))}
																		</SimpleGrid>
																	) : (
																		<Text c="dimmed" size="sm">
																			No hay horarios disponibles en esta fecha.
																		</Text>
																	)}
																</Grid.Col>
															</Grid>
														) : (
															<Alert
																color="yellow"
																icon={<CalendarClock size={16} />}
															>
																No hay cupos disponibles. Intenta más adelante.
															</Alert>
														)}

														<Group justify="space-between" mt={40}>
															<Button
																type="button"
																variant="subtle"
																color="gray"
																size="lg"
																onClick={() => goToStep(1)}
															>
																Volver
															</Button>
															<Button
																type="button"
																size="lg"
																color="red"
																onClick={handleSlotsContinue}
																disabled={!resolvedSelectedSlotId}
																rightSection={<ChevronRight size={18} />}
															>
																Continuar
															</Button>
														</Group>
													</Box>
												)}

											{activeStep === 3 &&
												selectedProcedure &&
												requirementsAcknowledged &&
												resolvedSelectedSlotId && (
													<Box className={classes.fadeEnter}>
														<Text
															fw={600}
															size="xl"
															className={classes.stepTitle}
															mb="xl"
														>
															Datos personales
														</Text>

														<div className={classes.formGrid}>
															<TextInput
																required
																label="Nombre completo"
																placeholder="Ana Gómez"
																classNames={{
																	input: classes.input,
																	label: classes.inputLabel,
																}}
																{...detailsForm.getInputProps("applicantName")}
															/>
															<Flex gap="sm">
																<Select
																	label="Tipo"
																	data={["CC", "CE", "PP"]}
																	w={90}
																	classNames={{
																		input: classes.input,
																		label: classes.inputLabel,
																	}}
																	{...detailsForm.getInputProps("documentType")}
																/>
																<TextInput
																	required
																	label="Documento"
																	placeholder="123456789"
																	style={{ flex: 1 }}
																	classNames={{
																		input: classes.input,
																		label: classes.inputLabel,
																	}}
																	{...detailsForm.getInputProps(
																		"applicantDocument",
																	)}
																/>
															</Flex>
															<TextInput
																required
																type="email"
																label="Correo electrónico"
																placeholder="correo@ejemplo.com"
																classNames={{
																	input: classes.input,
																	label: classes.inputLabel,
																}}
																{...detailsForm.getInputProps("email")}
																disabled={isAuthenticated}
															/>
															<TextInput
																label="Teléfono"
																placeholder="3001234567"
																classNames={{
																	input: classes.input,
																	label: classes.inputLabel,
																}}
																{...detailsForm.getInputProps("phone")}
															/>
															{selectedProcedure.requiresVehicle && (
																<TextInput
																	required
																	label="Placa del vehículo"
																	placeholder="ABC123"
																	classNames={{
																		input: classes.input,
																		label: classes.inputLabel,
																	}}
																	{...detailsForm.getInputProps("plate")}
																	onChange={(e) =>
																		detailsForm.setFieldValue(
																			"plate",
																			e.currentTarget.value.toUpperCase(),
																		)
																	}
																/>
															)}
														</div>

														<Group justify="space-between" mt={40}>
															<Button
																type="button"
																variant="subtle"
																color="gray"
																size="lg"
																onClick={() => goToStep(2)}
															>
																Volver
															</Button>
															<Button
																type="submit"
																size="xl"
																color="red"
																loading={
																	holdMutation.isPending ||
																	sendOtpMutation.isPending
																}
																className={classes.actionButton}
																rightSection={<ChevronRight size={20} />}
															>
																Asegurar mi cupo
															</Button>
														</Group>
													</Box>
												)}
										</Stack>
									</form>
								</div>
							</Stack>
						</Grid.Col>

						<Grid.Col span={{ base: 12, md: 5, lg: 5 }}>
							<div className={classes.stickySummary}>
								<Text
									fw={700}
									tt="uppercase"
									size="xs"
									c="red"
									mb="xl"
									style={{ letterSpacing: 1.5 }}
								>
									Tu Cita en Curso
								</Text>

								<Stack gap="xl">
									<Box>
										<Text
											size="xs"
											c="dimmed"
											mb={8}
											tt="uppercase"
											fw={600}
											style={{ letterSpacing: 0.5 }}
										>
											Paso actual
										</Text>
										<Badge color="red" variant="light" size="lg" radius="sm">
											{activeStep + 1} / {BOOKING_STEPS.length} ·{" "}
											{BOOKING_STEPS[activeStep]?.label}
										</Badge>
									</Box>

									<Box>
										<Text
											size="xs"
											c="dimmed"
											mb={8}
											tt="uppercase"
											fw={600}
											style={{ letterSpacing: 0.5 }}
										>
											Trámite
										</Text>
										{selectedProcedure?.name ? (
											<Text fw={500} size="lg" lh={1.3}>
												{selectedProcedure.name}
											</Text>
										) : (
											<Badge
												variant="outline"
												color="gray"
												style={{ borderStyle: "dashed", borderWidth: 2 }}
												radius="sm"
												size="md"
												tt="none"
												fw={500}
											>
												Pendiente
											</Badge>
										)}
									</Box>

									<Box>
										<Text
											size="xs"
											c="dimmed"
											mb={8}
											tt="uppercase"
											fw={600}
											style={{ letterSpacing: 0.5 }}
										>
											Horario
										</Text>
										{resolvedSelectedDate ? (
											<Text fw={500} size="lg">
												{formatDateLabel(resolvedSelectedDate)}
												{resolvedSelectedSlotId &&
													` • ${selectedDaySlots.find((s) => s.id === resolvedSelectedSlotId)?.startTime || ""}`}
											</Text>
										) : (
											<Badge
												variant="outline"
												color="gray"
												style={{ borderStyle: "dashed", borderWidth: 2 }}
												radius="sm"
												size="md"
												tt="none"
												fw={500}
											>
												Pendiente
											</Badge>
										)}
									</Box>

									<Box>
										<Text
											size="xs"
											c="dimmed"
											mb={8}
											tt="uppercase"
											fw={600}
											style={{ letterSpacing: 0.5 }}
										>
											Requisitos
										</Text>
										<Badge
											color={requirementsAcknowledged ? "green" : "gray"}
											variant="light"
											size="lg"
											radius="sm"
										>
											{requirementsAcknowledged ? "Listos" : "Pendientes"}
										</Badge>
									</Box>

									<Box>
										<Text
											size="xs"
											c="dimmed"
											mb={8}
											tt="uppercase"
											fw={600}
											style={{ letterSpacing: 0.5 }}
										>
											Estado
										</Text>
										<Badge
											color={resolvedSelectedSlotId ? "red" : "gray"}
											variant="light"
											size="lg"
											radius="sm"
										>
											{resolvedSelectedSlotId
												? "Listo para reservar"
												: "Configurando"}
										</Badge>
									</Box>
								</Stack>
							</div>
						</Grid.Col>
					</Grid>
				) : (
					/* Confirmation View */
					<Container size="sm" className={classes.fadeEnter}>
						<div className={classes.holdContainer}>
							<div className={classes.holdHeader}>
								{holdExpired ? (
									<Group
										wrap="nowrap"
										gap="md"
										bg="red.0"
										c="red.9"
										p="lg"
										style={{ borderRadius: "var(--mantine-radius-md)" }}
									>
										<ThemeIcon
											color="red"
											variant="light"
											size="lg"
											radius="xl"
										>
											<Clock size={20} />
										</ThemeIcon>
										<Text fw={600} size="md">
											Tu reserva expiró. Por favor, selecciona otro horario.
										</Text>
									</Group>
								) : (
									<Group
										wrap="nowrap"
										gap="md"
										bg="gray.0"
										p="lg"
										style={{
											borderRadius: "var(--mantine-radius-md)",
											border: "1px solid var(--mantine-color-gray-2)",
										}}
									>
										<ThemeIcon
											color="gray"
											variant="light"
											size="lg"
											radius="xl"
										>
											<Clock size={20} />
										</ThemeIcon>
										<div style={{ flex: 1 }}>
											<Text fw={600} size="md" c="dark.9">
												Cupo temporal asegurado
											</Text>
											<Text size="sm" c="dimmed">
												Completa la confirmación antes de que termine el tiempo.
											</Text>
										</div>
										<Badge
											size="xl"
											variant="light"
											color="dark"
											radius="sm"
											ff="monospace"
											fw={700}
											style={{ letterSpacing: 1 }}
										>
											{formatSeconds(holdRemainingSeconds)}
										</Badge>
									</Group>
								)}
							</div>

							<Box p={{ base: 32, md: 48 }}>
								<Text
									fw={700}
									tt="uppercase"
									size="xs"
									c="red"
									mb="xl"
									style={{ letterSpacing: 1.5 }}
								>
									Confirma tu asistencia
								</Text>

								<Grid style={{ gap: "var(--mantine-spacing-xl)" }}>
									<Grid.Col span={12}>
										<Text
											size="xs"
											c="dimmed"
											mb={4}
											tt="uppercase"
											fw={600}
											style={{ letterSpacing: 0.5 }}
										>
											Trámite
										</Text>
										<Text fw={600} size="lg">
											{holdBooking.request?.procedure?.name}
										</Text>
									</Grid.Col>
									<Grid.Col span={{ base: 12, sm: 6 }}>
										<Text
											size="xs"
											c="dimmed"
											mb={4}
											tt="uppercase"
											fw={600}
											style={{ letterSpacing: 0.5 }}
										>
											Fecha
										</Text>
										<Text fw={600} size="md">
											{holdBooking.slot?.slotDate}
										</Text>
									</Grid.Col>
									<Grid.Col span={{ base: 12, sm: 6 }}>
										<Text
											size="xs"
											c="dimmed"
											mb={4}
											tt="uppercase"
											fw={600}
											style={{ letterSpacing: 0.5 }}
										>
											Hora
										</Text>
										<Text fw={600} size="md" ff="monospace">
											{holdBooking.slot?.startTime}
										</Text>
									</Grid.Col>
									<Grid.Col span={{ base: 12, sm: 6 }}>
										<Text
											size="xs"
											c="dimmed"
											mb={4}
											tt="uppercase"
											fw={600}
											style={{ letterSpacing: 0.5 }}
										>
											A nombre de
										</Text>
										<Text fw={500} size="md">
											{holdBooking.request?.applicantName}
										</Text>
									</Grid.Col>
									<Grid.Col span={{ base: 12, sm: 6 }}>
										<Text
											size="xs"
											c="dimmed"
											mb={4}
											tt="uppercase"
											fw={600}
											style={{ letterSpacing: 0.5 }}
										>
											Documento
										</Text>
										<Text fw={500} size="md">
											{holdBooking.request?.applicantDocument}
										</Text>
									</Grid.Col>
								</Grid>

								<Divider my={48} />

								<div className={classes.warningBox}>
									<Group wrap="nowrap" align="flex-start" gap="md">
										<FileText size={24} className={classes.warningIcon} />
										<div>
											<Text fw={700} mb={4}>
												Presentación Física Obligatoria
											</Text>
											<Text size="sm" c="dimmed" lh={1.5}>
												Recuerda que debes presentarte el día de tu cita con
												todos los requisitos y plantillas impresas. No se
												aceptan envíos digitales.
											</Text>
										</div>
									</Group>
								</div>

								<Group justify="space-between" mt={48}>
									<Button
										variant="subtle"
										color="gray"
										size="lg"
										onClick={() => cancelHoldMutation.mutate()}
										loading={cancelHoldMutation.isPending}
									>
										{holdExpired ? "Elegir otro horario" : "Cancelar"}
									</Button>
									<Button
										size="xl"
										color="red"
										onClick={() => confirmMutation.mutate()}
										loading={confirmMutation.isPending}
										disabled={holdExpired}
										className={classes.actionButton}
									>
										Confirmar cita definitivamente
									</Button>
								</Group>
							</Box>
						</div>
					</Container>
				)}
			</Container>

			{/* OTP Modal */}
			<Modal
				opened={isAuthModalOpen}
				onClose={() => setIsAuthModalOpen(false)}
				withCloseButton={false}
				size="sm"
				centered
				classNames={{ body: classes.modalBody }}
				padding="xl"
				radius="md"
			>
				<Stack gap="xl">
					<Box ta="center">
						<Title order={3} mb="xs" fw={700}>
							Verifica tu correo
						</Title>
						<Text size="sm" c="dimmed" lh={1.5}>
							Ingresa el código de 6 dígitos que enviamos a <br />
							<Text component="span" fw={600} c="dark.9">
								{authEmail}
							</Text>
						</Text>
					</Box>

					{error && (
						<Alert color="red" variant="light">
							{error}
						</Alert>
					)}

					<Box>
						<Group justify="center">
							<PinInput
								length={6}
								type="number"
								size="xl"
								value={otpCode}
								onChange={setOtpCode}
								disabled={verifyOtpMutation.isPending}
								className={classes.pinInput}
							/>
						</Group>
					</Box>

					<Stack gap="md" mt="xl">
						<Button
							color="red"
							size="xl"
							fullWidth
							onClick={() =>
								verifyOtpMutation.mutate({ email: authEmail, otp: otpCode })
							}
							loading={verifyOtpMutation.isPending}
							disabled={otpCode.length !== 6}
							className={classes.actionButton}
						>
							Validar y Reservar
						</Button>

						<Anchor
							component="button"
							size="sm"
							ta="center"
							c="dimmed"
							fw={500}
							onClick={() => sendOtpMutation.mutate(authEmail)}
							disabled={sendOtpMutation.isPending}
						>
							Reenviar código
						</Anchor>
					</Stack>
				</Stack>
			</Modal>
		</Box>
	);
}
