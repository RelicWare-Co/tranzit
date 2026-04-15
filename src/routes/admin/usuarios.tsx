import {
	ActionIcon,
	Alert,
	Avatar,
	Badge,
	Box,
	Button,
	Card,
	Divider,
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
	Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowRightLeft,
	Calendar,
	CheckCircle2,
	ChevronDown,
	Clock,
	Edit3,
	MoreHorizontal,
	Plus,
	Trash2,
	UserCheck,
	Users,
	UserX,
} from "lucide-react";
import { useMemo, useState } from "react";

// Types matching backend schema
interface StaffUser {
	id: string;
	name: string;
	email: string;
	role: string | null;
}

interface StaffProfile {
	userId: string;
	isActive: boolean;
	isAssignable: boolean;
	defaultDailyCapacity: number;
	weeklyAvailability: Record<string, unknown>;
	notes: string | null;
	metadata: Record<string, unknown>;
	createdAt: number;
	updatedAt: number;
	user: StaffUser | null;
}

interface StaffBooking {
	id: string;
	citizenName: string;
	service: string;
	time: string;
	status: "confirmada" | "en_proceso" | "pendiente";
}

// Mock data - replace with actual API calls
const MOCK_STAFF: StaffProfile[] = [
	{
		userId: "staff-1",
		isActive: true,
		isAssignable: true,
		defaultDailyCapacity: 25,
		weeklyAvailability: {},
		notes: null,
		metadata: {},
		createdAt: Date.now(),
		updatedAt: Date.now(),
		user: {
			id: "staff-1",
			name: "María Elena Vargas",
			email: "maria.vargas@simut.gov.co",
			role: "staff",
		},
	},
	{
		userId: "staff-2",
		isActive: true,
		isAssignable: true,
		defaultDailyCapacity: 25,
		weeklyAvailability: {},
		notes: null,
		metadata: {},
		createdAt: Date.now(),
		updatedAt: Date.now(),
		user: {
			id: "staff-2",
			name: "Carlos Andrés Ruiz",
			email: "carlos.ruiz@simut.gov.co",
			role: "staff",
		},
	},
	{
		userId: "staff-3",
		isActive: true,
		isAssignable: false,
		defaultDailyCapacity: 25,
		weeklyAvailability: {},
		notes: "Vacaciones hasta el 20 de abril",
		metadata: {},
		createdAt: Date.now(),
		updatedAt: Date.now(),
		user: {
			id: "staff-3",
			name: "Ana Patricia Morales",
			email: "ana.morales@simut.gov.co",
			role: "staff",
		},
	},
	{
		userId: "staff-4",
		isActive: false,
		isAssignable: false,
		defaultDailyCapacity: 25,
		weeklyAvailability: {},
		notes: "Temporalmente inactivo",
		metadata: {},
		createdAt: Date.now(),
		updatedAt: Date.now(),
		user: {
			id: "staff-4",
			name: "Juan Pablo Ortiz",
			email: "juan.ortiz@simut.gov.co",
			role: "staff",
		},
	},
];

const MOCK_BOOKINGS: Record<string, StaffBooking[]> = {
	"staff-1": [
		{
			id: "b1",
			citizenName: "Laura María Castellanos",
			service: "Renovación de Licencia",
			time: "09:00 AM",
			status: "confirmada",
		},
		{
			id: "b2",
			citizenName: "Pedro José Mendoza",
			service: "Traspaso de Propiedad",
			time: "10:00 AM",
			status: "en_proceso",
		},
		{
			id: "b3",
			citizenName: "Diana Carolina Flores",
			service: "Matrícula Inicial",
			time: "11:00 AM",
			status: "pendiente",
		},
	],
	"staff-2": [
		{
			id: "b4",
			citizenName: "Roberto Carlos Suárez",
			service: "Certificado de Tradición",
			time: "09:30 AM",
			status: "confirmada",
		},
		{
			id: "b5",
			citizenName: "María Fernanda López",
			service: "Renovación de Licencia",
			time: "10:30 AM",
			status: "confirmada",
		},
	],
	"staff-3": [],
	"staff-4": [],
};

export const Route = createFileRoute("/admin/usuarios")({
	component: UsuariosPage,
});

// Capacity Indicator Component
function CapacityIndicator({
	current,
	max,
	isActive,
}: {
	current: number;
	max: number;
	isActive: boolean;
}) {
	const percentage = Math.min((current / max) * 100, 100);

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
				style={{
					transition: "all 300ms cubic-bezier(0.32, 0.72, 0, 1)",
				}}
			/>
		</Box>
	);
}

// Staff Card Component
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
			.map((n) => n[0])
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
				boxShadow: isSelected
					? "0 8px 24px -8px rgba(224, 49, 49, 0.15)"
					: "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.025)",
				cursor: "pointer",
				transition: "all 300ms cubic-bezier(0.32, 0.72, 0, 1)",
				transform: isSelected ? "translateY(-2px)" : "translateY(0)",
			}}
			onClick={onClick}
			onMouseEnter={(e) => {
				if (!isSelected) {
					e.currentTarget.style.boxShadow = "0 8px 24px -8px rgba(0,0,0,0.1)";
					e.currentTarget.style.transform = "translateY(-2px)";
				}
			}}
			onMouseLeave={(e) => {
				if (!isSelected) {
					e.currentTarget.style.boxShadow =
						"0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.025)";
					e.currentTarget.style.transform = "translateY(0)";
				}
			}}
		>
			<Group align="flex-start" gap="md">
				<Avatar
					size="lg"
					radius="xl"
					bg={profile.isActive ? "#fef2f2" : "#f3f4f6"}
					c={profile.isActive ? "#e03131" : "#9ca3af"}
					style={{
						border: profile.isActive
							? "2px solid #e03131"
							: "2px solid #d1d5db",
						fontWeight: 700,
						fontSize: "14px",
					}}
				>
					{initials}
				</Avatar>

				<Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
					<Group justify="space-between" wrap="nowrap">
						<Text
							fw={700}
							c={profile.isActive ? "#111827" : "gray.5"}
							style={{
								fontSize: "15px",
								letterSpacing: "-0.3px",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{profile.user?.name || "Usuario"}
						</Text>
						{profile.isActive ? (
							<Badge
								color="teal"
								variant="light"
								size="sm"
								leftSection={<CheckCircle2 size={12} />}
								style={{
									textTransform: "none",
									fontWeight: 600,
									fontSize: "11px",
								}}
							>
								Activo
							</Badge>
						) : (
							<Badge
								color="gray"
								variant="light"
								size="sm"
								leftSection={<UserX size={12} />}
								style={{
									textTransform: "none",
									fontWeight: 600,
									fontSize: "11px",
								}}
							>
								Inactivo
							</Badge>
						)}
					</Group>

					<Text
						size="xs"
						c="gray.5"
						style={{
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
						}}
					>
						{profile.user?.email}
					</Text>

					<Group gap="xs" mt={4}>
						{profile.isAssignable ? (
							<Badge
								color="blue"
								variant="light"
								size="sm"
								style={{
									textTransform: "none",
									fontWeight: 600,
									fontSize: "10px",
								}}
							>
								Recibe citas
							</Badge>
						) : (
							<Badge
								color="gray"
								variant="light"
								size="sm"
								style={{
									textTransform: "none",
									fontWeight: 600,
									fontSize: "10px",
								}}
							>
								No asignable
							</Badge>
						)}
					</Group>

					<Box mt={8}>
						<CapacityIndicator
							current={currentBookings}
							max={profile.defaultDailyCapacity}
							isActive={profile.isActive && profile.isAssignable}
						/>
					</Box>
				</Stack>
			</Group>
		</Card>
	);
}

// Reassign Modal Component
function ReassignModal({
	opened,
	onClose,
	staffList,
	sourceStaff,
}: {
	opened: boolean;
	onClose: () => void;
	staffList: StaffProfile[];
	sourceStaff: StaffProfile | null;
}) {
	const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
	const [bookingCount, setBookingCount] = useState<number>(1);

	const availableTargets = staffList.filter(
		(s) => s.userId !== sourceStaff?.userId && s.isActive && s.isAssignable,
	);

	const handleReassign = () => {
		// TODO: Call API to reassign bookings
		console.log("Reassign", {
			from: sourceStaff?.userId,
			to: selectedTarget,
			count: bookingCount,
		});
		onClose();
	};

	return (
		<Modal
			opened={opened}
			onClose={onClose}
			title={
				<Group gap="sm">
					<Box
						style={{
							width: 40,
							height: 40,
							borderRadius: "12px",
							backgroundColor: "#fef2f2",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<ArrowRightLeft size={20} color="#e03131" />
					</Box>
					<Title order={3} c="#111827" style={{ fontWeight: 700 }}>
						Mover citas
					</Title>
				</Group>
			}
			size="md"
			radius="xl"
			padding="xl"
			styles={{
				header: {
					backgroundColor: "white",
					borderBottom: "1px solid #e5e7eb",
					padding: "24px 32px",
				},
				body: {
					backgroundColor: "white",
					padding: "24px 32px 32px",
				},
			}}
		>
			<Stack gap="lg">
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
							{MOCK_BOOKINGS[sourceStaff.userId]?.length || 0} citas asignadas
						</Text>
					</Alert>
				)}

				<Select
					label="Encargado destino"
					placeholder="Selecciona un encargado"
					data={availableTargets.map((s) => ({
						value: s.userId,
						label: s.user?.name || "",
					}))}
					value={selectedTarget}
					onChange={setSelectedTarget}
					radius="xl"
					size="md"
					styles={{
						input: {
							fontWeight: 500,
						},
					}}
				/>

				<NumberInput
					label="Cantidad de citas a mover"
					placeholder="1"
					min={1}
					max={sourceStaff ? MOCK_BOOKINGS[sourceStaff.userId]?.length || 0 : 0}
					value={bookingCount}
					onChange={(val) => setBookingCount(typeof val === "number" ? val : 1)}
					radius="xl"
					size="md"
					styles={{
						input: {
							fontWeight: 600,
							textAlign: "center",
						},
					}}
				/>

				<Group justify="flex-end" mt="md">
					<Button variant="light" color="gray" onClick={onClose} radius="xl">
						Cancelar
					</Button>
					<Button
						color="red"
						onClick={handleReassign}
						disabled={!selectedTarget}
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

// Add Staff Modal
function AddStaffModal({
	opened,
	onClose,
}: {
	opened: boolean;
	onClose: () => void;
}) {
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [capacity, setCapacity] = useState(25);

	const handleSubmit = () => {
		// TODO: Call API to create staff
		console.log("Add staff", { email, name, capacity });
		onClose();
	};

	return (
		<Modal
			opened={opened}
			onClose={onClose}
			title={
				<Group gap="sm">
					<Box
						style={{
							width: 40,
							height: 40,
							borderRadius: "12px",
							backgroundColor: "#dcfce7",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Plus size={20} color="#16a34a" />
					</Box>
					<Title order={3} c="#111827" style={{ fontWeight: 700 }}>
						Nuevo encargado
					</Title>
				</Group>
			}
			size="md"
			radius="xl"
			padding="xl"
			styles={{
				header: {
					backgroundColor: "white",
					borderBottom: "1px solid #e5e7eb",
					padding: "24px 32px",
				},
				body: {
					backgroundColor: "white",
					padding: "24px 32px 32px",
				},
			}}
		>
			<Stack gap="lg">
				<TextInput
					label="Nombre completo"
					placeholder="Ej: María Elena Vargas"
					value={name}
					onChange={(e) => setName(e.currentTarget.value)}
					radius="xl"
					size="md"
					styles={{
						input: { fontWeight: 500 },
					}}
				/>

				<TextInput
					label="Correo electrónico"
					placeholder="ejemplo@simut.gov.co"
					type="email"
					value={email}
					onChange={(e) => setEmail(e.currentTarget.value)}
					radius="xl"
					size="md"
					styles={{
						input: { fontWeight: 500 },
					}}
				/>

				<NumberInput
					label="Capacidad diaria máxima"
					description="Número máximo de citas por día (por defecto 25)"
					value={capacity}
					onChange={(val) => setCapacity(typeof val === "number" ? val : 25)}
					min={1}
					max={50}
					radius="xl"
					size="md"
					styles={{
						input: { fontWeight: 600, textAlign: "center" },
					}}
				/>

				<Group justify="flex-end" mt="md">
					<Button variant="light" color="gray" onClick={onClose} radius="xl">
						Cancelar
					</Button>
					<Button
						color="green"
						onClick={handleSubmit}
						disabled={!email || !name}
						radius="xl"
						leftSection={<Plus size={16} />}
					>
						Crear encargado
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}

// Main Page Component
function UsuariosPage() {
	const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
	const [reassignModalOpened, { open: openReassign, close: closeReassign }] =
		useDisclosure(false);
	const [addModalOpened, { open: openAdd, close: closeAdd }] =
		useDisclosure(false);

	// Local state for staff list (to handle toggle updates optimistically)
	const [staffList, setStaffList] = useState<StaffProfile[]>(MOCK_STAFF);
	const [isUpdating, setIsUpdating] = useState<string | null>(null);

	// TODO: Replace with actual API calls using @orpc/tanstack-query
	const isLoading = false;

	const selectedStaff = useMemo(
		() => staffList.find((s) => s.userId === selectedStaffId) || null,
		[staffList, selectedStaffId],
	);

	const selectedBookings = selectedStaff
		? MOCK_BOOKINGS[selectedStaff.userId] || []
		: [];

	// Distribution calculation
	const assignableStaff = staffList.filter((s) => s.isActive && s.isAssignable);
	const distributionRatio =
		assignableStaff.length > 0 ? assignableStaff.length : 1;

	if (isLoading) {
		return (
			<Stack gap="xl">
				<Box>
					<Skeleton height={40} width={300} radius="xl" mb="xs" />
					<Skeleton height={20} width={400} radius="xl" />
				</Box>
				<Grid gap="xl">
					<Grid.Col span={{ base: 12, md: 5 }}>
						<Stack gap="md">
							{[1, 2, 3, 4].map((i) => (
								<Skeleton key={i} height={140} radius="xl" />
							))}
						</Stack>
					</Grid.Col>
					<Grid.Col span={{ base: 12, md: 7 }}>
						<Skeleton height={400} radius="xl" />
					</Grid.Col>
				</Grid>
			</Stack>
		);
	}

	return (
		<Stack gap="xl">
			{/* Header */}
			<Box>
				<Group justify="space-between" align="flex-start" wrap="nowrap">
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
							Gestión de Encargados
						</Title>
						<Text size="lg" c="#6b7280" mt="xs">
							Administra los auxiliares que reciben citas. Máximo 25 citas por
							día cada uno.
						</Text>
					</Box>
					<Button
						color="green"
						onClick={openAdd}
						radius="xl"
						size="md"
						leftSection={<Plus size={18} />}
						style={{
							fontWeight: 600,
							boxShadow: "0 4px 14px 0 rgba(22, 163, 74, 0.25)",
						}}
					>
						Nuevo encargado
					</Button>
				</Group>
			</Box>

			{/* Distribution Info */}
			{assignableStaff.length > 0 && (
				<Card
					radius="xl"
					p="lg"
					bg="#eff6ff"
					style={{
						border: "1px solid #bfdbfe",
					}}
				>
					<Group gap="md" align="center">
						<Box
							style={{
								width: 48,
								height: 48,
								borderRadius: "16px",
								backgroundColor: "white",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								boxShadow: "0 2px 8px rgba(37, 99, 235, 0.15)",
							}}
						>
							<Users size={24} color="#2563eb" />
						</Box>
						<Stack gap={2}>
							<Text fw={700} c="#1e40af" size="lg">
								Distribución proporcional activa
							</Text>
							<Text size="sm" c="#3b82f6">
								{assignableStaff.length} encargados activos: cada uno recibe{" "}
								<strong>1 de cada {distributionRatio} citas</strong>. Capacidad
								total: {assignableStaff.length * 25} citas/día.
							</Text>
						</Stack>
					</Group>
				</Card>
			)}

			{/* Empty State */}
			{staffList.length === 0 && (
				<Card
					radius="xl"
					p={60}
					bg="white"
					style={{
						border: "1px solid #e5e7eb",
						textAlign: "center",
					}}
				>
					<Stack align="center" gap="lg">
						<Box
							style={{
								width: 80,
								height: 80,
								borderRadius: "24px",
								backgroundColor: "#f3f4f6",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Users size={36} color="#9ca3af" />
						</Box>
						<Stack gap="xs">
							<Text fw={700} c="#111827" size="xl">
								No hay encargados registrados
							</Text>
							<Text size="md" c="gray.5">
								Crea encargados para comenzar a recibir citas
							</Text>
						</Stack>
						<Button
							color="red"
							onClick={openAdd}
							radius="xl"
							size="md"
							leftSection={<Plus size={18} />}
						>
							Crear primer encargado
						</Button>
					</Stack>
				</Card>
			)}

			{/* Main Content Grid */}
			{staffList.length > 0 && (
				<Grid gap="xl">
					{/* Staff List */}
					<Grid.Col span={{ base: 12, md: 5 }}>
						<Stack gap="md">
							{staffList.map((profile) => (
								<StaffCard
									key={profile.userId}
									profile={profile}
									isSelected={selectedStaffId === profile.userId}
									onClick={() => setSelectedStaffId(profile.userId)}
									currentBookings={MOCK_BOOKINGS[profile.userId]?.length || 0}
								/>
							))}
						</Stack>
					</Grid.Col>

					{/* Staff Detail */}
					<Grid.Col span={{ base: 12, md: 7 }}>
						{selectedStaff ? (
							<Card
								radius="xl"
								p={0}
								bg="white"
								style={{
									border: "1px solid #e5e7eb",
									boxShadow:
										"0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.025)",
									height: "fit-content",
								}}
							>
								{/* Header */}
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
												style={{
													border: selectedStaff.isActive
														? "3px solid #e03131"
														: "3px solid #d1d5db",
													fontWeight: 700,
													fontSize: "18px",
												}}
											>
												{selectedStaff.user?.name
													?.split(" ")
													.map((n) => n[0])
													.join("")
													.slice(0, 2)
													.toUpperCase() || "U"}
											</Avatar>
											<Stack gap={4}>
												<Title
													order={2}
													c="#111827"
													style={{
														fontWeight: 800,
														fontSize: "22px",
														letterSpacing: "-0.5px",
													}}
												>
													{selectedStaff.user?.name}
												</Title>
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
												<Menu.Item
													leftSection={<Edit3 size={14} />}
													onClick={() => {}}
												>
													Editar perfil
												</Menu.Item>
												<Menu.Divider />
												<Menu.Item
													color="red"
													leftSection={<Trash2 size={14} />}
													onClick={() => {}}
													disabled={
														MOCK_BOOKINGS[selectedStaff.userId]?.length > 0
													}
												>
													Eliminar
												</Menu.Item>
											</Menu.Dropdown>
										</Menu>
									</Group>

									{/* Settings Row */}
									<Group mt="xl" gap="xl">
										<Group gap="sm">
											<Switch
												checked={selectedStaff.isActive}
												label="Activo"
												size="md"
												disabled={isUpdating === selectedStaff.userId}
												onChange={(event) => {
													const newActive = event.currentTarget.checked;
													setIsUpdating(selectedStaff.userId);

													// Optimistic update
													setStaffList((prev) =>
														prev.map((s) =>
															s.userId === selectedStaff.userId
																? {
																		...s,
																		isActive: newActive,
																		// If deactivating, also disable assignable
																		isAssignable: newActive
																			? s.isAssignable
																			: false,
																	}
																: s,
														),
													);

													// TODO: Call API to update staff status
													console.log("Update staff active:", {
														userId: selectedStaff.userId,
														isActive: newActive,
													});

													// Simulate API delay
													setTimeout(() => {
														setIsUpdating(null);
													}, 500);
												}}
												styles={{
													track: {
														"&:checked": {
															backgroundColor: "#10b981",
														},
													},
												}}
											/>
											{isUpdating === selectedStaff.userId && (
												<Text size="xs" c="gray.5" fs="italic">
													Actualizando...
												</Text>
											)}
										</Group>
										<Group gap="sm">
											<Switch
												checked={selectedStaff.isAssignable}
												label="Recibe citas"
												size="md"
												disabled={
													!selectedStaff.isActive ||
													isUpdating === selectedStaff.userId
												}
												onChange={(event) => {
													const newAssignable = event.currentTarget.checked;
													setIsUpdating(selectedStaff.userId);

													// Optimistic update
													setStaffList((prev) =>
														prev.map((s) =>
															s.userId === selectedStaff.userId
																? { ...s, isAssignable: newAssignable }
																: s,
														),
													);

													// TODO: Call API to update staff assignable
													console.log("Update staff assignable:", {
														userId: selectedStaff.userId,
														isAssignable: newAssignable,
													});

													// Simulate API delay
													setTimeout(() => {
														setIsUpdating(null);
													}, 500);
												}}
												styles={{
													track: {
														"&:checked": {
															backgroundColor: "#2563eb",
														},
													},
												}}
											/>
										</Group>
									</Group>
								</Box>

								{/* Stats */}
								<Box p="xl" style={{ borderBottom: "1px solid #e5e7eb" }}>
									<Title
										order={4}
										c="#111827"
										mb="md"
										style={{ fontWeight: 700 }}
									>
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

								{/* Bookings List */}
								<Box p="xl">
									<Group justify="space-between" mb="lg">
										<Title order={4} c="#111827" style={{ fontWeight: 700 }}>
											Citas asignadas hoy
										</Title>
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
												No hay citas asignadas hoy
											</Text>
										</Alert>
									) : (
										<Table
											highlightOnHover
											verticalSpacing="md"
											horizontalSpacing="md"
											styles={{
												tbody: {
													tr: {
														borderBottom: "1px solid #f3f4f6",
													},
												},
											}}
										>
											<Table.Thead>
												<Table.Tr>
													<Table.Th>Ciudadano</Table.Th>
													<Table.Th>Servicio</Table.Th>
													<Table.Th>Hora</Table.Th>
													<Table.Th>Estado</Table.Th>
												</Table.Tr>
											</Table.Thead>
											<Table.Tbody>
												{selectedBookings.map((booking) => (
													<Table.Tr key={booking.id}>
														<Table.Td>
															<Text fw={600} c="#111827">
																{booking.citizenName}
															</Text>
														</Table.Td>
														<Table.Td>
															<Text size="sm" c="gray.6">
																{booking.service}
															</Text>
														</Table.Td>
														<Table.Td>
															<Group gap={6}>
																<Clock size={14} color="#9ca3af" />
																<Text size="sm" fw={600} c="gray.7">
																	{booking.time}
																</Text>
															</Group>
														</Table.Td>
														<Table.Td>
															<Badge
																color={
																	booking.status === "confirmada"
																		? "green"
																		: booking.status === "en_proceso"
																			? "blue"
																			: "yellow"
																}
																variant="light"
																size="sm"
																style={{
																	textTransform: "none",
																	fontWeight: 600,
																	fontSize: "11px",
																}}
															>
																{booking.status === "confirmada"
																	? "Confirmada"
																	: booking.status === "en_proceso"
																		? "En proceso"
																		: "Pendiente"}
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
								style={{
									border: "1px solid #e5e7eb",
									textAlign: "center",
									height: "fit-content",
								}}
							>
								<Stack align="center" gap="lg">
									<Box
										style={{
											width: 64,
											height: 64,
											borderRadius: "20px",
											backgroundColor: "#f3f4f6",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										<UserCheck size={28} color="#9ca3af" />
									</Box>
									<Text size="lg" c="gray.5" fw={500}>
										Selecciona un encargado para ver sus detalles
									</Text>
								</Stack>
							</Card>
						)}
					</Grid.Col>
				</Grid>
			)}

			{/* Modals */}
			<ReassignModal
				opened={reassignModalOpened}
				onClose={closeReassign}
				staffList={staffList}
				sourceStaff={selectedStaff}
			/>

			<AddStaffModal opened={addModalOpened} onClose={closeAdd} />
		</Stack>
	);
}
