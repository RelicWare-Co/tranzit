import {
	AppShell,
	Badge,
	Box,
	Card,
	Container,
	Divider,
	Grid,
	Group,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useWindowScroll } from "@mantine/hooks";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
	BarChart3,
	Calendar,
	ClipboardList,
	LayoutDashboard,
	Settings,
	Users,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { useAuth } from "../../../lib/AuthContext";
import { AdminUserMenu } from "./AdminUserMenu";
import { NavPill } from "./NavPill";
import { SidebarItem } from "./SidebarItem";

export function AdminLayout() {
	const { isAuthenticated, isLoading, hasRole } = useAuth();
	const navigate = useNavigate();
	const [scroll] = useWindowScroll();
	const isScrolled = scroll.y > 20;
	const location = useLocation();
	const isAdminLoginRoute = location.pathname === "/admin/login";

	const activeSection = useMemo(() => {
		const path = location.pathname;
		if (path === "/admin") return "dashboard";
		if (path.startsWith("/admin/citas")) return "citas";
		if (path.startsWith("/admin/usuarios")) return "usuarios";
		if (path.startsWith("/admin/tramites")) return "tramites";
		if (path.startsWith("/admin/reportes")) return "reportes";
		if (path.startsWith("/admin/configuracion")) return "configuracion";
		return "dashboard";
	}, [location.pathname]);

	const hasAdminAccess = useMemo(() => {
		return hasRole("admin") || hasRole("staff") || hasRole("auditor");
	}, [hasRole]);

	useEffect(() => {
		if (!isLoading && !isAuthenticated && !isAdminLoginRoute) {
			navigate({ to: "/admin/login" });
		}
	}, [isAuthenticated, isLoading, isAdminLoginRoute, navigate]);

	useEffect(() => {
		if (
			!isLoading &&
			isAuthenticated &&
			!hasAdminAccess &&
			!isAdminLoginRoute
		) {
			navigate({ to: "/" });
		}
	}, [isAuthenticated, isLoading, hasAdminAccess, isAdminLoginRoute, navigate]);

	if (isLoading || (!isAuthenticated && !isAdminLoginRoute)) {
		return (
			<Box bg="#f8f9fa" mih="100vh" py={60}>
				<Container size="lg">
					<Card
						p={60}
						radius="xl"
						bg="white"
						style={{
							border: "1px solid #e5e7eb",
							boxShadow:
								"0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.025)",
						}}
					>
						<Stack align="center" gap="md">
							<Box
								style={{
									width: 64,
									height: 64,
									borderRadius: "50%",
									backgroundColor: "#f3f4f6",
									animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
								}}
							/>
							<Box
								style={{
									width: 200,
									height: 24,
									borderRadius: 8,
									backgroundColor: "#f3f4f6",
									animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
									animationDelay: "0.1s",
								}}
							/>
						</Stack>
					</Card>
				</Container>
			</Box>
		);
	}

	if (isAuthenticated && !hasAdminAccess && !isAdminLoginRoute) {
		return (
			<Box bg="#f8f9fa" mih="100vh" pt={160} pb={60}>
				<Container size="lg">
					<Card
						p={60}
						radius="xl"
						bg="white"
						style={{
							border: "1px solid #e5e7eb",
							boxShadow:
								"0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.025)",
						}}
					>
						<Stack align="center" gap="lg">
							<Title order={2} c="#dc2626">
								Acceso denegado
							</Title>
							<Text c="#6b7280" ta="center">
								No tenés permisos para acceder al panel administrativo.
							</Text>
							<Link to="/" style={{ textDecoration: "none" }}>
								<Text c="#2563eb" fw={600}>
									Volver al inicio
								</Text>
							</Link>
						</Stack>
					</Card>
				</Container>
			</Box>
		);
	}

	if (!isAuthenticated && isAdminLoginRoute) {
		return <Outlet />;
	}

	return (
		<AppShell>
			<Box
				style={{
					position: "fixed",
					top: 0,
					left: 0,
					right: 0,
					zIndex: 1000,
					transition: "all 400ms cubic-bezier(0.32, 0.72, 0, 1)",
				}}
			>
				<Box
					style={{
						maxWidth: isScrolled ? "100%" : "1200px",
						margin: isScrolled ? "0" : "12px auto 0",
						padding: isScrolled ? "0" : "0 20px",
						transition: "all 400ms cubic-bezier(0.32, 0.72, 0, 1)",
					}}
				>
					<Box
						className="header-glass-container"
						style={{
							backgroundColor: "rgba(255, 255, 255, 0.95)",
							backdropFilter: "blur(20px) saturate(180%)",
							borderRadius: isScrolled ? "0" : "20px",
							padding: isScrolled ? "14px 24px" : "10px 24px",
							border: "1px solid rgba(0, 0, 0, 0.08)",
							boxShadow: isScrolled
								? "0 2px 16px rgba(0,0,0,0.08)"
								: "0 4px 24px -8px rgba(0,0,0,0.12)",
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
								<Link
									to="/admin"
									style={{
										display: "flex",
										alignItems: "center",
										gap: "12px",
										textDecoration: "none",
									}}
								>
									<Box>
										<Group gap="xs">
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
											<Badge
												color="red"
												variant="light"
												size="sm"
												style={{
													textTransform: "none",
													fontWeight: 700,
													fontSize: "11px",
												}}
											>
												Admin
											</Badge>
										</Group>
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

								<Group visibleFrom="sm" gap={8} wrap="nowrap">
									<NavPill label="Inicio" to="/" isActive={false} />
									<NavPill label="Agendar" to="/agendar" isActive={false} />
									<Box ml="md">
										<AdminUserMenu />
									</Box>
								</Group>
							</Group>
						</Container>
					</Box>
				</Box>
			</Box>

			<AppShell.Main>
				<Box bg="#f8f9fa" mih="100vh" pt={140} pb={60}>
					<Container size="xl">
						<Grid gap="xl">
							<Grid.Col span={{ base: 12, md: 3 }}>
								<Card
									radius="xl"
									p="md"
									bg="white"
									style={{
										border: "1px solid #e5e7eb",
										boxShadow:
											"0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.025)",
										position: "sticky",
										top: 140,
									}}
								>
									<Stack gap="xs">
										<SidebarItem
											icon={LayoutDashboard}
											label="Dashboard"
											isActive={activeSection === "dashboard"}
											to="/admin"
										/>
										<SidebarItem
											icon={Calendar}
											label="Citas"
											isActive={activeSection === "citas"}
											to="/admin/citas"
										/>
										<SidebarItem
											icon={Users}
											label="Usuarios"
											isActive={activeSection === "usuarios"}
											to="/admin/usuarios"
										/>
										<SidebarItem
											icon={ClipboardList}
											label="Trámites"
											isActive={activeSection === "tramites"}
											to="/admin/tramites"
										/>
										<SidebarItem
											icon={BarChart3}
											label="Reportes"
											isActive={activeSection === "reportes"}
											to="/admin/reportes"
										/>
										<Divider my="sm" color="#f3f4f6" />
										<SidebarItem
											icon={Settings}
											label="Configuración"
											isActive={activeSection === "configuracion"}
											to="/admin/configuracion"
										/>
									</Stack>
								</Card>
							</Grid.Col>

							<Grid.Col span={{ base: 12, md: 9 }}>
								<Outlet />
							</Grid.Col>
						</Grid>
					</Container>
				</Box>
			</AppShell.Main>
		</AppShell>
	);
}
