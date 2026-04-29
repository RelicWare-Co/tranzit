import {
	Button,
	Divider,
	Group,
	Select,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	AlertTriangle,
	ArrowDownUp,
	CheckCircle2,
	Eye,
	Info,
	UserCheck,
} from "lucide-react";
import { adminUi } from "#/features/admin/components/admin-ui";
import { orpcClient } from "#/shared/lib/orpc-client";

interface SelectedBooking {
	id: string;
	slotId: string;
	slot?: {
		slotDate?: string;
		startTime?: string;
	} | null;
}

interface BookingActionsPanelProps {
	selectedBooking: SelectedBooking;
	isRunning: string | null;
	runAction: (
		actionId: string,
		action: () => Promise<unknown>,
		successMessage: string,
		errorFallback: string,
	) => Promise<unknown>;
	staffOptions: Array<{ value: string; label: string }>;
	releaseReason: "cancelled" | "expired" | "attended";
	onReleaseReasonChange: (reason: "cancelled" | "expired" | "attended") => void;
	reassignTargetStaffId: string;
	onReassignTargetChange: (staffId: string) => void;
}

export function BookingActionsPanel({
	selectedBooking,
	isRunning,
	runAction,
	staffOptions,
	releaseReason,
	onReleaseReasonChange,
	reassignTargetStaffId,
	onReassignTargetChange,
}: BookingActionsPanelProps) {
	const releaseForm = useForm({
		mode: "uncontrolled",
		initialValues: { reason: releaseReason },
	});

	const reassignForm = useForm({
		mode: "uncontrolled",
		initialValues: { targetStaffUserId: reassignTargetStaffId },
		validate: {
			targetStaffUserId: (value) =>
				!value ? "Seleccioná un funcionario" : null,
		},
	});

	return (
		<div className={adminUi.surfaceInset}>
			<Stack gap="lg">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-100">
							<Info size={16} className="text-red-700" strokeWidth={1.75} />
						</div>
						<Stack gap={2}>
							<Title
								order={5}
								className="text-sm font-semibold text-[var(--text-primary)]"
							>
								Acciones sobre cita seleccionada
							</Title>
							<Text
								size="xs"
								className="font-mono text-[var(--text-secondary)]"
							>
								ID: {selectedBooking.id.slice(0, 8)}… |{" "}
								{selectedBooking.slot?.slotDate ?? "-"}{" "}
								{selectedBooking.slot?.startTime ?? "--"}
							</Text>
						</Stack>
					</div>
				</div>

				<Divider className={adminUi.divider} />

				{/* Quick Actions */}
				<Stack gap="xs">
					<Text
						size="xs"
						fw={600}
						className="uppercase tracking-wider text-[var(--text-secondary)]"
					>
						Acciones rápidas
					</Text>
					<Group gap="sm" wrap="wrap">
						<Button
							size="sm"
							leftSection={<CheckCircle2 size={14} />}
							loading={isRunning === "booking-confirm"}
							onClick={() =>
								void runAction(
									"booking-confirm",
									async () =>
										await orpcClient.admin.bookings.confirm({
											id: selectedBooking.id,
										}),
									"Cita confirmada.",
									"No se pudo confirmar la cita.",
								)
							}
						>
							Confirmar
						</Button>
						<Button
							variant="light"
							size="sm"
							leftSection={<Eye size={14} />}
							loading={isRunning === "booking-capacity"}
							onClick={() =>
								void runAction(
									"booking-capacity",
									async () =>
										await orpcClient.admin.bookings.capacity({
											id: selectedBooking.id,
										}),
									"Capacidad consultada.",
									"No se pudo consultar la capacidad.",
								)
							}
						>
							Ver capacidad
						</Button>
					</Group>
				</Stack>

				<Divider className={adminUi.divider} />

				{/* Reassign */}
				<form
					onSubmit={reassignForm.onSubmit(() => {
						onReassignTargetChange(reassignForm.values.targetStaffUserId);
						void runAction(
							"booking-reassign",
							async () =>
								await orpcClient.admin.bookings.reassign({
									id: selectedBooking.id,
									targetStaffUserId: reassignForm.values.targetStaffUserId,
								}),
							"Cita reasignada.",
							"No se pudo reasignar la cita.",
						);
					})}
				>
					<Stack gap="md">
						<Text
							size="xs"
							fw={600}
							className="uppercase tracking-wider text-[var(--text-secondary)]"
						>
							Reasignar
						</Text>
						<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
							<Select
								label="Funcionario destino"
								size="sm"
								placeholder="Seleccioná funcionario"
								leftSection={
									<UserCheck
										size={14}
										className="text-[var(--text-secondary)]"
									/>
								}
								key={reassignForm.key("targetStaffUserId")}
								{...reassignForm.getInputProps("targetStaffUserId")}
								data={staffOptions}
								onChange={(val) => {
									const value = val ?? "";
									reassignForm.setFieldValue("targetStaffUserId", value);
									onReassignTargetChange(value);
								}}
							/>
							<div className="flex items-end gap-2">
								<Button
									variant="light"
									size="sm"
									leftSection={<Eye size={14} />}
									loading={isRunning === "booking-reassign-preview"}
									onClick={() => {
										if (!reassignForm.values.targetStaffUserId) {
											reassignForm.setFieldError(
												"targetStaffUserId",
												"Seleccioná funcionario destino.",
											);
											return;
										}
										void runAction(
											"booking-reassign-preview",
											async () =>
												await orpcClient.admin.bookings.reassignPreview({
													id: selectedBooking.id,
													targetStaffUserId:
														reassignForm.values.targetStaffUserId,
												}),
											"Previsualización lista.",
											"No se pudo previsualizar.",
										);
									}}
								>
									Preview
								</Button>
								<Button
									type="submit"
									size="sm"
									leftSection={<ArrowDownUp size={14} />}
									loading={isRunning === "booking-reassign"}
								>
									Reasignar
								</Button>
								<Button
									variant="default"
									size="sm"
									leftSection={<Info size={14} />}
									loading={isRunning === "booking-availability"}
									onClick={() => {
										if (!reassignForm.values.targetStaffUserId) {
											reassignForm.setFieldError(
												"targetStaffUserId",
												"Seleccioná funcionario destino.",
											);
											return;
										}
										void runAction(
											"booking-availability",
											async () =>
												await orpcClient.admin.bookings.availabilityCheck({
													slotId: selectedBooking.slotId,
													staffUserId: reassignForm.values.targetStaffUserId,
												}),
											"Availability consultada.",
											"No se pudo consultar availability.",
										);
									}}
								>
									Availability
								</Button>
							</div>
						</div>
					</Stack>
				</form>

				<Divider className={adminUi.divider} />

				{/* Release */}
				<form
					onSubmit={releaseForm.onSubmit(() => {
						onReleaseReasonChange(releaseForm.values.reason);
						void runAction(
							"booking-release",
							async () =>
								await orpcClient.admin.bookings.release({
									id: selectedBooking.id,
									reason: releaseForm.values.reason,
								}),
							"Cita liberada.",
							"No se pudo liberar la cita.",
						);
					})}
				>
					<Stack gap="md">
						<Text
							size="xs"
							fw={600}
							className="uppercase tracking-wider text-[var(--text-secondary)]"
						>
							Liberar cita
						</Text>
						<Group gap="md" align="flex-end" wrap="wrap">
							<Select
								label="Razón de liberación"
								size="sm"
								w={220}
								key={releaseForm.key("reason")}
								{...releaseForm.getInputProps("reason")}
								data={[
									{ value: "cancelled", label: "Cancelada" },
									{ value: "expired", label: "Expirada" },
									{ value: "attended", label: "Atendida" },
								]}
								onChange={(val) => {
									const value = val ?? "cancelled";
									const typedValue = value as
										| "cancelled"
										| "expired"
										| "attended";
									releaseForm.setFieldValue("reason", typedValue);
									onReleaseReasonChange(typedValue);
								}}
							/>
							<Button
								type="submit"
								color="red"
								variant="light"
								size="sm"
								leftSection={<AlertTriangle size={14} />}
								loading={isRunning === "booking-release"}
							>
								Liberar cita
							</Button>
						</Group>
					</Stack>
				</form>
			</Stack>
		</div>
	);
}
