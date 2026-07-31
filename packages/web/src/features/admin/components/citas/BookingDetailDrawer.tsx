import {
	Alert,
	Badge,
	Box,
	Button,
	Divider,
	Group,
	LoadingOverlay,
	Select,
	Stack,
	Text,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	Ban,
	CalendarClock,
	CheckCircle2,
	ChevronRight,
	Clock,
	Loader2,
	User,
} from "lucide-react";
import { useMemo, useState } from "react";
import { getErrorMessage } from "#/features/admin/components/errors";
import { orpcClient } from "#/shared/lib/orpc-client";
import type { BookingWithRelations } from "./types";
import classes from "./booking-detail.module.css";

interface BookingDetailDrawerProps {
	booking: BookingWithRelations | null;
	opened: boolean;
	onClose: () => void;
	onMutated: (newSlotDate?: string) => void;
}

const statusLabel: Record<string, string> = {
	held: "En espera",
	hold: "En espera",
	confirmed: "Confirmada",
	cancelled: "Cancelada",
	completed: "Atendida",
	expired: "Expirada",
};

function statusColor(status: string): string {
	if (status === "cancelled" || status === "expired") return "red";
	if (status === "held" || status === "hold") return "orange";
	if (status === "confirmed") return "teal";
	if (status === "completed") return "grape";
	return "gray";
}

function readApplicant(booking: BookingWithRelations) {
	const draft = booking.request?.draftData ?? null;
	const applicantName =
		(typeof draft?.applicantName === "string" && draft.applicantName) ||
		booking.request?.citizen?.name ||
		null;
	const applicantDocument =
		(typeof draft?.applicantDocument === "string" && draft.applicantDocument) ||
		booking.request?.documentNumber ||
		null;
	const documentType = booking.request?.documentType || null;
	const email = booking.request?.email || booking.request?.citizen?.email || null;
	const phone = booking.request?.phone || null;
	const plate =
		(typeof draft?.plate === "string" && draft.plate) ||
		booking.request?.plate ||
		null;
	const procedureName =
		booking.request?.procedure?.name ||
		booking.request?.procedureType?.name ||
		booking.request?.procedureType?.slug ||
		null;
	return { applicantName, applicantDocument, documentType, email, phone, plate, procedureName };
}

export function BookingDetailDrawer({
	booking,
	opened,
	onClose,
	onMutated,
}: BookingDetailDrawerProps) {
	const [rescheduleOpen, setRescheduleOpen] = useState(false);
	const [targetDate, setTargetDate] = useState<string | null>(null);
	const [targetSlotId, setTargetSlotId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [info, setInfo] = useState<string | null>(null);

	const targetDateStr = targetDate ?? "";

	const slotsQuery = useQuery({
		queryKey: ["admin", "citas", "reschedule-slots", targetDateStr],
		enabled: rescheduleOpen && !!targetDate,
		queryFn: async () =>
			await orpcClient.admin.schedule.slots.list({ date: targetDateStr }),
		staleTime: 10 * 1000,
	});

	const availableSlots = useMemo(
		() =>
			(slotsQuery.data?.slots ?? []).filter(
				(slot) =>
					slot.status === "open" &&
					(slot.remainingCapacity === null || slot.remainingCapacity > 0) &&
					slot.id !== booking?.slot?.id,
			),
		[slotsQuery.data?.slots, booking?.slot?.id],
	);

	const confirmMutation = useMutation({
		mutationFn: async () => {
			if (!booking) throw new Error("No hay cita seleccionada.");
			return await orpcClient.admin.bookings.confirm({ id: booking.id });
		},
		onSuccess: () => {
			setError(null);
			setInfo("Cita confirmada.");
			onMutated();
		},
		onError: (err) => setError(getErrorMessage(err, "No se pudo confirmar.")),
	});

	const cancelMutation = useMutation({
		mutationFn: async () => {
			if (!booking) throw new Error("No hay cita seleccionada.");
			return await orpcClient.admin.bookings.release({
				id: booking.id,
				reason: "cancelled",
			});
		},
		onSuccess: () => {
			setError(null);
			setInfo("Cita cancelada.");
			onMutated();
		},
		onError: (err) => setError(getErrorMessage(err, "No se pudo cancelar.")),
	});

	const rescheduleMutation = useMutation({
		mutationFn: async () => {
			if (!booking) throw new Error("No hay cita seleccionada.");
			if (!targetSlotId) throw new Error("Selecciona un horario destino.");
			return await orpcClient.admin.bookings.reschedule({
				id: booking.id,
				newSlotId: targetSlotId,
			});
		},
		onSuccess: () => {
			setError(null);
			setInfo("Cita reagendada.");
			setRescheduleOpen(false);
			const chosenSlot = availableSlots.find(
				(slot) => slot.id === targetSlotId,
			);
			const newSlotDate = chosenSlot?.slotDate ?? targetDateStr ?? undefined;
			setTargetDate(null);
			setTargetSlotId(null);
			onMutated(newSlotDate);
		},
		onError: (err) =>
			setError(getErrorMessage(err, "No se pudo reagendar la cita.")),
	});

	const isHeld = booking?.status === "held" || booking?.status === "hold";
	const isBusy =
		confirmMutation.isPending ||
		cancelMutation.isPending ||
		rescheduleMutation.isPending;

	if (!booking) return null;

	const applicant = readApplicant(booking);
	const slot = booking.slot;

	return (
		<>
			{opened && (
				<button
					type="button"
					className={classes.overlay}
					onClick={onClose}
					aria-label="Cerrar panel"
				>
					<div
						className={classes.panel}
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
						role="dialog"
						aria-modal="true"
					>
						<Box pos="relative">
							<LoadingOverlay
								visible={isBusy}
								overlayProps={{ blur: 1 }}
							/>

							<header className={classes.header}>
								<div className={classes.headerTop}>
									<Group gap="xs">
										<Badge color={statusColor(booking.status)} variant="light">
											{statusLabel[booking.status] ?? booking.status}
										</Badge>
										<Badge color="gray" variant="subtle">
											{booking.kind === "administrative"
												? "Reserva admin"
												: "Ciu."}
										</Badge>
									</Group>
									<button
										type="button"
										className={classes.closeBtn}
										onClick={onClose}
										aria-label="Cerrar"
									>
										×
									</button>
								</div>
								<h3 className={classes.title}>
									{applicant.procedureName ?? "Cita"}
								</h3>
								<div className={classes.slotLine}>
									<CalendarClock size={16} />
									<span>
										{slot
											? `${slot.slotDate} · ${slot.startTime.slice(0, 5)} - ${slot.endTime.slice(0, 5)}`
											: "Sin horario"}
									</span>
								</div>
							</header>

							<div className={classes.body}>
								{error && (
									<Alert
										color="red"
										variant="light"
										radius="md"
										icon={<Ban size={16} />}
									>
										{error}
									</Alert>
								)}
								{info && (
									<Alert
										color="teal"
										variant="light"
										radius="md"
										icon={<CheckCircle2 size={16} />}
									>
										{info}
									</Alert>
								)}

								<section className={classes.section}>
									<h4 className={classes.sectionTitle}>
										<User size={14} /> Cliente
									</h4>
									<Stack gap="xs">
										<DetailRow
											label="Nombre"
											value={applicant.applicantName}
										/>
										<DetailRow
											label="Documento"
											value={
												applicant.documentType || applicant.applicantDocument
													? `${applicant.documentType ?? ""} ${applicant.applicantDocument ?? ""}`.trim()
													: null
											}
										/>
										<DetailRow label="Correo" value={applicant.email} />
										<DetailRow label="Teléfono" value={applicant.phone} />
										<DetailRow label="Placa" value={applicant.plate} />
										<DetailRow
											label="Trámite"
											value={applicant.procedureName}
										/>
									</Stack>
								</section>

								<Divider />

								<section className={classes.section}>
									<h4 className={classes.sectionTitle}>
										<Clock size={14} /> Atención
									</h4>
									<Stack gap="xs">
										<DetailRow
											label="Funcionario"
											value={
												booking.staff?.name ?? booking.staff?.email ?? "Sin asignar"
											}
										/>
										<DetailRow
											label="Fecha"
											value={slot?.slotDate ?? null}
										/>
										<DetailRow
											label="Hora"
											value={
												slot
													? `${slot.startTime.slice(0, 5)} - ${slot.endTime.slice(0, 5)}`
													: null
											}
										/>
									</Stack>
								</section>

								{booking.isActive && (
									<section className={classes.section}>
										<h4 className={classes.sectionTitle}>Acciones</h4>
										<Group gap="sm" grow>
											{isHeld && (
												<Button
													variant="light"
													color="teal"
													onClick={() => confirmMutation.mutate()}
													leftSection={<CheckCircle2 size={16} />}
												>
													Confirmar
												</Button>
											)}
											<Button
												variant="light"
												color="red"
												onClick={() => cancelMutation.mutate()}
												leftSection={<Ban size={16} />}
											>
												Cancelar cita
											</Button>
											<Button
												variant="default"
												onClick={() => {
													setRescheduleOpen((v) => !v);
													setError(null);
													setInfo(null);
												}}
												leftSection={<CalendarClock size={16} />}
											>
												Reagendar
											</Button>
										</Group>

										{rescheduleOpen && (
											<Stack gap="sm" mt="sm">
												<DatePickerInput
													label="Nueva fecha"
													placeholder="Selecciona una fecha"
													locale="es"
													valueFormat="DD/MM/YYYY"
													clearable
													value={targetDate}
													onChange={(value) => {
														setTargetDate(value);
														setTargetSlotId(null);
													}}
												/>
												{slotsQuery.isPending ? (
													<Group gap="xs" c="dimmed">
														<Loader2 size={16} className={classes.spinner} />
														<Text size="sm">Cargando horarios…</Text>
													</Group>
												) : availableSlots.length > 0 ? (
													<Select
														label="Nuevo horario"
														placeholder="Elige un horario disponible"
														data={availableSlots.map((slotItem) => ({
															value: slotItem.id,
															label: `${slotItem.startTime.slice(0, 5)} - ${slotItem.endTime.slice(0, 5)}`,
														}))}
														value={targetSlotId}
														onChange={(value) => setTargetSlotId(value)}
														searchable
													/>
												) : targetDateStr ? (
													<Alert color="yellow" variant="light">
														No hay horarios disponibles esa fecha.
													</Alert>
												) : null}
												<Button
													onClick={() => rescheduleMutation.mutate()}
													disabled={!targetSlotId}
													loading={rescheduleMutation.isPending}
													rightSection={<ChevronRight size={16} />}
												>
													Confirmar reagendado
												</Button>
											</Stack>
										)}
									</section>
								)}
							</div>
						</Box>
					</div>
				</button>
			)}
		</>
	);
}

function DetailRow({
	label,
	value,
}: {
	label: string;
	value: string | null;
}) {
	return (
		<div className={classes.detailRow}>
			<span className={classes.detailLabel}>{label}</span>
			<span className={classes.detailValue}>{value ?? "—"}</span>
		</div>
	);
}

export default BookingDetailDrawer;