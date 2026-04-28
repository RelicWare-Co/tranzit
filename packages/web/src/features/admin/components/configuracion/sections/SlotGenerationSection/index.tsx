import { Button, Grid, Group, NumberInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { Hash } from "lucide-react";
import { useConfigMutations } from "#/features/admin/components/hooks/useConfigMutations";

interface SlotGenerationSectionProps {
	onRefresh: () => Promise<void>;
}

export function SlotGenerationSection({ onRefresh }: SlotGenerationSectionProps) {
	const mutations = useConfigMutations({ onSuccess: onRefresh });

	const form = useForm({
		initialValues: {
			dateFrom: "",
			dateTo: "",
			maxDays: 31,
		},
		validate: {
			dateFrom: (value) => (!value ? "Fecha inicial requerida" : null),
			dateTo: (value) => (!value ? "Fecha final requerida" : null),
			maxDays: (value) =>
				value < 1 || value > 365 ? "Debe estar entre 1 y 365" : null,
		},
	});

	const handleSubmit = async () => {
		const validation = form.validate();
		if (validation.hasErrors) return;

		const values = form.values;
		await mutations.generateSlots({
			dateFrom: values.dateFrom,
			dateTo: values.dateTo,
			maxDays: values.maxDays,
		});
		form.reset();
	};

	return (
		<div className="space-y-4">
			<Grid>
				<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
					<DatePickerInput
						label="Fecha inicial"
						placeholder="Selecciona fecha inicial"
						locale="es"
						valueFormat="YYYY-MM-DD"
						clearable
						value={form.values.dateFrom || null}
						onChange={(value) => {
							form.setFieldValue("dateFrom", value || "");
						}}
					/>
				</Grid.Col>
				<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
					<DatePickerInput
						label="Fecha final"
						placeholder="Selecciona fecha final"
						locale="es"
						valueFormat="YYYY-MM-DD"
						clearable
						value={form.values.dateTo || null}
						onChange={(value) => {
							form.setFieldValue("dateTo", value || "");
						}}
					/>
				</Grid.Col>
				<Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
					<NumberInput
						label="Máximo de días"
						min={1}
						max={365}
						{...form.getInputProps("maxDays")}
					/>
				</Grid.Col>
			</Grid>
			<Group justify="flex-end">
				<Button
					onClick={() => void handleSubmit()}
					leftSection={<Hash size={16} />}
				>
					Generar slots
				</Button>
			</Group>
		</div>
	);
}
