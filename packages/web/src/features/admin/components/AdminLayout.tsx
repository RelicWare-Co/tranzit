import { Box, Container, Stack } from "@mantine/core";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { adminUi } from "#/features/admin/components/admin-ui";
import { useAuth } from "#/features/auth/components/AuthContext";
import { AdminNavbar } from "./AdminNavbar";
import { AdminSidebar } from "./AdminSidebar";

export function AdminLayout() {
	const { isAuthenticated, isLoading, hasRole } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const isCitasRoute = location.pathname.startsWith("/admin/citas");

	const activeSection = useMemo(() => {
		const path = location.pathname;
		if (path === "/admin") return "dashboard";
		if (path.startsWith("/admin/citas")) return "citas";
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
		if (isLoading) return;

		if (!isAuthenticated) {
			navigate({ to: "/login", replace: true });
			return;
		}

		if (!hasAdminAccess) {
			navigate({ to: "/mi-perfil", replace: true });
		}
	}, [isAuthenticated, isLoading, hasAdminAccess, navigate]);

	if (isLoading) {
		return (
			<Box className={adminUi.pageBg} py={60}>
				<Container size="lg">
					<Box className={`${adminUi.surface} p-14 md:p-16`}>
						<Stack align="center" gap="md">
							<Box className="h-16 w-16 animate-pulse rounded-full bg-[var(--bg-tertiary)]" />
							<Box className="h-6 w-48 max-w-full animate-pulse rounded-lg bg-[var(--bg-tertiary)]" />
							<Box className="h-4 w-64 max-w-full animate-pulse rounded bg-[var(--bg-secondary)]" />
						</Stack>
					</Box>
				</Container>
			</Box>
		);
	}

	if (!isAuthenticated || !hasAdminAccess) return null;

	return (
		<Box
			component="div"
			className="flex min-h-[100dvh] flex-col bg-[var(--bg-primary)] pt-[44px]"
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
						<Box
							mx="auto"
							w="100%"
							maw={1600}
							px={{ base: "xs", md: "md", lg: "lg" }}
							pt="xl"
						>
							<Outlet />
						</Box>
					)}
				</Box>
			</Box>
		</Box>
	);
}
