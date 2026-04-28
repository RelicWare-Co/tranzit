import {
	Badge,
	Box,
	Button,
	Card,
	Checkbox,
	Divider,
	Group,
	Loader,
	Select,
	Stack,
	Table,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, FileText, Plus } from "lucide-react";
import { useMemo } from "react";
import { adminUi } from "#/features/admin/components/-admin-ui";
import { getErrorMessage } from "#/features/admin/components/-errors";
import { orpcClient } from "#/shared/lib/orpc-client";
import type { ReservationInstance, ReservationSeriesFilters } from "./-types";

interface SeriesSectionProps {
	seriesQuery: {
		data?: Array<{
			id: string;
			isActive: boolean;
			activeInstanceCount?: number | null;
			notes?: string | null;
		}>;
		isLoading: boolean;
		isError: boolean;
		error: unknown;
	};
	selectedSeriesId: string | null;
	setSelectedSeriesId: (id: string | null) => void;
	selectedInstanceId: string | null;
	setSelectedInstanceId: (id: string | null) => void;
	instances: ReservationInstance[];
	seriesInstancesQuery: {
		isLoading: boolean;
	};
	staffOptions: Array<{ value: string; label: string }>;
	isRunning: string | null;
	runAction: (
		actionId: string,
		action: () => Promise<unknown>,
		successMessage: string,
		errorFallback: string,
	) => Promise<unknown>;
	createSeries: (values: {
		recurrenceRule: string;
		slotId: string;
		staffUserId: string;
		startDate: string;
		endDate: string;
		notes: string | null;
	}) => Promise<unknown>;
	seriesFilters: ReservationSeriesFilters;
	setSeriesFilters: (filters: ReservationSeriesFilters) => void;
	selectedSeries: {
		id: string;
		notes?: string | null;
	} | null;
	asNullableText: (value: string) => string | null;
}

function getStatusBadgeProps(status: string) {
	const normalized = status.toLowerCase();
	if (normalized === "confirmed")
		return { color: "teal", variant: "light" as const };
	if (normalized === "held" || normalized === "pending")
		return { color: "yellow", variant: "light" as const };
	if (normalized === "cancelled")
		return { color: "red", variant: "light" as const };
	return { color: "gray", variant: "light" as const };
}

export function SeriesSection({
	seriesQuery,
	selectedSeriesId,
	setSelectedSeriesId,
	selectedInstanceId,
	setSelectedInstanceId,
	instances,
	seriesInstancesQuery,
	staffOptions,
	isRunning,
	runAction,
	createSeries,
	seriesFilters,
	setSeriesFilters,
	selectedSeries,
	asNullableText,
}: SeriesSectionProps) {
	// Create series form
	const createForm = useForm({
		mode: "uncontrolled",
		initialValues: {
			recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
			slotDate: "",
			slotId: "",
			staffUserId: "",
			startDate: "",
			endDate: "",
			notes: "",
		},
		validate: {
			recurrenceRule: (value) =>
				!value.trim() ? "La regla RRULE es requerida" : null,
			slotId: (value) => (!value ? "Seleccioná un slot" : null),
			staffUserId: (value) => (!value ? "Seleccioná un funcionario" : null),
			startDate: (value) => (!value ? "La fecha de inicio es requerida" : null),
			endDate: (value) => (!value ? "La fecha de fin es requerida" : null),
		},
	});

	const createSeriesSlotsQuery = useQuery({
		queryKey: [
			"admin",
			"reportes",
			"create-series-slots",
			createForm.values.slotDate,
		],
		enabled: Boolean(createForm.values.slotDate),
		queryFn: async () =>
			await orpcClient.admin.schedule.slots.list({
				date: createForm.values.slotDate,
			}),
	});

	const createSeriesSlotOptions = useMemo(
		() =>
			(createSeriesSlotsQuery.data?.slots ?? [])
				.filter((slot) => slot.status === "open")
				.map((slot) => ({
					value: slot.id,
					label: `${slot.startTime} - ${slot.endTime} (${slot.remainingCapacity ?? "∞"})`,
				})),
		[createSeriesSlotsQuery.data?.slots],
	);

	// Series update form
	const seriesUpdateForm = useForm({
		mode: "uncontrolled",
		initialValues: {
			staffUserId: "",
			notes: selectedSeries?.notes ?? "",
			force: false,
		},
	});

	// Series update from date form
	const seriesUpdateFromDateForm = useForm({
		mode: "uncontrolled",
		initialValues: { effectiveFrom: "", staffUserId: "", notes: "" },
		validate: {
			effectiveFrom: (value) => (!value ? "Definí la fecha efectiva" : null),
		},
	});

	// Series move form
	const seriesMoveForm = useForm({
		mode: "uncontrolled",
		initialValues: { slotDate: "", targetSlotId: "", targetStaffUserId: "" },
		validate: {
			targetSlotId: (value) => (!value ? "Seleccioná el slot destino" : null),
		},
	});

	const seriesMoveSlotsQuery = useQuery({
		queryKey: [
			"admin",
			"reportes",
			"series-move-slots",
			seriesMoveForm.values.slotDate,
		],
		enabled: Boolean(seriesMoveForm.values.slotDate),
		queryFn: async () =>
			await orpcClient.admin.schedule.slots.list({
				date: seriesMoveForm.values.slotDate,
			}),
	});

	const seriesMoveSlotOptions = useMemo(
		() =>
			(seriesMoveSlotsQuery.data?.slots ?? [])
				.filter((slot) => slot.status === "open")
				.map((slot) => ({
					value: slot.id,
					label: `${slot.startTime} - ${slot.endTime} (${slot.remainingCapacity ?? "∞"})`,
				})),
		[seriesMoveSlotsQuery.data?.slots],
	);

	// Instance update form
	const instanceUpdateForm = useForm({
		mode: "uncontrolled",
		initialValues: { staffUserId: "", notes: "" },
	});

	// Instance move form
	const instanceMoveForm = useForm({
		mode: "uncontrolled",
		initialValues: { slotDate: "", targetSlotId: "", targetStaffUserId: "" },
		validate: {
			targetSlotId: (value) => (!value ? "Seleccioná el slot destino" : null),
		},
	});

	const instanceMoveSlotsQuery = useQuery({
		queryKey: [
			"admin",
			"reportes",
			"instance-move-slots",
			instanceMoveForm.values.slotDate,
		],
		enabled: Boolean(instanceMoveForm.values.slotDate),
		queryFn: async () =>
			await orpcClient.admin.schedule.slots.list({
				date: instanceMoveForm.values.slotDate,
			}),
	});

	const instanceMoveSlotOptions = useMemo(
		() =>
			(instanceMoveSlotsQuery.data?.slots ?? [])
				.filter((slot) => slot.status === "open")
				.map((slot) => ({
					value: slot.id,
					label: `${slot.startTime} - ${slot.endTime} (${slot.remainingCapacity ?? "∞"})`,
				})),
		[instanceMoveSlotsQuery.data?.slots],
	);

	const selectedInstance =
		instances.find((instance) => instance.id === selectedInstanceId) ?? null;

	return (
		<Card className={adminUi.surface} radius="lg" p="md" shadow="none">
			<Stack gap="lg">
				{/* Header */}
				<Group justify="space-between" wrap="nowrap">
					<Group gap="md" wrap="nowrap">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-100">
							<FileText size={20} className="text-red-700" strokeWidth={1.75} />
						</div>
						<Stack gap={0}>
							<Title
								order={4}
								className="text-base font-semibold text-[var(--text-primary)]"
							>
								Series de reserva administrativa
							</Title>
							<Text size="sm" className="text-[var(--text-secondary)]">
								Creá y gestioná reservas recurrentes con reglas RRULE.
							</Text>
						</Stack>
					</Group>
				</Group>

				{/* Create Series Form */}
				<Card className={adminUi.callout} radius="lg" p="md" shadow="none">
					<Stack gap="md">
						<Title
							order={5}
							className="text-sm font-semibold text-[var(--text-primary)]"
						>
							Nueva serie
						</Title>
						<form
							onSubmit={createForm.onSubmit(
								(values) =>
									void createSeries({
										...values,
										notes: asNullableText(values.notes),
									}),
							)}
						>
							<Stack gap="md">
								<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
									<TextInput
										label="Regla RRULE"
										size="sm"
										placeholder="FREQ=WEEKLY;BYDAY=MO"
										key={createForm.key("recurrenceRule")}
										{...createForm.getInputProps("recurrenceRule")}
									/>
									<TextInput
										label="Fecha para slot base"
										size="sm"
										type="date"
										key={createForm.key("slotDate")}
										{...createForm.getInputProps("slotDate")}
									/>
									<Select
										label="Slot base"
										size="sm"
										placeholder="Seleccioná slot"
										key={createForm.key("slotId")}
										{...createForm.getInputProps("slotId")}
										data={createSeriesSlotOptions}
										disabled={
											!createForm.values.slotDate ||
											createSeriesSlotsQuery.isLoading
										}
										rightSection={
											createSeriesSlotsQuery.isLoading ? (
												<Loader size="xs" />
											) : null
										}
									/>
									<Select
										label="Funcionario"
										size="sm"
										placeholder="Seleccioná funcionario"
										key={createForm.key("staffUserId")}
										{...createForm.getInputProps("staffUserId")}
										data={staffOptions}
									/>
									<TextInput
										label="Inicio serie"
										size="sm"
										type="date"
										key={createForm.key("startDate")}
										{...createForm.getInputProps("startDate")}
									/>
									<TextInput
										label="Fin serie"
										size="sm"
										type="date"
										key={createForm.key("endDate")}
										{...createForm.getInputProps("endDate")}
									/>
								</div>
								<Textarea
									label="Notas"
									size="sm"
									minRows={2}
									key={createForm.key("notes")}
									{...createForm.getInputProps("notes")}
								/>
								<Group justify="flex-end">
									<Button
										type="submit"
										size="sm"
										loading={isRunning === "create-series"}
										leftSection={<Plus size={14} />}
									>
										Crear serie
									</Button>
								</Group>
							</Stack>
						</form>
					</Stack>
				</Card>

				{/* Series Filter */}
				<Group gap="sm">
					<Select
						label="Filtrar series"
						size="sm"
						value={seriesFilters.isActive}
						onChange={(value) =>
							setSeriesFilters({
								isActive:
									(value as ReservationSeriesFilters["isActive"]) ?? "all",
							})
						}
						data={[
							{ value: "all", label: "Todas" },
							{ value: "true", label: "Activas" },
							{ value: "false", label: "Inactivas" },
						]}
					/>
				</Group>

				{/* Error state */}
				{seriesQuery.isError ? (
					<Card className={adminUi.callout} radius="lg" p="md">
						<Group gap="sm">
							<AlertCircle size={16} className="text-red-600" />
							<Text size="sm" className="text-red-700">
								{getErrorMessage(
									seriesQuery.error,
									"No se pudieron cargar las series",
								)}
							</Text>
						</Group>
					</Card>
				) : null}

				{seriesQuery.isLoading ? (
					<Group justify="center" py="md">
						<Loader size="sm" />
					</Group>
				) : null}

				{/* Empty state */}
				{(seriesQuery.data ?? []).length === 0 && !seriesQuery.isLoading ? (
					<Card
						className={`${adminUi.surfaceMuted} text-center`}
						radius="lg"
						p={48}
						shadow="none"
					>
						<Stack align="center" gap="md">
							<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 ring-1 ring-zinc-200">
								<FileText
									size={22}
									className="text-zinc-400"
									strokeWidth={1.5}
								/>
							</div>
							<Text className="text-base font-semibold text-[var(--text-primary)]">
								No hay series de reserva
							</Text>
							<Text
								size="sm"
								className="max-w-sm leading-relaxed text-[var(--text-secondary)]"
							>
								Creá una serie usando el formulario de arriba para generar
								reservas recurrentes automáticamente.
							</Text>
						</Stack>
					</Card>
				) : (
					<Box>
						<Table.ScrollContainer minWidth={960}>
							<Table striped withTableBorder withColumnBorders fz="sm">
								<Table.Thead>
									<Table.Tr>
										<Table.Th className={adminUi.tableHeader}>
											Seleccionar
										</Table.Th>
										<Table.Th className={adminUi.tableHeader}>ID</Table.Th>
										<Table.Th className={adminUi.tableHeader}>Activa</Table.Th>
										<Table.Th className={adminUi.tableHeader}>
											Instancias activas
										</Table.Th>
										<Table.Th className={adminUi.tableHeader}>Notas</Table.Th>
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{(seriesQuery.data ?? []).map((series) => (
										<Table.Tr
											key={series.id}
											className={
												series.id === selectedSeriesId ? "bg-red-50/40" : ""
											}
										>
											<Table.Td>
												<Button
													variant={
														series.id === selectedSeriesId ? "filled" : "light"
													}
													size="xs"
													onClick={() => setSelectedSeriesId(series.id)}
												>
													Usar
												</Button>
											</Table.Td>
											<Table.Td className="font-mono text-xs">
												{series.id.slice(0, 8)}…
											</Table.Td>
											<Table.Td>
												{series.isActive ? (
													<Badge color="teal" variant="light" size="sm">
														Sí
													</Badge>
												) : (
													<Badge color="gray" variant="light" size="sm">
														No
													</Badge>
												)}
											</Table.Td>
											<Table.Td>
												<span className="font-mono">
													{series.activeInstanceCount ?? "-"}
												</span>
											</Table.Td>
											<Table.Td>
												<Text size="sm" c="dimmed" lineClamp={1}>
													{series.notes ?? "-"}
												</Text>
											</Table.Td>
										</Table.Tr>
									))}
								</Table.Tbody>
							</Table>
						</Table.ScrollContainer>
					</Box>
				)}

				{/* Series Actions */}
				{selectedSeries && (
					<Box>
						<Card className={adminUi.callout} radius="lg" p="md" shadow="none">
							<Stack gap="lg">
								<Stack gap={2}>
									<Title
										order={5}
										className="text-sm font-semibold text-[var(--text-primary)]"
									>
										Acciones sobre serie seleccionada
									</Title>
									<Text
										size="xs"
										className="font-mono text-[var(--text-secondary)]"
									>
										ID: {selectedSeries.id.slice(0, 8)}…
									</Text>
								</Stack>

								<Divider className={adminUi.divider} />

								{/* Update Series */}
								<form
									onSubmit={seriesUpdateForm.onSubmit(
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
										<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
											<Select
												label="Nuevo staff"
												size="sm"
												placeholder="Opcional"
												key={seriesUpdateForm.key("staffUserId")}
												{...seriesUpdateForm.getInputProps("staffUserId")}
												data={staffOptions}
											/>
											<TextInput
												label="Notas"
												size="sm"
												key={seriesUpdateForm.key("notes")}
												{...seriesUpdateForm.getInputProps("notes")}
											/>
											<div className="flex items-center h-full pt-6">
												<Checkbox
													label="Force"
													size="sm"
													key={seriesUpdateForm.key("force")}
													{...seriesUpdateForm.getInputProps("force", {
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
									onSubmit={seriesUpdateFromDateForm.onSubmit(
										(values) =>
											void runAction(
												"series-update-from-date",
												async () =>
													await orpcClient.admin.reservationSeries.updateFromDate(
														{
															id: selectedSeries.id,
															effectiveFrom: values.effectiveFrom,
															staffUserId:
																asNullableText(values.staffUserId) ?? undefined,
															notes: asNullableText(values.notes),
														},
													),
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
												key={seriesUpdateFromDateForm.key("effectiveFrom")}
												{...seriesUpdateFromDateForm.getInputProps(
													"effectiveFrom",
												)}
											/>
											<Select
												label="Staff desde fecha"
												size="sm"
												placeholder="Opcional"
												key={seriesUpdateFromDateForm.key("staffUserId")}
												{...seriesUpdateFromDateForm.getInputProps(
													"staffUserId",
												)}
												data={staffOptions}
											/>
											<TextInput
												label="Notas desde fecha"
												size="sm"
												key={seriesUpdateFromDateForm.key("notes")}
												{...seriesUpdateFromDateForm.getInputProps("notes")}
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
										onSubmit={seriesMoveForm.onSubmit(
											(values) =>
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
													key={seriesMoveForm.key("slotDate")}
													{...seriesMoveForm.getInputProps("slotDate")}
												/>
												<Select
													label="Target slot"
													size="sm"
													key={seriesMoveForm.key("targetSlotId")}
													{...seriesMoveForm.getInputProps("targetSlotId")}
													data={seriesMoveSlotOptions}
													disabled={
														!seriesMoveForm.values.slotDate ||
														seriesMoveSlotsQuery.isLoading
													}
													rightSection={
														seriesMoveSlotsQuery.isLoading ? (
															<Loader size="xs" />
														) : null
													}
												/>
												<Select
													label="Target staff"
													size="sm"
													placeholder="Opcional"
													key={seriesMoveForm.key("targetStaffUserId")}
													{...seriesMoveForm.getInputProps("targetStaffUserId")}
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
															await orpcClient.admin.reservationSeries.release({
																id: selectedSeries.id,
																reason,
															}),
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
										>
											Release serie
										</Button>
									</Group>
								</Stack>
							</Stack>
						</Card>

						{/* Instances */}
						<Card
							className={adminUi.callout}
							radius="lg"
							p="md"
							shadow="none"
							mt="md"
						>
							<Stack gap="md">
								<Title
									order={5}
									className="text-sm font-semibold text-[var(--text-primary)]"
								>
									Instancias activas de la serie
								</Title>

								{seriesInstancesQuery.isLoading ? (
									<Group justify="center" py="md">
										<Loader size="sm" />
									</Group>
								) : null}

								{instances.length === 0 ? (
									<Text c="dimmed" size="sm" className="text-center" py="md">
										No hay instancias activas para esta serie.
									</Text>
								) : (
									<Table.ScrollContainer minWidth={960}>
										<Table striped withTableBorder withColumnBorders fz="sm">
											<Table.Thead>
												<Table.Tr>
													<Table.Th className={adminUi.tableHeader}>
														Seleccionar
													</Table.Th>
													<Table.Th className={adminUi.tableHeader}>
														ID
													</Table.Th>
													<Table.Th className={adminUi.tableHeader}>
														Fecha
													</Table.Th>
													<Table.Th className={adminUi.tableHeader}>
														Hora
													</Table.Th>
													<Table.Th className={adminUi.tableHeader}>
														Estado
													</Table.Th>
													<Table.Th className={adminUi.tableHeader}>
														Staff
													</Table.Th>
												</Table.Tr>
											</Table.Thead>
											<Table.Tbody>
												{instances.map((instance) => (
													<Table.Tr
														key={instance.id}
														className={
															instance.id === selectedInstanceId
																? "bg-red-50/40"
																: ""
														}
													>
														<Table.Td>
															<Button
																variant={
																	instance.id === selectedInstanceId
																		? "filled"
																		: "light"
																}
																size="xs"
																onClick={() =>
																	setSelectedInstanceId(instance.id)
																}
															>
																Usar
															</Button>
														</Table.Td>
														<Table.Td className="font-mono text-xs">
															{instance.id.slice(0, 8)}…
														</Table.Td>
														<Table.Td>
															{instance.slot?.slotDate ?? "-"}
														</Table.Td>
														<Table.Td>
															{instance.slot?.startTime ?? "--"} -{" "}
															{instance.slot?.endTime ?? "--"}
														</Table.Td>
														<Table.Td>
															<Badge
																{...getStatusBadgeProps(instance.status)}
																size="sm"
															>
																{instance.status}
															</Badge>
														</Table.Td>
														<Table.Td>{instance.staffUserId ?? "-"}</Table.Td>
													</Table.Tr>
												))}
											</Table.Tbody>
										</Table>
									</Table.ScrollContainer>
								)}

								{/* Instance Actions */}
								{selectedInstance && (
									<Box mt="md">
										<Card
											className={adminUi.surfaceInset}
											radius="lg"
											p="md"
											shadow="none"
										>
											<Stack gap="md">
												<Title
													order={6}
													className="text-sm font-semibold text-[var(--text-primary)]"
												>
													Acciones sobre instancia
												</Title>

												<form
													onSubmit={instanceUpdateForm.onSubmit(
														(values) =>
															void runAction(
																"instance-update",
																async () =>
																	await orpcClient.admin.reservations.update({
																		bookingId: selectedInstance.id,
																		staffUserId:
																			asNullableText(values.staffUserId) ??
																			undefined,
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
																key={instanceUpdateForm.key("staffUserId")}
																{...instanceUpdateForm.getInputProps(
																	"staffUserId",
																)}
																data={staffOptions}
															/>
															<TextInput
																label="Notas"
																size="sm"
																key={instanceUpdateForm.key("notes")}
																{...instanceUpdateForm.getInputProps("notes")}
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

												<form
													onSubmit={instanceMoveForm.onSubmit(
														(values) =>
															void runAction(
																"instance-move",
																async () =>
																	await orpcClient.admin.reservations.move({
																		bookingId: selectedInstance.id,
																		targetSlotId: values.targetSlotId,
																		targetStaffUserId:
																			asNullableText(
																				values.targetStaffUserId,
																			) ?? undefined,
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
																key={instanceMoveForm.key("slotDate")}
																{...instanceMoveForm.getInputProps("slotDate")}
															/>
															<Select
																label="Target slot"
																size="sm"
																key={instanceMoveForm.key("targetSlotId")}
																{...instanceMoveForm.getInputProps(
																	"targetSlotId",
																)}
																data={instanceMoveSlotOptions}
																disabled={
																	!instanceMoveForm.values.slotDate ||
																	instanceMoveSlotsQuery.isLoading
																}
																rightSection={
																	instanceMoveSlotsQuery.isLoading ? (
																		<Loader size="xs" />
																	) : null
																}
															/>
															<Select
																label="Target staff"
																size="sm"
																placeholder="Opcional"
																key={instanceMoveForm.key("targetStaffUserId")}
																{...instanceMoveForm.getInputProps(
																	"targetStaffUserId",
																)}
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
																				await orpcClient.admin.reservations.release(
																					{
																						bookingId: selectedInstance.id,
																						reason,
																					},
																				),
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
																			await orpcClient.admin.reservations.release(
																				{
																					bookingId: selectedInstance.id,
																					reason: "cancelled",
																				},
																			),
																		"Instancia liberada.",
																		"No se pudo liberar la instancia.",
																	);
																}}
															>
																Release instancia
															</Button>
														</Group>
													</Stack>
												</form>
											</Stack>
										</Card>
									</Box>
								)}
							</Stack>
						</Card>
					</Box>
				)}
			</Stack>
		</Card>
	);
}
