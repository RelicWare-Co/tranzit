import { useForm } from "@mantine/form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Clock, FileText, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	Alert,
	Badge,
	Button,
	Card,
	CardContent,
	Input,
} from "#/shared/components/ui";
import { useAuth } from "#/features/auth/components/AuthContext";
import { orpcClient } from "#/shared/lib/orpc-client";
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

	// Step 1: Procedure Selection
	const renderProcedureStep = () => (
		<div className={classes.stepContent}>
			<h2 className={classes.stepHeading}>¿Qué trámite necesitas?</h2>
			{proceduresQuery.isPending ? (
				<div className={classes.loadingContainer}>
					<Loader2 size={24} className={classes.spinner} />
					<span>Cargando trámites...</span>
				</div>
			) : proceduresQuery.data && proceduresQuery.data.length > 0 ? (
				<div className={classes.procedureGrid}>
					{proceduresQuery.data.map((proc) => (
						<button
							type="button"
							key={proc.id}
							className={`${classes.procedureCard} ${
								detailsForm.values.procedureTypeId === proc.id
									? classes.procedureCardSelected
									: ""
							}`}
							onClick={() => {
								const changedProcedure =
									detailsForm.values.procedureTypeId !== proc.id;
								detailsForm.setFieldValue("procedureTypeId", proc.id);
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
							<div className={classes.procedureRadio}>
								<div
									className={`${classes.radioCircle} ${
										detailsForm.values.procedureTypeId === proc.id
											? classes.radioCircleSelected
											: ""
									}`}
								>
									{detailsForm.values.procedureTypeId === proc.id && (
										<div className={classes.radioDot} />
									)}
								</div>
							</div>
							<div className={classes.procedureInfo}>
								<h3 className={classes.procedureName}>{proc.name}</h3>
								{proc.requiresVehicle && (
									<Badge variant="brand" size="sm">
										Requiere placa
									</Badge>
								)}
							</div>
						</button>
					))}
				</div>
			) : (
				<Alert variant="warning" title="Sin trámites disponibles">
					No hay trámites disponibles por ahora. Por favor, intenta más tarde.
				</Alert>
			)}
			<div className={classes.stepActions}>
				<span className={classes.stepHint}>
					Selecciona un trámite para habilitar el siguiente paso.
				</span>
				<Button
					size="lg"
					disabled={!selectedProcedure}
					onClick={handleProcedureContinue}
					rightIcon={<ChevronRight size={18} />}
				>
					Continuar
				</Button>
			</div>
		</div>
	);

	// Step 2: Requirements
	const renderRequirementsStep = () =>
		selectedProcedure && (
			<div className={classes.stepContent}>
				<h2 className={classes.stepHeading}>Requisitos del trámite</h2>

				<Card variant="inset" padding="lg" className={classes.requirementsCard}>
					{procedureRequirements.length > 0 ? (
						<div className={classes.requirementsList}>
							{procedureRequirements.map((req) => (
								<div key={req.key} className={classes.requirementItem}>
									<div className={classes.requirementHeader}>
										<div className={classes.requirementIcon}>
											<FileText size={20} />
										</div>
										<div className={classes.requirementContent}>
											<h4 className={classes.requirementTitle}>{req.label}</h4>
											{req.instructions && (
												<p className={classes.requirementInstructions}>
													{req.instructions}
												</p>
											)}
										</div>
										{req.downloadUrl && (
											<a
												href={req.downloadUrl}
												target="_blank"
												rel="noopener noreferrer"
												className={classes.downloadLink}
												download
											>
												Descargar
											</a>
										)}
									</div>
								</div>
							))}
						</div>
					) : (
						<p className={classes.noRequirements}>
							No hay plantillas requeridas para este trámite.
						</p>
					)}

					<div className={classes.acknowledgeSection}>
						<label className={classes.checkboxLabel}>
							<input
								type="checkbox"
								checked={requirementsAcknowledged}
								onChange={(e) =>
									setRequirementsAcknowledged(e.currentTarget.checked)
								}
								className={classes.checkbox}
							/>
							<span>
								He revisado los requisitos y llevaré los documentos impresos día
								de mi cita.
							</span>
						</label>
					</div>
				</Card>

				<div className={classes.stepActions}>
					<Button
						variant="ghost"
						size="lg"
						onClick={() => goToStep(0)}
						leftIcon={<ChevronRight size={18} className={classes.flipIcon} />}
					>
						Volver
					</Button>
					<Button
						size="lg"
						onClick={handleRequirementsContinue}
						disabled={!requirementsAcknowledged}
						rightIcon={<ChevronRight size={18} />}
					>
						Continuar
					</Button>
				</div>
			</div>
		);

	// Step 3: Schedule
	const renderScheduleStep = () =>
		selectedProcedure &&
		requirementsAcknowledged && (
			<div className={classes.stepContent}>
				<h2 className={classes.stepHeading}>Fecha y horario</h2>

				{slotsRangeQuery.isPending ? (
					<div className={classes.loadingContainer}>
						<Loader2 size={24} className={classes.spinner} />
						<span>Cargando disponibilidad...</span>
					</div>
				) : availableDates.length > 0 ? (
					<div className={classes.scheduleContainer}>
						{/* Date Pills - Vertical */}
						<div className={classes.dateList}>
							{availableDates.map((day) => (
								<button
									type="button"
									key={day.date}
									className={`${classes.datePill} ${
										resolvedSelectedDate === day.date
											? classes.datePillActive
											: ""
									}`}
									onClick={() => {
										setSelectedDate(day.date);
										setSelectedSlotId(null);
									}}
								>
									<span className={classes.dateMonth}>
										{new Date(`${day.date}T00:00:00`).toLocaleDateString(
											"es-CO",
											{
												month: "short",
											},
										)}
									</span>
									<span className={classes.dateDay}>
										{new Date(`${day.date}T00:00:00`).getDate()}
									</span>
									<span className={classes.dateWeekday}>
										{new Date(`${day.date}T00:00:00`).toLocaleDateString(
											"es-CO",
											{
												weekday: "short",
											},
										)}
									</span>
								</button>
							))}
						</div>

						{/* Slots Grid */}
						<div className={classes.slotsSection}>
							{selectedDaySlots.length > 0 ? (
								<div className={classes.slotsGrid}>
									{selectedDaySlots.map((slot) => (
										<button
											type="button"
											key={slot.id}
											className={`${classes.slotButton} ${
												resolvedSelectedSlotId === slot.id
													? classes.slotButtonSelected
													: ""
											}`}
											onClick={() => setSelectedSlotId(slot.id)}
										>
											<Clock size={14} />
											<span className={classes.slotTime}>{slot.startTime}</span>
										</button>
									))}
								</div>
							) : (
								<Alert variant="warning" title="Sin horarios">
									No hay horarios disponibles en esta fecha. Selecciona otra
									fecha.
								</Alert>
							)}
						</div>
					</div>
				) : (
					<Alert variant="warning" title="Sin cupos disponibles">
						No hay cupos disponibles. Intenta más adelante.
					</Alert>
				)}

				<div className={classes.stepActions}>
					<Button
						variant="ghost"
						size="lg"
						onClick={() => goToStep(1)}
						leftIcon={<ChevronRight size={18} className={classes.flipIcon} />}
					>
						Volver
					</Button>
					<Button
						size="lg"
						onClick={handleSlotsContinue}
						disabled={!resolvedSelectedSlotId}
						rightIcon={<ChevronRight size={18} />}
					>
						Continuar
					</Button>
				</div>
			</div>
		);

	// Step 4: Details
	const renderDetailsStep = () =>
		selectedProcedure &&
		requirementsAcknowledged &&
		resolvedSelectedSlotId && (
			<div className={classes.stepContent}>
				<h2 className={classes.stepHeading}>Datos personales</h2>

				<form onSubmit={handleReserveClick} className={classes.detailsForm}>
					<div className={classes.formGrid}>
						<Input
							label="Nombre completo"
							placeholder="Ana Gómez"
							{...detailsForm.getInputProps("applicantName")}
						/>

						<div className={classes.documentRow}>
							<div className={classes.documentType}>
								<label className={classes.formLabel} htmlFor="documentType">
									Tipo
								</label>
								<select
									id="documentType"
									className={classes.select}
									{...detailsForm.getInputProps("documentType")}
								>
									<option value="CC">CC</option>
									<option value="CE">CE</option>
									<option value="PP">PP</option>
								</select>
							</div>
							<Input
								label="Documento"
								placeholder="123456789"
								{...detailsForm.getInputProps("applicantDocument")}
							/>
						</div>

						<Input
							type="email"
							label="Correo electrónico"
							placeholder="correo@ejemplo.com"
							{...detailsForm.getInputProps("email")}
							disabled={isAuthenticated}
						/>

						<Input
							label="Teléfono"
							placeholder="3001234567"
							{...detailsForm.getInputProps("phone")}
						/>

						{selectedProcedure.requiresVehicle && (
							<Input
								label="Placa del vehículo"
								placeholder="ABC123"
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

					<div className={classes.stepActions}>
						<Button
							variant="ghost"
							size="lg"
							onClick={() => goToStep(2)}
							leftIcon={<ChevronRight size={18} className={classes.flipIcon} />}
						>
							Volver
						</Button>
						<Button
							size="lg"
							type="submit"
							isLoading={holdMutation.isPending || sendOtpMutation.isPending}
							rightIcon={<ChevronRight size={18} />}
						>
							Asegurar mi cupo
						</Button>
					</div>
				</form>
			</div>
		);

	// Render the appropriate step
	const renderStep = () => {
		switch (activeStep) {
			case 0:
				return renderProcedureStep();
			case 1:
				return renderRequirementsStep();
			case 2:
				return renderScheduleStep();
			case 3:
				return renderDetailsStep();
			default:
				return renderProcedureStep();
		}
	};

	return (
		<div className={classes.root}>
			<div className={classes.container}>
				{/* Header */}
				<div className={classes.header}>
					<h1 className={classes.pageTitle}>Agendar Cita</h1>
					<p className={classes.pageSubtitle}>
						Avanza paso a paso para reservar sin perderte en el proceso.
					</p>
				</div>

				{/* Error/Feedback Alerts */}
				{error && (
					<div className={classes.alertContainer}>
						<Alert variant="error">{error}</Alert>
					</div>
				)}
				{feedback && !holdBooking && (
					<div className={classes.alertContainer}>
						<Alert variant="success">{feedback}</Alert>
					</div>
				)}

				{!holdBooking ? (
					<div className={classes.wizardLayout}>
						{/* Main Content */}
						<div className={classes.mainContent}>
							{/* Step Rail */}
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
										<button
											type="button"
											key={step.key}
											className={`${classes.stepRailItem} ${
												state === "active" ? classes.stepRailActive : ""
											} ${state === "done" ? classes.stepRailDone : ""}`}
											onClick={() => goToStep(index)}
											disabled={!isClickable}
										>
											<div className={classes.stepNumber}>{index + 1}</div>
											<div className={classes.stepInfo}>
												<span className={classes.stepLabel}>{step.label}</span>
												<span className={classes.stepDescription}>
													{step.description}
												</span>
											</div>
										</button>
									);
								})}
							</div>

							{/* Wizard Panel */}
							<Card
								variant="elevated"
								padding="xl"
								className={classes.wizardPanel}
							>
								{/* Progress Bar */}
								<div className={classes.progressSection}>
									<div className={classes.progressTrack}>
										<div
											className={classes.progressFill}
											style={{ width: `${wizardProgress}%` }}
										/>
									</div>
									<div className={classes.progressInfo}>
										<span className={classes.progressText}>
											Paso {activeStep + 1} de {BOOKING_STEPS.length} ·{" "}
											{BOOKING_STEPS[activeStep]?.label}
										</span>
										<Badge variant="brand">{wizardProgress}% completado</Badge>
									</div>
								</div>

								{/* Step Content */}
								<div className={classes.fadeEnter}>{renderStep()}</div>
							</Card>
						</div>

						{/* Sidebar Summary */}
						<div className={classes.sidebar}>
							<Card
								variant="elevated"
								padding="xl"
								className={classes.summaryCard}
							>
								<h3 className={classes.summaryTitle}>Tu Cita en Curso</h3>

								<div className={classes.summarySection}>
									<span className={classes.summaryLabel}>Paso actual</span>
									<Badge variant="brand">
										{activeStep + 1} / {BOOKING_STEPS.length} ·{" "}
										{BOOKING_STEPS[activeStep]?.label}
									</Badge>
								</div>

								<div className={classes.summarySection}>
									<span className={classes.summaryLabel}>Trámite</span>
									{selectedProcedure?.name ? (
										<span className={classes.summaryValue}>
											{selectedProcedure.name}
										</span>
									) : (
										<Badge variant="neutral">Pendiente</Badge>
									)}
								</div>

								<div className={classes.summarySection}>
									<span className={classes.summaryLabel}>Horario</span>
									{resolvedSelectedDate ? (
										<span className={classes.summaryValue}>
											{formatDateLabel(resolvedSelectedDate)}
											{resolvedSelectedSlotId && (
												<>
													{" · "}
													{selectedDaySlots.find(
														(s) => s.id === resolvedSelectedSlotId,
													)?.startTime || ""}
												</>
											)}
										</span>
									) : (
										<Badge variant="neutral">Pendiente</Badge>
									)}
								</div>

								<div className={classes.summarySection}>
									<span className={classes.summaryLabel}>Requisitos</span>
									<Badge
										variant={requirementsAcknowledged ? "success" : "neutral"}
									>
										{requirementsAcknowledged ? "Listos" : "Pendientes"}
									</Badge>
								</div>

								<div className={classes.summarySection}>
									<span className={classes.summaryLabel}>Estado</span>
									<Badge
										variant={resolvedSelectedSlotId ? "success" : "neutral"}
									>
										{resolvedSelectedSlotId
											? "Listo para reservar"
											: "Configurando"}
									</Badge>
								</div>
							</Card>
						</div>
					</div>
				) : (
					/* Confirmation View */
					<div className={classes.confirmationContainer}>
						<Card variant="elevated" className={classes.confirmationCard}>
							{/* Hold Header */}
							<div className={classes.confirmationHeader}>
								{holdExpired ? (
									<Alert variant="error" title="Reserva expirada">
										Tu reserva expiró. Por favor, selecciona otro horario.
									</Alert>
								) : (
									<div className={classes.holdBanner}>
										<div className={classes.holdIcon}>
											<Clock size={24} />
										</div>
										<div className={classes.holdInfo}>
											<h3 className={classes.holdTitle}>
												Cupo temporal asegurado
											</h3>
											<p className={classes.holdDescription}>
												Completa la confirmación antes de que termine el tiempo.
											</p>
										</div>
										<div className={classes.holdTimer}>
											{formatSeconds(holdRemainingSeconds)}
										</div>
									</div>
								)}
							</div>

							<CardContent className="p-8">
								<h3 className={classes.confirmationTitle}>
									Confirma tu asistencia
								</h3>

								<div className={classes.confirmationDetails}>
									<div className={classes.detailRow}>
										<span className={classes.detailLabel}>Trámite</span>
										<span className={classes.detailValue}>
											{holdBooking.request?.procedure?.name}
										</span>
									</div>
									<div className={classes.detailRow}>
										<span className={classes.detailLabel}>Fecha</span>
										<span className={classes.detailValue}>
											{holdBooking.slot?.slotDate}
										</span>
									</div>
									<div className={classes.detailRow}>
										<span className={classes.detailLabel}>Hora</span>
										<span className={classes.detailValueMono}>
											{holdBooking.slot?.startTime}
										</span>
									</div>
									<div className={classes.detailRow}>
										<span className={classes.detailLabel}>A nombre de</span>
										<span className={classes.detailValue}>
											{holdBooking.request?.applicantName}
										</span>
									</div>
									<div className={classes.detailRow}>
										<span className={classes.detailLabel}>Documento</span>
										<span className={classes.detailValue}>
											{holdBooking.request?.applicantDocument}
										</span>
									</div>
								</div>

								<div className={classes.warningBox}>
									<FileText size={24} className={classes.warningIcon} />
									<div>
										<h4 className={classes.warningTitle}>
											Presentación Física Obligatoria
										</h4>
										<p className={classes.warningText}>
											Recuerda que debes presentarte el día de tu cita con todos
											los requisitos y plantillas impresas. No se aceptan envíos
											digitales.
										</p>
									</div>
								</div>

								<div className={classes.confirmationActions}>
									<Button
										variant="ghost"
										size="lg"
										onClick={() => cancelHoldMutation.mutate()}
										isLoading={cancelHoldMutation.isPending}
									>
										{holdExpired ? "Elegir otro horario" : "Cancelar"}
									</Button>
									<Button
										size="lg"
										onClick={() => confirmMutation.mutate()}
										isLoading={confirmMutation.isPending}
										disabled={holdExpired}
										variant="success"
									>
										Confirmar cita definitivamente
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>
				)}
			</div>

			{/* OTP Modal */}
			{isAuthModalOpen && (
				<button
					className={classes.modalOverlay}
					onClick={() => setIsAuthModalOpen(false)}
					type="button"
					aria-label="Cerrar modal"
				>
					<div
						className={classes.modal}
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
						role="dialog"
					>
						<Card variant="elevated" padding="xl">
							<div className={classes.modalHeader}>
								<h3 className={classes.modalTitle}>Verifica tu correo</h3>
								<p className={classes.modalDescription}>
									Ingresa el código de 6 dígitos que enviamos a <br />
									<strong>{authEmail}</strong>
								</p>
							</div>

							{error && (
								<Alert variant="error" className={classes.modalAlert}>
									{error}
								</Alert>
							)}

							<div className={classes.pinContainer}>
								<input
									type="text"
									inputMode="numeric"
									maxLength={6}
									value={otpCode}
									onChange={(e) => {
										const value = e.target.value.replace(/\D/g, "").slice(0, 6);
										setOtpCode(value);
									}}
									className={classes.pinInput}
									placeholder="000000"
									disabled={verifyOtpMutation.isPending}
								/>
							</div>

							<div className={classes.modalActions}>
								<Button
									fullWidth
									size="lg"
									onClick={() =>
										verifyOtpMutation.mutate({ email: authEmail, otp: otpCode })
									}
									isLoading={verifyOtpMutation.isPending}
									disabled={otpCode.length !== 6}
								>
									Validar y Reservar
								</Button>
								<button
									type="button"
									className={classes.resendLink}
									onClick={() => sendOtpMutation.mutate(authEmail)}
									disabled={sendOtpMutation.isPending}
								>
									Reenviar código
								</button>
							</div>
						</Card>
					</div>
				</button>
			)}
		</div>
	);
}
