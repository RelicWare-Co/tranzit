import {
	Alert,
	Box,
	Button,
	Card,
	Grid,
	Group,
	LoadingOverlay,
	Modal,
	Select,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import {
	Schedule,
	type ScheduleEventData,
	ScheduleHeader,
	type ScheduleViewLevel,
} from "@mantine/schedule";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { orpcClient } from "../../lib/orpc-client";

export const Route = createFileRoute("/admin/citas")({
	component: AdminCitasPage,
});

type BookingKind = "citizen" | "administrative";

type BookingWithRelations = {
	id: string;
	kind: BookingKind;
	status: string;
	isActive: boolean;
	slot: {
		id: string;
		slotDate: string;
		startTime: string;
		endTime: string;
	} | null;
	staff: {
		id: string;
		name: string | null;
		email: string;
	} | null;
};

type StaffProfile = {
	userId: string;
	isActive: boolean;
	isAssignable: boolean;
	user: {
		id: string;
		name: string | null;
		email: string;
		role: string | null;
	} | null;
};

type SlotWithCapacity = {
	id: string;
	slotDate: string;
	startTime: string;
	endTime: string;
	status: string;
	capacityLimit: number | null;
	reservedCount: number;
	remainingCapacity: number | null;
	generatedFrom: string;
};

type ProcedureType = {
	id: string;
	slug: string;
	name: string;
	isActive: boolean;
};

function formatDateLocal(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function withSeconds(time: string): string {
	return time.length === 5 ? `${time}:00` : time;
}

function toDateTimeString(date: string, time: string): string {
	return `${date} ${withSeconds(time)}`;
}

function getDateRange(baseDate: Date, view: ScheduleViewLevel) {
	switch (view) {
		case "day": {
			const value = formatDateLocal(baseDate);
			return { dateFrom: value, dateTo: value };
		}
		case "week": {
			const d = new Date(baseDate);
			const day = d.getDay();
			const diffToMonday = day === 0 ? -6 : 1 - day;
			d.setDate(d.getDate() + diffToMonday);
			const monday = new Date(d);
			const sunday = new Date(d);
			sunday.setDate(monday.getDate() + 6);
			return {
				dateFrom: formatDateLocal(monday),
				dateTo: formatDateLocal(sunday),
			};
		}
		case "month": {
			const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
			const lastDay = new Date(
				baseDate.getFullYear(),
				baseDate.getMonth() + 1,
				0,
			);
			return {
				dateFrom: formatDateLocal(firstDay),
				dateTo: formatDateLocal(lastDay),
			};
		}
		case "year": {
			const firstDay = new Date(baseDate.getFullYear(), 0, 1);
			const lastDay = new Date(baseDate.getFullYear(), 11, 31);
			return {
				dateFrom: formatDateLocal(firstDay),
				dateTo: formatDateLocal(lastDay),
			};
		}
		default: {
			const value = formatDateLocal(baseDate);
			return { dateFrom: value, dateTo: value };
		}
	}
}

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof (error as { message?: unknown }).message === "string"
	) {
		return (error as { message: string }).message;
	}

	return fallback;
}

function getEventColor(booking: BookingWithRelations): string {
	if (booking.status === "cancelled") return "red";
	if (booking.status === "held" || booking.status === "hold") return "orange";
	if (booking.kind === "administrative") return "violet";
	return "blue";
}

function AdminCitasPage() {
	const [view, setView] = useState<ScheduleViewLevel>("week");
	const [date, setDate] = useState<Date>(new Date());
	const [events, setEvents] = useState<ScheduleEventData[]>([]);
	const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
	const [isLoadingEvents, setIsLoadingEvents] = useState(false);
	const [bookingsError, setBookingsError] = useState<string | null>(null);

	const [modalOpen, setModalOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const [selectedDate, setSelectedDate] = useState<Date | null>(null);
	const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
	const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
	const [selectedProcedure, setSelectedProcedure] = useState<string | null>(
		null,
	);
	const [bookingKind, setBookingKind] = useState<BookingKind>("administrative");

	const [staffList, setStaffList] = useState<StaffProfile[]>([]);
	const [slots, setSlots] = useState<SlotWithCapacity[]>([]);
	const [procedures, setProcedures] = useState<ProcedureType[]>([]);

	const loadBookings = useCallback(async () => {
		setIsLoadingEvents(true);
		setBookingsError(null);
		try {
			const { dateFrom, dateTo } = getDateRange(date, view);
			const data = (await orpcClient.admin.bookings.list({
				dateFrom,
				dateTo,
				isActive: true,
			})) as BookingWithRelations[];

			setBookings(data);

			const scheduleEvents: ScheduleEventData[] = data
				.filter((booking) => booking.isActive)
				.flatMap((booking) => {
					if (!booking.slot) {
						return [];
					}

					return [
						{
							id: booking.id,
							title: `${booking.kind === "administrative" ? "[Admin] " : ""}${
								booking.staff?.name || booking.staff?.email || "Sin asignar"
							}`,
							start: toDateTimeString(
								booking.slot.slotDate,
								booking.slot.startTime,
							),
							end: toDateTimeString(
								booking.slot.slotDate,
								booking.slot.endTime,
							),
							color: getEventColor(booking),
							data: booking,
						},
					];
				});

			setEvents(scheduleEvents);
		} catch (loadError) {
			setBookingsError(
				getErrorMessage(
					loadError,
					"No se pudieron cargar las citas. Verifica sesión y permisos.",
				),
			);
			setEvents([]);
			setBookings([]);
		} finally {
			setIsLoadingEvents(false);
		}
	}, [date, view]);

	const loadStaff = useCallback(async () => {
		const data = (await orpcClient.admin.staff.list({
			isActive: true,
		})) as StaffProfile[];
		setStaffList(data);
	}, []);

	const loadSlots = useCallback(async (dateValue: Date) => {
		const dateStr = formatDateLocal(dateValue);
		const response = (await orpcClient.admin.schedule.slots.list({
			date: dateStr,
		})) as { slots: SlotWithCapacity[] };
		setSlots(response.slots ?? []);
	}, []);

	const loadProcedures = useCallback(async () => {
		const data = (await orpcClient.admin.procedures.list({
			isActive: true,
		})) as ProcedureType[];
		setProcedures(data);
	}, []);

	useEffect(() => {
		void loadBookings();
	}, [loadBookings]);

	useEffect(() => {
		if (!modalOpen) return;

		const today = new Date();
		setSelectedDate(today);
		setSelectedSlot(null);
		setSelectedStaff(null);
		setSelectedProcedure(null);
		setBookingKind("administrative");
		setError(null);
		setSuccess(false);

		void loadStaff().catch((loadError) => {
			setError(
				getErrorMessage(
					loadError,
					"No se pudo cargar el listado de funcionarios.",
				),
			);
		});
		void loadProcedures().catch((loadError) => {
			setError(
				getErrorMessage(loadError, "No se pudo cargar el listado de tramites."),
			);
		});
		void loadSlots(today).catch((loadError) => {
			setError(
				getErrorMessage(
					loadError,
					"No se pudieron cargar los horarios disponibles.",
				),
			);
		});
	}, [modalOpen, loadStaff, loadProcedures, loadSlots]);

	useEffect(() => {
		if (!modalOpen || !selectedDate) return;
		setSelectedSlot(null);
		void loadSlots(selectedDate).catch((loadError) => {
			setError(
				getErrorMessage(
					loadError,
					"No se pudieron cargar los horarios disponibles.",
				),
			);
		});
	}, [modalOpen, selectedDate, loadSlots]);

	const resetForm = () => {
		setSelectedDate(null);
		setSelectedSlot(null);
		setSelectedStaff(null);
		setSelectedProcedure(null);
		setBookingKind("administrative");
		setError(null);
		setSuccess(false);
	};

	const handleCreateBooking = async () => {
		if (!selectedSlot || !selectedStaff) {
			setError("Por favor completa fecha, horario y funcionario.");
			return;
		}

		setLoading(true);
		setError(null);
		setSuccess(false);

		try {
			await orpcClient.admin.bookings.create({
				slotId: selectedSlot,
				staffUserId: selectedStaff,
				kind: bookingKind,
			});

			setSuccess(true);
			await loadBookings();

			if (selectedDate) {
				await loadSlots(selectedDate);
			}

			setTimeout(() => {
				setModalOpen(false);
				resetForm();
			}, 1200);
		} catch (createError) {
			setError(
				getErrorMessage(
					createError,
					"No se pudo crear la cita. Valida disponibilidad y permisos.",
				),
			);
		} finally {
			setLoading(false);
		}
	};

	const handleModalClose = () => {
		setModalOpen(false);
		resetForm();
	};

	const handleEventDrop = ({
		eventId,
		newStart,
		newEnd,
	}: {
		eventId: string | number;
		newStart: string;
		newEnd: string;
	}) => {
		setEvents((prev) =>
			prev.map((event) =>
				event.id === eventId
					? { ...event, start: newStart, end: newEnd }
					: event,
			),
		);
	};

	const handleEventClick = (event: ScheduleEventData) => {
		// eslint-disable-next-line no-console
		console.log("Clicked event:", event);
	};

	const availableSlots = useMemo(
		() =>
			slots.filter(
				(slot) =>
					slot.status === "open" &&
					(slot.remainingCapacity === null || slot.remainingCapacity > 0),
			),
		[slots],
	);

	const slotOptions = useMemo(
		() =>
			availableSlots.map((slot) => {
				const capacityLabel =
					slot.remainingCapacity === null
						? "sin límite"
						: `${slot.remainingCapacity} cupos`;

				return {
					value: slot.id,
					label: `${slot.startTime.slice(0, 5)} - ${slot.endTime.slice(0, 5)} (${capacityLabel})`,
				};
			}),
		[availableSlots],
	);

	const staffOptions = useMemo(
		() =>
			staffList
				.filter((staff) => staff.isActive && staff.isAssignable && staff.user)
				.map((staff) => ({
					value: staff.userId,
					label: staff.user?.name || staff.user?.email || staff.userId,
				})),
		[staffList],
	);

	const procedureOptions = useMemo(
		() =>
			procedures.map((procedure) => ({
				value: procedure.id,
				label: procedure.name || procedure.slug,
			})),
		[procedures],
	);

	const todayStr = formatDateLocal(new Date());
	const stats = useMemo(() => {
		const citasHoy = bookings.filter(
			(booking) => booking.isActive && booking.slot?.slotDate === todayStr,
		).length;
		const confirmadas = bookings.filter(
			(booking) => booking.isActive && booking.status === "confirmed",
		).length;
		const pendientes = bookings.filter(
			(booking) =>
				booking.isActive && ["held", "hold"].includes(booking.status),
		).length;
		const canceladas = bookings.filter(
			(booking) => booking.status === "cancelled",
		).length;

		return {
			citasHoy,
			confirmadas,
			pendientes,
			canceladas,
		};
	}, [bookings, todayStr]);

	return (
		<Stack gap="xl">
			<Group justify="space-between" align="center">
				<Box>
					<Title
						order={1}
						c="#111827"
						style={{
							letterSpacing: "-1px",
							fontWeight: 800,
							fontSize: "32px",
						}}
					>
						Gestión de Citas
					</Title>
					<Text size="lg" c="#6b7280" mt="xs">
						Administra las citas programadas y horarios disponibles.
					</Text>
				</Box>
				<Button
					leftSection={<Plus size={18} />}
					variant="filled"
					color="red"
					style={{
						borderRadius: "8px",
						fontWeight: 600,
					}}
					onClick={() => setModalOpen(true)}
				>
					Nueva Cita
				</Button>
			</Group>

			{bookingsError && (
				<Alert icon={<AlertCircle size={16} />} color="red" radius="md">
					{bookingsError}
				</Alert>
			)}

			<Card
				radius="xl"
				p="xl"
				bg="white"
				style={{
					border: "1px solid #e5e7eb",
					boxShadow:
						"0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.025)",
				}}
			>
				<Box mb="md">
					<ScheduleHeader>
						<ScheduleHeader.Previous
							onClick={() => {
								const d = new Date(date);
								switch (view) {
									case "day":
										d.setDate(d.getDate() - 1);
										break;
									case "week":
										d.setDate(d.getDate() - 7);
										break;
									case "month":
										d.setMonth(d.getMonth() - 1);
										break;
									case "year":
										d.setFullYear(d.getFullYear() - 1);
										break;
								}
								setDate(new Date(d));
							}}
							aria-label="Previous"
						/>
						<ScheduleHeader.Control interactive={false} miw={200}>
							{date.toLocaleDateString("es-CO", {
								month: "long",
								year: "numeric",
								day: view === "day" ? "numeric" : undefined,
							})}
						</ScheduleHeader.Control>
						<ScheduleHeader.Next
							onClick={() => {
								const d = new Date(date);
								switch (view) {
									case "day":
										d.setDate(d.getDate() + 1);
										break;
									case "week":
										d.setDate(d.getDate() + 7);
										break;
									case "month":
										d.setMonth(d.getMonth() + 1);
										break;
									case "year":
										d.setFullYear(d.getFullYear() + 1);
										break;
								}
								setDate(new Date(d));
							}}
							aria-label="Next"
						/>
						<ScheduleHeader.Today onClick={() => setDate(new Date())} />
						<div style={{ marginInlineStart: "auto" }}>
							<ScheduleHeader.ViewSelect value={view} onChange={setView} />
						</div>
					</ScheduleHeader>
				</Box>

				<Box pos="relative">
					<LoadingOverlay visible={isLoadingEvents} />
					<Schedule
						date={date}
						onDateChange={(nextDate) => setDate(new Date(nextDate))}
						view={view}
						onViewChange={setView}
						events={events}
						withEventsDragAndDrop
						onEventDrop={handleEventDrop}
						onEventClick={handleEventClick}
						dayViewProps={{
							startTime: "07:00:00",
							endTime: "18:00:00",
							intervalMinutes: 30,
							withHeader: false,
						}}
						weekViewProps={{
							startTime: "07:00:00",
							endTime: "18:00:00",
							withWeekendDays: false,
							withHeader: false,
						}}
						monthViewProps={{
							withHeader: false,
						}}
						yearViewProps={{
							withHeader: false,
						}}
						locale="es"
					/>
				</Box>
			</Card>

			<Grid gap="md">
				<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
					<Card
						radius="xl"
						p="lg"
						bg="white"
						style={{ border: "1px solid #e5e7eb" }}
					>
						<Stack gap="xs">
							<Text size="sm" c="#6b7280" fw={500}>
								Citas Hoy
							</Text>
							<Text
								style={{
									fontSize: "28px",
									fontWeight: 800,
									color: "#111827",
									letterSpacing: "-1px",
								}}
							>
								{stats.citasHoy}
							</Text>
						</Stack>
					</Card>
				</Grid.Col>
				<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
					<Card
						radius="xl"
						p="lg"
						bg="white"
						style={{ border: "1px solid #e5e7eb" }}
					>
						<Stack gap="xs">
							<Text size="sm" c="#6b7280" fw={500}>
								Confirmadas
							</Text>
							<Text
								style={{
									fontSize: "28px",
									fontWeight: 800,
									color: "#16a34a",
									letterSpacing: "-1px",
								}}
							>
								{stats.confirmadas}
							</Text>
						</Stack>
					</Card>
				</Grid.Col>
				<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
					<Card
						radius="xl"
						p="lg"
						bg="white"
						style={{ border: "1px solid #e5e7eb" }}
					>
						<Stack gap="xs">
							<Text size="sm" c="#6b7280" fw={500}>
								Pendientes
							</Text>
							<Text
								style={{
									fontSize: "28px",
									fontWeight: 800,
									color: "#f59e0b",
									letterSpacing: "-1px",
								}}
							>
								{stats.pendientes}
							</Text>
						</Stack>
					</Card>
				</Grid.Col>
				<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
					<Card
						radius="xl"
						p="lg"
						bg="white"
						style={{ border: "1px solid #e5e7eb" }}
					>
						<Stack gap="xs">
							<Text size="sm" c="#6b7280" fw={500}>
								Canceladas
							</Text>
							<Text
								style={{
									fontSize: "28px",
									fontWeight: 800,
									color: "#e03131",
									letterSpacing: "-1px",
								}}
							>
								{stats.canceladas}
							</Text>
						</Stack>
					</Card>
				</Grid.Col>
			</Grid>

			<Modal
				opened={modalOpen}
				onClose={handleModalClose}
				title="Nueva Cita"
				size="lg"
				radius="xl"
				zIndex={1100}
				centered
				overlayProps={{
					backgroundOpacity: 0.55,
					blur: 3,
				}}
				yOffset="10vh"
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
								setBookingKind(
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
							onChange={setSelectedProcedure}
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
									setSelectedDate(value ? new Date(`${value}T00:00:00`) : null);
									return;
								}
								setSelectedDate(value);
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
							onChange={setSelectedSlot}
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
							onChange={setSelectedStaff}
							data={staffOptions}
							searchable
							required
							nothingFoundMessage="No hay funcionarios disponibles"
							comboboxProps={{ zIndex: 1200, withinPortal: true }}
						/>

						<Group justify="flex-end" mt="md">
							<Button variant="default" onClick={handleModalClose}>
								Cancelar
							</Button>
							<Button
								color="red"
								onClick={handleCreateBooking}
								loading={loading}
							>
								Crear Cita
							</Button>
						</Group>
					</Stack>
				</Box>
			</Modal>
		</Stack>
	);
}
