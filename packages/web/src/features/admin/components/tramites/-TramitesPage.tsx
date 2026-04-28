import {
	Alert,
	Box,
	Button,
	Card,
	Grid,
	Group,
	Skeleton,
	Stack,
	Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { AlertCircle, CheckCircle2, List, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { orpcClient } from "#/shared/lib/orpc-client";
import { AdminPageHeader } from "#/features/admin/components/-AdminPageHeader";
import { adminUi } from "#/features/admin/components/-admin-ui";
import { getErrorMessage } from "#/features/admin/components/-errors";
import { AddProcedureModal } from "./-AddProcedureModal";
import {
	ProcedureDetailEmptyState,
	ProcedureDetailPanel,
} from "./-ProcedureDetailPanel";
import { ProcedureSummaryCard } from "./-ProcedureSummaryCard";
import type { ProcedureCreateInput, ProcedureType } from "./-types";
import { buildDuplicateSlug } from "./-utils";

export function TramitesPage() {
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

	if (isLoading) {
		return (
			<Stack gap="xl">
				<Skeleton height={36} width="min(100%, 320px)" radius="md" mb="xs" />
				<Skeleton height={200} radius="lg" />
			</Stack>
		);
	}

	return (
		<Stack gap="lg">
			<AdminPageHeader
				title="Gestión de trámites"
				description="Definí qué procedimientos están disponibles para agendamiento ciudadano y mantené la configuración alineada con operaciones."
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
				<Alert
					color="red"
					variant="light"
					radius="md"
					icon={<AlertCircle size={16} />}
				>
					{error}
				</Alert>
			)}
			{notice && (
				<Alert
					color="teal"
					variant="light"
					radius="md"
					icon={<CheckCircle2 size={16} />}
				>
					{notice}
				</Alert>
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
				<Grid gap="lg">
					<Grid.Col span={{ base: 12, md: 5 }}>
						<Stack gap="sm">
							{procedures.map((procedure) => (
								<ProcedureSummaryCard
									key={procedure.id}
									procedure={procedure}
									selected={procedure.id === selectedProcedureId}
									onSelect={() => setSelectedProcedureId(procedure.id)}
								/>
							))}
						</Stack>
					</Grid.Col>

					<Grid.Col span={{ base: 12, md: 7 }}>
						{selectedProcedure ? (
							<ProcedureDetailPanel
								procedure={selectedProcedure}
								isMutating={isMutatingId === selectedProcedure.id}
								onToggleActive={handleToggleActive}
								onDuplicate={handleDuplicate}
								onRemove={handleRemove}
							/>
						) : (
							<ProcedureDetailEmptyState />
						)}
					</Grid.Col>
				</Grid>
			)}

			<AddProcedureModal
				opened={addModalOpened}
				onClose={closeAdd}
				onCreate={handleCreateProcedure}
			/>
		</Stack>
	);
}
