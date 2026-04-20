import { Badge, Box, Group, Text, Title } from "@mantine/core";
import { Link, useLocation } from "@tanstack/react-router";
import { CalendarDays, House } from "lucide-react";
import { ADMIN_ACCENT } from "../_shared/-admin-ui";
import { AdminUserMenu } from "./-AdminUserMenu";

const portalShell =
	"inline-flex h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border-0 px-2 text-sm font-medium shadow-none no-underline outline-none transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] md:px-2.5";

/** Estado inactivo: texto secundario, hover con fondo sutil */
const portalInactive = `${portalShell} text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]`;

/** Estado activo: fondo brand sutil, texto brand */
const portalActive = `${portalShell} bg-[var(--brand-100)] text-[var(--brand-700)] hover:bg-[var(--brand-200)]`;

function PortalNavLink({
	to,
	label,
	isActive,
	icon: Icon,
}: {
	to: string;
	label: string;
	isActive: boolean;
	icon: typeof House;
}) {
	return (
		<Link
			to={to}
			aria-label={label}
			className={isActive ? portalActive : portalInactive}
		>
			<Icon className="shrink-0" size={16} strokeWidth={1.75} aria-hidden />
			<span className="hidden md:inline">{label}</span>
		</Link>
	);
}

/**
 * Barra superior del backoffice: marca SIMUT, enlaces al portal ciudadano y menú de usuario.
 * Altura reducida (44px) para maximizar espacio de trabajo.
 */
export function AdminNavbar() {
	const pathname = useLocation().pathname;
	const isHome = pathname === "/";
	const isAgendar = pathname.startsWith("/agendar");

	return (
		<Box
			component="header"
			role="banner"
			className={[
				"fixed inset-x-0 top-0 z-[100] flex h-[44px] items-center border-b border-[var(--border-subtle)]",
				"bg-[var(--bg-elevated)]",
			].join(" ")}
		>
			<Group
				justify="space-between"
				align="center"
				wrap="nowrap"
				px={{ base: "sm", sm: "md", lg: "lg" }}
				py={0}
				maw={1400}
				mx="auto"
				w="100%"
				gap="md"
				className="min-h-[44px]"
			>
				{/* Logo SIMUT */}
				<Link
					to="/admin"
					className="group flex min-w-0 items-center gap-2.5 no-underline md:gap-3"
				>
					<Box
						className="hidden h-5 w-[3px] shrink-0 rounded-full sm:block"
						style={{ backgroundColor: ADMIN_ACCENT }}
						aria-hidden
					/>
					<Group gap={6} wrap="nowrap" align="center">
						<Title
							order={3}
							className="text-sm font-bold leading-none tracking-tight text-[var(--text-primary)] transition-colors duration-200 group-hover:text-[var(--text-secondary)] md:text-base"
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
									fontSize: 9,
									paddingInline: 6,
									height: 18,
									letterSpacing: "0.06em",
									border: "1px solid rgba(201, 42, 42, 0.15)",
								},
							}}
						>
							Admin
						</Badge>
						<Text
							component="span"
							className="hidden text-[10px] font-semibold uppercase leading-none tracking-[0.2em] text-[var(--text-tertiary)] md:inline"
						>
							Tuluá
						</Text>
					</Group>
				</Link>

				{/* Enlaces portal ciudadano + user menu */}
				<Group gap={4} wrap="nowrap" justify="flex-end" className="shrink-0">
					<Group gap={2} wrap="nowrap">
						<PortalNavLink
							to="/"
							label="Inicio"
							isActive={isHome}
							icon={House}
						/>
						<PortalNavLink
							to="/agendar"
							label="Agendar"
							isActive={isAgendar}
							icon={CalendarDays}
						/>
					</Group>

					<Box
						className="mx-1 hidden h-5 w-px bg-[var(--border-subtle)] md:block"
						aria-hidden
					/>

					<AdminUserMenu />
				</Group>
			</Group>
		</Box>
	);
}
