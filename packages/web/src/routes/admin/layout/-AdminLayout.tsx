import { Box, Container, Stack, Text } from "@mantine/core";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useAuth } from "../../../lib/AuthContext";
import { adminUi } from "../_shared/-admin-ui";
import { AdminNavbar } from "./-AdminNavbar";
import { AdminSidebar } from "./-AdminSidebar";

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
		if (path.startsWith("/admin/documentos")) return "documentos";
		if (path.startsWith("/admin/usuarios")) return "usuarios";
		if (path.startsWith("/admin/tramites")) return "tramites";
		if (path.startsWith("/admin/reportes")) return "reportes";
		if (path.startsWith("/admin/auditoria")) return "auditoria";
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
			className="flex min-h-[100dvh] flex-col bg-zinc-50 pt-12"
		>
			<AdminNavbar />

			<Box className="flex min-h-0 w-full flex-1 flex-col md:flex-row md:items-stretch">
				<AdminSidebar activeSection={activeSection} />

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
