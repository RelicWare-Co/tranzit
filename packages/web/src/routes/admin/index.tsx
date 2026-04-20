import {
	Avatar,
	Badge,
	Box,
	Button,
	Group,
	Loader,
	Stack,
	Text,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Calendar, ClipboardList, Users } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { orpcClient } from "../../lib/orpc-client";
import { AdminPageHeader } from "./_shared/-AdminPageHeader";
import { adminUi } from "./_shared/-admin-ui";
import { formatDateLocal } from "./_shared/-dates";

export const Route = createFileRoute("/admin/")({
	component: AdminDashboard,
});

type KpiData = {
	label: string;
	value: string;
	accentClass: string;
	icon: typeof Calendar;
};

function getTodayDate(): string {
	return formatDateLocal(new Date());
}

async function fetchDashboardData() {
	const today = getTodayDate();

	// Fetch today's bookings
	const [todayBookings, allBookings, staffList] = await Promise.all([
		orpcClient.admin.bookings.list({
			dateFrom: today,
			dateTo: today,
		}),
		orpcClient.admin.bookings.list({
			isActive: true,
		}),
		orpcClient.admin.staff.list({}),
	]);

	// Count KPIs from real data
	const citasHoy = todayBookings.length;
	const usuarios = staffList.length;
	const pendientes = allBookings.filter(
		(b) => b.status === "held" || b.status === "pending",
	).length;

	// Calculate on-time percentage (confirmed vs total for today)
	const confirmedToday = todayBookings.filter(
		(b) => b.status === "confirmed",
	).length;
	const enPlazo =
		citasHoy > 0 ? Math.round((confirmedToday / citasHoy) * 100) : 100;

	return {
		kpis: {
			citasHoy,
			usuarios,
			pendientes,
			enPlazo: `${enPlazo}%`,
		},
		todayBookings,
	};
}

function KpiGrid({ isLoading }: { isLoading: boolean }) {
	const { data } = useQuery({
		queryKey: ["admin", "dashboard", "kpi"],
		queryFn: fetchDashboardData,
		select: (data) => data.kpis,
	});

	const kpiRow: KpiData[] = [
		{
			label: "Citas hoy",
			value: isLoading ? "..." : String(data?.citasHoy ?? 0),
			accentClass: "text-[var(--accent-default)]",
			icon: Calendar,
		},
		{
			label: "Usuarios",
			value: isLoading ? "..." : String(data?.usuarios ?? 0),
			accentClass: "text-[var(--text-primary)]",
			icon: Users,
		},
		{
			label: "Pendientes",
			value: isLoading ? "..." : String(data?.pendientes ?? 0),
			accentClass: "text-[var(--text-primary)]",
			icon: ClipboardList,
		},
		{
			label: "En plazo",
			value: isLoading ? "..." : (data?.enPlazo ?? "100%"),
			accentClass: "text-[var(--success-600)]",
			icon: BarChart3,
		},
	];

	return (
		<Box className={`${adminUi.surface} overflow-hidden p-0`}>
			<div className="grid grid-cols-2 gap-px bg-zinc-200/90 sm:grid-cols-4">
				{kpiRow.map((kpi) => {
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
	);
}

type BookingWithRelations = {
	id: string;
	slotId: string;
	staffUserId: string | null;
	requestId: string | null;
	citizenUserId: string | null;
	kind: string;
	status: string;
	isActive: boolean;
	holdExpiresAt: string | Date | null;
	attendedAt: string | Date | null;
	notes: string | null;
	createdAt: string | Date;
	updatedAt: string | Date;
	slot: {
		id: string;
		slotDate: string;
		startTime: string;
		endTime: string;
	} | null;
	staff: {
		id: string;
		name: string | null;
		email: string;
	} | null;
	request: {
		id: string;
		procedureTypeId: string;
		citizenUserId: string;
		email: string;
		documentType: string;
		documentNumber: string;
		status: string;
		procedureConfigVersion: number;
		activeBookingId: string | null;
		createdAt: string | Date;
		updatedAt: string | Date;
		verifiedAt: string | Date | null;
		confirmedAt: string | Date | null;
		cancelledAt: string | Date | null;
		procedureSnapshot: Record<string, unknown> | null;
		eligibilityResult: Record<string, unknown> | null;
		draftData: Record<string, unknown> | null;
		procedureType: {
			id: string;
			name: string;
			slug: string;
		} | null;
		citizen: {
			id: string;
			name: string | null;
			email: string;
		} | null;
	} | null;
};

function getStatusBadgeInfo(status: string): { color: string; label: string } {
	switch (status) {
		case "confirmed":
			return { color: "green", label: "Confirmada" };
		case "held":
			return { color: "yellow", label: "En proceso" };
		case "pending":
			return { color: "gray", label: "Pendiente" };
		default:
			return { color: "gray", label: status };
	}
}

function RecentAppointments() {
	const today = getTodayDate();

	const { data: bookings, isLoading } = useQuery({
		queryKey: ["admin", "dashboard", "today-bookings"],
		queryFn: async () => {
			const result = await orpcClient.admin.bookings.list({
				dateFrom: today,
				dateTo: today,
				isActive: true,
			});
			// Sort by start time
			return (result as BookingWithRelations[]).sort((a, b) => {
				const timeA = a.slot?.startTime ?? "";
				const timeB = b.slot?.startTime ?? "";
				return timeA.localeCompare(timeB);
			});
		},
	});

	const displayBookings = (bookings ?? []).slice(0, 5);

	if (isLoading) {
		return (
			<Box className={`${adminUi.surface} overflow-hidden p-0`}>
				<Group justify="center" py="xl">
					<Loader size="sm" />
				</Group>
			</Box>
		);
	}

	return (
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

			{displayBookings.length === 0 ? (
				<Box px="md" py="xl">
					<Text className="text-center text-sm text-zinc-500">
						No hay citas programadas para hoy.
					</Text>
				</Box>
			) : (
				<Stack gap={0} px="sm" py="xs">
					{displayBookings.map((booking, i) => {
						const citizenName =
							booking.request?.citizen?.name ??
							booking.request?.email ??
							booking.staff?.name ??
							booking.staff?.email ??
							"Sin nombre";
						const serviceName =
							booking.request?.procedureType?.name ??
							(booking.kind === "administrative"
								? "Reserva administrativa"
								: "Trámite");
						const time = booking.slot?.startTime
							? `Hoy, ${booking.slot.startTime}`
							: "Sin hora";
						const statusInfo = getStatusBadgeInfo(booking.status);
						const initials = citizenName
							.split(" ")
							.map((n) => n[0])
							.join("")
							.slice(0, 2)
							.toUpperCase();

						return (
							<Group
								key={booking.id}
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
										{initials}
									</Avatar>
									<Stack gap={0}>
										<Text size="sm" fw={600} className="text-zinc-900">
											{citizenName}
										</Text>
										<Text size="xs" className="text-zinc-500">
											{serviceName}
										</Text>
									</Stack>
								</Group>
								<Group gap="sm">
									<Text
										size="xs"
										className={`${adminUi.monoStat} text-zinc-500`}
									>
										{time}
									</Text>
									<Badge
										color={statusInfo.color}
										variant="light"
										size="sm"
										styles={{
											root: {
												textTransform: "none",
												fontWeight: 600,
											},
										}}
									>
										{statusInfo.label}
									</Badge>
								</Group>
							</Group>
						);
					})}
				</Stack>
			)}
		</Box>
	);
}

function AdminDashboard() {
	const { user } = useAuth();

	const { isLoading } = useQuery({
		queryKey: ["admin", "dashboard", "kpi"],
		queryFn: fetchDashboardData,
		staleTime: 30_000, // 30 seconds
	});

	return (
		<Stack gap="md">
			<AdminPageHeader
				title="Panel de administración"
				description={`Hola, ${user?.name || user?.email || "equipo"}.`}
			/>

			<KpiGrid isLoading={isLoading} />
			<RecentAppointments />
		</Stack>
	);
}
