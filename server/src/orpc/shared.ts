import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { auth } from "../features/auth/auth.config";
import type { CapacityConflict } from "../features/bookings/capacity.service";
import { db, schema } from "../lib/db";

export type PermissionMap = Record<string, string[]>;

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

export async function requireAdminAccess(
	headers: Headers,
	permissions?: PermissionMap,
) {
	const session = await auth.api.getSession({ headers });

	if (!session) {
		throwRpcError("UNAUTHENTICATED", 401, "Debes iniciar sesion");
	}

	const userRoles = (session.user.role ?? "")
		.split(",")
		.map((role) => role.trim())
		.filter(Boolean);
	const hasAdminAccess = userRoles.some((role) =>
		["admin", "staff", "auditor"].includes(role),
	);

	if (!hasAdminAccess) {
		throwRpcError(
			"FORBIDDEN",
			403,
			"One of the following roles is required: admin, staff, auditor",
		);
	}

	if (permissions) {
		const permissionResult = await auth.api.userHasPermission({
			body: {
				userId: session.user.id,
				permissions,
			},
		});

		if (!permissionResult.success) {
			throwRpcError(
				"FORBIDDEN",
				403,
				"Insufficient permissions for this operation",
			);
		}
	}

	return session;
}

const IDEMPOTENCY_KEY_TTL_MS = 24 * 60 * 60 * 1000;

export interface RecurrenceRule {
	frequency: "daily" | "weekly" | "biweekly" | "monthly";
	interval?: number;
	byDayOfWeek?: number[];
	untilDate?: string;
	count?: number;
	timezone?: string;
}

export type IdempotencyCheckResult =
	| {
			exists: true;
			response?: { status: number; body: unknown };
			conflict?: boolean;
	  }
	| { exists: false };

export function parseBooleanLike(value: unknown): boolean | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "boolean") return value;
	if (value === "true") return true;
	if (value === "false") return false;
	return undefined;
}

export function hashPayload(payload: unknown): string {
	const value =
		payload && typeof payload === "object" ? payload : { value: payload };
	const normalized = JSON.stringify(
		value,
		Object.keys(value as Record<string, unknown>).sort(),
	);
	return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

export function parseIdempotencyKey(
	header: string | null | undefined,
): string | null {
	if (!header) return null;
	if (header.length < 8 || header.length > 128) return null;
	if (!/^[a-zA-Z0-9-]+$/.test(header)) return null;
	return header;
}

export async function checkIdempotencyKey(
	key: string,
	operation: string,
	targetId: string | null,
	payloadHash: string,
): Promise<IdempotencyCheckResult> {
	const now = new Date();
	const existing = await db.query.idempotencyKey.findFirst({
		where: eq(schema.idempotencyKey.key, key),
	});

	if (!existing) {
		return { exists: false };
	}

	if (existing.expiresAt && existing.expiresAt < now) {
		await db
			.delete(schema.idempotencyKey)
			.where(eq(schema.idempotencyKey.id, existing.id));
		return { exists: false };
	}

	if (existing.operation !== operation || existing.targetId !== targetId) {
		return { exists: true, conflict: true };
	}

	if (existing.payloadHash !== payloadHash) {
		return { exists: true, conflict: true };
	}

	return {
		exists: true,
		response: {
			status: existing.responseStatus,
			body: existing.responseBody,
		},
	};
}

export async function storeIdempotencyKey(
	key: string,
	operation: string,
	targetId: string | null,
	payloadHash: string,
	responseStatus: number,
	responseBody: unknown,
): Promise<void> {
	const now = new Date();
	const expiresAt = new Date(now.getTime() + IDEMPOTENCY_KEY_TTL_MS);

	await db
		.delete(schema.idempotencyKey)
		.where(eq(schema.idempotencyKey.key, key));

	await db.insert(schema.idempotencyKey).values({
		id: crypto.randomUUID(),
		key,
		operation,
		targetId,
		payloadHash,
		responseStatus,
		responseBody: (responseBody ?? {}) as Record<string, unknown>,
		createdAt: now,
		expiresAt,
	});
}

export function parseRRule(rruleStr: string): RecurrenceRule {
	const rule: RecurrenceRule = { frequency: "daily" };
	const parts = rruleStr.split(";");

	for (const part of parts) {
		const [key, value] = part.split("=");
		switch (key) {
			case "FREQ":
			case "FREQUENCY":
				if (value === "DAILY") rule.frequency = "daily";
				else if (value === "WEEKLY") rule.frequency = "weekly";
				else if (value === "BIWEEKLY") rule.frequency = "biweekly";
				else if (value === "MONTHLY") rule.frequency = "monthly";
				break;
			case "INTERVAL":
				rule.interval = parseInt(value, 10);
				break;
			case "BYDAY":
				rule.byDayOfWeek = value.split(",").map((day) => {
					const dayMap: Record<string, number> = {
						SU: 0,
						MO: 1,
						TU: 2,
						WE: 3,
						TH: 4,
						FR: 5,
						SA: 6,
					};
					return dayMap[day] ?? 0;
				});
				break;
			case "UNTIL":
				if (value.length >= 8) {
					rule.untilDate = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
				}
				break;
			case "COUNT":
				rule.count = parseInt(value, 10);
				break;
		}
	}

	return rule;
}

export function generateOccurrences(
	rule: RecurrenceRule,
	startDate: string,
	endDate: string,
	existingOccurrenceKeys: Set<string>,
	slotStartTime: string,
): string[] {
	const dates: string[] = [];
	const start = new Date(`${startDate}T00:00:00`);
	const untilDate =
		rule.untilDate && rule.untilDate < endDate ? rule.untilDate : endDate;
	const end = new Date(`${untilDate}T23:59:59`);

	let count = 0;
	const maxCount = rule.count || 365;
	const interval = rule.interval && rule.interval > 0 ? rule.interval : 1;

	const formatDate = (date: Date) => {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	};

	if (
		rule.frequency === "weekly" &&
		rule.byDayOfWeek &&
		rule.byDayOfWeek.length > 0
	) {
		const byDays = new Set(rule.byDayOfWeek);
		const current = new Date(start);
		while (current <= end && count < maxCount) {
			const daysSinceStart = Math.floor(
				(current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
			);
			const weekIndex = Math.floor(daysSinceStart / 7);
			const onIntervalWeek = weekIndex % interval === 0;
			const dateStr = formatDate(current);
			const key = `${dateStr}|${slotStartTime}`;

			if (
				onIntervalWeek &&
				byDays.has(current.getDay()) &&
				!existingOccurrenceKeys.has(key)
			) {
				dates.push(dateStr);
				count += 1;
			}

			current.setDate(current.getDate() + 1);
		}

		return dates;
	}

	const current = new Date(start);
	while (current <= end && count < maxCount) {
		const dateStr = formatDate(current);
		const key = `${dateStr}|${slotStartTime}`;

		if (!existingOccurrenceKeys.has(key)) {
			dates.push(dateStr);
			count += 1;
		}

		switch (rule.frequency) {
			case "daily":
				current.setDate(current.getDate() + interval);
				break;
			case "weekly":
				current.setDate(current.getDate() + interval * 7);
				break;
			case "biweekly":
				current.setDate(current.getDate() + 14);
				break;
			case "monthly":
				current.setMonth(current.getMonth() + interval);
				break;
		}
	}

	return dates;
}

export function isDateOnOrAfter(
	dateStr: string,
	effectiveFrom: string,
	_timezone: string,
): boolean {
	return dateStr >= effectiveFrom;
}

export function assertAdminBookingKind(
	booking: typeof schema.booking.$inferSelect,
) {
	if (booking.kind !== "administrative") {
		throwRpcError(
			"BOOKING_KIND_NOT_ADMIN",
			409,
			"Only administrative reservations can be mutated via this endpoint",
		);
	}
}

export function assertMutableState(
	booking: typeof schema.booking.$inferSelect,
) {
	if (!booking.isActive) {
		throwRpcError(
			"BOOKING_NOT_MUTABLE",
			409,
			`Cannot mutate inactive reservation (status: ${booking.status})`,
		);
	}

	const nonMutableStatuses = ["cancelled", "released", "attended"];
	if (nonMutableStatuses.includes(booking.status)) {
		throwRpcError(
			"BOOKING_NOT_MUTABLE",
			409,
			`Cannot mutate reservation in status: ${booking.status}`,
		);
	}
}

export function parseIfMatch(header: string | null | undefined): string | null {
	if (!header) return null;
	return header.replace(/^"/, "").replace(/"$/, "");
}

export function assertOptimisticConcurrency(
	currentUpdatedAt: Date,
	expectedVersion: string | null,
) {
	if (!expectedVersion) return;

	const expected = new Date(expectedVersion).getTime();
	const current = currentUpdatedAt.getTime();

	if (Number.isNaN(expected)) return;
	if (current > expected) {
		throwRpcError(
			"PRECONDITION_FAILED",
			412,
			"Resource has been modified since requested version",
		);
	}
}

export function throwCapacityConflict(
	conflicts: CapacityConflict[],
	message = "Insufficient capacity for this operation",
): never {
	throwRpcError("CAPACITY_CONFLICT", 409, message, { conflicts });
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
