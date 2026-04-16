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
import { AlertCircle, ArrowRightLeft, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "../_shared/errors";
import type { AdminBooking, StaffProfile } from "./types";

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
	const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
	const [bookingCount, setBookingCount] = useState<number>(1);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!opened) return;
		setSelectedTarget(null);
		setBookingCount(1);
		setError(null);
	}, [opened]);

	const availableTargets = staffList.filter(
		(staff) =>
			staff.userId !== sourceStaff?.userId &&
			staff.isActive &&
			staff.isAssignable,
	);

	const handleSubmit = async () => {
		if (!selectedTarget || bookingCount < 1) {
			setError("Selecciona el destino y la cantidad de citas a mover.");
			return;
		}

		setLoading(true);
		setError(null);
		try {
			await onReassign(selectedTarget, bookingCount);
			onClose();
		} catch (submitError) {
			setError(getErrorMessage(submitError, "No se pudieron mover las citas."));
		} finally {
			setLoading(false);
		}
	};

	return (
		<Modal
			opened={opened}
			onClose={onClose}
			title="Mover citas"
			size="md"
			radius="xl"
		>
			<Stack gap="lg">
				{error && (
					<Alert color="red" icon={<AlertCircle size={16} />}>
						{error}
					</Alert>
				)}

				{sourceStaff && (
					<Alert
						color="blue"
						variant="light"
						radius="lg"
						icon={<UserCheck size={20} />}
					>
						<Text size="sm" fw={600}>
							Origen: {sourceStaff.user?.name}
						</Text>
						<Text size="xs" c="gray.5">
							{sourceBookings.length} citas activas hoy
						</Text>
					</Alert>
				)}

				<Select
					label="Encargado destino"
					placeholder="Selecciona un encargado"
					data={availableTargets.map((staff) => ({
						value: staff.userId,
						label: staff.user?.name || staff.userId,
					}))}
					value={selectedTarget}
					onChange={setSelectedTarget}
					radius="xl"
					disabled={loading}
				/>

				<NumberInput
					label="Cantidad de citas a mover"
					min={1}
					max={sourceBookings.length}
					value={bookingCount}
					onChange={(value) =>
						setBookingCount(typeof value === "number" ? value : 1)
					}
					radius="xl"
					disabled={loading}
				/>

				<Group justify="flex-end" mt="md">
					<Button
						variant="light"
						color="gray"
						onClick={onClose}
						radius="xl"
						disabled={loading}
					>
						Cancelar
					</Button>
					<Button
						color="red"
						onClick={handleSubmit}
						disabled={!selectedTarget || sourceBookings.length === 0}
						loading={loading}
						radius="xl"
						leftSection={<ArrowRightLeft size={16} />}
					>
						Mover citas
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}
