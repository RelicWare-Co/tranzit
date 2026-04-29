import {
	ActionIcon,
	Badge,
	Box,
	Button,
	Card,
	Group,
	Menu,
	Skeleton,
	Stack,
	Table,
	Text,
	TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
	AlertCircle,
	CheckCircle2,
	Copy,
	Edit3,
	FileText,
	List,
	MoreHorizontal,
	Plus,
	Search,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { orpcClient } from "#/shared/lib/orpc-client";
import { AdminPageHeader } from "#/features/admin/components/AdminPageHeader";
import { adminUi } from "#/features/admin/components/admin-ui";
import { getErrorMessage } from "#/features/admin/components/errors";
import { AddProcedureModal } from "./AddProcedureModal";
import { EditProcedureModal } from "./EditProcedureModal";
import type { ProcedureType } from "./types";
import { buildDuplicateSlug } from "./utils";

type SortKey = "name" | "slug" | "status" | "requirements";
type SortDir = "asc" | "desc";

export function TramitesPage() {
	const [procedures, setProcedures] = useState<ProcedureType[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isMutatingId, setIsMutatingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [sortKey, setSortKey] = useState<SortKey>("name");
	const [sortDir, setSortDir] = useState<SortDir>("asc");
	const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
	const [addModalOpened, { open: openAdd, close: closeAdd }] = useDisclosure(false);
	const [editModalOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
	const [editingProcedure, setEditingProcedure] = useState<ProcedureType | null>(null);

	const loadProcedures = useCallback(async () => {
		setError(null);
		const data = await orpcClient.admin.procedures.list({});
		setProcedures(data);
	}, []);

	useEffect(() => {
		let mounted = true;
		setIsLoading(true);
		void loadProcedures()
			.catch((loadError) => {
				if (!mounted) return;
				setError(getErrorMessage(loadError, "No se pudieron cargar los trámites."));
			})
			.finally(() => {
				if (mounted) setIsLoading(false);
			});
		return () => {
			mounted = false;
		};
	}, [loadProcedures]);

	const filteredProcedures = useMemo(() => {
		let result = [...procedures];

		if (statusFilter !== "all") {
			result = result.filter((p) =>
				statusFilter === "active" ? p.isActive : !p.isActive,
			);
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(
				(p) =>
					p.name.toLowerCase().includes(q) ||
					p.slug.toLowerCase().includes(q) ||
					(p.description ?? "").toLowerCase().includes(q),
			);
		}

		result.sort((a, b) => {
			let cmp = 0;
			switch (sortKey) {
				case "name":
					cmp = a.name.localeCompare(b.name);
					break;
				case "slug":
					cmp = a.slug.localeCompare(b.slug);
					break;
				case "status":
					cmp = Number(b.isActive) - Number(a.isActive);
					break;
				case "requirements": {
					const aCount =
						(a.documentSchema?.requirements as unknown[])?.length ?? 0;
					const bCount =
						(b.documentSchema?.requirements as unknown[])?.length ?? 0;
					cmp = bCount - aCount;
					break;
				}
			}
			return sortDir === "asc" ? cmp : -cmp;
		});

		return result;
	}, [procedures, searchQuery, sortKey, sortDir, statusFilter]);

	const activeCount = procedures.filter((p) => p.isActive).length;

	const handleCreateProcedure = async (payload: {
		name: string;
		slug: string;
		description?: string;
		requiresVehicle: boolean;
		allowsPhysicalDocuments: boolean;
		instructions?: string;
		documentSchema?: Record<string, unknown>;
		formSchema?: Record<string, unknown>;
	}) => {
		setNotice(null);
		setError(null);
		await orpcClient.admin.procedures.create(payload);
		await loadProcedures();
		setNotice("Trámite creado correctamente.");
	};

	const handleUpdateProcedure = async (payload: {
		id: string;
		name?: string;
		description?: string;
		requiresVehicle?: boolean;
		allowsPhysicalDocuments?: boolean;
		instructions?: string;
		documentSchema?: Record<string, unknown>;
		formSchema?: Record<string, unknown>;
	}) => {
		setNotice(null);
		setError(null);
		setIsMutatingId(payload.id);
		try {
			await orpcClient.admin.procedures.update(payload);
			await loadProcedures();
			setNotice("Trámite actualizado correctamente.");
		} catch (updateError) {
			setError(getErrorMessage(updateError, "No se pudo actualizar el trámite."));
		} finally {
			setIsMutatingId(null);
		}
	};

	const handleToggleActive = (procedure: ProcedureType, nextActive: boolean) => {
		void (async () => {
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
		})();
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
				allowsDigitalDocuments: false,
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

	const handleEdit = (procedure: ProcedureType) => {
		setEditingProcedure(procedure);
		openEdit();
	};

	const toggleSort = (key: SortKey) => {
		if (sortKey === key) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortKey(key);
			setSortDir("asc");
		}
	};

	const SortIndicator = ({ column }: { column: SortKey }) => {
		if (sortKey !== column) return <span className="text-zinc-300 ml-1">↕</span>;
		return (
			<span className="text-zinc-700 ml-1 font-bold">
				{sortDir === "asc" ? "↑" : "↓"}
			</span>
		);
	};

	if (isLoading) {
		return (
			<Stack gap="xl">
				<Skeleton height={36} width="min(100%, 320px)" radius="md" mb="xs" />
				<Skeleton height={48} radius="lg" />
				<Skeleton height={400} radius="lg" />
			</Stack>
		);
	}

	return (
		<Stack gap="lg">
			<AdminPageHeader
				title="Gestión de trámites"
				description="Definí qué procedimientos están disponibles para agendamiento ciudadano. Configurá requisitos, formularios y mantené la información alineada con operaciones."
				actions={
					<Button
						leftSection={<Plus size={18} strokeWidth={1.75} />}
						radius="md"
						color="red"
						className="font-semibold"
						onClick={openAdd}
					>
						Nuevo trámite
					</Button>
				}
			/>

			{error && (
				<InlineAlert color="red" icon={<AlertCircle size={16} />}>
					{error}
				</InlineAlert>
			)}
			{notice && (
				<InlineAlert color="teal" icon={<CheckCircle2 size={16} />}>
					{notice}
				</InlineAlert>
			)}

			{procedures.length > 0 ? (
				<Card className={adminUi.callout} radius="lg" p="md" shadow="none">
					<Group gap="md" align="flex-start">
						<Box className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-zinc-200">
							<List size={18} className="text-red-700" strokeWidth={1.75} />
						</Box>
						<Stack gap={2}>
							<Text className="text-base font-semibold text-zinc-900">
								{activeCount} de {procedures.length} trámites activos
							</Text>
							<Text size="sm" className="leading-relaxed text-zinc-600">
								Solo los trámites activos se muestran en el flujo ciudadano.
							</Text>
						</Stack>
					</Group>
				</Card>
			) : null}

			{procedures.length === 0 ? (
				<Card
					className={`${adminUi.surface} text-center`}
					radius="lg"
					p={48}
					shadow="none"
				>
					<Stack align="center" gap="lg">
						<Box className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 ring-1 ring-zinc-200">
							<List size={22} className="text-zinc-400" strokeWidth={1.5} />
						</Box>
						<Text className="text-base font-semibold text-zinc-900">
							No hay trámites registrados
						</Text>
						<Button
							color="red"
							onClick={openAdd}
							radius="md"
							leftSection={<Plus size={16} strokeWidth={1.75} />}
							className="font-semibold"
						>
							Crear primer trámite
						</Button>
					</Stack>
				</Card>
			) : (
				<Stack gap="md">
					<Group gap="sm" wrap="wrap">
						<TextInput
							placeholder="Buscar trámites..."
							leftSection={<Search size={16} className="text-zinc-400" />}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.currentTarget.value)}
							radius="md"
							size="sm"
							className="flex-1 min-w-[240px]"
							styles={{
								input: {
									"&:focus": {
										boxShadow: "0 0 0 3px rgba(9, 9, 11, 0.08)",
									},
								},
							}}
						/>
						<Group gap="xs">
							{(["all", "active", "inactive"] as const).map((status) => (
								<Button
									key={status}
									size="sm"
									radius="md"
									variant={statusFilter === status ? "filled" : "light"}
									color={statusFilter === status ? "dark" : "gray"}
									onClick={() => setStatusFilter(status)}
									className="font-medium"
								>
									{status === "all" && "Todos"}
									{status === "active" && "Activos"}
									{status === "inactive" && "Inactivos"}
								</Button>
							))}
						</Group>
					</Group>

					<Card
						className={adminUi.surface}
						radius="lg"
						p={0}
						shadow="none"
					>
						<Table.ScrollContainer minWidth={600}>
							<Table verticalSpacing="sm" highlightOnHover>
								<Table.Thead>
									<Table.Tr className="bg-zinc-50/80">
										<Table.Th
											className="cursor-pointer select-none font-['Sora'] text-xs font-semibold uppercase tracking-wider text-zinc-500"
											onClick={() => toggleSort("name")}
										>
											Trámite <SortIndicator column="name" />
										</Table.Th>
										<Table.Th
											className="cursor-pointer select-none font-['Sora'] text-xs font-semibold uppercase tracking-wider text-zinc-500"
											onClick={() => toggleSort("slug")}
										>
											Slug <SortIndicator column="slug" />
										</Table.Th>
										<Table.Th
											className="cursor-pointer select-none font-['Sora'] text-xs font-semibold uppercase tracking-wider text-zinc-500"
											onClick={() => toggleSort("status")}
										>
											Estado <SortIndicator column="status" />
										</Table.Th>
										<Table.Th
											className="cursor-pointer select-none font-['Sora'] text-xs font-semibold uppercase tracking-wider text-zinc-500"
											onClick={() => toggleSort("requirements")}
										>
											Requisitos <SortIndicator column="requirements" />
										</Table.Th>
										<Table.Th className="font-['Sora'] text-xs font-semibold uppercase tracking-wider text-zinc-500 w-12" />
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{filteredProcedures.map((procedure) => {
										const docCount =
											(procedure.documentSchema?.requirements as unknown[])
												?.length ?? 0;
										const isMutating = isMutatingId === procedure.id;

										return (
											<Table.Tr
												key={procedure.id}
												className={
													!procedure.isActive ? "opacity-60" : ""
												}
											>
												<Table.Td>
													<Group gap="sm" wrap="nowrap">
														<Box className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-100">
															<FileText
																size={16}
																className="text-red-700"
																strokeWidth={1.5}
															/>
														</Box>
														<Stack gap={0}>
															<Text
																className="font-semibold text-zinc-900 text-sm"
																lineClamp={1}
															>
																{procedure.name}
															</Text>
															{procedure.description && (
																<Text
																	size="xs"
																	className="text-zinc-500"
																	lineClamp={1}
																>
																	{procedure.description}
																</Text>
															)}
														</Stack>
													</Group>
												</Table.Td>
												<Table.Td>
													<code className="text-xs font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
														{procedure.slug}
													</code>
												</Table.Td>
												<Table.Td>
													<Badge
														variant="light"
														color={procedure.isActive ? "teal" : "gray"}
														size="sm"
													>
														{procedure.isActive ? "Activo" : "Inactivo"}
														{isMutating && "..."}
													</Badge>
													{procedure.requiresVehicle && (
														<Badge
															variant="light"
															color="orange"
															size="sm"
															ml="xs"
														>
															Vehículo
														</Badge>
													)}
												</Table.Td>
												<Table.Td>
													<Text size="sm" className="text-zinc-600">
														{docCount}{" "}
														{docCount === 1
															? "requisito"
															: "requisitos"}
													</Text>
												</Table.Td>
												<Table.Td>
													<Menu position="bottom-end" withinPortal>
														<Menu.Target>
															<ActionIcon
																variant="subtle"
																color="gray"
																radius="md"
																size="sm"
															>
																<MoreHorizontal size={16} />
															</ActionIcon>
														</Menu.Target>
														<Menu.Dropdown>
															<Menu.Item
																leftSection={<Edit3 size={14} />}
																disabled={isMutating}
																onClick={() => handleEdit(procedure)}
															>
																Editar
															</Menu.Item>
															<Menu.Item
																leftSection={<Copy size={14} />}
																disabled={isMutating}
																onClick={() => handleDuplicate(procedure)}
															>
																Duplicar
															</Menu.Item>
															<Menu.Item
																leftSection={
																	procedure.isActive ? (
																		<AlertCircle size={14} />
																	) : (
																		<CheckCircle2 size={14} />
																	)
																}
																disabled={isMutating}
																onClick={() =>
																	handleToggleActive(
																		procedure,
																		!procedure.isActive,
																	)
																}
															>
																{procedure.isActive
																	? "Desactivar"
																	: "Activar"}
															</Menu.Item>
															<Menu.Divider />
															<Menu.Item
																leftSection={<Trash2 size={14} />}
																color="red"
																disabled={isMutating}
																onClick={() => handleRemove(procedure)}
															>
																Eliminar
															</Menu.Item>
														</Menu.Dropdown>
													</Menu>
												</Table.Td>
											</Table.Tr>
										);
									})}
								</Table.Tbody>
							</Table>
						</Table.ScrollContainer>

						{filteredProcedures.length === 0 && (
							<Box p="xl" className="text-center">
								<Text className="text-zinc-500">
									No se encontraron trámites con los filtros aplicados.
								</Text>
							</Box>
						)}
					</Card>
				</Stack>
			)}

			<AddProcedureModal
				opened={addModalOpened}
				onClose={closeAdd}
				onCreate={handleCreateProcedure}
			/>

			{editingProcedure && (
				<EditProcedureModal
					opened={editModalOpened}
					onClose={() => {
						closeEdit();
						setEditingProcedure(null);
					}}
					procedure={editingProcedure}
					onUpdate={handleUpdateProcedure}
				/>
			)}
		</Stack>
	);
}

// Simple Alert component for inline use
function InlineAlert({
	color,
	icon,
	children,
}: {
	color: "red" | "teal";
	icon: React.ReactNode;
	children: React.ReactNode;
}) {
	const bgMap = {
		red: "bg-red-50",
		teal: "bg-teal-50",
	};
	const textMap = {
		red: "text-red-800",
		teal: "text-teal-800",
	};
	return (
		<Box
			className={`flex items-start gap-3 rounded-md ${bgMap[color]} px-4 py-3`}
		>
			<Box className="mt-0.5 shrink-0">{icon}</Box>
			<Text size="sm" className={textMap[color]}>
				{children}
			</Text>
		</Box>
	);
}
