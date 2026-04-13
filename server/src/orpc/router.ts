import { createHash } from "node:crypto";
import { ORPCError, os } from "@orpc/server";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { auth } from "../features/auth/auth.config";
import {
	type CapacityConflict,
	checkCapacity,
	confirmBooking,
	consumeCapacity,
	countActiveSlotBookings,
	countActiveStaffBookingsOnDate,
	executeBulkReassignments,
	previewReassignment,
	previewReassignments,
	reassignBooking,
	releaseCapacity,
	resolveStaffAvailabilityAndCapacity,
} from "../features/bookings/capacity.service";
import {
	isValidDateFormat as isValidScheduleDateFormat,
	isValidTimeFormat as isValidScheduleTimeFormat,
	isValidTimeWindow as isValidScheduleTimeWindow,
	isValidWeekday,
	parseNonNegativeInteger,
	parsePositiveInteger,
	WEEKDAY_MAX,
	WEEKDAY_MIN,
} from "../features/schedule/schedule.schemas";
import {
	formatDateLocal,
	generateSlotsForWindow,
	getEffectiveSchedule,
} from "../features/schedule/schedule.service";
import {
	isValidDateFormat as isValidStaffDateFormat,
	isValidTimeFormat as isValidStaffTimeFormat,
	isValidTimeWindow as isValidStaffTimeWindow,
	validateWeeklyAvailability,
} from "../features/staff/staff.schemas";
import { db, schema } from "../lib/db";

const { user } = schema;

type RpcContext = {
	headers: Headers;
};

const rpc = os.$context<RpcContext>();

type PermissionMap = Record<string, string[]>;

function throwRpcError(
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

async function requireAdminAccess(
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

interface RecurrenceRule {
	frequency: "daily" | "weekly" | "biweekly" | "monthly";
	interval?: number;
	byDayOfWeek?: number[];
	untilDate?: string;
	count?: number;
	timezone?: string;
}

type IdempotencyCheckResult =
	| {
			exists: true;
			response?: { status: number; body: unknown };
			conflict?: boolean;
	  }
	| { exists: false };

function parseBooleanLike(value: unknown): boolean | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "boolean") return value;
	if (value === "true") return true;
	if (value === "false") return false;
	return undefined;
}

function hashPayload(payload: unknown): string {
	const value =
		payload && typeof payload === "object" ? payload : { value: payload };
	const normalized = JSON.stringify(
		value,
		Object.keys(value as Record<string, unknown>).sort(),
	);
	return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

function parseIdempotencyKey(header: string | null | undefined): string | null {
	if (!header) return null;
	if (header.length < 8 || header.length > 128) return null;
	if (!/^[a-zA-Z0-9-]+$/.test(header)) return null;
	return header;
}

async function checkIdempotencyKey(
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

async function storeIdempotencyKey(
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

function parseRRule(rruleStr: string): RecurrenceRule {
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

function generateOccurrences(
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

function isDateOnOrAfter(
	dateStr: string,
	effectiveFrom: string,
	_timezone: string,
): boolean {
	return dateStr >= effectiveFrom;
}

function assertAdminBookingKind(booking: typeof schema.booking.$inferSelect) {
	if (booking.kind !== "administrative") {
		throwRpcError(
			"BOOKING_KIND_NOT_ADMIN",
			409,
			"Only administrative reservations can be mutated via this endpoint",
		);
	}
}

function assertMutableState(booking: typeof schema.booking.$inferSelect) {
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

function parseIfMatch(header: string | null | undefined): string | null {
	if (!header) return null;
	return header.replace(/^"/, "").replace(/"$/, "");
}

function assertOptimisticConcurrency(
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

function throwCapacityConflict(
	conflicts: CapacityConflict[],
	message = "Insufficient capacity for this operation",
): never {
	throwRpcError("CAPACITY_CONFLICT", 409, message, { conflicts });
}

function resolveCachedIdempotencyResponse(
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

async function throwIdempotencyAwareError(params: {
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

function fallbackErrorCode(status: number) {
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

export function createTranzitRpcRouter() {
	return {
		session: {
			get: rpc.handler(async ({ context }) => {
				const session = await auth.api.getSession({ headers: context.headers });

				if (!session) {
					throw new ORPCError("UNAUTHENTICATED", {
						status: 401,
						message: "Debes iniciar sesion",
					});
				}

				return session;
			}),
		},
		admin: {
			onboarding: {
				status: rpc.handler(async () => {
					const existingAdmins = await db
						.select({ id: user.id })
						.from(user)
						.where(sql`${user.role} LIKE '%admin%'`);

					return { adminExists: existingAdmins.length > 0 };
				}),
				bootstrap: rpc.handler(async ({ context }) => {
					const session = await auth.api.getSession({
						headers: context.headers,
					});

					if (!session) {
						throw new ORPCError("UNAUTHENTICATED", {
							status: 401,
							message: "Debes iniciar sesion",
						});
					}

					const existingAdmins = await db
						.select({ id: user.id })
						.from(user)
						.where(sql`${user.role} LIKE '%admin%'`);

					if (existingAdmins.length > 0) {
						throw new ORPCError("ADMIN_ALREADY_EXISTS", {
							status: 403,
							message: "El onboarding de admin ya fue completado",
						});
					}

					await db
						.update(user)
						.set({ role: "admin" })
						.where(sql`${user.id} = ${session.user.id}`);

					return { success: true, role: "admin" };
				}),
			},
			schedule: {
				templates: {
					list: rpc.handler(async ({ context }) => {
						await requireAdminAccess(context.headers, {
							schedule: ["read"],
						});

						return await db.query.scheduleTemplate.findMany({
							orderBy: (template, { asc }) => [asc(template.weekday)],
						});
					}),
					create: rpc.handler(async ({ context, input }) => {
						await requireAdminAccess(context.headers, {
							schedule: ["read"],
						});
						const body = (input ?? {}) as {
							weekday?: number;
							slotDurationMinutes?: number;
							bufferMinutes?: number;
							slotCapacityLimit?: number | null;
							isEnabled?: boolean;
							morningStart?: string | null;
							morningEnd?: string | null;
							afternoonStart?: string | null;
							afternoonEnd?: string | null;
							notes?: string | null;
						};

						if (
							body.weekday === undefined ||
							body.slotDurationMinutes === undefined
						) {
							throwRpcError(
								"MISSING_REQUIRED_FIELDS",
								422,
								"weekday and slotDurationMinutes are required",
							);
						}

						const weekday = Number(body.weekday);
						const slotDurationMinutes = parsePositiveInteger(
							body.slotDurationMinutes,
						);

						if (!isValidWeekday(weekday)) {
							throwRpcError(
								"INVALID_WEEKDAY",
								422,
								`weekday must be an integer between ${WEEKDAY_MIN} and ${WEEKDAY_MAX}`,
							);
						}

						if (slotDurationMinutes === null) {
							throwRpcError(
								"INVALID_SLOT_DURATION",
								422,
								"slotDurationMinutes must be a positive integer",
							);
						}

						if (body.bufferMinutes !== undefined) {
							const bufferMinutes = parseNonNegativeInteger(body.bufferMinutes);
							if (bufferMinutes === null) {
								throwRpcError(
									"INVALID_BUFFER_MINUTES",
									422,
									"bufferMinutes must be a non-negative integer",
								);
							}
						}

						if (
							body.slotCapacityLimit !== undefined &&
							body.slotCapacityLimit !== null
						) {
							const slotCapacityLimit = parsePositiveInteger(
								body.slotCapacityLimit,
							);
							if (slotCapacityLimit === null) {
								throwRpcError(
									"INVALID_SLOT_CAPACITY",
									422,
									"slotCapacityLimit must be a positive integer or null",
								);
							}
						}

						const { morningStart, morningEnd, afternoonStart, afternoonEnd } =
							body;
						if (
							!isValidScheduleTimeFormat(morningStart) ||
							!isValidScheduleTimeFormat(morningEnd) ||
							!isValidScheduleTimeFormat(afternoonStart) ||
							!isValidScheduleTimeFormat(afternoonEnd)
						) {
							throwRpcError(
								"INVALID_TIME_FORMAT",
								422,
								"Invalid time format (HH:MM)",
							);
						}

						if (
							!isValidScheduleTimeWindow(morningStart, morningEnd) ||
							!isValidScheduleTimeWindow(afternoonStart, afternoonEnd) ||
							!isValidScheduleTimeWindow(morningEnd, afternoonStart)
						) {
							throwRpcError(
								"INVALID_TIME_WINDOW",
								422,
								"morningEnd must be before afternoonStart, and each window must have start < end",
							);
						}

						const existing = await db.query.scheduleTemplate.findFirst({
							where: eq(schema.scheduleTemplate.weekday, weekday),
						});
						if (existing) {
							throwRpcError(
								"DUPLICATE_WEEKDAY",
								409,
								`A schedule template for weekday ${weekday} already exists`,
							);
						}

						const id = crypto.randomUUID();
						const now = new Date();

						await db.insert(schema.scheduleTemplate).values({
							id,
							weekday,
							isEnabled: body.isEnabled ?? true,
							morningStart: morningStart ?? null,
							morningEnd: morningEnd ?? null,
							afternoonStart: afternoonStart ?? null,
							afternoonEnd: afternoonEnd ?? null,
							slotDurationMinutes,
							bufferMinutes: body.bufferMinutes ?? 0,
							slotCapacityLimit: body.slotCapacityLimit ?? null,
							notes: body.notes ?? null,
							createdAt: now,
							updatedAt: now,
						});

						return await db.query.scheduleTemplate.findFirst({
							where: eq(schema.scheduleTemplate.id, id),
						});
					}),
					get: rpc.handler(async ({ context, input }) => {
						await requireAdminAccess(context.headers, {
							schedule: ["read"],
						});
						const payload = input as { id: string };

						const template = await db.query.scheduleTemplate.findFirst({
							where: eq(schema.scheduleTemplate.id, payload.id),
						});

						if (!template) {
							throwRpcError("NOT_FOUND", 404, "Schedule template not found");
						}

						return template;
					}),
					update: rpc.handler(async ({ context, input }) => {
						await requireAdminAccess(context.headers, {
							schedule: ["read"],
						});
						const payload = input as {
							id: string;
							weekday?: number;
							slotDurationMinutes?: number;
							bufferMinutes?: number;
							slotCapacityLimit?: number | null;
							morningStart?: string | null;
							morningEnd?: string | null;
							afternoonStart?: string | null;
							afternoonEnd?: string | null;
							notes?: string | null;
							isEnabled?: boolean;
						};

						const existing = await db.query.scheduleTemplate.findFirst({
							where: eq(schema.scheduleTemplate.id, payload.id),
						});
						if (!existing) {
							throwRpcError("NOT_FOUND", 404, "Schedule template not found");
						}

						const updates: Partial<
							typeof schema.scheduleTemplate.$inferInsert
						> = {
							updatedAt: new Date(),
						};

						if (payload.weekday !== undefined) {
							const weekday = Number(payload.weekday);
							if (!isValidWeekday(weekday)) {
								throwRpcError(
									"INVALID_WEEKDAY",
									422,
									`weekday must be an integer between ${WEEKDAY_MIN} and ${WEEKDAY_MAX}`,
								);
							}

							const othersWithWeekday =
								await db.query.scheduleTemplate.findFirst({
									where: and(
										eq(schema.scheduleTemplate.weekday, weekday),
										sql`${schema.scheduleTemplate.id} <> ${payload.id}`,
									),
								});
							if (othersWithWeekday) {
								throwRpcError(
									"DUPLICATE_WEEKDAY",
									409,
									`A schedule template for weekday ${weekday} already exists`,
								);
							}

							updates.weekday = weekday;
						}

						if (payload.slotDurationMinutes !== undefined) {
							const slotDurationMinutes = parsePositiveInteger(
								payload.slotDurationMinutes,
							);
							if (slotDurationMinutes === null) {
								throwRpcError(
									"INVALID_SLOT_DURATION",
									422,
									"slotDurationMinutes must be a positive integer",
								);
							}
							updates.slotDurationMinutes = slotDurationMinutes;
						}

						if (payload.bufferMinutes !== undefined) {
							const bufferMinutes = parseNonNegativeInteger(
								payload.bufferMinutes,
							);
							if (bufferMinutes === null) {
								throwRpcError(
									"INVALID_BUFFER_MINUTES",
									422,
									"bufferMinutes must be a non-negative integer",
								);
							}
							updates.bufferMinutes = bufferMinutes;
						}

						if (payload.slotCapacityLimit !== undefined) {
							if (payload.slotCapacityLimit === null) {
								updates.slotCapacityLimit = null;
							} else {
								const slotCapacityLimit = parsePositiveInteger(
									payload.slotCapacityLimit,
								);
								if (slotCapacityLimit === null) {
									throwRpcError(
										"INVALID_SLOT_CAPACITY",
										422,
										"slotCapacityLimit must be a positive integer or null",
									);
								}
								updates.slotCapacityLimit = slotCapacityLimit;
							}
						}

						const morningStart = payload.morningStart ?? existing.morningStart;
						const morningEnd = payload.morningEnd ?? existing.morningEnd;
						const afternoonStart =
							payload.afternoonStart ?? existing.afternoonStart;
						const afternoonEnd = payload.afternoonEnd ?? existing.afternoonEnd;

						if (
							!isValidScheduleTimeFormat(payload.morningStart ?? null) ||
							!isValidScheduleTimeFormat(payload.morningEnd ?? null) ||
							!isValidScheduleTimeFormat(payload.afternoonStart ?? null) ||
							!isValidScheduleTimeFormat(payload.afternoonEnd ?? null)
						) {
							throwRpcError(
								"INVALID_TIME_FORMAT",
								422,
								"Invalid time format (HH:MM)",
							);
						}

						if (
							payload.morningStart !== undefined ||
							payload.morningEnd !== undefined
						) {
							if (!isValidScheduleTimeWindow(morningStart, morningEnd)) {
								throwRpcError(
									"INVALID_TIME_WINDOW",
									422,
									"morningEnd must be after morningStart",
								);
							}
						}
						if (
							payload.afternoonStart !== undefined ||
							payload.afternoonEnd !== undefined
						) {
							if (!isValidScheduleTimeWindow(afternoonStart, afternoonEnd)) {
								throwRpcError(
									"INVALID_TIME_WINDOW",
									422,
									"afternoonEnd must be after afternoonStart",
								);
							}
						}
						if (
							payload.morningEnd !== undefined ||
							payload.afternoonStart !== undefined
						) {
							if (!isValidScheduleTimeWindow(morningEnd, afternoonStart)) {
								throwRpcError(
									"INVALID_TIME_WINDOW",
									422,
									"afternoonStart must be after morningEnd",
								);
							}
						}

						if (payload.morningStart !== undefined) {
							updates.morningStart = payload.morningStart;
						}
						if (payload.morningEnd !== undefined) {
							updates.morningEnd = payload.morningEnd;
						}
						if (payload.afternoonStart !== undefined) {
							updates.afternoonStart = payload.afternoonStart;
						}
						if (payload.afternoonEnd !== undefined) {
							updates.afternoonEnd = payload.afternoonEnd;
						}
						if (payload.notes !== undefined) updates.notes = payload.notes;
						if (payload.isEnabled !== undefined) {
							updates.isEnabled = payload.isEnabled;
						}

						await db
							.update(schema.scheduleTemplate)
							.set(updates)
							.where(eq(schema.scheduleTemplate.id, payload.id));

						return await db.query.scheduleTemplate.findFirst({
							where: eq(schema.scheduleTemplate.id, payload.id),
						});
					}),
					remove: rpc.handler(async ({ context, input }) => {
						await requireAdminAccess(context.headers, {
							schedule: ["read"],
						});
						const payload = input as { id: string };

						const existing = await db.query.scheduleTemplate.findFirst({
							where: eq(schema.scheduleTemplate.id, payload.id),
						});
						if (!existing) {
							throwRpcError("NOT_FOUND", 404, "Schedule template not found");
						}

						await db
							.delete(schema.scheduleTemplate)
							.where(eq(schema.scheduleTemplate.id, payload.id));

						return { success: true };
					}),
				},
				overrides: {
					list: rpc.handler(async ({ context, input }) => {
						await requireAdminAccess(context.headers, {
							schedule: ["read"],
						});
						const payload = (input ?? {}) as { date?: string };

						if (payload.date) {
							if (!isValidScheduleDateFormat(payload.date)) {
								throwRpcError(
									"INVALID_DATE",
									422,
									"date query parameter must be a valid date in YYYY-MM-DD format",
								);
							}
							return await db.query.calendarOverride.findMany({
								where: eq(schema.calendarOverride.overrideDate, payload.date),
							});
						}

						return await db.query.calendarOverride.findMany({
							orderBy: (override, { asc }) => [asc(override.overrideDate)],
						});
					}),
					create: rpc.handler(async ({ context, input }) => {
						const session = await requireAdminAccess(context.headers, {
							schedule: ["read"],
						});
						const body = (input ?? {}) as {
							overrideDate?: string;
							isClosed?: boolean;
							morningEnabled?: boolean;
							morningStart?: string | null;
							morningEnd?: string | null;
							afternoonEnabled?: boolean;
							afternoonStart?: string | null;
							afternoonEnd?: string | null;
							slotDurationMinutes?: number | null;
							bufferMinutes?: number | null;
							slotCapacityLimit?: number | null;
							reason?: string | null;
						};

						if (!body.overrideDate) {
							throwRpcError(
								"MISSING_REQUIRED_FIELDS",
								422,
								"overrideDate is required",
							);
						}

						if (!isValidScheduleDateFormat(body.overrideDate)) {
							throwRpcError(
								"INVALID_DATE",
								422,
								"overrideDate must be a valid date in YYYY-MM-DD format",
							);
						}

						const existing = await db.query.calendarOverride.findFirst({
							where: eq(
								schema.calendarOverride.overrideDate,
								body.overrideDate,
							),
						});
						if (existing) {
							throwRpcError(
								"DUPLICATE_OVERRIDE_DATE",
								409,
								`An override for date ${body.overrideDate} already exists`,
							);
						}

						const isClosed = body.isClosed ?? false;
						const hasOpeningHours =
							body.morningStart ||
							body.morningEnd ||
							body.afternoonStart ||
							body.afternoonEnd ||
							body.morningEnabled === true ||
							body.afternoonEnabled === true;

						if (isClosed && hasOpeningHours) {
							throwRpcError(
								"INVALID_CLOSED_STATE",
								422,
								"Cannot set isClosed=true while providing opening hours or enabling morning/afternoon",
							);
						}

						if (
							body.slotDurationMinutes !== undefined &&
							body.slotDurationMinutes !== null
						) {
							const slotDurationMinutes = parsePositiveInteger(
								body.slotDurationMinutes,
							);
							if (slotDurationMinutes === null) {
								throwRpcError(
									"INVALID_SLOT_DURATION",
									422,
									"slotDurationMinutes must be a positive integer or null",
								);
							}
						}

						if (
							body.bufferMinutes !== undefined &&
							body.bufferMinutes !== null
						) {
							const bufferMinutes = parseNonNegativeInteger(body.bufferMinutes);
							if (bufferMinutes === null) {
								throwRpcError(
									"INVALID_BUFFER_MINUTES",
									422,
									"bufferMinutes must be a non-negative integer or null",
								);
							}
						}

						if (
							body.slotCapacityLimit !== undefined &&
							body.slotCapacityLimit !== null
						) {
							const slotCapacityLimit = parsePositiveInteger(
								body.slotCapacityLimit,
							);
							if (slotCapacityLimit === null) {
								throwRpcError(
									"INVALID_SLOT_CAPACITY",
									422,
									"slotCapacityLimit must be a positive integer or null",
								);
							}
						}

						const { morningStart, morningEnd, afternoonStart, afternoonEnd } =
							body;
						if (
							!isValidScheduleTimeFormat(morningStart) ||
							!isValidScheduleTimeFormat(morningEnd) ||
							!isValidScheduleTimeFormat(afternoonStart) ||
							!isValidScheduleTimeFormat(afternoonEnd)
						) {
							throwRpcError(
								"INVALID_TIME_FORMAT",
								422,
								"Invalid time format (HH:MM)",
							);
						}

						if (
							!isValidScheduleTimeWindow(morningStart, morningEnd) ||
							!isValidScheduleTimeWindow(afternoonStart, afternoonEnd) ||
							!isValidScheduleTimeWindow(morningEnd, afternoonStart)
						) {
							throwRpcError(
								"INVALID_TIME_WINDOW",
								422,
								"morningEnd must be before afternoonStart, and each window must have start < end",
							);
						}

						const id = crypto.randomUUID();
						const now = new Date();

						await db.insert(schema.calendarOverride).values({
							id,
							overrideDate: body.overrideDate,
							isClosed,
							morningEnabled: body.morningEnabled ?? true,
							morningStart: morningStart ?? null,
							morningEnd: morningEnd ?? null,
							afternoonEnabled: body.afternoonEnabled ?? true,
							afternoonStart: afternoonStart ?? null,
							afternoonEnd: afternoonEnd ?? null,
							slotDurationMinutes: body.slotDurationMinutes ?? null,
							bufferMinutes: body.bufferMinutes ?? null,
							slotCapacityLimit: body.slotCapacityLimit ?? null,
							reason: body.reason ?? null,
							createdByUserId: session.user.id,
							createdAt: now,
							updatedAt: now,
						});

						return await db.query.calendarOverride.findFirst({
							where: eq(schema.calendarOverride.id, id),
						});
					}),
					get: rpc.handler(async ({ context, input }) => {
						await requireAdminAccess(context.headers, {
							schedule: ["read"],
						});
						const payload = input as { id: string };

						const override = await db.query.calendarOverride.findFirst({
							where: eq(schema.calendarOverride.id, payload.id),
						});

						if (!override) {
							throwRpcError("NOT_FOUND", 404, "Calendar override not found");
						}

						return override;
					}),
					update: rpc.handler(async ({ context, input }) => {
						await requireAdminAccess(context.headers, {
							schedule: ["read"],
						});
						const payload = input as {
							id: string;
							overrideDate?: string;
							isClosed?: boolean;
							morningEnabled?: boolean;
							morningStart?: string | null;
							morningEnd?: string | null;
							afternoonEnabled?: boolean;
							afternoonStart?: string | null;
							afternoonEnd?: string | null;
							slotDurationMinutes?: number | null;
							bufferMinutes?: number | null;
							slotCapacityLimit?: number | null;
							reason?: string | null;
						};

						const existing = await db.query.calendarOverride.findFirst({
							where: eq(schema.calendarOverride.id, payload.id),
						});
						if (!existing) {
							throwRpcError("NOT_FOUND", 404, "Calendar override not found");
						}

						if (payload.overrideDate !== undefined) {
							if (!isValidScheduleDateFormat(payload.overrideDate)) {
								throwRpcError(
									"INVALID_DATE",
									422,
									"overrideDate must be a valid date in YYYY-MM-DD format",
								);
							}
							const conflict = await db.query.calendarOverride.findFirst({
								where: and(
									eq(
										schema.calendarOverride.overrideDate,
										payload.overrideDate,
									),
								),
							});
							if (conflict && conflict.id !== payload.id) {
								throwRpcError(
									"DUPLICATE_OVERRIDE_DATE",
									409,
									`An override for date ${payload.overrideDate} already exists`,
								);
							}
						}

						const isClosed = payload.isClosed ?? existing.isClosed;
						const effectiveMorningEnabled =
							payload.morningEnabled ?? existing.morningEnabled;
						const effectiveAfternoonEnabled =
							payload.afternoonEnabled ?? existing.afternoonEnabled;
						const effectiveMorningStart =
							payload.morningStart ?? existing.morningStart;
						const effectiveMorningEnd =
							payload.morningEnd ?? existing.morningEnd;
						const effectiveAfternoonStart =
							payload.afternoonStart ?? existing.afternoonStart;
						const effectiveAfternoonEnd =
							payload.afternoonEnd ?? existing.afternoonEnd;

						const hasOpeningHours =
							(effectiveMorningEnabled &&
								effectiveMorningStart &&
								effectiveMorningEnd) ||
							(effectiveAfternoonEnabled &&
								effectiveAfternoonStart &&
								effectiveAfternoonEnd);

						if (isClosed && hasOpeningHours) {
							throwRpcError(
								"INVALID_CLOSED_STATE",
								422,
								"Cannot set isClosed=true while providing opening hours or enabling morning/afternoon",
							);
						}

						if (payload.slotDurationMinutes !== undefined) {
							if (payload.slotDurationMinutes !== null) {
								const slotDurationMinutes = parsePositiveInteger(
									payload.slotDurationMinutes,
								);
								if (slotDurationMinutes === null) {
									throwRpcError(
										"INVALID_SLOT_DURATION",
										422,
										"slotDurationMinutes must be a positive integer or null",
									);
								}
							}
						}

						if (payload.bufferMinutes !== undefined) {
							if (payload.bufferMinutes !== null) {
								const bufferMinutes = parseNonNegativeInteger(
									payload.bufferMinutes,
								);
								if (bufferMinutes === null) {
									throwRpcError(
										"INVALID_BUFFER_MINUTES",
										422,
										"bufferMinutes must be a non-negative integer or null",
									);
								}
							}
						}

						if (payload.slotCapacityLimit !== undefined) {
							if (payload.slotCapacityLimit !== null) {
								const slotCapacityLimit = parsePositiveInteger(
									payload.slotCapacityLimit,
								);
								if (slotCapacityLimit === null) {
									throwRpcError(
										"INVALID_SLOT_CAPACITY",
										422,
										"slotCapacityLimit must be a positive integer or null",
									);
								}
							}
						}

						const morningStart = payload.morningStart ?? existing.morningStart;
						const morningEnd = payload.morningEnd ?? existing.morningEnd;
						const afternoonStart =
							payload.afternoonStart ?? existing.afternoonStart;
						const afternoonEnd = payload.afternoonEnd ?? existing.afternoonEnd;

						if (
							!isValidScheduleTimeFormat(payload.morningStart ?? null) ||
							!isValidScheduleTimeFormat(payload.morningEnd ?? null) ||
							!isValidScheduleTimeFormat(payload.afternoonStart ?? null) ||
							!isValidScheduleTimeFormat(payload.afternoonEnd ?? null)
						) {
							throwRpcError(
								"INVALID_TIME_FORMAT",
								422,
								"Invalid time format (HH:MM)",
							);
						}

						if (
							!isValidScheduleTimeWindow(morningStart, morningEnd) ||
							!isValidScheduleTimeWindow(afternoonStart, afternoonEnd) ||
							!isValidScheduleTimeWindow(morningEnd, afternoonStart)
						) {
							throwRpcError(
								"INVALID_TIME_WINDOW",
								422,
								"morningEnd must be before afternoonStart, and each window must have start < end",
							);
						}

						const updates: Partial<
							typeof schema.calendarOverride.$inferInsert
						> = {
							updatedAt: new Date(),
						};

						if (payload.overrideDate !== undefined) {
							updates.overrideDate = payload.overrideDate;
						}
						if (payload.isClosed !== undefined)
							updates.isClosed = payload.isClosed;
						if (payload.morningEnabled !== undefined) {
							updates.morningEnabled = payload.morningEnabled;
						}
						if (payload.morningStart !== undefined) {
							updates.morningStart = payload.morningStart;
						}
						if (payload.morningEnd !== undefined) {
							updates.morningEnd = payload.morningEnd;
						}
						if (payload.afternoonEnabled !== undefined) {
							updates.afternoonEnabled = payload.afternoonEnabled;
						}
						if (payload.afternoonStart !== undefined) {
							updates.afternoonStart = payload.afternoonStart;
						}
						if (payload.afternoonEnd !== undefined) {
							updates.afternoonEnd = payload.afternoonEnd;
						}
						if (payload.slotDurationMinutes !== undefined) {
							updates.slotDurationMinutes =
								payload.slotDurationMinutes === null
									? null
									: parsePositiveInteger(payload.slotDurationMinutes);
						}
						if (payload.bufferMinutes !== undefined) {
							updates.bufferMinutes =
								payload.bufferMinutes === null
									? null
									: parseNonNegativeInteger(payload.bufferMinutes);
						}
						if (payload.slotCapacityLimit !== undefined) {
							updates.slotCapacityLimit =
								payload.slotCapacityLimit === null
									? null
									: parsePositiveInteger(payload.slotCapacityLimit);
						}
						if (payload.reason !== undefined) {
							updates.reason = payload.reason;
						}

						await db
							.update(schema.calendarOverride)
							.set(updates)
							.where(eq(schema.calendarOverride.id, payload.id));

						return await db.query.calendarOverride.findFirst({
							where: eq(schema.calendarOverride.id, payload.id),
						});
					}),
					remove: rpc.handler(async ({ context, input }) => {
						await requireAdminAccess(context.headers, {
							schedule: ["read"],
						});
						const payload = input as { id: string };

						const existing = await db.query.calendarOverride.findFirst({
							where: eq(schema.calendarOverride.id, payload.id),
						});
						if (!existing) {
							throwRpcError("NOT_FOUND", 404, "Calendar override not found");
						}

						await db
							.delete(schema.calendarOverride)
							.where(eq(schema.calendarOverride.id, payload.id));

						return { success: true };
					}),
				},
				slots: {
					generate: rpc.handler(async ({ context, input }) => {
						await requireAdminAccess(context.headers, {
							schedule: ["read"],
						});
						const body = (input ?? {}) as {
							dateFrom?: string;
							dateTo?: string;
							maxDays?: number;
						};

						if (!body.dateFrom || !body.dateTo) {
							throwRpcError(
								"MISSING_REQUIRED_FIELDS",
								422,
								"dateFrom and dateTo are required",
							);
						}

						if (!isValidScheduleDateFormat(body.dateFrom)) {
							throwRpcError(
								"INVALID_DATE",
								422,
								"dateFrom must be a valid date in YYYY-MM-DD format",
							);
						}
						if (!isValidScheduleDateFormat(body.dateTo)) {
							throwRpcError(
								"INVALID_DATE",
								422,
								"dateTo must be a valid date in YYYY-MM-DD format",
							);
						}

						const fromDate = new Date(`${body.dateFrom}T00:00:00`);
						const toDate = new Date(`${body.dateTo}T00:00:00`);

						if (toDate < fromDate) {
							throwRpcError(
								"INVALID_DATE_RANGE",
								422,
								"dateTo must be greater than or equal to dateFrom",
							);
						}

						const maxDays = Math.min(Number(body.maxDays ?? 31), 90);
						const diffTime = toDate.getTime() - fromDate.getTime();
						const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

						if (diffDays > maxDays) {
							throwRpcError(
								"DATE_RANGE_TOO_LARGE",
								422,
								`Date range exceeds maximum of ${maxDays} days. Please use a smaller range or increase maxDays.`,
							);
						}

						const idempotencyToken = context.headers.get("if-none-match");
						const generatedSlotIds: string[] = [];
						const skippedDates: string[] = [];
						const errors: { date: string; code: string; message: string }[] =
							[];

						const currentDate = new Date(fromDate);
						while (currentDate <= toDate) {
							const dateStr = formatDateLocal(currentDate);
							const { schedule } = await getEffectiveSchedule(dateStr);

							if (!schedule || schedule.windows.length === 0) {
								skippedDates.push(dateStr);
								currentDate.setDate(currentDate.getDate() + 1);
								continue;
							}

							const existingSlots = await db.query.appointmentSlot.findMany({
								where: eq(schema.appointmentSlot.slotDate, dateStr),
							});
							const existingKeySet = new Set(
								existingSlots.map(
									(slot) => `${slot.startTime}-${slot.endTime}`,
								),
							);

							const allSlots: { startTime: string; endTime: string }[] = [];
							try {
								for (const window of schedule.windows) {
									const windowSlots = generateSlotsForWindow(
										window,
										schedule.slotDurationMinutes,
										schedule.bufferMinutes,
									);
									allSlots.push(...windowSlots);
								}
							} catch (err) {
								errors.push({
									date: dateStr,
									code: "INVALID_SCHEDULE_CONFIGURATION",
									message:
										err instanceof Error
											? err.message
											: "Invalid schedule configuration for slot generation",
								});
								currentDate.setDate(currentDate.getDate() + 1);
								continue;
							}

							const newSlots = allSlots.filter(
								(slot) =>
									!existingKeySet.has(`${slot.startTime}-${slot.endTime}`),
							);

							if (newSlots.length > 0) {
								const now = new Date();
								const insertedSlots = await db
									.insert(schema.appointmentSlot)
									.values(
										newSlots.map((slot) => ({
											id: crypto.randomUUID(),
											slotDate: dateStr,
											startTime: slot.startTime,
											endTime: slot.endTime,
											status: "open",
											capacityLimit: schedule.slotCapacityLimit,
											generatedFrom: schedule.generatedFrom,
											createdAt: now,
											updatedAt: now,
										})),
									)
									.returning();

								generatedSlotIds.push(...insertedSlots.map((slot) => slot.id));
							}

							currentDate.setDate(currentDate.getDate() + 1);
						}

						return {
							dateFrom: body.dateFrom,
							dateTo: body.dateTo,
							generatedCount: generatedSlotIds.length,
							skippedDatesCount: skippedDates.length,
							generatedSlotIds,
							skippedDates: skippedDates.length > 0 ? skippedDates : undefined,
							errors: errors.length > 0 ? errors : undefined,
							idempotentReplay:
								generatedSlotIds.length === 0 || Boolean(idempotencyToken),
						};
					}),
					list: rpc.handler(async ({ context, input }) => {
						await requireAdminAccess(context.headers, {
							schedule: ["read"],
						});
						const payload = (input ?? {}) as { date?: string };
						const date = payload.date;

						if (!date) {
							throwRpcError(
								"MISSING_REQUIRED_FIELDS",
								422,
								"date query parameter is required (YYYY-MM-DD)",
							);
						}

						if (!isValidScheduleDateFormat(date)) {
							throwRpcError(
								"INVALID_DATE",
								422,
								"date must be a valid date in YYYY-MM-DD format (including leap year validation)",
							);
						}

						const { schedule, override } = await getEffectiveSchedule(date);
						if (!schedule || schedule.windows.length === 0) {
							return {
								date,
								slots: [],
								generatedFrom: override ? "override" : "base",
								isClosed: override?.isClosed ?? true,
								count: 0,
							};
						}

						const existingSlots = await db.query.appointmentSlot.findMany({
							where: eq(schema.appointmentSlot.slotDate, date),
						});
						const existingKeySet = new Set(
							existingSlots.map((slot) => `${slot.startTime}-${slot.endTime}`),
						);

						const allSlots: { startTime: string; endTime: string }[] = [];
						for (const window of schedule.windows) {
							const windowSlots = generateSlotsForWindow(
								window,
								schedule.slotDurationMinutes,
								schedule.bufferMinutes,
							);
							allSlots.push(...windowSlots);
						}

						const newSlots = allSlots.filter(
							(slot) =>
								!existingKeySet.has(`${slot.startTime}-${slot.endTime}`),
						);
						if (newSlots.length > 0) {
							const now = new Date();
							await db.insert(schema.appointmentSlot).values(
								newSlots.map((slot) => ({
									id: crypto.randomUUID(),
									slotDate: date,
									startTime: slot.startTime,
									endTime: slot.endTime,
									status: "open",
									capacityLimit: schedule.slotCapacityLimit,
									generatedFrom: schedule.generatedFrom,
									createdAt: now,
									updatedAt: now,
								})),
							);
						}

						const allSlotsForDate = await db.query.appointmentSlot.findMany({
							where: eq(schema.appointmentSlot.slotDate, date),
							orderBy: (slot, { asc }) => [asc(slot.startTime)],
						});

						const slotIds = allSlotsForDate.map((slot) => slot.id);
						const slotIdsSet = new Set(slotIds);
						const activeBookings = await db.query.booking.findMany({
							where: and(eq(schema.booking.isActive, true)),
						});

						const bookingCountBySlot = new Map<string, number>();
						for (const booking of activeBookings) {
							if (slotIdsSet.has(booking.slotId)) {
								const current = bookingCountBySlot.get(booking.slotId) ?? 0;
								bookingCountBySlot.set(booking.slotId, current + 1);
							}
						}

						const slotsWithCapacity = allSlotsForDate.map((slot) => ({
							id: slot.id,
							slotDate: slot.slotDate,
							startTime: slot.startTime,
							endTime: slot.endTime,
							status: slot.status,
							capacityLimit: slot.capacityLimit,
							reservedCount: bookingCountBySlot.get(slot.id) ?? 0,
							remainingCapacity:
								slot.capacityLimit !== null
									? Math.max(
											0,
											slot.capacityLimit -
												(bookingCountBySlot.get(slot.id) ?? 0),
										)
									: null,
							generatedFrom: slot.generatedFrom,
						}));

						return {
							date,
							slots: slotsWithCapacity,
							generatedFrom: schedule.generatedFrom,
							isClosed: false,
							count: slotsWithCapacity.length,
						};
					}),
				},
			},
			staff: {
				list: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						staff: ["read"],
					});
					const payload = (input ?? {}) as { isActive?: boolean | string };

					let profiles: Awaited<
						ReturnType<typeof db.query.staffProfile.findMany>
					>;
					if (payload.isActive !== undefined) {
						const isActive =
							payload.isActive === true || payload.isActive === "true";
						profiles = await db.query.staffProfile.findMany({
							where: eq(schema.staffProfile.isActive, isActive),
							orderBy: (staffProfile, { asc }) => [asc(staffProfile.userId)],
						});
					} else {
						profiles = await db.query.staffProfile.findMany({
							orderBy: (staffProfile, { asc }) => [asc(staffProfile.userId)],
						});
					}

					return await Promise.all(
						profiles.map(async (profile) => {
							const staffUser = await db.query.user.findFirst({
								where: eq(schema.user.id, profile.userId),
							});
							return {
								...profile,
								user: staffUser
									? {
											id: staffUser.id,
											name: staffUser.name,
											email: staffUser.email,
											role: staffUser.role,
										}
									: null,
							};
						}),
					);
				}),
				create: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						staff: ["read"],
					});
					const body = (input ?? {}) as {
						userId?: string;
						isActive?: boolean;
						isAssignable?: boolean;
						defaultDailyCapacity?: number;
						weeklyAvailability?: unknown;
						notes?: string | null;
						metadata?: Record<string, unknown>;
					};

					if (!body.userId) {
						throwRpcError("MISSING_REQUIRED_FIELDS", 422, "userId is required");
					}

					const staffUser = await db.query.user.findFirst({
						where: eq(schema.user.id, body.userId),
					});
					if (!staffUser) {
						throwRpcError(
							"USER_NOT_FOUND",
							422,
							`User with id ${body.userId} does not exist`,
						);
					}

					const existingProfile = await db.query.staffProfile.findFirst({
						where: eq(schema.staffProfile.userId, body.userId),
					});
					if (existingProfile) {
						throwRpcError(
							"STAFF_PROFILE_EXISTS",
							409,
							`A staff profile for user ${body.userId} already exists`,
						);
					}

					let parsedDefaultCapacity: number | undefined;
					if (body.defaultDailyCapacity !== undefined) {
						const capacity = Number(body.defaultDailyCapacity);
						if (!Number.isInteger(capacity) || capacity <= 0) {
							throwRpcError(
								"INVALID_CAPACITY",
								422,
								"defaultDailyCapacity must be a positive integer",
							);
						}
						parsedDefaultCapacity = capacity;
					}

					const weeklyAvailability = validateWeeklyAvailability(
						body.weeklyAvailability,
					);
					if (!weeklyAvailability.valid) {
						throwRpcError(
							"INVALID_WEEKLY_AVAILABILITY",
							422,
							weeklyAvailability.error,
						);
					}

					const now = new Date();
					await db.insert(schema.staffProfile).values({
						userId: body.userId,
						isActive: body.isActive ?? true,
						isAssignable: body.isAssignable ?? true,
						defaultDailyCapacity: parsedDefaultCapacity ?? 25,
						weeklyAvailability: weeklyAvailability.parsed,
						notes: body.notes ?? null,
						metadata: body.metadata ?? {},
						createdAt: now,
						updatedAt: now,
					});

					const created = await db.query.staffProfile.findFirst({
						where: eq(schema.staffProfile.userId, body.userId),
					});

					return {
						...created,
						user: {
							id: staffUser.id,
							name: staffUser.name,
							email: staffUser.email,
							role: staffUser.role,
						},
					};
				}),
				get: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						staff: ["read"],
					});
					const payload = input as { userId: string };

					const profile = await db.query.staffProfile.findFirst({
						where: eq(schema.staffProfile.userId, payload.userId),
					});
					if (!profile) {
						throwRpcError("NOT_FOUND", 404, "Staff profile not found");
					}

					const staffUser = await db.query.user.findFirst({
						where: eq(schema.user.id, payload.userId),
					});

					return {
						...profile,
						user: staffUser
							? {
									id: staffUser.id,
									name: staffUser.name,
									email: staffUser.email,
									role: staffUser.role,
								}
							: null,
					};
				}),
				update: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						staff: ["read"],
					});
					const payload = input as {
						userId: string;
						isActive?: boolean;
						isAssignable?: boolean;
						defaultDailyCapacity?: number;
						weeklyAvailability?: unknown;
						notes?: string | null;
						metadata?: Record<string, unknown>;
					};

					const existing = await db.query.staffProfile.findFirst({
						where: eq(schema.staffProfile.userId, payload.userId),
					});
					if (!existing) {
						throwRpcError("NOT_FOUND", 404, "Staff profile not found");
					}

					let parsedDefaultCapacity: number | undefined;
					if (payload.defaultDailyCapacity !== undefined) {
						const capacity = Number(payload.defaultDailyCapacity);
						if (!Number.isInteger(capacity) || capacity <= 0) {
							throwRpcError(
								"INVALID_CAPACITY",
								422,
								"defaultDailyCapacity must be a positive integer",
							);
						}
						parsedDefaultCapacity = capacity;
					}

					if (payload.weeklyAvailability !== undefined) {
						const weeklyAvailability = validateWeeklyAvailability(
							payload.weeklyAvailability,
						);
						if (!weeklyAvailability.valid) {
							throwRpcError(
								"INVALID_WEEKLY_AVAILABILITY",
								422,
								weeklyAvailability.error,
							);
						}
					}

					if (
						payload.isActive !== undefined &&
						typeof payload.isActive !== "boolean"
					) {
						throwRpcError(
							"INVALID_FIELD_TYPE",
							422,
							"isActive must be a boolean",
						);
					}
					if (
						payload.isAssignable !== undefined &&
						typeof payload.isAssignable !== "boolean"
					) {
						throwRpcError(
							"INVALID_FIELD_TYPE",
							422,
							"isAssignable must be a boolean",
						);
					}

					const updates: Partial<typeof schema.staffProfile.$inferInsert> = {
						updatedAt: new Date(),
					};

					if (payload.isActive !== undefined)
						updates.isActive = payload.isActive;
					if (payload.isAssignable !== undefined) {
						updates.isAssignable = payload.isAssignable;
					}
					if (parsedDefaultCapacity !== undefined) {
						updates.defaultDailyCapacity = parsedDefaultCapacity;
					}
					if (payload.weeklyAvailability !== undefined) {
						const weeklyAvailability = validateWeeklyAvailability(
							payload.weeklyAvailability,
						);
						if (weeklyAvailability.valid) {
							updates.weeklyAvailability = weeklyAvailability.parsed;
						}
					}
					if (payload.notes !== undefined) updates.notes = payload.notes;
					if (payload.metadata !== undefined)
						updates.metadata = payload.metadata;

					await db
						.update(schema.staffProfile)
						.set(updates)
						.where(eq(schema.staffProfile.userId, payload.userId));

					const updated = await db.query.staffProfile.findFirst({
						where: eq(schema.staffProfile.userId, payload.userId),
					});
					const staffUser = await db.query.user.findFirst({
						where: eq(schema.user.id, payload.userId),
					});

					return {
						...updated,
						user: staffUser
							? {
									id: staffUser.id,
									name: staffUser.name,
									email: staffUser.email,
									role: staffUser.role,
								}
							: null,
					};
				}),
				remove: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						staff: ["read"],
					});
					const payload = input as { userId: string };

					const existing = await db.query.staffProfile.findFirst({
						where: eq(schema.staffProfile.userId, payload.userId),
					});
					if (!existing) {
						throwRpcError("NOT_FOUND", 404, "Staff profile not found");
					}

					const activeBookings = await db.query.booking.findMany({
						where: and(
							eq(schema.booking.staffUserId, payload.userId),
							eq(schema.booking.isActive, true),
						),
					});
					if (activeBookings.length > 0) {
						throwRpcError(
							"STAFF_HAS_ACTIVE_BOOKINGS",
							409,
							"Cannot delete staff profile with active bookings. Please reassign or cancel them first.",
						);
					}

					await db
						.delete(schema.staffProfile)
						.where(eq(schema.staffProfile.userId, payload.userId));

					return { success: true };
				}),
				dateOverrides: {
					list: rpc.handler(async ({ context, input }) => {
						await requireAdminAccess(context.headers, {
							staff: ["read"],
						});
						const payload = (input ?? {}) as { userId: string; date?: string };

						const staffProfile = await db.query.staffProfile.findFirst({
							where: eq(schema.staffProfile.userId, payload.userId),
						});
						if (!staffProfile) {
							throwRpcError("NOT_FOUND", 404, "Staff profile not found");
						}

						if (payload.date) {
							if (!isValidStaffDateFormat(payload.date)) {
								throwRpcError(
									"INVALID_DATE",
									422,
									"date query parameter must be a valid date in YYYY-MM-DD format",
								);
							}
							return await db.query.staffDateOverride.findMany({
								where: and(
									eq(schema.staffDateOverride.staffUserId, payload.userId),
									eq(schema.staffDateOverride.overrideDate, payload.date),
								),
							});
						}

						return await db.query.staffDateOverride.findMany({
							where: eq(schema.staffDateOverride.staffUserId, payload.userId),
							orderBy: (override, { asc }) => [asc(override.overrideDate)],
						});
					}),
					create: rpc.handler(async ({ context, input }) => {
						const session = await requireAdminAccess(context.headers, {
							staff: ["read"],
						});
						const payload = input as {
							userId: string;
							overrideDate?: string;
							isAvailable?: boolean;
							capacityOverride?: number;
							availableStartTime?: string | null;
							availableEndTime?: string | null;
							notes?: string | null;
						};

						const staffProfile = await db.query.staffProfile.findFirst({
							where: eq(schema.staffProfile.userId, payload.userId),
						});
						if (!staffProfile) {
							throwRpcError("NOT_FOUND", 404, "Staff profile not found");
						}

						if (!payload.overrideDate) {
							throwRpcError(
								"MISSING_REQUIRED_FIELDS",
								422,
								"overrideDate is required",
							);
						}

						if (!isValidStaffDateFormat(payload.overrideDate)) {
							throwRpcError(
								"INVALID_DATE",
								422,
								"overrideDate must be a valid date in YYYY-MM-DD format",
							);
						}

						let parsedCapacityOverride: number | undefined;
						if (payload.capacityOverride !== undefined) {
							const capacity = Number(payload.capacityOverride);
							if (!Number.isInteger(capacity) || capacity <= 0) {
								throwRpcError(
									"INVALID_CAPACITY",
									422,
									"capacityOverride must be a positive integer",
								);
							}
							parsedCapacityOverride = capacity;
						}

						const availableStartTime = payload.availableStartTime;
						const availableEndTime = payload.availableEndTime;

						if (!isValidStaffTimeFormat(availableStartTime)) {
							throwRpcError(
								"INVALID_TIME_FORMAT",
								422,
								"availableStartTime must be in HH:MM format",
							);
						}
						if (!isValidStaffTimeFormat(availableEndTime)) {
							throwRpcError(
								"INVALID_TIME_FORMAT",
								422,
								"availableEndTime must be in HH:MM format",
							);
						}

						if (
							availableStartTime &&
							availableEndTime &&
							!isValidStaffTimeWindow(availableStartTime, availableEndTime)
						) {
							throwRpcError(
								"INVALID_TIME_WINDOW",
								422,
								"availableEndTime must be after availableStartTime",
							);
						}

						if (
							payload.isAvailable === false &&
							(availableStartTime || availableEndTime)
						) {
							throwRpcError(
								"INVALID_OVERRIDE_STATE",
								422,
								"Cannot set time windows when isAvailable=false",
							);
						}

						const now = new Date();
						const existingOverride = await db.query.staffDateOverride.findFirst(
							{
								where: and(
									eq(schema.staffDateOverride.staffUserId, payload.userId),
									eq(
										schema.staffDateOverride.overrideDate,
										payload.overrideDate,
									),
								),
							},
						);

						if (existingOverride) {
							const updates: Partial<
								typeof schema.staffDateOverride.$inferInsert
							> = {
								updatedAt: now,
							};
							if (payload.isAvailable !== undefined) {
								updates.isAvailable = payload.isAvailable;
							}
							if (payload.capacityOverride !== undefined) {
								updates.capacityOverride = parsedCapacityOverride;
							}
							if (payload.availableStartTime !== undefined) {
								updates.availableStartTime = payload.availableStartTime;
							}
							if (payload.availableEndTime !== undefined) {
								updates.availableEndTime = payload.availableEndTime;
							}
							if (payload.notes !== undefined) updates.notes = payload.notes;

							await db
								.update(schema.staffDateOverride)
								.set(updates)
								.where(eq(schema.staffDateOverride.id, existingOverride.id));

							return await db.query.staffDateOverride.findFirst({
								where: eq(schema.staffDateOverride.id, existingOverride.id),
							});
						}

						const id = crypto.randomUUID();
						await db.insert(schema.staffDateOverride).values({
							id,
							staffUserId: payload.userId,
							overrideDate: payload.overrideDate,
							isAvailable: payload.isAvailable ?? true,
							capacityOverride: parsedCapacityOverride ?? null,
							availableStartTime: availableStartTime ?? null,
							availableEndTime: availableEndTime ?? null,
							notes: payload.notes ?? null,
							createdByUserId: session.user.id,
							createdAt: now,
							updatedAt: now,
						});

						return await db.query.staffDateOverride.findFirst({
							where: eq(schema.staffDateOverride.id, id),
						});
					}),
					get: rpc.handler(async ({ context, input }) => {
						await requireAdminAccess(context.headers, {
							staff: ["read"],
						});
						const payload = input as { userId: string; overrideId: string };

						const staffProfile = await db.query.staffProfile.findFirst({
							where: eq(schema.staffProfile.userId, payload.userId),
						});
						if (!staffProfile) {
							throwRpcError("NOT_FOUND", 404, "Staff profile not found");
						}

						const override = await db.query.staffDateOverride.findFirst({
							where: and(
								eq(schema.staffDateOverride.id, payload.overrideId),
								eq(schema.staffDateOverride.staffUserId, payload.userId),
							),
						});
						if (!override) {
							throwRpcError("NOT_FOUND", 404, "Staff date override not found");
						}

						return override;
					}),
					update: rpc.handler(async ({ context, input }) => {
						await requireAdminAccess(context.headers, {
							staff: ["read"],
						});
						const payload = input as {
							userId: string;
							overrideId: string;
							overrideDate?: string;
							isAvailable?: boolean;
							capacityOverride?: number;
							availableStartTime?: string | null;
							availableEndTime?: string | null;
							notes?: string | null;
						};

						const staffProfile = await db.query.staffProfile.findFirst({
							where: eq(schema.staffProfile.userId, payload.userId),
						});
						if (!staffProfile) {
							throwRpcError("NOT_FOUND", 404, "Staff profile not found");
						}

						const existing = await db.query.staffDateOverride.findFirst({
							where: and(
								eq(schema.staffDateOverride.id, payload.overrideId),
								eq(schema.staffDateOverride.staffUserId, payload.userId),
							),
						});
						if (!existing) {
							throwRpcError("NOT_FOUND", 404, "Staff date override not found");
						}

						if (payload.overrideDate !== undefined) {
							if (!isValidStaffDateFormat(payload.overrideDate)) {
								throwRpcError(
									"INVALID_DATE",
									422,
									"overrideDate must be a valid date in YYYY-MM-DD format",
								);
							}
							if (payload.overrideDate !== existing.overrideDate) {
								const conflict = await db.query.staffDateOverride.findFirst({
									where: and(
										eq(schema.staffDateOverride.staffUserId, payload.userId),
										eq(
											schema.staffDateOverride.overrideDate,
											payload.overrideDate,
										),
									),
								});
								if (conflict) {
									throwRpcError(
										"DUPLICATE_OVERRIDE_DATE",
										409,
										`An override for date ${payload.overrideDate} already exists for this staff member`,
									);
								}
							}
						}

						let parsedPatchCapacityOverride: number | undefined;
						if (payload.capacityOverride !== undefined) {
							const capacity = Number(payload.capacityOverride);
							if (!Number.isInteger(capacity) || capacity <= 0) {
								throwRpcError(
									"INVALID_CAPACITY",
									422,
									"capacityOverride must be a positive integer",
								);
							}
							parsedPatchCapacityOverride = capacity;
						}

						const availableStartTime =
							payload.availableStartTime ?? existing.availableStartTime;
						const availableEndTime =
							payload.availableEndTime ?? existing.availableEndTime;

						if (!isValidStaffTimeFormat(payload.availableStartTime ?? null)) {
							throwRpcError(
								"INVALID_TIME_FORMAT",
								422,
								"availableStartTime must be in HH:MM format",
							);
						}
						if (!isValidStaffTimeFormat(payload.availableEndTime ?? null)) {
							throwRpcError(
								"INVALID_TIME_FORMAT",
								422,
								"availableEndTime must be in HH:MM format",
							);
						}

						if (
							availableStartTime &&
							availableEndTime &&
							!isValidStaffTimeWindow(availableStartTime, availableEndTime)
						) {
							throwRpcError(
								"INVALID_TIME_WINDOW",
								422,
								"availableEndTime must be after availableStartTime",
							);
						}

						const isAvailable = payload.isAvailable ?? existing.isAvailable;
						if (
							isAvailable === false &&
							(availableStartTime || availableEndTime)
						) {
							throwRpcError(
								"INVALID_OVERRIDE_STATE",
								422,
								"Cannot set time windows when isAvailable=false",
							);
						}

						const updates: Partial<
							typeof schema.staffDateOverride.$inferInsert
						> = {
							updatedAt: new Date(),
						};
						if (payload.overrideDate !== undefined) {
							updates.overrideDate = payload.overrideDate;
						}
						if (payload.isAvailable !== undefined) {
							updates.isAvailable = payload.isAvailable;
						}
						if (parsedPatchCapacityOverride !== undefined) {
							updates.capacityOverride = parsedPatchCapacityOverride;
						}
						if (payload.availableStartTime !== undefined) {
							updates.availableStartTime = payload.availableStartTime;
						}
						if (payload.availableEndTime !== undefined) {
							updates.availableEndTime = payload.availableEndTime;
						}
						if (payload.notes !== undefined) updates.notes = payload.notes;

						await db
							.update(schema.staffDateOverride)
							.set(updates)
							.where(eq(schema.staffDateOverride.id, payload.overrideId));

						return await db.query.staffDateOverride.findFirst({
							where: eq(schema.staffDateOverride.id, payload.overrideId),
						});
					}),
					remove: rpc.handler(async ({ context, input }) => {
						await requireAdminAccess(context.headers, {
							staff: ["read"],
						});
						const payload = input as { userId: string; overrideId: string };

						const staffProfile = await db.query.staffProfile.findFirst({
							where: eq(schema.staffProfile.userId, payload.userId),
						});
						if (!staffProfile) {
							throwRpcError("NOT_FOUND", 404, "Staff profile not found");
						}

						const existing = await db.query.staffDateOverride.findFirst({
							where: and(
								eq(schema.staffDateOverride.id, payload.overrideId),
								eq(schema.staffDateOverride.staffUserId, payload.userId),
							),
						});
						if (!existing) {
							throwRpcError("NOT_FOUND", 404, "Staff date override not found");
						}

						await db
							.delete(schema.staffDateOverride)
							.where(eq(schema.staffDateOverride.id, payload.overrideId));

						return { success: true };
					}),
				},
				effectiveAvailability: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						staff: ["read"],
					});
					const payload = input as { userId: string; date?: string };
					const date = payload.date;

					if (!date) {
						throwRpcError(
							"MISSING_REQUIRED_FIELDS",
							422,
							"date query parameter is required (YYYY-MM-DD)",
						);
					}

					if (!isValidStaffDateFormat(date)) {
						throwRpcError(
							"INVALID_DATE",
							422,
							"date must be a valid date in YYYY-MM-DD format",
						);
					}

					const staffProfile = await db.query.staffProfile.findFirst({
						where: eq(schema.staffProfile.userId, payload.userId),
					});
					if (!staffProfile) {
						throwRpcError("NOT_FOUND", 404, "Staff profile not found");
					}

					const isActive = staffProfile.isActive;
					const isAssignable = staffProfile.isAssignable;
					if (!isActive || !isAssignable) {
						return {
							userId: payload.userId,
							date,
							isAvailable: false,
							reason: !isActive ? "STAFF_INACTIVE" : "STAFF_NOT_ASSIGNABLE",
							dailyCapacity: 0,
							availableWindow: null,
						};
					}

					const override = await db.query.staffDateOverride.findFirst({
						where: and(
							eq(schema.staffDateOverride.staffUserId, payload.userId),
							eq(schema.staffDateOverride.overrideDate, date),
						),
					});

					if (override) {
						if (!override.isAvailable) {
							return {
								userId: payload.userId,
								date,
								isAvailable: false,
								reason: "DATE_OVERRIDE_UNAVAILABLE",
								dailyCapacity: 0,
								availableWindow: null,
							};
						}

						const effectiveCapacity =
							override.capacityOverride ?? staffProfile.defaultDailyCapacity;
						const window =
							override.availableStartTime && override.availableEndTime
								? {
										start: override.availableStartTime,
										end: override.availableEndTime,
									}
								: null;

						return {
							userId: payload.userId,
							date,
							isAvailable: true,
							reason: "DATE_OVERRIDE",
							dailyCapacity: effectiveCapacity,
							availableWindow: window,
						};
					}

					const weekday = new Date(`${date}T00:00:00`).getDay();
					const weeklyAvailability = (staffProfile.weeklyAvailability ??
						{}) as Record<
						string,
						{
							enabled?: boolean;
							morningStart?: string;
							morningEnd?: string;
							afternoonStart?: string;
							afternoonEnd?: string;
						}
					>;
					const dayConfig = weeklyAvailability[String(weekday)];

					if (!dayConfig || dayConfig.enabled !== false) {
						return {
							userId: payload.userId,
							date,
							isAvailable: true,
							reason: "DEFAULT",
							dailyCapacity: staffProfile.defaultDailyCapacity,
							availableWindow: null,
						};
					}

					if (dayConfig.enabled === false) {
						return {
							userId: payload.userId,
							date,
							isAvailable: false,
							reason: "WEEKLY_AVAILABILITY_DISABLED",
							dailyCapacity: 0,
							availableWindow: null,
						};
					}

					const window =
						dayConfig.morningStart &&
						dayConfig.morningEnd &&
						dayConfig.afternoonStart &&
						dayConfig.afternoonEnd
							? {
									morning: {
										start: dayConfig.morningStart,
										end: dayConfig.morningEnd,
									},
									afternoon: {
										start: dayConfig.afternoonStart,
										end: dayConfig.afternoonEnd,
									},
								}
							: dayConfig.morningStart && dayConfig.morningEnd
								? {
										start: dayConfig.morningStart,
										end: dayConfig.morningEnd,
									}
								: null;

					return {
						userId: payload.userId,
						date,
						isAvailable: true,
						reason: "WEEKLY_AVAILABILITY",
						dailyCapacity: staffProfile.defaultDailyCapacity,
						availableWindow: window,
					};
				}),
			},
			bookings: {
				create: rpc.handler(async ({ context, input }) => {
					const session = await requireAdminAccess(context.headers, {
						booking: ["read"],
					});
					const payload = input as {
						slotId: string;
						staffUserId: string;
						kind: "citizen" | "administrative";
						requestId?: string;
						citizenUserId?: string;
						holdExpiresAt?: string;
						holdToken?: string;
					};

					if (!payload.slotId) {
						throwRpcError("MISSING_REQUIRED_FIELDS", 422, "slotId is required");
					}
					if (!payload.staffUserId) {
						throwRpcError(
							"MISSING_REQUIRED_FIELDS",
							422,
							"staffUserId is required",
						);
					}
					if (
						!payload.kind ||
						!["citizen", "administrative"].includes(payload.kind)
					) {
						throwRpcError(
							"INVALID_KIND",
							422,
							"kind must be 'citizen' or 'administrative'",
						);
					}

					const slot = await db.query.appointmentSlot.findFirst({
						where: eq(schema.appointmentSlot.id, payload.slotId),
					});
					if (!slot) {
						throwRpcError("NOT_FOUND", 404, "Appointment slot not found");
					}

					const staff = await db.query.staffProfile.findFirst({
						where: eq(schema.staffProfile.userId, payload.staffUserId),
					});
					if (!staff) {
						throwRpcError("NOT_FOUND", 404, "Staff profile not found");
					}

					let holdExpiresAt: Date | null = null;
					if (payload.kind === "citizen" && payload.holdExpiresAt) {
						holdExpiresAt = new Date(payload.holdExpiresAt);
						if (Number.isNaN(holdExpiresAt.getTime())) {
							throwRpcError(
								"INVALID_DATE",
								422,
								"holdExpiresAt must be a valid ISO timestamp",
							);
						}
					}

					const holdToken =
						payload.kind === "citizen"
							? (payload.holdToken ?? crypto.randomUUID())
							: null;

					const result = await consumeCapacity(
						payload.slotId,
						payload.staffUserId,
						payload.kind,
						payload.requestId ?? null,
						payload.citizenUserId ?? null,
						session.user.id,
						holdToken,
						holdExpiresAt,
					);

					if (!result.success) {
						throwRpcError(
							"CAPACITY_CONFLICT",
							409,
							"Insufficient capacity for this operation",
							{ conflicts: result.conflicts },
						);
					}

					if (!result.bookingId) {
						throwRpcError("INTERNAL_ERROR", 500, "Booking ID not returned");
					}

					const created = await db.query.booking.findFirst({
						where: eq(schema.booking.id, result.bookingId),
					});

					return created;
				}),
				list: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						booking: ["read"],
					});
					const payload = (input ?? {}) as {
						slotId?: string;
						staffUserId?: string;
						requestId?: string;
						citizenUserId?: string;
						kind?: string;
						status?: string;
						isActive?: boolean;
						dateFrom?: string;
						dateTo?: string;
					};

					const isValidIsoDate = (date: string): boolean =>
						/^\d{4}-\d{2}-\d{2}$/.test(date);

					if (payload.dateFrom && !isValidIsoDate(payload.dateFrom)) {
						throwRpcError("INVALID_DATE", 422, "dateFrom must be YYYY-MM-DD");
					}
					if (payload.dateTo && !isValidIsoDate(payload.dateTo)) {
						throwRpcError("INVALID_DATE", 422, "dateTo must be YYYY-MM-DD");
					}
					if (
						payload.dateFrom &&
						payload.dateTo &&
						payload.dateTo < payload.dateFrom
					) {
						throwRpcError(
							"INVALID_DATE_RANGE",
							422,
							"dateTo must be greater than or equal to dateFrom",
						);
					}

					const conditions = [];
					if (payload.slotId)
						conditions.push(eq(schema.booking.slotId, payload.slotId));
					if (payload.staffUserId)
						conditions.push(
							eq(schema.booking.staffUserId, payload.staffUserId),
						);
					if (payload.requestId)
						conditions.push(eq(schema.booking.requestId, payload.requestId));
					if (payload.citizenUserId)
						conditions.push(
							eq(schema.booking.citizenUserId, payload.citizenUserId),
						);
					if (payload.kind)
						conditions.push(eq(schema.booking.kind, payload.kind));
					if (payload.status)
						conditions.push(eq(schema.booking.status, payload.status));
					if (payload.isActive !== undefined) {
						conditions.push(eq(schema.booking.isActive, payload.isActive));
					}

					let bookings: Awaited<ReturnType<typeof db.query.booking.findMany>>;
					if (conditions.length > 0) {
						bookings = await db.query.booking.findMany({
							where: and(...conditions),
						});
					} else {
						bookings = await db.query.booking.findMany();
					}

					if (payload.dateFrom || payload.dateTo) {
						const slotDateConditions = [];
						if (payload.dateFrom) {
							slotDateConditions.push(
								gte(schema.appointmentSlot.slotDate, payload.dateFrom),
							);
						}
						if (payload.dateTo) {
							slotDateConditions.push(
								lte(schema.appointmentSlot.slotDate, payload.dateTo),
							);
						}

						const matchingSlots = await db.query.appointmentSlot.findMany({
							where:
								slotDateConditions.length > 0
									? and(...slotDateConditions)
									: undefined,
						});

						const slotDateMap = new Map(
							matchingSlots.map((slot) => [slot.id, slot.slotDate]),
						);
						bookings = bookings.filter((booking) =>
							slotDateMap.has(booking.slotId),
						);
					}

					return await Promise.all(
						bookings.map(async (booking) => {
							const slot = await db.query.appointmentSlot.findFirst({
								where: eq(schema.appointmentSlot.id, booking.slotId),
							});
							const staffUser = booking.staffUserId
								? await db.query.user.findFirst({
										where: eq(schema.user.id, booking.staffUserId),
									})
								: null;

							return {
								...booking,
								slot: slot ?? null,
								staff: staffUser
									? {
											id: staffUser.id,
											name: staffUser.name,
											email: staffUser.email,
										}
									: null,
							};
						}),
					);
				}),
				get: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						booking: ["read"],
					});
					const payload = input as { id: string };

					const booking = await db.query.booking.findFirst({
						where: eq(schema.booking.id, payload.id),
					});
					if (!booking) {
						throwRpcError("NOT_FOUND", 404, "Booking not found");
					}

					const slot = await db.query.appointmentSlot.findFirst({
						where: eq(schema.appointmentSlot.id, booking.slotId),
					});
					const staffUser = booking.staffUserId
						? await db.query.user.findFirst({
								where: eq(schema.user.id, booking.staffUserId),
							})
						: null;

					return {
						...booking,
						slot: slot ?? null,
						staff: staffUser
							? {
									id: staffUser.id,
									name: staffUser.name,
									email: staffUser.email,
								}
							: null,
					};
				}),
				capacity: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						booking: ["read"],
					});
					const payload = input as { id: string };

					const booking = await db.query.booking.findFirst({
						where: eq(schema.booking.id, payload.id),
					});
					if (!booking) {
						throwRpcError("NOT_FOUND", 404, "Booking not found");
					}
					if (!booking.staffUserId) {
						throwRpcError(
							"INVALID_STATE",
							422,
							"Booking has no staff assigned",
						);
					}

					return await checkCapacity(booking.slotId, booking.staffUserId);
				}),
				confirm: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						booking: ["read"],
					});
					const payload = input as { id: string };

					const result = await confirmBooking(payload.id);
					if (!result.success) {
						const code =
							result.error === "Booking not found"
								? "NOT_FOUND"
								: "CONFIRMATION_FAILED";
						throwRpcError(
							code,
							code === "NOT_FOUND" ? 404 : 422,
							result.error ?? "Unknown error",
						);
					}

					return await db.query.booking.findFirst({
						where: eq(schema.booking.id, payload.id),
					});
				}),
				release: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						booking: ["read"],
					});
					const payload = input as { id: string; reason: string };

					if (
						!payload.reason ||
						!["cancelled", "expired", "attended"].includes(payload.reason)
					) {
						throwRpcError(
							"INVALID_REASON",
							422,
							"reason must be 'cancelled', 'expired', or 'attended'",
						);
					}

					const reason = payload.reason as "cancelled" | "expired" | "attended";
					const result = await releaseCapacity(payload.id, reason);
					if (!result.success && !result.alreadyReleased) {
						const code =
							result.error === "Booking not found"
								? "NOT_FOUND"
								: "RELEASE_FAILED";
						throwRpcError(
							code,
							code === "NOT_FOUND" ? 404 : 422,
							result.error ?? "Unknown error",
						);
					}

					const booking = await db.query.booking.findFirst({
						where: eq(schema.booking.id, payload.id),
					});

					return {
						booking,
						alreadyReleased: result.alreadyReleased,
					};
				}),
				reassign: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						booking: ["read"],
					});
					const payload = input as { id: string; targetStaffUserId: string };

					if (!payload.targetStaffUserId) {
						throwRpcError(
							"MISSING_REQUIRED_FIELDS",
							422,
							"targetStaffUserId is required",
						);
					}

					const targetStaff = await db.query.staffProfile.findFirst({
						where: eq(schema.staffProfile.userId, payload.targetStaffUserId),
					});
					if (!targetStaff) {
						throwRpcError("NOT_FOUND", 404, "Target staff profile not found");
					}

					const result = await reassignBooking(
						payload.id,
						payload.targetStaffUserId,
					);
					if (!result.success) {
						if (result.error === "Booking not found") {
							throwRpcError(
								"NOT_FOUND",
								404,
								result.error ?? "Booking not found",
							);
						}
						if (
							result.error === "STALE_ACTIVE_BOOKING" ||
							result.error === "Cannot reassign inactive booking"
						) {
							const booking = await db.query.booking.findFirst({
								where: eq(schema.booking.id, payload.id),
							});
							let currentActiveBookingId: string | null = null;
							if (booking?.requestId) {
								const serviceRequest = await db.query.serviceRequest.findFirst({
									where: eq(schema.serviceRequest.id, booking.requestId),
								});
								currentActiveBookingId =
									serviceRequest?.activeBookingId ?? null;
							}

							throwRpcError("STALE_ACTIVE_BOOKING", 409, result.error, {
								currentActiveBookingId,
							});
						}
						if (
							result.error === "Target staff is not active or not assignable" ||
							result.error === "Target staff is unavailable on this date" ||
							result.error === "STAFF_NOT_ASSIGNABLE" ||
							result.error === "STAFF_UNAVAILABLE"
						) {
							throwRpcError("STAFF_NOT_ASSIGNABLE", 409, result.error, {
								conflicts: result.conflicts,
							});
						}
						if (result.error === "Target staff lacks capacity") {
							throwRpcError(
								"CAPACITY_CONFLICT",
								409,
								"Insufficient capacity for this operation",
								{ conflicts: result.conflicts },
							);
						}
						throwRpcError(
							"REASSIGNMENT_FAILED",
							422,
							result.error ?? "Unknown error",
						);
					}

					return await db.query.booking.findFirst({
						where: eq(schema.booking.id, payload.id),
					});
				}),
				reassignPreview: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						booking: ["read"],
					});
					const payload = input as { id: string; targetStaffUserId: string };

					if (!payload.targetStaffUserId) {
						throwRpcError(
							"MISSING_REQUIRED_FIELDS",
							422,
							"targetStaffUserId is required",
						);
					}

					const preview = await previewReassignment(
						payload.id,
						payload.targetStaffUserId,
					);
					return {
						dryRun: true,
						...preview,
					};
				}),
				reassignmentsPreview: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						booking: ["read"],
					});
					const payload = input as {
						reassignments: Array<{
							bookingId: string;
							targetStaffUserId: string;
						}>;
					};

					if (!payload.reassignments || !Array.isArray(payload.reassignments)) {
						throwRpcError(
							"MISSING_REQUIRED_FIELDS",
							422,
							"reassignments array is required",
						);
					}
					if (payload.reassignments.length === 0) {
						throwRpcError(
							"BATCH_SCOPE_REQUIRED",
							422,
							"At least one reassignment is required",
						);
					}

					const MAX_BATCH_SIZE = 100;
					if (payload.reassignments.length > MAX_BATCH_SIZE) {
						throwRpcError(
							"BATCH_LIMIT_EXCEEDED",
							422,
							`Maximum batch size is ${MAX_BATCH_SIZE}`,
						);
					}

					const bookingIds = payload.reassignments.map((r) => r.bookingId);
					const uniqueBookingIds = new Set(bookingIds);
					if (bookingIds.length !== uniqueBookingIds.size) {
						throwRpcError(
							"INVALID_SCOPE",
							422,
							"Duplicate bookingId values in batch",
						);
					}

					const preview = await previewReassignments(
						payload.reassignments.map((r) => ({
							bookingId: r.bookingId,
							targetStaffUserId: r.targetStaffUserId,
						})),
					);

					return {
						dryRun: true,
						...preview,
					};
				}),
				reassignmentsApply: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						booking: ["read"],
					});
					const payload = input as {
						reassignments: Array<{
							bookingId: string;
							targetStaffUserId: string;
						}>;
						executionMode?: "best_effort" | "atomic";
						previewToken?: string;
					};

					if (!payload.reassignments || !Array.isArray(payload.reassignments)) {
						throwRpcError(
							"MISSING_REQUIRED_FIELDS",
							422,
							"reassignments array is required",
						);
					}
					if (payload.reassignments.length === 0) {
						throwRpcError(
							"BATCH_SCOPE_REQUIRED",
							422,
							"At least one reassignment is required",
						);
					}

					const MAX_BATCH_SIZE = 100;
					if (payload.reassignments.length > MAX_BATCH_SIZE) {
						throwRpcError(
							"BATCH_LIMIT_EXCEEDED",
							422,
							`Maximum batch size is ${MAX_BATCH_SIZE}`,
						);
					}

					const bookingIds = payload.reassignments.map((r) => r.bookingId);
					const uniqueBookingIds = new Set(bookingIds);
					if (bookingIds.length !== uniqueBookingIds.size) {
						throwRpcError(
							"INVALID_SCOPE",
							422,
							"Duplicate bookingId values in batch",
						);
					}

					const executionMode = payload.executionMode ?? "best_effort";
					if (!["best_effort", "atomic"].includes(executionMode)) {
						throwRpcError(
							"INVALID_EXECUTION_MODE",
							422,
							"executionMode must be 'best_effort' or 'atomic'",
						);
					}

					const result = await executeBulkReassignments(
						payload.reassignments.map((r) => ({
							bookingId: r.bookingId,
							targetStaffUserId: r.targetStaffUserId,
						})),
						executionMode,
						payload.previewToken,
					);

					if (
						result.results.length > 0 &&
						result.results[0].error === "PREVIEW_STALE"
					) {
						throwRpcError(
							"PREVIEW_STALE",
							409,
							"Preview has expired or state has changed since preview",
							result,
						);
					}

					return result;
				}),
				availabilityCheck: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						booking: ["read"],
					});
					const payload = input as { slotId: string; staffUserId: string };

					if (!payload.slotId || !payload.staffUserId) {
						throwRpcError(
							"MISSING_REQUIRED_FIELDS",
							422,
							"slotId and staffUserId query parameters are required",
						);
					}

					return await checkCapacity(payload.slotId, payload.staffUserId);
				}),
			},
			reservationSeries: {
				create: rpc.handler(async ({ context, input }) => {
					const session = await requireAdminAccess(context.headers, {
						"reservation-series": ["read"],
					});
					const body = (input ?? {}) as {
						recurrenceRule?: RecurrenceRule | string;
						slotId?: string;
						staffUserId?: string;
						startDate?: string;
						endDate?: string;
						timezone?: string;
						notes?: string | null;
						metadata?: Record<string, unknown>;
					};
					const idempotencyKey = parseIdempotencyKey(
						context.headers.get("idempotency-key"),
					);
					const idempotencyPayload = body;

					if (idempotencyKey) {
						const check = await checkIdempotencyKey(
							idempotencyKey,
							"create_series",
							null,
							hashPayload(idempotencyPayload),
						);
						if (check.exists) {
							if (check.conflict) {
								throwRpcError(
									"IDEMPOTENCY_KEY_CONFLICT",
									409,
									"Idempotency-Key was already used with a different payload",
								);
							}
							return resolveCachedIdempotencyResponse(check.response);
						}
					}

					if (!body.recurrenceRule) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "create_series",
							targetId: null,
							payload: idempotencyPayload,
							code: "MISSING_REQUIRED_FIELDS",
							status: 422,
							message: "recurrenceRule is required",
						});
					}
					if (!body.slotId) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "create_series",
							targetId: null,
							payload: idempotencyPayload,
							code: "MISSING_REQUIRED_FIELDS",
							status: 422,
							message: "slotId is required",
						});
					}
					if (!body.staffUserId) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "create_series",
							targetId: null,
							payload: idempotencyPayload,
							code: "MISSING_REQUIRED_FIELDS",
							status: 422,
							message: "staffUserId is required",
						});
					}
					if (!body.startDate || !body.endDate) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "create_series",
							targetId: null,
							payload: idempotencyPayload,
							code: "MISSING_REQUIRED_FIELDS",
							status: 422,
							message: "startDate and endDate are required",
						});
					}
					const startDate = body.startDate ?? "";
					const endDate = body.endDate ?? "";
					const slotId = body.slotId ?? "";
					const staffUserId = body.staffUserId ?? "";

					if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "create_series",
							targetId: null,
							payload: idempotencyPayload,
							code: "INVALID_DATE",
							status: 422,
							message: "startDate must be YYYY-MM-DD",
						});
					}
					if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "create_series",
							targetId: null,
							payload: idempotencyPayload,
							code: "INVALID_DATE",
							status: 422,
							message: "endDate must be YYYY-MM-DD",
						});
					}
					if (endDate < startDate) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "create_series",
							targetId: null,
							payload: idempotencyPayload,
							code: "INVALID_DATE",
							status: 422,
							message: "endDate must be >= startDate",
						});
					}

					const baseSlot = await db.query.appointmentSlot.findFirst({
						where: eq(schema.appointmentSlot.id, slotId),
					});
					if (!baseSlot) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "create_series",
							targetId: null,
							payload: idempotencyPayload,
							code: "NOT_FOUND",
							status: 404,
							message: "Base slot not found",
						});
					}

					const staff = await db.query.staffProfile.findFirst({
						where: eq(schema.staffProfile.userId, staffUserId),
					});
					if (!staff) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "create_series",
							targetId: null,
							payload: idempotencyPayload,
							code: "NOT_FOUND",
							status: 404,
							message: "Staff profile not found",
						});
					}

					const rule =
						typeof body.recurrenceRule === "string"
							? parseRRule(body.recurrenceRule)
							: body.recurrenceRule;

					if (
						!rule ||
						!["daily", "weekly", "biweekly", "monthly"].includes(rule.frequency)
					) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "create_series",
							targetId: null,
							payload: idempotencyPayload,
							code: "INVALID_RULE",
							status: 422,
							message: "frequency must be daily/weekly/biweekly/monthly",
						});
					}
					const recurrenceRule: RecurrenceRule = rule ?? {
						frequency: "daily",
					};
					const baseSlotRecord = baseSlot as NonNullable<typeof baseSlot>;

					const timezone = body.timezone || "America/Bogota";
					const existingBookings = await db.query.booking.findMany({
						where: and(
							eq(schema.booking.staffUserId, staffUserId),
							eq(schema.booking.isActive, true),
						),
					});
					const existingSlotIds = existingBookings.map(
						(booking) => booking.slotId,
					);
					const existingSlots =
						existingSlotIds.length > 0
							? await db.query.appointmentSlot.findMany({
									where: sql`${schema.appointmentSlot.id} IN ${existingSlotIds}`,
								})
							: [];
					const existingOccurrenceKeys = new Set(
						existingSlots.map((slot) => `${slot.slotDate}|${slot.startTime}`),
					);

					const occurrences = generateOccurrences(
						recurrenceRule,
						startDate,
						endDate,
						existingOccurrenceKeys,
						baseSlotRecord.startTime,
					);
					if (occurrences.length === 0) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "create_series",
							targetId: null,
							payload: idempotencyPayload,
							code: "NO_OCCURRENCES",
							status: 422,
							message: "No valid occurrences in date range",
						});
					}

					const slotIds: string[] = [];
					for (const date of occurrences) {
						let slot = await db.query.appointmentSlot.findFirst({
							where: and(
								eq(schema.appointmentSlot.slotDate, date),
								eq(schema.appointmentSlot.startTime, baseSlotRecord.startTime),
							),
						});

						if (!slot) {
							const newSlotId = crypto.randomUUID();
							const now = new Date();
							await db.insert(schema.appointmentSlot).values({
								id: newSlotId,
								slotDate: date,
								startTime: baseSlotRecord.startTime,
								endTime: baseSlotRecord.endTime,
								status: "open",
								capacityLimit: baseSlotRecord.capacityLimit,
								generatedFrom: "series",
								metadata: { seriesId: "pending" },
								createdAt: now,
								updatedAt: now,
							});

							slot = await db.query.appointmentSlot.findFirst({
								where: eq(schema.appointmentSlot.id, newSlotId),
							});
						}

						if (slot) slotIds.push(slot.id);
					}

					const seriesId = crypto.randomUUID();
					const now = new Date();
					await db.insert(schema.bookingSeries).values({
						id: seriesId,
						kind: "administrative",
						recurrenceRule: recurrenceRule as unknown as Record<
							string,
							unknown
						>,
						timezone,
						isActive: true,
						metadata: body.metadata ?? {},
						notes: body.notes ?? null,
						createdByUserId: session.user.id,
						createdAt: now,
						updatedAt: now,
					});

					const createdBookingIds: string[] = [];
					const conflicts: CapacityConflict[] = [];
					for (const slotId of slotIds) {
						const result = await consumeCapacity(
							slotId,
							staffUserId,
							"administrative",
							null,
							null,
							session.user.id,
							null,
							null,
						);

						if (!result.success) {
							conflicts.push(...result.conflicts);
						} else if (result.bookingId) {
							createdBookingIds.push(result.bookingId);
							await db
								.update(schema.booking)
								.set({ seriesKey: seriesId, updatedAt: new Date() })
								.where(eq(schema.booking.id, result.bookingId));
						}
					}

					if (conflicts.length > 0 && createdBookingIds.length === 0) {
						await db
							.delete(schema.bookingSeries)
							.where(eq(schema.bookingSeries.id, seriesId));

						if (idempotencyKey) {
							await storeIdempotencyKey(
								idempotencyKey,
								"create_series",
								null,
								hashPayload(idempotencyPayload),
								409,
								{
									code: "CAPACITY_CONFLICT",
									message: "Insufficient capacity for this operation",
									conflicts,
								},
							);
						}
						throwCapacityConflict(conflicts);
					}

					const series = await db.query.bookingSeries.findFirst({
						where: eq(schema.bookingSeries.id, seriesId),
					});
					const responseBody = {
						series,
						instanceCount: createdBookingIds.length,
						bookingIds: createdBookingIds,
						warnings:
							conflicts.length > 0
								? [
										"Some instances could not be created due to capacity conflicts",
									]
								: [],
					};

					if (idempotencyKey) {
						await storeIdempotencyKey(
							idempotencyKey,
							"create_series",
							null,
							hashPayload(idempotencyPayload),
							201,
							responseBody,
						);
					}

					return responseBody;
				}),
				list: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						"reservation-series": ["read"],
					});
					const payload = (input ?? {}) as {
						isActive?: boolean | string;
						kind?: string;
					};

					const conditions = [];
					const isActive = parseBooleanLike(payload.isActive);
					if (payload.isActive !== undefined && isActive !== undefined) {
						conditions.push(eq(schema.bookingSeries.isActive, isActive));
					}
					if (payload.kind) {
						conditions.push(eq(schema.bookingSeries.kind, payload.kind));
					}

					let seriesList: Awaited<
						ReturnType<typeof db.query.bookingSeries.findMany>
					>;
					if (conditions.length > 0) {
						seriesList = await db.query.bookingSeries.findMany({
							where: and(...conditions),
						});
					} else {
						seriesList = await db.query.bookingSeries.findMany();
					}

					return await Promise.all(
						seriesList.map(async (series) => {
							const bookings = await db.query.booking.findMany({
								where: and(
									eq(schema.booking.seriesKey, series.id),
									eq(schema.booking.isActive, true),
								),
							});

							return {
								...series,
								activeInstanceCount: bookings.length,
							};
						}),
					);
				}),
				get: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						"reservation-series": ["read"],
					});
					const payload = input as { id: string };

					const series = await db.query.bookingSeries.findFirst({
						where: eq(schema.bookingSeries.id, payload.id),
					});
					if (!series) {
						throwRpcError("NOT_FOUND", 404, "Series not found");
					}

					const bookings = await db.query.booking.findMany({
						where: eq(schema.booking.seriesKey, payload.id),
					});
					const instances = await Promise.all(
						bookings.map(async (booking) => {
							const slot = await db.query.appointmentSlot.findFirst({
								where: eq(schema.appointmentSlot.id, booking.slotId),
							});
							return { ...booking, slot };
						}),
					);

					return { series, instances };
				}),
				instances: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						"reservation-series": ["read"],
					});
					const payload = input as {
						id: string;
						status?: string;
						isActive?: boolean | string;
					};

					const conditions = [eq(schema.booking.seriesKey, payload.id)];
					if (payload.status) {
						conditions.push(eq(schema.booking.status, payload.status));
					}
					const isActive = parseBooleanLike(payload.isActive);
					if (payload.isActive !== undefined && isActive !== undefined) {
						conditions.push(eq(schema.booking.isActive, isActive));
					}

					const bookings = await db.query.booking.findMany({
						where: and(...conditions),
					});
					return await Promise.all(
						bookings.map(async (booking) => {
							const slot = await db.query.appointmentSlot.findFirst({
								where: eq(schema.appointmentSlot.id, booking.slotId),
							});
							return { ...booking, slot };
						}),
					);
				}),
				update: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						"reservation-series": ["read"],
					});
					const payload = input as {
						id: string;
						staffUserId?: string;
						notes?: string | null;
						metadata?: Record<string, unknown>;
						force?: boolean;
					};
					const ifMatch = parseIfMatch(context.headers.get("if-match"));

					const series = await db.query.bookingSeries.findFirst({
						where: eq(schema.bookingSeries.id, payload.id),
					});
					if (!series) {
						throwRpcError("NOT_FOUND", 404, "Series not found");
					}
					assertOptimisticConcurrency(series.updatedAt, ifMatch);

					const activeBookings = await db.query.booking.findMany({
						where: and(
							eq(schema.booking.seriesKey, payload.id),
							eq(schema.booking.isActive, true),
						),
					});

					const forceUpdate = payload.force === true;
					const toUpdate = activeBookings.filter((booking) => {
						if (forceUpdate) return true;
						const snapshot = booking.snapshot as Record<string, unknown> | null;
						return !snapshot?.detached;
					});

					const updatedIds: string[] = [];
					const now = new Date();

					if (payload.staffUserId !== undefined) {
						const targetStaff = await db.query.staffProfile.findFirst({
							where: eq(schema.staffProfile.userId, payload.staffUserId),
						});
						if (!targetStaff) {
							throwRpcError("NOT_FOUND", 404, "Target staff profile not found");
						}

						const reassignmentConflicts: Array<{
							bookingId: string;
							conflicts: CapacityConflict[];
						}> = [];

						for (const booking of toUpdate) {
							if (booking.staffUserId === payload.staffUserId) continue;
							const capacityCheck = await checkCapacity(
								booking.slotId,
								payload.staffUserId,
							);
							const conflicts = capacityCheck.conflicts.filter(
								(conflict) => conflict.type !== "GLOBAL_OVER_CAPACITY",
							);
							if (conflicts.length > 0) {
								reassignmentConflicts.push({
									bookingId: booking.id,
									conflicts,
								});
							}
						}

						if (reassignmentConflicts.length > 0) {
							throwRpcError(
								"CAPACITY_CONFLICT",
								409,
								"Cannot update series staff assignment due to staff availability/capacity conflicts",
								{ conflicts: reassignmentConflicts },
							);
						}
					}

					if (payload.staffUserId !== undefined) {
						for (const booking of toUpdate) {
							await db
								.update(schema.booking)
								.set({
									staffUserId: payload.staffUserId,
									updatedAt: now,
								})
								.where(eq(schema.booking.id, booking.id));
							updatedIds.push(booking.id);
						}
					}

					if (payload.notes !== undefined) {
						for (const booking of toUpdate) {
							await db
								.update(schema.booking)
								.set({
									notes: payload.notes,
									updatedAt: now,
								})
								.where(eq(schema.booking.id, booking.id));
						}
					}

					if (payload.metadata !== undefined) {
						const currentMetadata =
							(series.metadata as Record<string, unknown>) || {};
						await db
							.update(schema.bookingSeries)
							.set({
								metadata: { ...currentMetadata, ...payload.metadata },
								updatedAt: now,
							})
							.where(eq(schema.bookingSeries.id, payload.id));
					}

					return {
						seriesId: payload.id,
						updatedCount: updatedIds.length,
						skippedCount: activeBookings.length - toUpdate.length,
						updatedInstanceIds: updatedIds,
					};
				}),
				updateFromDate: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						"reservation-series": ["read"],
					});
					const payload = input as {
						id: string;
						effectiveFrom?: string;
						staffUserId?: string;
						notes?: string | null;
					};

					if (!payload.effectiveFrom) {
						throwRpcError(
							"MISSING_REQUIRED_FIELDS",
							422,
							"effectiveFrom is required (YYYY-MM-DD)",
						);
					}
					if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.effectiveFrom)) {
						throwRpcError(
							"INVALID_DATE",
							422,
							"effectiveFrom must be YYYY-MM-DD",
						);
					}

					const series = await db.query.bookingSeries.findFirst({
						where: eq(schema.bookingSeries.id, payload.id),
					});
					if (!series) {
						throwRpcError("NOT_FOUND", 404, "Series not found");
					}

					const timezone = series.timezone || "America/Bogota";
					const effectiveFrom = payload.effectiveFrom ?? "";
					const activeBookings = await db.query.booking.findMany({
						where: and(
							eq(schema.booking.seriesKey, payload.id),
							eq(schema.booking.isActive, true),
						),
					});

					const slotIds = activeBookings.map((booking) => booking.slotId);
					const slots =
						slotIds.length > 0
							? await db.query.appointmentSlot.findMany({
									where: sql`${schema.appointmentSlot.id} IN ${slotIds}`,
								})
							: [];
					const slotDateMap = new Map(
						slots.map((slot) => [slot.id, slot.slotDate]),
					);

					const toUpdate = activeBookings.filter((booking) => {
						const slotDate = slotDateMap.get(booking.slotId);
						if (!slotDate) return false;
						return isDateOnOrAfter(slotDate, effectiveFrom, timezone);
					});

					const updatedIds: string[] = [];
					const now = new Date();

					if (payload.staffUserId !== undefined) {
						const targetStaff = await db.query.staffProfile.findFirst({
							where: eq(schema.staffProfile.userId, payload.staffUserId),
						});
						if (!targetStaff) {
							throwRpcError("NOT_FOUND", 404, "Target staff profile not found");
						}

						const reassignmentConflicts: Array<{
							bookingId: string;
							conflicts: CapacityConflict[];
						}> = [];
						for (const booking of toUpdate) {
							if (booking.staffUserId === payload.staffUserId) continue;
							const capacityCheck = await checkCapacity(
								booking.slotId,
								payload.staffUserId,
							);
							const conflicts = capacityCheck.conflicts.filter(
								(conflict) => conflict.type !== "GLOBAL_OVER_CAPACITY",
							);
							if (conflicts.length > 0) {
								reassignmentConflicts.push({
									bookingId: booking.id,
									conflicts,
								});
							}
						}

						if (reassignmentConflicts.length > 0) {
							throwRpcError(
								"CAPACITY_CONFLICT",
								409,
								"Cannot update series staff assignment due to staff availability/capacity conflicts",
								{ conflicts: reassignmentConflicts },
							);
						}
					}

					if (payload.staffUserId !== undefined) {
						for (const booking of toUpdate) {
							await db
								.update(schema.booking)
								.set({
									staffUserId: payload.staffUserId,
									updatedAt: now,
								})
								.where(eq(schema.booking.id, booking.id));
							updatedIds.push(booking.id);
						}
					}

					if (payload.notes !== undefined) {
						for (const booking of toUpdate) {
							await db
								.update(schema.booking)
								.set({
									notes: payload.notes,
									updatedAt: now,
								})
								.where(eq(schema.booking.id, booking.id));
						}
					}

					return {
						seriesId: payload.id,
						effectiveFrom: payload.effectiveFrom,
						updatedCount: updatedIds.length,
						updatedInstanceIds: updatedIds,
					};
				}),
				release: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						"reservation-series": ["read"],
					});
					const payload = input as { id: string; reason?: string };
					const idempotencyKey = parseIdempotencyKey(
						context.headers.get("idempotency-key"),
					);
					const idempotencyPayload = {
						seriesId: payload.id,
						reason: payload.reason,
					};

					if (idempotencyKey) {
						const check = await checkIdempotencyKey(
							idempotencyKey,
							"release_series",
							payload.id,
							hashPayload(idempotencyPayload),
						);
						if (check.exists) {
							if (check.conflict) {
								throwRpcError(
									"IDEMPOTENCY_KEY_CONFLICT",
									409,
									"Idempotency-Key was already used with a different payload",
								);
							}
							return resolveCachedIdempotencyResponse(check.response);
						}
					}

					const series = await db.query.bookingSeries.findFirst({
						where: eq(schema.bookingSeries.id, payload.id),
					});
					if (!series) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "release_series",
							targetId: payload.id,
							payload: idempotencyPayload,
							code: "NOT_FOUND",
							status: 404,
							message: "Series not found",
						});
					}

					const activeBookings = await db.query.booking.findMany({
						where: and(
							eq(schema.booking.seriesKey, payload.id),
							eq(schema.booking.isActive, true),
						),
					});

					const releasedIds: string[] = [];
					for (const booking of activeBookings) {
						const result = await releaseCapacity(
							booking.id,
							(payload.reason ?? "cancelled") as
								| "cancelled"
								| "expired"
								| "attended",
						);
						if (result.success) releasedIds.push(booking.id);
					}

					await db
						.update(schema.bookingSeries)
						.set({
							isActive: false,
							updatedAt: new Date(),
						})
						.where(eq(schema.bookingSeries.id, payload.id));

					const responseBody = {
						seriesId: payload.id,
						releasedCount: releasedIds.length,
						releasedInstanceIds: releasedIds,
					};

					if (idempotencyKey) {
						await storeIdempotencyKey(
							idempotencyKey,
							"release_series",
							payload.id,
							hashPayload(idempotencyPayload),
							200,
							responseBody,
						);
					}

					return responseBody;
				}),
				move: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						"reservation-series": ["read"],
					});
					const payload = input as {
						id: string;
						targetSlotId?: string;
						targetStaffUserId?: string;
					};
					const idempotencyKey = parseIdempotencyKey(
						context.headers.get("idempotency-key"),
					);
					const idempotencyPayload = {
						seriesId: payload.id,
						targetSlotId: payload.targetSlotId,
						targetStaffUserId: payload.targetStaffUserId,
					};

					if (idempotencyKey) {
						const check = await checkIdempotencyKey(
							idempotencyKey,
							"move_series",
							payload.id,
							hashPayload(idempotencyPayload),
						);
						if (check.exists) {
							if (check.conflict) {
								throwRpcError(
									"IDEMPOTENCY_KEY_CONFLICT",
									409,
									"Idempotency-Key was already used with a different payload",
								);
							}
							return resolveCachedIdempotencyResponse(check.response);
						}
					}

					if (!payload.targetSlotId) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "move_series",
							targetId: payload.id,
							payload: idempotencyPayload,
							code: "MISSING_REQUIRED_FIELDS",
							status: 422,
							message: "targetSlotId is required",
						});
					}
					const targetSlotId = payload.targetSlotId ?? "";

					const series = await db.query.bookingSeries.findFirst({
						where: eq(schema.bookingSeries.id, payload.id),
					});
					if (!series) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "move_series",
							targetId: payload.id,
							payload: idempotencyPayload,
							code: "NOT_FOUND",
							status: 404,
							message: "Series not found",
						});
					}

					const targetSlot = await db.query.appointmentSlot.findFirst({
						where: eq(schema.appointmentSlot.id, targetSlotId),
					});
					if (!targetSlot) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "move_series",
							targetId: payload.id,
							payload: idempotencyPayload,
							code: "NOT_FOUND",
							status: 404,
							message: "Target slot not found",
						});
					}
					const targetSlotRecord = targetSlot as NonNullable<typeof targetSlot>;

					const activeBookings = await db.query.booking.findMany({
						where: and(
							eq(schema.booking.seriesKey, payload.id),
							eq(schema.booking.isActive, true),
						),
					});
					if (activeBookings.length === 0) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "move_series",
							targetId: payload.id,
							payload: idempotencyPayload,
							code: "NO_ACTIVE_INSTANCES",
							status: 422,
							message: "Series has no active instances to move",
						});
					}

					let movedIds: string[] = [];

					try {
						movedIds = await db.transaction(async (tx) => {
							const now = new Date();
							const moved: string[] = [];

							for (const booking of activeBookings) {
								if (!booking.staffUserId) {
									throw {
										code: "INVALID_STATE",
										status: 422,
										message: "Booking has no staff assigned",
									};
								}

								const currentSlot = await tx.query.appointmentSlot.findFirst({
									where: eq(schema.appointmentSlot.id, booking.slotId),
								});
								if (!currentSlot) {
									throw {
										code: "INVALID_STATE",
										status: 422,
										message: "Current slot not found for booking",
									};
								}

								const destinationStaffUserId =
									payload.targetStaffUserId || booking.staffUserId;
								let destinationSlot = await tx.query.appointmentSlot.findFirst({
									where: and(
										eq(schema.appointmentSlot.slotDate, currentSlot.slotDate),
										eq(
											schema.appointmentSlot.startTime,
											targetSlotRecord.startTime,
										),
									),
								});

								if (!destinationSlot) {
									const destinationSlotId = crypto.randomUUID();
									await tx.insert(schema.appointmentSlot).values({
										id: destinationSlotId,
										slotDate: currentSlot.slotDate,
										startTime: targetSlotRecord.startTime,
										endTime: targetSlotRecord.endTime,
										status: "open",
										capacityLimit: targetSlotRecord.capacityLimit,
										generatedFrom: "series",
										metadata: {
											movedFromSeriesId: payload.id,
											targetSlotTemplateId: targetSlotRecord.id,
										},
										createdAt: now,
										updatedAt: now,
									});
									destinationSlot = await tx.query.appointmentSlot.findFirst({
										where: eq(schema.appointmentSlot.id, destinationSlotId),
									});
								}

								if (!destinationSlot) {
									throw {
										code: "INVALID_STATE",
										status: 422,
										message: "Failed to resolve destination slot",
									};
								}

								const globalUsed = await countActiveSlotBookings(
									tx,
									destinationSlot.id,
									booking.id,
								);
								if (
									destinationSlot.capacityLimit !== null &&
									globalUsed >= destinationSlot.capacityLimit
								) {
									throw {
										code: "CAPACITY_CONFLICT",
										status: 409,
										conflicts: [
											{
												type: "GLOBAL_OVER_CAPACITY",
												details: `Destination slot reached capacity (${destinationSlot.capacityLimit})`,
											},
										] as CapacityConflict[],
									};
								}

								const staffResolution =
									await resolveStaffAvailabilityAndCapacity(
										tx,
										destinationStaffUserId,
										destinationSlot.slotDate,
										destinationSlot.startTime,
										destinationSlot.endTime,
									);
								if (!staffResolution.available) {
									throw {
										code: "CAPACITY_CONFLICT",
										status: 409,
										conflicts: [
											{
												type: "STAFF_UNAVAILABLE",
												details:
													staffResolution.reason ??
													"Destination staff unavailable",
											},
										] as CapacityConflict[],
									};
								}

								const staffUsed = await countActiveStaffBookingsOnDate(
									tx,
									destinationStaffUserId,
									destinationSlot.slotDate,
									booking.id,
								);
								if (staffUsed >= staffResolution.staffCapacity) {
									throw {
										code: "CAPACITY_CONFLICT",
										status: 409,
										conflicts: [
											{
												type: "STAFF_OVER_CAPACITY",
												details: `Destination staff reached daily capacity (${staffResolution.staffCapacity})`,
											},
										] as CapacityConflict[],
									};
								}

								await tx
									.update(schema.booking)
									.set({
										slotId: destinationSlot.id,
										staffUserId: destinationStaffUserId,
										statusReason: "Moved by administrative series operation",
										updatedAt: now,
									})
									.where(eq(schema.booking.id, booking.id));
								moved.push(booking.id);
							}

							return moved;
						});
					} catch (err) {
						if (err && typeof err === "object" && "code" in err) {
							const errorObj = err as {
								code: string;
								status: number;
								message?: string;
								conflicts?: CapacityConflict[];
							};
							if (idempotencyKey) {
								await storeIdempotencyKey(
									idempotencyKey,
									"move_series",
									payload.id,
									hashPayload(idempotencyPayload),
									errorObj.status,
									{
										code: errorObj.code,
										message: errorObj.message ?? "Series move failed",
										conflicts: errorObj.conflicts,
									},
								);
							}

							if (errorObj.code === "CAPACITY_CONFLICT") {
								throwCapacityConflict(errorObj.conflicts ?? []);
							}
							throwRpcError(
								errorObj.code,
								errorObj.status,
								errorObj.message ?? "Series move failed",
							);
						}
						throw err;
					}

					const responseBody = {
						seriesId: payload.id,
						movedCount: movedIds.length,
						movedInstanceIds: movedIds,
						targetSlotId: payload.targetSlotId,
						targetStaffUserId: payload.targetStaffUserId,
					};

					if (idempotencyKey) {
						await storeIdempotencyKey(
							idempotencyKey,
							"move_series",
							payload.id,
							hashPayload(idempotencyPayload),
							200,
							responseBody,
						);
					}

					return responseBody;
				}),
			},
			reservations: {
				get: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						"reservation-series": ["read"],
					});
					const payload = input as { bookingId: string };

					const booking = await db.query.booking.findFirst({
						where: eq(schema.booking.id, payload.bookingId),
					});
					if (!booking) {
						throwRpcError("NOT_FOUND", 404, "Reservation not found");
					}

					const slot = await db.query.appointmentSlot.findFirst({
						where: eq(schema.appointmentSlot.id, booking.slotId),
					});
					const series = booking.seriesKey
						? await db.query.bookingSeries.findFirst({
								where: eq(schema.bookingSeries.id, booking.seriesKey),
							})
						: null;

					return { ...booking, slot, series };
				}),
				update: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						"reservation-series": ["read"],
					});
					const payload = input as {
						bookingId: string;
						staffUserId?: string;
						notes?: string | null;
					};
					const ifMatch = parseIfMatch(context.headers.get("if-match"));

					const booking = await db.query.booking.findFirst({
						where: eq(schema.booking.id, payload.bookingId),
					});
					if (!booking) {
						throwRpcError("NOT_FOUND", 404, "Reservation not found");
					}

					assertOptimisticConcurrency(booking.updatedAt, ifMatch);
					assertMutableState(booking);
					assertAdminBookingKind(booking);

					const now = new Date();
					const updates: Partial<typeof schema.booking.$inferInsert> = {
						updatedAt: now,
					};

					if (payload.staffUserId !== undefined) {
						const capacityCheck = await checkCapacity(
							booking.slotId,
							payload.staffUserId,
						);
						if (!capacityCheck.available) {
							throwCapacityConflict(capacityCheck.conflicts);
						}
						updates.staffUserId = payload.staffUserId;
					}

					if (payload.notes !== undefined) {
						updates.notes = payload.notes;
					}

					const currentSnapshot =
						(booking.snapshot as Record<string, unknown>) || {};
					updates.snapshot = {
						...currentSnapshot,
						detached: true,
						detachedAt: now.toISOString(),
						detachedFromSeries: booking.seriesKey,
					};

					await db
						.update(schema.booking)
						.set(updates)
						.where(eq(schema.booking.id, payload.bookingId));

					return await db.query.booking.findFirst({
						where: eq(schema.booking.id, payload.bookingId),
					});
				}),
				release: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						"reservation-series": ["read"],
					});
					const payload = input as { bookingId: string; reason?: string };
					const idempotencyKey = parseIdempotencyKey(
						context.headers.get("idempotency-key"),
					);
					const idempotencyPayload = {
						bookingId: payload.bookingId,
						reason: payload.reason,
					};

					if (idempotencyKey) {
						const check = await checkIdempotencyKey(
							idempotencyKey,
							"release",
							payload.bookingId,
							hashPayload(idempotencyPayload),
						);
						if (check.exists) {
							if (check.conflict) {
								throwRpcError(
									"IDEMPOTENCY_KEY_CONFLICT",
									409,
									"Idempotency-Key was already used with a different payload",
								);
							}
							return resolveCachedIdempotencyResponse(check.response);
						}
					}

					const booking = await db.query.booking.findFirst({
						where: eq(schema.booking.id, payload.bookingId),
					});
					if (!booking) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "release",
							targetId: payload.bookingId,
							payload: idempotencyPayload,
							code: "NOT_FOUND",
							status: 404,
							message: "Reservation not found",
						});
					}
					const bookingRecord = booking as NonNullable<typeof booking>;

					if (
						!payload.reason ||
						!["cancelled", "expired", "attended"].includes(payload.reason)
					) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "release",
							targetId: payload.bookingId,
							payload: idempotencyPayload,
							code: "INVALID_REASON",
							status: 422,
							message: "reason must be 'cancelled', 'expired', or 'attended'",
						});
					}

					try {
						assertAdminBookingKind(bookingRecord);
						assertMutableState(bookingRecord);
					} catch (error) {
						if (idempotencyKey && error instanceof ORPCError) {
							await storeIdempotencyKey(
								idempotencyKey,
								"release",
								payload.bookingId,
								hashPayload(idempotencyPayload),
								error.status,
								{ code: error.code, message: error.message },
							);
						}
						throw error;
					}

					const result = await releaseCapacity(
						payload.bookingId,
						payload.reason as "cancelled" | "expired" | "attended",
					);

					if (!result.success && !result.alreadyReleased) {
						const code =
							result.error === "Booking not found"
								? "NOT_FOUND"
								: "RELEASE_FAILED";
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "release",
							targetId: payload.bookingId,
							payload: idempotencyPayload,
							code,
							status: code === "NOT_FOUND" ? 404 : 422,
							message: result.error ?? "Unknown error",
						});
					}

					const updated = await db.query.booking.findFirst({
						where: eq(schema.booking.id, payload.bookingId),
					});
					if (!updated) {
						throwRpcError("NOT_FOUND", 404, "Reservation not found");
					}
					const responseBody = {
						booking: updated,
						alreadyReleased: result.alreadyReleased,
					};

					if (idempotencyKey) {
						await storeIdempotencyKey(
							idempotencyKey,
							"release",
							payload.bookingId,
							hashPayload(idempotencyPayload),
							200,
							responseBody,
						);
					}

					return responseBody;
				}),
				move: rpc.handler(async ({ context, input }) => {
					await requireAdminAccess(context.headers, {
						"reservation-series": ["read"],
					});
					const payload = input as {
						bookingId: string;
						targetSlotId?: string;
						targetStaffUserId?: string;
					};
					const idempotencyKey = parseIdempotencyKey(
						context.headers.get("idempotency-key"),
					);
					const idempotencyPayload = {
						bookingId: payload.bookingId,
						targetSlotId: payload.targetSlotId,
						targetStaffUserId: payload.targetStaffUserId,
					};

					if (idempotencyKey) {
						const check = await checkIdempotencyKey(
							idempotencyKey,
							"move",
							payload.bookingId,
							hashPayload(idempotencyPayload),
						);
						if (check.exists) {
							if (check.conflict) {
								throwRpcError(
									"IDEMPOTENCY_KEY_CONFLICT",
									409,
									"Idempotency-Key was already used with a different payload",
								);
							}
							return resolveCachedIdempotencyResponse(check.response);
						}
					}

					if (!payload.targetSlotId) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "move",
							targetId: payload.bookingId,
							payload: idempotencyPayload,
							code: "MISSING_REQUIRED_FIELDS",
							status: 422,
							message: "targetSlotId is required",
						});
					}
					const targetSlotId = payload.targetSlotId ?? "";

					const booking = await db.query.booking.findFirst({
						where: eq(schema.booking.id, payload.bookingId),
					});
					if (!booking) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "move",
							targetId: payload.bookingId,
							payload: idempotencyPayload,
							code: "NOT_FOUND",
							status: 404,
							message: "Reservation not found",
						});
					}
					const bookingRecord = booking as NonNullable<typeof booking>;

					try {
						assertMutableState(bookingRecord);
						assertAdminBookingKind(bookingRecord);
					} catch (error) {
						if (idempotencyKey && error instanceof ORPCError) {
							await storeIdempotencyKey(
								idempotencyKey,
								"move",
								payload.bookingId,
								hashPayload(idempotencyPayload),
								error.status,
								{ code: error.code, message: error.message },
							);
						}
						throw error;
					}

					const targetSlot = await db.query.appointmentSlot.findFirst({
						where: eq(schema.appointmentSlot.id, targetSlotId),
					});
					if (!targetSlot) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "move",
							targetId: payload.bookingId,
							payload: idempotencyPayload,
							code: "NOT_FOUND",
							status: 404,
							message: "Target slot not found",
						});
					}

					if (!bookingRecord.staffUserId) {
						await throwIdempotencyAwareError({
							key: idempotencyKey,
							operation: "move",
							targetId: payload.bookingId,
							payload: idempotencyPayload,
							code: "INVALID_STATE",
							status: 422,
							message: "Booking has no staff assigned",
						});
					}

					const currentStaffUserId = bookingRecord.staffUserId ?? "";
					const staffUserId = payload.targetStaffUserId || currentStaffUserId;

					try {
						await db.transaction(async (tx) => {
							const currentBooking = await tx.query.booking.findFirst({
								where: eq(schema.booking.id, payload.bookingId),
							});

							if (!currentBooking?.isActive) {
								throw {
									code: "BOOKING_NOT_MUTABLE",
									status: 409,
									message: "Reservation is no longer mutable",
								};
							}

							const destinationSlot = await tx.query.appointmentSlot.findFirst({
								where: eq(schema.appointmentSlot.id, targetSlotId),
							});
							if (!destinationSlot) {
								throw {
									code: "NOT_FOUND",
									status: 404,
									message: "Target slot not found",
								};
							}

							const globalUsed = await countActiveSlotBookings(
								tx,
								destinationSlot.id,
								currentBooking.id,
							);
							if (
								destinationSlot.capacityLimit !== null &&
								globalUsed >= destinationSlot.capacityLimit
							) {
								throw {
									code: "CAPACITY_CONFLICT",
									status: 409,
									conflicts: [
										{
											type: "GLOBAL_OVER_CAPACITY",
											details: `Destination slot reached capacity (${destinationSlot.capacityLimit})`,
										},
									] as CapacityConflict[],
								};
							}

							const staffResolution = await resolveStaffAvailabilityAndCapacity(
								tx,
								staffUserId,
								destinationSlot.slotDate,
								destinationSlot.startTime,
								destinationSlot.endTime,
							);
							if (!staffResolution.available) {
								throw {
									code: "CAPACITY_CONFLICT",
									status: 409,
									conflicts: [
										{
											type: "STAFF_UNAVAILABLE",
											details:
												staffResolution.reason ??
												"Destination staff unavailable",
										},
									] as CapacityConflict[],
								};
							}

							const staffUsed = await countActiveStaffBookingsOnDate(
								tx,
								staffUserId,
								destinationSlot.slotDate,
								currentBooking.id,
							);
							if (staffUsed >= staffResolution.staffCapacity) {
								throw {
									code: "CAPACITY_CONFLICT",
									status: 409,
									conflicts: [
										{
											type: "STAFF_OVER_CAPACITY",
											details: `Destination staff reached daily capacity (${staffResolution.staffCapacity})`,
										},
									] as CapacityConflict[],
								};
							}

							await tx
								.update(schema.booking)
								.set({
									slotId: destinationSlot.id,
									staffUserId,
									statusReason: "Moved by administrative instance operation",
									updatedAt: new Date(),
								})
								.where(eq(schema.booking.id, payload.bookingId));
						});
					} catch (err) {
						if (err && typeof err === "object" && "code" in err) {
							const errorObj = err as {
								code: string;
								status: number;
								message?: string;
								conflicts?: CapacityConflict[];
							};

							if (idempotencyKey) {
								await storeIdempotencyKey(
									idempotencyKey,
									"move",
									payload.bookingId,
									hashPayload(idempotencyPayload),
									errorObj.status,
									{
										code: errorObj.code,
										message: errorObj.message ?? "Reservation move failed",
										conflicts: errorObj.conflicts,
									},
								);
							}

							if (errorObj.code === "CAPACITY_CONFLICT") {
								throwCapacityConflict(errorObj.conflicts ?? []);
							}
							throwRpcError(
								errorObj.code,
								errorObj.status,
								errorObj.message ?? "Reservation move failed",
							);
						}
						throw err;
					}

					const updated = await db.query.booking.findFirst({
						where: eq(schema.booking.id, payload.bookingId),
					});
					if (!updated) {
						throwRpcError("NOT_FOUND", 404, "Reservation not found");
					}

					if (idempotencyKey) {
						await storeIdempotencyKey(
							idempotencyKey,
							"move",
							payload.bookingId,
							hashPayload(idempotencyPayload),
							200,
							updated,
						);
					}

					return updated;
				}),
			},
		},
	};
}
