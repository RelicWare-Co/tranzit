import {
	Affix,
	Alert,
	Box,
	Button,
	Card,
	LoadingOverlay,
	Transition,
} from "@mantine/core";
import {
	Schedule,
	type ScheduleEventData,
	ScheduleHeader,
	type ScheduleViewLevel,
} from "@mantine/schedule";
import { AlertCircle, CalendarDays, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { orpcClient } from "../../../lib/orpc-client";
import { AdminPageHeader } from "../_shared/-AdminPageHeader";
import { formatDateLocal } from "../_shared/-dates";
import { getErrorMessage } from "../_shared/-errors";
import "./admin-schedule.css";
import { BookingStatsGrid } from "./-BookingStatsGrid";
import { NewBookingModal } from "./-NewBookingModal";
import type {
	BookingKind,
	BookingWithRelations,
	ProcedureType,
	SlotWithCapacity,
	StaffProfile,
} from "./-types";
import { getDateRange, getEventColor, toDateTimeString } from "./-utils";

export function AdminCitasPage() {
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

					const procedureName =
						booking.request?.procedure?.name ||
						booking.request?.procedure?.slug;
					const staffName =
						booking.staff?.name || booking.staff?.email || "Sin asignar";

					return [
						{
							id: booking.id,
							title:
								booking.kind === "administrative"
									? `[Admin] ${staffName}`
									: procedureName
										? `${procedureName} — ${staffName}`
										: staffName,
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

	const scheduleChrome = {
		weekViewProps: {
			classNames: {
				weekView: "admin-schedule-wv",
				weekViewHeader: "admin-schedule-week-head",
			},
			styles: {
				weekView: {
					flex: 1,
					minHeight: 0,
					display: "flex",
					flexDirection: "column",
				},
				weekViewRoot: {
					flex: 1,
					minHeight: 0,
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
				},
				weekViewScrollArea: { flex: 1, minHeight: 0 },
			},
			scrollAreaProps: {
				mah: "100%",
				style: { flex: 1, minHeight: 0 },
			},
		},
		dayViewProps: {
			classNames: {
				dayView: "admin-schedule-dv",
			},
			styles: {
				dayView: {
					flex: 1,
					minHeight: 0,
					display: "flex",
					flexDirection: "column",
				},
				dayViewScrollArea: { flex: 1, minHeight: 0 },
			},
			scrollAreaProps: {
				mah: "100%",
				style: { flex: 1, minHeight: 0 },
			},
		},
		monthViewProps: {
			classNames: {
				monthView: "admin-schedule-mv",
			},
			styles: {
				monthView: {
					flex: 1,
					minHeight: 0,
					overflow: "auto",
				},
			},
		},
		yearViewProps: {
			classNames: {
				yearView: "admin-schedule-yv",
			},
			styles: {
				yearView: {
					flex: 1,
					minHeight: 0,
					overflow: "auto",
				},
			},
		},
	} as const;

	return (
		<Box className="admin-citas-calendar-scope flex min-h-0 flex-1 flex-col">
			<AdminPageHeader
				title="Gestión de Citas"
				description="Visualiza y administra las citas en el calendario. Usa los filtros de vista para navegar por día, semana, mes o año."
				actions={
					<Button
						leftSection={<CalendarDays size={18} strokeWidth={1.5} />}
						variant="light"
						color="red"
						size="md"
						className="font-semibold"
						onClick={() => setDate(new Date())}
					>
						Hoy
					</Button>
				}
			/>

			<Card
				p={0}
				withBorder={false}
				className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white shadow-sm"
			>
				<Box className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 sm:px-5">
					<BookingStatsGrid stats={stats} />
				</Box>

				{bookingsError ? (
					<Box className="shrink-0 px-4 py-3 sm:px-5">
						<Alert
							icon={<AlertCircle size={16} />}
							color="red"
							variant="light"
							radius="md"
						>
							{bookingsError}
						</Alert>
					</Box>
				) : null}

				<Box className="shrink-0 px-4 pb-2 pt-3 sm:px-5">
					<ScheduleHeader
						classNames={{
							header: "admin-schedule-toolbar admin-schedule-toolbar--fused",
						}}
					>
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
							aria-label="Anterior"
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
							aria-label="Siguiente"
						/>
						<ScheduleHeader.Today onClick={() => setDate(new Date())} />
						<div style={{ marginInlineStart: "auto" }}>
							<ScheduleHeader.ViewSelect value={view} onChange={setView} />
						</div>
					</ScheduleHeader>
				</Box>

				<Box className="relative flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-5">
					<LoadingOverlay visible={isLoadingEvents} />
					<Schedule
						styles={{
							root: {
								flex: 1,
								minHeight: 0,
								display: "flex",
								flexDirection: "column",
								overflow: "hidden",
							},
							desktopView: {
								flex: 1,
								minHeight: 0,
								display: "flex",
								flexDirection: "column",
								minWidth: 0,
							},
						}}
						radius="md"
						date={date}
						onDateChange={(nextDate) => setDate(new Date(nextDate))}
						view={view}
						onViewChange={setView}
						events={events}
						withEventsDragAndDrop
						onEventDrop={handleEventDrop}
						dayViewProps={{
							startTime: "07:00:00",
							endTime: "18:00:00",
							intervalMinutes: 30,
							withHeader: false,
							...scheduleChrome.dayViewProps,
						}}
						weekViewProps={{
							startTime: "07:00:00",
							endTime: "18:00:00",
							withWeekendDays: false,
							withHeader: false,
							...scheduleChrome.weekViewProps,
						}}
						monthViewProps={{
							withHeader: false,
							...scheduleChrome.monthViewProps,
						}}
						yearViewProps={{
							withHeader: false,
							...scheduleChrome.yearViewProps,
						}}
						locale="es"
					/>
				</Box>
			</Card>

			<Affix position={{ bottom: 24, right: 24 }} zIndex={200}>
				<Transition transition="slide-up" mounted>
					{(transitionStyles) => (
						<Button
							leftSection={<Plus size={18} strokeWidth={1.75} />}
							variant="filled"
							color="red"
							radius="md"
							size="md"
							className="font-semibold shadow-lg shadow-zinc-900/15"
							style={transitionStyles}
							onClick={() => setModalOpen(true)}
						>
							Nueva cita
						</Button>
					)}
				</Transition>
			</Affix>

			<NewBookingModal
				opened={modalOpen}
				onClose={handleModalClose}
				loading={loading}
				error={error}
				success={success}
				bookingKind={bookingKind}
				onBookingKindChange={setBookingKind}
				selectedProcedure={selectedProcedure}
				onProcedureChange={setSelectedProcedure}
				procedureOptions={procedureOptions}
				selectedDate={selectedDate}
				onDateChange={setSelectedDate}
				selectedSlot={selectedSlot}
				onSlotChange={setSelectedSlot}
				slotOptions={slotOptions}
				selectedStaff={selectedStaff}
				onStaffChange={setSelectedStaff}
				staffOptions={staffOptions}
				onSubmit={handleCreateBooking}
			/>
		</Box>
	);
}
