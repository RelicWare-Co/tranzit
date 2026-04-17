import { uploadCitizenDocument, listCitizenDocuments, declarePhysicalDocument } from "../../features/citizen/citizen-documents.service";
import { downloadAdminDocument, listAdminDocuments, getAdminDocument } from "../../features/admin/admin-documents.service";
import { rpc } from "../context";
import { requireAuthenticatedSession, requireAdminAccess } from "../shared";

export function createDocumentsRouter() {
	return {
		// Citizen-facing endpoints
		upload: rpc.handler(async ({ context, input }) => {
			const session = await requireAuthenticatedSession(context.headers);
			const payload = input as {
				requestId: string;
				requirementKey: string;
				label: string;
				deliveryMode: "digital" | "physical";
				fileName: string;
				mimeType: string;
				fileSizeBytes: number;
				content: string;
			};
			return uploadCitizenDocument(session.user.id, payload);
		}),
		declarePhysical: rpc.handler(async ({ context, input }) => {
			const session = await requireAuthenticatedSession(context.headers);
			const payload = input as {
				requestId: string;
				requirementKey: string;
				label: string;
			};
			return declarePhysicalDocument(session.user.id, payload);
		}),
		list: rpc.handler(async ({ context, input }) => {
			const session = await requireAuthenticatedSession(context.headers);
			const payload = input as { requestId: string };
			return listCitizenDocuments(session.user.id, payload.requestId);
		}),

		// Admin-facing endpoints
		admin: {
			list: rpc.handler(async ({ context, input }) => {
				await requireAdminAccess(context.headers, {
					booking: ["read"],
				});
				const payload = input as { requestId: string };
				return listAdminDocuments(payload.requestId);
			}),
			get: rpc.handler(async ({ context, input }) => {
				await requireAdminAccess(context.headers, {
					booking: ["read"],
				});
				const payload = input as { documentId: string };
				return getAdminDocument(payload.documentId);
			}),
			download: rpc.handler(async ({ context, input }) => {
				await requireAdminAccess(context.headers, {
					booking: ["read"],
				});
				const payload = input as { documentId: string };
				return downloadAdminDocument(payload.documentId);
			}),
		},
	};
}
