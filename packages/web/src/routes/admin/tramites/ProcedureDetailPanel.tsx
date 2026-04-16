import {
	ActionIcon,
	Badge,
	Box,
	Card,
	Divider,
	Group,
	JsonInput,
	Menu,
	Stack,
	Switch,
	Tabs,
	Text,
	Title,
} from "@mantine/core";
import {
	AlertCircle,
	ClipboardList,
	Copy,
	FileCheck,
	FileText,
	List,
	MoreHorizontal,
	Trash2,
} from "lucide-react";
import type { ProcedureType } from "./types";

export function ProcedureDetailPanel({
	procedure,
	isMutating,
	onToggleActive,
	onDuplicate,
	onRemove,
}: {
	procedure: ProcedureType;
	isMutating: boolean;
	onToggleActive: (procedure: ProcedureType, nextActive: boolean) => void;
	onDuplicate: (procedure: ProcedureType) => void;
	onRemove: (procedure: ProcedureType) => void;
}) {
	return (
		<Card radius="xl" p={0} bg="white" style={{ border: "1px solid #e5e7eb" }}>
			<Box p="xl" style={{ borderBottom: "1px solid #e5e7eb" }}>
				<Group justify="space-between" align="flex-start" wrap="nowrap">
					<Group gap="md">
						<FileText size={28} color="#e03131" />
						<Stack gap={4}>
							<Title order={2}>{procedure.name}</Title>
							<Text size="sm" c="dimmed">
								{procedure.slug}
							</Text>
						</Stack>
					</Group>

					<Menu position="bottom-end">
						<Menu.Target>
							<ActionIcon variant="light" color="gray" radius="xl" size="lg">
								<MoreHorizontal size={18} />
							</ActionIcon>
						</Menu.Target>
						<Menu.Dropdown>
							<Menu.Item
								leftSection={<Copy size={14} />}
								disabled={isMutating}
								onClick={() => {
									onDuplicate(procedure);
								}}
							>
								Duplicar configuración
							</Menu.Item>
							<Menu.Divider />
							<Menu.Item
								color="red"
								leftSection={<Trash2 size={14} />}
								disabled={isMutating}
								onClick={() => {
									onRemove(procedure);
								}}
							>
								Eliminar trámite
							</Menu.Item>
						</Menu.Dropdown>
					</Menu>
				</Group>

				<Group mt="lg" gap="md">
					<Switch
						label="Trámite activo"
						checked={procedure.isActive}
						disabled={isMutating}
						onChange={(event) => {
							onToggleActive(procedure, event.currentTarget.checked);
						}}
					/>
					{isMutating && (
						<Text size="xs" c="dimmed">
							Actualizando...
						</Text>
					)}
				</Group>
			</Box>

			<Tabs defaultValue="general" variant="outline" radius="xl">
				<Tabs.List p="md" pb={0}>
					<Tabs.Tab value="general" leftSection={<List size={16} />}>
						General
					</Tabs.Tab>
					<Tabs.Tab value="form" leftSection={<ClipboardList size={16} />}>
						Formulario
					</Tabs.Tab>
					<Tabs.Tab value="documents" leftSection={<FileCheck size={16} />}>
						Documentos
					</Tabs.Tab>
				</Tabs.List>

				<Tabs.Panel value="general" p="xl">
					<Stack gap="md">
						<Text fw={700}>Descripción</Text>
						<Text c="dimmed">{procedure.description || "Sin descripción"}</Text>
						<Divider />
						<Badge
							variant="light"
							color="gray"
							style={{ width: "fit-content" }}
						>
							Versión v{procedure.configVersion}
						</Badge>
						<Badge
							variant="light"
							color={procedure.requiresVehicle ? "orange" : "gray"}
							style={{ width: "fit-content" }}
						>
							Requiere vehículo: {procedure.requiresVehicle ? "Sí" : "No"}
						</Badge>
					</Stack>
				</Tabs.Panel>

				<Tabs.Panel value="form" p="xl">
					<JsonInput
						label="Form schema"
						value={JSON.stringify(procedure.formSchema ?? {}, null, 2)}
						readOnly
						minRows={8}
						radius="xl"
					/>
				</Tabs.Panel>

				<Tabs.Panel value="documents" p="xl">
					<Stack gap="md">
						<Group>
							<Badge
								variant="light"
								color={procedure.allowsPhysicalDocuments ? "teal" : "gray"}
							>
								Físicos: {procedure.allowsPhysicalDocuments ? "Sí" : "No"}
							</Badge>
							<Badge
								variant="light"
								color={procedure.allowsDigitalDocuments ? "blue" : "gray"}
							>
								Digitales: {procedure.allowsDigitalDocuments ? "Sí" : "No"}
							</Badge>
						</Group>
						<JsonInput
							label="Document schema"
							value={JSON.stringify(procedure.documentSchema ?? {}, null, 2)}
							readOnly
							minRows={8}
							radius="xl"
						/>
					</Stack>
				</Tabs.Panel>
			</Tabs>
		</Card>
	);
}

export function ProcedureDetailEmptyState() {
	return (
		<Card radius="xl" p={48} style={{ border: "1px solid #e5e7eb" }}>
			<Stack align="center" gap="md">
				<AlertCircle size={28} color="#9ca3af" />
				<Text c="dimmed">Selecciona un trámite para ver detalles.</Text>
			</Stack>
		</Card>
	);
}
