import { eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import { throwRpcError } from "../../orpc/shared";
import { buildBookingSummary, createAuditEvent } from "../audit/audit.service";
import {
	executeBulkReassignments,
	previewReassignment,
	previewReassignments,
	reassignBooking,
} from "./capacity-reassign.service";

const MAX_BATCH_SIZE = 100;

export async function reassignExistingBooking(input: {
	id: string;
	targetStaffUserId: string;
}) {
	if (!input.targetStaffUserId) {
		throwRpcError(
			"MISSING_REQUIRED_FIELDS",
			422,
			"targetStaffUserId is required",
		);
	}

	const targetStaff = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, input.targetStaffUserId),
	});
	if (!targetStaff) {
		throwRpcError("NOT_FOUND", 404, "Target staff profile not found");
	}

	const result = await reassignBooking(input.id, input.targetStaffUserId);
	if (!result.success) {
		if (result.error === "Booking not found") {
			throwRpcError("NOT_FOUND", 404, result.error ?? "Booking not found");
		}
		if (
			result.error === "STALE_ACTIVE_BOOKING" ||
			result.error === "Cannot reassign inactive booking"
		) {
			const booking = await db.query.booking.findFirst({
				where: eq(schema.booking.id, input.id),
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
		throwRpcError("REASSIGNMENT_FAILED", 422, result.error ?? "Unknown error");
	}

	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, input.id),
	});

	// Create audit event for booking reassignment
	if (booking) {
		const targetStaffUser = await db.query.user.findFirst({
			where: eq(schema.user.id, input.targetStaffUserId),
		});
		const slot = await db.query.appointmentSlot.findFirst({
			where: eq(schema.appointmentSlot.id, booking.slotId),
		});

		await createAuditEvent({
			actorType: booking.kind === "citizen" ? "citizen" : "admin",
			actorUserId: booking.createdByUserId,
			entityType: "booking",
			entityId: booking.id,
			action: "reassign",
			summary: buildBookingSummary("reassigned", booking.id, {
				kind: booking.kind,
				status: booking.status,
				slotDate: slot?.slotDate,
				startTime: slot?.startTime,
				targetStaffName: targetStaffUser?.name,
			}),
			payload: {
				slotId: booking.slotId,
				previousStaffUserId: booking.staffUserId,
				newStaffUserId: input.targetStaffUserId,
				kind: booking.kind,
			},
		});
	}

	return booking;
}

export async function previewBookingReassignment(input: {
	id: string;
	targetStaffUserId: string;
}) {
	if (!input.targetStaffUserId) {
		throwRpcError(
			"MISSING_REQUIRED_FIELDS",
			422,
			"targetStaffUserId is required",
		);
	}

	const preview = await previewReassignment(input.id, input.targetStaffUserId);
	return {
		dryRun: true,
		...preview,
	};
}

function validateReassignmentsBatch(
	reassignments:
		| Array<{
				bookingId: string;
				targetStaffUserId: string;
		  }>
		| undefined,
) {
	if (!reassignments || !Array.isArray(reassignments)) {
		throwRpcError(
			"MISSING_REQUIRED_FIELDS",
			422,
			"reassignments array is required",
		);
	}
	if (reassignments.length === 0) {
		throwRpcError(
			"BATCH_SCOPE_REQUIRED",
			422,
			"At least one reassignment is required",
		);
	}

	if (reassignments.length > MAX_BATCH_SIZE) {
		throwRpcError(
			"BATCH_LIMIT_EXCEEDED",
			422,
			`Maximum batch size is ${MAX_BATCH_SIZE}`,
		);
	}

	const bookingIds = reassignments.map((r) => r.bookingId);
	const uniqueBookingIds = new Set(bookingIds);
	if (bookingIds.length !== uniqueBookingIds.size) {
		throwRpcError("INVALID_SCOPE", 422, "Duplicate bookingId values in batch");
	}
}

export async function previewBookingsReassignments(input: {
	reassignments: Array<{
		bookingId: string;
		targetStaffUserId: string;
	}>;
}) {
	validateReassignmentsBatch(input.reassignments);

	const preview = await previewReassignments(
		input.reassignments.map((r) => ({
			bookingId: r.bookingId,
			targetStaffUserId: r.targetStaffUserId,
		})),
	);

	return {
		dryRun: true,
		...preview,
	};
}

export async function applyBookingsReassignments(input: {
	reassignments: Array<{
		bookingId: string;
		targetStaffUserId: string;
	}>;
	executionMode?: "best_effort" | "atomic";
	previewToken?: string;
}) {
	validateReassignmentsBatch(input.reassignments);

	const executionMode = input.executionMode ?? "best_effort";
	if (!["best_effort", "atomic"].includes(executionMode)) {
		throwRpcError(
			"INVALID_EXECUTION_MODE",
			422,
			"executionMode must be 'best_effort' or 'atomic'",
		);
	}

	const result = await executeBulkReassignments(
		input.reassignments.map((r) => ({
			bookingId: r.bookingId,
			targetStaffUserId: r.targetStaffUserId,
		})),
		executionMode,
		input.previewToken,
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
}
