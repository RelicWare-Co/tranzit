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
import { adminUi } from "#/features/admin/components/admin-ui";
import { getBookingStatusColor, getBookingStatusLabel } from "./booking-utils";
import { CapacityIndicator } from "./CapacityIndicator";
import type { AdminBooking, StaffProfile } from "./types";

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
	const isActive = selectedStaff.isActive;
	const isAssignable = selectedStaff.isAssignable;

	return (
		<Card
			className={adminUi.surface}
			radius="lg"
			p={0}
			bg="white"
			shadow="none"
		>
			{/* Header Section */}
			<Box p="lg" className="border-b border-zinc-200">
				<Group justify="space-between" align="flex-start" wrap="nowrap">
					<Group gap="md">
						<Avatar
							size="lg"
							radius="lg"
							className={
								isActive
									? "bg-red-50 text-red-700 ring-1 ring-red-100"
									: "bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200"
							}
						>
							{selectedStaff.user?.name
								?.split(" ")
								.map((item) => item[0])
								.join("")
								.slice(0, 2)
								.toUpperCase() || "U"}
						</Avatar>
						<Stack gap={0}>
							<Title
								order={2}
								className="text-lg font-semibold tracking-tight text-zinc-900"
							>
								{selectedStaff.user?.name}
							</Title>
							<Text size="xs" c="gray.5">
								{selectedStaff.user?.email}
							</Text>
						</Stack>
					</Group>

					<Menu position="bottom-end" withArrow>
						<Menu.Target>
							<ActionIcon variant="subtle" color="gray" size="md" radius="md">
								<MoreHorizontal size={18} />
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

				{/* State Toggles */}
				<Group mt="md" gap="md">
					<Switch
						checked={isActive}
						label="Activo"
						size="sm"
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
						checked={isAssignable}
						label="Recibe citas"
						size="sm"
						disabled={!isActive || isStaffUpdating}
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

			{/* Capacity Section */}
			<Box p="lg" className="border-b border-zinc-200">
				<Text
					size="xs"
					fw={600}
					c="gray.5"
					className="uppercase tracking-wider mb-3"
				>
					Capacidad hoy
				</Text>
				<CapacityIndicator
					current={selectedBookings.length}
					max={selectedStaff.defaultDailyCapacity}
					isActive={isActive && isAssignable}
				/>
			</Box>

			{/* Bookings Section */}
			<Box p="lg">
				<Group justify="space-between" mb="md">
					<Text
						size="xs"
						fw={600}
						c="gray.5"
						className="uppercase tracking-wider"
					>
						Citas activas hoy ({selectedBookings.length})
					</Text>
					{selectedBookings.length > 0 ? (
						<Button
							variant="light"
							color="red"
							size="xs"
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
						radius="md"
						icon={<Calendar size={18} />}
					>
						<Text size="sm" c="gray.6">
							No hay citas activas asignadas hoy
						</Text>
					</Alert>
				) : (
					<Table highlightOnHover verticalSpacing="sm" horizontalSpacing="sm">
						<Table.Thead>
							<Table.Tr>
								<Table.Th className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
									ID
								</Table.Th>
								<Table.Th className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
									Tipo
								</Table.Th>
								<Table.Th className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
									Hora
								</Table.Th>
								<Table.Th className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
									Estado
								</Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{selectedBookings.map((booking) => (
								<Table.Tr key={booking.id}>
									<Table.Td>
										<Text fw={600} c="zinc-900" size="sm" className="font-mono">
											{booking.id.slice(0, 8)}
										</Text>
									</Table.Td>
									<Table.Td>
										<Badge
											variant="light"
											color={
												booking.kind === "administrative" ? "gray" : "teal"
											}
											size="sm"
										>
											{booking.kind === "administrative"
												? "Administrativa"
												: "Ciudadano"}
										</Badge>
									</Table.Td>
									<Table.Td>
										<Group gap={4}>
											<Clock size={12} color="#9ca3af" />
											<Text size="sm" fw={500} c="gray.7">
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
			radius="lg"
			p={52}
			shadow="none"
		>
			<Stack align="center" gap="lg">
				<Box className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 ring-1 ring-zinc-200">
					<UserCheck size={22} className="text-zinc-400" strokeWidth={1.5} />
				</Box>
				<Text
					size="sm"
					className="max-w-sm font-medium leading-relaxed text-zinc-500"
				>
					Seleccioná un encargado para ver capacidad y citas del día.
				</Text>
			</Stack>
		</Card>
	);
}
