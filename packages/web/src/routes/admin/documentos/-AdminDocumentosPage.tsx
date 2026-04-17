import {
	Alert,
	Badge,
	Box,
	Button,
	Card,
	Center,
	Group,
	LoadingOverlay,
	Select,
	Stack,
	Text,
	ThemeIcon,
	Tooltip,
} from "@mantine/core";
import {
	AlertCircle,
	Archive,
	CheckCircle,
	Clock,
	Download,
	FileText,
	Info,
	Search,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PremiumModal } from "../../../components/admin/forms/PremiumModal";
import { orpcClient } from "../../../lib/orpc-client";
import { getErrorMessage } from "../_shared/-errors";

type DocumentStatus =
	| "pending"
	| "in_review"
	| "valid"
	| "rejected"
	| "marked_as_physical";

type DocumentReviewAction = "approve" | "reject" | "start_review";

interface RequestDocument {
	id: string;
	requestId: string;
	requirementKey: string;
	label: string;
	deliveryMode: "digital" | "physical";
	storageKey: string | null;
	fileName: string | null;
	mimeType: string | null;
	fileSizeBytes: number | null;
	status: DocumentStatus;
	isCurrent: boolean;
	replacesDocumentId: string | null;
	reviewedByUserId: string | null;
	reviewedAt: string | Date | null;
	notes: string | null;
	createdAt: string | Date;
	updatedAt: string | Date;
	serviceRequest?: {
		id: string;
		status: string;
		procedure?: {
			id: string;
			slug: string;
			name: string;
		} | null;
	} | null;
}

type DocumentWithReviewer = RequestDocument;

const statusConfig: Record<
	DocumentStatus,
	{
		color: string;
		label: string;
		icon: React.ReactNode;
		variant: "light" | "filled" | "outline";
	}
> = {
	pending: {
		color: "yellow",
		label: "Pendiente",
		icon: <Clock size={14} />,
		variant: "light",
	},
	in_review: {
		color: "blue",
		label: "En revisión",
		icon: <Search size={14} />,
		variant: "light",
	},
	valid: {
		color: "green",
		label: "Válido",
		icon: <CheckCircle size={14} />,
		variant: "light",
	},
	rejected: {
		color: "red",
		label: "Rechazado",
		icon: <XCircle size={14} />,
		variant: "light",
	},
	marked_as_physical: {
		color: "gray",
		label: "Entrega física",
		icon: <Archive size={14} />,
		variant: "light",
	},
};

const deliveryModeConfig = {
	digital: { label: "Digital", icon: <FileText size={12} /> },
	physical: { label: "Físico", icon: <Archive size={12} /> },
};

const statusFilterOptions = [
	{ value: "all", label: "Todos los estados" },
	{ value: "pending", label: "Pendientes" },
	{ value: "in_review", label: "En revisión" },
	{ value: "valid", label: "Válidos" },
	{ value: "rejected", label: "Rechazados" },
	{ value: "marked_as_physical", label: "Entrega física" },
];

export function AdminDocumentosPage() {
	const [documents, setDocuments] = useState<DocumentWithReviewer[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [selectedDocument, setSelectedDocument] =
		useState<DocumentWithReviewer | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [notes, setNotes] = useState("");
	const [statusFilter, setStatusFilter] = useState<string | null>("pending");
	const [reviewModalOpen, setReviewModalOpen] = useState(false);

	const loadDocuments = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const filters: { status?: string[]; isCurrent?: boolean } = {
				isCurrent: true,
			};

			if (statusFilter && statusFilter !== "all") {
				filters.status = [statusFilter];
			}

			const docs = (await orpcClient.documents.admin.listAll(
				filters,
			)) as RequestDocument[];
			setDocuments(docs);
		} catch (loadError) {
			setError(
				getErrorMessage(
					loadError,
					"No se pudieron cargar los documentos para revisión.",
				),
			);
			setDocuments([]);
		} finally {
			setIsLoading(false);
		}
	}, [statusFilter]);

	useEffect(() => {
		void loadDocuments();
	}, [loadDocuments]);

	const handlePreview = async (document: DocumentWithReviewer) => {
		if (!document.storageKey) return;

		setSelectedDocument(document);
		try {
			const response = await orpcClient.documents.admin.download({
				documentId: document.id,
			});

			const blob = new Blob([response.content], { type: response.mimeType });
			const url = URL.createObjectURL(blob);
			setPreviewUrl(url);
		} catch (previewError) {
			setError(
				getErrorMessage(
					previewError,
					"No se pudo cargar la vista previa del documento.",
				),
			);
		}
	};

	const handleDownload = async (doc: DocumentWithReviewer) => {
		if (!doc.fileName || !doc.mimeType) return;

		try {
			const response = await orpcClient.documents.admin.download({
				documentId: doc.id,
			});

			const blob = new Blob([response.content], { type: response.mimeType });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = doc.fileName;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (downloadError) {
			setError(
				getErrorMessage(downloadError, "No se pudo descargar el documento."),
			);
		}
	};

	const handleReviewAction = async (action: DocumentReviewAction) => {
		if (!selectedDocument) return;

		if (action === "reject") {
			if (!notes || notes.trim() === "") {
				setError(
					"El rechazo de un documento requiere una justificación no vacía.",
				);
				return;
			}
		}

		setIsSubmitting(true);
		setError(null);
		setSuccess(null);

		try {
			await orpcClient.documents.admin.review({
				documentId: selectedDocument.id,
				action,
				notes: notes?.trim() || undefined,
			});

			const actionLabels = {
				approve: "aprobado",
				reject: "rechazado",
				start_review: "marcado para revisión",
			};

			setSuccess(`Documento ${actionLabels[action]} correctamente.`);
			await loadDocuments();

			if (selectedDocument) {
				setSelectedDocument(null);
				setPreviewUrl(null);
			}

			setNotes("");
			setReviewModalOpen(false);

			setTimeout(() => setSuccess(null), 3000);
		} catch (reviewError) {
			setError(
				getErrorMessage(
					reviewError,
					"No se pudo realizar la acción de revisión.",
				),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const canPreview = (doc: RequestDocument) =>
		doc.deliveryMode === "digital" && !!doc.storageKey;

	const canApprove = (doc: RequestDocument) =>
		["pending", "in_review", "rejected"].includes(doc.status);

	const canReject = (doc: RequestDocument) =>
		["pending", "in_review"].includes(doc.status);

	const formatDate = (date: string | Date) => {
		return new Date(date).toLocaleDateString("es-CO", {
			day: "2-digit",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const formatFileSize = (bytes: number | null) => {
		if (!bytes) return "—";
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	const pendingCount = documents.filter((d) => d.status === "pending").length;
	const validCount = documents.filter((d) => d.status === "valid").length;
	const rejectedCount = documents.filter((d) => d.status === "rejected").length;
	const inReviewCount = documents.filter(
		(d) => d.status === "in_review",
	).length;

	const handleOpenReviewModal = (doc: DocumentWithReviewer) => {
		setSelectedDocument(doc);
		setReviewModalOpen(true);
		setNotes("");
	};

	const handleCloseReviewModal = () => {
		setReviewModalOpen(false);
		setSelectedDocument(null);
		setNotes("");
	};

	return (
		<Stack gap="md">
			<Box className="flex items-center justify-between">
				<div>
					<Text className="text-lg font-semibold text-zinc-900">
						Revisión Documental
					</Text>
					<Text className="text-sm text-zinc-500">
						Revisa y gestiona los documentos cargados por los ciudadanos
					</Text>
				</div>
				<Select
					value={statusFilter}
					onChange={setStatusFilter}
					data={statusFilterOptions}
					size="sm"
					w={200}
				/>
			</Box>

			{/* Summary badges */}
			{documents.length > 0 && (
				<Group gap="sm">
					<Badge
						variant="light"
						color={pendingCount > 0 ? "yellow" : "gray"}
						size="sm"
					>
						{pendingCount} pendientes
					</Badge>
					<Badge variant="light" color="blue" size="sm">
						{inReviewCount} en revisión
					</Badge>
					<Badge variant="light" color="green" size="sm">
						{validCount} válidos
					</Badge>
					<Badge variant="light" color="red" size="sm">
						{rejectedCount} rechazados
					</Badge>
					<Badge variant="outline" color="gray" size="sm">
						{documents.length} total
					</Badge>
				</Group>
			)}

			{error && (
				<Alert
					icon={<AlertCircle size={16} />}
					color="red"
					radius="md"
					variant="light"
					onClose={() => setError(null)}
				>
					{error}
				</Alert>
			)}

			{success && (
				<Alert
					icon={<CheckCircle size={16} />}
					color="green"
					radius="md"
					variant="light"
					onClose={() => setSuccess(null)}
				>
					{success}
				</Alert>
			)}

			<Box style={{ position: "relative", minHeight: 300 }}>
				<LoadingOverlay visible={isLoading} />

				{documents.length === 0 && !isLoading ? (
					<Center py="xl">
						<Stack align="center" gap="sm">
							<ThemeIcon size="xl" variant="light" color="gray" radius="md">
								<FileText size={24} />
							</ThemeIcon>
							<Text c="dimmed" size="sm">
								No hay documentos para mostrar con los filtros actuales
							</Text>
						</Stack>
					</Center>
				) : (
					<Stack gap="sm">
						{documents.map((doc) => {
							const config = statusConfig[doc.status];
							const deliveryConfig =
								deliveryModeConfig[doc.deliveryMode as "digital" | "physical"];

							return (
								<Card
									key={doc.id}
									padding="md"
									radius="md"
									withBorder
									className="transition-all duration-150"
									style={{
										borderColor:
											selectedDocument?.id === doc.id
												? "var(--mantine-color-dark)"
												: undefined,
										backgroundColor:
											selectedDocument?.id === doc.id
												? "var(--mantine-color-gray-0)"
												: undefined,
									}}
								>
									<Group justify="space-between" wrap="nowrap">
										<Group
											gap="md"
											wrap="nowrap"
											style={{ flex: 1, minWidth: 0 }}
										>
											<ThemeIcon
												size="lg"
												variant="light"
												color={config.color}
												radius="md"
											>
												{config.icon}
											</ThemeIcon>

											<Box style={{ flex: 1, minWidth: 0 }}>
												<Group gap="xs" wrap="nowrap">
													<Text fw={500} size="sm" truncate>
														{doc.label}
													</Text>
													<Badge
														variant={config.variant}
														color={config.color}
														size="sm"
														leftSection={config.icon}
													>
														{config.label}
													</Badge>
												</Group>
												<Group gap="xs" mt={4}>
													<Badge
														variant="outline"
														size="xs"
														leftSection={deliveryConfig.icon}
													>
														{deliveryConfig.label}
													</Badge>
													{doc.serviceRequest?.procedure && (
														<Text size="xs" c="dimmed" truncate>
															{doc.serviceRequest.procedure.name}
														</Text>
													)}
													{doc.mimeType && (
														<Text size="xs" c="dimmed">
															{formatFileSize(doc.fileSizeBytes)}
														</Text>
													)}
													{doc.reviewedByUserId && doc.reviewedAt && (
														<Tooltip
															label={`Revisado el ${formatDate(doc.reviewedAt)}`}
														>
															<Text size="xs" c="dimmed">
																• Revisado
															</Text>
														</Tooltip>
													)}
												</Group>
											</Box>
										</Group>

										<Group gap="xs">
											{canPreview(doc) && (
												<Tooltip label="Vista previa">
													<Button
														variant="subtle"
														size="xs"
														onClick={() => handlePreview(doc)}
													>
														<Search size={14} />
													</Button>
												</Tooltip>
											)}
											{doc.storageKey && (
												<Tooltip label="Descargar">
													<Button
														variant="subtle"
														size="xs"
														onClick={() => handleDownload(doc)}
													>
														<Download size={14} />
													</Button>
												</Tooltip>
											)}
											{(canApprove(doc) || canReject(doc)) && (
												<Tooltip label="Revisar">
													<Button
														variant="light"
														color="red"
														size="xs"
														onClick={() => handleOpenReviewModal(doc)}
													>
														Revisar
													</Button>
												</Tooltip>
											)}
										</Group>
									</Group>
								</Card>
							);
						})}
					</Stack>
				)}
			</Box>

			{/* Preview section */}
			{previewUrl && selectedDocument && (
				<Card padding="md" radius="md" withBorder>
					<Group justify="space-between" mb="sm">
						<Text fw={500} size="sm">
							Vista previa: {selectedDocument.fileName}
						</Text>
						<Button
							variant="subtle"
							size="xs"
							onClick={() => {
								setPreviewUrl(null);
								setSelectedDocument(null);
							}}
						>
							Cerrar
						</Button>
					</Group>
					{selectedDocument.mimeType?.includes("image") ? (
						<Box
							component="img"
							src={previewUrl}
							alt={selectedDocument.fileName || "Documento"}
							style={{
								maxWidth: "100%",
								maxHeight: 300,
								objectFit: "contain",
								borderRadius: "var(--mantine-radius-md)",
							}}
						/>
					) : selectedDocument.mimeType === "application/pdf" ? (
						<Box
							component="iframe"
							src={previewUrl}
							style={{
								width: "100%",
								height: 300,
								border: "none",
								borderRadius: "var(--mantine-radius-md)",
							}}
							title="Vista previa PDF"
						/>
					) : (
						<Alert
							icon={<Info size={16} />}
							color="blue"
							variant="light"
							radius="md"
						>
							No hay vista previa disponible para este tipo de archivo. Usa el
							botón de descarga.
						</Alert>
					)}
				</Card>
			)}

			{/* Review Modal */}
			<PremiumModal
				opened={reviewModalOpen}
				onClose={handleCloseReviewModal}
				title="Revisar Documento"
				subtitle={
					selectedDocument
						? `${selectedDocument.label} — ${selectedDocument.serviceRequest?.procedure?.name || "Sin trámite"}`
						: undefined
				}
				size="md"
				overlayProps={{
					backgroundOpacity: 0.55,
					blur: 8,
				}}
			>
				<Stack gap="md">
					{selectedDocument && canApprove(selectedDocument) && (
						<Stack gap="md">
							{selectedDocument.status === "pending" && (
								<Button
									variant="outline"
									onClick={() => handleReviewAction("start_review")}
									loading={isSubmitting}
									size="sm"
									fullWidth
								>
									<Search size={14} />
									Marcar en revisión
								</Button>
							)}

							<Group gap="sm">
								<Button
									variant="filled"
									color="green"
									onClick={() => handleReviewAction("approve")}
									loading={isSubmitting}
									size="sm"
									flex={1}
								>
									<CheckCircle size={14} />
									Aprobar
								</Button>
								{canReject(selectedDocument) && (
									<Button
										variant="filled"
										color="red"
										onClick={() => handleReviewAction("reject")}
										loading={isSubmitting}
										size="sm"
										flex={1}
									>
										<XCircle size={14} />
										Rechazar
									</Button>
								)}
							</Group>

							<Box>
								<Text size="xs" c="dimmed" mb="xs">
									{selectedDocument.status === "rejected"
										? "Nueva justificación para re-rechazo (opcional):"
										: "Justificación para rechazo (requerida):"}
								</Text>
								<textarea
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
									placeholder="Escribe la justificación..."
									style={{
										width: "100%",
										minHeight: 80,
										padding: "var(--mantine-spacing-sm)",
										border: "1px solid var(--mantine-color-gray-4)",
										borderRadius: "var(--mantine-radius-md)",
										fontFamily: "inherit",
										fontSize: "var(--mantine-font-size-sm)",
										resize: "vertical",
									}}
								/>
							</Box>
						</Stack>
					)}

					<Alert
						icon={<Info size={16} />}
						color="blue"
						variant="light"
						radius="md"
						title="Información"
					>
						<Text size="xs" c="dimmed">
							{selectedDocument?.status === "marked_as_physical"
								? "Este documento fue marcado como entrega física. No puede ser aprobado directamente hasta que se reciba físicamente."
								: "Selecciona una acción para revisar este documento. El rechazo requiere una justificación escrita."}
						</Text>
					</Alert>
				</Stack>
			</PremiumModal>
		</Stack>
	);
}
