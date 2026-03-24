import {
	Button,
	Card,
	Container,
	Group,
	SimpleGrid,
	Stack,
	Text,
	ThemeIcon,
	Title,
} from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	CalendarClock,
	Car,
	Clock,
	FileText,
	MapPin,
	Phone,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: LandingPage });

function LandingPage() {
	return (
		<Container size="lg" py="xl">
			<Stack gap="xl">
				{/* Hero Section */}
				<Stack align="center" gap="md" py="xl" ta="center">
					<ThemeIcon size={80} radius="xl" variant="light" color="teal">
						<Car size={40} />
					</ThemeIcon>
					<Title order={1} size="h1">
						SIMUT Tuluá
					</Title>
					<Text size="xl" c="dimmed" maw={600}>
						Secretaría de Infraestructura y Movilidad Urbana de Tuluá
					</Text>
					<Text size="lg" maw={500}>
						Agenda tu cita de manera rápida y sencilla. Evita filas y optimiza
						tu tiempo.
					</Text>
					<Button size="lg" color="teal" component={Link} to="/">
						Agendar una Cita
					</Button>
				</Stack>

				{/* Features */}
				<Title order={2} ta="center" mt="xl">
					Servicios Disponibles
				</Title>
				<SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
					<Card shadow="sm" padding="lg" radius="md" withBorder>
						<Stack>
							<ThemeIcon size="lg" variant="light" color="teal">
								<CalendarClock size={24} />
							</ThemeIcon>
							<Title order={3} size="h4">
								Agendamiento de Citas
							</Title>
							<Text size="sm" c="dimmed">
								Programa tu cita en línea para cualquier trámite de transporte.
								Disponible las 24 horas.
							</Text>
						</Stack>
					</Card>

					<Card shadow="sm" padding="lg" radius="md" withBorder>
						<Stack>
							<ThemeIcon size="lg" variant="light" color="teal">
								<FileText size={24} />
							</ThemeIcon>
							<Title order={3} size="h4">
								Trámites Vehiculares
							</Title>
							<Text size="sm" c="dimmed">
								Registro, traspaso, matrícula y más. Gestiona todos tus trámites
								de forma digital.
							</Text>
						</Stack>
					</Card>

					<Card shadow="sm" padding="lg" radius="md" withBorder>
						<Stack>
							<ThemeIcon size="lg" variant="light" color="teal">
								<Clock size={24} />
							</ThemeIcon>
							<Title order={3} size="h4">
								Horarios Flexibles
							</Title>
							<Text size="sm" c="dimmed">
								Elige el horario que mejor se adapte a tu agenda. Atención de
								lunes a viernes.
							</Text>
						</Stack>
					</Card>
				</SimpleGrid>

				{/* Info Section */}
				<Card shadow="sm" padding="xl" radius="md" withBorder mt="xl">
					<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
						<Stack>
							<Title order={3}>Ubicación</Title>
							<Group gap="xs">
								<MapPin size={18} />
								<Text>Carrera 26 #14-30, Tuluá, Valle del Cauca</Text>
							</Group>
						</Stack>
						<Stack>
							<Title order={3}>Contacto</Title>
							<Group gap="xs">
								<Phone size={18} />
								<Text>(2) 224 1234</Text>
							</Group>
							<Text size="sm" c="dimmed">
								Horario de atención: Lunes a Viernes, 8:00 AM - 5:00 PM
							</Text>
						</Stack>
					</SimpleGrid>
				</Card>
			</Stack>
		</Container>
	);
}
