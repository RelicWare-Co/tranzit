import { Alert, Button, Stack, Text } from "@mantine/core";
import { AlertCircle, CalendarX, Clock, Hash, RefreshCw, User } from "lucide-react";
import { useState } from "react";
import { AdminPageHeader } from "#/features/admin/components/AdminPageHeader";
import { getErrorMessage } from "#/features/admin/components/errors";
import { SectionCard } from "#/features/admin/components/ui/SectionCard";
import { useConfigSnapshot } from "#/features/admin/components/hooks/useConfigSnapshot";
import { useStaffOverrides } from "#/features/admin/components/hooks/useStaffOverrides";
import { TemplateSection } from "./sections/TemplateSection";
import { OverrideSection } from "./sections/OverrideSection";
import { SlotGenerationSection } from "./sections/SlotGenerationSection";
import { StaffAvailabilitySection } from "./sections/StaffAvailabilitySection";

export function AdminConfiguracionPage() {
	const [selectedStaffUserId, setSelectedStaffUserId] = useState<string | null>(
		null,
	);

	const snapshot = useConfigSnapshot();
	const staffOverrides = useStaffOverrides(selectedStaffUserId);

	const refreshAll = async () => {
		await snapshot.refresh();
		await staffOverrides.refresh();
	};

	return (
		<Stack gap="xl" className="max-w-[1600px] mx-auto pb-12">
			<AdminPageHeader
				title="Configuración operativa"
				description="Gestiona templates de agenda, excepciones de calendario y disponibilidad de funcionarios"
				actions={
					<Button
						leftSection={<RefreshCw size={16} />}
						onClick={() => void refreshAll()}
						variant="light"
						className="transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
					>
						Refrescar
					</Button>
				}
			/>

			{snapshot.isError && (
				<Alert
					color="red"
					icon={<AlertCircle size={18} />}
					className="rounded-xl border border-red-200"
				>
					<Text className="font-medium">
						{getErrorMessage(
							snapshot.error,
							"No se pudo cargar la configuración",
						)}
					</Text>
				</Alert>
			)}

			<SectionCard
				title="Templates de agenda"
				subtitle="Define horarios base por día de la semana"
				icon={Clock}
			>
				<TemplateSection
					templates={snapshot.data?.templates ?? []}
					isLoading={snapshot.isLoading}
					onRefresh={refreshAll}
				/>
			</SectionCard>

			<SectionCard
				title="Excepciones de calendario"
				subtitle="Define días especiales que anulan los templates"
				icon={CalendarX}
			>
				<OverrideSection
					overrides={snapshot.data?.overrides ?? []}
					isLoading={snapshot.isLoading}
					onRefresh={refreshAll}
				/>
			</SectionCard>

			<SectionCard
				title="Generación de slots"
				subtitle="Crea slots disponibles para reservas en un rango de fechas"
				icon={Hash}
			>
				<SlotGenerationSection onRefresh={refreshAll} />
			</SectionCard>

			<SectionCard
				title="Disponibilidad por funcionario"
				subtitle="Gestiona excepciones individuales y consulta disponibilidad efectiva"
				icon={User}
			>
				<StaffAvailabilitySection
					staff={snapshot.data?.staff ?? []}
					staffOverrides={staffOverrides.data ?? []}
					isLoadingOverrides={staffOverrides.isLoading}
					selectedStaffUserId={selectedStaffUserId}
					onSelectStaff={setSelectedStaffUserId}
					onRefresh={refreshAll}
				/>
			</SectionCard>
		</Stack>
	);
}
