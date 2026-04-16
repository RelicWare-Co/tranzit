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
import { AlertCircle, Plus } from "lucide-react";
import { useState } from "react";
import { adminModalStyles } from "../_shared/admin-ui";
import { getErrorMessage } from "../_shared/errors";
import type { ProcedureCreateInput } from "./types";

export function AddProcedureModal({
	opened,
	onClose,
	onCreate,
}: {
	opened: boolean;
	onClose: () => void;
	onCreate: (payload: ProcedureCreateInput) => Promise<void>;
}) {
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [description, setDescription] = useState("");
	const [requiresVehicle, setRequiresVehicle] = useState(false);
	const [allowsPhysical, setAllowsPhysical] = useState(true);
	const [allowsDigital, setAllowsDigital] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleClose = () => {
		if (isSubmitting) return;
		setError(null);
		onClose();
	};

	const handleSubmit = async () => {
		setIsSubmitting(true);
		setError(null);
		try {
			await onCreate({
				name,
				slug,
				description: description || undefined,
				requiresVehicle,
				allowsPhysicalDocuments: allowsPhysical,
				allowsDigitalDocuments: allowsDigital,
			});
			setName("");
			setSlug("");
			setDescription("");
			setRequiresVehicle(false);
			setAllowsPhysical(true);
			setAllowsDigital(true);
			onClose();
		} catch (submitError) {
			setError(getErrorMessage(submitError, "No se pudo crear el trámite."));
		} finally {
			setIsSubmitting(false);
		}
	};

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
			<Stack gap="md">
				{error && (
					<Alert color="red" icon={<AlertCircle size={16} />}>
						{error}
					</Alert>
				)}
				<TextInput
					label="Nombre"
					value={name}
					onChange={(event) => setName(event.currentTarget.value)}
					placeholder="Ej: Renovación de Licencia"
					radius="xl"
					disabled={isSubmitting}
				/>
				<TextInput
					label="Slug"
					value={slug}
					onChange={(event) =>
						setSlug(
							event.currentTarget.value
								.toLowerCase()
								.replace(/[^a-z0-9-]/g, "-"),
						)
					}
					placeholder="renovacion-licencia"
					radius="xl"
					disabled={isSubmitting}
				/>
				<Textarea
					label="Descripción"
					value={description}
					onChange={(event) => setDescription(event.currentTarget.value)}
					placeholder="Describe el trámite..."
					minRows={3}
					radius="xl"
					disabled={isSubmitting}
				/>
				<Switch
					label="Requiere vehículo"
					checked={requiresVehicle}
					onChange={(event) => setRequiresVehicle(event.currentTarget.checked)}
					disabled={isSubmitting}
				/>
				<Group grow>
					<Switch
						label="Permite documentos físicos"
						checked={allowsPhysical}
						onChange={(event) => setAllowsPhysical(event.currentTarget.checked)}
						disabled={isSubmitting}
					/>
					<Switch
						label="Permite documentos digitales"
						checked={allowsDigital}
						onChange={(event) => setAllowsDigital(event.currentTarget.checked)}
						disabled={isSubmitting}
					/>
				</Group>
				<Group justify="flex-end" mt="sm">
					<Button
						variant="light"
						color="gray"
						onClick={handleClose}
						radius="md"
						disabled={isSubmitting}
					>
						Cancelar
					</Button>
					<Button
						color="red"
						leftSection={<Plus size={16} strokeWidth={1.75} />}
						onClick={handleSubmit}
						radius="md"
						loading={isSubmitting}
						disabled={!name.trim() || !slug.trim()}
						className="font-semibold"
					>
						Crear trámite
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}
