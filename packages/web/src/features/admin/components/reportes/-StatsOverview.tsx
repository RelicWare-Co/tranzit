import { Card, Group, Stack, Text } from "@mantine/core";
import { Calendar, CheckCircle2, Clock, FileText } from "lucide-react";
import { adminUi } from "#/features/admin/components/-admin-ui";

interface StatsOverviewProps {
	confirmedBookings: number;
	heldBookings: number;
	totalBookings: number;
	activeSeries: number;
}

function StatCard({
	icon,
	label,
	value,
	iconBg,
}: {
	icon: React.ReactNode;
	label: string;
	value: number;
	iconBg: string;
}) {
	return (
		<Card className={adminUi.surface} radius="lg" p="md" shadow="none">
			<Stack gap="xs">
				<Group gap="xs" wrap="nowrap">
					<div
						className="flex h-8 w-8 items-center justify-center rounded-md"
						style={{ backgroundColor: iconBg }}
					>
						{icon}
					</div>
					<Text
						size="xs"
						className="font-medium uppercase tracking-wider text-[var(--text-secondary)]"
					>
						{label}
					</Text>
				</Group>
				<Text
					className={`text-2xl font-bold text-[var(--text-primary)] ${adminUi.monoStat}`}
				>
					{value}
				</Text>
			</Stack>
		</Card>
	);
}

export function StatsOverview({
	confirmedBookings,
	heldBookings,
	totalBookings,
	activeSeries,
}: StatsOverviewProps) {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<StatCard
				icon={<CheckCircle2 size={16} className="text-teal-700" />}
				label="Confirmadas"
				value={confirmedBookings}
				iconBg="#f0fdf4"
			/>
			<StatCard
				icon={<Clock size={16} className="text-amber-700" />}
				label="Pendientes"
				value={heldBookings}
				iconBg="#fffbeb"
			/>
			<StatCard
				icon={<Calendar size={16} className="text-blue-700" />}
				label="Total citas"
				value={totalBookings}
				iconBg="#eff6ff"
			/>
			<StatCard
				icon={<FileText size={16} className="text-purple-700" />}
				label="Series activas"
				value={activeSeries}
				iconBg="#faf5ff"
			/>
		</div>
	);
}
