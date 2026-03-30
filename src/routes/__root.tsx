import {
	AppShell,
	Avatar,
	Box,
	Container,
	Group,
	Menu,
	Text,
	Title,
	UnstyledButton,
} from "@mantine/core";
import {
	createRootRoute,
	Link,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { ChevronDown, LogOut, User } from "lucide-react";
import { useAuth } from "../lib/AuthContext";

import "../styles.css";

export const Route = createRootRoute({
	component: RootComponent,
});

function UserMenu() {
	const { user, logout, isAuthenticated } = useAuth();
	const router = useRouterState();
	const isProfileActive = router.location.pathname === "/mi-perfil";

	if (!isAuthenticated || !user) {
		return (
			<UnstyledButton
				component={Link}
				to="/login"
				px="sm"
				h="100%"
				style={{
					display: "flex",
					alignItems: "center",
					borderBottom: isProfileActive
						? "2px solid #e03131"
						: "2px solid transparent",
					color: isProfileActive ? "#111827" : "#4b5563",
					fontWeight: 600,
					fontSize: "14px",
					transition: "all 0.2s ease",
					marginBottom: isProfileActive ? "-2px" : "0",
				}}
			>
				Iniciar Sesión
			</UnstyledButton>
		);
	}

	const initials = user.name
		? user.name
				.split(" ")
				.map((n: string) => n[0])
				.join("")
				.slice(0, 2)
				.toUpperCase()
		: user.email?.[0].toUpperCase() || "U";

	return (
		<Menu position="bottom-end" offset={4} withArrow arrowPosition="center">
			<Menu.Target>
				<UnstyledButton
					px="sm"
					h="100%"
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						borderBottom: isProfileActive
							? "2px solid #e03131"
							: "2px solid transparent",
						color: isProfileActive ? "#111827" : "#4b5563",
						fontWeight: 600,
						fontSize: "14px",
						transition: "all 0.2s ease",
						marginBottom: isProfileActive ? "-2px" : "0",
					}}
				>
					<Avatar
						size="sm"
						radius="xl"
						color="#e03131"
						style={{
							backgroundColor: "#fef2f2",
							border: "2px solid #e03131",
							fontWeight: 700,
							fontSize: "12px",
						}}
					>
						{initials}
					</Avatar>
					<Text size="sm" fw={600} c={isProfileActive ? "#111827" : "#4b5563"}>
						Mi Perfil
					</Text>
					<ChevronDown size={16} color="#9ca3af" />
				</UnstyledButton>
			</Menu.Target>

			<Menu.Dropdown
				style={{
					border: "1px solid #e5e7eb",
					boxShadow:
						"0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
					borderRadius: "12px",
					padding: "4px",
					minWidth: "200px",
				}}
			>
				<Menu.Item
					component={Link}
					to="/mi-perfil"
					leftSection={<User size={16} color="#6b7280" />}
					style={{
						borderRadius: "8px",
						fontWeight: 500,
						fontSize: "14px",
						padding: "10px 12px",
					}}
				>
					Ver mi perfil
				</Menu.Item>
				<Menu.Divider style={{ margin: "4px 0" }} />
				<Menu.Item
					leftSection={<LogOut size={16} color="#e03131" />}
					onClick={logout}
					style={{
						borderRadius: "8px",
						fontWeight: 500,
						fontSize: "14px",
						padding: "10px 12px",
						color: "#e03131",
					}}
				>
					Cerrar sesión
				</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	);
}

function RootComponent() {
	const router = useRouterState();

	const links = [
		{ label: "Inicio", link: "/" },
		{ label: "Agendar Trámite", link: "/agendar" },
	];

	return (
		<AppShell header={{ height: 72 }} bg="#f8f9fa">
			<AppShell.Header
				withBorder={false}
				style={{
					boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
					backgroundColor: "white",
					borderBottom: "1px solid #f3f4f6",
				}}
			>
				<Container size="lg" h="100%">
					<Group h="100%" justify="space-between">
						<UnstyledButton
							renderRoot={(props) => <Link {...props} to="/" />}
							px={0}
							style={{
								cursor: "pointer",
								background: "transparent",
								border: "none",
							}}
						>
							<Group gap="sm">
								<Box
									style={{
										position: "relative",
										width: 36,
										height: 36,
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									{/* Custom Logo S - Green and Red */}
									<svg
										width="36"
										height="36"
										viewBox="0 0 40 40"
										fill="none"
										xmlns="http://www.w3.org/2000/svg"
									>
										<title>Logo SIMUT</title>
										<path
											d="M22 10C22 10 17 8 13 12C9 16 12 21 17 21C22 21 24 26 21 30C18 34 11 31 11 31"
											stroke="#16a34a"
											strokeWidth="5"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
										<path
											d="M29 9C29 9 24 6 19 10C14 14 17 20 23 20C29 20 31 26 27 31C23 36 15 33 15 33"
											stroke="#e03131"
											strokeWidth="5"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								</Box>
								<Box style={{ marginLeft: "-2px" }}>
									<Title
										order={3}
										c="#111827"
										style={{
											lineHeight: 1,
											letterSpacing: "-0.5px",
											fontWeight: 800,
											fontSize: "20px",
										}}
									>
										SIMUT
									</Title>
									<Text
										size="xs"
										fw={600}
										c="gray.5"
										style={{
											lineHeight: 1,
											marginTop: "2px",
											letterSpacing: "0.5px",
											textTransform: "uppercase",
										}}
									>
										Tuluá
									</Text>
								</Box>
							</Group>
						</UnstyledButton>

						<Group visibleFrom="sm" gap={16} h="100%">
							{links.map((link) => {
								const isActive =
									router.location.pathname === link.link ||
									(link.link !== "/" &&
										router.location.pathname.startsWith(link.link));
								return (
									<UnstyledButton
										key={link.label}
										component={Link}
										to={link.link}
										px="sm"
										h="100%"
										style={{
											display: "flex",
											alignItems: "center",
											borderBottom: isActive
												? "2px solid #e03131"
												: "2px solid transparent",
											color: isActive ? "#111827" : "#4b5563",
											fontWeight: 600,
											fontSize: "14px",
											transition: "all 0.2s ease",
											marginBottom: isActive ? "-2px" : "0", // to make border flush
										}}
									>
										{link.label}
									</UnstyledButton>
								);
							})}
							<UserMenu />
						</Group>
					</Group>
				</Container>
			</AppShell.Header>

			<AppShell.Main>
				<Outlet />
			</AppShell.Main>
		</AppShell>
	);
}
