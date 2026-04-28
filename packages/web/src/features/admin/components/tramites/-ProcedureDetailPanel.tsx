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
import { adminUi } from "#/features/admin/components/-admin-ui";
import type { ProcedureType } from "./-types";

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
	const docCount =
		(procedure.documentSchema?.requirements as unknown[])?.length ?? 0;

	return (
		<Card
			className={adminUi.surface}
			radius="lg"
			p={0}
			bg="white"
			shadow="none"
		>
			<Box p="lg" className="border-b border-zinc-200/90">
				<Group justify="space-between" align="flex-start" wrap="nowrap">
					<Group gap="md">
						<Box className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-100">
							<FileText size={20} className="text-red-700" strokeWidth={1.5} />
						</Box>
						<Stack gap={2}>
							<Title order={2} className="text-xl">
								{procedure.name}
							</Title>
							<Text size="sm" className="font-mono text-zinc-500">
								{procedure.slug}
							</Text>
						</Stack>
					</Group>

					<Menu position="bottom-end">
						<Menu.Target>
							<ActionIcon variant="light" color="gray" radius="lg" size="lg">
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

				<Group mt="md" gap="md">
					<Switch
						label="Trámite activo"
						checked={procedure.isActive}
						disabled={isMutating}
						onChange={(event) => {
							onToggleActive(procedure, event.currentTarget.checked);
						}}
						size="sm"
					/>
					{isMutating && (
						<Text size="xs" c="dimmed">
							Actualizando...
						</Text>
					)}
				</Group>
			</Box>

			<Tabs defaultValue="general" variant="outline" radius="lg">
				<Tabs.List p="sm" pb={0}>
					<Tabs.Tab value="general" leftSection={<List size={14} />}>
						General
					</Tabs.Tab>
					<Tabs.Tab value="form" leftSection={<ClipboardList size={14} />}>
						Formulario
					</Tabs.Tab>
					<Tabs.Tab value="documents" leftSection={<FileCheck size={14} />}>
						Documentos
					</Tabs.Tab>
				</Tabs.List>

				<Tabs.Panel value="general" p="lg">
					<Stack gap="md">
						<Box>
							<Text
								size="xs"
								fw={700}
								className="uppercase tracking-wider text-zinc-500"
							>
								Descripción
							</Text>
							<Text mt="xs" c="dimmed">
								{procedure.description || "Sin descripción"}
							</Text>
						</Box>
						<Divider />
						<Group gap="sm">
							<Badge variant="light" color="gray">
								v{procedure.configVersion}
							</Badge>
							<Badge
								variant="light"
								color={procedure.requiresVehicle ? "orange" : "gray"}
							>
								Vehículo: {procedure.requiresVehicle ? "Sí" : "No"}
							</Badge>
							<Badge variant="light" color={docCount > 0 ? "dark" : "gray"}>
								{docCount} {docCount === 1 ? "requisito" : "requisitos"}
							</Badge>
						</Group>
					</Stack>
				</Tabs.Panel>

				<Tabs.Panel value="form" p="lg">
					<Stack gap="md">
						<Text
							size="xs"
							fw={700}
							className="uppercase tracking-wider text-zinc-500"
						>
							Esquema del formulario
						</Text>
						<JsonInput
							value={JSON.stringify(procedure.formSchema ?? {}, null, 2)}
							readOnly
							minRows={10}
							radius="md"
						/>
					</Stack>
				</Tabs.Panel>

				<Tabs.Panel value="documents" p="lg">
					<Stack gap="md">
						<Group>
							<Badge
								variant="light"
								color={procedure.allowsPhysicalDocuments ? "teal" : "gray"}
							>
								Físicos: {procedure.allowsPhysicalDocuments ? "Sí" : "No"}
							</Badge>
							<Badge variant="light" color="gray">
								Digitales: No
							</Badge>
						</Group>
						<Divider />
						<Text
							size="xs"
							fw={700}
							className="uppercase tracking-wider text-zinc-500"
						>
							Esquema de documentos
						</Text>
						<JsonInput
							value={JSON.stringify(procedure.documentSchema ?? {}, null, 2)}
							readOnly
							minRows={10}
							radius="md"
						/>
					</Stack>
				</Tabs.Panel>
			</Tabs>
		</Card>
	);
}

export function ProcedureDetailEmptyState() {
	return (
		<Card
			className={`${adminUi.surface} text-center`}
			radius="lg"
			p={60}
			shadow="none"
		>
			<Stack align="center" gap="md">
				<Box className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-100 ring-1 ring-zinc-200">
					<AlertCircle size={24} className="text-zinc-400" strokeWidth={1.5} />
				</Box>
				<Text className="text-base font-semibold text-zinc-900">
					Seleccioná un trámite
				</Text>
				<Text size="sm" className="max-w-sm leading-relaxed text-zinc-500">
					Elegí un trámite de la lista para ver su configuración, formularios y
					requisitos.
				</Text>
			</Stack>
		</Card>
	);
}
