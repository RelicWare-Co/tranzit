import { Badge, Box, Group, Text, Title } from "@mantine/core";
import { Link, useLocation } from "@tanstack/react-router";
import { CalendarDays, House } from "lucide-react";
import { ADMIN_ACCENT } from "../_shared/admin-ui";
import { AdminUserMenu } from "./AdminUserMenu";

const portalShell =
	"inline-flex h-9 min-w-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border-0 px-2 font-sans text-sm font-medium shadow-none no-underline outline-none transition-[background-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] md:min-w-0 md:justify-start md:px-3";

/** Reposo: blanco (antes era hover). Hover: zinc-100 (un tono más que el antiguo zinc-50). */
const portalInactive = `${portalShell} bg-white text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200`;

/** Ruta actual: reposo zinc-100; hover un poco más oscuro. */
const portalActive = `${portalShell} bg-zinc-100 font-medium text-zinc-900 hover:bg-zinc-200 active:bg-zinc-200`;

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
			<Icon
				className={
					isActive ? "shrink-0 text-zinc-800" : "shrink-0 text-zinc-500"
				}
				size={16}
				strokeWidth={1.5}
				aria-hidden
			/>
			<span className="hidden md:inline">{label}</span>
		</Link>
	);
}

/**
 * Barra superior del backoffice: marca, portal ciudadano (un solo control por enlace) y usuario.
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
				"fixed inset-x-0 top-0 z-[100] flex h-12 items-center border-b border-zinc-200/70",
				"bg-zinc-50/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_8px_28px_-22px_rgba(9,9,11,0.1)]",
				"backdrop-blur-xl supports-[backdrop-filter]:bg-white/72",
			].join(" ")}
		>
			<Box
				className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent opacity-90"
				aria-hidden
			/>

			<Group
				justify="space-between"
				align="center"
				wrap="nowrap"
				px={{ base: "sm", sm: "md", lg: "lg" }}
				py={0}
				maw={1400}
				mx="auto"
				w="100%"
				gap="sm"
				className="min-h-12"
			>
				<Link
					to="/admin"
					className="group flex min-w-0 max-w-[65%] items-center gap-2.5 no-underline sm:max-w-none md:gap-3"
				>
					<Box
						className="hidden h-6 w-[3px] shrink-0 rounded-full sm:block"
						style={{ backgroundColor: ADMIN_ACCENT }}
						aria-hidden
					/>
					<Group gap={7} wrap="nowrap" align="center">
						<Title
							order={3}
							className="text-[0.9375rem] font-bold leading-none tracking-tight text-zinc-900 transition-colors duration-300 group-hover:text-zinc-800 sm:text-[1rem]"
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
									paddingInline: 7,
									height: 20,
									letterSpacing: "0.06em",
									border: "1px solid rgba(201, 42, 42, 0.18)",
									background:
										"linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,241,242,0.85))",
									boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
								},
							}}
						>
							Admin
						</Badge>
						<Text
							component="span"
							className="hidden text-[0.625rem] font-semibold uppercase leading-none tracking-[0.2em] text-zinc-400 sm:inline"
						>
							Tuluá
						</Text>
					</Group>
				</Link>

				<Group gap={8} wrap="nowrap" justify="flex-end" className="shrink-0">
					<Group gap={6} wrap="nowrap">
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

					<AdminUserMenu />
				</Group>
			</Group>
		</Box>
	);
}
