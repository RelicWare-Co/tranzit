import {
	ActionIcon,
	Alert,
	Avatar,
	Badge,
	Box,
	Button,
	Card,
	Grid,
	Group,
	Menu,
	Modal,
	NumberInput,
	Progress,
	Select,
	Skeleton,
	Stack,
	Switch,
	Table,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowRightLeft,
	Calendar,
	CheckCircle2,
	Clock,
	Edit3,
	MoreHorizontal,
	Plus,
	Trash2,
	UserCheck,
	Users,
	UserX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "../../lib/auth-client";
import { orpcClient } from "../../lib/orpc-client";

export const Route = createFileRoute("/admin/usuarios")({
	component: UsuariosPage,
});

type StaffProfile = Awaited<
	ReturnType<typeof orpcClient.admin.staff.list>
>[number];
type AdminBooking = Awaited<
	ReturnType<typeof orpcClient.admin.bookings.list>
>[number];

type BookingByStaff = Record<string, AdminBooking[]>;

type CreateStaffPayload = {
	name: string;
	email: string;
	capacity: number;
};

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

function formatDateLocal(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function mapBookingsByStaff(bookings: AdminBooking[]): BookingByStaff {
	return bookings.reduce<BookingByStaff>((acc, booking) => {
		if (!booking.staffUserId) {
			return acc;
		}
		if (!acc[booking.staffUserId]) {
			acc[booking.staffUserId] = [];
		}
		acc[booking.staffUserId].push(booking);
		return acc;
	}, {});
}

function getBookingStatusLabel(status: string): string {
	if (status === "confirmed") return "Confirmada";
	if (status === "held") return "En hold";
	if (status === "cancelled") return "Cancelada";
	if (status === "attended") return "Atendida";
	if (status === "released") return "Liberada";
	return status;
}

function getBookingStatusColor(status: string): string {
	if (status === "confirmed") return "green";
	if (status === "held") return "yellow";
	if (status === "cancelled") return "red";
	if (status === "attended") return "teal";
	if (status === "released") return "gray";
	return "blue";
}

function CapacityIndicator({
	current,
	max,
	isActive,
}: {
	current: number;
	max: number;
	isActive: boolean;
}) {
	const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;

	if (!isActive) {
		return (
			<Box>
				<Text size="xs" c="gray.5" fw={600} mb={4}>
					Inactivo
				</Text>
				<Progress value={0} color="gray.3" size={8} radius="xl" />
			</Box>
		);
	}

	return (
		<Box>
			<Group justify="space-between" mb={4}>
				<Text size="xs" c="gray.7" fw={600}>
					{current} / {max} citas
				</Text>
				<Text size="xs" c={percentage >= 90 ? "red.6" : "teal.6"} fw={700}>
					{Math.round(percentage)}%
				</Text>
			</Group>
			<Progress
				value={percentage}
				color={
					percentage >= 90 ? "red.6" : percentage >= 70 ? "yellow.6" : "teal.6"
				}
				size={8}
				radius="xl"
			/>
		</Box>
	);
}

function StaffCard({
	profile,
	isSelected,
	onClick,
	currentBookings,
}: {
	profile: StaffProfile;
	isSelected: boolean;
	onClick: () => void;
	currentBookings: number;
}) {
	const initials =
		profile.user?.name
			?.split(" ")
			.map((part) => part[0])
			.join("")
			.slice(0, 2)
			.toUpperCase() || "U";

	return (
		<Card
			radius="xl"
			p="lg"
			bg={isSelected ? "#fef2f2" : "white"}
			style={{
				border: isSelected ? "2px solid #e03131" : "1px solid #e5e7eb",
				cursor: "pointer",
			}}
			onClick={onClick}
		>
			<Group align="flex-start" gap="md">
				<Avatar
					size="lg"
					radius="xl"
					bg={profile.isActive ? "#fef2f2" : "#f3f4f6"}
					c={profile.isActive ? "#e03131" : "#9ca3af"}
				>
					{initials}
				</Avatar>
				<Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
					<Group justify="space-between" wrap="nowrap">
						<Text
							fw={700}
							c={profile.isActive ? "#111827" : "gray.5"}
							lineClamp={1}
						>
							{profile.user?.name || "Usuario"}
						</Text>
						{profile.isActive ? (
							<Badge
								color="teal"
								variant="light"
								size="sm"
								leftSection={<CheckCircle2 size={12} />}
							>
								Activo
							</Badge>
						) : (
							<Badge
								color="gray"
								variant="light"
								size="sm"
								leftSection={<UserX size={12} />}
							>
								Inactivo
							</Badge>
						)}
					</Group>
					<Text size="xs" c="gray.5" lineClamp={1}>
						{profile.user?.email}
					</Text>
					<Badge
						color={profile.isAssignable ? "blue" : "gray"}
						variant="light"
						size="sm"
					>
						{profile.isAssignable ? "Recibe citas" : "No asignable"}
					</Badge>
					<CapacityIndicator
						current={currentBookings}
						max={profile.defaultDailyCapacity}
						isActive={profile.isActive && profile.isAssignable}
					/>
				</Stack>
			</Group>
		</Card>
	);
}

function ReassignModal({
	opened,
	onClose,
	staffList,
	sourceStaff,
	sourceBookings,
	onReassign,
}: {
	opened: boolean;
	onClose: () => void;
	staffList: StaffProfile[];
	sourceStaff: StaffProfile | null;
	sourceBookings: AdminBooking[];
	onReassign: (
		targetStaffUserId: string,
		bookingCount: number,
	) => Promise<void>;
}) {
	const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
	const [bookingCount, setBookingCount] = useState<number>(1);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!opened) return;
		setSelectedTarget(null);
		setBookingCount(1);
		setError(null);
	}, [opened]);

	const availableTargets = staffList.filter(
		(staff) =>
			staff.userId !== sourceStaff?.userId &&
			staff.isActive &&
			staff.isAssignable,
	);

	const handleSubmit = async () => {
		if (!selectedTarget || bookingCount < 1) {
			setError("Selecciona el destino y la cantidad de citas a mover.");
			return;
		}

		setLoading(true);
		setError(null);
		try {
			await onReassign(selectedTarget, bookingCount);
			onClose();
		} catch (submitError) {
			setError(getErrorMessage(submitError, "No se pudieron mover las citas."));
		} finally {
			setLoading(false);
		}
	};

	return (
		<Modal
			opened={opened}
			onClose={onClose}
			title="Mover citas"
			size="md"
			radius="xl"
		>
			<Stack gap="lg">
				{error && (
					<Alert color="red" icon={<AlertCircle size={16} />}>
						{error}
					</Alert>
				)}

				{sourceStaff && (
					<Alert
						color="blue"
						variant="light"
						radius="lg"
						icon={<UserCheck size={20} />}
					>
						<Text size="sm" fw={600}>
							Origen: {sourceStaff.user?.name}
						</Text>
						<Text size="xs" c="gray.5">
							{sourceBookings.length} citas activas hoy
						</Text>
					</Alert>
				)}

				<Select
					label="Encargado destino"
					placeholder="Selecciona un encargado"
					data={availableTargets.map((staff) => ({
						value: staff.userId,
						label: staff.user?.name || staff.userId,
					}))}
					value={selectedTarget}
					onChange={setSelectedTarget}
					radius="xl"
					disabled={loading}
				/>

				<NumberInput
					label="Cantidad de citas a mover"
					min={1}
					max={sourceBookings.length}
					value={bookingCount}
					onChange={(value) =>
						setBookingCount(typeof value === "number" ? value : 1)
					}
					radius="xl"
					disabled={loading}
				/>

				<Group justify="flex-end" mt="md">
					<Button
						variant="light"
						color="gray"
						onClick={onClose}
						radius="xl"
						disabled={loading}
					>
						Cancelar
					</Button>
					<Button
						color="red"
						onClick={handleSubmit}
						disabled={!selectedTarget || sourceBookings.length === 0}
						loading={loading}
						radius="xl"
						leftSection={<ArrowRightLeft size={16} />}
					>
						Mover citas
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}

function AddStaffModal({
	opened,
	onClose,
	onCreate,
}: {
	opened: boolean;
	onClose: () => void;
	onCreate: (payload: CreateStaffPayload) => Promise<void>;
}) {
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [capacity, setCapacity] = useState(25);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!opened) return;
		setError(null);
	}, [opened]);

	const handleSubmit = async () => {
		setError(null);
		setIsSubmitting(true);
		try {
			await onCreate({
				name,
				email,
				capacity,
			});
			setEmail("");
			setName("");
			setCapacity(25);
			onClose();
		} catch (submitError) {
			setError(getErrorMessage(submitError, "No se pudo crear el encargado."));
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal
			opened={opened}
			onClose={onClose}
			title="Nuevo encargado"
			size="md"
			radius="xl"
		>
			<Stack gap="lg">
				{error && (
					<Alert color="red" icon={<AlertCircle size={16} />}>
						{error}
					</Alert>
				)}

				<TextInput
					label="Nombre completo"
					placeholder="Ej: María Elena Vargas"
					value={name}
					onChange={(event) => setName(event.currentTarget.value)}
					radius="xl"
					disabled={isSubmitting}
				/>

				<TextInput
					label="Correo electrónico"
					placeholder="ejemplo@simut.gov.co"
					type="email"
					value={email}
					onChange={(event) => setEmail(event.currentTarget.value)}
					radius="xl"
					disabled={isSubmitting}
				/>

				<NumberInput
					label="Capacidad diaria máxima"
					description="Número máximo de citas por día"
					value={capacity}
					onChange={(value) =>
						setCapacity(typeof value === "number" ? value : 25)
					}
					min={1}
					max={50}
					radius="xl"
					disabled={isSubmitting}
				/>

				<Group justify="flex-end" mt="md">
					<Button
						variant="light"
						color="gray"
						onClick={onClose}
						radius="xl"
						disabled={isSubmitting}
					>
						Cancelar
					</Button>
					<Button
						color="green"
						onClick={handleSubmit}
						disabled={!email.trim() || !name.trim()}
						radius="xl"
						loading={isSubmitting}
						leftSection={<Plus size={16} />}
					>
						Crear encargado
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}

function UsuariosPage() {
	const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
	const [staffList, setStaffList] = useState<StaffProfile[]>([]);
	const [bookingsByStaff, setBookingsByStaff] = useState<BookingByStaff>({});
	const [isLoading, setIsLoading] = useState(true);
	const [isUpdating, setIsUpdating] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const [reassignModalOpened, { open: openReassign, close: closeReassign }] =
		useDisclosure(false);
	const [addModalOpened, { open: openAdd, close: closeAdd }] =
		useDisclosure(false);

	const loadData = useCallback(async () => {
		const today = formatDateLocal(new Date());
		const [staff, bookings] = await Promise.all([
			orpcClient.admin.staff.list({}),
			orpcClient.admin.bookings.list({
				isActive: true,
				dateFrom: today,
				dateTo: today,
			}),
		]);

		setStaffList(staff);
		setBookingsByStaff(mapBookingsByStaff(bookings));
		setSelectedStaffId((current) => {
			if (current && staff.some((item) => item.userId === current)) {
				return current;
			}
			return staff[0]?.userId ?? null;
		});
	}, []);

	useEffect(() => {
		let mounted = true;
		setIsLoading(true);
		setError(null);
		void loadData()
			.catch((loadError) => {
				if (!mounted) return;
				setError(
					getErrorMessage(
						loadError,
						"No se pudo cargar la gestión de usuarios.",
					),
				);
			})
			.finally(() => {
				if (mounted) {
					setIsLoading(false);
				}
			});

		return () => {
			mounted = false;
		};
	}, [loadData]);

	const selectedStaff = useMemo(
		() => staffList.find((staff) => staff.userId === selectedStaffId) ?? null,
		[staffList, selectedStaffId],
	);

	const selectedBookings = selectedStaff
		? bookingsByStaff[selectedStaff.userId] || []
		: [];

	const assignableStaff = staffList.filter(
		(staff) => staff.isActive && staff.isAssignable,
	);
	const totalDailyCapacity = assignableStaff.reduce(
		(total, staff) => total + staff.defaultDailyCapacity,
		0,
	);

	const refreshData = async () => {
		setError(null);
		await loadData();
	};

	const handleCreateStaff = async (payload: CreateStaffPayload) => {
		setError(null);
		setNotice(null);

		const createUserResult = await authClient.admin.createUser({
			email: payload.email,
			name: payload.name,
			role: "staff",
		});

		if (createUserResult.error) {
			throw new Error(createUserResult.error.message);
		}

		const createdUserId =
			(createUserResult.data as { user?: { id?: string } } | null)?.user?.id ??
			null;
		if (!createdUserId) {
			throw new Error("No se pudo obtener el usuario creado.");
		}

		await orpcClient.admin.staff.create({
			userId: createdUserId,
			defaultDailyCapacity: payload.capacity,
			isActive: true,
			isAssignable: true,
		});

		await refreshData();
		setNotice("Encargado creado correctamente.");
	};

	const handleToggleStaffState = async (
		staff: StaffProfile,
		field: "isActive" | "isAssignable",
		nextValue: boolean,
	) => {
		setIsUpdating(staff.userId);
		setError(null);
		setNotice(null);
		try {
			await orpcClient.admin.staff.update({
				userId: staff.userId,
				[field]: nextValue,
			});
			await refreshData();
		} catch (updateError) {
			setError(
				getErrorMessage(updateError, "No se pudo actualizar el encargado."),
			);
		} finally {
			setIsUpdating(null);
		}
	};

	const handleRemoveStaff = async (staff: StaffProfile) => {
		if (
			!window.confirm(
				`¿Eliminar perfil operativo de ${staff.user?.name || staff.userId}?`,
			)
		) {
			return;
		}

		setIsUpdating(staff.userId);
		setError(null);
		setNotice(null);
		try {
			await orpcClient.admin.staff.remove({ userId: staff.userId });
			await refreshData();
			setNotice("Perfil operativo eliminado.");
		} catch (removeError) {
			setError(
				getErrorMessage(removeError, "No se pudo eliminar el encargado."),
			);
		} finally {
			setIsUpdating(null);
		}
	};

	const handleReassign = async (
		targetStaffUserId: string,
		bookingCount: number,
	) => {
		if (!selectedStaff) {
			throw new Error("No hay encargado seleccionado.");
		}

		const reassignments = selectedBookings
			.slice(0, bookingCount)
			.map((booking) => ({
				bookingId: booking.id,
				targetStaffUserId,
			}));

		if (reassignments.length === 0) {
			throw new Error("No hay citas para mover.");
		}

		const preview = await orpcClient.admin.bookings.reassignmentsPreview({
			reassignments,
		});
		await orpcClient.admin.bookings.reassignmentsApply({
			reassignments,
			previewToken: preview.previewToken,
			executionMode: "best_effort",
		});

		await refreshData();
		setNotice("Reasignación completada.");
	};

	if (isLoading) {
		return (
			<Stack gap="xl">
				<Skeleton height={40} width={300} radius="xl" mb="xs" />
				<Skeleton height={220} radius="xl" />
			</Stack>
		);
	}

	return (
		<Stack gap="xl">
			<Box>
				<Group justify="space-between" align="flex-start" wrap="nowrap">
					<Box>
						<Title order={1}>Gestión de Encargados</Title>
						<Text size="lg" c="#6b7280" mt="xs">
							Administra auxiliares y su capacidad diaria.
						</Text>
					</Box>
					<Button
						color="green"
						onClick={openAdd}
						radius="xl"
						leftSection={<Plus size={18} />}
					>
						Nuevo encargado
					</Button>
				</Group>
			</Box>

			{error && (
				<Alert color="red" icon={<AlertCircle size={16} />}>
					{error}
				</Alert>
			)}
			{notice && (
				<Alert color="teal" icon={<CheckCircle2 size={16} />}>
					{notice}
				</Alert>
			)}

			{assignableStaff.length > 0 && (
				<Card
					radius="xl"
					p="lg"
					bg="#eff6ff"
					style={{ border: "1px solid #bfdbfe" }}
				>
					<Group gap="md" align="center">
						<Users size={24} color="#2563eb" />
						<Stack gap={2}>
							<Text fw={700} c="#1e40af" size="lg">
								Distribución proporcional activa
							</Text>
							<Text size="sm" c="#3b82f6">
								{assignableStaff.length} encargados activos. Capacidad total:{" "}
								{totalDailyCapacity} citas/día.
							</Text>
						</Stack>
					</Group>
				</Card>
			)}

			{staffList.length === 0 ? (
				<Card
					radius="xl"
					p={60}
					bg="white"
					style={{ border: "1px solid #e5e7eb", textAlign: "center" }}
				>
					<Stack align="center" gap="lg">
						<Users size={36} color="#9ca3af" />
						<Text fw={700}>No hay encargados registrados</Text>
						<Button
							color="red"
							onClick={openAdd}
							radius="xl"
							leftSection={<Plus size={18} />}
						>
							Crear primer encargado
						</Button>
					</Stack>
				</Card>
			) : (
				<Grid gap="xl">
					<Grid.Col span={{ base: 12, md: 5 }}>
						<Stack gap="md">
							{staffList.map((profile) => (
								<StaffCard
									key={profile.userId}
									profile={profile}
									isSelected={selectedStaffId === profile.userId}
									onClick={() => setSelectedStaffId(profile.userId)}
									currentBookings={bookingsByStaff[profile.userId]?.length || 0}
								/>
							))}
						</Stack>
					</Grid.Col>

					<Grid.Col span={{ base: 12, md: 7 }}>
						{selectedStaff ? (
							<Card
								radius="xl"
								p={0}
								bg="white"
								style={{ border: "1px solid #e5e7eb" }}
							>
								<Box p="xl" style={{ borderBottom: "1px solid #e5e7eb" }}>
									<Group
										justify="space-between"
										align="flex-start"
										wrap="nowrap"
									>
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
												<ActionIcon
													variant="light"
													color="gray"
													size="lg"
													radius="xl"
												>
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
														void handleRemoveStaff(selectedStaff);
													}}
													disabled={
														selectedBookings.length > 0 ||
														isUpdating === selectedStaff.userId
													}
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
											disabled={isUpdating === selectedStaff.userId}
											onChange={(event) => {
												void handleToggleStaffState(
													selectedStaff,
													"isActive",
													event.currentTarget.checked,
												);
											}}
										/>
										<Switch
											checked={selectedStaff.isAssignable}
											label="Recibe citas"
											disabled={
												!selectedStaff.isActive ||
												isUpdating === selectedStaff.userId
											}
											onChange={(event) => {
												void handleToggleStaffState(
													selectedStaff,
													"isAssignable",
													event.currentTarget.checked,
												);
											}}
										/>
									</Group>
								</Box>

								<Box p="xl" style={{ borderBottom: "1px solid #e5e7eb" }}>
									<Title order={4} mb="md">
										Capacidad hoy
									</Title>
									<CapacityIndicator
										current={selectedBookings.length}
										max={selectedStaff.defaultDailyCapacity}
										isActive={
											selectedStaff.isActive && selectedStaff.isAssignable
										}
									/>
								</Box>

								<Box p="xl">
									<Group justify="space-between" mb="lg">
										<Title order={4}>Citas activas hoy</Title>
										{selectedBookings.length > 0 && (
											<Button
												variant="light"
												color="blue"
												size="sm"
												radius="xl"
												leftSection={<ArrowRightLeft size={14} />}
												onClick={openReassign}
											>
												Mover citas
											</Button>
										)}
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
										<Table
											highlightOnHover
											verticalSpacing="md"
											horizontalSpacing="md"
										>
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
																	booking.kind === "administrative"
																		? "violet"
																		: "blue"
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
						) : (
							<Card
								radius="xl"
								p={60}
								bg="white"
								style={{ border: "1px solid #e5e7eb", textAlign: "center" }}
							>
								<Stack align="center" gap="lg">
									<UserCheck size={28} color="#9ca3af" />
									<Text size="lg" c="gray.5" fw={500}>
										Selecciona un encargado para ver sus detalles
									</Text>
								</Stack>
							</Card>
						)}
					</Grid.Col>
				</Grid>
			)}

			<ReassignModal
				opened={reassignModalOpened}
				onClose={closeReassign}
				staffList={staffList}
				sourceStaff={selectedStaff}
				sourceBookings={selectedBookings}
				onReassign={handleReassign}
			/>

			<AddStaffModal
				opened={addModalOpened}
				onClose={closeAdd}
				onCreate={handleCreateStaff}
			/>
		</Stack>
	);
}
