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
import { SidebarItem } from "./-SidebarItem";

const sectionClass =
	"mb-5 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400";

export function AdminSidebar({ activeSection }: { activeSection: string }) {
	return (
		<Box
			component="nav"
			aria-label="Administración"
			className={[
				"w-full shrink-0 md:w-[276px]",
				"border-zinc-200/95 bg-zinc-100/90 shadow-[inset_-1px_0_0_rgba(9,9,11,0.05)]",
				"border-b md:border-b-0 md:border-r",
				"md:min-h-0 md:overflow-y-auto",
			].join(" ")}
			px={{ base: "md", md: "md" }}
			py={{ base: "md", md: "lg" }}
		>
			<Stack gap={0}>
				<Text component="p" className={sectionClass}>
					Gestión
				</Text>
				<Stack gap={4}>
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

				<Box className="my-8 border-t border-zinc-200/90" />

				<Text component="p" className={sectionClass}>
					Sistema
				</Text>
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
		</Box>
	);
}
