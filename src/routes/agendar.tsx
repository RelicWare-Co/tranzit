import {
	ActionIcon,
	Alert,
	Badge,
	Box,
	Button,
	Card,
	Container,
	Divider,
	Flex,
	Grid,
	Group,
	Paper,
	PinInput,
	Select,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	Calendar as CalendarIcon,
	Car,
	CheckCircle2,
	ChevronRight,
	Clock,
	FileText,
	Mail,
	Phone,
	Search,
	ShieldCheck,
	User,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/agendar")({
	component: AgendarCita,
});

const STEPS = [
	{ id: 1, label: "Validar Placa" },
	{ id: 2, label: "Datos Solicitante" },
	{ id: 3, label: "Fecha y Hora" },
	{ id: 4, label: "Confirmación" },
];

function AgendarCita() {
	const [active, setActive] = useState(0);

	// Step 1: Placa
	const [placa, setPlaca] = useState("");
	const [placaError, setPlacaError] = useState("");
	const [isValidating, setIsValidating] = useState(false);

	// Step 2: Formulario
	const [formData, setFormData] = useState({
		nombre: "",
		identificacion: "",
		tramite: "",
		telefono: "",
		correo: "",
	});

	// Step 3: Fecha y Hora
	const [selectedDate, setSelectedDate] = useState<string | null>(null);
	const [selectedTime, setSelectedTime] = useState<string | null>(null);

	// Step 4: Confirmación
	const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
	const [codeSent, setCodeSent] = useState(false);
	const [verificationCode, setVerificationCode] = useState("");
	const [isConfirmed, setIsConfirmed] = useState(false);

	useEffect(() => {
		if (active === 3 && !isConfirmed && timeLeft > 0) {
			const timer = setInterval(() => {
				setTimeLeft((prev) => prev - 1);
			}, 1000);
			return () => clearInterval(timer);
		}
		if (timeLeft === 0 && !isConfirmed) {
			// Time expired, reset or show error
			setActive(2); // Go back to selection
			setSelectedTime(null);
			setTimeLeft(300);
		}
	}, [active, isConfirmed, timeLeft]);

	const formatTime = (seconds: number) => {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s.toString().padStart(2, "0")}`;
	};

	const handleValidatePlaca = () => {
		setPlacaError("");
		if (placa.length < 5 || placa.length > 6) {
			setPlacaError("Formato de placa inválido.");
			return;
		}
		setIsValidating(true);
		setTimeout(() => {
			setIsValidating(false);
			// Mock validation: if placa starts with 'XXX' simulate error
			if (placa.toUpperCase().startsWith("XXX")) {
				setPlacaError(
					"El vehículo no se encuentra registrado en la ciudad de Tuluá.",
				);
			} else {
				setActive(1);
			}
		}, 1000);
	};

	const handleSendCode = () => {
		setCodeSent(true);
		// Simulate sending code
	};

	const handleConfirm = () => {
		if (verificationCode.length === 4) {
			setIsConfirmed(true);
		}
	};

	return (
		<Box pb={80} bg="#f4f6f8" minH="100vh">
			{/* Decorative Header Area */}
			<Box
				style={{
					background: "#2c3136",
					position: "relative",
					overflow: "hidden",
					padding: "40px 0 60px 0",
				}}
			>
				{/* Background SVG Waves strictly matching image style */}
				<svg
					viewBox="0 0 1440 320"
					preserveAspectRatio="none"
					style={{
						position: "absolute",
						bottom: 0,
						left: 0,
						width: "100%",
						height: "100px",
						zIndex: 0,
						transform: "rotate(180deg)",
					}}
				>
					<title>Decorative background waves</title>
					<path
						fill="#2b8a3e"
						fillOpacity="1"
						d="M0,64L80,90.7C160,117,320,171,480,186.7C640,203,800,181,960,149.3C1120,117,1280,75,1360,53.3L1440,32L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"
					></path>
					<path
						fill="#343a40"
						fillOpacity="1"
						d="M0,192L80,181.3C160,171,320,149,480,165.3C640,181,800,235,960,240C1120,245,1280,203,1360,181.3L1440,160L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"
					></path>
				</svg>

				<Container size="lg" style={{ position: "relative", zIndex: 1 }}>
					<Title
						c="white"
						order={1}
						style={{
							letterSpacing: "-0.5px",
							fontSize: "32px",
							fontWeight: 700,
						}}
					>
						Agendamiento de Citas
					</Title>
					<Text c="gray.4" mt="sm" size="lg">
						Programe su cita para trámites de tránsito en Tuluá
					</Text>
				</Container>
			</Box>

			<Container size="lg" mt="-30" style={{ position: "relative", zIndex: 2 }}>
				<Paper shadow="sm" radius="md" p={0} bg="white" withBorder>
					<Box p="xl">
						<Title
							order={3}
							c="#2c3136"
							size="h4"
							style={{ fontWeight: 700 }}
							mb="md"
						>
							Gestión de Trámites
						</Title>

						<Divider mb="xl" color="gray.2" />

						{/* Step Indicator (>>> Paso X de 4: Nombre) */}
						<Group gap={6} mb="xl" align="center">
							<Group gap={0} c="gray.4" style={{ display: "flex" }}>
								<ChevronRight size={22} style={{ marginRight: -14 }} />
								<ChevronRight size={22} style={{ marginRight: -14 }} />
								<ChevronRight size={22} />
							</Group>
							<Text fw={800} size="lg" c="#2c3136" ml="sm">
								Paso {active + 1} de {STEPS.length}: {STEPS[active].label}
							</Text>
						</Group>

						{/* Single Bar Stepper matching original image design */}
						<Box
							style={{
								position: "relative",
								width: "100%",
								marginBottom: 40,
								borderRadius: 50,
								backgroundColor: "#868e96",
							}}
						>
							{/* Active Background Bar */}
							<Box
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									height: "100%",
									width: `${((active + 1) / STEPS.length) * 100}%`,
									backgroundColor: "#2c3136",
									borderRadius: 50,
									zIndex: 0,
									transition: "width 0.3s ease",
								}}
							/>

							{/* Steps */}
							<Flex style={{ position: "relative", zIndex: 1, width: "100%" }}>
								{STEPS.map((step, index) => {
									const isActive = index === active;
									const isCompleted = index < active;

									let circleBg = "#adb5bd"; // Future gray circle

									if (isCompleted) {
										circleBg = "#495057"; // Completed dark circle
									} else if (isActive) {
										circleBg = "#e03131"; // Active red circle
									}

									return (
										<Box
											key={step.id}
											style={{
												flex: 1,
												padding: "12px 10px",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
											}}
										>
											<Group gap="sm" wrap="nowrap">
												{isActive || isCompleted ? (
													<Box
														style={{
															width: 32,
															height: 32,
															borderRadius: "50%",
															backgroundColor: circleBg,
															display: "flex",
															alignItems: "center",
															justifyContent: "center",
															color: "white",
															fontWeight: 700,
															fontSize: 15,
															flexShrink: 0,
														}}
													>
														{step.id}
													</Box>
												) : (
													<Text
														fw={700}
														size="md"
														c="white"
														style={{
															width: 32,
															display: "flex",
															justifyContent: "center",
														}}
													>
														{step.id}
													</Text>
												)}
												<Text
													fw={isActive ? 700 : 500}
													c="white"
													size="sm"
													style={{
														whiteSpace: "nowrap",
														overflow: "hidden",
														textOverflow: "ellipsis",
													}}
												>
													{step.label}
												</Text>
											</Group>
										</Box>
									);
								})}
							</Flex>
						</Box>

						{/* Content Area */}
						<Box p="md">
							{active === 0 && (
								<Stack align="center" py="xl" maxW={450} mx="auto">
									<ActionIcon
										size={80}
										radius="100%"
										color="dark.8"
										variant="light"
										mb="sm"
									>
										<Car size={40} />
									</ActionIcon>
									<Title order={3} c="#2c3136">
										Consulta de Vehículo
									</Title>
									<Text c="dimmed" ta="center" mb="lg">
										Ingrese la placa de su vehículo para validar si se encuentra
										registrado en la base de datos de Tuluá.
									</Text>
									<TextInput
										placeholder="Ej: ABC123"
										size="xl"
										radius="md"
										w="100%"
										value={placa}
										onChange={(e) =>
											setPlaca(e.currentTarget.value.toUpperCase())
										}
										error={placaError}
										styles={{
											input: {
												textAlign: "center",
												fontSize: "28px",
												letterSpacing: "4px",
												fontWeight: 800,
												textTransform: "uppercase",
												border: "2px solid #e9ecef",
											},
										}}
									/>
									<Button
										fullWidth
										size="lg"
										mt="lg"
										color="#2c3136"
										onClick={handleValidatePlaca}
										loading={isValidating}
										rightSection={<Search size={20} />}
										style={{ fontWeight: 600 }}
									>
										Validar Placa
									</Button>
									{placaError && (
										<Alert
											icon={<AlertTriangle size={20} />}
											title="Aviso Importante"
											color="red"
											variant="light"
											mt="lg"
											w="100%"
										>
											{placaError}
										</Alert>
									)}
								</Stack>
							)}

							{active === 1 && (
								<Stack maxW={700} mx="auto" gap="xl">
									<Alert
										icon={<CheckCircle2 size={20} />}
										color="green.8"
										variant="light"
										style={{ border: "1px solid #b2f2bb" }}
									>
										Vehículo con placa <b>{placa}</b> validado correctamente.
										Puede continuar con el registro.
									</Alert>

									<Box>
										<Title order={5} c="#2c3136" mb="md">
											Información del Solicitante
										</Title>
										<Grid gutter="lg">
											<Grid.Col span={12}>
												<TextInput
													label="Placa del Vehículo"
													value={placa}
													readOnly
													variant="filled"
													leftSection={<Car size={16} />}
													styles={{ input: { fontWeight: 600 } }}
												/>
											</Grid.Col>
											<Grid.Col span={{ base: 12, sm: 6 }}>
												<TextInput
													label="Nombre Completo"
													placeholder="Ej: Juan Pérez"
													required
													value={formData.nombre}
													onChange={(e) =>
														setFormData({
															...formData,
															nombre: e.currentTarget.value,
														})
													}
													leftSection={<User size={16} />}
												/>
											</Grid.Col>
											<Grid.Col span={{ base: 12, sm: 6 }}>
												<TextInput
													label="Identificación"
													placeholder="Número de documento"
													required
													value={formData.identificacion}
													onChange={(e) =>
														setFormData({
															...formData,
															identificacion: e.currentTarget.value,
														})
													}
													leftSection={<FileText size={16} />}
												/>
											</Grid.Col>
											<Grid.Col span={12}>
												<Select
													label="Tipo de Trámite"
													placeholder="Seleccione el trámite"
													required
													value={formData.tramite}
													onChange={(val) =>
														setFormData({ ...formData, tramite: val || "" })
													}
													data={[
														{
															value: "traspaso",
															label: "Traspaso de Propiedad",
														},
														{
															value: "licencia",
															label: "Renovación de Licencia",
														},
														{ value: "matricula", label: "Matrícula Inicial" },
														{
															value: "certificado",
															label: "Certificado de Tradición",
														},
													]}
												/>
											</Grid.Col>
											<Grid.Col span={{ base: 12, sm: 6 }}>
												<TextInput
													label="Teléfono Móvil"
													placeholder="Ej: 300 123 4567"
													required
													value={formData.telefono}
													onChange={(e) =>
														setFormData({
															...formData,
															telefono: e.currentTarget.value,
														})
													}
													leftSection={<Phone size={16} />}
												/>
											</Grid.Col>
											<Grid.Col span={{ base: 12, sm: 6 }}>
												<TextInput
													label="Correo Electrónico"
													placeholder="Ej: correo@ejemplo.com"
													required
													value={formData.correo}
													onChange={(e) =>
														setFormData({
															...formData,
															correo: e.currentTarget.value,
														})
													}
													leftSection={<Mail size={16} />}
												/>
											</Grid.Col>
										</Grid>
									</Box>

									<Divider />

									<Group justify="space-between">
										<Button
											variant="default"
											onClick={() => setActive(0)}
											size="md"
										>
											Volver
										</Button>
										<Button
											color="#e03131"
											size="md"
											onClick={() => setActive(2)}
											disabled={
												!formData.nombre ||
												!formData.identificacion ||
												!formData.tramite ||
												!formData.telefono ||
												!formData.correo
											}
											rightSection={<ChevronRight size={18} />}
										>
											Siguiente Paso
										</Button>
									</Group>
								</Stack>
							)}

							{active === 2 && (
								<Stack maxW={700} mx="auto" gap="xl">
									<Box>
										<Title order={5} c="#2c3136" mb="xs">
											Seleccione Fecha y Hora
										</Title>
										<Text c="dimmed" size="sm">
											Escoja un día disponible para su cita presencial en
											nuestras oficinas.
										</Text>
									</Box>

									<Grid gutter="xl">
										<Grid.Col span={{ base: 12, md: 6 }}>
											<Text fw={600} size="sm" mb="md" c="#2c3136">
												1. Días Disponibles
											</Text>
											<Stack gap="sm">
												{["2026-03-30", "2026-03-31", "2026-04-01"].map(
													(date) => (
														<Button
															key={date}
															variant={
																selectedDate === date ? "filled" : "default"
															}
															color={selectedDate === date ? "#2c3136" : "gray"}
															onClick={() => {
																setSelectedDate(date);
																setSelectedTime(null);
															}}
															fullWidth
															justify="flex-start"
															leftSection={<CalendarIcon size={18} />}
															size="md"
															style={{
																border:
																	selectedDate === date
																		? "1px solid #2c3136"
																		: "1px solid #dee2e6",
															}}
														>
															{new Date(date).toLocaleDateString("es-ES", {
																weekday: "long",
																year: "numeric",
																month: "long",
																day: "numeric",
															})}
														</Button>
													),
												)}
											</Stack>
										</Grid.Col>
										<Grid.Col span={{ base: 12, md: 6 }}>
											<Text fw={600} size="sm" mb="md" c="#2c3136">
												2. Horarios Disponibles
											</Text>
											{selectedDate ? (
												<Group gap="sm">
													{[
														"08:00 AM",
														"09:30 AM",
														"11:00 AM",
														"02:00 PM",
														"03:30 PM",
													].map((time) => (
														<Button
															key={time}
															variant={
																selectedTime === time ? "filled" : "outline"
															}
															color={
																selectedTime === time ? "green.7" : "gray.5"
															}
															onClick={() => setSelectedTime(time)}
															leftSection={<Clock size={16} />}
															size="sm"
															style={{
																color:
																	selectedTime === time ? "white" : "#495057",
															}}
														>
															{time}
														</Button>
													))}
												</Group>
											) : (
												<Alert color="gray" variant="light">
													Seleccione una fecha primero para ver las horas
													disponibles.
												</Alert>
											)}
										</Grid.Col>
									</Grid>

									<Divider />

									<Group justify="space-between">
										<Button
											variant="default"
											onClick={() => setActive(1)}
											size="md"
										>
											Volver
										</Button>
										<Button
											color="#e03131"
											size="md"
											onClick={() => {
												setActive(3);
												setTimeLeft(300);
											}}
											disabled={!selectedDate || !selectedTime}
											rightSection={<ChevronRight size={18} />}
										>
											Confirmar Horario
										</Button>
									</Group>
								</Stack>
							)}

							{active === 3 && (
								<Stack maxW={700} mx="auto" gap="xl">
									{!isConfirmed ? (
										<>
											<Alert
												icon={<Clock size={24} />}
												color="yellow.8"
												variant="light"
												style={{ border: "1px solid #ffe066" }}
											>
												<Text fw={700} size="md" c="yellow.9">
													Horario Reservado Temporalmente
												</Text>
												<Text size="sm" c="yellow.9">
													Hemos bloqueado este espacio para usted. Tiene{" "}
													<b>{formatTime(timeLeft)}</b> para completar la
													confirmación. Si el tiempo expira, el espacio será
													liberado.
												</Text>
											</Alert>

											<Card
												withBorder
												shadow="none"
												radius="md"
												bg="#f8f9fa"
												style={{ borderColor: "#e9ecef" }}
											>
												<Group justify="space-between" mb="md">
													<Title order={5} c="#2c3136">
														Resumen de Cita
													</Title>
													<Badge color="yellow.7" variant="filled">
														Pendiente Confirmación
													</Badge>
												</Group>
												<Divider mb="md" />
												<Grid>
													<Grid.Col span={6}>
														<Text size="sm" c="dimmed">
															Trámite
														</Text>
														<Text fw={600} c="#2c3136">
															{formData.tramite.toUpperCase()}
														</Text>
													</Grid.Col>
													<Grid.Col span={6}>
														<Text size="sm" c="dimmed">
															Placa
														</Text>
														<Text fw={600} c="#2c3136">
															{placa}
														</Text>
													</Grid.Col>
													<Grid.Col span={6}>
														<Text size="sm" c="dimmed">
															Fecha
														</Text>
														<Text fw={600} c="#2c3136">
															{selectedDate}
														</Text>
													</Grid.Col>
													<Grid.Col span={6}>
														<Text size="sm" c="dimmed">
															Hora
														</Text>
														<Text fw={600} c="#2c3136">
															{selectedTime}
														</Text>
													</Grid.Col>
												</Grid>
											</Card>

											<Box
												p="xl"
												style={{
													borderRadius: "8px",
													border: "2px dashed #ced4da",
													backgroundColor: "white",
												}}
											>
												<Title order={5} mb="md" c="#2c3136" ta="center">
													Verificación de Identidad
												</Title>
												{!codeSent ? (
													<Stack gap="md" align="center">
														<Text size="sm" c="dimmed" ta="center">
															Para evitar abusos y confirmar su identidad, le
															enviaremos un código de verificación al correo{" "}
															<b>{formData.correo}</b> o al celular terminado en{" "}
															<b>{formData.telefono.slice(-4)}</b>.
														</Text>
														<Button
															variant="outline"
															color="#2c3136"
															onClick={handleSendCode}
															leftSection={<ShieldCheck size={18} />}
															size="md"
														>
															Enviar Código de Verificación
														</Button>
													</Stack>
												) : (
													<Stack align="center" gap="md">
														<Text size="sm" c="dimmed" ta="center">
															Ingrese el código de 4 dígitos enviado a sus
															medios de contacto.
														</Text>
														<PinInput
															length={4}
															size="xl"
															value={verificationCode}
															onChange={setVerificationCode}
															type="number"
															styles={{
																input: {
																	borderColor: "#2c3136",
																	fontWeight: 700,
																},
															}}
														/>
														<Button
															size="md"
															mt="md"
															color="green.7"
															onClick={handleConfirm}
															disabled={verificationCode.length < 4}
															leftSection={<CheckCircle2 size={18} />}
															w={200}
														>
															Confirmar Cita
														</Button>
													</Stack>
												)}
											</Box>

											<Divider />
											<Group justify="space-between">
												<Button
													variant="subtle"
													color="gray"
													onClick={() => setActive(2)}
												>
													Cancelar y Volver
												</Button>
											</Group>
										</>
									) : (
										<Stack align="center" py="xl" gap="md">
											<ActionIcon
												size={100}
												radius="100%"
												color="green.7"
												variant="filled"
											>
												<CheckCircle2 size={60} color="white" />
											</ActionIcon>
											<Title order={2} c="#2c3136" mt="md">
												¡Cita Confirmada!
											</Title>
											<Text ta="center" c="dimmed" maxW={500} size="lg">
												Su cita para <b>{formData.tramite.toUpperCase()}</b> ha
												sido agendada exitosamente para el día{" "}
												<Text span fw={700} c="#2c3136">
													{selectedDate}
												</Text>{" "}
												a las{" "}
												<Text span fw={700} c="#2c3136">
													{selectedTime}
												</Text>
												.
											</Text>
											<Card
												withBorder
												bg="#f8f9fa"
												w="100%"
												mt="lg"
												p="xl"
												radius="md"
											>
												<Stack align="center" gap={4}>
													<Text
														size="sm"
														fw={600}
														c="dimmed"
														textTransform="uppercase"
													>
														Código de Agendamiento
													</Text>
													<Text
														size="xl"
														fw={800}
														c="#e03131"
														style={{ letterSpacing: "2px" }}
													>
														TRZ-88392
													</Text>
												</Stack>
											</Card>
											<Text size="sm" c="dimmed" ta="center" mt="md">
												Se ha enviado un correo electrónico a{" "}
												<b>{formData.correo}</b> con los detalles e
												instrucciones de su cita.
											</Text>
											<Button
												size="lg"
												mt="xl"
												color="#2c3136"
												onClick={() => (window.location.href = "/")}
											>
												Volver al Inicio
											</Button>
										</Stack>
									)}
								</Stack>
							)}
						</Box>
					</Box>
				</Paper>
			</Container>
		</Box>
	);
}
