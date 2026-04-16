import {
	Alert,
	Button,
	Group,
	Modal,
	Stack,
	Switch,
	Textarea,
	TextInput,
} from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { AlertCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import {
	type ProcedureCreateFormValues,
	procedureCreateSchema,
	sanitizeProcedureSlug,
} from "../../../lib/schemas/procedure";
import { adminModalStyles } from "../_shared/-admin-ui";
import { getErrorMessage } from "../_shared/-errors";
import type { ProcedureCreateInput } from "./-types";

const initialValues: ProcedureCreateFormValues = {
	name: "",
	slug: "",
	description: "",
	requiresVehicle: false,
	allowsPhysicalDocuments: true,
	allowsDigitalDocuments: true,
};

export function AddProcedureModal({
	opened,
	onClose,
	onCreate,
}: {
	opened: boolean;
	onClose: () => void;
	onCreate: (payload: ProcedureCreateInput) => Promise<void>;
}) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const form = useForm<ProcedureCreateFormValues>({
		mode: "uncontrolled",
		initialValues,
		validate: schemaResolver(procedureCreateSchema),
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
		setIsSubmitting(true);
		setError(null);
		try {
			const normalizedValues = procedureCreateSchema.parse(values);
			await onCreate(normalizedValues);
			form.reset();
			onClose();
		} catch (submitError) {
			setError(getErrorMessage(submitError, "No se pudo crear el trámite."));
		} finally {
			setIsSubmitting(false);
		}
	});

	const slugInputProps = form.getInputProps("slug");

	return (
		<Modal
			opened={opened}
			onClose={handleClose}
			title={
				<span className="text-lg font-semibold tracking-tight text-zinc-900">
					Nuevo trámite
				</span>
			}
			size="lg"
			radius="xl"
			overlayProps={{ backgroundOpacity: 0.45, blur: 4 }}
			styles={adminModalStyles}
		>
			<form onSubmit={handleSubmit}>
				<Stack gap="md">
					{error && (
						<Alert color="red" icon={<AlertCircle size={16} />}>
							{error}
						</Alert>
					)}
					<TextInput
						label="Nombre"
						placeholder="Ej: Renovación de Licencia"
						radius="xl"
						disabled={isSubmitting}
						withAsterisk
						key={form.key("name")}
						{...form.getInputProps("name")}
					/>
					<TextInput
						label="Slug"
						placeholder="renovacion-licencia"
						radius="xl"
						disabled={isSubmitting}
						withAsterisk
						key={form.key("slug")}
						{...slugInputProps}
						onChange={(event) => {
							const sanitized = sanitizeProcedureSlug(
								event.currentTarget.value,
							);
							event.currentTarget.value = sanitized;
							slugInputProps.onChange(event);
						}}
					/>
					<Textarea
						label="Descripción"
						placeholder="Describe el trámite..."
						minRows={3}
						radius="xl"
						disabled={isSubmitting}
						key={form.key("description")}
						{...form.getInputProps("description")}
					/>
					<Switch
						label="Requiere vehículo"
						disabled={isSubmitting}
						key={form.key("requiresVehicle")}
						{...form.getInputProps("requiresVehicle", { type: "checkbox" })}
					/>
					<Group grow>
						<Switch
							label="Permite documentos físicos"
							disabled={isSubmitting}
							key={form.key("allowsPhysicalDocuments")}
							{...form.getInputProps("allowsPhysicalDocuments", {
								type: "checkbox",
							})}
						/>
						<Switch
							label="Permite documentos digitales"
							disabled={isSubmitting}
							key={form.key("allowsDigitalDocuments")}
							{...form.getInputProps("allowsDigitalDocuments", {
								type: "checkbox",
							})}
						/>
					</Group>
					<Group justify="flex-end" mt="sm">
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
							leftSection={<Plus size={16} strokeWidth={1.75} />}
							radius="md"
							loading={isSubmitting}
							className="font-semibold"
						>
							Crear trámite
						</Button>
					</Group>
				</Stack>
			</form>
		</Modal>
	);
}
