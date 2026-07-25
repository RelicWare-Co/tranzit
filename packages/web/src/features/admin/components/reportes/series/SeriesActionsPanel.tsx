import {
	Accordion,
	Button,
	Checkbox,
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
	CalendarDays,
	Repeat2,
	Save,
	UserCheck,
} from "lucide-react";
import { useMemo } from "react";
import { orpcClient } from "#/shared/lib/orpc-client";
import classes from "../Reportes.module.css";

interface SeriesActionsPanelProps {
	selectedSeries: {
		id: string;
		notes?: string | null;
	} | null;
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

export function SeriesActionsPanel({
	selectedSeries,
	isRunning,
	staffOptions,
	runAction,
	asNullableText,
}: SeriesActionsPanelProps) {
	const [releaseOpened, releaseModal] = useDisclosure(false);

	const updateForm = useForm({
		mode: "uncontrolled",
		initialValues: { staffUserId: "", notes: "", force: false },
	});
	const updateFromDateForm = useForm({
		mode: "uncontrolled",
		initialValues: { effectiveFrom: "", staffUserId: "", notes: "" },
		validate: {
			effectiveFrom: (value) => (!value ? "Selecciona una fecha" : null),
		},
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
			"series-move-slots",
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

	if (!selectedSeries) {
		return (
			<div className={classes.emptySelection}>
				<EmptyState
					icon={<Repeat2 size={28} />}
					title="Selecciona una serie"
					description="Las herramientas de gestión aparecerán aquí."
					size="sm"
					withIndicatorBackground
				/>
			</div>
		);
	}

	const handleRelease = releaseForm.onSubmit(async (values) => {
		try {
			await runAction(
				"series-release",
				async () =>
					await orpcClient.admin.reservationSeries.release({
						id: selectedSeries.id,
						reason: values.reason,
					}),
				"Serie liberada. Sus reservas activas dejaron de consumir capacidad.",
				"No se pudo liberar la serie.",
			);
			releaseModal.close();
		} catch {
			// The operation error is already surfaced by runAction.
		}
	});

	return (
		<>
			<div className={classes.actionPanel}>
				<div className={classes.actionSection}>
					<h4 className={classes.actionSectionTitle}>
						Cambios sobre la serie completa
					</h4>
					<p className={classes.actionSectionDescription}>
						Escoge el alcance del cambio antes de modificar reservas generadas.
					</p>
				</div>

				<Accordion
					variant="unstyled"
					defaultValue="update"
					classNames={{
						item: classes.accordionItem,
						control: classes.accordionControl,
						panel: classes.accordionPanel,
					}}
				>
					<Accordion.Item value="update">
						<Accordion.Control>Actualizar toda la serie</Accordion.Control>
						<Accordion.Panel>
							<form
								onSubmit={updateForm.onSubmit(
									(values) =>
										void runAction(
											"series-update",
											async () =>
												await orpcClient.admin.reservationSeries.update({
													id: selectedSeries.id,
													staffUserId:
														asNullableText(values.staffUserId) ?? undefined,
													notes: asNullableText(values.notes),
													force: values.force,
												}),
											"Serie actualizada.",
											"No se pudo actualizar la serie.",
										),
								)}
							>
								<div className={classes.actionSection}>
									<div className={classes.formGrid}>
										<Select
											label="Nuevo funcionario"
											description="Opcional. Conserva el actual si queda vacío."
											placeholder="Conservar responsable"
											searchable
											key={updateForm.key("staffUserId")}
											{...updateForm.getInputProps("staffUserId")}
											data={staffOptions}
										/>
										<TextInput
											label="Notas internas"
											placeholder="Conservar o actualizar contexto"
											key={updateForm.key("notes")}
											{...updateForm.getInputProps("notes")}
										/>
									</div>
									<Checkbox
										label="Forzar el cambio aunque existan advertencias de capacidad"
										key={updateForm.key("force")}
										{...updateForm.getInputProps("force", {
											type: "checkbox",
										})}
									/>
									<div className={classes.formActions}>
										<Button
											type="submit"
											leftSection={<Save size={15} />}
											loading={isRunning === "series-update"}
										>
											Actualizar serie
										</Button>
									</div>
								</div>
							</form>
						</Accordion.Panel>
					</Accordion.Item>

					<Accordion.Item value="future">
						<Accordion.Control>Aplicar desde una fecha</Accordion.Control>
						<Accordion.Panel>
							<form
								onSubmit={updateFromDateForm.onSubmit(
									(values) =>
										void runAction(
											"series-update-from-date",
											async () =>
												await orpcClient.admin.reservationSeries.updateFromDate(
													{
														id: selectedSeries.id,
														effectiveFrom: values.effectiveFrom,
														staffUserId:
															asNullableText(values.staffUserId) ?? undefined,
														notes: asNullableText(values.notes),
													},
												),
											"Cambio aplicado desde la fecha indicada.",
											"No se pudo actualizar la serie desde esa fecha.",
										),
								)}
							>
								<div className={classes.actionSection}>
									<div className={classes.formGrid}>
										<TextInput
											label="Fecha efectiva"
											type="date"
											leftSection={<CalendarDays size={15} />}
											key={updateFromDateForm.key("effectiveFrom")}
											{...updateFromDateForm.getInputProps("effectiveFrom")}
										/>
										<Select
											label="Funcionario desde esa fecha"
											placeholder="Conservar responsable"
											searchable
											leftSection={<UserCheck size={15} />}
											key={updateFromDateForm.key("staffUserId")}
											{...updateFromDateForm.getInputProps("staffUserId")}
											data={staffOptions}
										/>
									</div>
									<TextInput
										label="Notas para el cambio"
										key={updateFromDateForm.key("notes")}
										{...updateFromDateForm.getInputProps("notes")}
									/>
									<div className={classes.formActions}>
										<Button
											type="submit"
											leftSection={<Save size={15} />}
											loading={isRunning === "series-update-from-date"}
										>
											Aplicar cambio futuro
										</Button>
									</div>
								</div>
							</form>
						</Accordion.Panel>
					</Accordion.Item>

					<Accordion.Item value="move">
						<Accordion.Control>Mover a otro horario</Accordion.Control>
						<Accordion.Panel>
							<form
								onSubmit={moveForm.onSubmit(
									(values) =>
										void runAction(
											"series-move",
											async () =>
												await orpcClient.admin.reservationSeries.move({
													id: selectedSeries.id,
													targetSlotId: values.targetSlotId,
													targetStaffUserId:
														asNullableText(values.targetStaffUserId) ??
														undefined,
												}),
											"Serie movida al horario seleccionado.",
											"No se pudo mover la serie.",
										),
								)}
							>
								<div className={classes.actionSection}>
									<div className={classes.formGridThree}>
										<TextInput
											label="Fecha del nuevo horario"
											type="date"
											key={moveForm.key("slotDate")}
											{...moveForm.getInputProps("slotDate")}
										/>
										<Select
											label="Horario destino"
											placeholder="Selecciona un horario"
											key={moveForm.key("targetSlotId")}
											{...moveForm.getInputProps("targetSlotId")}
											data={moveSlotOptions}
											disabled={
												!moveForm.values.slotDate || moveSlotsQuery.isLoading
											}
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
											loading={isRunning === "series-move"}
										>
											Mover serie
										</Button>
									</div>
								</div>
							</form>
						</Accordion.Panel>
					</Accordion.Item>
				</Accordion>

				<section className={classes.actionSection}>
					<h4 className={classes.actionSectionTitle}>Liberar toda la serie</h4>
					<p className={classes.actionSectionDescription}>
						Desactiva la recurrencia y libera sus reservas activas.
					</p>
					<div>
						<Button
							color="red"
							variant="light"
							leftSection={<AlertTriangle size={15} />}
							onClick={releaseModal.open}
						>
							Liberar serie
						</Button>
					</div>
				</section>
			</div>

			<Modal
				opened={releaseOpened}
				onClose={releaseModal.close}
				title="Liberar serie de reserva"
				centered
				closeOnClickOutside={isRunning !== "series-release"}
				closeOnEscape={isRunning !== "series-release"}
				withCloseButton={isRunning !== "series-release"}
			>
				<Text className={classes.modalIntro}>
					Se desactivará la serie {selectedSeries.id.slice(0, 8)} y sus
					instancias activas dejarán de consumir capacidad.
				</Text>
				<form onSubmit={handleRelease}>
					<div className={classes.actionSection}>
						<Select
							label="Motivo de liberación"
							key={releaseForm.key("reason")}
							{...releaseForm.getInputProps("reason")}
							data={[
								{ value: "cancelled", label: "Serie cancelada" },
								{ value: "expired", label: "Serie expirada" },
								{ value: "attended", label: "Atención completada" },
							]}
						/>
						<div className={classes.formActions}>
							<Button
								type="button"
								variant="default"
								onClick={releaseModal.close}
								disabled={isRunning === "series-release"}
							>
								Conservar serie
							</Button>
							<Button
								type="submit"
								color="red"
								loading={isRunning === "series-release"}
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
