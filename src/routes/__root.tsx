import {
	Anchor,
	AppShell,
	Avatar,
	Burger,
	Button,
	Container,
	Group,
	Menu,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
	createRootRoute,
	Link,
	Outlet,
	useNavigate,
} from "@tanstack/react-router";
import { LogIn, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import pb from "#/lib/pb";

import "../styles.css";

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	const [opened, { toggle }] = useDisclosure();
	const [isLoggedIn, setIsLoggedIn] = useState(pb.authStore.isValid);
	const navigate = useNavigate();

	useEffect(() => {
		const unsubscribe = pb.authStore.onChange(() => {
			setIsLoggedIn(pb.authStore.isValid);
		});
		return unsubscribe;
	}, []);

	const handleLogout = () => {
		pb.authStore.clear();
		setIsLoggedIn(false);
		navigate({ to: "/" });
	};

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
							{isLoggedIn ? (
								<Menu shadow="md" width={200}>
									<Menu.Target>
										<Avatar
											color="teal"
											radius="xl"
											style={{ cursor: "pointer" }}
										>
											<User size={16} />
										</Avatar>
									</Menu.Target>
									<Menu.Dropdown>
										<Menu.Label>{pb.authStore.record?.email}</Menu.Label>
										<Menu.Divider />
										<Menu.Item
											leftSection={<LogOut size={14} />}
											onClick={handleLogout}
											color="red"
										>
											Cerrar Sesión
										</Menu.Item>
									</Menu.Dropdown>
								</Menu>
							) : (
								<Button
									component={Link}
									to="/login"
									leftSection={<LogIn size={16} />}
									size="sm"
									variant="light"
									color="teal"
								>
									Iniciar Sesión
								</Button>
							)}
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
					{isLoggedIn ? (
						<Anchor
							underline="never"
							c="red.7"
							fw={500}
							onClick={() => {
								handleLogout();
								toggle();
							}}
							style={{ cursor: "pointer" }}
						>
							Cerrar Sesión
						</Anchor>
					) : (
						<Anchor
							component={Link}
							to="/login"
							underline="never"
							c="teal.7"
							fw={500}
							onClick={toggle}
						>
							Iniciar Sesión
						</Anchor>
					)}
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
