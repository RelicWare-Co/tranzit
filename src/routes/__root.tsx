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
						<Group
							gap="sm"
							style={{ cursor: "pointer" }}
							component={Link}
							to="/"
							px={0}
							className="mantine-focus-auto"
						>
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
