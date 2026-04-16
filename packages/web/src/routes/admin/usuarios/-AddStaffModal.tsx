import {
	Alert,
	Button,
	Group,
	Modal,
	NumberInput,
	Stack,
	TextInput,
} from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { AlertCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import {
	type StaffCreateFormValues,
	staffCreateSchema,
} from "../../../lib/schemas/staff";
import { adminModalStyles } from "../_shared/-admin-ui";
import { getErrorMessage } from "../_shared/-errors";
import type { CreateStaffPayload } from "./-types";

const initialValues: StaffCreateFormValues = {
	name: "",
	email: "",
	capacity: 25,
};

export function AddStaffModal({
	opened,
	onClose,
	onCreate,
}: {
	opened: boolean;
	onClose: () => void;
	onCreate: (payload: CreateStaffPayload) => Promise<void>;
}) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const form = useForm<StaffCreateFormValues>({
		mode: "uncontrolled",
		initialValues,
		validate: schemaResolver(staffCreateSchema),
	});

	// Reset form when modal opens
	useEffect(() => {
		if (opened) {
			form.reset();
			setError(null);
		}
	}, [opened, form.reset]);

	const handleClose = () => {
		if (isSubmitting) return;
		onClose();
	};

	const handleSubmit = form.onSubmit(async (values) => {
		setError(null);
		setIsSubmitting(true);
		try {
			const normalizedValues = staffCreateSchema.parse(values);
			await onCreate({
				name: normalizedValues.name,
				email: normalizedValues.email,
				capacity: normalizedValues.capacity,
			});
			form.reset();
			onClose();
		} catch (submitError) {
			setError(getErrorMessage(submitError, "No se pudo crear el encargado."));
		} finally {
			setIsSubmitting(false);
		}
	});

	return (
		<Modal
			opened={opened}
			onClose={handleClose}
			title={
				<span className="text-lg font-semibold tracking-tight text-zinc-900">
					Nuevo encargado
				</span>
			}
			size="md"
			radius="xl"
			overlayProps={{ backgroundOpacity: 0.45, blur: 4 }}
			styles={adminModalStyles}
		>
			<form onSubmit={handleSubmit}>
				<Stack gap="lg">
					{error && (
						<Alert color="red" icon={<AlertCircle size={16} />}>
							{error}
						</Alert>
					)}

					<TextInput
						label="Nombre completo"
						placeholder="Ej: María Elena Vargas"
						radius="xl"
						disabled={isSubmitting}
						withAsterisk
						key={form.key("name")}
						{...form.getInputProps("name")}
					/>

					<TextInput
						label="Correo electrónico"
						placeholder="ejemplo@simut.gov.co"
						type="email"
						radius="xl"
						disabled={isSubmitting}
						withAsterisk
						key={form.key("email")}
						{...form.getInputProps("email")}
					/>

					<NumberInput
						label="Capacidad diaria máxima"
						description="Número máximo de citas por día"
						min={1}
						max={100}
						radius="xl"
						disabled={isSubmitting}
						withAsterisk
						key={form.key("capacity")}
						{...form.getInputProps("capacity")}
					/>

					<Group justify="flex-end" mt="md">
						<Button
							type="button"
							variant="light"
							color="gray"
							onClick={handleClose}
							radius="md"
							disabled={isSubmitting}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							color="red"
							radius="md"
							loading={isSubmitting}
							className="font-semibold"
							leftSection={<Plus size={16} strokeWidth={1.75} />}
						>
							Crear encargado
						</Button>
					</Group>
				</Stack>
			</form>
		</Modal>
	);
}
