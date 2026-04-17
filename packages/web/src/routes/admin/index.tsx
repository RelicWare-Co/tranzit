import { Avatar, Badge, Box, Button, Group, Stack, Text } from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Calendar, ClipboardList, Users } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { AdminPageHeader } from "./_shared/-AdminPageHeader";
import { adminUi } from "./_shared/-admin-ui";

export const Route = createFileRoute("/admin/")({
	component: AdminDashboard,
});

type Kpi = {
	label: string;
	value: string;
	accentClass: string;
	icon: typeof Calendar;
};

const KPI_ROW: Kpi[] = [
	{
		label: "Citas hoy",
		value: "1.247",
		accentClass: "text-red-700",
		icon: Calendar,
	},
	{
		label: "Usuarios",
		value: "8.932",
		accentClass: "text-zinc-900",
		icon: Users,
	},
	{
		label: "Pendientes",
		value: "156",
		accentClass: "text-zinc-900",
		icon: ClipboardList,
	},
	{
		label: "En plazo",
		value: "97,4%",
		accentClass: "text-emerald-700",
		icon: BarChart3,
	},
];

function AdminDashboard() {
	const { user } = useAuth();

	const recentAppointments = [
		{
			id: "1",
			name: "María González",
			service: "Renovación de licencia",
			date: "Hoy, 10:30",
			status: "confirmada",
		},
		{
			id: "2",
			name: "Carlos Rodríguez",
			service: "Traspaso de propiedad",
			date: "Hoy, 11:00",
			status: "en_proceso",
		},
		{
			id: "3",
			name: "An Patricia Duarte",
			service: "Matrícula inicial",
			date: "Hoy, 11:30",
			status: "confirmada",
		},
		{
			id: "4",
			name: "Juan Pablo Mejía",
			service: "Certificado de tradición",
			date: "Hoy, 14:00",
			status: "pendiente",
		},
	];

	return (
		<Stack gap="md">
			<AdminPageHeader
				title="Panel de administración"
				description={`Hola, ${user?.name || user?.email || "equipo"}.`}
			/>

			<Box className={`${adminUi.surface} overflow-hidden p-0`}>
				<div className="grid grid-cols-2 gap-px bg-zinc-200/90 sm:grid-cols-4">
					{KPI_ROW.map((kpi) => {
						const Icon = kpi.icon;
						return (
							<Box
								key={kpi.label}
								className="flex min-w-0 items-center gap-2.5 bg-white px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3"
							>
								<Icon
									size={17}
									className="shrink-0 text-zinc-400"
									strokeWidth={1.75}
								/>
								<div className="min-w-0">
									<Text className="text-[0.625rem] font-semibold uppercase leading-none tracking-[0.12em] text-zinc-400">
										{kpi.label}
									</Text>
									<Text
										className={`${adminUi.monoStat} mt-0.5 truncate text-lg font-semibold leading-tight sm:text-xl ${kpi.accentClass}`}
									>
										{kpi.value}
									</Text>
								</div>
							</Box>
						);
					})}
				</div>
			</Box>

			<Box className={`${adminUi.surface} overflow-hidden p-0`}>
				<Group
					justify="space-between"
					align="center"
					wrap="wrap"
					gap="sm"
					px="md"
					py="sm"
					className="border-b border-zinc-200/90 bg-zinc-50/50"
				>
					<Group gap="sm">
						<Box className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-zinc-200/90">
							<Calendar size={15} className="text-red-700" strokeWidth={1.75} />
						</Box>
						<div>
							<Text className="text-base font-semibold tracking-tight text-zinc-900">
								Próximas citas
							</Text>
							<Text className="text-xs text-zinc-500">Hoy, orden por hora</Text>
						</div>
					</Group>
					<Button
						component={Link}
						to="/admin/citas"
						variant="light"
						color="red"
						size="xs"
						radius="md"
						className="shrink-0 font-semibold"
					>
						Ir a citas
					</Button>
				</Group>

				<Stack gap={0} px="sm" py="xs">
					{recentAppointments.map((appointment, i) => (
						<Group
							key={appointment.id}
							justify="space-between"
							align="center"
							wrap="wrap"
							gap="sm"
							py="sm"
							px="xs"
							className={i > 0 ? "border-t border-zinc-200/80" : undefined}
						>
							<Group gap="sm">
								<Avatar
									size="sm"
									radius="xl"
									className="border border-red-100 bg-red-50 text-xs font-bold text-red-800"
								>
									{appointment.name
										.split(" ")
										.map((n) => n[0])
										.join("")
										.slice(0, 2)
										.toUpperCase()}
								</Avatar>
								<Stack gap={0}>
									<Text size="sm" fw={600} className="text-zinc-900">
										{appointment.name}
									</Text>
									<Text size="xs" className="text-zinc-500">
										{appointment.service}
									</Text>
								</Stack>
							</Group>
							<Group gap="sm">
								<Text size="xs" className={`${adminUi.monoStat} text-zinc-500`}>
									{appointment.date}
								</Text>
								<Badge
									color={
										appointment.status === "confirmada"
											? "green"
											: appointment.status === "en_proceso"
												? "yellow"
												: "gray"
									}
									variant="light"
									size="sm"
									styles={{
										root: {
											textTransform: "none",
											fontWeight: 600,
										},
									}}
								>
									{appointment.status === "confirmada"
										? "Confirmada"
										: appointment.status === "en_proceso"
											? "En proceso"
											: "Pendiente"}
								</Badge>
							</Group>
						</Group>
					))}
				</Stack>
			</Box>
		</Stack>
	);
}
