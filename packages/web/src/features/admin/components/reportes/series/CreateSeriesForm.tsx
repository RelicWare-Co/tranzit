import {
	Button,
	Group,
	Loader,
	Select,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, FileText, Plus, User } from "lucide-react";
import { useState } from "react";
import { adminUi } from "#/features/admin/components/admin-ui";
import { orpcClient } from "#/shared/lib/orpc-client";
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
	const [rruleValue, setRruleValue] = useState<RRuleValue>({
		freq: "WEEKLY",
		interval: 1,
		byDay: ["MO"],
		byMonthDay: null,
	});

	const recurrenceRuleString = useRRuleString(rruleValue);

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
			slotId: (value) => (!value ? "Seleccioná un slot" : null),
			staffUserId: (value) => (!value ? "Seleccioná un funcionario" : null),
			startDate: (value) => (!value ? "La fecha de inicio es requerida" : null),
			endDate: (value) => (!value ? "La fecha de fin es requerida" : null),
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

	const slotOptions =
		(slotsQuery.data?.slots ?? [])
			.filter((slot) => slot.status === "open")
			.map((slot) => ({
				value: slot.id,
				label: `${slot.startTime} – ${slot.endTime} (${slot.remainingCapacity ?? "∞"})`,
			})) ?? [];

	const handleSubmit = form.onSubmit((values) => {
		void createSeries({
			recurrenceRule: recurrenceRuleString,
			slotId: values.slotId,
			staffUserId: values.staffUserId,
			startDate: values.startDate,
			endDate: values.endDate,
			notes: values.notes.trim() || null,
		});
	});

	return (
		<div className={adminUi.surfaceInset}>
			<Stack gap="lg">
				<div className="flex items-center gap-3">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-100">
						<Plus size={16} className="text-red-700" strokeWidth={1.75} />
					</div>
					<Title
						order={5}
						className="text-sm font-semibold text-[var(--text-primary)]"
					>
						Nueva serie de reserva
					</Title>
				</div>

				<form onSubmit={handleSubmit}>
					<Stack gap="lg">
						{/* Recurrence */}
						<Stack gap="xs">
							<div className="flex items-center gap-2">
								<CalendarDays
									size={14}
									className="text-[var(--text-secondary)]"
									strokeWidth={1.75}
								/>
								<Text size="sm" fw={600} className="text-[var(--text-primary)]">
									Regla de recurrencia
								</Text>
							</div>
							<RRuleBuilder value={rruleValue} onChange={setRruleValue} />
						</Stack>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
							<TextInput
								label="Fecha para slot base"
								size="sm"
								type="date"
								leftSection={
									<Clock size={14} className="text-[var(--text-secondary)]" />
								}
								key={form.key("slotDate")}
								{...form.getInputProps("slotDate")}
							/>
							<Select
								label="Slot base"
								size="sm"
								placeholder="Seleccioná slot"
								key={form.key("slotId")}
								{...form.getInputProps("slotId")}
								data={slotOptions}
								disabled={!form.values.slotDate || slotsQuery.isLoading}
								rightSection={
									slotsQuery.isLoading ? <Loader size="xs" /> : null
								}
							/>
							<Select
								label="Funcionario"
								size="sm"
								placeholder="Seleccioná funcionario"
								leftSection={
									<User size={14} className="text-[var(--text-secondary)]" />
								}
								key={form.key("staffUserId")}
								{...form.getInputProps("staffUserId")}
								data={staffOptions}
							/>
							<TextInput
								label="Inicio serie"
								size="sm"
								type="date"
								leftSection={
									<CalendarDays
										size={14}
										className="text-[var(--text-secondary)]"
									/>
								}
								key={form.key("startDate")}
								{...form.getInputProps("startDate")}
							/>
							<TextInput
								label="Fin serie"
								size="sm"
								type="date"
								leftSection={
									<CalendarDays
										size={14}
										className="text-[var(--text-secondary)]"
									/>
								}
								key={form.key("endDate")}
								{...form.getInputProps("endDate")}
							/>
						</div>

						<Textarea
							label="Notas"
							size="sm"
							minRows={2}
							leftSection={
								<FileText
									size={14}
									className="text-[var(--text-secondary)] mt-1"
								/>
							}
							key={form.key("notes")}
							{...form.getInputProps("notes")}
						/>

						<Group justify="flex-end">
							<Button
								type="submit"
								size="sm"
								loading={isRunning === "create-series"}
								leftSection={<Plus size={14} />}
							>
								Crear serie
							</Button>
						</Group>
					</Stack>
				</form>
			</Stack>
		</div>
	);
}
