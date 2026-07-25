import { Alert, Button, Text } from "@mantine/core";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useState } from "react";
import { PremiumModal } from "#/features/admin/components/PremiumModal";
import classes from "./Tramites.module.css";
import type { ProcedureType } from "./types";

interface DeleteProcedureModalProps {
	procedure: ProcedureType;
	onClose: () => void;
	onConfirm: (procedure: ProcedureType) => Promise<void>;
}

export function DeleteProcedureModal({
	procedure,
	onClose,
	onConfirm,
}: DeleteProcedureModalProps) {
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleConfirm = async () => {
		setError(null);
		setIsDeleting(true);
		try {
			await onConfirm(procedure);
			onClose();
		} catch (deleteError) {
			setError(
				deleteError instanceof Error
					? deleteError.message
					: "No se pudo eliminar el trámite.",
			);
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<PremiumModal
			opened
			onClose={onClose}
			title="Eliminar trámite"
			subtitle="Esta acción no se puede deshacer."
			size="sm"
			closeOnClickOutside={!isDeleting}
			closeOnEscape={!isDeleting}
			classNames={{
				content: classes.deleteModalContent,
				body: classes.deleteModalBody,
			}}
		>
			<div className={classes.deleteModalStack}>
				<div className={classes.deleteWarning}>
					<AlertTriangle size={20} aria-hidden="true" />
					<div>
						<Text fw={650}>{procedure.name}</Text>
						<Text size="sm" c="dimmed" mt={4} lh={1.55}>
							Se eliminará su configuración, requisitos y formulario. Si el
							trámite ya tiene actividad, el servidor puede impedir la
							operación.
						</Text>
					</div>
				</div>

				{error ? (
					<Alert color="red" variant="light" role="alert">
						{error}
					</Alert>
				) : null}

				<div className={classes.deleteModalActions}>
					<Button variant="default" onClick={onClose} disabled={isDeleting}>
						Cancelar
					</Button>
					<Button
						color="red"
						leftSection={<Trash2 size={16} aria-hidden="true" />}
						onClick={() => void handleConfirm()}
						loading={isDeleting}
					>
						Eliminar trámite
					</Button>
				</div>
			</div>
		</PremiumModal>
	);
}
