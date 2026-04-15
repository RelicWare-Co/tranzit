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
	JsonInput,
	Menu,
	Modal,
	Skeleton,
	Stack,
	Switch,
	Table,
	Tabs,
	Text,
	Textarea,
	TextInput,
	Title,
	Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	Car,
	CheckCircle2,
	ClipboardList,
	Copy,
	Edit3,
	Eye,
	FileCheck,
	FileText,
	FileUp,
	List,
	MoreHorizontal,
	Plus,
	Settings,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

// Types matching backend schema (procedure_type)
interface ProcedureType {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	isActive: boolean;
	configVersion: number;
	requiresVehicle: boolean;
	allowsPhysicalDocuments: boolean;
	allowsDigitalDocuments: boolean;
	instructions: string | null;
	eligibilitySchema: Record<string, unknown>;
	formSchema: Record<string, unknown>;
	documentSchema: Record<string, unknown>;
	policySchema: Record<string, unknown>;
	createdAt: number;
	updatedAt: number;
}

// Mock data - replace with actual API calls
const MOCK_PROCEDURES: ProcedureType[] = [
	{
		id: "proc-1",
		slug: "renovacion-licencia",
		name: "Renovación de Licencia de Conducir",
		description:
			"Renovación de licencia de conducción para vehículos particulares y de servicio público",
		isActive: true,
		configVersion: 1,
		requiresVehicle: false,
		allowsPhysicalDocuments: true,
		allowsDigitalDocuments: true,
		instructions: "Presentar documento de identidad vigente y pago de derechos",
		eligibilitySchema: {},
		formSchema: {
			fields: [
				{
					key: "nombre",
					type: "text",
					label: "Nombre completo",
					required: true,
				},
				{
					key: "documento",
					type: "text",
					label: "Número de documento",
					required: true,
				},
				{
					key: "categoria",
					type: "select",
					label: "Categoría de licencia",
					options: ["A1", "A2", "B1", "B2", "C1", "C2"],
					required: true,
				},
			],
		},
		documentSchema: {
			requirements: [
				{
					key: "documento_id",
					label: "Documento de identidad",
					required: true,
				},
				{ key: "recibo_pago", label: "Recibo de pago", required: true },
				{
					key: "certificado_medico",
					label: "Certificado médico",
					required: true,
				},
			],
		},
		policySchema: {},
		createdAt: Date.now(),
		updatedAt: Date.now(),
	},
	{
		id: "proc-2",
		slug: "matricula-inicial",
		name: "Matrícula Inicial",
		description: "Registro inicial de vehículo nuevo en el RUNT",
		isActive: true,
		configVersion: 2,
		requiresVehicle: true,
		allowsPhysicalDocuments: true,
		allowsDigitalDocuments: false,
		instructions:
			"Presentar factura de compra, SOAT vigente y revisión técnico-mecánica",
		eligibilitySchema: {},
		formSchema: {},
		documentSchema: {
			requirements: [
				{ key: "factura", label: "Factura de compra", required: true },
				{ key: "soat", label: "SOAT vigente", required: true },
				{
					key: "revision_tecnica",
					label: "Revisión técnico-mecánica",
					required: true,
				},
			],
		},
		policySchema: {},
		createdAt: Date.now(),
		updatedAt: Date.now(),
	},
	{
		id: "proc-3",
		slug: "traspaso-propiedad",
		name: "Traspaso de Propiedad",
		description: "Cambio de titularidad de vehículo entre particulares",
		isActive: true,
		configVersion: 1,
		requiresVehicle: true,
		allowsPhysicalDocuments: true,
		allowsDigitalDocuments: true,
		instructions: "Ambas partes deben presentarse o usar poder autenticado",
		eligibilitySchema: {},
		formSchema: {
			fields: [
				{
					key: "vendedor_nombre",
					type: "text",
					label: "Nombre del vendedor",
					required: true,
				},
				{
					key: "comprador_nombre",
					type: "text",
					label: "Nombre del comprador",
					required: true,
				},
				{
					key: "placa",
					type: "text",
					label: "Placa del vehículo",
					required: true,
				},
			],
		},
		documentSchema: {
			requirements: [
				{
					key: "documento_vendedor",
					label: "Documento vendedor",
					required: true,
				},
				{
					key: "documento_comprador",
					label: "Documento comprador",
					required: true,
				},
				{
					key: "certificado_tradicion",
					label: "Certificado de tradición",
					required: true,
				},
				{ key: "papeleta_pago", label: "Papeleta de pago", required: true },
			],
		},
		policySchema: {},
		createdAt: Date.now(),
		updatedAt: Date.now(),
	},
	{
		id: "proc-4",
		slug: "certificado-tradicion",
		name: "Certificado de Tradición",
		description: "Certificado que acredita la historia del vehículo",
		isActive: false,
		configVersion: 1,
		requiresVehicle: true,
		allowsPhysicalDocuments: true,
		allowsDigitalDocuments: false,
		instructions: "Solicitud disponible también en línea sin cita previa",
		eligibilitySchema: {},
		formSchema: {},
		documentSchema: {
			requirements: [
				{ key: "placa", label: "Placa del vehículo", required: true },
				{
					key: "documento_solicitante",
					label: "Documento solicitante",
					required: true,
				},
			],
		},
		policySchema: {},
		createdAt: Date.now(),
		updatedAt: Date.now(),
	},
	{
		id: "proc-5",
		slug: "duplicado-licencia",
		name: "Duplicado de Licencia",
		description: "Reposición de licencia perdida, hurtada o deteriorada",
		isActive: true,
		configVersion: 1,
		requiresVehicle: false,
		allowsPhysicalDocuments: true,
		allowsDigitalDocuments: true,
		instructions: "En caso de hurto, anexar denuncio ante autoridad competente",
		eligibilitySchema: {},
		formSchema: {
			fields: [
				{
					key: "motivo",
					type: "select",
					label: "Motivo de duplicado",
					options: ["Pérdida", "Hurto", "Deterioro"],
					required: true,
				},
				{
					key: "numero_licencia",
					type: "text",
					label: "Número de licencia anterior",
					required: false,
				},
			],
		},
		documentSchema: {
			requirements: [
				{
					key: "documento_id",
					label: "Documento de identidad",
					required: true,
				},
				{ key: "recibo_pago", label: "Recibo de pago", required: true },
				{ key: "denuncio", label: "Denuncio (si aplica)", required: false },
			],
		},
		policySchema: {},
		createdAt: Date.now(),
		updatedAt: Date.now(),
	},
];

export const Route = createFileRoute("/admin/tramites")({
	component: TramitesPage,
});

// Procedure Card Component
function ProcedureCard({
	procedure,
	isSelected,
	onClick,
}: {
	procedure: ProcedureType;
	isSelected: boolean;
	onClick: () => void;
}) {
	const hasFormConfigured =
		procedure.formSchema && Object.keys(procedure.formSchema).length > 0;
	const docCount =
		(procedure.documentSchema?.requirements as unknown[])?.length || 0;

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
					bg={procedure.isActive ? "#fef2f2" : "#f3f4f6"}
					c={procedure.isActive ? "#e03131" : "#9ca3af"}
					style={{
						border: procedure.isActive
							? "2px solid #e03131"
							: "2px solid #d1d5db",
						fontWeight: 700,
						fontSize: "14px",
					}}
				>
					<FileText size={20} />
				</Avatar>

				<Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
					<Group justify="space-between" wrap="nowrap">
						<Text
							fw={700}
							c={procedure.isActive ? "#111827" : "gray.5"}
							style={{
								fontSize: "15px",
								letterSpacing: "-0.3px",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{procedure.name}
						</Text>
						{procedure.isActive ? (
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
						{procedure.slug}
					</Text>

					<Group gap="xs" mt={4}>
						{procedure.requiresVehicle && (
							<Tooltip label="Requiere información del vehículo">
								<Badge
									color="orange"
									variant="light"
									size="sm"
									leftSection={<Car size={10} />}
									style={{
										textTransform: "none",
										fontWeight: 600,
										fontSize: "10px",
									}}
								>
									Vehículo
								</Badge>
							</Tooltip>
						)}
						{hasFormConfigured ? (
							<Badge
								color="blue"
								variant="light"
								size="sm"
								leftSection={<ClipboardList size={10} />}
								style={{
									textTransform: "none",
									fontWeight: 600,
									fontSize: "10px",
								}}
							>
								Formulario digital
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
								Solo físico
							</Badge>
						)}
						{docCount > 0 && (
							<Badge
								color="cyan"
								variant="light"
								size="sm"
								leftSection={<FileCheck size={10} />}
								style={{
									textTransform: "none",
									fontWeight: 600,
									fontSize: "10px",
								}}
							>
								{docCount} requisitos
							</Badge>
						)}
					</Group>
				</Stack>
			</Group>
		</Card>
	);
}

// Add Procedure Modal
function AddProcedureModal({
	opened,
	onClose,
}: {
	opened: boolean;
	onClose: () => void;
}) {
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [description, setDescription] = useState("");
	const [requiresVehicle, setRequiresVehicle] = useState(false);
	const [allowsPhysical, setAllowsPhysical] = useState(true);
	const [allowsDigital, setAllowsDigital] = useState(true);

	const handleSubmit = () => {
		// TODO: Call API to create procedure
		console.log("Add procedure", {
			name,
			slug,
			description,
			requiresVehicle,
			allowsPhysicalDocuments: allowsPhysical,
			allowsDigitalDocuments: allowsDigital,
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
							backgroundColor: "#dcfce7",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Plus size={20} color="#16a34a" />
					</Box>
					<Title order={3} c="#111827" style={{ fontWeight: 700 }}>
						Nuevo trámite
					</Title>
				</Group>
			}
			size="lg"
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
					label="Nombre del trámite"
					placeholder="Ej: Renovación de Licencia"
					value={name}
					onChange={(e) => setName(e.currentTarget.value)}
					radius="xl"
					size="md"
					styles={{
						input: { fontWeight: 500 },
					}}
				/>

				<TextInput
					label="Identificador (slug)"
					placeholder="ej: renovacion-licencia"
					description="Usado en URLs y código. Solo letras, números y guiones."
					value={slug}
					onChange={(e) =>
						setSlug(
							e.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
						)
					}
					radius="xl"
					size="md"
					styles={{
						input: { fontWeight: 500 },
					}}
				/>

				<Textarea
					label="Descripción"
					placeholder="Describe el trámite y qué debe saber el ciudadano..."
					value={description}
					onChange={(e) => setDescription(e.currentTarget.value)}
					radius="xl"
					size="md"
					minRows={3}
					styles={{
						input: { fontWeight: 500 },
					}}
				/>

				<Divider label="Configuración" labelPosition="center" />

				<Group grow>
					<Switch
						checked={requiresVehicle}
						onChange={(event) =>
							setRequiresVehicle(event.currentTarget.checked)
						}
						label="Requiere vehículo"
						description="Solicita información de placa, línea, modelo"
						size="md"
					/>
				</Group>

				<Group grow>
					<Switch
						checked={allowsPhysical}
						onChange={(event) => setAllowsPhysical(event.currentTarget.checked)}
						label="Permite documentos físicos"
						description="El ciudadano puede llevar documentos impresos"
						size="md"
					/>
					<Switch
						checked={allowsDigital}
						onChange={(event) => setAllowsDigital(event.currentTarget.checked)}
						label="Permite documentos digitales"
						description="El ciudadano puede subir archivos PDF/IMG"
						size="md"
					/>
				</Group>

				<Group justify="flex-end" mt="md">
					<Button variant="light" color="gray" onClick={onClose} radius="xl">
						Cancelar
					</Button>
					<Button
						color="green"
						onClick={handleSubmit}
						disabled={!name || !slug}
						radius="xl"
						leftSection={<Plus size={16} />}
					>
						Crear trámite
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}

// Main Page Component
function TramitesPage() {
	const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(
		null,
	);
	const [addModalOpened, { open: openAdd, close: closeAdd }] =
		useDisclosure(false);

	// Local state for procedures (to handle toggle updates optimistically)
	const [procedureList, setProcedureList] =
		useState<ProcedureType[]>(MOCK_PROCEDURES);
	const [isUpdating, setIsUpdating] = useState<string | null>(null);

	// TODO: Replace with actual API calls using @orpc/tanstack-query
	const isLoading = false;

	const selectedProcedure = useMemo(
		() => procedureList.find((p) => p.id === selectedProcedureId) || null,
		[procedureList, selectedProcedureId],
	);

	const activeProcedures = procedureList.filter((p) => p.isActive).length;
	const totalProcedures = procedureList.length;

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
								<Skeleton key={i} height={120} radius="xl" />
							))}
						</Stack>
					</Grid.Col>
					<Grid.Col span={{ base: 12, md: 7 }}>
						<Skeleton height={500} radius="xl" />
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
							Gestión de Trámites
						</Title>
						<Text size="lg" c="#6b7280" mt="xs">
							Administra los trámites disponibles para agendamiento ciudadano.
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
						Nuevo trámite
					</Button>
				</Group>
			</Box>

			{/* Stats Info */}
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
						<List size={24} color="#2563eb" />
					</Box>
					<Stack gap={2}>
						<Text fw={700} c="#1e40af" size="lg">
							{activeProcedures} de {totalProcedures} trámites activos
						</Text>
						<Text size="sm" c="#3b82f6">
							Los ciudadanos solo pueden agendar citas para trámites activos
						</Text>
					</Stack>
				</Group>
			</Card>

			{/* Empty State */}
			{procedureList.length === 0 && (
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
							<FileText size={36} color="#9ca3af" />
						</Box>
						<Stack gap="xs">
							<Text fw={700} c="#111827" size="xl">
								No hay trámites registrados
							</Text>
							<Text size="md" c="gray.5">
								Crea el primer trámite para comenzar a recibir citas
							</Text>
						</Stack>
						<Button
							color="red"
							onClick={openAdd}
							radius="xl"
							size="md"
							leftSection={<Plus size={18} />}
						>
							Crear primer trámite
						</Button>
					</Stack>
				</Card>
			)}

			{/* Main Content Grid */}
			{procedureList.length > 0 && (
				<Grid gap="xl">
					{/* Procedure List */}
					<Grid.Col span={{ base: 12, md: 5 }}>
						<Stack gap="md">
							{procedureList.map((procedure) => (
								<ProcedureCard
									key={procedure.id}
									procedure={procedure}
									isSelected={selectedProcedureId === procedure.id}
									onClick={() => setSelectedProcedureId(procedure.id)}
								/>
							))}
						</Stack>
					</Grid.Col>

					{/* Procedure Detail */}
					<Grid.Col span={{ base: 12, md: 7 }}>
						{selectedProcedure ? (
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
												bg={selectedProcedure.isActive ? "#fef2f2" : "#f3f4f6"}
												c={selectedProcedure.isActive ? "#e03131" : "#9ca3af"}
												style={{
													border: selectedProcedure.isActive
														? "3px solid #e03131"
														: "3px solid #d1d5db",
													fontWeight: 700,
													fontSize: "18px",
												}}
											>
												<FileText size={28} />
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
													{selectedProcedure.name}
												</Title>
												<Text size="sm" c="gray.5">
													{selectedProcedure.slug}
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
													leftSection={<Copy size={14} />}
													onClick={() => {
														// TODO: Duplicate procedure
														console.log(
															"Duplicate procedure",
															selectedProcedure.id,
														);
													}}
												>
													Duplicar configuración
												</Menu.Item>
												<Menu.Divider />
												<Menu.Item
													color="red"
													leftSection={<Trash2 size={14} />}
													onClick={() => {
														// TODO: Delete procedure
														console.log(
															"Delete procedure",
															selectedProcedure.id,
														);
													}}
												>
													Eliminar trámite
												</Menu.Item>
											</Menu.Dropdown>
										</Menu>
									</Group>

									{/* Settings Row */}
									<Group mt="xl" gap="xl">
										<Group gap="sm">
											<Switch
												checked={selectedProcedure.isActive}
												label="Trámite activo"
												size="md"
												disabled={isUpdating === selectedProcedure.id}
												onChange={(event) => {
													const newActive = event.currentTarget.checked;
													setIsUpdating(selectedProcedure.id);

													// Optimistic update
													setProcedureList((prev) =>
														prev.map((p) =>
															p.id === selectedProcedure.id
																? { ...p, isActive: newActive }
																: p,
														),
													);

													// TODO: Call API to update procedure status
													console.log("Update procedure active:", {
														procedureId: selectedProcedure.id,
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
											{isUpdating === selectedProcedure.id && (
												<Text size="xs" c="gray.5" fs="italic">
													Actualizando...
												</Text>
											)}
										</Group>
									</Group>
								</Box>

								{/* Tabs Content */}
								<Tabs defaultValue="general" variant="outline" radius="xl">
									<Tabs.List p="md" pb={0}>
										<Tabs.Tab
											value="general"
											leftSection={<Settings size={16} />}
										>
											General
										</Tabs.Tab>
										<Tabs.Tab
											value="form"
											leftSection={<ClipboardList size={16} />}
										>
											Formulario Digital
										</Tabs.Tab>
										<Tabs.Tab
											value="documents"
											leftSection={<FileCheck size={16} />}
										>
											Documentos
										</Tabs.Tab>
									</Tabs.List>

									<Tabs.Panel value="general" p="xl">
										<Stack gap="lg">
											{/* Description */}
											<Box>
												<Text size="sm" fw={700} c="#111827" mb="xs">
													Descripción
												</Text>
												<Text size="sm" c="gray.6" style={{ lineHeight: 1.6 }}>
													{selectedProcedure.description || "Sin descripción"}
												</Text>
											</Box>

											<Divider />

											{/* Instructions */}
											<Box>
												<Text size="sm" fw={700} c="#111827" mb="xs">
													Instrucciones para el ciudadano
												</Text>
												<Alert
													color="blue"
													variant="light"
													radius="lg"
													icon={<AlertCircle size={18} />}
												>
													<Text size="sm">
														{selectedProcedure.instructions ||
															"Sin instrucciones específicas"}
													</Text>
												</Alert>
											</Box>

											<Divider />

											{/* Configuration Summary */}
											<Grid>
												<Grid.Col span={{ base: 12, sm: 6 }}>
													<Stack gap="xs">
														<Text size="sm" fw={600} c="gray.7">
															Versión de configuración
														</Text>
														<Badge
															variant="light"
															color="gray"
															size="sm"
															style={{ width: "fit-content" }}
														>
															v{selectedProcedure.configVersion}
														</Badge>
													</Stack>
												</Grid.Col>
												<Grid.Col span={{ base: 12, sm: 6 }}>
													<Stack gap="xs">
														<Text size="sm" fw={600} c="gray.7">
															Requiere vehículo
														</Text>
														<Badge
															variant="light"
															color={
																selectedProcedure.requiresVehicle
																	? "orange"
																	: "gray"
															}
															size="sm"
															style={{ width: "fit-content" }}
															leftSection={
																selectedProcedure.requiresVehicle ? (
																	<Car size={12} />
																) : null
															}
														>
															{selectedProcedure.requiresVehicle ? "Sí" : "No"}
														</Badge>
													</Stack>
												</Grid.Col>
											</Grid>
										</Stack>
									</Tabs.Panel>

									<Tabs.Panel value="form" p="xl">
										<Stack gap="lg">
											{/* Form Status */}
											<Alert
												color={
													selectedProcedure.formSchema &&
													Object.keys(selectedProcedure.formSchema).length > 0
														? "teal"
														: "yellow"
												}
												variant="light"
												radius="lg"
												icon={
													selectedProcedure.formSchema &&
													Object.keys(selectedProcedure.formSchema).length >
														0 ? (
														<CheckCircle2 size={20} />
													) : (
														<AlertCircle size={20} />
													)
												}
											>
												<Stack gap={4}>
													<Text fw={700}>
														{selectedProcedure.formSchema &&
														Object.keys(selectedProcedure.formSchema).length > 0
															? "Formulario digital configurado"
															: "Formulario no configurado"}
													</Text>
													<Text size="sm">
														{selectedProcedure.formSchema &&
														Object.keys(selectedProcedure.formSchema).length > 0
															? "Los ciudadanos pueden completar el formulario digital antes de su cita. El staff puede visualizarlo e imprimirlo."
															: "Los ciudadanos deben llevar el formulario impreso. Configure el formulario digital para permitir llenado online."}
													</Text>
												</Stack>
											</Alert>

											{/* Form Builder CTA */}
											<Card
												radius="xl"
												p="xl"
												bg="#f8fafc"
												style={{ border: "1px dashed #cbd5e1" }}
											>
												<Stack align="center" gap="md">
													<Box
														style={{
															width: 64,
															height: 64,
															borderRadius: "20px",
															backgroundColor: "#e0f2fe",
															display: "flex",
															alignItems: "center",
															justifyContent: "center",
														}}
													>
														<ClipboardList size={28} color="#0284c7" />
													</Box>
													<Stack align="center" gap={4}>
														<Text fw={700} c="#111827" size="lg">
															Constructor de formularios
														</Text>
														<Text size="sm" c="gray.5" ta="center">
															Diseña el formulario que los ciudadanos llenarán
															digitalmente.
															<br />
															El staff podrá visualizarlo e imprimirlo onsite.
														</Text>
													</Stack>
													<Button
														color="blue"
														radius="xl"
														size="md"
														leftSection={<Edit3 size={18} />}
														onClick={() => {
															// TODO: Open form builder modal
															console.log(
																"Open form builder for",
																selectedProcedure.id,
															);
														}}
													>
														{selectedProcedure.formSchema &&
														Object.keys(selectedProcedure.formSchema).length > 0
															? "Editar formulario"
															: "Diseñar formulario"}
													</Button>
												</Stack>
											</Card>

											{/* Current Form Preview (if configured) */}
											{selectedProcedure.formSchema &&
												Object.keys(selectedProcedure.formSchema).length >
													0 && (
													<>
														<Divider
															label="Vista previa del esquema"
															labelPosition="center"
														/>
														<JsonInput
															label="Form Schema (JSON)"
															value={JSON.stringify(
																selectedProcedure.formSchema,
																null,
																2,
															)}
															minRows={6}
															maxRows={10}
															readOnly
															radius="xl"
															styles={{
																input: {
																	fontFamily: "monospace",
																	fontSize: "12px",
																},
															}}
														/>
													</>
												)}
										</Stack>
									</Tabs.Panel>

									<Tabs.Panel value="documents" p="xl">
										<Stack gap="lg">
											{/* Document Mode Settings */}
											<Group grow>
												<Card
													radius="xl"
													p="md"
													bg={
														selectedProcedure.allowsPhysicalDocuments
															? "#f0fdf4"
															: "#f3f4f6"
													}
													style={{
														border: selectedProcedure.allowsPhysicalDocuments
															? "1px solid #86efac"
															: "1px solid #d1d5db",
													}}
												>
													<Group gap="sm">
														<Box
															style={{
																width: 40,
																height: 40,
																borderRadius: "12px",
																backgroundColor:
																	selectedProcedure.allowsPhysicalDocuments
																		? "white"
																		: "#e5e7eb",
																display: "flex",
																alignItems: "center",
																justifyContent: "center",
															}}
														>
															<FileText
																size={20}
																color={
																	selectedProcedure.allowsPhysicalDocuments
																		? "#16a34a"
																		: "#9ca3af"
																}
															/>
														</Box>
														<Stack gap={2}>
															<Text
																fw={700}
																c={
																	selectedProcedure.allowsPhysicalDocuments
																		? "#15803d"
																		: "gray.5"
																}
															>
																Documentos físicos
															</Text>
															<Text size="xs" c="gray.5">
																{selectedProcedure.allowsPhysicalDocuments
																	? "Los ciudadanos pueden traer documentos impresos"
																	: "No permitido"}
															</Text>
														</Stack>
													</Group>
												</Card>

												<Card
													radius="xl"
													p="md"
													bg={
														selectedProcedure.allowsDigitalDocuments
															? "#f0f9ff"
															: "#f3f4f6"
													}
													style={{
														border: selectedProcedure.allowsDigitalDocuments
															? "1px solid #7dd3fc"
															: "1px solid #d1d5db",
													}}
												>
													<Group gap="sm">
														<Box
															style={{
																width: 40,
																height: 40,
																borderRadius: "12px",
																backgroundColor:
																	selectedProcedure.allowsDigitalDocuments
																		? "white"
																		: "#e5e7eb",
																display: "flex",
																alignItems: "center",
																justifyContent: "center",
															}}
														>
															<FileUp
																size={20}
																color={
																	selectedProcedure.allowsDigitalDocuments
																		? "#0284c7"
																		: "#9ca3af"
																}
															/>
														</Box>
														<Stack gap={2}>
															<Text
																fw={700}
																c={
																	selectedProcedure.allowsDigitalDocuments
																		? "#0369a1"
																		: "gray.5"
																}
															>
																Documentos digitales
															</Text>
															<Text size="xs" c="gray.5">
																{selectedProcedure.allowsDigitalDocuments
																	? "Los ciudadanos pueden subir archivos PDF/IMG"
																	: "No permitido"}
															</Text>
														</Stack>
													</Group>
												</Card>
											</Group>

											<Divider />

											{/* Document Requirements List */}
											<Box>
												<Text size="sm" fw={700} c="#111827" mb="md">
													Requisitos documentales
												</Text>

												{(
													selectedProcedure.documentSchema
														?.requirements as unknown[]
												)?.length > 0 ? (
													<Table
														highlightOnHover
														verticalSpacing="sm"
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
																<Table.Th>Documento</Table.Th>
																<Table.Th>Obligatorio</Table.Th>
															</Table.Tr>
														</Table.Thead>
														<Table.Tbody>
															{(
																selectedProcedure.documentSchema
																	?.requirements as Array<{
																	key: string;
																	label: string;
																	required: boolean;
																}>
															)?.map((req, index) => (
																<Table.Tr key={req.key || index}>
																	<Table.Td>
																		<Group gap="xs">
																			<FileCheck size={16} color="#6b7280" />
																			<Text fw={600} c="#111827">
																				{req.label}
																			</Text>
																		</Group>
																	</Table.Td>
																	<Table.Td>
																		{req.required ? (
																			<Badge
																				color="red"
																				variant="light"
																				size="sm"
																			>
																				Obligatorio
																			</Badge>
																		) : (
																			<Badge
																				color="gray"
																				variant="light"
																				size="sm"
																			>
																				Opcional
																			</Badge>
																		)}
																	</Table.Td>
																</Table.Tr>
															))}
														</Table.Tbody>
													</Table>
												) : (
													<Alert
														color="gray"
														variant="light"
														radius="lg"
														icon={<AlertCircle size={20} />}
													>
														<Text size="sm" c="gray.6">
															No hay requisitos documentales configurados
														</Text>
													</Alert>
												)}
											</Box>
										</Stack>
									</Tabs.Panel>
								</Tabs>
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
										<Eye size={28} color="#9ca3af" />
									</Box>
									<Text size="lg" c="gray.5" fw={500}>
										Selecciona un trámite para ver sus detalles
									</Text>
								</Stack>
							</Card>
						)}
					</Grid.Col>
				</Grid>
			)}

			{/* Modals */}
			<AddProcedureModal opened={addModalOpened} onClose={closeAdd} />
		</Stack>
	);
}
