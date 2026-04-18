import { and, eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import { logger } from "../../lib/logger";
import { throwRpcError } from "../../orpc/shared";

export type UploadDocumentInput = {
	requestId: string;
	requirementKey: string;
	label: string;
	deliveryMode: "digital" | "physical";
	fileName: string;
	mimeType: string;
	fileSizeBytes: number;
	content: string;
};

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
	replacesDocumentId: string | null;
	createdAt: Date;
};

export type DeclarePhysicalResult = {
	id: string;
	requestId: string;
	requirementKey: string;
	label: string;
	deliveryMode: string;
	storageKey: null;
	fileName: null;
	mimeType: null;
	fileSizeBytes: null;
	status: string;
	isCurrent: boolean;
	replacesDocumentId: string | null;
	createdAt: Date;
};

/**
 * Marks previous documents for the same requirement as not current.
 * Returns the ID of the document that was current before marking, or null if none existed.
 * This ID should be used as replacesDocumentId when creating the new document.
 */
async function markPreviousDocumentsAsNotCurrent(
	requestId: string,
	requirementKey: string,
): Promise<string | null> {
	// First, find the current document (if any) before marking as not current
	const currentDoc = await db.query.requestDocument.findFirst({
		where: and(
			eq(schema.requestDocument.requestId, requestId),
			eq(schema.requestDocument.requirementKey, requirementKey),
			eq(schema.requestDocument.isCurrent, true),
		),
		columns: { id: true },
	});

	// Mark all documents for this requirement as not current
	await db
		.update(schema.requestDocument)
		.set({
			isCurrent: false,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(schema.requestDocument.requestId, requestId),
				eq(schema.requestDocument.requirementKey, requirementKey),
			),
		);

	return currentDoc?.id ?? null;
}

/**
 * Digital citizen uploads are disabled by policy.
 */
export async function uploadCitizenDocument(
	_userId: string,
	_input: UploadDocumentInput,
): Promise<UploadDocumentResult> {
	throwRpcError(
		"FORBIDDEN",
		403,
		"La radicacion digital de documentos esta deshabilitada. Descarga las plantillas y llevalas impresas el dia de la cita.",
	);
}

/**
 * Declares a document as physically delivered.
 * Creates a request_document row with deliveryMode=physical, status=marked_as_physical, no storageKey.
 * Handles replacement of existing physical declaration for the same requirement.
 */
export async function declarePhysicalDocument(
	userId: string,
	input: { requestId: string; requirementKey: string; label: string },
): Promise<DeclarePhysicalResult> {
	// Validate input
	if (!input.requestId || typeof input.requestId !== "string") {
		throwRpcError(
			"VALIDATION_ERROR",
			422,
			"requestId: El ID de la solicitud es requerido",
		);
	}
	if (!input.requirementKey || typeof input.requirementKey !== "string") {
		throwRpcError(
			"VALIDATION_ERROR",
			422,
			"requirementKey: El identificador del requisito es requerido",
		);
	}
	if (!input.label || typeof input.label !== "string") {
		throwRpcError(
			"VALIDATION_ERROR",
			422,
			"label: La etiqueta del requisito es requerida",
		);
	}

	const { requestId, requirementKey, label } = input;

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
			"No tienes permiso para declarar documentos en esta solicitud",
		);
	}

	// Mark previous documents for this requirement as not current and capture the replaced document ID
	const replacedDocumentId = await markPreviousDocumentsAsNotCurrent(
		requestId,
		requirementKey,
	);

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
			deliveryMode: "physical",
			status: "marked_as_physical",
			isCurrent: true,
			replacesDocumentId: replacedDocumentId,
			storageKey: null,
			fileName: null,
			mimeType: null,
			fileSizeBytes: null,
			createdAt: now,
			updatedAt: now,
		})
		.returning();

	if (!inserted || inserted.length === 0) {
		throwRpcError(
			"INTERNAL_ERROR",
			500,
			"No se pudo registrar la declaracion fisica del documento",
		);
	}

	logger.info(
		{
			documentId,
			requestId,
			userId,
			requirementKey,
			label,
		},
		"Physical document declared successfully",
	);

	return {
		id: inserted[0].id,
		requestId: inserted[0].requestId,
		requirementKey: inserted[0].requirementKey,
		label: inserted[0].label,
		deliveryMode: inserted[0].deliveryMode,
		storageKey: null,
		fileName: null,
		mimeType: null,
		fileSizeBytes: null,
		status: inserted[0].status,
		isCurrent: inserted[0].isCurrent,
		replacesDocumentId: inserted[0].replacesDocumentId,
		createdAt: inserted[0].createdAt,
	};
}

/**
 * Lists documents for a service request.
 */
export async function listCitizenDocuments(userId: string, requestId: string) {
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
		replacesDocumentId: doc.replacesDocumentId,
		reviewedByUserId: doc.reviewedByUserId,
		reviewedAt: doc.reviewedAt,
		notes: doc.notes,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt,
	}));
}
