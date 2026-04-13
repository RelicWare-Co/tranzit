import { and, eq, gte, lte } from "drizzle-orm";
import {
	checkCapacity,
	confirmBooking,
	consumeCapacity,
	executeBulkReassignments,
	previewReassignment,
	previewReassignments,
	reassignBooking,
	releaseCapacity,
} from "../../features/bookings/capacity.service";
import { db, schema } from "../../lib/db";
import { rpc } from "../context";
import { requireAdminAccess, throwRpcError } from "../shared";

export function createBookingsRouter() {
	return {
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
				conditions.push(eq(schema.booking.staffUserId, payload.staffUserId));
			if (payload.requestId)
				conditions.push(eq(schema.booking.requestId, payload.requestId));
			if (payload.citizenUserId)
				conditions.push(
					eq(schema.booking.citizenUserId, payload.citizenUserId),
				);
			if (payload.kind) conditions.push(eq(schema.booking.kind, payload.kind));
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
				throwRpcError("INVALID_STATE", 422, "Booking has no staff assigned");
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
					result.error === "Booking not found" ? "NOT_FOUND" : "RELEASE_FAILED";
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
					throwRpcError("NOT_FOUND", 404, result.error ?? "Booking not found");
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
						currentActiveBookingId = serviceRequest?.activeBookingId ?? null;
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
	};
}
