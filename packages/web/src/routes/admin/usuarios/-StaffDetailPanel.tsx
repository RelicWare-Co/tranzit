import {
	ActionIcon,
	Alert,
	Avatar,
	Badge,
	Box,
	Button,
	Card,
	Group,
	Menu,
	Stack,
	Switch,
	Table,
	Text,
	Title,
} from "@mantine/core";
import {
	ArrowRightLeft,
	Calendar,
	Clock,
	Edit3,
	MoreHorizontal,
	Trash2,
	UserCheck,
} from "lucide-react";
import { adminUi } from "../_shared/-admin-ui";
import { getBookingStatusColor, getBookingStatusLabel } from "./-booking-utils";
import { CapacityIndicator } from "./-CapacityIndicator";
import type { AdminBooking, StaffProfile } from "./-types";

export function StaffDetailPanel({
	selectedStaff,
	selectedBookings,
	isStaffUpdating,
	onToggleStaffState,
	onRemoveStaff,
	onOpenReassign,
}: {
	selectedStaff: StaffProfile;
	selectedBookings: AdminBooking[];
	isStaffUpdating: boolean;
	onToggleStaffState: (
		staff: StaffProfile,
		field: "isActive" | "isAssignable",
		nextValue: boolean,
	) => void;
	onRemoveStaff: (staff: StaffProfile) => void;
	onOpenReassign: () => void;
}) {
	return (
		<Card
			className={adminUi.surface}
			radius="xl"
			p={0}
			bg="white"
			shadow="none"
		>
			<Box p="xl" className="border-b border-zinc-200/90">
				<Group justify="space-between" align="flex-start" wrap="nowrap">
					<Group gap="md">
						<Avatar
							size="xl"
							radius="xl"
							bg={selectedStaff.isActive ? "#fef2f2" : "#f3f4f6"}
							c={selectedStaff.isActive ? "#e03131" : "#9ca3af"}
						>
							{selectedStaff.user?.name
								?.split(" ")
								.map((item) => item[0])
								.join("")
								.slice(0, 2)
								.toUpperCase() || "U"}
						</Avatar>
						<Stack gap={4}>
							<Title order={2}>{selectedStaff.user?.name}</Title>
							<Text size="sm" c="gray.5">
								{selectedStaff.user?.email}
							</Text>
						</Stack>
					</Group>

					<Menu position="bottom-end">
						<Menu.Target>
							<ActionIcon variant="light" color="gray" size="lg" radius="xl">
								<MoreHorizontal size={20} />
							</ActionIcon>
						</Menu.Target>
						<Menu.Dropdown>
							<Menu.Item leftSection={<Edit3 size={14} />} disabled>
								Editar perfil
							</Menu.Item>
							<Menu.Divider />
							<Menu.Item
								color="red"
								leftSection={<Trash2 size={14} />}
								onClick={() => {
									onRemoveStaff(selectedStaff);
								}}
								disabled={selectedBookings.length > 0 || isStaffUpdating}
							>
								Eliminar
							</Menu.Item>
						</Menu.Dropdown>
					</Menu>
				</Group>

				<Group mt="xl" gap="xl">
					<Switch
						checked={selectedStaff.isActive}
						label="Activo"
						disabled={isStaffUpdating}
						onChange={(event) => {
							onToggleStaffState(
								selectedStaff,
								"isActive",
								event.currentTarget.checked,
							);
						}}
					/>
					<Switch
						checked={selectedStaff.isAssignable}
						label="Recibe citas"
						disabled={!selectedStaff.isActive || isStaffUpdating}
						onChange={(event) => {
							onToggleStaffState(
								selectedStaff,
								"isAssignable",
								event.currentTarget.checked,
							);
						}}
					/>
				</Group>
			</Box>

			<Box p="xl" className="border-b border-zinc-200/90">
				<Title order={4} mb="md" className="text-zinc-900">
					Capacidad hoy
				</Title>
				<CapacityIndicator
					current={selectedBookings.length}
					max={selectedStaff.defaultDailyCapacity}
					isActive={selectedStaff.isActive && selectedStaff.isAssignable}
				/>
			</Box>

			<Box p="xl">
				<Group justify="space-between" mb="lg">
					<Title order={4}>Citas activas hoy</Title>
					{selectedBookings.length > 0 ? (
						<Button
							variant="light"
							color="red"
							size="sm"
							radius="md"
							leftSection={<ArrowRightLeft size={14} strokeWidth={1.75} />}
							className="font-semibold"
							onClick={onOpenReassign}
						>
							Mover citas
						</Button>
					) : null}
				</Group>

				{selectedBookings.length === 0 ? (
					<Alert
						color="gray"
						variant="light"
						radius="lg"
						icon={<Calendar size={20} />}
					>
						<Text size="sm" c="gray.6">
							No hay citas activas asignadas hoy
						</Text>
					</Alert>
				) : (
					<Table highlightOnHover verticalSpacing="md" horizontalSpacing="md">
						<Table.Thead>
							<Table.Tr>
								<Table.Th>ID</Table.Th>
								<Table.Th>Tipo</Table.Th>
								<Table.Th>Hora</Table.Th>
								<Table.Th>Estado</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{selectedBookings.map((booking) => (
								<Table.Tr key={booking.id}>
									<Table.Td>
										<Text fw={600} c="#111827" size="sm">
											{booking.id.slice(0, 8)}
										</Text>
									</Table.Td>
									<Table.Td>
										<Badge
											variant="light"
											color={
												booking.kind === "administrative" ? "gray" : "teal"
											}
										>
											{booking.kind === "administrative"
												? "Administrativa"
												: "Ciudadano"}
										</Badge>
									</Table.Td>
									<Table.Td>
										<Group gap={6}>
											<Clock size={14} color="#9ca3af" />
											<Text size="sm" fw={600} c="gray.7">
												{booking.slot
													? `${booking.slot.startTime} - ${booking.slot.endTime}`
													: "Sin slot"}
											</Text>
										</Group>
									</Table.Td>
									<Table.Td>
										<Badge
											color={getBookingStatusColor(booking.status)}
											variant="light"
											size="sm"
										>
											{getBookingStatusLabel(booking.status)}
										</Badge>
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				)}
			</Box>
		</Card>
	);
}

export function StaffDetailEmptyState() {
	return (
		<Card
			className={`${adminUi.surface} text-center`}
			radius="xl"
			p={52}
			shadow="none"
		>
			<Stack align="center" gap="lg">
				<Box className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 ring-1 ring-zinc-200/90">
					<UserCheck size={26} className="text-zinc-500" strokeWidth={1.5} />
				</Box>
				<Text
					size="lg"
					className="max-w-sm font-medium leading-relaxed text-zinc-500"
				>
					Seleccioná un encargado para ver capacidad y citas del día.
				</Text>
			</Stack>
		</Card>
	);
}
