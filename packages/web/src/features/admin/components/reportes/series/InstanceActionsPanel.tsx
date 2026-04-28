import { Button, Card, Divider, Group, Loader, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
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
					label: `${slot.startTime} - ${slot.endTime} (${slot.remainingCapacity ?? "∞"})`,
				})),
		[moveSlotsQuery.data?.slots],
	);

	if (!selectedInstance) {
		return (
			<div className="flex h-full min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
				<Text c="dimmed" size="sm">
					Seleccioná una instancia para gestionar sus acciones
				</Text>
			</div>
		);
	}

	return (
		<Card className={adminUi.surfaceInset} radius="lg" p="md" shadow="none">
			<Stack gap="md">
				<Title
					order={6}
					className="text-sm font-semibold text-[var(--text-primary)]"
				>
					Acciones sobre instancia
				</Title>

				{/* Update */}
				<form
					onSubmit={updateForm.onSubmit((values) =>
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
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<Select
								label="Nuevo staff"
								size="sm"
								placeholder="Opcional"
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
								loading={isRunning === "instance-update"}
							>
								Actualizar instancia
							</Button>
						</Group>
					</Stack>
				</form>

				<Divider className={adminUi.divider} />

				{/* Move */}
				<form
					onSubmit={moveForm.onSubmit((values) =>
						void runAction(
							"instance-move",
							async () =>
								await orpcClient.admin.reservations.move({
									bookingId: selectedInstance.id,
									targetSlotId: values.targetSlotId,
									targetStaffUserId:
										asNullableText(values.targetStaffUserId) ??
										undefined,
								}),
							"Instancia movida.",
							"No se pudo mover la instancia.",
						),
					)}
				>
					<Stack gap="md">
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
							<TextInput
								label="Fecha target slot"
								size="sm"
								type="date"
								key={moveForm.key("slotDate")}
								{...moveForm.getInputProps("slotDate")}
							/>
							<Select
								label="Target slot"
								size="sm"
								key={moveForm.key("targetSlotId")}
								{...moveForm.getInputProps("targetSlotId")}
								data={moveSlotOptions}
								disabled={
									!moveForm.values.slotDate ||
									moveSlotsQuery.isLoading
								}
								rightSection={
									moveSlotsQuery.isLoading ? (
										<Loader size="xs" />
									) : null
								}
							/>
							<Select
								label="Target staff"
								size="sm"
								placeholder="Opcional"
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
								loading={isRunning === "instance-move"}
							>
								Mover instancia
							</Button>
							<Select
								label="Razón release"
								size="sm"
								w={180}
								defaultValue="cancelled"
								data={[
									{ value: "cancelled", label: "Cancelada" },
									{ value: "expired", label: "Expirada" },
									{ value: "attended", label: "Atendida" },
								]}
								onChange={(value) => {
									const reason = value ?? "cancelled";
									const release = async () => {
										await runAction(
											"instance-release",
											async () =>
												await orpcClient.admin.reservations.release({
													bookingId: selectedInstance.id,
													reason,
												}),
											"Instancia liberada.",
											"No se pudo liberar la instancia.",
										);
									};
									void release();
								}}
							/>
							<Button
								color="red"
								variant="light"
								size="sm"
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
								leftSection={<AlertTriangle size={14} />}
							>
								Release instancia
							</Button>
						</Group>
					</Stack>
				</form>
			</Stack>
		</Card>
	);
}
