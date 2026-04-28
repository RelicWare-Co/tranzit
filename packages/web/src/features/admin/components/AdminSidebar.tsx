import { Box, Stack, Text } from "@mantine/core";
import {
	BarChart3,
	Calendar,
	ClipboardList,
	LayoutDashboard,
	Settings,
	ShieldCheck,
	Users,
} from "lucide-react";
import { SidebarItem } from "./SidebarItem";

const sectionClass =
	"mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-tertiary)]";

/**
 * Sidebar compacto (208px) con iconos + labels para navegación administrativa.
 * Diseñado con ancho reducido para maximizar espacio de contenido.
 * Responsive: colapsa en mobile (<768px) mostrando solo iconos.
 */
export function AdminSidebar({ activeSection }: { activeSection: string }) {
	return (
		<Box
			component="nav"
			aria-label="Administración"
			className={[
				"w-full shrink-0 md:w-[208px]",
				"border-[var(--border-subtle)] bg-[var(--bg-secondary)]",
				"border-b md:border-b-0 md:border-r",
				"md:min-h-0 md:overflow-y-auto",
			].join(" ")}
			px={{ base: "sm", md: "sm" }}
			py={{ base: "sm", md: "md" }}
		>
			<Stack gap={0}>
				{/* Sección Gestión - visible solo en desktop */}
				<Text
					component="p"
					className={[sectionClass, "hidden md:block"].join(" ")}
				>
					Gestión
				</Text>
				<Stack gap={1}>
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
				</Stack>

				{/* Divisor visible solo en desktop */}
				<Box className="my-4 hidden border-t border-[var(--border-subtle)] md:block" />

				{/* Sección Sistema - visible solo en desktop */}
				<Text
					component="p"
					className={[sectionClass, "hidden md:block"].join(" ")}
				>
					Sistema
				</Text>
				<Stack gap={1}>
					<SidebarItem
						icon={ShieldCheck}
						label="Auditoría"
						isActive={activeSection === "auditoria"}
						to="/admin/auditoria"
					/>
					<SidebarItem
						icon={Settings}
						label="Configuración"
						isActive={activeSection === "configuracion"}
						to="/admin/configuracion"
					/>
				</Stack>
			</Stack>
		</Box>
	);
}
