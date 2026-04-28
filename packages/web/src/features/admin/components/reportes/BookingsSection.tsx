import {
	Badge,
	Box,
	Button,
	Card,
	Divider,
	Group,
	Menu,
	Select,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	AlertCircle,
	ArrowDownUp,
	Calendar,
	CheckCircle2,
	Filter,
	Loader,
	MoreVertical,
	Search,
	XCircle,
} from "lucide-react";
import { adminUi } from "#/features/admin/components/admin-ui";
import { getErrorMessage } from "#/features/admin/components/errors";
import { orpcClient } from "#/shared/lib/orpc-client";
import { type BookingFilters, defaultBookingFilters } from "./types";

interface BookingsSectionProps {
	filtersDraft: BookingFilters;
	setFiltersDraft: (filters: BookingFilters) => void;
	_filters: BookingFilters;
	setFilters: (filters: BookingFilters) => void;
	bookingsQuery: {
		data?: Array<{
			id: string;
			status: string;
			isActive: boolean;
			slotId: string;
			slot?: {
				slotDate?: string;
				startTime?: string;
				endTime?: string;
			} | null;
			staff?: {
				name?: string | null;
				email?: string | null;
			} | null;
		}>;
		isLoading: boolean;
		isError: boolean;
		error: unknown;
	};
	selectedBookingId: string | null;
	setSelectedBookingId: (id: string | null) => void;
	staffOptions: Array<{ value: string; label: string }>;
	isRunning: string | null;
	runAction: (
		actionId: string,
		action: () => Promise<unknown>,
		successMessage: string,
		errorFallback: string,
	) => Promise<unknown>;
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

export function BookingsSection({
	filtersDraft,
	setFiltersDraft,
	setFilters,
	bookingsQuery,
	selectedBookingId,
	setSelectedBookingId,
	staffOptions,
	isRunning,
	runAction,
}: BookingsSectionProps) {
	const form = useForm({
		mode: "uncontrolled",
		initialValues: filtersDraft,
	});

	const selectedBooking =
		bookingsQuery.data?.find((b) => b.id === selectedBookingId) ?? null;

	const releaseForm = useForm({
		mode: "uncontrolled",
		initialValues: {
			reason: "cancelled" as "cancelled" | "expired" | "attended",
		},
	});

	const reassignForm = useForm({
		mode: "uncontrolled",
		initialValues: { targetStaffUserId: "" },
		validate: {
			targetStaffUserId: (value) =>
				!value ? "Seleccioná un funcionario" : null,
		},
	});

	const applyFilters = () => {
		const values = form.getValues();
		setFiltersDraft(values);
		setFilters(values);
	};

	const clearFilters = () => {
		form.setValues(defaultBookingFilters);
		setFiltersDraft(defaultBookingFilters);
		setFilters(defaultBookingFilters);
	};

	const totalBookings = bookingsQuery.data?.length ?? 0;

	return (
		<Card className={adminUi.surface} radius="lg" p="md" shadow="none">
			<Stack gap="lg">
				{/* Header */}
				<Group justify="space-between" wrap="nowrap">
					<Group gap="md" wrap="nowrap">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-100">
							<Calendar size={20} className="text-red-700" strokeWidth={1.75} />
						</div>
						<Stack gap={0}>
							<Title
								order={4}
								className="text-base font-semibold text-[var(--text-primary)]"
							>
								Citas administrativas
							</Title>
							<Text size="sm" className="text-[var(--text-secondary)]">
								Gestioná reservas individuales con filtros por fecha, estado y
								funcionario.
							</Text>
						</Stack>
					</Group>
					{bookingsQuery.isLoading && <Loader size="sm" />}
				</Group>

				{/* Filters */}
				<Card className={adminUi.callout} radius="lg" p="md" shadow="none">
					<Stack gap="md">
						<Group gap="sm" wrap="nowrap">
							<Filter
								size={16}
								className="text-[var(--text-secondary)]"
								strokeWidth={1.75}
							/>
							<Text fw={600} size="sm" className="text-[var(--text-primary)]">
								Filtros
							</Text>
						</Group>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<TextInput
								label="Desde"
								type="date"
								size="sm"
								key={form.key("dateFrom")}
								{...form.getInputProps("dateFrom")}
							/>
							<TextInput
								label="Hasta"
								type="date"
								size="sm"
								key={form.key("dateTo")}
								{...form.getInputProps("dateTo")}
							/>
							<TextInput
								label="Estado"
								placeholder="confirmed / held"
								size="sm"
								key={form.key("status")}
								{...form.getInputProps("status")}
							/>
							<Select
								label="Activo"
								size="sm"
								key={form.key("isActive")}
								{...form.getInputProps("isActive")}
								data={[
									{ value: "all", label: "Todos" },
									{ value: "true", label: "Sí" },
									{ value: "false", label: "No" },
								]}
							/>
						</div>
						<Group justify="flex-end" gap="sm">
							<Button
								variant="default"
								size="sm"
								onClick={clearFilters}
								leftSection={<XCircle size={14} />}
							>
								Limpiar
							</Button>
							<Button
								size="sm"
								onClick={applyFilters}
								loading={bookingsQuery.isLoading}
								leftSection={<Search size={14} />}
							>
								Aplicar filtros
							</Button>
						</Group>
					</Stack>
				</Card>

				{/* Error state */}
				{bookingsQuery.isError ? (
					<Card className={adminUi.callout} radius="lg" p="md">
						<Group gap="sm">
							<AlertCircle size={16} className="text-red-600" />
							<Text size="sm" className="text-red-700">
								{getErrorMessage(
									bookingsQuery.error,
									"No se pudieron cargar las citas",
								)}
							</Text>
						</Group>
					</Card>
				) : null}

				{/* Empty state */}
				{totalBookings === 0 && !bookingsQuery.isLoading ? (
					<Card
						className={`${adminUi.surfaceMuted} text-center`}
						radius="lg"
						p={48}
						shadow="none"
					>
						<Stack align="center" gap="md">
							<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 ring-1 ring-zinc-200">
								<Calendar
									size={22}
									className="text-zinc-400"
									strokeWidth={1.5}
								/>
							</div>
							<Text className="text-base font-semibold text-[var(--text-primary)]">
								No hay citas para mostrar
							</Text>
							<Text
								size="sm"
								className="max-w-sm leading-relaxed text-[var(--text-secondary)]"
							>
								No se encontraron citas con los filtros actuales. Ajustá los
								filtros o creá una nueva cita.
							</Text>
						</Stack>
					</Card>
				) : (
					<Box>
						<Table.ScrollContainer minWidth={1000}>
							<Table striped withTableBorder withColumnBorders fz="sm">
								<Table.Thead>
									<Table.Tr>
										<Table.Th className={adminUi.tableHeader}>
											Seleccionar
										</Table.Th>
										<Table.Th className={adminUi.tableHeader}>ID</Table.Th>
										<Table.Th className={adminUi.tableHeader}>Fecha</Table.Th>
										<Table.Th className={adminUi.tableHeader}>Hora</Table.Th>
										<Table.Th className={adminUi.tableHeader}>Estado</Table.Th>
										<Table.Th className={adminUi.tableHeader}>Activo</Table.Th>
										<Table.Th className={adminUi.tableHeader}>Staff</Table.Th>
										<Table.Th className={adminUi.tableHeader}>
											Acciones
										</Table.Th>
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{(bookingsQuery.data ?? []).map((booking) => (
										<Table.Tr
											key={booking.id}
											className={
												booking.id === selectedBookingId ? "bg-red-50/40" : ""
											}
										>
											<Table.Td>
												<Button
													variant={
														booking.id === selectedBookingId
															? "filled"
															: "light"
													}
													size="xs"
													onClick={() => setSelectedBookingId(booking.id)}
												>
													Usar
												</Button>
											</Table.Td>
											<Table.Td className="font-mono text-xs">
												{booking.id.slice(0, 8)}…
											</Table.Td>
											<Table.Td>{booking.slot?.slotDate ?? "-"}</Table.Td>
											<Table.Td>
												{booking.slot?.startTime ?? "--"} -{" "}
												{booking.slot?.endTime ?? "--"}
											</Table.Td>
											<Table.Td>
												<Badge
													{...getStatusBadgeProps(booking.status)}
													size="sm"
												>
													{booking.status}
												</Badge>
											</Table.Td>
											<Table.Td>
												{booking.isActive ? (
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
												{booking.staff?.name || booking.staff?.email || "-"}
											</Table.Td>
											<Table.Td>
												<Menu position="bottom-end">
													<Menu.Target>
														<Button variant="subtle" size="xs" p={0}>
															<MoreVertical size={14} />
														</Button>
													</Menu.Target>
													<Menu.Dropdown>
														<Menu.Item
															leftSection={<CheckCircle2 size={14} />}
															onClick={() =>
																void runAction(
																	"booking-confirm",
																	async () =>
																		await orpcClient.admin.bookings.confirm({
																			id: booking.id,
																		}),
																	"Cita confirmada.",
																	"No se pudo confirmar la cita.",
																)
															}
														>
															Confirmar
														</Menu.Item>
														<Menu.Item
															leftSection={<ArrowDownUp size={14} />}
															onClick={() => {
																const targetStaffUserId =
																	reassignForm.values.targetStaffUserId;
																if (!targetStaffUserId) {
																	reassignForm.setFieldError(
																		"targetStaffUserId",
																		"Seleccioná funcionario destino.",
																	);
																	return;
																}
																void runAction(
																	"booking-reassign",
																	async () =>
																		await orpcClient.admin.bookings.reassign({
																			id: booking.id,
																			targetStaffUserId,
																		}),
																	"Cita reasignada.",
																	"No se pudo reasignar la cita.",
																);
															}}
														>
															Reasignar
														</Menu.Item>
														<Menu.Divider />
														<Menu.Item
															color="red"
															leftSection={<XCircle size={14} />}
															onClick={() =>
																void runAction(
																	"booking-release",
																	async () =>
																		await orpcClient.admin.bookings.release({
																			id: booking.id,
																			reason: releaseForm.values.reason,
																		}),
																	"Cita liberada.",
																	"No se pudo liberar la cita.",
																)
															}
														>
															Liberar
														</Menu.Item>
													</Menu.Dropdown>
												</Menu>
											</Table.Td>
										</Table.Tr>
									))}
								</Table.Tbody>
							</Table>
						</Table.ScrollContainer>
					</Box>
				)}

				{/* Action Panel */}
				{selectedBooking && (
					<Card className={adminUi.callout} radius="lg" p="md" shadow="none">
						<Stack gap="md">
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
									ID: {selectedBooking.id.slice(0, 8)}… | Slot:{" "}
									{selectedBooking.slot?.slotDate ?? "-"}{" "}
									{selectedBooking.slot?.startTime ?? "--"}
								</Text>
							</Stack>

							<Divider className={adminUi.divider} />

							<Group gap="sm" wrap="wrap">
								<Button
									size="sm"
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

							<Divider className={adminUi.divider} />

							<form
								onSubmit={releaseForm.onSubmit(() => {
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
									/>
									<Button
										type="submit"
										color="red"
										variant="light"
										size="sm"
										loading={isRunning === "booking-release"}
									>
										Liberar cita
									</Button>
								</Group>
							</form>

							<Divider className={adminUi.divider} />

							<form
								onSubmit={reassignForm.onSubmit(() => {
									void runAction(
										"booking-reassign",
										async () =>
											await orpcClient.admin.bookings.reassign({
												id: selectedBooking.id,
												targetStaffUserId:
													reassignForm.values.targetStaffUserId,
											}),
										"Cita reasignada.",
										"No se pudo reasignar la cita.",
									);
								})}
							>
								<Stack gap="md">
									<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
										<Select
											label="Reasignar a"
											size="sm"
											placeholder="Seleccioná funcionario"
											key={reassignForm.key("targetStaffUserId")}
											{...reassignForm.getInputProps("targetStaffUserId")}
											data={staffOptions}
										/>
										<div className="flex items-end gap-2">
											<Button
												variant="light"
												size="sm"
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
												loading={isRunning === "booking-reassign"}
											>
												Reasignar
											</Button>
											<Button
												variant="default"
												size="sm"
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
															await orpcClient.admin.bookings.availabilityCheck(
																{
																	slotId: selectedBooking.slotId,
																	staffUserId:
																		reassignForm.values.targetStaffUserId,
																},
															),
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
						</Stack>
					</Card>
				)}
			</Stack>
		</Card>
	);
}
