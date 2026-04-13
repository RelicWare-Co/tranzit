import { and, eq, sql } from "drizzle-orm";
import {
	isValidDateFormat as isValidScheduleDateFormat,
	isValidTimeFormat as isValidScheduleTimeFormat,
	isValidTimeWindow as isValidScheduleTimeWindow,
	isValidWeekday,
	parseNonNegativeInteger,
	parsePositiveInteger,
	WEEKDAY_MAX,
	WEEKDAY_MIN,
} from "../../features/schedule/schedule.schemas";
import {
	formatDateLocal,
	generateSlotsForWindow,
	getEffectiveSchedule,
} from "../../features/schedule/schedule.service";
import { db, schema } from "../../lib/db";
import { rpc } from "../context";
import { requireAdminAccess, throwRpcError } from "../shared";

export function createScheduleRouter() {
	return {
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

				const { morningStart, morningEnd, afternoonStart, afternoonEnd } = body;
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

				const updates: Partial<typeof schema.scheduleTemplate.$inferInsert> = {
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

					const othersWithWeekday = await db.query.scheduleTemplate.findFirst({
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
					const bufferMinutes = parseNonNegativeInteger(payload.bufferMinutes);
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
					where: eq(schema.calendarOverride.overrideDate, body.overrideDate),
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

				if (body.bufferMinutes !== undefined && body.bufferMinutes !== null) {
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

				const { morningStart, morningEnd, afternoonStart, afternoonEnd } = body;
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
							eq(schema.calendarOverride.overrideDate, payload.overrideDate),
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
				const effectiveMorningEnd = payload.morningEnd ?? existing.morningEnd;
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

				const updates: Partial<typeof schema.calendarOverride.$inferInsert> = {
					updatedAt: new Date(),
				};

				if (payload.overrideDate !== undefined) {
					updates.overrideDate = payload.overrideDate;
				}
				if (payload.isClosed !== undefined) updates.isClosed = payload.isClosed;
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
				const errors: { date: string; code: string; message: string }[] = [];

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
						existingSlots.map((slot) => `${slot.startTime}-${slot.endTime}`),
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
						(slot) => !existingKeySet.has(`${slot.startTime}-${slot.endTime}`),
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
					(slot) => !existingKeySet.has(`${slot.startTime}-${slot.endTime}`),
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
									slot.capacityLimit - (bookingCountBySlot.get(slot.id) ?? 0),
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
	};
}
