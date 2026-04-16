import {
	Alert,
	Button,
	Group,
	Modal,
	NumberInput,
	Select,
	Stack,
	Text,
} from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { AlertCircle, ArrowRightLeft, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import {
	MAX_REASSIGNMENTS_BATCH_SIZE,
	type ReassignBookingsFormValues,
	reassignBookingsSchema,
} from "../../../lib/schemas/reassign";
import { adminModalStyles } from "../_shared/-admin-ui";
import { getErrorMessage } from "../_shared/-errors";
import type { AdminBooking, StaffProfile } from "./-types";

const initialValues: ReassignBookingsFormValues = {
	targetStaffUserId: "",
	bookingCount: 1,
};

export function ReassignModal({
	opened,
	onClose,
	staffList,
	sourceStaff,
	sourceBookings,
	onReassign,
}: {
	opened: boolean;
	onClose: () => void;
	staffList: StaffProfile[];
	sourceStaff: StaffProfile | null;
	sourceBookings: AdminBooking[];
	onReassign: (
		targetStaffUserId: string,
		bookingCount: number,
	) => Promise<void>;
}) {
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const form = useForm<ReassignBookingsFormValues>({
		mode: "uncontrolled",
		initialValues,
		validate: schemaResolver(reassignBookingsSchema),
	});

	// Reset form when modal opens
	useEffect(() => {
		if (opened) {
			form.reset();
			setError(null);
		}
	}, [opened, form.reset]);

	const availableTargets = staffList.filter(
		(staff) =>
			staff.userId !== sourceStaff?.userId &&
			staff.isActive &&
			staff.isAssignable,
	);
	const maxBookingCount = Math.min(
		sourceBookings.length,
		MAX_REASSIGNMENTS_BATCH_SIZE,
	);

	const handleClose = () => {
		if (loading) return;
		onClose();
	};

	const handleSubmit = form.onSubmit(async (values) => {
		const normalizedValues = reassignBookingsSchema.parse(values);

		if (maxBookingCount === 0) {
			setError("No hay citas activas para mover.");
			return;
		}
		if (normalizedValues.bookingCount > maxBookingCount) {
			setError(
				`Solo puedes mover hasta ${maxBookingCount} citas en esta acción.`,
			);
			return;
		}

		setLoading(true);
		setError(null);
		try {
			await onReassign(
				normalizedValues.targetStaffUserId,
				normalizedValues.bookingCount,
			);
			onClose();
		} catch (submitError) {
			setError(getErrorMessage(submitError, "No se pudieron mover las citas."));
		} finally {
			setLoading(false);
		}
	});

	return (
		<Modal
			opened={opened}
			onClose={handleClose}
			title={
				<span className="text-lg font-semibold tracking-tight text-zinc-900">
					Mover citas
				</span>
			}
			size="md"
			radius="xl"
			styles={adminModalStyles}
		>
			<form onSubmit={handleSubmit}>
				<Stack gap="lg">
					{error && (
						<Alert color="red" icon={<AlertCircle size={16} />}>
							{error}
						</Alert>
					)}

					{sourceStaff ? (
						<Alert
							color="gray"
							variant="light"
							radius="lg"
							icon={<UserCheck size={20} strokeWidth={1.75} />}
							className="border border-zinc-200/90 bg-zinc-50"
						>
							<Text size="sm" fw={600} className="text-zinc-900">
								Origen: {sourceStaff.user?.name}
							</Text>
							<Text size="xs" className="text-zinc-500">
								{sourceBookings.length} citas activas hoy
							</Text>
						</Alert>
					) : null}

					<Select
						label="Encargado destino"
						placeholder="Selecciona un encargado"
						data={availableTargets.map((staff) => ({
							value: staff.userId,
							label: staff.user?.name || staff.userId,
						}))}
						disabled={loading}
						radius="xl"
						withAsterisk
						key={form.key("targetStaffUserId")}
						{...form.getInputProps("targetStaffUserId")}
					/>

					<NumberInput
						label="Cantidad de citas a mover"
						min={1}
						max={maxBookingCount > 0 ? maxBookingCount : undefined}
						disabled={loading}
						radius="xl"
						withAsterisk
						key={form.key("bookingCount")}
						{...form.getInputProps("bookingCount")}
					/>

					<Group justify="flex-end" mt="md">
						<Button
							type="button"
							variant="light"
							color="gray"
							onClick={handleClose}
							radius="md"
							disabled={loading}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							color="red"
							disabled={
								sourceBookings.length === 0 || availableTargets.length === 0
							}
							loading={loading}
							radius="md"
							className="font-semibold"
							leftSection={<ArrowRightLeft size={16} strokeWidth={1.75} />}
						>
							Mover citas
						</Button>
					</Group>
				</Stack>
			</form>
		</Modal>
	);
}
