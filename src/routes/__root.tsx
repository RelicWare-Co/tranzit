import {
	Anchor,
	AppShell,
	Burger,
	Container,
	Group,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

import "../styles.css";

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	const [opened, { toggle }] = useDisclosure();

	return (
		<AppShell header={{ height: 64 }} padding="md">
			<AppShell.Header>
				<Container size="lg" h="100%">
					<Group h="100%" justify="space-between">
						<Group>
							<Title order={3} c="teal">
								SIMUT
							</Title>
							<Group visibleFrom="sm" gap="lg">
								<Anchor
									component={Link}
									to="/"
									underline="never"
									c="gray.7"
									fw={500}
								>
									Inicio
								</Anchor>
							</Group>
						</Group>
						<Burger
							opened={opened}
							onClick={toggle}
							hiddenFrom="sm"
							size="sm"
						/>
						<Group visibleFrom="sm">
							<Anchor
								component={Link}
								to="/"
								underline="never"
								c="teal.7"
								fw={600}
							>
								Agendar Cita
							</Anchor>
						</Group>
					</Group>
				</Container>
			</AppShell.Header>

			<AppShell.Navbar p="md">
				<Stack gap="md">
					<Anchor
						component={Link}
						to="/"
						underline="never"
						c="gray.7"
						fw={500}
						onClick={toggle}
					>
						Inicio
					</Anchor>
					<Anchor
						component={Link}
						to="/"
						underline="never"
						c="teal.7"
						fw={600}
						onClick={toggle}
					>
						Agendar Cita
					</Anchor>
				</Stack>
			</AppShell.Navbar>

			<AppShell.Main>
				<Outlet />
			</AppShell.Main>

			<footer
				style={{
					borderTop: "1px solid var(--mantine-color-gray-3)",
					padding: "2rem 1rem",
					marginTop: "2rem",
				}}
			>
				<Container size="lg">
					<Group justify="center">
						<Text size="sm" c="dimmed">
							&copy; {new Date().getFullYear()} SIMUT - Secretaría de
							Infraestructura y Movilidad Urbana de Tuluá
						</Text>
					</Group>
				</Container>
			</footer>
		</AppShell>
	);
}
