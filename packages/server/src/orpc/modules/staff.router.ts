import { and, eq } from "drizzle-orm";
import {
	buildStaffSummary,
	createAuditEvent,
} from "../../features/audit/audit.service";
import {
	isValidDateFormat as isValidStaffDateFormat,
	isValidTimeFormat as isValidStaffTimeFormat,
	isValidTimeWindow as isValidStaffTimeWindow,
	validateWeeklyAvailability,
} from "../../features/staff/staff.schemas";
import { db, schema } from "../../lib/db";
import { rpc } from "../context";
import { requireAdminAccess, throwRpcError } from "../shared";

function parseDefaultCapacity(value: unknown): number {
	const capacity = Number(value);
	if (!Number.isInteger(capacity) || capacity <= 0) {
		throwRpcError(
			"INVALID_CAPACITY",
			422,
			"defaultDailyCapacity must be a positive integer",
		);
	}
	return capacity;
}

function validateBooleanField(
	value: unknown,
	fieldName: string,
): asserts value is boolean {
	if (value !== undefined && typeof value !== "boolean") {
		throwRpcError("INVALID_FIELD_TYPE", 422, `${fieldName} must be a boolean`);
	}
}

export function createStaffRouter() {
	return {
		list: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				staff: ["read"],
			});
			const payload = (input ?? {}) as { isActive?: boolean | string };

			let profiles: Awaited<ReturnType<typeof db.query.staffProfile.findMany>>;
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
			const session = await requireAdminAccess(context.headers, {
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

			const parsedDefaultCapacity =
				body.defaultDailyCapacity !== undefined
					? parseDefaultCapacity(body.defaultDailyCapacity)
					: undefined;

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

			// Create audit event for staff creation
			await createAuditEvent({
				actorType: "admin",
				actorUserId: session.user.id,
				entityType: "staff_profile",
				entityId: body.userId,
				action: "create",
				summary: buildStaffSummary("profile created", {
					staffName: staffUser.name,
				}),
				payload: {
					userId: body.userId,
					isActive: body.isActive ?? true,
					isAssignable: body.isAssignable ?? true,
					defaultDailyCapacity: parsedDefaultCapacity ?? 25,
				},
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
			const session = await requireAdminAccess(context.headers, {
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

			const parsedDefaultCapacity =
				payload.defaultDailyCapacity !== undefined
					? parseDefaultCapacity(payload.defaultDailyCapacity)
					: undefined;

			validateBooleanField(payload.isActive, "isActive");
			validateBooleanField(payload.isAssignable, "isAssignable");

			const updates: Partial<typeof schema.staffProfile.$inferInsert> = {
				updatedAt: new Date(),
			};

			if (payload.isActive !== undefined) updates.isActive = payload.isActive;
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
				if (!weeklyAvailability.valid) {
					throwRpcError(
						"INVALID_WEEKLY_AVAILABILITY",
						422,
						weeklyAvailability.error,
					);
				}
				updates.weeklyAvailability = weeklyAvailability.parsed;
			}
			if (payload.notes !== undefined) updates.notes = payload.notes;
			if (payload.metadata !== undefined) updates.metadata = payload.metadata;

			await db
				.update(schema.staffProfile)
				.set(updates)
				.where(eq(schema.staffProfile.userId, payload.userId));

			// Create audit event for staff update
			await createAuditEvent({
				actorType: "admin",
				actorUserId: session.user.id,
				entityType: "staff_profile",
				entityId: payload.userId,
				action: "update",
				summary: buildStaffSummary("profile updated", {
					staffName: existing.userId,
				}),
				payload: {
					userId: payload.userId,
					changes: updates,
				},
			});

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
			const session = await requireAdminAccess(context.headers, {
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

			// Create audit event before deletion
			await createAuditEvent({
				actorType: "admin",
				actorUserId: session.user.id,
				entityType: "staff_profile",
				entityId: payload.userId,
				action: "delete",
				summary: buildStaffSummary("profile deleted", {
					staffName: payload.userId,
				}),
				payload: {
					userId: payload.userId,
					wasActive: existing.isActive,
				},
			});

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
				const existingOverride = await db.query.staffDateOverride.findFirst({
					where: and(
						eq(schema.staffDateOverride.staffUserId, payload.userId),
						eq(schema.staffDateOverride.overrideDate, payload.overrideDate),
					),
				});

				if (existingOverride) {
					const updates: Partial<typeof schema.staffDateOverride.$inferInsert> =
						{
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

					// Create audit event for override update
					await createAuditEvent({
						actorType: "admin",
						actorUserId: session.user.id,
						entityType: "staff_date_override",
						entityId: existingOverride.id,
						action: "update",
						summary: buildStaffSummary("date override updated", {
							date: payload.overrideDate,
							isAvailable: payload.isAvailable ?? existingOverride.isAvailable,
							capacity:
								parsedCapacityOverride ??
								existingOverride.capacityOverride ??
								undefined,
						}),
						payload: {
							id: existingOverride.id,
							staffUserId: payload.userId,
							overrideDate: payload.overrideDate,
							changes: updates,
						},
					});

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

				// Create audit event for override creation
				await createAuditEvent({
					actorType: "admin",
					actorUserId: session.user.id,
					entityType: "staff_date_override",
					entityId: id,
					action: "create",
					summary: buildStaffSummary("date override created", {
						date: payload.overrideDate,
						isAvailable: payload.isAvailable ?? true,
						capacity: parsedCapacityOverride ?? undefined,
					}),
					payload: {
						staffUserId: payload.userId,
						overrideDate: payload.overrideDate,
						isAvailable: payload.isAvailable ?? true,
						capacityOverride: parsedCapacityOverride ?? null,
						availableStartTime,
						availableEndTime,
						notes: payload.notes ?? null,
					},
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
				const session = await requireAdminAccess(context.headers, {
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
								eq(schema.staffDateOverride.overrideDate, payload.overrideDate),
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
				if (isAvailable === false && (availableStartTime || availableEndTime)) {
					throwRpcError(
						"INVALID_OVERRIDE_STATE",
						422,
						"Cannot set time windows when isAvailable=false",
					);
				}

				const updates: Partial<typeof schema.staffDateOverride.$inferInsert> = {
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

				// Create audit event for override update
				await createAuditEvent({
					actorType: "admin",
					actorUserId: session.user.id,
					entityType: "staff_date_override",
					entityId: payload.overrideId,
					action: "update",
					summary: buildStaffSummary("date override updated", {
						date: updates.overrideDate ?? existing.overrideDate,
						isAvailable: updates.isAvailable ?? existing.isAvailable,
						capacity:
							updates.capacityOverride ??
							existing.capacityOverride ??
							undefined,
					}),
					payload: {
						id: payload.overrideId,
						staffUserId: payload.userId,
						changes: updates,
					},
				});

				return await db.query.staffDateOverride.findFirst({
					where: eq(schema.staffDateOverride.id, payload.overrideId),
				});
			}),
			remove: rpc.handler(async ({ context, input }) => {
				const session = await requireAdminAccess(context.headers, {
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

				// Create audit event before deletion
				await createAuditEvent({
					actorType: "admin",
					actorUserId: session.user.id,
					entityType: "staff_date_override",
					entityId: payload.overrideId,
					action: "delete",
					summary: buildStaffSummary("date override deleted", {
						date: existing.overrideDate,
						isAvailable: existing.isAvailable,
					}),
					payload: {
						id: payload.overrideId,
						staffUserId: payload.userId,
						overrideDate: existing.overrideDate,
						wasAvailable: existing.isAvailable,
					},
				});

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
	};
}
