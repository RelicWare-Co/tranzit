import {
	Button,
	Checkbox,
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
		queryKey: [
			"admin",
			"reportes",
			"series-move-slots",
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

	if (!selectedSeries) {
		return (
			<div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
				<Text c="dimmed" size="sm">
					Seleccioná una serie para gestionar sus acciones
				</Text>
			</div>
		);
	}

	return (
		<div className={adminUi.surfaceInset}>
			<Stack gap="lg">
				{/* Header */}
				<div className="flex items-center gap-3">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-100">
						<Info size={16} className="text-red-700" strokeWidth={1.75} />
					</div>
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
				</div>

				<Divider className={adminUi.divider} />

				{/* Update */}
				<form
					onSubmit={updateForm.onSubmit(
						(values) =>
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
						<Text
							size="xs"
							fw={600}
							className="uppercase tracking-wider text-[var(--text-secondary)]"
						>
							Actualizar serie
						</Text>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
							<div className="flex items-center h-full pt-6">
								<Checkbox
									label="Forzar actualización"
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
								leftSection={<Save size={14} />}
								loading={isRunning === "series-update"}
							>
								Actualizar
							</Button>
						</Group>
					</Stack>
				</form>

				<Divider className={adminUi.divider} />

				{/* Update from date */}
				<form
					onSubmit={updateFromDateForm.onSubmit(
						(values) =>
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
						<Text
							size="xs"
							fw={600}
							className="uppercase tracking-wider text-[var(--text-secondary)]"
						>
							Actualizar desde fecha
						</Text>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
							<TextInput
								label="Fecha efectiva"
								size="sm"
								type="date"
								leftSection={
									<CalendarDays
										size={14}
										className="text-[var(--text-secondary)]"
									/>
								}
								key={updateFromDateForm.key("effectiveFrom")}
								{...updateFromDateForm.getInputProps("effectiveFrom")}
							/>
							<Select
								label="Staff desde fecha"
								size="sm"
								placeholder="Opcional"
								leftSection={
									<UserCheck
										size={14}
										className="text-[var(--text-secondary)]"
									/>
								}
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
								leftSection={<Save size={14} />}
								loading={isRunning === "series-update-from-date"}
							>
								Aplicar desde fecha
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
								"series-move",
								async () =>
									await orpcClient.admin.reservationSeries.move({
										id: selectedSeries.id,
										targetSlotId: values.targetSlotId,
										targetStaffUserId:
											asNullableText(values.targetStaffUserId) ?? undefined,
									}),
								"Serie movida.",
								"No se pudo mover la serie.",
							),
					)}
				>
					<Stack gap="md">
						<Text
							size="xs"
							fw={600}
							className="uppercase tracking-wider text-[var(--text-secondary)]"
						>
							Mover serie
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
								loading={isRunning === "series-move"}
							>
								Mover serie
							</Button>
						</Group>
					</Stack>
				</form>

				<Divider className={adminUi.divider} />

				{/* Release */}
				<Stack gap="md">
					<Text
						size="xs"
						fw={600}
						className="uppercase tracking-wider text-[var(--text-secondary)]"
					>
						Liberar serie
					</Text>
					<Group gap="sm" wrap="wrap" align="flex-end">
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
									"series-release",
									async () =>
										await orpcClient.admin.reservationSeries.release({
											id: selectedSeries.id,
											reason,
										}),
									"Serie liberada.",
									"No se pudo liberar la serie.",
								);
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
							Liberar serie
						</Button>
					</Group>
				</Stack>
			</Stack>
		</div>
	);
}
