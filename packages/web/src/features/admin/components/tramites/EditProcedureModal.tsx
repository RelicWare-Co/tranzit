import { ProcedureFormModal } from "./ProcedureFormModal";
import type { ProcedureFormPayload } from "./procedure-form-model";
import type { ProcedureType } from "./types";

interface EditProcedureModalProps {
	opened: boolean;
	onClose: () => void;
	procedure: ProcedureType;
	onUpdate: (payload: {
		id: string;
		name?: string;
		description?: string;
		requiresVehicle?: boolean;
		allowsPhysicalDocuments?: boolean;
		instructions?: string;
		documentSchema?: Record<string, unknown>;
		formSchema?: Record<string, unknown>;
	}) => Promise<void>;
}

export function EditProcedureModal({
	opened,
	onClose,
	procedure,
	onUpdate,
}: EditProcedureModalProps) {
	const handleSubmit = ({ slug: _slug, ...payload }: ProcedureFormPayload) =>
		onUpdate({ id: procedure.id, ...payload });

	return (
		<ProcedureFormModal
			opened={opened}
			onClose={onClose}
			mode="edit"
			procedure={procedure}
			onSubmit={handleSubmit}
		/>
	);
}
