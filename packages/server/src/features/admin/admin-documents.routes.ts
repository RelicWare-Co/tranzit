import { Hono } from "hono";
import { requireRole } from "../../middlewares/authorization";
import { sessionMiddleware } from "../../middlewares/session";
import { downloadAdminDocument } from "./admin-documents.service";

export const adminDocumentsApp = new Hono();

// Apply session middleware and require admin/staff/auditor role
adminDocumentsApp.use("/*", sessionMiddleware);
adminDocumentsApp.use("/*", requireRole("admin", "staff", "auditor"));

/**
 * GET /api/admin/documents/:documentId/download
 * Downloads a document file with proper Content-Type headers.
 */
adminDocumentsApp.get("/documents/:documentId/download", async (c) => {
	const documentId = c.req.param("documentId");

	try {
		const { content, fileName, mimeType, fileSizeBytes } =
			await downloadAdminDocument(documentId);

		// Set response headers
		c.header("Content-Type", mimeType);
		c.header("Content-Length", String(content.length));
		c.header(
			"Content-Disposition",
			`inline; filename="${fileName.replace(/"/g, '\\"')}"`,
		);
		// Cache control - documents may be reviewed multiple times
		c.header("Cache-Control", "private, max-age=300");

		// Convert Buffer to Uint8Array for Hono compatibility
		return c.body(new Uint8Array(content));
	} catch (error) {
		if (error instanceof Error) {
			// Handle known error cases from the service
			if (error.message.includes("no encontrado")) {
				return c.json(
					{
						code: "NOT_FOUND",
						message: "Documento no encontrado",
					},
					404,
				);
			}
			if (error.message.includes("no tiene archivo almacenado")) {
				return c.json(
					{
						code: "NO_FILE_STORED",
						message: "Este documento no tiene archivo almacenado",
					},
					400,
				);
			}
		}

		// Re-throw for global error handler
		throw error;
	}
});
