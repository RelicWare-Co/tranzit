import {
	Button,
	EmptyState,
	Loader,
	Modal,
	Select,
	Text,
	TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowDownUp,
	CalendarClock,
	CalendarDays,
	Save,
	UserCheck,
} from "lucide-react";
import { useMemo } from "react";
import { orpcClient } from "#/shared/lib/orpc-client";
import classes from "../Reportes.module.css";
import type { ReservationInstance } from "../types";

interface InstanceActionsPanelProps {
	selectedInstance: ReservationInstance | null;
	isRunning: string | null;
	staffOptions: Array<{ value: string; label: string }>;
	runAction: (
		actionId: string,
		action: () => Promise<unknown>,
		successMessage: string,
		errorFallback: string,
	) => Promise<unknown>;
	asNullableText: (value: string) => string | null;
}

export function InstanceActionsPanel({
	selectedInstance,
	isRunning,
	staffOptions,
	runAction,
	asNullableText,
}: InstanceActionsPanelProps) {
	const [releaseOpened, releaseModal] = useDisclosure(false);

	const updateForm = useForm({
		mode: "uncontrolled",
		initialValues: { staffUserId: "", notes: "" },
	});
	const moveForm = useForm({
		mode: "uncontrolled",
		initialValues: { slotDate: "", targetSlotId: "", targetStaffUserId: "" },
		validate: {
			slotDate: (value) => (!value ? "Selecciona una fecha" : null),
			targetSlotId: (value) => (!value ? "Selecciona un horario" : null),
		},
	});
	const releaseForm = useForm({
		mode: "uncontrolled",
		initialValues: { reason: "cancelled" },
	});

	const moveSlotsQuery = useQuery({
		queryKey: [
			"admin",
			"reportes",
			"instance-move-slots",
			moveForm.values.slotDate,
		],
		enabled: Boolean(moveForm.values.slotDate),
		queryFn: async () =>
			await orpcClient.admin.schedule.slots.list({
				date: moveForm.values.slotDate,
			}),
	});

	const moveSlotOptions = useMemo(
		() =>
			(moveSlotsQuery.data?.slots ?? [])
				.filter((slot) => slot.status === "open")
				.map((slot) => ({
					value: slot.id,
					label: `${slot.startTime} – ${slot.endTime} · ${
						slot.remainingCapacity ?? "Sin límite"
					} cupos`,
				})),
		[moveSlotsQuery.data?.slots],
	);

	if (!selectedInstance) {
		return (
			<div className={classes.emptySelection}>
				<EmptyState
					icon={<CalendarClock size={28} />}
					title="Selecciona una instancia"
					description="Podrás editarla o moverla sin afectar las demás reservas de la serie."
					size="sm"
					withIndicatorBackground
				/>
			</div>
		);
	}

	const handleRelease = releaseForm.onSubmit(async (values) => {
		try {
			await runAction(
				"instance-release",
				async () =>
					await orpcClient.admin.reservations.release({
						bookingId: selectedInstance.id,
						reason: values.reason,
					}),
				"Instancia liberada. El resto de la serie no fue modificado.",
				"No se pudo liberar la instancia.",
			);
			releaseModal.close();
		} catch {
			// The operation error is already surfaced by runAction.
		}
	});

	return (
		<>
			<div className={classes.actionPanel}>
				<header className={classes.actionHeader}>
					<div>
						<p className={classes.actionEyebrow}>Instancia seleccionada</p>
						<h4 className={classes.actionTitle}>
							{selectedInstance.slot?.slotDate ?? "Sin fecha"}
							{" · "}
							{selectedInstance.slot?.startTime ?? "Sin hora"}
						</h4>
						<p className={classes.actionReference}>
							{selectedInstance.id.slice(0, 8)}
						</p>
					</div>
				</header>

				<form
					onSubmit={updateForm.onSubmit(
						(values) =>
							void runAction(
								"instance-update",
								async () =>
									await orpcClient.admin.reservations.update({
										bookingId: selectedInstance.id,
										staffUserId:
											asNullableText(values.staffUserId) ?? undefined,
										notes: asNullableText(values.notes),
									}),
								"Instancia actualizada sin modificar el resto de la serie.",
								"No se pudo actualizar la instancia.",
							),
					)}
				>
					<section className={classes.actionSection}>
						<h4 className={classes.actionSectionTitle}>
							Actualizar esta instancia
						</h4>
						<div className={classes.formGrid}>
							<Select
								label="Nuevo funcionario"
								placeholder="Conservar responsable"
								searchable
								leftSection={<UserCheck size={15} />}
								key={updateForm.key("staffUserId")}
								{...updateForm.getInputProps("staffUserId")}
								data={staffOptions}
							/>
							<TextInput
								label="Notas internas"
								key={updateForm.key("notes")}
								{...updateForm.getInputProps("notes")}
							/>
						</div>
						<div className={classes.formActions}>
							<Button
								type="submit"
								leftSection={<Save size={15} />}
								loading={isRunning === "instance-update"}
							>
								Actualizar instancia
							</Button>
						</div>
					</section>
				</form>

				<form
					onSubmit={moveForm.onSubmit(
						(values) =>
							void runAction(
								"instance-move",
								async () =>
									await orpcClient.admin.reservations.move({
										bookingId: selectedInstance.id,
										targetSlotId: values.targetSlotId,
										targetStaffUserId:
											asNullableText(values.targetStaffUserId) ?? undefined,
									}),
								"Instancia movida al horario seleccionado.",
								"No se pudo mover la instancia.",
							),
					)}
				>
					<section className={classes.actionSection}>
						<h4 className={classes.actionSectionTitle}>Mover esta instancia</h4>
						<p className={classes.actionSectionDescription}>
							El cambio no afecta las demás reservas de la serie.
						</p>
						<div className={classes.formGridThree}>
							<TextInput
								label="Fecha destino"
								type="date"
								leftSection={<CalendarDays size={15} />}
								key={moveForm.key("slotDate")}
								{...moveForm.getInputProps("slotDate")}
							/>
							<Select
								label="Horario destino"
								placeholder="Selecciona un horario"
								key={moveForm.key("targetSlotId")}
								{...moveForm.getInputProps("targetSlotId")}
								data={moveSlotOptions}
								disabled={!moveForm.values.slotDate || moveSlotsQuery.isLoading}
								rightSection={
									moveSlotsQuery.isLoading ? <Loader size="xs" /> : null
								}
							/>
							<Select
								label="Funcionario destino"
								placeholder="Conservar responsable"
								searchable
								key={moveForm.key("targetStaffUserId")}
								{...moveForm.getInputProps("targetStaffUserId")}
								data={staffOptions}
							/>
						</div>
						<div className={classes.formActions}>
							<Button
								type="submit"
								leftSection={<ArrowDownUp size={15} />}
								loading={isRunning === "instance-move"}
							>
								Mover instancia
							</Button>
						</div>
					</section>
				</form>

				<section className={classes.actionSection}>
					<h4 className={classes.actionSectionTitle}>Liberar esta instancia</h4>
					<p className={classes.actionSectionDescription}>
						Libera su capacidad sin cancelar toda la serie.
					</p>
					<div>
						<Button
							color="red"
							variant="light"
							leftSection={<AlertTriangle size={15} />}
							onClick={releaseModal.open}
						>
							Liberar instancia
						</Button>
					</div>
				</section>
			</div>

			<Modal
				opened={releaseOpened}
				onClose={releaseModal.close}
				title="Liberar instancia"
				centered
				closeOnClickOutside={isRunning !== "instance-release"}
				closeOnEscape={isRunning !== "instance-release"}
				withCloseButton={isRunning !== "instance-release"}
			>
				<Text className={classes.modalIntro}>
					Solo se desactivará la reserva {selectedInstance.id.slice(0, 8)}. La
					serie continuará generando y conservando sus demás instancias.
				</Text>
				<form onSubmit={handleRelease}>
					<div className={classes.actionSection}>
						<Select
							label="Motivo de liberación"
							key={releaseForm.key("reason")}
							{...releaseForm.getInputProps("reason")}
							data={[
								{ value: "cancelled", label: "Instancia cancelada" },
								{ value: "expired", label: "Instancia expirada" },
								{ value: "attended", label: "Atención completada" },
							]}
						/>
						<div className={classes.formActions}>
							<Button
								type="button"
								variant="default"
								onClick={releaseModal.close}
								disabled={isRunning === "instance-release"}
							>
								Conservar instancia
							</Button>
							<Button
								type="submit"
								color="red"
								loading={isRunning === "instance-release"}
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
