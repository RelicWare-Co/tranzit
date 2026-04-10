import "@mantine/schedule/styles.css";

import {
	Box,
	Button,
	Card,
	Grid,
	Group,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import {
	Schedule,
	type ScheduleEventData,
	ScheduleHeader,
	type ScheduleViewLevel,
} from "@mantine/schedule";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/citas")({
	component: AdminCitasPage,
});

// Sample appointment data
const sampleAppointments: ScheduleEventData[] = [
	{
		id: 1,
		title: "Renovación de Licencia - María González",
		start: "2026-04-09 09:00:00",
		end: "2026-04-09 09:30:00",
		color: "blue",
	},
	{
		id: 2,
		title: "Traspaso de Propiedad - Carlos Rodríguez",
		start: "2026-04-09 10:00:00",
		end: "2026-04-09 11:00:00",
		color: "green",
	},
	{
		id: 3,
		title: "Matrícula Inicial - Ana Patricia",
		start: "2026-04-09 11:30:00",
		end: "2026-04-09 12:00:00",
		color: "violet",
	},
	{
		id: 4,
		title: "Certificado de Tradición - Juan Pérez",
		start: "2026-04-09 14:00:00",
		end: "2026-04-09 15:00:00",
		color: "orange",
	},
	{
		id: 5,
		title: "Renovación de Licencia - Pedro Gómez",
		start: "2026-04-10 09:30:00",
		end: "2026-04-10 10:00:00",
		color: "blue",
	},
	{
		id: 6,
		title: "Duplicado de Licencia - Laura Martínez",
		start: "2026-04-10 11:00:00",
		end: "2026-04-10 11:30:00",
		color: "cyan",
	},
];

function AdminCitasPage() {
	const [view, setView] = useState<ScheduleViewLevel>("week");
	const [date, setDate] = useState<string>("2026-04-09");
	const [events, setEvents] = useState<ScheduleEventData[]>(sampleAppointments);

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

	return (
		<Stack gap="xl">
			{/* Header Section */}
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
				>
					Nueva Cita
				</Button>
			</Group>

			{/* Schedule Card */}
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
								setDate(d.toISOString().split("T")[0]);
							}}
							aria-label="Previous"
						/>
						<ScheduleHeader.Control interactive={false} miw={200}>
							{new Date(date).toLocaleDateString("es-CO", {
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
								setDate(d.toISOString().split("T")[0]);
							}}
							aria-label="Next"
						/>
						<ScheduleHeader.Today
							onClick={() => setDate(new Date().toISOString().split("T")[0])}
						/>
						<div style={{ marginInlineStart: "auto" }}>
							<ScheduleHeader.ViewSelect value={view} onChange={setView} />
						</div>
					</ScheduleHeader>
				</Box>

				<Schedule
					date={date}
					onDateChange={setDate}
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
			</Card>

			{/* Stats Row */}
			<Grid gap="md">
				<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
					<Card
						radius="xl"
						p="lg"
						bg="white"
						style={{
							border: "1px solid #e5e7eb",
						}}
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
								24
							</Text>
						</Stack>
					</Card>
				</Grid.Col>
				<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
					<Card
						radius="xl"
						p="lg"
						bg="white"
						style={{
							border: "1px solid #e5e7eb",
						}}
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
								18
							</Text>
						</Stack>
					</Card>
				</Grid.Col>
				<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
					<Card
						radius="xl"
						p="lg"
						bg="white"
						style={{
							border: "1px solid #e5e7eb",
						}}
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
								4
							</Text>
						</Stack>
					</Card>
				</Grid.Col>
				<Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
					<Card
						radius="xl"
						p="lg"
						bg="white"
						style={{
							border: "1px solid #e5e7eb",
						}}
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
								2
							</Text>
						</Stack>
					</Card>
				</Grid.Col>
			</Grid>
		</Stack>
	);
}
