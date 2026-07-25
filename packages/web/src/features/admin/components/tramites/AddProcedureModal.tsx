import { ProcedureFormModal } from "./ProcedureFormModal";
import type { ProcedureFormPayload } from "./procedure-form-model";

interface AddProcedureModalProps {
	opened: boolean;
	onClose: () => void;
	onCreate: (payload: ProcedureFormPayload) => Promise<void>;
}

export function AddProcedureModal({
	opened,
	onClose,
	onCreate,
}: AddProcedureModalProps) {
	return (
		<ProcedureFormModal
			opened={opened}
			onClose={onClose}
			mode="create"
			onSubmit={onCreate}
		/>
	);
}
