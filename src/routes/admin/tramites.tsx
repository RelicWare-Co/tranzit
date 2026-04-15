import {
	ActionIcon,
	Alert,
	Badge,
	Box,
	Button,
	Card,
	Divider,
	Grid,
	Group,
	JsonInput,
	Menu,
	Modal,
	Skeleton,
	Stack,
	Switch,
	Tabs,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	Car,
	CheckCircle2,
	ClipboardList,
	Copy,
	FileCheck,
	FileText,
	List,
	MoreHorizontal,
	Plus,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { orpcClient } from "../../lib/orpc-client";

export const Route = createFileRoute("/admin/tramites")({
	component: TramitesPage,
});

type ProcedureType = Awaited<
	ReturnType<typeof orpcClient.admin.procedures.list>
>[number];

type ProcedureCreateInput = Parameters<
	typeof orpcClient.admin.procedures.create
>[0];

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof (error as { message?: unknown }).message === "string"
	) {
		return (error as { message: string }).message;
	}

	return fallback;
}

function buildDuplicateSlug(baseSlug: string, existing: Set<string>): string {
	let next = `${baseSlug}-copia`;
	let index = 2;
	while (existing.has(next)) {
		next = `${baseSlug}-copia-${index}`;
		index += 1;
	}
	return next;
}

function AddProcedureModal({
	opened,
	onClose,
	onCreate,
}: {
	opened: boolean;
	onClose: () => void;
	onCreate: (payload: ProcedureCreateInput) => Promise<void>;
}) {
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [description, setDescription] = useState("");
	const [requiresVehicle, setRequiresVehicle] = useState(false);
	const [allowsPhysical, setAllowsPhysical] = useState(true);
	const [allowsDigital, setAllowsDigital] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleClose = () => {
		if (isSubmitting) return;
		setError(null);
		onClose();
	};

	const handleSubmit = async () => {
		setIsSubmitting(true);
		setError(null);
		try {
			await onCreate({
				name,
				slug,
				description: description || undefined,
				requiresVehicle,
				allowsPhysicalDocuments: allowsPhysical,
				allowsDigitalDocuments: allowsDigital,
			});
			setName("");
			setSlug("");
			setDescription("");
			setRequiresVehicle(false);
			setAllowsPhysical(true);
			setAllowsDigital(true);
			onClose();
		} catch (submitError) {
			setError(getErrorMessage(submitError, "No se pudo crear el trámite."));
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal
			opened={opened}
			onClose={handleClose}
			title="Nuevo trámite"
			size="lg"
			radius="xl"
		>
			<Stack gap="md">
				{error && (
					<Alert color="red" icon={<AlertCircle size={16} />}>
						{error}
					</Alert>
				)}
				<TextInput
					label="Nombre"
					value={name}
					onChange={(event) => setName(event.currentTarget.value)}
					placeholder="Ej: Renovación de Licencia"
					radius="xl"
					disabled={isSubmitting}
				/>
				<TextInput
					label="Slug"
					value={slug}
					onChange={(event) =>
						setSlug(
							event.currentTarget.value
								.toLowerCase()
								.replace(/[^a-z0-9-]/g, "-"),
						)
					}
					placeholder="renovacion-licencia"
					radius="xl"
					disabled={isSubmitting}
				/>
				<Textarea
					label="Descripción"
					value={description}
					onChange={(event) => setDescription(event.currentTarget.value)}
					placeholder="Describe el trámite..."
					minRows={3}
					radius="xl"
					disabled={isSubmitting}
				/>
				<Switch
					label="Requiere vehículo"
					checked={requiresVehicle}
					onChange={(event) => setRequiresVehicle(event.currentTarget.checked)}
					disabled={isSubmitting}
				/>
				<Group grow>
					<Switch
						label="Permite documentos físicos"
						checked={allowsPhysical}
						onChange={(event) => setAllowsPhysical(event.currentTarget.checked)}
						disabled={isSubmitting}
					/>
					<Switch
						label="Permite documentos digitales"
						checked={allowsDigital}
						onChange={(event) => setAllowsDigital(event.currentTarget.checked)}
						disabled={isSubmitting}
					/>
				</Group>
				<Group justify="flex-end" mt="sm">
					<Button
						variant="light"
						color="gray"
						onClick={handleClose}
						radius="xl"
					>
						Cancelar
					</Button>
					<Button
						leftSection={<Plus size={16} />}
						onClick={handleSubmit}
						radius="xl"
						loading={isSubmitting}
						disabled={!name.trim() || !slug.trim()}
					>
						Crear trámite
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}

function TramitesPage() {
	const [procedures, setProcedures] = useState<ProcedureType[]>([]);
	const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(true);
	const [isMutatingId, setIsMutatingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [addModalOpened, { open: openAdd, close: closeAdd }] =
		useDisclosure(false);

	const loadProcedures = useCallback(async () => {
		setError(null);
		const data = await orpcClient.admin.procedures.list({});
		setProcedures(data);
		setSelectedProcedureId((current) => {
			if (current && data.some((procedure) => procedure.id === current)) {
				return current;
			}
			return data[0]?.id ?? null;
		});
	}, []);

	useEffect(() => {
		let mounted = true;
		setIsLoading(true);
		void loadProcedures()
			.catch((loadError) => {
				if (!mounted) return;
				setError(
					getErrorMessage(loadError, "No se pudieron cargar los trámites."),
				);
			})
			.finally(() => {
				if (mounted) {
					setIsLoading(false);
				}
			});

		return () => {
			mounted = false;
		};
	}, [loadProcedures]);

	const selectedProcedure = useMemo(
		() =>
			procedures.find((procedure) => procedure.id === selectedProcedureId) ??
			null,
		[procedures, selectedProcedureId],
	);

	const activeCount = procedures.filter(
		(procedure) => procedure.isActive,
	).length;

	const handleCreateProcedure = async (payload: ProcedureCreateInput) => {
		setNotice(null);
		setError(null);
		await orpcClient.admin.procedures.create(payload);
		await loadProcedures();
		setNotice("Trámite creado correctamente.");
	};

	const handleToggleActive = async (
		procedure: ProcedureType,
		nextActive: boolean,
	) => {
		setIsMutatingId(procedure.id);
		setError(null);
		setNotice(null);
		try {
			await orpcClient.admin.procedures.update({
				id: procedure.id,
				isActive: nextActive,
			});
			await loadProcedures();
		} catch (updateError) {
			setError(
				getErrorMessage(
					updateError,
					"No se pudo actualizar el estado del trámite.",
				),
			);
		} finally {
			setIsMutatingId(null);
		}
	};

	const handleDuplicate = async (procedure: ProcedureType) => {
		setIsMutatingId(procedure.id);
		setError(null);
		setNotice(null);
		try {
			const slugSet = new Set(procedures.map((p) => p.slug));
			const duplicateSlug = buildDuplicateSlug(procedure.slug, slugSet);

			await orpcClient.admin.procedures.create({
				name: `${procedure.name} (Copia)`,
				slug: duplicateSlug,
				description: procedure.description ?? undefined,
				requiresVehicle: procedure.requiresVehicle,
				allowsPhysicalDocuments: procedure.allowsPhysicalDocuments,
				allowsDigitalDocuments: procedure.allowsDigitalDocuments,
				instructions: procedure.instructions ?? undefined,
				eligibilitySchema: procedure.eligibilitySchema,
				formSchema: procedure.formSchema,
				documentSchema: procedure.documentSchema,
				policySchema: procedure.policySchema,
			});
			await loadProcedures();
			setNotice("Se duplicó la configuración del trámite.");
		} catch (duplicateError) {
			setError(
				getErrorMessage(duplicateError, "No se pudo duplicar el trámite."),
			);
		} finally {
			setIsMutatingId(null);
		}
	};

	const handleRemove = async (procedure: ProcedureType) => {
		if (!window.confirm(`¿Eliminar trámite "${procedure.name}"?`)) {
			return;
		}

		setIsMutatingId(procedure.id);
		setError(null);
		setNotice(null);
		try {
			const response = await orpcClient.admin.procedures.remove({
				id: procedure.id,
			});
			await loadProcedures();
			setNotice(response.message || "Operación completada.");
		} catch (removeError) {
			setError(getErrorMessage(removeError, "No se pudo eliminar el trámite."));
		} finally {
			setIsMutatingId(null);
		}
	};

	if (isLoading) {
		return (
			<Stack gap="xl">
				<Skeleton height={48} radius="xl" />
				<Skeleton height={220} radius="xl" />
			</Stack>
		);
	}

	return (
		<Stack gap="xl">
			<Group justify="space-between" align="flex-start" wrap="nowrap">
				<Box>
					<Title order={1}>Gestión de Trámites</Title>
					<Text c="dimmed" mt="xs">
						Configura qué trámites están disponibles para agendamiento
						ciudadano.
					</Text>
				</Box>
				<Button leftSection={<Plus size={18} />} radius="xl" onClick={openAdd}>
					Nuevo trámite
				</Button>
			</Group>

			{error && (
				<Alert color="red" icon={<AlertCircle size={16} />}>
					{error}
				</Alert>
			)}
			{notice && (
				<Alert color="teal" icon={<CheckCircle2 size={16} />}>
					{notice}
				</Alert>
			)}

			<Card
				radius="xl"
				p="lg"
				bg="#eff6ff"
				style={{ border: "1px solid #bfdbfe" }}
			>
				<Group gap="md" align="center">
					<List size={24} color="#2563eb" />
					<Stack gap={2}>
						<Text fw={700} c="#1e40af">
							{activeCount} de {procedures.length} trámites activos
						</Text>
						<Text size="sm" c="#3b82f6">
							Solo los trámites activos aparecen en el flujo ciudadano.
						</Text>
					</Stack>
				</Group>
			</Card>

			<Grid gap="xl">
				<Grid.Col span={{ base: 12, md: 5 }}>
					<Stack gap="md">
						{procedures.map((procedure) => {
							const selected = procedure.id === selectedProcedureId;
							const docCount =
								(procedure.documentSchema?.requirements as unknown[])?.length ??
								0;
							return (
								<Card
									key={procedure.id}
									onClick={() => setSelectedProcedureId(procedure.id)}
									radius="xl"
									p="lg"
									bg={selected ? "#fef2f2" : "white"}
									style={{
										cursor: "pointer",
										border: selected
											? "2px solid #e03131"
											: "1px solid #e5e7eb",
									}}
								>
									<Stack gap="xs">
										<Group justify="space-between" wrap="nowrap">
											<Text fw={700} lineClamp={1}>
												{procedure.name}
											</Text>
											<Badge
												variant="light"
												color={procedure.isActive ? "teal" : "gray"}
											>
												{procedure.isActive ? "Activo" : "Inactivo"}
											</Badge>
										</Group>
										<Text size="xs" c="dimmed">
											{procedure.slug}
										</Text>
										<Group gap="xs">
											{procedure.requiresVehicle && (
												<Badge
													color="orange"
													variant="light"
													leftSection={<Car size={10} />}
												>
													Vehículo
												</Badge>
											)}
											<Badge
												color={docCount > 0 ? "cyan" : "gray"}
												variant="light"
												leftSection={<FileCheck size={10} />}
											>
												{docCount} requisitos
											</Badge>
										</Group>
									</Stack>
								</Card>
							);
						})}
					</Stack>
				</Grid.Col>

				<Grid.Col span={{ base: 12, md: 7 }}>
					{selectedProcedure ? (
						<Card
							radius="xl"
							p={0}
							bg="white"
							style={{ border: "1px solid #e5e7eb" }}
						>
							<Box p="xl" style={{ borderBottom: "1px solid #e5e7eb" }}>
								<Group justify="space-between" align="flex-start" wrap="nowrap">
									<Group gap="md">
										<FileText size={28} color="#e03131" />
										<Stack gap={4}>
											<Title order={2}>{selectedProcedure.name}</Title>
											<Text size="sm" c="dimmed">
												{selectedProcedure.slug}
											</Text>
										</Stack>
									</Group>

									<Menu position="bottom-end">
										<Menu.Target>
											<ActionIcon
												variant="light"
												color="gray"
												radius="xl"
												size="lg"
											>
												<MoreHorizontal size={18} />
											</ActionIcon>
										</Menu.Target>
										<Menu.Dropdown>
											<Menu.Item
												leftSection={<Copy size={14} />}
												disabled={isMutatingId === selectedProcedure.id}
												onClick={() => {
													void handleDuplicate(selectedProcedure);
												}}
											>
												Duplicar configuración
											</Menu.Item>
											<Menu.Divider />
											<Menu.Item
												color="red"
												leftSection={<Trash2 size={14} />}
												disabled={isMutatingId === selectedProcedure.id}
												onClick={() => {
													void handleRemove(selectedProcedure);
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
										checked={selectedProcedure.isActive}
										disabled={isMutatingId === selectedProcedure.id}
										onChange={(event) => {
											void handleToggleActive(
												selectedProcedure,
												event.currentTarget.checked,
											);
										}}
									/>
									{isMutatingId === selectedProcedure.id && (
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
									<Tabs.Tab
										value="form"
										leftSection={<ClipboardList size={16} />}
									>
										Formulario
									</Tabs.Tab>
									<Tabs.Tab
										value="documents"
										leftSection={<FileCheck size={16} />}
									>
										Documentos
									</Tabs.Tab>
								</Tabs.List>

								<Tabs.Panel value="general" p="xl">
									<Stack gap="md">
										<Text fw={700}>Descripción</Text>
										<Text c="dimmed">
											{selectedProcedure.description || "Sin descripción"}
										</Text>
										<Divider />
										<Badge
											variant="light"
											color="gray"
											style={{ width: "fit-content" }}
										>
											Versión v{selectedProcedure.configVersion}
										</Badge>
										<Badge
											variant="light"
											color={
												selectedProcedure.requiresVehicle ? "orange" : "gray"
											}
											style={{ width: "fit-content" }}
										>
											Requiere vehículo:{" "}
											{selectedProcedure.requiresVehicle ? "Sí" : "No"}
										</Badge>
									</Stack>
								</Tabs.Panel>

								<Tabs.Panel value="form" p="xl">
									<JsonInput
										label="Form schema"
										value={JSON.stringify(
											selectedProcedure.formSchema ?? {},
											null,
											2,
										)}
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
												color={
													selectedProcedure.allowsPhysicalDocuments
														? "teal"
														: "gray"
												}
											>
												Físicos:{" "}
												{selectedProcedure.allowsPhysicalDocuments
													? "Sí"
													: "No"}
											</Badge>
											<Badge
												variant="light"
												color={
													selectedProcedure.allowsDigitalDocuments
														? "blue"
														: "gray"
												}
											>
												Digitales:{" "}
												{selectedProcedure.allowsDigitalDocuments ? "Sí" : "No"}
											</Badge>
										</Group>
										<JsonInput
											label="Document schema"
											value={JSON.stringify(
												selectedProcedure.documentSchema ?? {},
												null,
												2,
											)}
											readOnly
											minRows={8}
											radius="xl"
										/>
									</Stack>
								</Tabs.Panel>
							</Tabs>
						</Card>
					) : (
						<Card radius="xl" p={48} style={{ border: "1px solid #e5e7eb" }}>
							<Stack align="center" gap="md">
								<AlertCircle size={28} color="#9ca3af" />
								<Text c="dimmed">Selecciona un trámite para ver detalles.</Text>
							</Stack>
						</Card>
					)}
				</Grid.Col>
			</Grid>

			<AddProcedureModal
				opened={addModalOpened}
				onClose={closeAdd}
				onCreate={handleCreateProcedure}
			/>
		</Stack>
	);
}
