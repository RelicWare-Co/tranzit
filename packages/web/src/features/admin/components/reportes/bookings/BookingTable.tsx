import { Badge, Box, Button, Card, Menu, Stack, Table, Text } from "@mantine/core";
import {
	ArrowDownUp,
	Calendar,
	CheckCircle2,
	MoreVertical,
	XCircle,
} from "lucide-react";
import { adminUi } from "#/features/admin/components/admin-ui";
import { orpcClient } from "#/shared/lib/orpc-client";

interface Booking {
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
}

interface BookingTableProps {
	bookings: Booking[];
	selectedBookingId: string | null;
	onSelectBooking: (id: string) => void;
	runAction: (
		actionId: string,
		action: () => Promise<unknown>,
		successMessage: string,
		errorFallback: string,
	) => Promise<unknown>;
	releaseReason: "cancelled" | "expired" | "attended";
	reassignTargetStaffId: string;
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

export function BookingTable({
	bookings,
	selectedBookingId,
	onSelectBooking,
	runAction,
	releaseReason,
	reassignTargetStaffId,
}: BookingTableProps) {
	if (bookings.length === 0) {
		return (
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
		);
	}

	return (
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
							<Table.Th className={adminUi.tableHeader}>Acciones</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{bookings.map((booking) => (
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
										onClick={() => onSelectBooking(booking.id)}
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
													if (!reassignTargetStaffId) {
														// Trigger validation visually
														return;
													}
													void runAction(
														"booking-reassign",
														async () =>
															await orpcClient.admin.bookings.reassign({
																id: booking.id,
																targetStaffUserId: reassignTargetStaffId,
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
																reason: releaseReason,
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
	);
}
