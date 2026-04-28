import { ORPCError } from "@orpc/server";
import type { CapacityConflict } from "../../features/bookings/capacity.types";
import { hashPayload, storeIdempotencyKey } from "./idempotency";

export function throwRpcError(
	code: string,
	status: number,
	message: string,
	data?: unknown,
): never {
	throw new ORPCError(code, {
		status,
		message,
		data,
	});
}

export function throwCapacityConflict(
	conflicts: CapacityConflict[],
	message = "Insufficient capacity for this operation",
): never {
	throwRpcError("CAPACITY_CONFLICT", 409, message, { conflicts });
}

export function fallbackErrorCode(status: number) {
	if (status === 400) return "BAD_REQUEST";
	if (status === 401) return "UNAUTHENTICATED";
	if (status === 403) return "FORBIDDEN";
	if (status === 404) return "NOT_FOUND";
	if (status === 409) return "CONFLICT";
	if (status === 412) return "PRECONDITION_FAILED";
	if (status === 422) return "UNPROCESSABLE_CONTENT";
	if (status === 429) return "TOO_MANY_REQUESTS";
	if (status >= 500) return "INTERNAL_SERVER_ERROR";
	return "UNKNOWN_ERROR";
}

export function resolveCachedIdempotencyResponse(
	response: { status: number; body: unknown } | undefined,
) {
	if (!response) return null;

	if (response.status >= 400) {
		const body = response.body;
		const bodyObj =
			body && typeof body === "object"
				? (body as Record<string, unknown>)
				: undefined;
		const code =
			bodyObj && typeof bodyObj.code === "string"
				? bodyObj.code
				: fallbackErrorCode(response.status);
		const message =
			bodyObj && typeof bodyObj.message === "string"
				? bodyObj.message
				: "Request failed";
		throwRpcError(code, response.status, message, bodyObj);
	}

	return response.body;
}

export async function throwIdempotencyAwareError(params: {
	key: string | null;
	operation: string;
	targetId: string | null;
	payload: unknown;
	code: string;
	status: number;
	message: string;
	data?: unknown;
}) {
	if (params.key) {
		await storeIdempotencyKey(
			params.key,
			params.operation,
			params.targetId,
			hashPayload(params.payload),
			params.status,
			{
				code: params.code,
				message: params.message,
				...(params.data as object),
			},
		);
	}
	throwRpcError(params.code, params.status, params.message, params.data);
}
