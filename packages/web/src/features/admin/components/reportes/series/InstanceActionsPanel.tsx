import {
	Button,
	Divider,
	Group,
	Loader,
	Select,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowDownUp,
	CalendarDays,
	Info,
	Save,
	UserCheck,
} from "lucide-react";
import { useMemo } from "react";
import { adminUi } from "#/features/admin/components/admin-ui";
import { orpcClient } from "#/shared/lib/orpc-client";
import type { ReservationInstance } from "../types";

interface InstanceActionsPanelProps {
	selectedInstance: ReservationInstance | null;
	isRunning: string | null;
	staffOptions: Array<{ value: string; label: string }>;
	runAction: (
		actionId: string,
		action: () => Promise<unknown>,
		successMessage: string,
		errorFallback: string,
	) => Promise<unknown>;
	asNullableText: (value: string) => string | null;
}

export function InstanceActionsPanel({
	selectedInstance,
	isRunning,
	staffOptions,
	runAction,
	asNullableText,
}: InstanceActionsPanelProps) {
	const updateForm = useForm({
		mode: "uncontrolled",
		initialValues: { staffUserId: "", notes: "" },
	});

	const moveForm = useForm({
		mode: "uncontrolled",
		initialValues: { slotDate: "", targetSlotId: "", targetStaffUserId: "" },
		validate: {
			targetSlotId: (value) => (!value ? "Seleccioná el slot destino" : null),
		},
	});

	const moveSlotsQuery = useQuery({
		queryKey: [
			"admin",
			"reportes",
			"instance-move-slots",
			moveForm.values.slotDate,
		],
		enabled: Boolean(moveForm.values.slotDate),
		queryFn: async () =>
			await orpcClient.admin.schedule.slots.list({
				date: moveForm.values.slotDate,
			}),
	});

	const moveSlotOptions = useMemo(
		() =>
			(moveSlotsQuery.data?.slots ?? [])
				.filter((slot) => slot.status === "open")
				.map((slot) => ({
					value: slot.id,
					label: `${slot.startTime} – ${slot.endTime} (${slot.remainingCapacity ?? "∞"})`,
				})),
		[moveSlotsQuery.data?.slots],
	);

	if (!selectedInstance) {
		return (
			<div className="flex h-full min-h-[160px] items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
				<Text c="dimmed" size="sm">
					Seleccioná una instancia para gestionar sus acciones
				</Text>
			</div>
		);
	}

	return (
		<div className={adminUi.surfaceInset}>
			<Stack gap="lg">
				<div className="flex items-center gap-3">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-100">
						<Info size={16} className="text-red-700" strokeWidth={1.75} />
					</div>
					<Title
						order={6}
						className="text-sm font-semibold text-[var(--text-primary)]"
					>
						Acciones sobre instancia
					</Title>
				</div>

				<Divider className={adminUi.divider} />

				{/* Update */}
				<form
					onSubmit={updateForm.onSubmit(
						(values) =>
							void runAction(
								"instance-update",
								async () =>
									await orpcClient.admin.reservations.update({
										bookingId: selectedInstance.id,
										staffUserId:
											asNullableText(values.staffUserId) ?? undefined,
										notes: asNullableText(values.notes),
									}),
								"Instancia actualizada.",
								"No se pudo actualizar la instancia.",
							),
					)}
				>
					<Stack gap="md">
						<Text
							size="xs"
							fw={600}
							className="uppercase tracking-wider text-[var(--text-secondary)]"
						>
							Actualizar instancia
						</Text>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<Select
								label="Nuevo staff"
								size="sm"
								placeholder="Opcional"
								leftSection={
									<UserCheck
										size={14}
										className="text-[var(--text-secondary)]"
									/>
								}
								key={updateForm.key("staffUserId")}
								{...updateForm.getInputProps("staffUserId")}
								data={staffOptions}
							/>
							<TextInput
								label="Notas"
								size="sm"
								key={updateForm.key("notes")}
								{...updateForm.getInputProps("notes")}
							/>
						</div>
						<Group justify="flex-start">
							<Button
								type="submit"
								size="sm"
								leftSection={<Save size={14} />}
								loading={isRunning === "instance-update"}
							>
								Actualizar
							</Button>
						</Group>
					</Stack>
				</form>

				<Divider className={adminUi.divider} />

				{/* Move */}
				<form
					onSubmit={moveForm.onSubmit(
						(values) =>
							void runAction(
								"instance-move",
								async () =>
									await orpcClient.admin.reservations.move({
										bookingId: selectedInstance.id,
										targetSlotId: values.targetSlotId,
										targetStaffUserId:
											asNullableText(values.targetStaffUserId) ?? undefined,
									}),
								"Instancia movida.",
								"No se pudo mover la instancia.",
							),
					)}
				>
					<Stack gap="md">
						<Text
							size="xs"
							fw={600}
							className="uppercase tracking-wider text-[var(--text-secondary)]"
						>
							Mover instancia
						</Text>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
							<TextInput
								label="Fecha del slot destino"
								size="sm"
								type="date"
								leftSection={
									<CalendarDays
										size={14}
										className="text-[var(--text-secondary)]"
									/>
								}
								key={moveForm.key("slotDate")}
								{...moveForm.getInputProps("slotDate")}
							/>
							<Select
								label="Slot destino"
								size="sm"
								key={moveForm.key("targetSlotId")}
								{...moveForm.getInputProps("targetSlotId")}
								data={moveSlotOptions}
								disabled={!moveForm.values.slotDate || moveSlotsQuery.isLoading}
								rightSection={
									moveSlotsQuery.isLoading ? <Loader size="xs" /> : null
								}
							/>
							<Select
								label="Staff destino"
								size="sm"
								placeholder="Opcional"
								leftSection={
									<UserCheck
										size={14}
										className="text-[var(--text-secondary)]"
									/>
								}
								key={moveForm.key("targetStaffUserId")}
								{...moveForm.getInputProps("targetStaffUserId")}
								data={staffOptions}
							/>
						</div>
						<Group gap="sm" wrap="wrap">
							<Button
								type="submit"
								variant="light"
								size="sm"
								leftSection={<ArrowDownUp size={14} />}
								loading={isRunning === "instance-move"}
							>
								Mover instancia
							</Button>
							<Select
								label="Razón de liberación"
								size="sm"
								w={200}
								defaultValue="cancelled"
								data={[
									{ value: "cancelled", label: "Cancelada" },
									{ value: "expired", label: "Expirada" },
									{ value: "attended", label: "Atendida" },
								]}
								onChange={(value) => {
									const reason = value ?? "cancelled";
									void runAction(
										"instance-release",
										async () =>
											await orpcClient.admin.reservations.release({
												bookingId: selectedInstance.id,
												reason,
											}),
										"Instancia liberada.",
										"No se pudo liberar la instancia.",
									);
								}}
							/>
							<Button
								color="red"
								variant="light"
								size="sm"
								leftSection={<AlertTriangle size={14} />}
								loading={isRunning === "instance-release"}
								onClick={() => {
									void runAction(
										"instance-release",
										async () =>
											await orpcClient.admin.reservations.release({
												bookingId: selectedInstance.id,
												reason: "cancelled",
											}),
										"Instancia liberada.",
										"No se pudo liberar la instancia.",
									);
								}}
							>
								Liberar instancia
							</Button>
						</Group>
					</Stack>
				</form>
			</Stack>
		</div>
	);
}
