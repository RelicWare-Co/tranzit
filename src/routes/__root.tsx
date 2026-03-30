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

// Glass pill navigation item
function NavPill({
	label,
	to,
	isActive,
}: {
	label: string;
	to: string;
	isActive: boolean;
}) {
	return (
		<Link
			to={to}
			style={{
				textDecoration: "none",
				padding: "10px 20px",
				borderRadius: "9999px",
				fontWeight: 600,
				fontSize: "14px",
				letterSpacing: "-0.2px",
				color: isActive ? "#111827" : "#6b7280",
				backgroundColor: isActive ? "#f3f4f6" : "transparent",
				transition: "all 400ms cubic-bezier(0.32, 0.72, 0, 1)",
				display: "inline-block",
			}}
			onMouseEnter={(e) => {
				if (!isActive) {
					e.currentTarget.style.backgroundColor = "#f9fafb";
					e.currentTarget.style.color = "#111827";
				}
			}}
			onMouseLeave={(e) => {
				if (!isActive) {
					e.currentTarget.style.backgroundColor = "transparent";
					e.currentTarget.style.color = "#6b7280";
				}
			}}
		>
			{label}
		</Link>
	);
}

function UserMenu() {
	const { user, logout, isAuthenticated } = useAuth();
	const router = useRouterState();
	const isProfileActive = router.location.pathname === "/mi-perfil";

	if (!isAuthenticated || !user) {
		return (
			<Link
				to="/login"
				style={{
					textDecoration: "none",
					padding: "10px 24px",
					borderRadius: "9999px",
					fontWeight: 600,
					fontSize: "14px",
					letterSpacing: "-0.2px",
					color: "#111827",
					backgroundColor: isProfileActive ? "#fef2f2" : "#ffffff",
					border: isProfileActive
						? "1.5px solid #e03131"
						: "1.5px solid #e5e7eb",
					boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
					transition: "all 400ms cubic-bezier(0.32, 0.72, 0, 1)",
					display: "inline-flex",
					alignItems: "center",
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
					e.currentTarget.style.transform = "translateY(-1px)";
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
					e.currentTarget.style.transform = "translateY(0)";
				}}
			>
				Iniciar Sesión
			</Link>
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
		<Menu
			position="bottom-end"
			offset={8}
			withArrow
			arrowPosition="center"
			styles={{
				dropdown: {
					backgroundColor: "rgba(255, 255, 255, 0.95)",
					backdropFilter: "blur(20px)",
					border: "1px solid rgba(0, 0, 0, 0.08)",
					borderRadius: "20px",
					padding: "8px",
					boxShadow: "0 20px 40px -12px rgba(0,0,0,0.15)",
					minWidth: "220px",
				},
				arrow: {
					backgroundColor: "rgba(255, 255, 255, 0.95)",
					border: "1px solid rgba(0, 0, 0, 0.08)",
				},
			}}
		>
			<Menu.Target>
				<UnstyledButton
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: "10px",
						padding: "6px 20px 6px 6px",
						borderRadius: "9999px",
						backgroundColor: isProfileActive ? "#fef2f2" : "#ffffff",
						border: isProfileActive
							? "1.5px solid rgba(224, 49, 49, 0.3)"
							: "1.5px solid rgba(0, 0, 0, 0.08)",
						boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
						transition: "all 400ms cubic-bezier(0.32, 0.72, 0, 1)",
						cursor: "pointer",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
						e.currentTarget.style.transform = "translateY(-1px)";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
						e.currentTarget.style.transform = "translateY(0)";
					}}
				>
					<Avatar
						size="md"
						radius="xl"
						color="#e03131"
						style={{
							backgroundColor: "#fef2f2",
							border: "2px solid #e03131",
							fontWeight: 700,
							fontSize: "13px",
							boxShadow: "0 2px 4px rgba(224, 49, 49, 0.1)",
						}}
					>
						{initials}
					</Avatar>
					<Text
						style={{
							fontSize: "14px",
							fontWeight: 600,
							color: isProfileActive ? "#111827" : "#4b5563",
							letterSpacing: "-0.2px",
						}}
					>
						Mi Perfil
					</Text>
					<ChevronDown
						size={16}
						color="#9ca3af"
						style={{
							transition: "transform 300ms ease",
						}}
						className="chevron-icon"
					/>
				</UnstyledButton>
			</Menu.Target>

			<Menu.Dropdown>
				<Menu.Item
					component={Link}
					to="/mi-perfil"
					leftSection={
						<Box
							style={{
								width: "32px",
								height: "32px",
								borderRadius: "10px",
								backgroundColor: "#f3f4f6",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<User size={16} color="#6b7280" />
						</Box>
					}
					style={{
						borderRadius: "12px",
						fontWeight: 600,
						fontSize: "14px",
						padding: "12px 16px",
						color: "#111827",
						transition: "all 200ms ease",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = "#f9fafb";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = "transparent";
					}}
				>
					Ver mi perfil
				</Menu.Item>
				<Menu.Divider
					style={{
						margin: "6px 8px",
						borderColor: "rgba(0, 0, 0, 0.06)",
					}}
				/>
				<Menu.Item
					leftSection={
						<Box
							style={{
								width: "32px",
								height: "32px",
								borderRadius: "10px",
								backgroundColor: "#fef2f2",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<LogOut size={16} color="#e03131" />
						</Box>
					}
					onClick={logout}
					style={{
						borderRadius: "12px",
						fontWeight: 600,
						fontSize: "14px",
						padding: "12px 16px",
						color: "#e03131",
						transition: "all 200ms ease",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = "#fef2f2";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = "transparent";
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
		{ label: "Agendar", link: "/agendar" },
	];

	return (
		<AppShell bg="#ffffff">
			{/* Floating Glass Header */}
			<Box
				style={{
					position: "fixed",
					top: "20px",
					left: "50%",
					transform: "translateX(-50%)",
					zIndex: 1000,
					width: "calc(100% - 40px)",
					maxWidth: "1200px",
				}}
			>
				<Box
					className="header-glass-container"
					style={{
						backgroundColor: "rgba(255, 255, 255, 0.92)",
						backdropFilter: "blur(20px) saturate(180%)",
						borderRadius: "24px",
						padding: "12px",
						border: "1px solid rgba(0, 0, 0, 0.06)",
						boxShadow: "0 4px 24px -8px rgba(0,0,0,0.08)",
						transition: "all 400ms cubic-bezier(0.32, 0.72, 0, 1)",
					}}
				>
					<style>{`
						.header-glass-container:hover {
							box-shadow: 0 8px 32px -12px rgba(0,0,0,0.12);
						}
					`}</style>
					<Container size="xl" style={{ maxWidth: "100%" }}>
						<Group justify="space-between" align="center" wrap="nowrap">
							{/* Logo with Double Bezel Style */}
							<Link
								to="/"
								style={{
									textDecoration: "none",
									display: "flex",
									alignItems: "center",
									gap: "12px",
								}}
							>
								{/* Double Bezel Logo Container */}
								<div
									style={{
										backgroundColor: "rgba(254, 242, 242, 0.6)",
										borderRadius: "14px",
										padding: "3px",
										border: "1px solid rgba(224, 49, 49, 0.12)",
										boxShadow: "0 2px 8px rgba(224, 49, 49, 0.08)",
									}}
								>
									<div
										style={{
											backgroundColor: "rgba(255, 255, 255, 0.9)",
											borderRadius: "11px",
											padding: "8px",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										<svg
											width="28"
											height="28"
											viewBox="0 0 40 40"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
											aria-label="SIMUT Logo"
										>
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
									</div>
								</div>

								<Box>
									<Title
										order={3}
										c="#111827"
										style={{
											lineHeight: 1,
											letterSpacing: "-0.8px",
											fontWeight: 800,
											fontSize: "22px",
										}}
									>
										SIMUT
									</Title>
									<Text
										style={{
											fontSize: "10px",
											fontWeight: 700,
											color: "#9ca3af",
											lineHeight: 1,
											marginTop: "2px",
											letterSpacing: "1.5px",
											textTransform: "uppercase",
										}}
									>
										Tuluá
									</Text>
								</Box>
							</Link>

							{/* Navigation Pills */}
							<Group visibleFrom="sm" gap={8} wrap="nowrap">
								{links.map((link) => {
									const isActive =
										router.location.pathname === link.link ||
										(link.link !== "/" &&
											router.location.pathname.startsWith(link.link));
									return (
										<NavPill
											key={link.label}
											label={link.label}
											to={link.link}
											isActive={isActive}
										/>
									);
								})}
								<Box ml="md">
									<UserMenu />
								</Box>
							</Group>
						</Group>
					</Container>
				</Box>
			</Box>

			{/* Spacer for fixed header */}
			<Box style={{ height: "100px" }} />

			<AppShell.Main>
				<Outlet />
			</AppShell.Main>
		</AppShell>
	);
}
