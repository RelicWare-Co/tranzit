import {
	Alert,
	Badge,
	Box,
	Button,
	Card,
	Divider,
	Group,
	Progress,
	Stack,
	Text,
	ThemeIcon,
	Tooltip,
} from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, FileText, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { orpcClient } from "../lib/orpc-client";

export type DocumentItem = {
	id: string;
	requirementKey: string;
	label: string;
	deliveryMode: "digital" | "physical";
	status: string;
	fileName?: string | null;
	mimeType?: string | null;
	fileSizeBytes?: number | null;
	isCurrent: boolean;
	createdAt: Date | string;
};

interface DocumentUploadProps {
	requestId: string;
	requirements?: Array<{ key: string; label: string }>;
	onDocumentsChange?: (documents: DocumentItem[]) => void;
}

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
	"application/pdf",
	"image/png",
	"image/jpeg",
]);
const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]);

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMimeFromExtension(fileName: string): string | null {
	const ext = fileName.toLowerCase().split(".").pop();
	const map: Record<string, string> = {
		pdf: "application/pdf",
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
	};
	return ext && map[ext] ? map[ext] : null;
}

function getStatusColor(status: string): string {
	switch (status) {
		case "pending":
			return "yellow";
		case "in_review":
			return "blue";
		case "valid":
			return "green";
		case "rejected":
			return "red";
		case "marked_as_physical":
			return "grape";
		default:
			return "gray";
	}
}

function getStatusLabel(status: string): string {
	switch (status) {
		case "pending":
			return "Pendiente";
		case "in_review":
			return "En revisión";
		case "valid":
			return "Aprobado";
		case "rejected":
			return "Rechazado";
		case "marked_as_physical":
			return "Entrega física";
		default:
			return status;
	}
}

export function DocumentUpload({
	requestId,
	requirements = [],
}: DocumentUploadProps) {
	const [documents, setDocuments] = useState<DocumentItem[]>([]);
	const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
		{},
	);
	const [dragOver, setDragOver] = useState<Record<string, boolean>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [selectedDeliveryMode, setSelectedDeliveryMode] = useState<
		Record<string, "digital" | "physical">
	>({});

	const uploadMutation = useMutation({
		mutationFn: async (payload: {
			requestId: string;
			requirementKey: string;
			label: string;
			fileName: string;
			mimeType: string;
			fileSizeBytes: number;
			content: string;
			deliveryMode: "digital" | "physical";
		}) => {
			return await orpcClient.documents.upload(payload);
		},
		onMutate: (variables) => {
			setUploadProgress((prev) => ({
				...prev,
				[variables.requirementKey]: 0,
			}));
		},
		onSuccess: (data, variables) => {
			setDocuments((prev) => {
				// Remove previous documents for this requirement that are marked as not current
				const filtered = prev.filter(
					(d) => d.requirementKey !== variables.requirementKey || d.isCurrent,
				);
				return [
					...filtered.filter(
						(d) => d.requirementKey !== variables.requirementKey,
					),
					{
						id: data.id,
						requirementKey: data.requirementKey,
						label: data.label,
						deliveryMode: data.deliveryMode as "digital" | "physical",
						status: data.status,
						fileName: data.fileName,
						mimeType: data.mimeType,
						fileSizeBytes: data.fileSizeBytes,
						isCurrent: data.isCurrent,
						createdAt: data.createdAt,
					},
				];
			});
			setUploadProgress((prev) => ({
				...prev,
				[variables.requirementKey]: 100,
			}));
			setTimeout(() => {
				setUploadProgress((prev) => {
					const next = { ...prev };
					delete next[variables.requirementKey];
					return next;
				});
			}, 1500);
			setErrors((prev) => {
				const next = { ...prev };
				delete next[variables.requirementKey];
				return next;
			});
		},
		onError: (error, variables) => {
			setErrors((prev) => ({
				...prev,
				[variables.requirementKey]:
					error instanceof Error ? error.message : "Error al subir archivo",
			}));
			setUploadProgress((prev) => {
				const next = { ...prev };
				delete next[variables.requirementKey];
				return next;
			});
		},
	});

	const declarePhysicalMutation = useMutation({
		mutationFn: async (payload: {
			requestId: string;
			requirementKey: string;
			label: string;
		}) => {
			return await orpcClient.documents.declarePhysical(payload);
		},
		onSuccess: (data) => {
			setDocuments((prev) => [
				...prev.filter((d) => d.requirementKey !== data.requirementKey),
				{
					id: data.id,
					requirementKey: data.requirementKey,
					label: data.label,
					deliveryMode: "physical",
					status: data.status,
					fileName: null,
					mimeType: null,
					fileSizeBytes: null,
					isCurrent: data.isCurrent,
					createdAt: data.createdAt,
				},
			]);
			setErrors((prev) => {
				const next = { ...prev };
				delete next[data.requirementKey];
				return next;
			});
		},
		onError: (error, variables) => {
			setErrors((prev) => ({
				...prev,
				[variables.requirementKey]:
					error instanceof Error
						? error.message
						: "Error al declarar entrega física",
			}));
		},
	});

	const listDocumentsMutation = useMutation({
		mutationFn: async () => {
			return await orpcClient.documents.list({ requestId });
		},
		onSuccess: (data) => {
			// Only keep current documents
			const currentDocs = data
				.filter((d) => d.isCurrent)
				.map((d) => ({
					...d,
					deliveryMode: d.deliveryMode as "digital" | "physical",
				}));
			setDocuments(currentDocs);
		},
	});

	// Load existing documents on mount
	useEffect(() => {
		listDocumentsMutation.mutate();
	}, [listDocumentsMutation.mutate]);

	const validateFile = useCallback(
		(file: File, _requirementKey: string): string | null => {
			// Check file size
			if (file.size > MAX_FILE_SIZE_BYTES) {
				return `El archivo excede el tamaño máximo de ${MAX_FILE_SIZE_MB}MB`;
			}

			// Check MIME type
			if (!ALLOWED_MIME_TYPES.has(file.type)) {
				return `Tipo de archivo no soportado. Tipos permitidos: PDF, PNG, JPG`;
			}

			// Check extension
			const ext = `.${file.name.toLowerCase().split(".").pop()}`;
			if (!ALLOWED_EXTENSIONS.has(ext)) {
				return `Extensión no válida. Extensiones permitidas: ${Array.from(
					ALLOWED_EXTENSIONS,
				).join(", ")}`;
			}

			return null;
		},
		[],
	);

	const handleFileSelect = useCallback(
		async (file: File, requirementKey: string, label: string) => {
			const error = validateFile(file, requirementKey);
			if (error) {
				setErrors((prev) => ({ ...prev, [requirementKey]: error }));
				return;
			}

			// Read file as base64
			const reader = new FileReader();
			reader.onload = () => {
				const base64 = (reader.result as string).split(",")[1];
				const mimeType = getMimeFromExtension(file.name) || file.type;

				// Simulate progress
				const progressInterval = setInterval(() => {
					setUploadProgress((prev) => ({
						...prev,
						[requirementKey]: Math.min((prev[requirementKey] || 0) + 20, 90),
					}));
				}, 200);

				uploadMutation.mutate({
					requestId,
					requirementKey,
					label,
					fileName: file.name,
					mimeType,
					fileSizeBytes: file.size,
					content: base64,
					deliveryMode: "digital",
				});

				clearInterval(progressInterval);
			};
			reader.readAsDataURL(file);
		},
		[requestId, uploadMutation, validateFile],
	);

	const handleDrop = useCallback(
		(event: React.DragEvent, requirementKey: string, label: string) => {
			event.preventDefault();
			setDragOver((prev) => ({ ...prev, [requirementKey]: false }));

			const file = event.dataTransfer.files[0];
			if (file) {
				void handleFileSelect(file, requirementKey, label);
			}
		},
		[handleFileSelect],
	);

	const handleDragOver = useCallback((event: React.DragEvent) => {
		event.preventDefault();
	}, []);

	const handleDragLeave = useCallback((event: React.DragEvent) => {
		event.preventDefault();
	}, []);

	const handleDeliveryModeChange = useCallback(
		(requirementKey: string, label: string, mode: "digital" | "physical") => {
			setSelectedDeliveryMode((prev) => ({ ...prev, [requirementKey]: mode }));

			if (mode === "physical") {
				declarePhysicalMutation.mutate({
					requestId,
					requirementKey,
					label,
				});
			}
		},
		[requestId, declarePhysicalMutation],
	);

	// Refresh documents when requestId changes
	useEffect(() => {
		listDocumentsMutation.mutate();
	}, [listDocumentsMutation.mutate]);

	// Notify parent of document changes
	const currentDocuments = documents.filter((d) => d.isCurrent);

	return (
		<Stack gap="md">
			{requirements.length === 0 ? (
				<Alert icon={<FileText size={16} />} color="gray">
					No se requieren documentos para este trámite.
				</Alert>
			) : (
				requirements.map((req) => {
					const currentDoc = currentDocuments.find(
						(d) => d.requirementKey === req.key,
					);
					const isUploading = uploadProgress[req.key] !== undefined;
					const progress = uploadProgress[req.key] || 0;
					const error = errors[req.key];
					const isPhysical = selectedDeliveryMode[req.key] === "physical";

					return (
						<Card key={req.key} withBorder radius="md" p="md">
							<Stack gap="sm">
								<Group justify="space-between" wrap="nowrap">
									<Text fw={600} size="sm">
										{req.label}
									</Text>
									{currentDoc && (
										<Badge color={getStatusColor(currentDoc.status)} size="sm">
											{getStatusLabel(currentDoc.status)}
										</Badge>
									)}
								</Group>

								{/* Delivery mode toggle */}
								<Group gap="xs">
									<Button
										size="xs"
										variant={isPhysical ? "default" : "filled"}
										color={isPhysical ? undefined : "blue"}
										onClick={() =>
											handleDeliveryModeChange(req.key, req.label, "digital")
										}
										disabled={isUploading}
									>
										Digital
									</Button>
									<Button
										size="xs"
										variant={isPhysical ? "filled" : "default"}
										color={isPhysical ? "grape" : undefined}
										onClick={() =>
											handleDeliveryModeChange(req.key, req.label, "physical")
										}
										disabled={isUploading}
									>
										Físico
									</Button>
								</Group>

								{isPhysical ? (
									currentDoc && currentDoc.status === "marked_as_physical" ? (
										<Alert
											icon={<CheckCircle2 size={16} />}
											color="green"
											radius="sm"
										>
											Documento marcado para entrega física en la cita.
										</Alert>
									) : (
										<Text size="xs" c="dimmed">
											Selecciona "Físico" para entregar este documento
											presencialmente en tu cita.
										</Text>
									)
								) : (
									<>
										{/* Drop zone */}
										<Box
											onDrop={(e) => handleDrop(e, req.key, req.label)}
											onDragOver={handleDragOver}
											onDragLeave={handleDragLeave}
											style={{
												border: `2px dashed ${
													dragOver[req.key]
														? "var(--mantine-color-blue-6)"
														: error
															? "var(--mantine-color-red-6)"
															: "var(--mantine-color-gray-3)"
												}`,
												borderRadius: "var(--mantine-radius-md)",
												padding: "var(--mantine-spacing-md)",
												textAlign: "center",
												transition: "border-color 0.2s",
												backgroundColor: dragOver[req.key]
													? "var(--mantine-color-blue-0)"
													: undefined,
												cursor: "pointer",
											}}
										>
											<input
												type="file"
												id={`file-${req.key}`}
												accept=".pdf,.png,.jpg,.jpeg"
												style={{ display: "none" }}
												onChange={(e) => {
													const file = e.target.files?.[0];
													if (file) {
														void handleFileSelect(file, req.key, req.label);
													}
												}}
												disabled={isUploading}
											/>
											<label
												htmlFor={`file-${req.key}`}
												style={{ cursor: "pointer" }}
											>
												<Stack gap="xs" align="center">
													<ThemeIcon
														size="lg"
														variant="light"
														color={error ? "red" : "blue"}
														radius="xl"
													>
														{isUploading ? (
															<Progress
																size="sm"
																value={progress}
																style={{ width: 40 }}
															/>
														) : (
															<Upload size={16} />
														)}
													</ThemeIcon>
													<Text size="xs" c="dimmed">
														Arrastra un archivo o haz clic para seleccionar
													</Text>
													<Text size="xs" c="dimmed">
														PDF, PNG, JPG (máx. {MAX_FILE_SIZE_MB}MB)
													</Text>
												</Stack>
											</label>
										</Box>

										{/* Uploaded file info */}
										{currentDoc && currentDoc.deliveryMode === "digital" && (
											<Group justify="space-between" wrap="nowrap">
												<Group gap="sm" wrap="nowrap">
													<ThemeIcon size="sm" variant="light" radius="sm">
														<FileText size={14} />
													</ThemeIcon>
													<Stack gap={0}>
														<Text size="xs" fw={500} truncate>
															{currentDoc.fileName}
														</Text>
														{currentDoc.fileSizeBytes && (
															<Text size="xs" c="dimmed">
																{formatFileSize(currentDoc.fileSizeBytes)}
															</Text>
														)}
													</Stack>
												</Group>
												<Tooltip label="Eliminar">
													<Button
														size="xs"
														variant="subtle"
														color="red"
														p={4}
														onClick={() => {
															// For now, just remove from local state
															// In a full implementation, would call delete API
															setDocuments((prev) =>
																prev.filter((d) => d.id !== currentDoc.id),
															);
														}}
													>
														<X size={14} />
													</Button>
												</Tooltip>
											</Group>
										)}

										{error && (
											<Alert
												icon={<AlertCircle size={14} />}
												color="red"
												radius="sm"
												withCloseButton
												onClose={() =>
													setErrors((prev) => {
														const next = { ...prev };
														delete next[req.key];
														return next;
													})
												}
											>
												<Text size="xs">{error}</Text>
											</Alert>
										)}
									</>
								)}
							</Stack>
						</Card>
					);
				})
			)}

			{/* Summary of uploaded documents */}
			{currentDocuments.length > 0 && (
				<>
					<Divider label="Documentos cargados" labelPosition="center" />
					<Stack gap="xs">
						{currentDocuments.map((doc) => (
							<Group key={doc.id} justify="space-between" wrap="nowrap">
								<Group gap="sm" wrap="nowrap">
									<ThemeIcon
										size="sm"
										variant="light"
										color={doc.deliveryMode === "physical" ? "grape" : "blue"}
										radius="sm"
									>
										{doc.deliveryMode === "physical" ? (
											<FileText size={14} />
										) : (
											<Upload size={14} />
										)}
									</ThemeIcon>
									<Stack gap={0}>
										<Text size="xs" fw={500}>
											{doc.label}
										</Text>
										<Text size="xs" c="dimmed">
											{doc.deliveryMode === "physical"
												? "Entrega física"
												: doc.fileName}
										</Text>
									</Stack>
								</Group>
								<Badge color={getStatusColor(doc.status)} size="sm">
									{getStatusLabel(doc.status)}
								</Badge>
							</Group>
						))}
					</Stack>
				</>
			)}
		</Stack>
	);
}
