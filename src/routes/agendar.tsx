import {
	Alert,
	Box,
	Button,
	Card,
	Container,
	Divider,
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
import { AlertTriangle, Car, Check, Clock, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";

export const Route = createFileRoute("/agendar")({
	component: AgendarCita,
});

const STEPS = [
	{ id: 0, label: "Verificar Correo" },
	{ id: 1, label: "Validar Placa" },
	{ id: 2, label: "Datos Solicitante" },
	{ id: 3, label: "Fecha y Hora" },
	{ id: 4, label: "Confirmación" },
];

function AgendarCita() {
	const { isAuthenticated, sendVerificationOtp, signInEmailOtp } = useAuth();
	const [active, setActive] = useState(0);

	// Step 0: OTP Authentication
	const [otpEmail, setOtpEmail] = useState("");
	const [otpCode, setOtpCode] = useState("");
	const [otpSent, setOtpSent] = useState(false);
	const [otpSending, setOtpSending] = useState(false);
	const [otpVerifying, setOtpVerifying] = useState(false);
	const [otpError, setOtpError] = useState("");

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
	const [timeLeft, setTimeLeft] = useState(300);
	const [codeSent, setCodeSent] = useState(false);
	const [verificationCode, setVerificationCode] = useState("");
	const [isConfirmed, setIsConfirmed] = useState(false);

	// Auto-advance if already authenticated
	useEffect(() => {
		if (isAuthenticated && active === 0) {
			setActive(1);
		}
	}, [isAuthenticated, active]);

	// Timer for confirmation step
	useEffect(() => {
		if (active === 4 && !isConfirmed && timeLeft > 0) {
			const timer = setInterval(() => {
				setTimeLeft((prev) => prev - 1);
			}, 1000);
			return () => clearInterval(timer);
		}
		if (timeLeft === 0 && !isConfirmed) {
			setActive(3);
			setSelectedTime(null);
			setTimeLeft(300);
		}
	}, [active, isConfirmed, timeLeft]);

	const formatTime = (seconds: number) => {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s.toString().padStart(2, "0")}`;
	};

	// OTP Handlers
	const handleSendOtp = async () => {
		setOtpError("");
		if (!otpEmail || !otpEmail.includes("@")) {
			setOtpError("Ingrese un correo electrónico válido.");
			return;
		}
		setOtpSending(true);
		try {
			await sendVerificationOtp(otpEmail, "sign-in");
			setOtpSent(true);
		} catch (err) {
			setOtpError(err instanceof Error ? err.message : "Error al enviar el código.");
		} finally {
			setOtpSending(false);
		}
	};

	const handleVerifyOtp = async () => {
		setOtpError("");
		if (otpCode.length < 6) {
			setOtpError("El código debe tener 6 dígitos.");
			return;
		}
		setOtpVerifying(true);
		try {
			await signInEmailOtp(otpEmail, otpCode);
			setActive(1);
		} catch (err) {
			setOtpError(err instanceof Error ? err.message : "Código inválido.");
			setOtpCode("");
		} finally {
			setOtpVerifying(false);
		}
	};

	// Placa validation (mock)
	const handleValidatePlaca = () => {
		setPlacaError("");
		if (placa.length < 5 || placa.length > 6) {
			setPlacaError("Formato de placa inválido.");
			return;
		}
		setIsValidating(true);
		setTimeout(() => {
			setIsValidating(false);
			if (placa.toUpperCase().startsWith("XXX")) {
				setPlacaError(
					"El vehículo no se encuentra registrado en la ciudad de Tuluá.",
				);
			} else {
				setActive(2);
			}
		}, 1000);
	};

	const handleSendCode = () => {
		setCodeSent(true);
	};

	const handleConfirm = () => {
		if (verificationCode.length === 4) {
			setIsConfirmed(true);
		}
	};

	// Premium Input Styles
	const inputStyles = {
		input: {
			backgroundColor: "#f9fafb",
			border: "1px solid #e5e7eb",
			borderRadius: "8px",
			color: "#111827",
			fontWeight: 500,
			transition: "all 0.2s ease",
			"&:focus": {
				borderColor: "#e03131",
				boxShadow: "0 0 0 2px rgba(224, 49, 49, 0.1)",
			},
		},
		label: {
			fontWeight: 600,
			color: "#374151",
			marginBottom: "6px",
			letterSpacing: "-0.2px",
		},
	};

	return (
		<Box pb={80} bg="#f8f9fa" mih="100vh">
			{/* Minimalist Header Area */}
			<Box
				style={{
					background: "#111827",
					padding: "140px 0 80px 0",
				}}
			>
				<Container size="md">
					<Title
						c="white"
						order={1}
						style={{
							letterSpacing: "-1px",
							fontSize: "2.5rem",
							fontWeight: 800,
							lineHeight: 1.1,
						}}
					>
						Agendar Cita
					</Title>
					<Text
						c="gray.4"
						mt="sm"
						size="lg"
						style={{ letterSpacing: "-0.2px" }}
					>
						Complete los pasos a continuación para programar su atención
						presencial.
					</Text>
				</Container>
			</Box>

			<Container size="md" mt="-40" style={{ position: "relative", zIndex: 2 }}>
				<Paper
					radius="xl"
					p={0}
					bg="white"
					style={{
						border: "1px solid #e5e7eb",
						boxShadow:
							"0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)",
						overflow: "hidden",
					}}
				>
					<Box p={{ base: "xl", sm: 40 }}>
						{/* Custom Premium Stepper Container */}
						<Box
							mb={40}
							style={{
								backgroundColor: "#f3f4f6",
								borderRadius: "9999px",
								padding: "4px",
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								position: "relative",
							}}
						>
							{STEPS.map((step, index) => {
								const isActive = index === active;
								const isCompleted = index < active;

								return (
									<Box
										key={step.id}
										style={{
											flex: 1,
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											padding: "10px 16px",
											borderRadius: "9999px",
											backgroundColor: isActive ? "#111827" : "transparent",
											color: isActive
												? "white"
												: isCompleted
													? "#111827"
													: "#6b7280",
											transition: "all 0.3s ease",
											position: "relative",
											zIndex: 1,
										}}
									>
										<Group gap={8} wrap="nowrap">
											{isCompleted ? (
												<Box
													style={{
														width: 20,
														height: 20,
														borderRadius: "50%",
														backgroundColor: "#e03131",
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
													}}
												>
													<Check size={12} color="white" strokeWidth={3} />
												</Box>
											) : (
												<Text
													fw={isActive ? 700 : 600}
													size="sm"
													style={{
														opacity: isActive ? 1 : 0.7,
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
													}}
												>
													{index + 1}
												</Text>
											)}
											<Text
												fw={isActive ? 600 : 500}
												size="sm"
												style={{
													letterSpacing: "-0.2px",
													whiteSpace: "nowrap",
													display: "none",
												}}
												className="step-label"
											>
												{step.label}
											</Text>
										</Group>
									</Box>
								);
							})}
						</Box>

						{/* Content Area */}
						<Box>
							{/* Step 0: OTP Authentication */}
							{active === 0 && (
								<Stack align="center" py="xl" maw={400} mx="auto">
									<Box
										style={{
											width: 80,
											height: 80,
											borderRadius: "24px",
											backgroundColor: "#fef2f2",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											marginBottom: "16px",
										}}
									>
										<Mail size={40} color="#e03131" />
									</Box>
									<Title
										order={3}
										c="#111827"
										style={{ letterSpacing: "-0.5px" }}
									>
										Verificar Correo
									</Title>
									<Text c="#6b7280" ta="center" mb="lg" size="sm">
										Ingrese su correo electrónico para recibir un código de
										verificación y continuar con el trámite.
									</Text>

									{!otpSent ? (
										<Stack w="100%" gap="md">
											<TextInput
												placeholder="correo@ejemplo.com"
												size="lg"
												radius="md"
												w="100%"
												value={otpEmail}
												onChange={(e) =>
													setOtpEmail(e.currentTarget.value.toLowerCase())
												}
												error={otpError}
												type="email"
												styles={{
													input: {
														backgroundColor: "#f9fafb",
														textAlign: "center",
														fontSize: "18px",
														fontWeight: 500,
														border: "1px solid #e5e7eb",
														borderRadius: "12px",
														color: "#111827",
														"&:focus": {
															borderColor: "#e03131",
															boxShadow: "0 0 0 2px rgba(224, 49, 49, 0.1)",
														},
													},
												}}
											/>
											<Button
												fullWidth
												size="lg"
												onClick={handleSendOtp}
												loading={otpSending}
												style={{
													backgroundColor: "#111827",
													borderRadius: "12px",
													fontWeight: 600,
													transition: "transform 0.1s ease",
												}}
												className="sleek-btn"
											>
												Enviar Código
											</Button>
										</Stack>
									) : (
										<Stack w="100%" gap="lg" align="center">
											<Text size="sm" c="#4b5563" ta="center">
												Ingrese el código de 6 dígitos enviado a{" "}
												<b style={{ color: "#111827" }}>{otpEmail}</b>
											</Text>
											<PinInput
												length={6}
												size="xl"
												value={otpCode}
												onChange={setOtpCode}
												type="number"
												styles={{
													input: {
														borderColor: "#e5e7eb",
														backgroundColor: "#f9fafb",
														color: "#111827",
														fontWeight: 800,
														fontSize: "24px",
														borderRadius: "8px",
														"&:focus": {
															borderColor: "#e03131",
														},
													},
												}}
											/>
											{otpError && (
												<Alert
													icon={<AlertTriangle size={16} />}
													title="Error"
													color="red"
													variant="light"
													w="100%"
													radius="md"
													style={{ border: "1px solid #fca5a5" }}
												>
													{otpError}
												</Alert>
											)}
											<Button
												size="lg"
												onClick={handleVerifyOtp}
												loading={otpVerifying}
												disabled={otpCode.length < 6}
												style={{
													backgroundColor: otpCode.length < 6 ? "#e5e7eb" : "#16a34a",
													color: otpCode.length < 6 ? "#9ca3af" : "white",
													borderRadius: "12px",
													fontWeight: 600,
													width: "200px",
												}}
												className={otpCode.length === 6 ? "sleek-btn" : ""}
											>
												Verificar
											</Button>
											<Button
												variant="subtle"
												color="gray"
												size="sm"
												onClick={() => {
													setOtpSent(false);
													setOtpCode("");
													setOtpError("");
												}}
												style={{ fontWeight: 600 }}
											>
												Cambiar correo
											</Button>
										</Stack>
									)}
								</Stack>
							)}

							{/* Step 1: Placa */}
							{active === 1 && (
								<Stack align="center" py="xl" maw={400} mx="auto">
									<Box
										style={{
											width: 80,
											height: 80,
											borderRadius: "24px",
											backgroundColor: "#f3f4f6",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											marginBottom: "16px",
										}}
									>
										<Car size={40} color="#111827" />
									</Box>
									<Title
										order={3}
										c="#111827"
										style={{ letterSpacing: "-0.5px" }}
									>
										Placa del Vehículo
									</Title>
									<Text c="#6b7280" ta="center" mb="lg" size="sm">
										Ingrese la placa para validar que se encuentra en nuestra
										base de datos.
									</Text>
									<TextInput
										placeholder="ABC123"
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
												backgroundColor: "#f9fafb",
												textAlign: "center",
												fontSize: "24px",
												letterSpacing: "4px",
												fontWeight: 700,
												textTransform: "uppercase",
												border: "1px solid #e5e7eb",
												borderRadius: "12px",
												color: "#111827",
												"&:focus": {
													borderColor: "#e03131",
													boxShadow: "0 0 0 2px rgba(224, 49, 49, 0.1)",
												},
											},
										}}
									/>
									<Button
										fullWidth
										size="lg"
										onClick={handleValidatePlaca}
										loading={isValidating}
										style={{
											backgroundColor: "#111827",
											borderRadius: "12px",
											fontWeight: 600,
											transition: "transform 0.1s ease",
										}}
										className="sleek-btn"
									>
										Continuar
									</Button>
									{placaError && (
										<Alert
											icon={<AlertTriangle size={16} />}
											title="Atención"
											color="red"
											variant="light"
											mt="lg"
											w="100%"
											radius="md"
											style={{ border: "1px solid #fca5a5" }}
										>
											{placaError}
										</Alert>
									)}
								</Stack>
							)}

							{/* Step 2: Datos Solicitante */}
							{active === 2 && (
								<Stack maw={650} mx="auto" gap="xl">
									<Box>
										<Title
											order={4}
											c="#111827"
											mb="xl"
											style={{ letterSpacing: "-0.5px" }}
										>
											Detalles de la Solicitud
										</Title>
										<Grid gap="xl">
											<Grid.Col span={12}>
												<TextInput
													label="Placa a gestionar"
													value={placa}
													readOnly
													styles={{
														input: {
															...inputStyles.input,
															backgroundColor: "#f3f4f6",
															color: "#4b5563",
															fontWeight: 700,
															cursor: "not-allowed",
														},
														label: inputStyles.label,
													}}
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
													styles={inputStyles}
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
													styles={inputStyles}
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
													styles={inputStyles}
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
													styles={inputStyles}
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
													styles={inputStyles}
												/>
											</Grid.Col>
										</Grid>
									</Box>

									<Divider color="#f3f4f6" />

									<Group justify="space-between">
										<Button
											variant="subtle"
											color="gray"
											onClick={() => setActive(1)}
											size="md"
											style={{ fontWeight: 600, color: "#6b7280" }}
										>
											Atrás
										</Button>
										<Button
											size="md"
											onClick={() => setActive(3)}
											disabled={
												!formData.nombre ||
												!formData.identificacion ||
												!formData.tramite ||
												!formData.telefono ||
												!formData.correo
											}
											style={{
												backgroundColor: "#111827",
												borderRadius: "8px",
												fontWeight: 600,
											}}
											className="sleek-btn"
										>
											Siguiente Paso
										</Button>
									</Group>
								</Stack>
							)}

							{/* Step 3: Fecha y Hora */}
							{active === 3 && (
								<Stack maw={650} mx="auto" gap="xl">
									<Box>
										<Title
											order={4}
											c="#111827"
											mb="xs"
											style={{ letterSpacing: "-0.5px" }}
										>
											Disponibilidad
										</Title>
										<Text c="#6b7280" size="sm">
											Seleccione un día y un horario disponible para su atención
											presencial.
										</Text>
									</Box>

									<Grid gap="xl">
										<Grid.Col span={{ base: 12, md: 6 }}>
											<Text fw={600} size="sm" mb="md" c="#374151">
												1. Días Disponibles
											</Text>
											<Stack gap="sm">
												{["2026-03-30", "2026-03-31", "2026-04-01"].map(
													(date) => (
														<Button
															key={date}
															variant="outline"
															onClick={() => {
																setSelectedDate(date);
																setSelectedTime(null);
															}}
															fullWidth
															justify="flex-start"
															size="md"
															style={{
																border:
																	selectedDate === date
																		? "2px solid #e03131"
																		: "1px solid #e5e7eb",
																backgroundColor:
																	selectedDate === date ? "#fff5f5" : "#f9fafb",
																color:
																	selectedDate === date ? "#e03131" : "#111827",
																borderRadius: "8px",
																fontWeight: 600,
																transition: "all 0.2s ease",
															}}
														>
															{new Date(date).toLocaleDateString("es-ES", {
																weekday: "long",
																month: "long",
																day: "numeric",
															})}
														</Button>
													),
												)}
											</Stack>
										</Grid.Col>
										<Grid.Col span={{ base: 12, md: 6 }}>
											<Text fw={600} size="sm" mb="md" c="#374151">
												2. Horarios
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
															variant="outline"
															onClick={() => setSelectedTime(time)}
															size="sm"
															style={{
																border:
																	selectedTime === time
																		? "2px solid #111827"
																		: "1px solid #e5e7eb",
																backgroundColor:
																	selectedTime === time
																		? "#111827"
																		: "transparent",
																color:
																	selectedTime === time ? "white" : "#4b5563",
																borderRadius: "8px",
																fontWeight: 600,
																transition: "all 0.2s ease",
															}}
														>
															{time}
														</Button>
													))}
												</Group>
											) : (
												<Box
													p="md"
													bg="#f9fafb"
													style={{
														borderRadius: "8px",
														border: "1px dashed #e5e7eb",
													}}
												>
													<Text size="sm" c="#6b7280" ta="center">
														Seleccione una fecha primero.
													</Text>
												</Box>
											)}
										</Grid.Col>
									</Grid>

									<Divider color="#f3f4f6" />

									<Group justify="space-between">
										<Button
											variant="subtle"
											color="gray"
											onClick={() => setActive(2)}
											size="md"
											style={{ fontWeight: 600, color: "#6b7280" }}
										>
											Atrás
										</Button>
										<Button
											size="md"
											onClick={() => {
												setActive(4);
												setTimeLeft(300);
											}}
											disabled={!selectedDate || !selectedTime}
											style={{
												backgroundColor: "#e03131",
												borderRadius: "8px",
												fontWeight: 600,
											}}
											className="sleek-btn"
										>
											Confirmar Horario
										</Button>
									</Group>
								</Stack>
							)}

							{/* Step 4: Confirmación */}
							{active === 4 && (
								<Stack maw={650} mx="auto" gap="xl">
									{!isConfirmed ? (
										<>
											<Alert
												icon={<Clock size={20} />}
												color="yellow.8"
												variant="light"
												style={{
													border: "1px solid #fde047",
													backgroundColor: "#fefce8",
													borderRadius: "12px",
												}}
											>
												<Group
													justify="space-between"
													align="center"
													wrap="nowrap"
												>
													<Box>
														<Text fw={700} size="sm" c="#854d0e">
															Reserva Temporal
														</Text>
														<Text size="sm" c="#a16207" mt={4}>
															Complete la confirmación en los próximos{" "}
															<b>{formatTime(timeLeft)}</b>.
														</Text>
													</Box>
												</Group>
											</Alert>

											<Card
												radius="xl"
												p="xl"
												bg="#f9fafb"
												style={{ border: "1px solid #e5e7eb" }}
											>
												<Group justify="space-between" mb="lg">
													<Title order={5} c="#111827">
														Resumen de Cita
													</Title>
												</Group>
												<Grid gap="lg">
													<Grid.Col span={6}>
														<Text
															size="xs"
															c="#6b7280"
															fw={600}
															style={{
																textTransform: "uppercase",
																letterSpacing: "0.5px",
															}}
														>
															Trámite
														</Text>
														<Text fw={600} c="#111827" mt={4}>
															{formData.tramite.toUpperCase()}
														</Text>
													</Grid.Col>
													<Grid.Col span={6}>
														<Text
															size="xs"
															c="#6b7280"
															fw={600}
															style={{
																textTransform: "uppercase",
																letterSpacing: "0.5px",
															}}
														>
															Placa
														</Text>
														<Text fw={600} c="#111827" mt={4}>
															{placa}
														</Text>
													</Grid.Col>
													<Grid.Col span={6}>
														<Text
															size="xs"
															c="#6b7280"
															fw={600}
															style={{
																textTransform: "uppercase",
																letterSpacing: "0.5px",
															}}
														>
															Fecha
														</Text>
														<Text fw={600} c="#111827" mt={4}>
															{selectedDate}
														</Text>
													</Grid.Col>
													<Grid.Col span={6}>
														<Text
															size="xs"
															c="#6b7280"
															fw={600}
															style={{
																textTransform: "uppercase",
																letterSpacing: "0.5px",
															}}
														>
															Hora
														</Text>
														<Text fw={600} c="#111827" mt={4}>
															{selectedTime}
														</Text>
													</Grid.Col>
												</Grid>
											</Card>

											<Box
												p="xl"
												style={{
													borderRadius: "16px",
													border: "1px solid #e5e7eb",
													backgroundColor: "white",
												}}
											>
												<Title order={5} mb="md" c="#111827" ta="center">
													Verificación de Identidad
												</Title>
												{!codeSent ? (
													<Stack gap="lg" align="center">
														<Text
															size="sm"
															c="#4b5563"
															ta="center"
															style={{ lineHeight: 1.5 }}
														>
															Para confirmar su identidad, le enviaremos un
															código al correo{" "}
															<b style={{ color: "#111827" }}>
																{formData.correo}
															</b>
															.
														</Text>
														<Button
															onClick={handleSendCode}
															size="md"
															style={{
																backgroundColor: "#111827",
																borderRadius: "8px",
																fontWeight: 600,
															}}
															className="sleek-btn"
														>
															Enviar Código
														</Button>
													</Stack>
												) : (
													<Stack align="center" gap="lg">
														<Text size="sm" c="#4b5563" ta="center">
															Ingrese el código de 4 dígitos enviado.
														</Text>
														<PinInput
															length={4}
															size="xl"
															value={verificationCode}
															onChange={setVerificationCode}
															type="number"
															styles={{
																input: {
																	borderColor: "#e5e7eb",
																	backgroundColor: "#f9fafb",
																	color: "#111827",
																	fontWeight: 800,
																	fontSize: "24px",
																	borderRadius: "8px",
																	"&:focus": {
																		borderColor: "#e03131",
																	},
																},
															}}
														/>
														<Button
															size="md"
															mt="sm"
															onClick={handleConfirm}
															disabled={verificationCode.length < 4}
															style={{
																backgroundColor:
																	verificationCode.length < 4
																		? "#e5e7eb"
																		: "#16a34a",
																color:
																	verificationCode.length < 4
																		? "#9ca3af"
																		: "white",
																borderRadius: "8px",
																fontWeight: 600,
																width: "200px",
															}}
															className={
																verificationCode.length === 4 ? "sleek-btn" : ""
															}
														>
															Verificar
														</Button>
													</Stack>
												)}
											</Box>

											<Group justify="center" mt="md">
												<Button
													variant="subtle"
													color="gray"
													onClick={() => setActive(3)}
													size="sm"
												>
													Cancelar
												</Button>
											</Group>
										</>
									) : (
										<Stack align="center" py={40} gap="xl">
											<Box
												style={{
													width: 80,
													height: 80,
													borderRadius: "50%",
													backgroundColor: "#dcfce7",
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
												}}
											>
												<Check size={40} color="#16a34a" strokeWidth={3} />
											</Box>
											<Title
												order={2}
												c="#111827"
												style={{ letterSpacing: "-1px" }}
											>
												¡Cita Confirmada!
											</Title>
											<Text
												ta="center"
												c="#4b5563"
												maw={450}
												size="md"
												style={{ lineHeight: 1.5 }}
											>
												Su cita ha sido agendada exitosamente. Le esperamos el
												día{" "}
												<Text span fw={700} c="#111827">
													{selectedDate}
												</Text>{" "}
												a las{" "}
												<Text span fw={700} c="#111827">
													{selectedTime}
												</Text>
												.
											</Text>

											<Card
												withBorder
												bg="#f9fafb"
												w="100%"
												maw={400}
												mt="md"
												p="xl"
												radius="xl"
												style={{ border: "1px dashed #d1d5db" }}
											>
												<Stack align="center" gap={8}>
													<Text
														size="xs"
														fw={600}
														c="#6b7280"
														style={{
															textTransform: "uppercase",
															letterSpacing: "1px",
														}}
													>
														Código de Agendamiento
													</Text>
													<Text
														size="xl"
														fw={800}
														c="#111827"
														style={{ letterSpacing: "2px" }}
													>
														TRZ-88392
													</Text>
												</Stack>
											</Card>

											<Button
												size="lg"
												mt="xl"
												onClick={() => (window.location.href = "/")}
												style={{
													backgroundColor: "#111827",
													borderRadius: "12px",
													fontWeight: 600,
												}}
												className="sleek-btn"
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

			<style>{`
				.sleek-btn:hover {
					transform: translateY(-1px);
					box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
				}
				.sleek-btn:active {
					transform: translateY(0);
				}
				@media (min-width: 640px) {
					.step-label {
						display: block !important;
					}
				}
			`}</style>
		</Box>
	);
}
