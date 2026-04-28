import { Button, Checkbox, Divider, Group, Loader, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { adminUi } from "#/features/admin/components/admin-ui";
import { orpcClient } from "#/shared/lib/orpc-client";

interface SeriesActionsPanelProps {
	selectedSeries: {
		id: string;
		notes?: string | null;
	} | null;
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

export function SeriesActionsPanel({
	selectedSeries,
	isRunning,
	staffOptions,
	runAction,
	asNullableText,
}: SeriesActionsPanelProps) {
	const updateForm = useForm({
		mode: "uncontrolled",
		initialValues: { staffUserId: "", notes: "", force: false },
	});

	const updateFromDateForm = useForm({
		mode: "uncontrolled",
		initialValues: { effectiveFrom: "", staffUserId: "", notes: "" },
	});

	const moveForm = useForm({
		mode: "uncontrolled",
		initialValues: { slotDate: "", targetSlotId: "", targetStaffUserId: "" },
		validate: {
			targetSlotId: (value) => (!value ? "Seleccioná el slot destino" : null),
		},
	});

	const moveSlotsQuery = useQuery({
		queryKey: ["admin", "reportes", "series-move-slots", moveForm.values.slotDate],
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

	if (!selectedSeries) {
		return (
			<div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
				<Text c="dimmed" size="sm">
					Seleccioná una serie para gestionar sus acciones
				</Text>
			</div>
		);
	}

	return (
		<div className="h-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
			<Stack gap="md">
				<Stack gap={2}>
					<Title
						order={5}
						className="text-sm font-semibold text-[var(--text-primary)]"
					>
						Acciones: Serie {selectedSeries.id.slice(0, 8)}…
					</Title>
					<Text size="xs" className="font-mono text-[var(--text-secondary)]">
						ID: {selectedSeries.id.slice(0, 8)}…
					</Text>
				</Stack>

				<Divider className={adminUi.divider} />

				{/* Update */}
				<form
					onSubmit={updateForm.onSubmit((values) =>
						void runAction(
							"series-update",
							async () =>
								await orpcClient.admin.reservationSeries.update({
									id: selectedSeries.id,
									staffUserId:
										asNullableText(values.staffUserId) ?? undefined,
									notes: asNullableText(values.notes),
									force: values.force,
								}),
							"Serie actualizada.",
							"No se pudo actualizar la serie.",
						),
					)}
				>
					<Stack gap="md">
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
							<div className="flex items-center h-full pt-6">
								<Checkbox
									label="Force"
									size="sm"
									key={updateForm.key("force")}
									{...updateForm.getInputProps("force", {
										type: "checkbox",
									})}
								/>
							</div>
						</div>
						<Group justify="flex-start">
							<Button
								type="submit"
								size="sm"
								loading={isRunning === "series-update"}
							>
								Actualizar serie
							</Button>
						</Group>
					</Stack>
				</form>

				<Divider className={adminUi.divider} />

				{/* Update from date */}
				<form
					onSubmit={updateFromDateForm.onSubmit((values) =>
						void runAction(
							"series-update-from-date",
							async () =>
								await orpcClient.admin.reservationSeries.updateFromDate({
									id: selectedSeries.id,
									effectiveFrom: values.effectiveFrom,
									staffUserId:
										asNullableText(values.staffUserId) ?? undefined,
									notes: asNullableText(values.notes),
								}),
							"Serie actualizada desde fecha.",
							"No se pudo actualizar desde fecha.",
						),
					)}
				>
					<Stack gap="md">
						<Title
							order={6}
							className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider"
						>
							Actualizar desde fecha
						</Title>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
							<TextInput
								label="Effective from"
								size="sm"
								type="date"
								key={updateFromDateForm.key("effectiveFrom")}
								{...updateFromDateForm.getInputProps("effectiveFrom")}
							/>
							<Select
								label="Staff desde fecha"
								size="sm"
								placeholder="Opcional"
								key={updateFromDateForm.key("staffUserId")}
								{...updateFromDateForm.getInputProps("staffUserId")}
								data={staffOptions}
							/>
							<TextInput
								label="Notas desde fecha"
								size="sm"
								key={updateFromDateForm.key("notes")}
								{...updateFromDateForm.getInputProps("notes")}
							/>
						</div>
						<Group justify="flex-start">
							<Button
								type="submit"
								variant="light"
								size="sm"
								loading={isRunning === "series-update-from-date"}
							>
								Update from date
							</Button>
						</Group>
					</Stack>
				</form>

				<Divider className={adminUi.divider} />

				{/* Move and Release */}
				<Stack gap="md">
					<Title
						order={6}
						className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider"
					>
						Mover y liberar
					</Title>
					<form
						onSubmit={moveForm.onSubmit((values) =>
							void runAction(
								"series-move",
								async () =>
									await orpcClient.admin.reservationSeries.move({
										id: selectedSeries.id,
										targetSlotId: values.targetSlotId,
										targetStaffUserId:
											asNullableText(values.targetStaffUserId) ??
											undefined,
									}),
								"Serie movida.",
								"No se pudo mover la serie.",
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
									loading={isRunning === "series-move"}
								>
									Mover serie
								</Button>
							</Group>
						</Stack>
					</form>

					<Group gap="sm" wrap="wrap" align="flex-end">
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
										"series-release",
										async () =>
											await orpcClient.admin.reservationSeries.release(
												{
													id: selectedSeries.id,
													reason,
												},
											),
										"Serie liberada.",
										"No se pudo liberar la serie.",
									);
								};
								void release();
							}}
						/>
						<Button
							color="red"
							variant="light"
							size="sm"
							loading={isRunning === "series-release"}
							onClick={() => {
								void runAction(
									"series-release",
									async () =>
										await orpcClient.admin.reservationSeries.release({
											id: selectedSeries.id,
											reason: "cancelled",
										}),
									"Serie liberada.",
									"No se pudo liberar la serie.",
								);
							}}
							leftSection={<AlertTriangle size={14} />}
						>
							Release serie
						</Button>
					</Group>
				</Stack>
			</Stack>
		</div>
	);
}
