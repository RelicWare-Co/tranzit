import { uploadCitizenDocument, listCitizenDocuments } from "../../features/citizen/citizen-documents.service";
import { rpc } from "../context";
import { requireAuthenticatedSession } from "../shared";

export function createDocumentsRouter() {
	return {
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
		list: rpc.handler(async ({ context, input }) => {
			const session = await requireAuthenticatedSession(context.headers);
			const payload = input as { requestId: string };
			return listCitizenDocuments(session.user.id, payload.requestId);
		}),
	};
}
