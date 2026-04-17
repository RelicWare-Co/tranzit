import { eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import { readFile } from "../../lib/file-storage";
import { logger } from "../../lib/logger";
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

/**
 * Document review action types.
 */
export type DocumentReviewAction = "approve" | "reject" | "start_review";

/**
 * Input for document review operation.
 */
export type ReviewDocumentInput = {
	documentId: string;
	action: DocumentReviewAction;
	notes?: string;
	reviewerUserId: string;
};

/**
 * Result of document review operation.
 */
export type ReviewDocumentResult = {
	id: string;
	requestId: string;
	requirementKey: string;
	label: string;
	deliveryMode: string;
	status: string;
	notes: string | null;
	reviewedByUserId: string | null;
	reviewedAt: Date | null;
	isCurrent: boolean;
	updatedAt: Date;
};

/**
 * Valid status transitions for document review.
 */
const VALID_TRANSITIONS: Record<DocumentReviewAction, string[]> = {
	approve: ["pending", "in_review", "rejected"],
	reject: ["pending", "in_review"],
	start_review: ["pending"],
};

/**
 * Reviews a document (approve, reject, or start_review).
 * Validates status transitions, requires notes for rejection,
 * and prevents direct validation of physical-marked documents.
 */
export async function reviewDocument(
	input: ReviewDocumentInput,
): Promise<ReviewDocumentResult> {
	const { documentId, action, notes, reviewerUserId } = input;

	// Get the document
	const document = await db.query.requestDocument.findFirst({
		where: eq(schema.requestDocument.id, documentId),
	});

	if (!document) {
		throwRpcError("NOT_FOUND", 404, "Documento no encontrado");
	}

	// Validate action is known
	if (!VALID_TRANSITIONS[action]) {
		throwRpcError(
			"INVALID_ACTION",
			400,
			`Accion '${action}' no es valida. Acciones permitidas: approve, reject, start_review`,
		);
	}

	// Validate status transition
	const allowedFromStatuses = VALID_TRANSITIONS[action];
	if (!allowedFromStatuses.includes(document.status)) {
		throwRpcError(
			"INVALID_TRANSITION",
			400,
			`No se puede ejecutar '${action}' sobre un documento con estado '${document.status}'. Estados permitidos: ${allowedFromStatuses.join(", ")}`,
		);
	}

	// Reject requires non-empty notes
	if (action === "reject" && (!notes || notes.trim() === "")) {
		throwRpcError(
			"MISSING_REQUIRED_NOTES",
			400,
			"El rechazo de un documento requiere una justificacion no vacia",
		);
	}

	// Physical-marked documents cannot be directly approved without a file
	// If document is marked_as_physical, it needs to be received first
	if (
		action === "approve" &&
		document.deliveryMode === "physical" &&
		document.status === "marked_as_physical"
	) {
		throwRpcError(
			"INVALID_TRANSITION",
			400,
			"No se puede aprobar directamente un documento marcado como entrega fisica sin haberlo recibido. Primero debe cambiar su estado a pendiente o en revision",
		);
	}

	// Determine new status
	let newStatus: string;
	switch (action) {
		case "approve":
			newStatus = "valid";
			break;
		case "reject":
			newStatus = "rejected";
			break;
		case "start_review":
			newStatus = "in_review";
			break;
	}

	// Update the document
	const now = new Date();
	const updated = await db
		.update(schema.requestDocument)
		.set({
			status: newStatus,
			notes: notes !== undefined ? notes : document.notes,
			reviewedByUserId: reviewerUserId,
			reviewedAt: now,
			updatedAt: now,
		})
		.where(eq(schema.requestDocument.id, documentId))
		.returning();

	if (!updated || updated.length === 0) {
		throwRpcError(
			"INTERNAL_ERROR",
			500,
			"No se pudo actualizar el estado del documento",
		);
	}

	// Create audit event
	const auditEventId = crypto.randomUUID();
	await db.insert(schema.auditEvent).values({
		id: auditEventId,
		actorType: "admin",
		actorUserId: reviewerUserId,
		entityType: "request_document",
		entityId: documentId,
		action: `document_${action}`,
		summary: `Documento ${action === "approve" ? "aprobado" : action === "reject" ? "rechazado" : "marcado para revision"}`,
		payload: {
			previousStatus: document.status,
			newStatus,
			action,
			notes: notes || null,
			deliveryMode: document.deliveryMode,
			requirementKey: document.requirementKey,
			requestId: document.requestId,
		},
	});

	logger.info(
		{
			documentId,
			action,
			previousStatus: document.status,
			newStatus,
			reviewerUserId,
			notes,
		},
		"Document review completed",
	);

	return {
		id: updated[0].id,
		requestId: updated[0].requestId,
		requirementKey: updated[0].requirementKey,
		label: updated[0].label,
		deliveryMode: updated[0].deliveryMode,
		status: updated[0].status,
		notes: updated[0].notes,
		reviewedByUserId: updated[0].reviewedByUserId,
		reviewedAt: updated[0].reviewedAt,
		isCurrent: updated[0].isCurrent,
		updatedAt: updated[0].updatedAt,
	};
}
