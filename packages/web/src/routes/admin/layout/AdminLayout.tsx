import {
	Badge,
	Box,
	Container,
	Group,
	Stack,
	Text,
	Title,
} from "@mantine/core";
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
import { adminUi } from "../_shared/admin-ui";
import { AdminUserMenu } from "./AdminUserMenu";
import { NavPill } from "./NavPill";
import { SidebarItem } from "./SidebarItem";

export function AdminLayout() {
	const { isAuthenticated, isLoading, hasRole } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const isAdminLoginRoute = location.pathname === "/admin/login";
	const isCitasRoute = location.pathname.startsWith("/admin/citas");

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
			<Box className={adminUi.pageBg} py={60}>
				<Container size="lg">
					<Box className={`${adminUi.surface} p-14 md:p-16`}>
						<Stack align="center" gap="md">
							<Box className="h-16 w-16 animate-pulse rounded-full bg-zinc-200/90" />
							<Box className="h-6 w-48 max-w-full animate-pulse rounded-lg bg-zinc-200/90" />
							<Box className="h-4 w-64 max-w-full animate-pulse rounded bg-zinc-100" />
						</Stack>
					</Box>
				</Container>
			</Box>
		);
	}

	if (isAuthenticated && !hasAdminAccess && !isAdminLoginRoute) {
		return (
			<Box className={adminUi.pageBg} pt={120} pb={16}>
				<Container size="lg">
					<Box className={`${adminUi.surface} p-12 md:p-16`}>
						<Stack align="center" gap="lg">
							<Text className="text-center text-lg font-semibold text-red-700">
								Acceso denegado
							</Text>
							<Text className="max-w-md text-center text-zinc-500 leading-relaxed">
								No tenés permisos para acceder al panel administrativo.
							</Text>
							<Link
								to="/"
								className="font-semibold text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition hover:decoration-red-600/80"
							>
								Volver al inicio
							</Link>
						</Stack>
					</Box>
				</Container>
			</Box>
		);
	}

	if (!isAuthenticated && isAdminLoginRoute) {
		return <Outlet />;
	}

	return (
		<Box
			component="div"
			className="flex min-h-[100dvh] flex-col bg-zinc-50 pt-14"
		>
			<Box
				component="header"
				className="fixed inset-x-0 top-0 z-[100] border-b border-zinc-200/90 bg-white/95 shadow-[0_1px_0_rgba(9,9,11,0.04)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90"
			>
				<Group
					justify="space-between"
					align="center"
					wrap="nowrap"
					px={{ base: "md", sm: "lg" }}
					py="sm"
					maw={1400}
					mx="auto"
					w="100%"
				>
					<Link
						to="/admin"
						className="group flex min-w-0 items-center gap-3 no-underline"
					>
						<Box>
							<Group gap="xs" wrap="nowrap">
								<Title
									order={3}
									className="text-[1.125rem] font-bold tracking-tight text-zinc-900 transition group-hover:text-zinc-700 sm:text-[1.25rem]"
									style={{ lineHeight: 1 }}
								>
									SIMUT
								</Title>
								<Badge
									variant="light"
									color="red"
									size="sm"
									styles={{
										root: {
											textTransform: "none",
											fontWeight: 700,
											fontSize: 11,
											letterSpacing: "0.02em",
										},
									}}
								>
									Admin
								</Badge>
							</Group>
							<Text
								className="mt-0.5 text-[0.625rem] font-bold uppercase tracking-[0.2em] text-zinc-400"
								style={{ lineHeight: 1 }}
							>
								Tuluá
							</Text>
						</Box>
					</Link>

					<Group gap="xs" wrap="nowrap" justify="flex-end">
						<Group visibleFrom="sm" gap={6} wrap="nowrap">
							<NavPill label="Inicio" to="/" isActive={false} />
							<NavPill label="Agendar" to="/agendar" isActive={false} />
						</Group>
						<AdminUserMenu />
					</Group>
				</Group>
			</Box>

			<Box className="flex min-h-0 w-full flex-1 flex-col md:flex-row">
				<Box
					component="nav"
					aria-label="Administración"
					className="shrink-0 border-zinc-200/90 bg-white md:sticky md:top-14 md:flex md:max-h-[calc(100dvh-3.5rem)] md:min-h-0 md:w-[260px] md:flex-col md:overflow-y-auto md:border-r md:border-b-0 border-b"
					py={{ base: "sm", md: "lg" }}
					pl={{ base: "xs", md: "md" }}
					pr={{ base: "xs", md: 0 }}
				>
					<Stack gap="lg">
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
						<Box className="my-2 border-t border-zinc-200/90" />
						<SidebarItem
							icon={Settings}
							label="Configuración"
							isActive={activeSection === "configuracion"}
							to="/admin/configuracion"
						/>
					</Stack>
				</Box>

				<Box
					component="main"
					className={
						isCitasRoute
							? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0"
							: "min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
					}
				>
					{isCitasRoute ? (
						<Outlet />
					) : (
						<Box mx="auto" maw={1140}>
							<Outlet />
						</Box>
					)}
				</Box>
			</Box>
		</Box>
	);
}
