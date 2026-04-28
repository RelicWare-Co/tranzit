import { Button, Group, Loader, Select, Stack, Textarea, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { orpcClient } from "#/shared/lib/orpc-client";

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
	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
			slotDate: "",
			slotId: "",
			staffUserId: "",
			startDate: "",
			endDate: "",
			notes: "",
		},
		validate: {
			recurrenceRule: (value) =>
				!value.trim() ? "La regla RRULE es requerida" : null,
			slotId: (value) => (!value ? "Seleccioná un slot" : null),
			staffUserId: (value) => (!value ? "Seleccioná un funcionario" : null),
			startDate: (value) =>
				!value ? "La fecha de inicio es requerida" : null,
			endDate: (value) =>
				!value ? "La fecha de fin es requerida" : null,
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
				label: `${slot.startTime} - ${slot.endTime} (${slot.remainingCapacity ?? "∞"})`,
			})) ?? [];

	return (
		<div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
			<Stack gap="md">
				<Title
					order={5}
					className="text-sm font-semibold text-[var(--text-primary)]"
				>
					Nueva serie
				</Title>
				<form
					onSubmit={form.onSubmit((values) =>
						void createSeries({
							...values,
							notes: values.notes.trim() || null,
						}),
					)}
				>
					<Stack gap="md">
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
							<TextInput
								label="Regla RRULE"
								size="sm"
								placeholder="FREQ=WEEKLY;BYDAY=MO"
								key={form.key("recurrenceRule")}
								{...form.getInputProps("recurrenceRule")}
							/>
							<TextInput
								label="Fecha para slot base"
								size="sm"
								type="date"
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
								disabled={
									!form.values.slotDate || slotsQuery.isLoading
								}
								rightSection={
									slotsQuery.isLoading ? <Loader size="xs" /> : null
								}
							/>
							<Select
								label="Funcionario"
								size="sm"
								placeholder="Seleccioná funcionario"
								key={form.key("staffUserId")}
								{...form.getInputProps("staffUserId")}
								data={staffOptions}
							/>
							<TextInput
								label="Inicio serie"
								size="sm"
								type="date"
								key={form.key("startDate")}
								{...form.getInputProps("startDate")}
							/>
							<TextInput
								label="Fin serie"
								size="sm"
								type="date"
								key={form.key("endDate")}
								{...form.getInputProps("endDate")}
							/>
						</div>
						<Textarea
							label="Notas"
							size="sm"
							minRows={2}
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
