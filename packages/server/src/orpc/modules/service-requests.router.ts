import {
	getServiceRequest,
	listServiceRequests,
	type ServiceRequestStatus,
	updateServiceRequestStatus,
} from "../../features/service-requests/service-requests.service";
import { rpc } from "../context";
import { requireAdminAccess, throwRpcError } from "../shared";

const VALID_STATUSES: string[] = [
	"draft",
	"booking_held",
	"verified",
	"pending_confirmation",
	"confirmed",
	"cancelled",
];

function validateStatus(status: string): ServiceRequestStatus {
	if (!VALID_STATUSES.includes(status)) {
		throwRpcError(
			"INVALID_STATUS",
			422,
			`Status '${status}' no es valido. Valores permitidos: ${VALID_STATUSES.join(", ")}`,
		);
	}
	return status as ServiceRequestStatus;
}

export function createServiceRequestsRouter() {
	return {
		list: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			const payload = (input ?? {}) as {
				status?: string | string[];
				procedureTypeId?: string;
				citizenUserId?: string;
				email?: string;
				limit?: number;
				offset?: number;
				orderBy?: "createdAt" | "updatedAt" | "status";
				orderDir?: "asc" | "desc";
			};

			// Normalize status to array
			let statusArray: string[] | undefined;
			if (typeof payload.status === "string") {
				statusArray = [payload.status];
			} else if (Array.isArray(payload.status)) {
				statusArray = payload.status;
			}

			return listServiceRequests({
				status: statusArray,
				procedureTypeId: payload.procedureTypeId,
				citizenUserId: payload.citizenUserId,
				email: payload.email,
				limit: payload.limit,
				offset: payload.offset,
				orderBy: payload.orderBy,
				orderDir: payload.orderDir,
			});
		}),

		get: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			const payload = input as { id: string };

			if (!payload?.id) {
				throwRpcError("MISSING_REQUIRED_FIELDS", 422, "id is required");
			}

			return getServiceRequest(payload.id);
		}),

		updateStatus: rpc.handler(async ({ context, input }) => {
			const session = await requireAdminAccess(context.headers, {
				booking: ["update"],
			});
			const payload = input as {
				requestId: string;
				status: string;
				reason?: string;
				eligibilityData?: Record<string, unknown>;
			};

			if (!payload?.requestId) {
				throwRpcError("MISSING_REQUIRED_FIELDS", 422, "requestId is required");
			}
			if (!payload?.status) {
				throwRpcError("MISSING_REQUIRED_FIELDS", 422, "status is required");
			}

			const validatedStatus = validateStatus(payload.status);

			return updateServiceRequestStatus({
				requestId: payload.requestId,
				status: validatedStatus,
				actorUserId: session.user.id,
				reason: payload.reason,
				eligibilityData: payload.eligibilityData,
			});
		}),
	};
}
