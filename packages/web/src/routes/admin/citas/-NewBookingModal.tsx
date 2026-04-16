import {
	Alert,
	Box,
	Button,
	Group,
	LoadingOverlay,
	Modal,
	Select,
	Stack,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { AlertCircle } from "lucide-react";
import { adminModalStyles } from "../_shared/-admin-ui";
import type { BookingKind } from "./-types";

export function NewBookingModal({
	opened,
	onClose,
	loading,
	error,
	success,
	bookingKind,
	onBookingKindChange,
	selectedProcedure,
	onProcedureChange,
	procedureOptions,
	selectedDate,
	onDateChange,
	selectedSlot,
	onSlotChange,
	slotOptions,
	selectedStaff,
	onStaffChange,
	staffOptions,
	onSubmit,
}: {
	opened: boolean;
	onClose: () => void;
	loading: boolean;
	error: string | null;
	success: boolean;
	bookingKind: BookingKind;
	onBookingKindChange: (value: BookingKind) => void;
	selectedProcedure: string | null;
	onProcedureChange: (value: string | null) => void;
	procedureOptions: { value: string; label: string }[];
	selectedDate: Date | null;
	onDateChange: (value: Date | null) => void;
	selectedSlot: string | null;
	onSlotChange: (value: string | null) => void;
	slotOptions: { value: string; label: string }[];
	selectedStaff: string | null;
	onStaffChange: (value: string | null) => void;
	staffOptions: { value: string; label: string }[];
	onSubmit: () => void;
}) {
	return (
		<Modal
			opened={opened}
			onClose={onClose}
			title={
				<span className="text-lg font-semibold tracking-tight text-zinc-900">
					Nueva cita
				</span>
			}
			size="lg"
			radius="xl"
			zIndex={1100}
			centered
			overlayProps={{
				backgroundOpacity: 0.5,
				blur: 6,
			}}
			yOffset="8vh"
			styles={adminModalStyles}
		>
			<Box pos="relative">
				<LoadingOverlay visible={loading} />

				{error && (
					<Alert
						icon={<AlertCircle size={16} />}
						title="Error"
						color="red"
						radius="md"
						mb="md"
					>
						{error}
					</Alert>
				)}

				{success && (
					<Alert title="Éxito" color="green" radius="md" mb="md">
						Cita creada correctamente.
					</Alert>
				)}

				<Stack gap="md">
					<Select
						label="Tipo de Cita"
						placeholder="Seleccione el tipo"
						value={bookingKind}
						onChange={(value) =>
							onBookingKindChange(
								(value as BookingKind | null) ?? "administrative",
							)
						}
						data={[
							{ value: "administrative", label: "Administrativa" },
							{ value: "citizen", label: "Ciudadano" },
						]}
						required
						comboboxProps={{ zIndex: 1200, withinPortal: true }}
					/>

					<Select
						label="Tramite"
						placeholder="Seleccione el tramite"
						value={selectedProcedure}
						onChange={onProcedureChange}
						data={procedureOptions}
						searchable
						nothingFoundMessage="No hay tramites disponibles"
						comboboxProps={{ zIndex: 1200, withinPortal: true }}
					/>

					<DatePickerInput
						label="Fecha"
						placeholder="Seleccione la fecha"
						value={selectedDate}
						onChange={(value) => {
							if (typeof value === "string") {
								onDateChange(value ? new Date(`${value}T00:00:00`) : null);
								return;
							}
							onDateChange(value);
						}}
						valueFormat="YYYY-MM-DD"
						minDate={new Date()}
						required
						popoverProps={{
							zIndex: 1200,
							withinPortal: true,
						}}
					/>

					<Select
						label="Horario"
						placeholder="Seleccione el horario"
						value={selectedSlot}
						onChange={onSlotChange}
						data={slotOptions}
						disabled={!selectedDate || slotOptions.length === 0}
						required
						nothingFoundMessage="No hay horarios disponibles"
						comboboxProps={{ zIndex: 1200, withinPortal: true }}
					/>

					<Select
						label="Funcionario"
						placeholder="Seleccione el funcionario"
						value={selectedStaff}
						onChange={onStaffChange}
						data={staffOptions}
						searchable
						required
						nothingFoundMessage="No hay funcionarios disponibles"
						comboboxProps={{ zIndex: 1200, withinPortal: true }}
					/>

					<Group justify="flex-end" mt="md">
						<Button variant="default" radius="md" onClick={onClose}>
							Cancelar
						</Button>
						<Button
							color="red"
							radius="md"
							className="font-semibold"
							onClick={onSubmit}
							loading={loading}
						>
							Crear cita
						</Button>
					</Group>
				</Stack>
			</Box>
		</Modal>
	);
}
