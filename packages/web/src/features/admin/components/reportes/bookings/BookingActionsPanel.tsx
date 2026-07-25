import { Button, Modal, Select, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import {
	AlertTriangle,
	ArrowDownUp,
	CheckCircle2,
	Gauge,
	SearchCheck,
	UserCheck,
} from "lucide-react";
import { orpcClient } from "#/shared/lib/orpc-client";
import classes from "../Reportes.module.css";

interface SelectedBooking {
	id: string;
	slotId: string;
	status: string;
	isActive: boolean;
	slot?: {
		slotDate?: string;
		startTime?: string;
		endTime?: string;
	} | null;
	staff?: {
		name?: string | null;
		email?: string | null;
	} | null;
}

interface BookingActionsPanelProps {
	selectedBooking: SelectedBooking;
	isRunning: string | null;
	runAction: (
		actionId: string,
		action: () => Promise<unknown>,
		successMessage: string,
		errorFallback: string,
	) => Promise<unknown>;
	staffOptions: Array<{ value: string; label: string }>;
	releaseReason: "cancelled" | "expired" | "attended";
	onReleaseReasonChange: (reason: "cancelled" | "expired" | "attended") => void;
	reassignTargetStaffId: string;
	onReassignTargetChange: (staffId: string) => void;
}

export function BookingActionsPanel({
	selectedBooking,
	isRunning,
	runAction,
	staffOptions,
	releaseReason,
	onReleaseReasonChange,
	reassignTargetStaffId,
	onReassignTargetChange,
}: BookingActionsPanelProps) {
	const [releaseOpened, releaseModal] = useDisclosure(false);

	const releaseForm = useForm({
		mode: "uncontrolled",
		initialValues: { reason: releaseReason },
	});

	const reassignForm = useForm({
		mode: "uncontrolled",
		initialValues: { targetStaffUserId: reassignTargetStaffId },
		validate: {
			targetStaffUserId: (value) =>
				!value ? "Selecciona un funcionario" : null,
		},
	});

	const validateStaffSelection = () => {
		const targetStaffUserId = reassignForm.getValues().targetStaffUserId;
		if (!targetStaffUserId) {
			reassignForm.setFieldError(
				"targetStaffUserId",
				"Selecciona un funcionario destino.",
			);
			return null;
		}
		return targetStaffUserId;
	};

	const handleRelease = releaseForm.onSubmit(async (values) => {
		const reason = values.reason as "cancelled" | "expired" | "attended";
		onReleaseReasonChange(reason);
		try {
			await runAction(
				"booking-release",
				async () =>
					await orpcClient.admin.bookings.release({
						id: selectedBooking.id,
						reason,
					}),
				"Cita liberada. Ya no consume capacidad.",
				"No se pudo liberar la cita.",
			);
			releaseModal.close();
		} catch {
			// The operation error is already surfaced by runAction.
		}
	});

	return (
		<>
			<aside className={classes.actionPanel} aria-label="Detalle de la cita">
				<header className={classes.actionHeader}>
					<div>
						<p className={classes.actionEyebrow}>Cita seleccionada</p>
						<h3 className={classes.actionTitle}>
							{selectedBooking.slot?.slotDate ?? "Fecha no disponible"}
							{" · "}
							{selectedBooking.slot?.startTime ?? "Sin hora"}
						</h3>
						<p className={classes.actionReference}>
							{selectedBooking.id.slice(0, 8)} ·{" "}
							{selectedBooking.staff?.name ||
								selectedBooking.staff?.email ||
								"Sin funcionario"}
						</p>
					</div>
				</header>

				<section className={classes.actionSection}>
					<h4 className={classes.actionSectionTitle}>Estado y capacidad</h4>
					<p className={classes.actionSectionDescription}>
						Confirma el hold o consulta la capacidad efectiva del slot.
					</p>
					<div className={classes.actionButtons}>
						<Button
							leftSection={<CheckCircle2 size={15} />}
							loading={isRunning === "booking-confirm"}
							disabled={
								selectedBooking.status === "confirmed" ||
								!selectedBooking.isActive
							}
							onClick={() =>
								void runAction(
									"booking-confirm",
									async () =>
										await orpcClient.admin.bookings.confirm({
											id: selectedBooking.id,
										}),
									"Cita confirmada correctamente.",
									"No se pudo confirmar la cita.",
								)
							}
						>
							Confirmar cita
						</Button>
						<Button
							variant="default"
							leftSection={<Gauge size={15} />}
							loading={isRunning === "booking-capacity"}
							onClick={() =>
								void runAction(
									"booking-capacity",
									async () =>
										await orpcClient.admin.bookings.capacity({
											id: selectedBooking.id,
										}),
									"Capacidad consultada para la cita seleccionada.",
									"No se pudo consultar la capacidad.",
								)
							}
						>
							Consultar capacidad
						</Button>
					</div>
				</section>

				<section className={classes.actionSection}>
					<h4 className={classes.actionSectionTitle}>Reasignar funcionario</h4>
					<p className={classes.actionSectionDescription}>
						Valida primero el cambio para evitar conflictos de disponibilidad.
					</p>
					<form
						onSubmit={reassignForm.onSubmit(async (values) => {
							onReassignTargetChange(values.targetStaffUserId);
							await runAction(
								"booking-reassign",
								async () =>
									await orpcClient.admin.bookings.reassign({
										id: selectedBooking.id,
										targetStaffUserId: values.targetStaffUserId,
									}),
								"Cita reasignada al funcionario seleccionado.",
								"No se pudo reasignar la cita.",
							);
						})}
					>
						<div className={classes.actionSection}>
							<Select
								label="Funcionario destino"
								placeholder="Selecciona un funcionario"
								leftSection={<UserCheck size={15} />}
								searchable
								key={reassignForm.key("targetStaffUserId")}
								{...reassignForm.getInputProps("targetStaffUserId")}
								data={staffOptions}
								onChange={(value) => {
									const nextValue = value ?? "";
									reassignForm.setFieldValue("targetStaffUserId", nextValue);
									onReassignTargetChange(nextValue);
								}}
							/>
							<div className={classes.actionButtons}>
								<Button
									type="button"
									variant="default"
									leftSection={<SearchCheck size={15} />}
									loading={isRunning === "booking-reassign-preview"}
									onClick={() => {
										const targetStaffUserId = validateStaffSelection();
										if (!targetStaffUserId) return;
										void runAction(
											"booking-reassign-preview",
											async () =>
												await orpcClient.admin.bookings.reassignPreview({
													id: selectedBooking.id,
													targetStaffUserId,
												}),
											"Se revisó la viabilidad de la reasignación.",
											"No se pudo revisar la reasignación.",
										);
									}}
								>
									Revisar cambio
								</Button>
								<Button
									type="button"
									variant="default"
									leftSection={<Gauge size={15} />}
									loading={isRunning === "booking-availability"}
									onClick={() => {
										const staffUserId = validateStaffSelection();
										if (!staffUserId) return;
										void runAction(
											"booking-availability",
											async () =>
												await orpcClient.admin.bookings.availabilityCheck({
													slotId: selectedBooking.slotId,
													staffUserId,
												}),
											"Disponibilidad validada para el funcionario.",
											"No se pudo validar la disponibilidad.",
										);
									}}
								>
									Validar disponibilidad
								</Button>
								<Button
									type="submit"
									leftSection={<ArrowDownUp size={15} />}
									loading={isRunning === "booking-reassign"}
								>
									Reasignar cita
								</Button>
							</div>
						</div>
					</form>
				</section>

				<section className={classes.actionSection}>
					<h4 className={classes.actionSectionTitle}>Liberar capacidad</h4>
					<p className={classes.actionSectionDescription}>
						Desactiva la cita y libera el cupo que está consumiendo.
					</p>
					<div>
						<Button
							color="red"
							variant="light"
							leftSection={<AlertTriangle size={15} />}
							disabled={!selectedBooking.isActive}
							onClick={releaseModal.open}
						>
							Liberar cita
						</Button>
					</div>
				</section>
			</aside>

			<Modal
				opened={releaseOpened}
				onClose={releaseModal.close}
				title="Liberar cita"
				centered
				closeOnClickOutside={isRunning !== "booking-release"}
				closeOnEscape={isRunning !== "booking-release"}
				withCloseButton={isRunning !== "booking-release"}
			>
				<Text className={classes.modalIntro}>
					La cita {selectedBooking.id.slice(0, 8)} dejará de estar activa y
					liberará su capacidad. Esta acción quedará registrada en auditoría.
				</Text>
				<form onSubmit={handleRelease}>
					<div className={classes.actionSection}>
						<Select
							label="Motivo de liberación"
							description="Selecciona el estado que mejor describe el cierre."
							key={releaseForm.key("reason")}
							{...releaseForm.getInputProps("reason")}
							data={[
								{ value: "cancelled", label: "Cita cancelada" },
								{ value: "expired", label: "Cita expirada" },
								{ value: "attended", label: "Atención completada" },
							]}
						/>
						<div className={classes.formActions}>
							<Button
								type="button"
								variant="default"
								onClick={releaseModal.close}
								disabled={isRunning === "booking-release"}
							>
								Conservar cita
							</Button>
							<Button
								type="submit"
								color="red"
								loading={isRunning === "booking-release"}
							>
								Confirmar liberación
							</Button>
						</div>
					</div>
				</form>
			</Modal>
		</>
	);
}
