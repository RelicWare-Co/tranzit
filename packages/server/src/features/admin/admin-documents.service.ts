import { eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import { readFile } from "../../lib/file-storage";
import { throwRpcError } from "../../orpc/shared";

export type DocumentFileInfo = {
	id: string;
	requestId: string;
	requirementKey: string;
	label: string;
	deliveryMode: string;
	storageKey: string | null;
	fileName: string | null;
	mimeType: string | null;
	fileSizeBytes: number | null;
	status: string;
	isCurrent: boolean;
	replacesDocumentId: string | null;
	reviewedByUserId: string | null;
	reviewedAt: Date | null;
	notes: string | null;
	createdAt: Date;
	updatedAt: Date;
};

/**
 * Lists all documents for a service request (admin view with review fields).
 */
export async function listAdminDocuments(requestId: string): Promise<DocumentFileInfo[]> {
	// Verify the service request exists
	const serviceRequest = await db.query.serviceRequest.findFirst({
		where: eq(schema.serviceRequest.id, requestId),
	});

	if (!serviceRequest) {
		throwRpcError("NOT_FOUND", 404, "Solicitud no encontrada");
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
		replacesDocumentId: doc.replacesDocumentId,
		reviewedByUserId: doc.reviewedByUserId,
		reviewedAt: doc.reviewedAt,
		notes: doc.notes,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt,
	}));
}

/**
 * Gets a document by ID with full metadata (admin view).
 */
export async function getAdminDocument(documentId: string): Promise<DocumentFileInfo> {
	const document = await db.query.requestDocument.findFirst({
		where: eq(schema.requestDocument.id, documentId),
	});

	if (!document) {
		throwRpcError("NOT_FOUND", 404, "Documento no encontrado");
	}

	return {
		id: document.id,
		requestId: document.requestId,
		requirementKey: document.requirementKey,
		label: document.label,
		deliveryMode: document.deliveryMode,
		storageKey: document.storageKey,
		fileName: document.fileName,
		mimeType: document.mimeType,
		fileSizeBytes: document.fileSizeBytes,
		status: document.status,
		isCurrent: document.isCurrent,
		replacesDocumentId: document.replacesDocumentId,
		reviewedByUserId: document.reviewedByUserId,
		reviewedAt: document.reviewedAt,
		notes: document.notes,
		createdAt: document.createdAt,
		updatedAt: document.updatedAt,
	};
}

/**
 * Downloads a document file for admin preview.
 * Returns the file content as a Buffer along with metadata for setting response headers.
 */
export async function downloadAdminDocument(documentId: string): Promise<{
	content: Buffer;
	fileName: string;
	mimeType: string;
	fileSizeBytes: number;
}> {
	const document = await db.query.requestDocument.findFirst({
		where: eq(schema.requestDocument.id, documentId),
	});

	if (!document) {
		throwRpcError("NOT_FOUND", 404, "Documento no encontrado");
	}

	if (!document.storageKey) {
		throwRpcError(
			"NO_FILE_STORED",
			400,
			"Este documento no tiene archivo almacenado (posiblemente entrega fisica)",
		);
	}

	if (!document.fileName || !document.mimeType) {
		throwRpcError("INTERNAL_ERROR", 500, "Metadatos del archivo incompletos");
	}

	// Read file from disk
	const content = readFile(document.storageKey);

	return {
		content,
		fileName: document.fileName,
		mimeType: document.mimeType,
		fileSizeBytes: document.fileSizeBytes || content.length,
	};
}
