import {
	ActionIcon,
	Alert,
	Button,
	SegmentedControl,
	Skeleton,
	Text,
	TextInput,
	Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
	AlertCircle,
	CheckCircle2,
	FileText,
	Plus,
	RefreshCw,
	Search,
	SearchX,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "#/features/admin/components/AdminPageHeader";
import { getErrorMessage } from "#/features/admin/components/errors";
import { EmptyState } from "#/features/admin/components/ui/EmptyState";
import { orpcClient } from "#/shared/lib/orpc-client";
import { AddProcedureModal } from "./AddProcedureModal";
import { DeleteProcedureModal } from "./DeleteProcedureModal";
import { EditProcedureModal } from "./EditProcedureModal";
import {
	type ProcedureSortDirection,
	type ProcedureSortKey,
	ProcedureTable,
} from "./ProcedureTable";
import type { ProcedureFormPayload } from "./procedure-form-model";
import classes from "./Tramites.module.css";
import type { ProcedureType } from "./types";
import { buildDuplicateSlug } from "./utils";

type StatusFilter = "all" | "active" | "inactive";

const STATUS_FILTERS = [
	{ label: "Todos", value: "all" },
	{ label: "Activos", value: "active" },
	{ label: "Inactivos", value: "inactive" },
];

export function TramitesPage() {
	const [procedures, setProcedures] = useState<ProcedureType[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isMutatingId, setIsMutatingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [sortKey, setSortKey] = useState<ProcedureSortKey>("name");
	const [sortDirection, setSortDirection] =
		useState<ProcedureSortDirection>("asc");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [editingProcedure, setEditingProcedure] =
		useState<ProcedureType | null>(null);
	const [procedureToDelete, setProcedureToDelete] =
		useState<ProcedureType | null>(null);
	const [addModalOpened, { open: openAddModal, close: closeAddModal }] =
		useDisclosure(false);
	const [editModalOpened, { open: openEditModal, close: closeEditModal }] =
		useDisclosure(false);

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
				setError(
					getErrorMessage(loadError, "No se pudieron cargar los trámites."),
				);
			})
			.finally(() => {
				if (mounted) setIsLoading(false);
			});
		return () => {
			mounted = false;
		};
	}, [loadProcedures]);

	const filteredProcedures = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLocaleLowerCase("es");
		const filtered = procedures.filter((procedure) => {
			const matchesStatus =
				statusFilter === "all" ||
				(statusFilter === "active" ? procedure.isActive : !procedure.isActive);
			const matchesSearch =
				!normalizedQuery ||
				procedure.name.toLocaleLowerCase("es").includes(normalizedQuery) ||
				procedure.slug.toLocaleLowerCase("es").includes(normalizedQuery) ||
				(procedure.description ?? "")
					.toLocaleLowerCase("es")
					.includes(normalizedQuery);
			return matchesStatus && matchesSearch;
		});

		return filtered.sort((first, second) => {
			let comparison = 0;
			if (sortKey === "name") {
				comparison = first.name.localeCompare(second.name, "es");
			} else if (sortKey === "status") {
				comparison = Number(first.isActive) - Number(second.isActive);
			} else {
				comparison = getRequirementCount(first) - getRequirementCount(second);
			}
			return sortDirection === "asc" ? comparison : -comparison;
		});
	}, [procedures, searchQuery, sortDirection, sortKey, statusFilter]);

	const activeCount = procedures.reduce(
		(total, procedure) => total + Number(procedure.isActive),
		0,
	);
	const configuredCount = procedures.reduce(
		(total, procedure) =>
			total +
			Number(
				getRequirementCount(procedure) > 0 || getFieldCount(procedure) > 0,
			),
		0,
	);

	const handleCreateProcedure = async (payload: ProcedureFormPayload) => {
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
			throw new Error(
				getErrorMessage(updateError, "No se pudo actualizar el trámite."),
			);
		} finally {
			setIsMutatingId(null);
		}
	};

	const handleToggleActive = (
		procedure: ProcedureType,
		nextActive: boolean,
	) => {
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
				setNotice(
					nextActive
						? "El trámite ya está disponible para la ciudadanía."
						: "El trámite se ocultó del flujo ciudadano.",
				);
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

	const handleDuplicate = (procedure: ProcedureType) => {
		void (async () => {
			setIsMutatingId(procedure.id);
			setError(null);
			setNotice(null);
			try {
				const slugSet = new Set(procedures.map((item) => item.slug));
				await orpcClient.admin.procedures.create({
					name: `${procedure.name} (copia)`,
					slug: buildDuplicateSlug(procedure.slug, slugSet),
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
				setNotice("Se creó una copia editable del trámite.");
			} catch (duplicateError) {
				setError(
					getErrorMessage(duplicateError, "No se pudo duplicar el trámite."),
				);
			} finally {
				setIsMutatingId(null);
			}
		})();
	};

	const handleRemove = async (procedure: ProcedureType) => {
		setIsMutatingId(procedure.id);
		setError(null);
		setNotice(null);
		try {
			const response = await orpcClient.admin.procedures.remove({
				id: procedure.id,
			});
			await loadProcedures();
			setNotice(response.message || "Trámite eliminado correctamente.");
		} catch (removeError) {
			throw new Error(
				getErrorMessage(removeError, "No se pudo eliminar el trámite."),
			);
		} finally {
			setIsMutatingId(null);
		}
	};

	const handleEdit = (procedure: ProcedureType) => {
		setEditingProcedure(procedure);
		openEditModal();
	};

	const handleCloseEdit = () => {
		closeEditModal();
		setEditingProcedure(null);
	};

	const handleSort = (key: ProcedureSortKey) => {
		if (sortKey === key) {
			setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
			return;
		}
		setSortKey(key);
		setSortDirection("asc");
	};

	const handleRetry = () => {
		setIsLoading(true);
		void loadProcedures()
			.catch((loadError) => {
				setError(
					getErrorMessage(loadError, "No se pudieron cargar los trámites."),
				);
			})
			.finally(() => setIsLoading(false));
	};

	const clearFilters = () => {
		setSearchQuery("");
		setStatusFilter("all");
	};

	return (
		<main className={classes.page}>
			<div className={classes.pageStack}>
				<AdminPageHeader
					title="Gestión de trámites"
					description="Administra el catálogo que la ciudadanía puede consultar y agendar. Define requisitos, datos solicitados y disponibilidad de cada trámite."
					actions={
						<Button
							leftSection={<Plus size={18} aria-hidden="true" />}
							color="red"
							onClick={openAddModal}
							className={classes.primaryAction}
						>
							Nuevo trámite
						</Button>
					}
				/>

				{error ? (
					<Alert
						color="red"
						variant="light"
						icon={<AlertCircle size={18} aria-hidden="true" />}
						withCloseButton
						onClose={() => setError(null)}
						role="alert"
					>
						{error}
					</Alert>
				) : null}
				{notice ? (
					<Alert
						color="teal"
						variant="light"
						icon={<CheckCircle2 size={18} aria-hidden="true" />}
						withCloseButton
						onClose={() => setNotice(null)}
						role="status"
					>
						{notice}
					</Alert>
				) : null}

				<section
					className={classes.catalog}
					aria-labelledby="procedure-catalog-title"
				>
					<div className={classes.catalogHeader}>
						<div>
							<h2 id="procedure-catalog-title" className={classes.catalogTitle}>
								Catálogo ciudadano
							</h2>
							<p className={classes.catalogDescription}>
								Solo los trámites activos aparecen durante el agendamiento.
							</p>
						</div>
						{procedures.length > 0 ? (
							<fieldset className={classes.catalogStats}>
								<legend className={classes.visuallyHidden}>
									Resumen del catálogo
								</legend>
								<span>
									<strong>{activeCount}</strong> activos
								</span>
								<span>
									<strong>{procedures.length - activeCount}</strong> inactivos
								</span>
								<span>
									<strong>{configuredCount}</strong> configurados
								</span>
							</fieldset>
						) : null}
					</div>

					{isLoading ? (
						<CatalogSkeleton />
					) : procedures.length === 0 && error ? (
						<EmptyState
							icon={RefreshCw}
							title="No pudimos cargar el catálogo"
							description="Revisa la conexión e intenta consultar los trámites nuevamente."
							action={
								<Button
									variant="default"
									leftSection={<RefreshCw size={16} aria-hidden="true" />}
									onClick={handleRetry}
								>
									Reintentar
								</Button>
							}
						/>
					) : procedures.length === 0 ? (
						<EmptyState
							icon={FileText}
							title="Crea el primer trámite"
							description="Configura el servicio, sus requisitos y la información que deberá completar la ciudadanía."
							action={
								<Button
									color="red"
									leftSection={<Plus size={16} aria-hidden="true" />}
									onClick={openAddModal}
								>
									Crear primer trámite
								</Button>
							}
						/>
					) : (
						<>
							<div className={classes.toolbar}>
								<TextInput
									type="search"
									aria-label="Buscar trámites"
									placeholder="Buscar por nombre, descripción o identificador"
									leftSection={<Search size={16} aria-hidden="true" />}
									rightSection={
										searchQuery ? (
											<Tooltip label="Limpiar búsqueda">
												<ActionIcon
													variant="subtle"
													color="gray"
													aria-label="Limpiar búsqueda"
													onClick={() => setSearchQuery("")}
												>
													<X size={15} aria-hidden="true" />
												</ActionIcon>
											</Tooltip>
										) : null
									}
									value={searchQuery}
									onChange={(event) =>
										setSearchQuery(event.currentTarget.value)
									}
									className={classes.searchInput}
								/>
								<SegmentedControl
									aria-label="Filtrar trámites por estado"
									data={STATUS_FILTERS}
									value={statusFilter}
									onChange={(value) => setStatusFilter(value as StatusFilter)}
									className={classes.statusFilter}
								/>
								<Text size="sm" c="dimmed" className={classes.resultsCount}>
									{filteredProcedures.length} de {procedures.length}
								</Text>
							</div>

							{filteredProcedures.length > 0 ? (
								<ProcedureTable
									procedures={filteredProcedures}
									sortKey={sortKey}
									sortDirection={sortDirection}
									isMutatingId={isMutatingId}
									onSort={handleSort}
									onEdit={handleEdit}
									onDuplicate={handleDuplicate}
									onToggleActive={handleToggleActive}
									onDelete={setProcedureToDelete}
								/>
							) : (
								<EmptyState
									icon={SearchX}
									title="No encontramos trámites"
									description="Prueba otro término o elimina los filtros para ver el catálogo completo."
									action={
										<Button variant="default" onClick={clearFilters}>
											Limpiar filtros
										</Button>
									}
								/>
							)}
						</>
					)}
				</section>
			</div>

			<AddProcedureModal
				opened={addModalOpened}
				onClose={closeAddModal}
				onCreate={handleCreateProcedure}
			/>

			{editingProcedure ? (
				<EditProcedureModal
					opened={editModalOpened}
					onClose={handleCloseEdit}
					procedure={editingProcedure}
					onUpdate={handleUpdateProcedure}
				/>
			) : null}

			{procedureToDelete ? (
				<DeleteProcedureModal
					procedure={procedureToDelete}
					onClose={() => setProcedureToDelete(null)}
					onConfirm={handleRemove}
				/>
			) : null}
		</main>
	);
}

function CatalogSkeleton() {
	return (
		<div
			className={classes.catalogSkeleton}
			role="status"
			aria-label="Cargando trámites"
		>
			<div className={classes.toolbar}>
				<Skeleton height={38} className={classes.searchInput} />
				<Skeleton height={38} width={250} />
			</div>
			<Skeleton height={48} radius={0} />
			<Skeleton height={74} radius={0} />
			<Skeleton height={74} radius={0} />
			<Skeleton height={74} radius={0} />
		</div>
	);
}

function getRequirementCount(procedure: ProcedureType): number {
	return (
		(procedure.documentSchema?.requirements as unknown[] | undefined)?.length ??
		0
	);
}

function getFieldCount(procedure: ProcedureType): number {
	return (procedure.formSchema?.fields as unknown[] | undefined)?.length ?? 0;
}
