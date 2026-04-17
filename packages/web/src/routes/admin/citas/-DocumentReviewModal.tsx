import {
	Alert,
	Badge,
	Box,
	Button,
	Card,
	Center,
	Group,
	LoadingOverlay,
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
	Upload,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FormActionButton } from "../../../components/admin/forms";
import { PremiumModal } from "../../../components/admin/forms/PremiumModal";
import { orpcClient } from "../../../lib/orpc-client";
import { getErrorMessage } from "../_shared/-errors";
import type {
	BookingWithRelations,
	DocumentReviewAction,
	DocumentStatus,
	RequestDocument,
	User,
} from "./-types";

interface DocumentReviewModalProps {
	opened: boolean;
	onClose: () => void;
	booking: BookingWithRelations | null;
	onReviewComplete?: () => void;
}

type DocumentWithReviewer = RequestDocument & {
	reviewer?: User;
};

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
	digital: { label: "Digital", icon: <Upload size={12} /> },
	physical: { label: "Físico", icon: <Archive size={12} /> },
};

export function DocumentReviewModal({
	opened,
	onClose,
	booking,
	onReviewComplete,
}: DocumentReviewModalProps) {
	const [documents, setDocuments] = useState<DocumentWithReviewer[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [selectedDocument, setSelectedDocument] =
		useState<DocumentWithReviewer | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [reviewers, setReviewers] = useState<Record<string, User>>({});
	const [notes, setNotes] = useState("");

	const loadDocuments = useCallback(async () => {
		if (!booking?.request?.id) return;

		setIsLoading(true);
		setError(null);
		try {
			const docs = (await orpcClient.documents.admin.list({
				requestId: booking.request.id,
			})) as RequestDocument[];

			// Only show current documents
			const currentDocs = docs.filter((doc) => doc.isCurrent);

			// Load reviewer info for documents that have been reviewed
			const reviewerIds = [
				...new Set(
					currentDocs
						.map((doc) => doc.reviewedByUserId)
						.filter((id): id is string => !!id),
				),
			];

			const reviewerMap: Record<string, User> = { ...reviewers };
			if (reviewerIds.length > 0) {
				// In a real implementation, we'd have a user lookup endpoint
				// For now, we'll mark them as unknown reviewers
				for (const id of reviewerIds) {
					if (!reviewerMap[id]) {
						reviewerMap[id] = {
							id,
							name: "Funcionario",
							email: "",
							role: "admin",
						};
					}
				}
				setReviewers(reviewerMap);
			}

			const docsWithReviewers = currentDocs.map((doc) => ({
				...doc,
				reviewer: doc.reviewedByUserId
					? reviewerMap[doc.reviewedByUserId]
					: undefined,
			}));

			setDocuments(docsWithReviewers);
		} catch (loadError) {
			setError(
				getErrorMessage(
					loadError,
					"No se pudieron cargar los documentos de la solicitud.",
				),
			);
			setDocuments([]);
		} finally {
			setIsLoading(false);
		}
	}, [booking?.request?.id, reviewers]);

	useEffect(() => {
		if (opened && booking) {
			void loadDocuments();
			setSelectedDocument(null);
			setPreviewUrl(null);
			setNotes("");
			setSuccess(null);
		}
	}, [opened, booking, loadDocuments]);

	const handlePreview = async (document: DocumentWithReviewer) => {
		if (!document.storageKey) return;

		setSelectedDocument(document);
		try {
			const response = await orpcClient.documents.admin.download({
				documentId: document.id,
			});

			// Create object URL for preview
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

			// Create download link
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

		// Validate notes for reject action
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

			// Reload documents
			await loadDocuments();

			// Clear preview if it was the selected document
			if (selectedDocument) {
				setSelectedDocument(null);
				setPreviewUrl(null);
			}

			setNotes("");

			// Auto-hide success after 3 seconds
			setTimeout(() => setSuccess(null), 3000);

			onReviewComplete?.();
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

	const handleClose = () => {
		onClose();
		setSelectedDocument(null);
		setPreviewUrl(null);
		setNotes("");
		setError(null);
		setSuccess(null);
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

	if (!booking) return null;

	return (
		<PremiumModal
			opened={opened}
			onClose={handleClose}
			title="Revisión Documental"
			subtitle={
				booking.request?.procedure
					? `${booking.request.procedure.name} — ${booking.request.applicantName || "Sin identificar"}`
					: undefined
			}
			size="xl"
			overlayProps={{
				backgroundOpacity: 0.55,
				blur: 8,
			}}
		>
			<Stack gap="md">
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

				<Box style={{ position: "relative", minHeight: 200 }}>
					<LoadingOverlay visible={isLoading} />

					{documents.length === 0 && !isLoading ? (
						<Center py="xl">
							<Stack align="center" gap="sm">
								<ThemeIcon size="xl" variant="light" color="gray" radius="md">
									<FileText size={24} />
								</ThemeIcon>
								<Text c="dimmed" size="sm">
									No hay documentos cargados para esta solicitud
								</Text>
							</Stack>
						</Center>
					) : (
						<Stack gap="sm">
							{documents.map((doc) => {
								const config = statusConfig[doc.status];
								const deliveryConfig =
									deliveryModeConfig[
										doc.deliveryMode as "digital" | "physical"
									];

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
														{doc.mimeType && (
															<Text size="xs" c="dimmed">
																{formatFileSize(doc.fileSizeBytes)}
															</Text>
														)}
														{doc.reviewedByUserId && doc.reviewedAt && (
															<Tooltip
																label={`Revisado por ${doc.reviewer?.name || "Funcionario"} el ${formatDate(doc.reviewedAt)}`}
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

				{/* Review actions */}
				{selectedDocument && canApprove(selectedDocument) && (
					<Card
						padding="md"
						radius="md"
						withBorder
						bg="var(--mantine-color-gray-0)"
					>
						<Stack gap="md">
							<Text fw={500} size="sm">
								Acciones para: {selectedDocument.label}
							</Text>

							{selectedDocument.status === "pending" && (
								<FormActionButton
									variant="secondary"
									onClick={() => handleReviewAction("start_review")}
									loading={isSubmitting}
									size="sm"
								>
									<Search size={14} />
									Marcar en revisión
								</FormActionButton>
							)}

							<Group gap="sm">
								<FormActionButton
									variant="primary"
									onClick={() => handleReviewAction("approve")}
									loading={isSubmitting}
									size="sm"
								>
									<CheckCircle size={14} />
									Aprobar
								</FormActionButton>
								{(canReject(selectedDocument) ||
									selectedDocument.status === "rejected") && (
									<FormActionButton
										variant="danger"
										onClick={() => handleReviewAction("reject")}
										loading={isSubmitting}
										size="sm"
									>
										<XCircle size={14} />
										Rechazar
									</FormActionButton>
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
										minHeight: 60,
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
					</Card>
				)}

				{/* Info note */}
				{documents.length > 0 && (
					<Alert
						icon={<Info size={16} />}
						color="blue"
						variant="light"
						radius="md"
						title="Información"
					>
						<Text size="xs" c="dimmed">
							Selecciona un documento de la lista para ver las acciones de
							revisión disponibles. Los documentos marcados como "Entrega
							física" no pueden ser aprobados directamente hasta que se reciban
							físicamente.
						</Text>
					</Alert>
				)}
			</Stack>
		</PremiumModal>
	);
}
