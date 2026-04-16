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
	Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { AlertCircle, CheckCircle2, List, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { orpcClient } from "../../../lib/orpc-client";
import { getErrorMessage } from "../_shared/errors";
import { AddProcedureModal } from "./AddProcedureModal";
import {
	ProcedureDetailEmptyState,
	ProcedureDetailPanel,
} from "./ProcedureDetailPanel";
import { ProcedureSummaryCard } from "./ProcedureSummaryCard";
import type { ProcedureCreateInput, ProcedureType } from "./types";
import { buildDuplicateSlug } from "./utils";

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

			<AddProcedureModal
				opened={addModalOpened}
				onClose={closeAdd}
				onCreate={handleCreateProcedure}
			/>
		</Stack>
	);
}
