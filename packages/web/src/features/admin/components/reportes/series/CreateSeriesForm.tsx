import {
	Button,
	Loader,
	Modal,
	Select,
	Textarea,
	TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { orpcClient } from "#/shared/lib/orpc-client";
import classes from "../Reportes.module.css";
import { RRuleBuilder, type RRuleValue, useRRuleString } from "./RRuleBuilder";

interface CreateSeriesFormProps {
	staffOptions: Array<{ value: string; label: string }>;
	isRunning: string | null;
	createSeries: (values: {
		recurrenceRule: string;
		slotId: string;
		staffUserId: string;
		startDate: string;
		endDate: string;
		notes: string | null;
	}) => Promise<unknown>;
}

export function CreateSeriesForm({
	staffOptions,
	isRunning,
	createSeries,
}: CreateSeriesFormProps) {
	const [opened, modal] = useDisclosure(false);
	const [rruleValue, setRruleValue] = useState<RRuleValue>({
		freq: "WEEKLY",
		interval: 1,
		byDay: ["MO"],
		byMonthDay: null,
	});

	const recurrenceRuleString = useRRuleString(rruleValue);
	const isSubmitting = isRunning === "create-series";

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			slotDate: "",
			slotId: "",
			staffUserId: "",
			startDate: "",
			endDate: "",
			notes: "",
		},
		validate: {
			slotDate: (value) => (!value ? "Selecciona una fecha base" : null),
			slotId: (value) => (!value ? "Selecciona un horario" : null),
			staffUserId: (value) => (!value ? "Selecciona un funcionario" : null),
			startDate: (value) => (!value ? "La fecha de inicio es requerida" : null),
			endDate: (value, values) => {
				if (!value) return "La fecha de fin es requerida";
				if (values.startDate && value < values.startDate) {
					return "La fecha final debe ser posterior al inicio";
				}
				return null;
			},
		},
	});

	const slotsQuery = useQuery({
		queryKey: [
			"admin",
			"reportes",
			"create-series-slots",
			form.values.slotDate,
		],
		enabled: Boolean(form.values.slotDate),
		queryFn: async () =>
			await orpcClient.admin.schedule.slots.list({
				date: form.values.slotDate,
			}),
	});

	const slotOptions = (slotsQuery.data?.slots ?? [])
		.filter((slot) => slot.status === "open")
		.map((slot) => ({
			value: slot.id,
			label: `${slot.startTime} – ${slot.endTime} · ${
				slot.remainingCapacity ?? "Sin límite"
			} cupos`,
		}));

	const handleSubmit = form.onSubmit(async (values) => {
		try {
			await createSeries({
				recurrenceRule: recurrenceRuleString,
				slotId: values.slotId,
				staffUserId: values.staffUserId,
				startDate: values.startDate,
				endDate: values.endDate,
				notes: values.notes.trim() || null,
			});
			form.reset();
			setRruleValue({
				freq: "WEEKLY",
				interval: 1,
				byDay: ["MO"],
				byMonthDay: null,
			});
			modal.close();
		} catch {
			// The operation error is already surfaced by createSeries.
		}
	});

	return (
		<>
			<Button leftSection={<Plus size={16} />} onClick={modal.open}>
				Nueva serie
			</Button>

			<Modal
				opened={opened}
				onClose={modal.close}
				title="Nueva serie de reserva"
				size="lg"
				centered
				closeOnClickOutside={!isSubmitting}
				closeOnEscape={!isSubmitting}
				withCloseButton={!isSubmitting}
			>
				<p className={classes.modalIntro}>
					Crea reservas administrativas recurrentes a partir de un horario base.
					Las instancias resultantes consumirán capacidad en la agenda.
				</p>
				<form onSubmit={handleSubmit}>
					<section className={classes.modalSection}>
						<h3 className={classes.modalSectionTitle}>Patrón de repetición</h3>
						<RRuleBuilder value={rruleValue} onChange={setRruleValue} />
					</section>

					<section className={classes.modalSection}>
						<h3 className={classes.modalSectionTitle}>Horario y responsable</h3>
						<div className={classes.formGrid}>
							<TextInput
								label="Fecha para buscar el horario base"
								description="Solo se mostrarán horarios abiertos de esta fecha."
								type="date"
								key={form.key("slotDate")}
								{...form.getInputProps("slotDate")}
							/>
							<Select
								label="Horario base"
								placeholder={
									form.values.slotDate
										? "Selecciona un horario"
										: "Primero selecciona una fecha"
								}
								key={form.key("slotId")}
								{...form.getInputProps("slotId")}
								data={slotOptions}
								disabled={!form.values.slotDate || slotsQuery.isLoading}
								rightSection={
									slotsQuery.isLoading ? <Loader size="xs" /> : null
								}
							/>
							<Select
								label="Funcionario responsable"
								placeholder="Selecciona un funcionario"
								searchable
								key={form.key("staffUserId")}
								{...form.getInputProps("staffUserId")}
								data={staffOptions}
							/>
						</div>
					</section>

					<section className={classes.modalSection}>
						<h3 className={classes.modalSectionTitle}>Vigencia y contexto</h3>
						<div className={classes.formGrid}>
							<TextInput
								label="Inicio de la serie"
								type="date"
								key={form.key("startDate")}
								{...form.getInputProps("startDate")}
							/>
							<TextInput
								label="Fin de la serie"
								type="date"
								key={form.key("endDate")}
								{...form.getInputProps("endDate")}
							/>
						</div>
						<Textarea
							label="Notas internas"
							description="Opcional. Explica el propósito de la reserva para otros operadores."
							rows={3}
							key={form.key("notes")}
							{...form.getInputProps("notes")}
						/>
					</section>

					<div className={classes.formActions}>
						<Button
							type="button"
							variant="default"
							onClick={modal.close}
							disabled={isSubmitting}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							loading={isSubmitting}
							leftSection={<Plus size={15} />}
						>
							Crear serie
						</Button>
					</div>
				</form>
			</Modal>
		</>
	);
}
