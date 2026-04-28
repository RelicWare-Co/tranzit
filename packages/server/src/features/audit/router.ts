import {
	getAuditEvent,
	listAuditEvents,
} from "../../features/audit/audit-query.service";
import { rpc } from "../../shared/orpc/context";
import { requireAdminAccess, throwRpcError } from "../../shared/orpc";

export function createAuditRouter() {
	return {
		list: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				audit: ["read"],
			});

			const payload = (input ?? {}) as {
				entityType?: string;
				entityId?: string;
				actorUserId?: string;
				action?: string;
				dateFrom?: string;
				dateTo?: string;
				limit?: number;
				offset?: number;
				orderBy?: "createdAt" | "action" | "entityType";
				orderDir?: "asc" | "desc";
			};

			return listAuditEvents(payload);
		}),

		get: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				audit: ["read"],
			});

			const payload = input as { id: string };

			if (!payload?.id) {
				throwRpcError("MISSING_REQUIRED_FIELDS", 422, "id is required");
			}

			return getAuditEvent(payload.id);
		}),
	};
}
