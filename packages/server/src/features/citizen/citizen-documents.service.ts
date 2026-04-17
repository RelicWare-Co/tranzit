import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../lib/db";
import { logger } from "../../lib/logger";
import { throwRpcError } from "../../orpc/shared";

// Constants
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set([
	"application/pdf",
	"image/png",
	"image/jpeg",
]);
const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]);

// Zod schema for input validation
const uploadDocumentSchema = z.object({
	requestId: z.string().trim().min(1, "requestId is required"),
	requirementKey: z.string().trim().min(1, "requirementKey is required"),
	label: z.string().trim().min(1, "label is required"),
	deliveryMode: z.enum(["digital", "physical"]),
	fileName: z.string().trim().min(1, "fileName is required"),
	mimeType: z.string().trim().min(1, "mimeType is required"),
	fileSizeBytes: z.number().int().positive(),
	content: z.string(), // base64 encoded content
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export type UploadDocumentResult = {
	id: string;
	requestId: string;
	requirementKey: string;
	label: string;
	deliveryMode: string;
	storageKey: string;
	fileName: string;
	mimeType: string;
	fileSizeBytes: number;
	status: string;
	isCurrent: boolean;
	createdAt: Date;
};

/**
 * Validates the MIME type of an uploaded file.
 */
function validateMimeType(mimeType: string): void {
	if (!ALLOWED_MIME_TYPES.has(mimeType)) {
		throwRpcError(
			"UNSUPPORTED_MEDIA_TYPE",
			400,
			`Tipo de archivo no soportado. Tipos permitidos: ${Array.from(
				ALLOWED_MIME_TYPES,
			).join(", ")}`,
		);
	}
}

/**
 * Validates the file size does not exceed the maximum allowed.
 */
function validateFileSize(fileSizeBytes: number): void {
	if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
		throwRpcError(
			"FILE_TOO_LARGE",
			400,
			`El archivo excede el tamaño máximo de ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
		);
	}
}

/**
 * Validates the file extension matches the MIME type.
 */
function validateFileExtension(fileName: string, mimeType: string): void {
	const ext = fileName.toLowerCase();
	const hasValidExtension = Array.from(ALLOWED_EXTENSIONS).some((allowedExt) =>
		ext.endsWith(allowedExt),
	);

	if (!hasValidExtension) {
		throwRpcError(
			"INVALID_FILE_EXTENSION",
			400,
			`Extensión de archivo no válida. Extensiones permitidas: ${Array.from(
				ALLOWED_EXTENSIONS,
			).join(", ")}`,
		);
	}

	// Check consistency between extension and MIME type
	const extToMime: Record<string, string[]> = {
		".pdf": ["application/pdf"],
		".png": ["image/png"],
		".jpg": ["image/jpeg"],
		".jpeg": ["image/jpeg"],
	};

	const expectedMimes =
		extToMime[
			"." +
				fileName
					.toLowerCase()
					.split(".")
					.pop()
		];
	if (expectedMimes && !expectedMimes.includes(mimeType)) {
		throwRpcError(
			"MIME_EXTENSION_MISMATCH",
			400,
			"La extensión del archivo no coincide con el tipo MIME",
		);
	}
}

/**
 * Generates a unique storage key for the file.
 * Format: documents/{requestId}/{timestamp}-{randomSuffix}-{fileName}
 */
function generateStorageKey(
	requestId: string,
	fileName: string,
): string {
	const timestamp = Date.now();
	const randomSuffix = crypto.randomUUID().slice(0, 8);
	const sanitizedFileName = fileName
		.toLowerCase()
		.replace(/[^a-z0-9.-]/g, "_");
	return `documents/${requestId}/${timestamp}-${randomSuffix}-${sanitizedFileName}`;
}

/**
 * Decodes base64 content and validates it.
 */
function decodeContent(content: string): Buffer {
	try {
		return Buffer.from(content, "base64");
	} catch {
		throwRpcError(
			"INVALID_CONTENT_ENCODING",
			400,
			"El contenido debe estar codificado en base64",
		);
	}
}

/**
 * Marks previous documents for the same requirement as not current.
 */
async function markPreviousDocumentsAsNotCurrent(
	requestId: string,
	requirementKey: string,
): Promise<void> {
	await db
		.update(schema.requestDocument)
		.set({
			isCurrent: false,
			updatedAt: new Date(),
		})
		.where(
			eq(schema.requestDocument.requirementKey, requirementKey),
		);
}

/**
 * Uploads a document for a service request.
 * Creates a request_document row with status=pending, isCurrent=true.
 */
export async function uploadCitizenDocument(
	userId: string,
	input: UploadDocumentInput,
): Promise<UploadDocumentResult> {
	// Validate input
	const parsedInput = uploadDocumentSchema.safeParse(input);
	if (!parsedInput.success) {
		const issue = parsedInput.error.issues[0];
		throwRpcError(
			"VALIDATION_ERROR",
			422,
			`${issue.path.join(".")}: ${issue.message}`,
		);
	}

	const {
		requestId,
		requirementKey,
		label,
		deliveryMode,
		fileName,
		mimeType,
		fileSizeBytes,
		content,
	} = parsedInput.data;

	// Validate MIME type
	validateMimeType(mimeType);

	// Validate file size
	validateFileSize(fileSizeBytes);

	// Validate file extension
	validateFileExtension(fileName, mimeType);

	// Verify the service request exists and belongs to the user
	const serviceRequest = await db.query.serviceRequest.findFirst({
		where: eq(schema.serviceRequest.id, requestId),
	});

	if (!serviceRequest) {
		throwRpcError("NOT_FOUND", 404, "Solicitud no encontrada");
	}

	if (serviceRequest.citizenUserId !== userId) {
		throwRpcError(
			"FORBIDDEN",
			403,
			"No tienes permiso para subir documentos a esta solicitud",
		);
	}

	// Decode content
	const fileBuffer = decodeContent(content);

	// Verify decoded size matches declared size (with some tolerance for base64 encoding)
	const decodedSize = fileBuffer.length;
	const expectedSize = Math.ceil(fileSizeBytes * 0.75); // base64 is ~4/3 ratio
	if (Math.abs(decodedSize - expectedSize) > 100) {
		throwRpcError(
			"CONTENT_SIZE_MISMATCH",
			400,
			"El tamaño del contenido decodificado no coincide con el declarado",
		);
	}

	// Generate storage key
	const storageKey = generateStorageKey(requestId, fileName);

	// Mark previous documents for this requirement as not current
	await markPreviousDocumentsAsNotCurrent(requestId, requirementKey);

	// Create the request_document row
	const documentId = crypto.randomUUID();
	const now = new Date();

	const inserted = await db
		.insert(schema.requestDocument)
		.values({
			id: documentId,
			requestId,
			requirementKey,
			label,
			deliveryMode,
			storageKey,
			fileName,
			mimeType,
			fileSizeBytes,
			status: "pending",
			isCurrent: true,
			createdAt: now,
			updatedAt: now,
		})
		.returning();

	if (!inserted || inserted.length === 0) {
		throwRpcError(
			"INTERNAL_ERROR",
			500,
			"No se pudo registrar el documento",
		);
	}

	logger.info(
		{
			documentId,
			requestId,
			userId,
			requirementKey,
			fileName,
			mimeType,
			fileSizeBytes,
			storageKey,
		},
		"Document uploaded successfully",
	);

	return {
		id: inserted[0].id,
		requestId: inserted[0].requestId,
		requirementKey: inserted[0].requirementKey,
		label: inserted[0].label,
		deliveryMode: inserted[0].deliveryMode,
		storageKey: inserted[0].storageKey!,
		fileName: inserted[0].fileName!,
		mimeType: inserted[0].mimeType!,
		fileSizeBytes: inserted[0].fileSizeBytes!,
		status: inserted[0].status,
		isCurrent: inserted[0].isCurrent,
		createdAt: inserted[0].createdAt,
	};
}

/**
 * Lists documents for a service request.
 */
export async function listCitizenDocuments(
	userId: string,
	requestId: string,
) {
	// Verify the service request exists and belongs to the user
	const serviceRequest = await db.query.serviceRequest.findFirst({
		where: eq(schema.serviceRequest.id, requestId),
	});

	if (!serviceRequest) {
		throwRpcError("NOT_FOUND", 404, "Solicitud no encontrada");
	}

	if (serviceRequest.citizenUserId !== userId) {
		throwRpcError(
			"FORBIDDEN",
			403,
			"No tienes permiso para ver documentos de esta solicitud",
		);
	}

	const documents = await db.query.requestDocument.findMany({
		where: eq(schema.requestDocument.requestId, requestId),
		orderBy: (doc, { desc }) => [desc(doc.createdAt)],
	});

	return documents.map((doc) => ({
		id: doc.id,
		requestId: doc.requestId,
		requirementKey: doc.requirementKey,
		label: doc.label,
		deliveryMode: doc.deliveryMode,
		storageKey: doc.storageKey,
		fileName: doc.fileName,
		mimeType: doc.mimeType,
		fileSizeBytes: doc.fileSizeBytes,
		status: doc.status,
		isCurrent: doc.isCurrent,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt,
	}));
}
