import {
	Button,
	Checkbox,
	Grid,
	Group,
	Loader,
	Paper,
	Select,
	Stack,
	Table,
	Text,
	Textarea,
	TextInput,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { orpcClient } from "../../../lib/orpc-client";
import { AdminPageHeader } from "../_shared/-AdminPageHeader";
import { getErrorMessage } from "../_shared/-errors";

const SESSION_QUERY_KEY = ["admin", "reportes", "session"] as const;
const STAFF_QUERY_KEY = ["admin", "reportes", "staff"] as const;

type BookingFilters = {
	dateFrom: string;
	dateTo: string;
	status: string;
	isActive: "all" | "true" | "false";
};

const defaultBookingFilters: BookingFilters = {
	dateFrom: "",
	dateTo: "",
	status: "",
	isActive: "true",
};

type ReservationSeriesFilters = {
	isActive: "all" | "true" | "false";
};

const defaultSeriesFilters: ReservationSeriesFilters = {
	isActive: "true",
};

async function fetchStaff() {
	return await orpcClient.admin.staff.list({});
}

async function fetchBookings(filters: BookingFilters) {
	const payload: Parameters<typeof orpcClient.admin.bookings.list>[0] = {};
	if (filters.dateFrom) payload.dateFrom = filters.dateFrom;
	if (filters.dateTo) payload.dateTo = filters.dateTo;
	if (filters.status) payload.status = filters.status;
	if (filters.isActive !== "all") {
		payload.isActive = filters.isActive === "true";
	}

	return await orpcClient.admin.bookings.list(payload);
}

async function fetchSeries(filters: ReservationSeriesFilters) {
	const payload: Parameters<typeof orpcClient.admin.reservationSeries.list>[0] =
		{};
	if (filters.isActive !== "all") {
		payload.isActive = filters.isActive;
	}
	return await orpcClient.admin.reservationSeries.list(payload);
}

type ReservationInstance = {
	id: string;
	slotId: string;
	staffUserId: string | null;
	status: string;
	isActive: boolean;
	notes: string | null;
	slot?: {
		slotDate?: string;
		startTime?: string;
		endTime?: string;
	} | null;
};

function isReservationInstance(value: unknown): value is ReservationInstance {
	if (!value || typeof value !== "object") return false;
	const instance = value as Record<string, unknown>;
	return (
		typeof instance.id === "string" &&
		typeof instance.slotId === "string" &&
		typeof instance.status === "string" &&
		typeof instance.isActive === "boolean"
	);
}

function stringifyJson(value: unknown) {
	return JSON.stringify(value, null, 2);
}

function asNullableText(value: string): string | null {
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

export function AdminReportesPage() {
	const queryClient = useQueryClient();

	const [globalError, setGlobalError] = useState<string | null>(null);
	const [globalNotice, setGlobalNotice] = useState<string | null>(null);
	const [actionResult, setActionResult] = useState<unknown | null>(null);
	const [isRunning, setIsRunning] = useState<string | null>(null);

	const [bookingFiltersDraft, setBookingFiltersDraft] =
		useState<BookingFilters>(defaultBookingFilters);
	const [bookingFilters, setBookingFilters] = useState<BookingFilters>(
		defaultBookingFilters,
	);

	const [seriesFilters, setSeriesFilters] =
		useState<ReservationSeriesFilters>(defaultSeriesFilters);

	const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
		null,
	);
	const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
	const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
		null,
	);

	const [releaseReason, setReleaseReason] = useState<
		"cancelled" | "expired" | "attended"
	>("cancelled");
	const [targetStaffUserId, setTargetStaffUserId] = useState<string | null>(
		null,
	);

	const [createSeriesForm, setCreateSeriesForm] = useState({
		recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
		slotDate: "",
		slotId: "",
		staffUserId: "",
		startDate: "",
		endDate: "",
		notes: "",
	});

	const [seriesUpdateForm, setSeriesUpdateForm] = useState({
		staffUserId: "",
		notes: "",
		force: false,
	});

	const [seriesUpdateFromDateForm, setSeriesUpdateFromDateForm] = useState({
		effectiveFrom: "",
		staffUserId: "",
		notes: "",
	});

	const [seriesMoveForm, setSeriesMoveForm] = useState({
		slotDate: "",
		targetSlotId: "",
		targetStaffUserId: "",
	});
	const [seriesReleaseReason, setSeriesReleaseReason] = useState("cancelled");

	const [instanceUpdateForm, setInstanceUpdateForm] = useState({
		staffUserId: "",
		notes: "",
	});

	const [instanceMoveForm, setInstanceMoveForm] = useState({
		slotDate: "",
		targetSlotId: "",
		targetStaffUserId: "",
	});
	const [instanceReleaseReason, setInstanceReleaseReason] =
		useState("cancelled");

	const clearAlerts = () => {
		setGlobalError(null);
		setGlobalNotice(null);
	};

	const handleActionError = (error: unknown, fallback: string) => {
		setGlobalError(getErrorMessage(error, fallback));
	};

	const sessionQuery = useQuery({
		queryKey: SESSION_QUERY_KEY,
		queryFn: async () => await orpcClient.session.get(),
	});

	const staffQuery = useQuery({
		queryKey: STAFF_QUERY_KEY,
		queryFn: fetchStaff,
	});

	const bookingsQuery = useQuery({
		queryKey: ["admin", "reportes", "bookings", bookingFilters],
		queryFn: async () => await fetchBookings(bookingFilters),
	});

	const seriesQuery = useQuery({
		queryKey: ["admin", "reportes", "series", seriesFilters],
		queryFn: async () => await fetchSeries(seriesFilters),
	});

	const seriesInstancesQuery = useQuery({
		queryKey: ["admin", "reportes", "series-instances", selectedSeriesId],
		enabled: Boolean(selectedSeriesId),
		queryFn: async () =>
			await orpcClient.admin.reservationSeries.instances({
				id: selectedSeriesId ?? "",
				isActive: true,
			}),
	});

	const createSeriesSlotsQuery = useQuery({
		queryKey: [
			"admin",
			"reportes",
			"create-series-slots",
			createSeriesForm.slotDate,
		],
		enabled: Boolean(createSeriesForm.slotDate),
		queryFn: async () =>
			await orpcClient.admin.schedule.slots.list({
				date: createSeriesForm.slotDate,
			}),
	});

	const seriesMoveSlotsQuery = useQuery({
		queryKey: [
			"admin",
			"reportes",
			"series-move-slots",
			seriesMoveForm.slotDate,
		],
		enabled: Boolean(seriesMoveForm.slotDate),
		queryFn: async () =>
			await orpcClient.admin.schedule.slots.list({
				date: seriesMoveForm.slotDate,
			}),
	});

	const instanceMoveSlotsQuery = useQuery({
		queryKey: [
			"admin",
			"reportes",
			"instance-move-slots",
			instanceMoveForm.slotDate,
		],
		enabled: Boolean(instanceMoveForm.slotDate),
		queryFn: async () =>
			await orpcClient.admin.schedule.slots.list({
				date: instanceMoveForm.slotDate,
			}),
	});

	const refreshAll = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: ["admin", "reportes", "bookings"],
			}),
			queryClient.invalidateQueries({
				queryKey: ["admin", "reportes", "series"],
			}),
			queryClient.invalidateQueries({
				queryKey: ["admin", "reportes", "series-instances", selectedSeriesId],
			}),
		]);
	}, [queryClient, selectedSeriesId]);

	const staffOptions = useMemo(
		() =>
			(staffQuery.data ?? []).map((staff) => ({
				value: staff.userId,
				label: staff.user?.name || staff.user?.email || staff.userId,
			})),
		[staffQuery.data],
	);

	const selectedBooking = useMemo(
		() =>
			(bookingsQuery.data ?? []).find(
				(booking) => booking.id === selectedBookingId,
			) ?? null,
		[bookingsQuery.data, selectedBookingId],
	);

	const selectedSeries = useMemo(
		() =>
			(seriesQuery.data ?? []).find(
				(series) => series.id === selectedSeriesId,
			) ?? null,
		[seriesQuery.data, selectedSeriesId],
	);

	const instances = useMemo(
		() => (seriesInstancesQuery.data ?? []).filter(isReservationInstance),
		[seriesInstancesQuery.data],
	);

	const selectedInstance = useMemo(
		() =>
			instances.find((instance) => instance.id === selectedInstanceId) ?? null,
		[instances, selectedInstanceId],
	);

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

	useEffect(() => {
		if (!bookingsQuery.data?.length) {
			setSelectedBookingId(null);
			return;
		}
		if (
			!selectedBookingId ||
			!bookingsQuery.data.some((booking) => booking.id === selectedBookingId)
		) {
			setSelectedBookingId(bookingsQuery.data[0]?.id ?? null);
		}
	}, [bookingsQuery.data, selectedBookingId]);

	useEffect(() => {
		if (!seriesQuery.data?.length) {
			setSelectedSeriesId(null);
			return;
		}
		if (
			!selectedSeriesId ||
			!seriesQuery.data.some((series) => series.id === selectedSeriesId)
		) {
			setSelectedSeriesId(seriesQuery.data[0]?.id ?? null);
		}
	}, [seriesQuery.data, selectedSeriesId]);

	useEffect(() => {
		if (!instances.length) {
			setSelectedInstanceId(null);
			return;
		}
		if (
			!selectedInstanceId ||
			!instances.some((instance) => instance.id === selectedInstanceId)
		) {
			setSelectedInstanceId(instances[0]?.id ?? null);
		}
	}, [instances, selectedInstanceId]);

	useEffect(() => {
		if (!selectedSeries) {
			setSeriesUpdateForm({ staffUserId: "", notes: "", force: false });
			return;
		}
		setSeriesUpdateForm({
			staffUserId: "",
			notes: selectedSeries.notes ?? "",
			force: false,
		});
	}, [selectedSeries]);

	useEffect(() => {
		if (!selectedInstance) {
			setInstanceUpdateForm({ staffUserId: "", notes: "" });
			return;
		}
		setInstanceUpdateForm({
			staffUserId: selectedInstance.staffUserId ?? "",
			notes: selectedInstance.notes ?? "",
		});
	}, [selectedInstance]);

	const runBookingAction = async (
		actionId: string,
		action: () => Promise<unknown>,
		successMessage: string,
	) => {
		clearAlerts();
		setActionResult(null);
		setIsRunning(actionId);
		try {
			const response = await action();
			setActionResult(response);
			setGlobalNotice(successMessage);
			await refreshAll();
		} catch (error) {
			handleActionError(error, "No se pudo ejecutar la acción sobre la cita.");
		} finally {
			setIsRunning(null);
		}
	};

	const runSeriesAction = async (
		actionId: string,
		action: () => Promise<unknown>,
		successMessage: string,
	) => {
		clearAlerts();
		setActionResult(null);
		setIsRunning(actionId);
		try {
			const response = await action();
			setActionResult(response);
			setGlobalNotice(successMessage);
			await refreshAll();
		} catch (error) {
			handleActionError(error, "No se pudo ejecutar la acción sobre la serie.");
		} finally {
			setIsRunning(null);
		}
	};

	const runInstanceAction = async (
		actionId: string,
		action: () => Promise<unknown>,
		successMessage: string,
	) => {
		clearAlerts();
		setActionResult(null);
		setIsRunning(actionId);
		try {
			const response = await action();
			setActionResult(response);
			setGlobalNotice(successMessage);
			await refreshAll();
		} catch (error) {
			handleActionError(
				error,
				"No se pudo ejecutar la acción sobre la instancia.",
			);
		} finally {
			setIsRunning(null);
		}
	};

	const createSeries = async () => {
		clearAlerts();
		setActionResult(null);
		setIsRunning("create-series");
		try {
			if (
				!createSeriesForm.recurrenceRule ||
				!createSeriesForm.slotId ||
				!createSeriesForm.staffUserId ||
				!createSeriesForm.startDate ||
				!createSeriesForm.endDate
			) {
				throw new Error("Completa regla, slot, staff y rango de fechas.");
			}

			const response = await orpcClient.admin.reservationSeries.create({
				recurrenceRule: createSeriesForm.recurrenceRule,
				slotId: createSeriesForm.slotId,
				staffUserId: createSeriesForm.staffUserId,
				startDate: createSeriesForm.startDate,
				endDate: createSeriesForm.endDate,
				notes: asNullableText(createSeriesForm.notes),
			});

			setActionResult(response);
			setGlobalNotice("Serie creada correctamente.");
			await refreshAll();
		} catch (error) {
			handleActionError(error, "No se pudo crear la serie.");
		} finally {
			setIsRunning(null);
		}
	};

	return (
		<Stack gap="xl">
			<AdminPageHeader
				title="Reportes y operaciones"
				description="Gestión operativa de citas, series de reserva e instancias administrativas."
				actions={
					<Button
						leftSection={<RefreshCw size={16} />}
						onClick={() => void refreshAll()}
						variant="light"
					>
						Refrescar
					</Button>
				}
			/>

			{(sessionQuery.isPending || staffQuery.isPending) &&
			!sessionQuery.data ? (
				<Group justify="center" py="xl">
					<Loader size="sm" />
				</Group>
			) : null}

			{globalError ? (
				<Alert color="red" icon={<AlertCircle size={16} />}>
					{globalError}
				</Alert>
			) : null}

			{globalNotice ? (
				<Alert color="teal" icon={<CheckCircle2 size={16} />}>
					{globalNotice}
				</Alert>
			) : null}

			{sessionQuery.data ? (
				<Alert color="blue" variant="light">
					Sesión: {sessionQuery.data.user.email} (
					{sessionQuery.data.user.role ?? "sin rol"})
				</Alert>
			) : null}

			<Paper withBorder p="md">
				<Stack>
					<Title order={4}>Citas administrativas</Title>

					<Grid>
						<Grid.Col span={{ base: 12, sm: 3 }}>
							<TextInput
								label="Desde"
								type="date"
								value={bookingFiltersDraft.dateFrom}
								onChange={(event) =>
									setBookingFiltersDraft((prev) => ({
										...prev,
										dateFrom: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 3 }}>
							<TextInput
								label="Hasta"
								type="date"
								value={bookingFiltersDraft.dateTo}
								onChange={(event) =>
									setBookingFiltersDraft((prev) => ({
										...prev,
										dateTo: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 3 }}>
							<TextInput
								label="Estado"
								placeholder="confirmed / held"
								value={bookingFiltersDraft.status}
								onChange={(event) =>
									setBookingFiltersDraft((prev) => ({
										...prev,
										status: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 3 }}>
							<Select
								label="Activo"
								value={bookingFiltersDraft.isActive}
								onChange={(value) =>
									setBookingFiltersDraft((prev) => ({
										...prev,
										isActive: (value as BookingFilters["isActive"]) ?? "all",
									}))
								}
								data={[
									{ value: "all", label: "Todos" },
									{ value: "true", label: "Sí" },
									{ value: "false", label: "No" },
								]}
							/>
						</Grid.Col>
					</Grid>

					<Group justify="flex-end">
						<Button
							variant="default"
							onClick={() => setBookingFiltersDraft(defaultBookingFilters)}
						>
							Limpiar
						</Button>
						<Button onClick={() => setBookingFilters(bookingFiltersDraft)}>
							Aplicar filtros
						</Button>
					</Group>

					{bookingsQuery.isLoading ? (
						<Group justify="center" py="md">
							<Loader size="sm" />
						</Group>
					) : null}

					{bookingsQuery.isError ? (
						<Alert color="red" icon={<AlertCircle size={16} />}>
							{getErrorMessage(
								bookingsQuery.error,
								"No se pudieron cargar las citas",
							)}
						</Alert>
					) : null}

					<Table.ScrollContainer minWidth={1000}>
						<Table striped withTableBorder withColumnBorders>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Seleccionar</Table.Th>
									<Table.Th>ID</Table.Th>
									<Table.Th>Fecha</Table.Th>
									<Table.Th>Hora</Table.Th>
									<Table.Th>Estado</Table.Th>
									<Table.Th>Activo</Table.Th>
									<Table.Th>Staff</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{(bookingsQuery.data ?? []).map((booking) => (
									<Table.Tr key={booking.id}>
										<Table.Td>
											<Button
												variant={
													booking.id === selectedBookingId ? "filled" : "light"
												}
												size="xs"
												onClick={() => setSelectedBookingId(booking.id)}
											>
												Usar
											</Button>
										</Table.Td>
										<Table.Td>{booking.id}</Table.Td>
										<Table.Td>{booking.slot?.slotDate ?? "-"}</Table.Td>
										<Table.Td>
											{booking.slot?.startTime ?? "--"} -{" "}
											{booking.slot?.endTime ?? "--"}
										</Table.Td>
										<Table.Td>{booking.status}</Table.Td>
										<Table.Td>{booking.isActive ? "Sí" : "No"}</Table.Td>
										<Table.Td>
											{booking.staff?.name || booking.staff?.email || "-"}
										</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
					</Table.ScrollContainer>

					{selectedBooking ? (
						<Stack>
							<Title order={5}>Acciones sobre cita seleccionada</Title>
							<Text size="sm" c="dimmed">
								ID: {selectedBooking.id} | Slot:{" "}
								{selectedBooking.slot?.slotDate ?? "-"}{" "}
								{selectedBooking.slot?.startTime ?? "--"}
							</Text>
							<Group>
								<Button
									loading={isRunning === "booking-confirm"}
									onClick={() =>
										void runBookingAction(
											"booking-confirm",
											async () =>
												await orpcClient.admin.bookings.confirm({
													id: selectedBooking.id,
												}),
											"Cita confirmada.",
										)
									}
								>
									Confirmar
								</Button>
								<Button
									variant="light"
									loading={isRunning === "booking-capacity"}
									onClick={() =>
										void runBookingAction(
											"booking-capacity",
											async () =>
												await orpcClient.admin.bookings.capacity({
													id: selectedBooking.id,
												}),
											"Capacidad consultada.",
										)
									}
								>
									Ver capacidad
								</Button>
							</Group>

							<Grid>
								<Grid.Col span={{ base: 12, sm: 4 }}>
									<Select
										label="Razón release"
										value={releaseReason}
										onChange={(value) =>
											setReleaseReason(
												(value as "cancelled" | "expired" | "attended") ??
													"cancelled",
											)
										}
										data={[
											{ value: "cancelled", label: "cancelled" },
											{ value: "expired", label: "expired" },
											{ value: "attended", label: "attended" },
										]}
									/>
								</Grid.Col>
								<Grid.Col span={{ base: 12, sm: 8 }}>
									<Group align="flex-end">
										<Button
											color="red"
											loading={isRunning === "booking-release"}
											onClick={() =>
												void runBookingAction(
													"booking-release",
													async () =>
														await orpcClient.admin.bookings.release({
															id: selectedBooking.id,
															reason: releaseReason,
														}),
													"Cita liberada.",
												)
											}
										>
											Release
										</Button>
									</Group>
								</Grid.Col>
							</Grid>

							<Grid>
								<Grid.Col span={{ base: 12, sm: 5 }}>
									<Select
										label="Reasignar a"
										placeholder="Selecciona funcionario"
										value={targetStaffUserId}
										onChange={setTargetStaffUserId}
										data={staffOptions}
									/>
								</Grid.Col>
								<Grid.Col span={{ base: 12, sm: 7 }}>
									<Group align="flex-end">
										<Button
											variant="light"
											loading={isRunning === "booking-reassign-preview"}
											onClick={() => {
												if (!targetStaffUserId) {
													setGlobalError(
														"Selecciona funcionario destino para previsualizar.",
													);
													return;
												}
												void runBookingAction(
													"booking-reassign-preview",
													async () =>
														await orpcClient.admin.bookings.reassignPreview({
															id: selectedBooking.id,
															targetStaffUserId,
														}),
													"Previsualización de reasignación lista.",
												);
											}}
										>
											Preview reasignación
										</Button>
										<Button
											loading={isRunning === "booking-reassign"}
											onClick={() => {
												if (!targetStaffUserId) {
													setGlobalError(
														"Selecciona funcionario destino para reasignar.",
													);
													return;
												}
												void runBookingAction(
													"booking-reassign",
													async () =>
														await orpcClient.admin.bookings.reassign({
															id: selectedBooking.id,
															targetStaffUserId,
														}),
													"Cita reasignada.",
												);
											}}
										>
											Reasignar
										</Button>
										<Button
											variant="default"
											loading={isRunning === "booking-availability"}
											onClick={() => {
												if (!targetStaffUserId) {
													setGlobalError(
														"Selecciona funcionario destino para availability check.",
													);
													return;
												}
												void runBookingAction(
													"booking-availability",
													async () =>
														await orpcClient.admin.bookings.availabilityCheck({
															slotId: selectedBooking.slotId,
															staffUserId: targetStaffUserId,
														}),
													"Availability consultada.",
												);
											}}
										>
											Availability check
										</Button>
									</Group>
								</Grid.Col>
							</Grid>
						</Stack>
					) : (
						<Text c="dimmed" size="sm">
							No hay cita seleccionada.
						</Text>
					)}
				</Stack>
			</Paper>

			<Paper withBorder p="md">
				<Stack>
					<Title order={4}>Series de reserva administrativa</Title>

					<Grid>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<TextInput
								label="Regla RRULE"
								value={createSeriesForm.recurrenceRule}
								onChange={(event) =>
									setCreateSeriesForm((prev) => ({
										...prev,
										recurrenceRule: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<TextInput
								label="Fecha para slot base"
								type="date"
								value={createSeriesForm.slotDate}
								onChange={(event) =>
									setCreateSeriesForm((prev) => ({
										...prev,
										slotDate: event.currentTarget.value,
										slotId: "",
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<Select
								label="Slot base"
								placeholder="Selecciona slot"
								value={createSeriesForm.slotId}
								onChange={(value) =>
									setCreateSeriesForm((prev) => ({
										...prev,
										slotId: value ?? "",
									}))
								}
								data={createSeriesSlotOptions}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<Select
								label="Funcionario"
								placeholder="Selecciona funcionario"
								value={createSeriesForm.staffUserId}
								onChange={(value) =>
									setCreateSeriesForm((prev) => ({
										...prev,
										staffUserId: value ?? "",
									}))
								}
								data={staffOptions}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<TextInput
								label="Inicio serie"
								type="date"
								value={createSeriesForm.startDate}
								onChange={(event) =>
									setCreateSeriesForm((prev) => ({
										...prev,
										startDate: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 4 }}>
							<TextInput
								label="Fin serie"
								type="date"
								value={createSeriesForm.endDate}
								onChange={(event) =>
									setCreateSeriesForm((prev) => ({
										...prev,
										endDate: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={12}>
							<Textarea
								label="Notas"
								minRows={2}
								value={createSeriesForm.notes}
								onChange={(event) =>
									setCreateSeriesForm((prev) => ({
										...prev,
										notes: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
					</Grid>

					<Group justify="flex-end">
						<Button
							loading={isRunning === "create-series"}
							onClick={() => void createSeries()}
						>
							Crear serie
						</Button>
					</Group>

					<Group>
						<Select
							label="Filtrar series activas"
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

					{seriesQuery.isLoading ? (
						<Group justify="center" py="md">
							<Loader size="sm" />
						</Group>
					) : null}

					<Table.ScrollContainer minWidth={960}>
						<Table striped withTableBorder withColumnBorders>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Seleccionar</Table.Th>
									<Table.Th>ID</Table.Th>
									<Table.Th>Activa</Table.Th>
									<Table.Th>Instancias activas</Table.Th>
									<Table.Th>Notas</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{(seriesQuery.data ?? []).map((series) => (
									<Table.Tr key={series.id}>
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
										<Table.Td>{series.id}</Table.Td>
										<Table.Td>{series.isActive ? "Sí" : "No"}</Table.Td>
										<Table.Td>{series.activeInstanceCount ?? "-"}</Table.Td>
										<Table.Td>{series.notes ?? "-"}</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
					</Table.ScrollContainer>

					{selectedSeries ? (
						<Stack>
							<Title order={5}>Acciones sobre serie seleccionada</Title>
							<Grid>
								<Grid.Col span={{ base: 12, sm: 4 }}>
									<Select
										label="Nuevo staff (serie)"
										placeholder="Opcional"
										value={seriesUpdateForm.staffUserId}
										onChange={(value) =>
											setSeriesUpdateForm((prev) => ({
												...prev,
												staffUserId: value ?? "",
											}))
										}
										data={staffOptions}
									/>
								</Grid.Col>
								<Grid.Col span={{ base: 12, sm: 6 }}>
									<TextInput
										label="Notas"
										value={seriesUpdateForm.notes}
										onChange={(event) =>
											setSeriesUpdateForm((prev) => ({
												...prev,
												notes: event.currentTarget.value,
											}))
										}
									/>
								</Grid.Col>
								<Grid.Col span={{ base: 12, sm: 2 }}>
									<Checkbox
										label="Force"
										checked={seriesUpdateForm.force}
										onChange={(event) =>
											setSeriesUpdateForm((prev) => ({
												...prev,
												force: event.currentTarget.checked,
											}))
										}
									/>
								</Grid.Col>
							</Grid>
							<Group>
								<Button
									loading={isRunning === "series-update"}
									onClick={() =>
										void runSeriesAction(
											"series-update",
											async () =>
												await orpcClient.admin.reservationSeries.update({
													id: selectedSeries.id,
													staffUserId:
														asNullableText(seriesUpdateForm.staffUserId) ??
														undefined,
													notes: asNullableText(seriesUpdateForm.notes),
													force: seriesUpdateForm.force,
												}),
											"Serie actualizada.",
										)
									}
								>
									Actualizar serie
								</Button>
							</Group>

							<Grid>
								<Grid.Col span={{ base: 12, sm: 4 }}>
									<TextInput
										label="Effective from"
										type="date"
										value={seriesUpdateFromDateForm.effectiveFrom}
										onChange={(event) =>
											setSeriesUpdateFromDateForm((prev) => ({
												...prev,
												effectiveFrom: event.currentTarget.value,
											}))
										}
									/>
								</Grid.Col>
								<Grid.Col span={{ base: 12, sm: 4 }}>
									<Select
										label="Staff desde fecha"
										placeholder="Opcional"
										value={seriesUpdateFromDateForm.staffUserId}
										onChange={(value) =>
											setSeriesUpdateFromDateForm((prev) => ({
												...prev,
												staffUserId: value ?? "",
											}))
										}
										data={staffOptions}
									/>
								</Grid.Col>
								<Grid.Col span={{ base: 12, sm: 4 }}>
									<TextInput
										label="Notas desde fecha"
										value={seriesUpdateFromDateForm.notes}
										onChange={(event) =>
											setSeriesUpdateFromDateForm((prev) => ({
												...prev,
												notes: event.currentTarget.value,
											}))
										}
									/>
								</Grid.Col>
							</Grid>
							<Group>
								<Button
									variant="light"
									loading={isRunning === "series-update-from-date"}
									onClick={() => {
										if (!seriesUpdateFromDateForm.effectiveFrom) {
											setGlobalError(
												"Define la fecha efectiva para updateFromDate.",
											);
											return;
										}
										void runSeriesAction(
											"series-update-from-date",
											async () =>
												await orpcClient.admin.reservationSeries.updateFromDate(
													{
														id: selectedSeries.id,
														effectiveFrom:
															seriesUpdateFromDateForm.effectiveFrom,
														staffUserId:
															asNullableText(
																seriesUpdateFromDateForm.staffUserId,
															) ?? undefined,
														notes: asNullableText(
															seriesUpdateFromDateForm.notes,
														),
													},
												),
											"Serie actualizada desde fecha.",
										);
									}}
								>
									Update from date
								</Button>
							</Group>

							<Grid>
								<Grid.Col span={{ base: 12, sm: 4 }}>
									<TextInput
										label="Fecha target slot"
										type="date"
										value={seriesMoveForm.slotDate}
										onChange={(event) =>
											setSeriesMoveForm((prev) => ({
												...prev,
												slotDate: event.currentTarget.value,
												targetSlotId: "",
											}))
										}
									/>
								</Grid.Col>
								<Grid.Col span={{ base: 12, sm: 4 }}>
									<Select
										label="Target slot"
										value={seriesMoveForm.targetSlotId}
										onChange={(value) =>
											setSeriesMoveForm((prev) => ({
												...prev,
												targetSlotId: value ?? "",
											}))
										}
										data={seriesMoveSlotOptions}
									/>
								</Grid.Col>
								<Grid.Col span={{ base: 12, sm: 4 }}>
									<Select
										label="Target staff"
										placeholder="Opcional"
										value={seriesMoveForm.targetStaffUserId}
										onChange={(value) =>
											setSeriesMoveForm((prev) => ({
												...prev,
												targetStaffUserId: value ?? "",
											}))
										}
										data={staffOptions}
									/>
								</Grid.Col>
							</Grid>
							<Group>
								<Button
									variant="light"
									loading={isRunning === "series-move"}
									onClick={() => {
										if (!seriesMoveForm.targetSlotId) {
											setGlobalError(
												"Selecciona target slot para mover serie.",
											);
											return;
										}
										void runSeriesAction(
											"series-move",
											async () =>
												await orpcClient.admin.reservationSeries.move({
													id: selectedSeries.id,
													targetSlotId: seriesMoveForm.targetSlotId,
													targetStaffUserId:
														asNullableText(seriesMoveForm.targetStaffUserId) ??
														undefined,
												}),
											"Serie movida.",
										);
									}}
								>
									Mover serie
								</Button>
								<Group align="flex-end">
									<Select
										label="Reason release"
										value={seriesReleaseReason}
										onChange={(value) =>
											setSeriesReleaseReason(value ?? "cancelled")
										}
										data={[
											{ value: "cancelled", label: "cancelled" },
											{ value: "expired", label: "expired" },
											{ value: "attended", label: "attended" },
										]}
									/>
									<Button
										color="red"
										loading={isRunning === "series-release"}
										onClick={() =>
											void runSeriesAction(
												"series-release",
												async () =>
													await orpcClient.admin.reservationSeries.release({
														id: selectedSeries.id,
														reason: seriesReleaseReason,
													}),
												"Serie liberada.",
											)
										}
									>
										Release serie
									</Button>
								</Group>
							</Group>

							<Title order={5}>Instancias activas de la serie</Title>
							{seriesInstancesQuery.isLoading ? (
								<Group justify="center" py="md">
									<Loader size="sm" />
								</Group>
							) : null}

							<Table.ScrollContainer minWidth={960}>
								<Table striped withTableBorder withColumnBorders>
									<Table.Thead>
										<Table.Tr>
											<Table.Th>Seleccionar</Table.Th>
											<Table.Th>ID</Table.Th>
											<Table.Th>Fecha</Table.Th>
											<Table.Th>Hora</Table.Th>
											<Table.Th>Estado</Table.Th>
											<Table.Th>Staff</Table.Th>
										</Table.Tr>
									</Table.Thead>
									<Table.Tbody>
										{instances.map((instance) => (
											<Table.Tr key={instance.id}>
												<Table.Td>
													<Button
														variant={
															instance.id === selectedInstanceId
																? "filled"
																: "light"
														}
														size="xs"
														onClick={() => setSelectedInstanceId(instance.id)}
													>
														Usar
													</Button>
												</Table.Td>
												<Table.Td>{instance.id}</Table.Td>
												<Table.Td>{instance.slot?.slotDate ?? "-"}</Table.Td>
												<Table.Td>
													{instance.slot?.startTime ?? "--"} -{" "}
													{instance.slot?.endTime ?? "--"}
												</Table.Td>
												<Table.Td>{instance.status}</Table.Td>
												<Table.Td>{instance.staffUserId ?? "-"}</Table.Td>
											</Table.Tr>
										))}
									</Table.Tbody>
								</Table>
							</Table.ScrollContainer>

							{selectedInstance ? (
								<Stack>
									<Title order={5}>Acciones sobre instancia</Title>
									<Grid>
										<Grid.Col span={{ base: 12, sm: 6 }}>
											<Select
												label="Nuevo staff"
												placeholder="Opcional"
												value={instanceUpdateForm.staffUserId}
												onChange={(value) =>
													setInstanceUpdateForm((prev) => ({
														...prev,
														staffUserId: value ?? "",
													}))
												}
												data={staffOptions}
											/>
										</Grid.Col>
										<Grid.Col span={{ base: 12, sm: 6 }}>
											<TextInput
												label="Notas"
												value={instanceUpdateForm.notes}
												onChange={(event) =>
													setInstanceUpdateForm((prev) => ({
														...prev,
														notes: event.currentTarget.value,
													}))
												}
											/>
										</Grid.Col>
									</Grid>
									<Group>
										<Button
											loading={isRunning === "instance-update"}
											onClick={() =>
												void runInstanceAction(
													"instance-update",
													async () =>
														await orpcClient.admin.reservations.update({
															bookingId: selectedInstance.id,
															staffUserId:
																asNullableText(
																	instanceUpdateForm.staffUserId,
																) ?? undefined,
															notes: asNullableText(instanceUpdateForm.notes),
														}),
													"Instancia actualizada.",
												)
											}
										>
											Actualizar instancia
										</Button>
									</Group>

									<Grid>
										<Grid.Col span={{ base: 12, sm: 4 }}>
											<TextInput
												label="Fecha target slot"
												type="date"
												value={instanceMoveForm.slotDate}
												onChange={(event) =>
													setInstanceMoveForm((prev) => ({
														...prev,
														slotDate: event.currentTarget.value,
														targetSlotId: "",
													}))
												}
											/>
										</Grid.Col>
										<Grid.Col span={{ base: 12, sm: 4 }}>
											<Select
												label="Target slot"
												value={instanceMoveForm.targetSlotId}
												onChange={(value) =>
													setInstanceMoveForm((prev) => ({
														...prev,
														targetSlotId: value ?? "",
													}))
												}
												data={instanceMoveSlotOptions}
											/>
										</Grid.Col>
										<Grid.Col span={{ base: 12, sm: 4 }}>
											<Select
												label="Target staff"
												placeholder="Opcional"
												value={instanceMoveForm.targetStaffUserId}
												onChange={(value) =>
													setInstanceMoveForm((prev) => ({
														...prev,
														targetStaffUserId: value ?? "",
													}))
												}
												data={staffOptions}
											/>
										</Grid.Col>
									</Grid>
									<Group>
										<Button
											variant="light"
											loading={isRunning === "instance-move"}
											onClick={() => {
												if (!instanceMoveForm.targetSlotId) {
													setGlobalError(
														"Selecciona target slot para mover instancia.",
													);
													return;
												}
												void runInstanceAction(
													"instance-move",
													async () =>
														await orpcClient.admin.reservations.move({
															bookingId: selectedInstance.id,
															targetSlotId: instanceMoveForm.targetSlotId,
															targetStaffUserId:
																asNullableText(
																	instanceMoveForm.targetStaffUserId,
																) ?? undefined,
														}),
													"Instancia movida.",
												);
											}}
										>
											Mover instancia
										</Button>

										<Group align="flex-end">
											<Select
												label="Reason release"
												value={instanceReleaseReason}
												onChange={(value) =>
													setInstanceReleaseReason(value ?? "cancelled")
												}
												data={[
													{ value: "cancelled", label: "cancelled" },
													{ value: "expired", label: "expired" },
													{ value: "attended", label: "attended" },
												]}
											/>
											<Button
												color="red"
												loading={isRunning === "instance-release"}
												onClick={() =>
													void runInstanceAction(
														"instance-release",
														async () =>
															await orpcClient.admin.reservations.release({
																bookingId: selectedInstance.id,
																reason: instanceReleaseReason,
															}),
														"Instancia liberada.",
													)
												}
											>
												Release instancia
											</Button>
										</Group>
									</Group>
								</Stack>
							) : (
								<Text c="dimmed" size="sm">
									No hay instancia seleccionada.
								</Text>
							)}
						</Stack>
					) : (
						<Text c="dimmed" size="sm">
							No hay serie seleccionada.
						</Text>
					)}
				</Stack>
			</Paper>

			{actionResult ? (
				<Alert color="blue" variant="light">
					<Text component="pre" fz="xs" style={{ whiteSpace: "pre-wrap" }}>
						{stringifyJson(actionResult)}
					</Text>
				</Alert>
			) : null}
		</Stack>
	);
}
