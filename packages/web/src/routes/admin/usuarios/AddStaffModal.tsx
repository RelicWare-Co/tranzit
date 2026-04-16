import {
	Alert,
	Button,
	Group,
	Modal,
	NumberInput,
	Stack,
	TextInput,
} from "@mantine/core";
import { AlertCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "../_shared/errors";
import type { CreateStaffPayload } from "./types";

export function AddStaffModal({
	opened,
	onClose,
	onCreate,
}: {
	opened: boolean;
	onClose: () => void;
	onCreate: (payload: CreateStaffPayload) => Promise<void>;
}) {
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [capacity, setCapacity] = useState(25);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!opened) return;
		setError(null);
	}, [opened]);

	const handleSubmit = async () => {
		setError(null);
		setIsSubmitting(true);
		try {
			await onCreate({
				name,
				email,
				capacity,
			});
			setEmail("");
			setName("");
			setCapacity(25);
			onClose();
		} catch (submitError) {
			setError(getErrorMessage(submitError, "No se pudo crear el encargado."));
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal
			opened={opened}
			onClose={onClose}
			title="Nuevo encargado"
			size="md"
			radius="xl"
		>
			<Stack gap="lg">
				{error && (
					<Alert color="red" icon={<AlertCircle size={16} />}>
						{error}
					</Alert>
				)}

				<TextInput
					label="Nombre completo"
					placeholder="Ej: María Elena Vargas"
					value={name}
					onChange={(event) => setName(event.currentTarget.value)}
					radius="xl"
					disabled={isSubmitting}
				/>

				<TextInput
					label="Correo electrónico"
					placeholder="ejemplo@simut.gov.co"
					type="email"
					value={email}
					onChange={(event) => setEmail(event.currentTarget.value)}
					radius="xl"
					disabled={isSubmitting}
				/>

				<NumberInput
					label="Capacidad diaria máxima"
					description="Número máximo de citas por día"
					value={capacity}
					onChange={(value) =>
						setCapacity(typeof value === "number" ? value : 25)
					}
					min={1}
					max={50}
					radius="xl"
					disabled={isSubmitting}
				/>

				<Group justify="flex-end" mt="md">
					<Button
						variant="light"
						color="gray"
						onClick={onClose}
						radius="xl"
						disabled={isSubmitting}
					>
						Cancelar
					</Button>
					<Button
						color="green"
						onClick={handleSubmit}
						disabled={!email.trim() || !name.trim()}
						radius="xl"
						loading={isSubmitting}
						leftSection={<Plus size={16} />}
					>
						Crear encargado
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}
