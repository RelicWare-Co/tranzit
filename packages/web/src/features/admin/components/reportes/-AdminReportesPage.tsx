import {
	Alert,
	Badge,
	Box,
	Button,
	Card,
	Checkbox,
	Divider,
	Grid,
	Group,
	Loader,
	Menu,
	Paper,
	rem,
	Select,
	Stack,
	Table,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	ArrowDownUp,
	Calendar,
	CheckCircle2,
	Clock,
	FileText,
	Filter,
	MoreVertical,
	RefreshCw,
	Search,
	Users,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { orpcClient } from "#/shared/lib/orpc-client";
import { AdminPageHeader } from "#/features/admin/components/-AdminPageHeader";
import { adminUi } from "#/features/admin/components/-admin-ui";
import { getErrorMessage } from "#/features/admin/components/-errors";

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

function getStatusBadgeProps(status: string) {
	const normalized = status.toLowerCase();
	if (normalized === "confirmed") {
		return { color: "teal", variant: "light" as const };
	}
	if (normalized === "held" || normalized === "pending") {
		return { color: "yellow", variant: "light" as const };
	}
	if (normalized === "cancelled") {
		return { color: "red", variant: "light" as const };
	}
	return { color: "gray", variant: "light" as const };
}

interface SectionCardProps {
	title: string;
	description?: string;
	icon?: React.ReactNode;
	children: React.ReactNode;
	actions?: React.ReactNode;
}

function SectionCard({
	title,
	description,
	icon,
	children,
	actions,
}: SectionCardProps) {
	return (
		<Paper withBorder radius="lg" p="md" shadow="sm">
			<Stack gap="md">
				<Group justify="space-between" wrap="nowrap">
					<Group gap="md" wrap="nowrap">
						{icon && (
							<Box className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-100">
								{icon}
							</Box>
						)}
						<Stack gap={0}>
							<Title
								order={4}
								className="text-base font-semibold text-zinc-900"
							>
								{title}
							</Title>
							{description && (
								<Text size="sm" className="text-zinc-500">
									{description}
								</Text>
							)}
						</Stack>
					</Group>
					{actions && <Group gap="xs">{actions}</Group>}
				</Group>
				{children}
			</Stack>
		</Paper>
	);
}

interface FilterBarProps {
	children: React.ReactNode;
	onApply: () => void;
	onClear: () => void;
	isLoading?: boolean;
}

function FilterBar({ children, onApply, onClear, isLoading }: FilterBarProps) {
	return (
		<Card className={adminUi.callout} radius="lg" p="md" shadow="none">
			<Stack gap="md">
				<Group gap="sm" wrap="nowrap">
					<Filter size={16} className="text-zinc-500" strokeWidth={1.75} />
					<Text fw={600} size="sm" className="text-zinc-900">
						Filtros
					</Text>
				</Group>
				{children}
				<Group justify="flex-end" gap="sm">
					<Button
						variant="default"
						size="sm"
						onClick={onClear}
						leftSection={<XCircle size={14} />}
					>
						Limpiar
					</Button>
					<Button
						size="sm"
						onClick={onApply}
						loading={isLoading}
						leftSection={<Search size={14} />}
					>
						Aplicar filtros
					</Button>
				</Group>
			</Stack>
		</Card>
	);
}

interface ActionPanelProps {
	title: string;
	bookingInfo?: string;
	children: React.ReactNode;
}

function ActionPanel({ title, bookingInfo, children }: ActionPanelProps) {
	return (
		<Card className="bg-zinc-50/80" radius="lg" p="md" shadow="none">
			<Stack gap="md">
				<Stack gap={2}>
					<Title order={5} className="text-sm font-semibold text-zinc-900">
						{title}
					</Title>
					{bookingInfo && (
						<Text size="xs" className="font-mono text-zinc-500">
							{bookingInfo}
						</Text>
					)}
				</Stack>
				<Divider />
				{children}
			</Stack>
		</Card>
	);
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

	const totalBookings = bookingsQuery.data?.length ?? 0;
	const confirmedBookings =
		bookingsQuery.data?.filter((b) => b.status === "confirmed").length ?? 0;
	const heldBookings =
		bookingsQuery.data?.filter((b) => b.status === "held").length ?? 0;
	const activeSeries = seriesQuery.data?.filter((s) => s.isActive).length ?? 0;

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
						size="sm"
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
				<Alert
					color="red"
					variant="light"
					icon={<AlertCircle size={16} />}
					radius="md"
				>
					{globalError}
				</Alert>
			) : null}

			{globalNotice ? (
				<Alert
					color="teal"
					variant="light"
					icon={<CheckCircle2 size={16} />}
					radius="md"
				>
					{globalNotice}
				</Alert>
			) : null}

			{sessionQuery.data ? (
				<Card className={adminUi.callout} radius="lg" p="md" shadow="none">
					<Group gap="md" wrap="nowrap">
						<Box className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-zinc-200">
							<Users size={18} className="text-red-700" strokeWidth={1.75} />
						</Box>
						<Stack gap={0}>
							<Text className="text-sm font-semibold text-zinc-900">
								Sesión activa
							</Text>
							<Text size="sm" className="text-zinc-500">
								{sessionQuery.data.user.email} (
								{sessionQuery.data.user.role ?? "sin rol"})
							</Text>
						</Stack>
					</Group>
				</Card>
			) : null}

			{/* Stats Overview */}
			<Grid gap="md">
				<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
					<Card className={adminUi.surface} radius="lg" p="md" shadow="none">
						<Stack gap="xs">
							<Group gap="xs" wrap="nowrap">
								<Box className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50">
									<CheckCircle2 size={16} className="text-teal-700" />
								</Box>
								<Text
									size="xs"
									className="text-zinc-500 font-medium uppercase tracking-wider"
								>
									Confirmadas
								</Text>
							</Group>
							<Text className="text-2xl font-bold text-zinc-900 font-mono">
								{confirmedBookings}
							</Text>
						</Stack>
					</Card>
				</Grid.Col>
				<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
					<Card className={adminUi.surface} radius="lg" p="md" shadow="none">
						<Stack gap="xs">
							<Group gap="xs" wrap="nowrap">
								<Box className="flex h-8 w-8 items-center justify-center rounded-md bg-yellow-50">
									<Clock size={16} className="text-yellow-700" />
								</Box>
								<Text
									size="xs"
									className="text-zinc-500 font-medium uppercase tracking-wider"
								>
									Pendientes
								</Text>
							</Group>
							<Text className="text-2xl font-bold text-zinc-900 font-mono">
								{heldBookings}
							</Text>
						</Stack>
					</Card>
				</Grid.Col>
				<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
					<Card className={adminUi.surface} radius="lg" p="md" shadow="none">
						<Stack gap="xs">
							<Group gap="xs" wrap="nowrap">
								<Box className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50">
									<Calendar size={16} className="text-blue-700" />
								</Box>
								<Text
									size="xs"
									className="text-zinc-500 font-medium uppercase tracking-wider"
								>
									Total citas
								</Text>
							</Group>
							<Text className="text-2xl font-bold text-zinc-900 font-mono">
								{totalBookings}
							</Text>
						</Stack>
					</Card>
				</Grid.Col>
				<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
					<Card className={adminUi.surface} radius="lg" p="md" shadow="none">
						<Stack gap="xs">
							<Group gap="xs" wrap="nowrap">
								<Box className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-50">
									<FileText size={16} className="text-purple-700" />
								</Box>
								<Text
									size="xs"
									className="text-zinc-500 font-medium uppercase tracking-wider"
								>
									Series activas
								</Text>
							</Group>
							<Text className="text-2xl font-bold text-zinc-900 font-mono">
								{activeSeries}
							</Text>
						</Stack>
					</Card>
				</Grid.Col>
			</Grid>

			{/* Bookings Section */}
			<SectionCard
				title="Citas administrativas"
				description="Gestioná reservas individuales con filtros por fecha, estado y funcionario."
				icon={<Calendar size={20} className="text-red-700" />}
				actions={bookingsQuery.isLoading && <Loader size="sm" />}
			>
				<FilterBar
					onApply={() => setBookingFilters(bookingFiltersDraft)}
					onClear={() => setBookingFiltersDraft(defaultBookingFilters)}
				>
					<Grid gap="md">
						<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
							<TextInput
								label="Desde"
								type="date"
								size="sm"
								value={bookingFiltersDraft.dateFrom}
								onChange={(event) =>
									setBookingFiltersDraft((prev) => ({
										...prev,
										dateFrom: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
							<TextInput
								label="Hasta"
								type="date"
								size="sm"
								value={bookingFiltersDraft.dateTo}
								onChange={(event) =>
									setBookingFiltersDraft((prev) => ({
										...prev,
										dateTo: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
							<TextInput
								label="Estado"
								placeholder="confirmed / held"
								size="sm"
								value={bookingFiltersDraft.status}
								onChange={(event) =>
									setBookingFiltersDraft((prev) => ({
										...prev,
										status: event.currentTarget.value,
									}))
								}
							/>
						</Grid.Col>
						<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
							<Select
								label="Activo"
								size="sm"
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
				</FilterBar>

				{bookingsQuery.isError ? (
					<Alert
						color="red"
						variant="light"
						icon={<AlertCircle size={16} />}
						radius="md"
						mt="md"
					>
						{getErrorMessage(
							bookingsQuery.error,
							"No se pudieron cargar las citas",
						)}
					</Alert>
				) : null}

				{totalBookings === 0 && !bookingsQuery.isLoading ? (
					<Card
						className={`${adminUi.surface} text-center`}
						radius="lg"
						p={48}
						shadow="none"
						mt="md"
					>
						<Stack align="center" gap="md">
							<Box className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 ring-1 ring-zinc-200">
								<Calendar
									size={22}
									className="text-zinc-400"
									strokeWidth={1.5}
								/>
							</Box>
							<Text className="text-base font-semibold text-zinc-900">
								No hay citas para mostrar
							</Text>
							<Text
								size="sm"
								className="max-w-sm leading-relaxed text-zinc-500"
							>
								No se encontraron citas con los filtros actuales. Ajustá los
								filtros o creá una nueva cita.
							</Text>
						</Stack>
					</Card>
				) : (
					<Box mt="md">
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
												{booking.id.slice(0, 8)}...
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
																void runBookingAction(
																	"booking-confirm",
																	async () =>
																		await orpcClient.admin.bookings.confirm({
																			id: booking.id,
																		}),
																	"Cita confirmada.",
																)
															}
														>
															Confirmar
														</Menu.Item>
														<Menu.Item
															leftSection={<ArrowDownUp size={14} />}
															onClick={() => {
																if (!targetStaffUserId) {
																	setGlobalError(
																		"Seleccioná funcionario destino.",
																	);
																	return;
																}
																void runBookingAction(
																	"booking-reassign",
																	async () =>
																		await orpcClient.admin.bookings.reassign({
																			id: booking.id,
																			targetStaffUserId,
																		}),
																	"Cita reasignada.",
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
																void runBookingAction(
																	"booking-release",
																	async () =>
																		await orpcClient.admin.bookings.release({
																			id: booking.id,
																			reason: releaseReason,
																		}),
																	"Cita liberada.",
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

				{selectedBooking && (
					<Box mt="md">
						<ActionPanel
							title="Acciones sobre cita seleccionada"
							bookingInfo={`ID: ${selectedBooking.id.slice(0, 8)}... | Slot: ${selectedBooking.slot?.slotDate ?? "-"} ${selectedBooking.slot?.startTime ?? "--"}`}
						>
							<Group gap="sm" wrap="wrap">
								<Button
									size="sm"
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
									size="sm"
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

							<Divider my="sm" />

							<Grid gap="md">
								<Grid.Col span={{ base: 12, sm: 4 }}>
									<Select
										label="Razón de liberación"
										size="sm"
										value={releaseReason}
										onChange={(value) =>
											setReleaseReason(
												(value as "cancelled" | "expired" | "attended") ??
													"cancelled",
											)
										}
										data={[
											{ value: "cancelled", label: "Cancelada" },
											{ value: "expired", label: "Expirada" },
											{ value: "attended", label: "Atendida" },
										]}
									/>
								</Grid.Col>
								<Grid.Col span="auto">
									<Group align="flex-end" gap="sm" h="100%" mt={rem(28)}>
										<Button
											color="red"
											variant="light"
											size="sm"
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
											Liberar cita
										</Button>
									</Group>
								</Grid.Col>
							</Grid>

							<Divider my="sm" />

							<Grid gap="md">
								<Grid.Col span={{ base: 12, sm: 5 }}>
									<Select
										label="Reasignar a"
										size="sm"
										placeholder="Seleccioná funcionario"
										value={targetStaffUserId}
										onChange={setTargetStaffUserId}
										data={staffOptions}
									/>
								</Grid.Col>
								<Grid.Col span={{ base: 12, sm: 7 }}>
									<Group align="flex-end" gap="sm" h="100%" mt={rem(28)}>
										<Button
											variant="light"
											size="sm"
											loading={isRunning === "booking-reassign-preview"}
											onClick={() => {
												if (!targetStaffUserId) {
													setGlobalError(
														"Seleccioná funcionario destino para previsualizar.",
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
											Preview
										</Button>
										<Button
											size="sm"
											loading={isRunning === "booking-reassign"}
											onClick={() => {
												if (!targetStaffUserId) {
													setGlobalError(
														"Seleccioná funcionario destino para reasignar.",
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
											size="sm"
											loading={isRunning === "booking-availability"}
											onClick={() => {
												if (!targetStaffUserId) {
													setGlobalError(
														"Seleccioná funcionario destino para availability check.",
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
						</ActionPanel>
					</Box>
				)}
			</SectionCard>

			{/* Series Section */}
			<SectionCard
				title="Series de reserva administrativa"
				description="Creá y gestioná reservas recurrentes con reglas RRULE."
				icon={<FileText size={20} className="text-red-700" />}
			>
				{/* Create Series Form */}
				<Card className="bg-zinc-50/80" radius="lg" p="md" shadow="none">
					<Stack gap="md">
						<Title order={5} className="text-sm font-semibold text-zinc-900">
							Nueva serie
						</Title>
						<Grid gap="md">
							<Grid.Col span={{ base: 12, md: 4 }}>
								<TextInput
									label="Regla RRULE"
									size="sm"
									value={createSeriesForm.recurrenceRule}
									onChange={(event) =>
										setCreateSeriesForm((prev) => ({
											...prev,
											recurrenceRule: event.currentTarget.value,
										}))
									}
									placeholder="FREQ=WEEKLY;BYDAY=MO"
								/>
							</Grid.Col>
							<Grid.Col span={{ base: 12, md: 4 }}>
								<TextInput
									label="Fecha para slot base"
									size="sm"
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
							<Grid.Col span={{ base: 12, md: 4 }}>
								<Select
									label="Slot base"
									size="sm"
									placeholder="Seleccioná slot"
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
							<Grid.Col span={{ base: 12, md: 4 }}>
								<Select
									label="Funcionario"
									size="sm"
									placeholder="Seleccioná funcionario"
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
							<Grid.Col span={{ base: 12, md: 4 }}>
								<TextInput
									label="Inicio serie"
									size="sm"
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
							<Grid.Col span={{ base: 12, md: 4 }}>
								<TextInput
									label="Fin serie"
									size="sm"
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
									size="sm"
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
								size="sm"
								loading={isRunning === "create-series"}
								onClick={() => void createSeries()}
								leftSection={<FileText size={14} />}
							>
								Crear serie
							</Button>
						</Group>
					</Stack>
				</Card>

				{/* Series Filter */}
				<Group gap="sm" mt="sm">
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

				{seriesQuery.isLoading ? (
					<Group justify="center" py="md">
						<Loader size="sm" />
					</Group>
				) : null}

				{/* Series Table */}
				{(seriesQuery.data ?? []).length === 0 ? (
					<Card
						className={`${adminUi.surface} text-center`}
						radius="lg"
						p={48}
						shadow="none"
						mt="md"
					>
						<Stack align="center" gap="md">
							<Box className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 ring-1 ring-zinc-200">
								<FileText
									size={22}
									className="text-zinc-400"
									strokeWidth={1.5}
								/>
							</Box>
							<Text className="text-base font-semibold text-zinc-900">
								No hay series de reserva
							</Text>
							<Text
								size="sm"
								className="max-w-sm leading-relaxed text-zinc-500"
							>
								Creá una serie usando el formulario de arriba para generar
								reservas recurrentes automáticamente.
							</Text>
						</Stack>
					</Card>
				) : (
					<Box mt="md">
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
												{series.id.slice(0, 8)}...
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

				{selectedSeries && (
					<Box mt="md">
						<ActionPanel title="Acciones sobre serie seleccionada">
							{/* Update Series */}
							<Stack gap="md">
								<Grid gap="md">
									<Grid.Col span={{ base: 12, sm: 4 }}>
										<Select
											label="Nuevo staff (serie)"
											size="sm"
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
											size="sm"
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
											size="sm"
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
								<Group gap="sm">
									<Button
										size="sm"
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
							</Stack>

							<Divider my="sm" />

							{/* Update from date */}
							<Stack gap="md">
								<Title
									order={6}
									className="text-xs font-semibold text-zinc-700 uppercase tracking-wider"
								>
									Actualizar desde fecha
								</Title>
								<Grid gap="md">
									<Grid.Col span={{ base: 12, sm: 4 }}>
										<TextInput
											label="Effective from"
											size="sm"
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
											size="sm"
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
											size="sm"
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
								<Group gap="sm">
									<Button
										variant="light"
										size="sm"
										loading={isRunning === "series-update-from-date"}
										onClick={() => {
											if (!seriesUpdateFromDateForm.effectiveFrom) {
												setGlobalError(
													"Definí la fecha efectiva para updateFromDate.",
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
							</Stack>

							<Divider my="sm" />

							{/* Move and Release */}
							<Stack gap="md">
								<Title
									order={6}
									className="text-xs font-semibold text-zinc-700 uppercase tracking-wider"
								>
									Mover y liberar
								</Title>
								<Grid gap="md">
									<Grid.Col span={{ base: 12, sm: 4 }}>
										<TextInput
											label="Fecha target slot"
											size="sm"
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
											size="sm"
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
											size="sm"
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
								<Group gap="sm" wrap="wrap">
									<Button
										variant="light"
										size="sm"
										loading={isRunning === "series-move"}
										onClick={() => {
											if (!seriesMoveForm.targetSlotId) {
												setGlobalError(
													"Seleccioná target slot para mover serie.",
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
															asNullableText(
																seriesMoveForm.targetStaffUserId,
															) ?? undefined,
													}),
												"Serie movida.",
											);
										}}
									>
										Mover serie
									</Button>
									<Select
										label="Razón release"
										size="sm"
										value={seriesReleaseReason}
										onChange={(value) =>
											setSeriesReleaseReason(value ?? "cancelled")
										}
										data={[
											{ value: "cancelled", label: "Cancelada" },
											{ value: "expired", label: "Expirada" },
											{ value: "attended", label: "Atendida" },
										]}
									/>
									<Button
										color="red"
										variant="light"
										size="sm"
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
							</Stack>
						</ActionPanel>

						{/* Instances */}
						<Box mt="md">
							<ActionPanel title="Instancias activas de la serie">
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
															{instance.id.slice(0, 8)}...
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

								{selectedInstance && (
									<Box mt="md">
										<ActionPanel title="Acciones sobre instancia">
											<Stack gap="md">
												<Grid gap="md">
													<Grid.Col span={{ base: 12, sm: 6 }}>
														<Select
															label="Nuevo staff"
															size="sm"
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
															size="sm"
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
												<Group gap="sm">
													<Button
														size="sm"
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
																		notes: asNullableText(
																			instanceUpdateForm.notes,
																		),
																	}),
																"Instancia actualizada.",
															)
														}
													>
														Actualizar instancia
													</Button>
												</Group>

												<Divider my="sm" />

												<Grid gap="md">
													<Grid.Col span={{ base: 12, sm: 4 }}>
														<TextInput
															label="Fecha target slot"
															size="sm"
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
															size="sm"
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
															size="sm"
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
												<Group gap="sm" wrap="wrap">
													<Button
														variant="light"
														size="sm"
														loading={isRunning === "instance-move"}
														onClick={() => {
															if (!instanceMoveForm.targetSlotId) {
																setGlobalError(
																	"Seleccioná target slot para mover instancia.",
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

													<Select
														label="Razón release"
														size="sm"
														value={instanceReleaseReason}
														onChange={(value) =>
															setInstanceReleaseReason(value ?? "cancelled")
														}
														data={[
															{ value: "cancelled", label: "Cancelada" },
															{ value: "expired", label: "Expirada" },
															{ value: "attended", label: "Atendida" },
														]}
													/>
													<Button
														color="red"
														variant="light"
														size="sm"
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
											</Stack>
										</ActionPanel>
									</Box>
								)}
							</ActionPanel>
						</Box>
					</Box>
				)}
			</SectionCard>

			{actionResult ? (
				<Alert color="blue" variant="light" radius="md">
					<Title order={6} mb="xs">
						Resultado de la operación
					</Title>
					<Text component="pre" fz="xs" style={{ whiteSpace: "pre-wrap" }}>
						{stringifyJson(actionResult)}
					</Text>
				</Alert>
			) : null}
		</Stack>
	);
}
