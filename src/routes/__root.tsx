import {
	AppShell,
	Box,
	Container,
	Group,
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

import "../styles.css";

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	const router = useRouterState();

	const links = [
		{ label: "Inicio", link: "/" },
		{ label: "Agendar Trámite", link: "/agendar" },
		{ label: "Mi Cuenta", link: "/login" },
	];

	return (
		<AppShell header={{ height: 80 }} bg="#f4f6f8">
			<AppShell.Header
				withBorder={false}
				style={{
					boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
					backgroundColor: "white",
				}}
			>
				<Container size="lg" h="100%">
					<Group h="100%" justify="space-between">
						<Group
							gap="xs"
							style={{ cursor: "pointer" }}
							component={Link}
							to="/"
							px={0}
							className="mantine-focus-auto"
						>
							<Box
								style={{
									position: "relative",
									width: 40,
									height: 40,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								{/* Custom Logo S - Green and Red */}
								<svg
									width="40"
									height="40"
									viewBox="0 0 40 40"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<title>Logo SIMUT</title>
									<path
										d="M22 10C22 10 17 8 13 12C9 16 12 21 17 21C22 21 24 26 21 30C18 34 11 31 11 31"
										stroke="#2B8A3E"
										strokeWidth="5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
									<path
										d="M29 9C29 9 24 6 19 10C14 14 17 20 23 20C29 20 31 26 27 31C23 36 15 33 15 33"
										stroke="#E03131"
										strokeWidth="5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</Box>
							<Box style={{ marginLeft: "-4px" }}>
								<Title
									order={3}
									c="dark.9"
									style={{
										lineHeight: 1,
										letterSpacing: "-0.5px",
										fontWeight: 800,
										fontSize: "22px",
									}}
								>
									SIMUT
								</Title>
								<Text
									size="sm"
									fw={600}
									c="dark.7"
									style={{ lineHeight: 1, marginTop: "2px", fontSize: "13px" }}
								>
									Tuluá
								</Text>
							</Box>
						</Group>

						<Group visibleFrom="sm" gap={0} h="100%">
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
										px="lg"
										h="100%"
										style={{
											display: "flex",
											alignItems: "center",
											borderBottom: isActive
												? "3px solid #ef4444"
												: "3px solid transparent",
											color: isActive
												? "var(--mantine-color-dark-9)"
												: "var(--mantine-color-gray-8)",
											fontWeight: isActive ? 600 : 500,
											fontSize: "15px",
											transition: "border-color 0.2s ease",
										}}
									>
										{link.label}
									</UnstyledButton>
								);
							})}
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
