import { Alert, Button, Tabs, Text } from "@mantine/core";
import {
	AlertCircle,
	CalendarClock,
	CalendarOff,
	RefreshCw,
	Sparkles,
	UsersRound,
} from "lucide-react";
import { useState } from "react";
import { AdminPageHeader } from "#/features/admin/components/AdminPageHeader";
import { getErrorMessage } from "#/features/admin/components/errors";
import { useConfigSnapshot } from "#/features/admin/components/hooks/useConfigSnapshot";
import { useStaffOverrides } from "#/features/admin/components/hooks/useStaffOverrides";
import classes from "./Configuracion.module.css";
import { OverrideSection } from "./sections/OverrideSection";
import { SlotGenerationSection } from "./sections/SlotGenerationSection";
import { StaffAvailabilitySection } from "./sections/StaffAvailabilitySection";
import { TemplateSection } from "./sections/TemplateSection";

export function AdminConfiguracionPage() {
	const [selectedStaffUserId, setSelectedStaffUserId] = useState<string | null>(
		null,
	);

	const snapshot = useConfigSnapshot();
	const staffOverrides = useStaffOverrides(selectedStaffUserId);

	const refreshAll = async () => {
		await Promise.all([snapshot.refresh(), staffOverrides.refresh()]);
	};

	return (
		<div className={classes.page}>
			<div className={classes.pageStack}>
				<AdminPageHeader
					title="Configuración operativa"
					description="Administra las reglas que definen cómo se construye y opera la agenda de SIMUT."
					actions={
						<Button
							leftSection={<RefreshCw size={16} />}
							onClick={() => void refreshAll()}
							variant="default"
							loading={snapshot.isFetching}
						>
							Actualizar datos
						</Button>
					}
				/>

				{snapshot.isError ? (
					<Alert color="red" icon={<AlertCircle size={18} />} radius="md">
						<Text fw={600}>
							{getErrorMessage(
								snapshot.error,
								"No se pudo cargar la configuración",
							)}
						</Text>
					</Alert>
				) : null}

				<Tabs
					defaultValue="templates"
					className={classes.settingsShell}
					classNames={{
						list: classes.tabsList,
						tab: classes.tab,
						panel: classes.tabPanel,
					}}
				>
					<Tabs.List aria-label="Áreas de configuración">
						<Tabs.Tab
							value="templates"
							leftSection={
								<CalendarClock className={classes.tabIcon} size={17} />
							}
						>
							Agenda semanal
						</Tabs.Tab>
						<Tabs.Tab
							value="overrides"
							leftSection={
								<CalendarOff className={classes.tabIcon} size={17} />
							}
						>
							Excepciones
						</Tabs.Tab>
						<Tabs.Tab
							value="slots"
							leftSection={<Sparkles className={classes.tabIcon} size={17} />}
						>
							Generar disponibilidad
						</Tabs.Tab>
						<Tabs.Tab
							value="staff"
							leftSection={<UsersRound className={classes.tabIcon} size={17} />}
						>
							Funcionarios
						</Tabs.Tab>
					</Tabs.List>

					<Tabs.Panel value="templates">
						<TemplateSection
							templates={snapshot.data?.templates ?? []}
							isLoading={snapshot.isLoading}
							onRefresh={refreshAll}
						/>
					</Tabs.Panel>

					<Tabs.Panel value="overrides">
						<OverrideSection
							overrides={snapshot.data?.overrides ?? []}
							isLoading={snapshot.isLoading}
							onRefresh={refreshAll}
						/>
					</Tabs.Panel>

					<Tabs.Panel value="slots">
						<SlotGenerationSection onRefresh={refreshAll} />
					</Tabs.Panel>

					<Tabs.Panel value="staff">
						<StaffAvailabilitySection
							staff={snapshot.data?.staff ?? []}
							staffOverrides={staffOverrides.data ?? []}
							isLoadingOverrides={staffOverrides.isLoading}
							selectedStaffUserId={selectedStaffUserId}
							onSelectStaff={setSelectedStaffUserId}
							onRefresh={refreshAll}
						/>
					</Tabs.Panel>
				</Tabs>
			</div>
		</div>
	);
}
