import { Button, Text } from "@mantine/core";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { PremiumModal } from "#/features/admin/components";
import classes from "./Configuracion.module.css";

interface ConfirmDeleteModalProps {
	opened: boolean;
	title: string;
	description: string;
	onClose: () => void;
	onConfirm: () => Promise<void>;
}

export function ConfirmDeleteModal({
	opened,
	title,
	description,
	onClose,
	onConfirm,
}: ConfirmDeleteModalProps) {
	const [isDeleting, setIsDeleting] = useState(false);

	const handleConfirm = async () => {
		setIsDeleting(true);
		try {
			await onConfirm();
			onClose();
		} catch {
			// Mutation hooks already surface the server error in a notification.
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<PremiumModal
			opened={opened}
			onClose={onClose}
			title={title}
			subtitle="Esta acción no se puede deshacer."
			size="sm"
			closeOnClickOutside={!isDeleting}
			closeOnEscape={!isDeleting}
			classNames={{
				content: classes.modalContent,
				header: classes.modalHeader,
				body: classes.modalBody,
			}}
		>
			<div className={classes.modalForm}>
				<section className={classes.formSection}>
					<Text size="sm" c="dimmed" lh={1.6}>
						{description}
					</Text>
				</section>
				<div className={classes.modalActions}>
					<Button variant="default" onClick={onClose} disabled={isDeleting}>
						Cancelar
					</Button>
					<Button
						color="red"
						leftSection={<Trash2 size={16} />}
						onClick={() => void handleConfirm()}
						loading={isDeleting}
					>
						Eliminar
					</Button>
				</div>
			</div>
		</PremiumModal>
	);
}
