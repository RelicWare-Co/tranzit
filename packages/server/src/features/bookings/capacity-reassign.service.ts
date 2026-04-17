import { eq, sql } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import type {
	BulkExecutionMode,
	BulkReassignmentPreview,
	BulkReassignmentResult,
	CapacityConflict,
	ReassignmentPreview,
} from "./capacity.types";
import {
	checkCapacity,
	countActiveStaffBookingsOnDate,
	resolveStaffAvailabilityAndCapacity,
} from "./capacity-check.service";
import {
	checkPreviewDrift,
	generatePreviewToken,
	invalidatePreviewToken,
	validatePreviewToken,
} from "./capacity-hold.service";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type BookingLike = {
	id: string;
	slotId: string;
	staffUserId: string | null;
	isActive: boolean;
	kind: string;
	requestId: string | null;
};

function toBookingSummary(booking: BookingLike) {
	return {
		id: booking.id,
		slotId: booking.slotId,
		staffUserId: booking.staffUserId,
		isActive: booking.isActive,
		kind: booking.kind,
		requestId: booking.requestId,
	};
}

async function getActiveBookingIdForRequest(
	requestId: string,
): Promise<string | null> {
	const serviceRequest = await db.query.serviceRequest.findFirst({
		where: eq(schema.serviceRequest.id, requestId),
	});
	return serviceRequest?.activeBookingId ?? null;
}

export async function previewReassignment(
	bookingId: string,
	newStaffUserId: string,
): Promise<ReassignmentPreview> {
	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	if (!booking) {
		return {
			canReassign: false,
			booking: null,
			targetStaff: null,
			slot: null,
			conflicts: [],
			staleSource: false,
			currentActiveBookingId: null,
			error: "Booking not found",
		};
	}

	if (!booking.isActive) {
		return {
			canReassign: false,
			booking: {
				id: booking.id,
				slotId: booking.slotId,
				staffUserId: booking.staffUserId,
				isActive: booking.isActive,
				kind: booking.kind,
				requestId: booking.requestId,
			},
			targetStaff: null,
			slot: null,
			conflicts: [],
			staleSource: true,
			currentActiveBookingId: booking.requestId
				? await getActiveBookingIdForRequest(booking.requestId)
				: null,
			error: "Booking is inactive",
		};
	}

	let staleSource = false;
	let currentActiveBookingId: string | null = null;

	if (booking.kind === "citizen" && booking.requestId) {
		const serviceRequest = await db.query.serviceRequest.findFirst({
			where: eq(schema.serviceRequest.id, booking.requestId),
		});

		if (serviceRequest) {
			currentActiveBookingId = serviceRequest.activeBookingId;

			if (serviceRequest.activeBookingId !== bookingId) {
				staleSource = true;
				return {
					canReassign: false,
					booking: {
						id: booking.id,
						slotId: booking.slotId,
						staffUserId: booking.staffUserId,
						isActive: booking.isActive,
						kind: booking.kind,
						requestId: booking.requestId,
					},
					targetStaff: null,
					slot: null,
					conflicts: [],
					staleSource: true,
					currentActiveBookingId,
					error: "STALE_ACTIVE_BOOKING",
				};
			}
		}
	}

	const isNoOp = booking.staffUserId === newStaffUserId;

	const targetStaff = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, newStaffUserId),
	});

	if (!targetStaff) {
		return {
			canReassign: false,
			booking: {
				id: booking.id,
				slotId: booking.slotId,
				staffUserId: booking.staffUserId,
				isActive: booking.isActive,
				kind: booking.kind,
				requestId: booking.requestId,
			},
			targetStaff: null,
			slot: null,
			conflicts: [],
			staleSource,
			currentActiveBookingId,
			error: "Target staff not found",
		};
	}

	const slot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, booking.slotId),
	});

	if (!slot) {
		return {
			canReassign: false,
			booking: {
				id: booking.id,
				slotId: booking.slotId,
				staffUserId: booking.staffUserId,
				isActive: booking.isActive,
				kind: booking.kind,
				requestId: booking.requestId,
			},
			targetStaff: {
				userId: targetStaff.userId,
				isActive: targetStaff.isActive,
				isAssignable: targetStaff.isAssignable,
			},
			slot: null,
			conflicts: [],
			staleSource,
			currentActiveBookingId,
			error: "Slot not found",
		};
	}

	const capacityCheck = await checkCapacity(slot.id, newStaffUserId);

	const filteredConflicts = capacityCheck.conflicts.filter((c) => {
		if (c.type === "GLOBAL_OVER_CAPACITY") return false;
		return true;
	});

	if (isNoOp) {
		filteredConflicts.length = 0;
	}

	const canReassign =
		isNoOp ||
		(!staleSource &&
			targetStaff.isActive &&
			targetStaff.isAssignable &&
			filteredConflicts.length === 0);

	return {
		canReassign,
		booking: {
			id: booking.id,
			slotId: booking.slotId,
			staffUserId: booking.staffUserId,
			isActive: booking.isActive,
			kind: booking.kind,
			requestId: booking.requestId,
		},
		targetStaff: {
			userId: targetStaff.userId,
			isActive: targetStaff.isActive,
			isAssignable: targetStaff.isAssignable,
		},
		slot: {
			id: slot.id,
			slotDate: slot.slotDate,
			startTime: slot.startTime,
			endTime: slot.endTime,
		},
		conflicts: filteredConflicts,
		staleSource,
		currentActiveBookingId,
		error:
			canReassign || isNoOp
				? undefined
				: "Target staff lacks capacity or is not available",
	};
}

export async function previewReassignments(
	requests: Array<{ bookingId: string; targetStaffUserId: string }>,
): Promise<BulkReassignmentPreview> {
	const results: BulkReassignmentPreview["results"] = [];
	const eligible: string[] = [];
	const excluded: BulkReassignmentPreview["excluded"] = [];
	const conflicts: BulkReassignmentPreview["conflicts"] = [];
	const errors: BulkReassignmentPreview["errors"] = [];

	const bookingsMap = new Map<
		string,
		{
			staffUserId: string | null;
			isActive: boolean;
			slotId: string;
			requestId: string | null;
			kind: string;
		}
	>();

	for (const { bookingId } of requests) {
		const booking = await db.query.booking.findFirst({
			where: eq(schema.booking.id, bookingId),
		});

		if (booking) {
			bookingsMap.set(bookingId, {
				staffUserId: booking.staffUserId,
				isActive: booking.isActive,
				slotId: booking.slotId,
				requestId: booking.requestId,
				kind: booking.kind,
			});
		}
	}

	const seenRequestIds = new Set<string>();

	for (const { bookingId, targetStaffUserId } of requests) {
		const preview = await previewReassignment(bookingId, targetStaffUserId);
		results.push({ bookingId, preview });

		const bookingInfo = bookingsMap.get(bookingId);

		if (
			bookingInfo?.kind === "citizen" &&
			bookingInfo?.requestId &&
			seenRequestIds.has(bookingInfo.requestId)
		) {
			excluded.push({
				bookingId,
				reason: "SOLAPE_DETECTED",
			});
			continue;
		}
		if (bookingInfo?.kind === "citizen" && bookingInfo?.requestId) {
			seenRequestIds.add(bookingInfo.requestId);
		}

		if (
			preview.canReassign &&
			preview.booking?.staffUserId === targetStaffUserId
		) {
			excluded.push({
				bookingId,
				reason: "SAME_STAFF_NO_OP",
			});
			continue;
		}

		if (preview.canReassign) {
			eligible.push(bookingId);
		} else if (
			preview.error === "Target staff lacks capacity or is not available" ||
			preview.conflicts.some((c) => c.type === "STAFF_OVER_CAPACITY")
		) {
			conflicts.push({
				bookingId,
				reason: preview.error ?? "Capacity conflict",
				conflicts: preview.conflicts,
			});
		} else if (preview.staleSource || preview.error === "Booking is inactive") {
			excluded.push({
				bookingId,
				reason: preview.error ?? "Booking inactive",
			});
		} else if (preview.error === "STALE_ACTIVE_BOOKING") {
			excluded.push({
				bookingId,
				reason: "STALE_ACTIVE_BOOKING",
			});
		} else {
			errors.push({
				bookingId,
				error: preview.error ?? "Unknown error",
			});
		}
	}

	const previewToken = generatePreviewToken(requests, bookingsMap);

	return { previewToken, results, eligible, excluded, conflicts, errors };
}

export async function reassignBooking(
	bookingId: string,
	newStaffUserId: string,
): Promise<{
	success: boolean;
	error?: string;
	conflicts: CapacityConflict[];
}> {
	const now = new Date();

	try {
		const result = await db.transaction(async (tx) => {
			const booking = await tx.query.booking.findFirst({
				where: eq(schema.booking.id, bookingId),
			});

			if (!booking) {
				throw {
					type: "NOT_FOUND",
					message: "Booking not found",
				};
			}

			if (!booking.isActive) {
				throw {
					type: "STALE_SOURCE",
					message: "Cannot reassign inactive booking",
				};
			}

			if (booking.kind === "citizen" && booking.requestId) {
				const serviceRequest = await tx.query.serviceRequest.findFirst({
					where: eq(schema.serviceRequest.id, booking.requestId),
				});

				if (serviceRequest && serviceRequest.activeBookingId !== bookingId) {
					throw {
						type: "STALE_ACTIVE_BOOKING",
						message: "Booking is not the active booking for this request",
						currentActiveBookingId: serviceRequest.activeBookingId,
					};
				}
			}

			if (booking.staffUserId === newStaffUserId) {
				return { success: true, conflicts: [], error: undefined };
			}

			const slot = await tx.query.appointmentSlot.findFirst({
				where: eq(schema.appointmentSlot.id, booking.slotId),
			});

			if (!slot) {
				throw {
					type: "NOT_FOUND",
					message: "Slot not found",
				};
			}

			const targetStaff = await tx.query.staffProfile.findFirst({
				where: eq(schema.staffProfile.userId, newStaffUserId),
			});

			if (!targetStaff) {
				throw {
					type: "NOT_FOUND",
					message: "Target staff not found",
				};
			}

			const staffResolution = await resolveStaffAvailabilityAndCapacity(
				tx,
				newStaffUserId,
				slot.slotDate,
				slot.startTime,
				slot.endTime,
			);

			if (!staffResolution.available) {
				const isAssignableError =
					staffResolution.reason === "Staff is not active or not assignable";
				const isOverrideUnavailable =
					staffResolution.reason ===
					"Staff is unavailable on this date (override)";

				const mappedMessage = isAssignableError
					? "Target staff is not active or not assignable"
					: isOverrideUnavailable
						? "Target staff is unavailable on this date"
						: (staffResolution.reason ?? "Target staff unavailable");

				throw {
					type: isAssignableError
						? "STAFF_NOT_ASSIGNABLE"
						: "STAFF_UNAVAILABLE",
					message: mappedMessage,
				};
			}

			const staffUsed = await countActiveStaffBookingsOnDate(
				tx,
				newStaffUserId,
				slot.slotDate,
				booking.id,
			);

			if (staffUsed >= staffResolution.staffCapacity) {
				throw {
					type: "STAFF_OVER_CAPACITY",
					message: `Target staff has reached daily capacity limit (${staffResolution.staffCapacity})`,
				};
			}

			await tx
				.update(schema.booking)
				.set({
					staffUserId: newStaffUserId,
					updatedAt: now,
				})
				.where(eq(schema.booking.id, bookingId));

			return {
				success: true,
				conflicts: [] as CapacityConflict[],
				error: undefined,
			};
		});

		return result;
	} catch (err: unknown) {
		if (err && typeof err === "object") {
			const errorObj = err as {
				type: string;
				message: string;
				conflicts?: CapacityConflict[];
				currentActiveBookingId?: string;
			};
			if (errorObj.type === "NOT_FOUND") {
				return {
					success: false,
					error: errorObj.message,
					conflicts: [],
				};
			}
			if (
				errorObj.type === "STALE_SOURCE" ||
				errorObj.type === "STALE_ACTIVE_BOOKING"
			) {
				return {
					success: false,
					error: errorObj.message,
					conflicts: [],
				};
			}
			if (
				errorObj.type === "STAFF_NOT_ASSIGNABLE" ||
				errorObj.type === "STAFF_UNAVAILABLE" ||
				errorObj.type === "STAFF_OVER_CAPACITY"
			) {
				return {
					success: false,
					error: errorObj.message,
					conflicts: [
						{
							type: errorObj.type as CapacityConflict["type"],
							details: errorObj.message,
						},
					],
				};
			}
		}
		throw err;
	}
}

export async function executeBulkReassignments(
	requests: Array<{ bookingId: string; targetStaffUserId: string }>,
	mode: BulkExecutionMode = "best_effort",
	previewToken?: string,
): Promise<BulkReassignmentResult> {
	if (previewToken) {
		const tokenValidation = validatePreviewToken(previewToken, requests);

		if (!tokenValidation.valid) {
			return {
				appliedCount: 0,
				failedCount: requests.length,
				failures: requests.map((r) => ({
					bookingId: r.bookingId,
					reason: tokenValidation.reason,
				})),
				results: requests.map((r) => ({
					bookingId: r.bookingId,
					success: false,
					error: tokenValidation.reason,
				})),
			};
		}

		const driftResult = await checkPreviewDrift(
			requests,
			tokenValidation.state,
		);
		if (driftResult.hasDrift) {
			invalidatePreviewToken(previewToken);
			return {
				appliedCount: 0,
				failedCount: requests.length,
				failures: requests.map((r) => ({
					bookingId: r.bookingId,
					reason: "PREVIEW_STALE",
				})),
				results: requests.map((r) => ({
					bookingId: r.bookingId,
					success: false,
					error: "PREVIEW_STALE",
				})),
			};
		}
	}

	if (mode === "atomic") {
		const results: BulkReassignmentResult["results"] = [];
		const createdAuditEventIds: string[] = [];
		let failedBookingId: string | undefined;

		try {
			await db.transaction(async (tx) => {
				for (const { bookingId, targetStaffUserId } of requests) {
					failedBookingId = bookingId;
					const preview = await previewReassignmentWithTx(
						tx,
						bookingId,
						targetStaffUserId,
					);

					if (!preview.canReassign) {
						throw {
							type: "REASSIGNMENT_FAILED",
							bookingId,
							message: preview.error ?? "Reassignment not possible",
							currentActiveBookingId: preview.currentActiveBookingId,
						};
					}

					await executeReassignmentWithTx(
						tx,
						bookingId,
						targetStaffUserId,
						new Date(),
					);

					results.push({ bookingId, success: true });
				}
			});

			if (previewToken) {
				invalidatePreviewToken(previewToken);
			}

			return {
				appliedCount: results.length,
				failedCount: 0,
				failures: [],
				results,
			};
		} catch (err: unknown) {
			// Ensure we have a bookingId for the error response
			const errorBookingId =
				err && typeof err === "object" && "bookingId" in err
					? (err as { bookingId: string }).bookingId
					: failedBookingId ?? requests[0]?.bookingId;

			const errorMessage =
				err && typeof err === "object" && "message" in err
					? (err as { message: string }).message
					: err instanceof Error
						? err.message
						: "Unknown error during atomic reassignment";

			if (createdAuditEventIds.length > 0) {
				try {
					await db
						.delete(schema.auditEvent)
						.where(sql`${schema.auditEvent.id} IN ${createdAuditEventIds}`);
				} catch {
					// Best effort cleanup
				}
			}

			return {
				appliedCount: 0,
				failedCount: requests.length,
				failures: [{ bookingId: errorBookingId, reason: errorMessage }],
				results: requests.map((r) => ({
					bookingId: r.bookingId,
					success: false,
					error:
						r.bookingId === errorBookingId
							? errorMessage
							: "Transaction failed due to another item",
				})),
			};
		}
	}

	const results: BulkReassignmentResult["results"] = [];
	const failures: BulkReassignmentResult["failures"] = [];

	for (const { bookingId, targetStaffUserId } of requests) {
		const result = await reassignBooking(bookingId, targetStaffUserId);
		if (result.success) {
			results.push({ bookingId, success: true });
		} else {
			results.push({ bookingId, success: false, error: result.error });
			failures.push({
				bookingId,
				reason: result.error ?? "Unknown error",
			});
		}
	}

	if (previewToken && failures.length === 0) {
		invalidatePreviewToken(previewToken);
	}

	return {
		appliedCount: results.filter((r) => r.success).length,
		failedCount: failures.length,
		failures,
		results,
	};
}

async function previewReassignmentWithTx(
	tx: Tx,
	bookingId: string,
	newStaffUserId: string,
): Promise<ReassignmentPreview> {
	const booking = await tx.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	if (!booking) {
		return {
			canReassign: false,
			booking: null,
			targetStaff: null,
			slot: null,
			conflicts: [],
			staleSource: false,
			currentActiveBookingId: null,
			error: "Booking not found",
		};
	}

	if (!booking.isActive) {
		const currentActiveBookingId = booking.requestId
			? ((
					await tx.query.serviceRequest.findFirst({
						where: eq(schema.serviceRequest.id, booking.requestId),
					})
				)?.activeBookingId ?? null)
			: null;
		return {
			canReassign: false,
			booking: {
				id: booking.id,
				slotId: booking.slotId,
				staffUserId: booking.staffUserId,
				isActive: booking.isActive,
				kind: booking.kind,
				requestId: booking.requestId,
			},
			targetStaff: null,
			slot: null,
			conflicts: [],
			staleSource: true,
			currentActiveBookingId,
			error: "Booking is inactive",
		};
	}

	let staleSource = false;
	let currentActiveBookingId: string | null = null;

	if (booking.kind === "citizen" && booking.requestId) {
		const serviceRequest = await tx.query.serviceRequest.findFirst({
			where: eq(schema.serviceRequest.id, booking.requestId),
		});

		if (serviceRequest) {
			currentActiveBookingId = serviceRequest.activeBookingId;

			if (serviceRequest.activeBookingId !== bookingId) {
				staleSource = true;
				return {
					canReassign: false,
					booking: {
						id: booking.id,
						slotId: booking.slotId,
						staffUserId: booking.staffUserId,
						isActive: booking.isActive,
						kind: booking.kind,
						requestId: booking.requestId,
					},
					targetStaff: null,
					slot: null,
					conflicts: [],
					staleSource: true,
					currentActiveBookingId,
					error: "STALE_ACTIVE_BOOKING",
				};
			}
		}
	}

	const targetStaff = await tx.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, newStaffUserId),
	});

	if (!targetStaff) {
		return {
			canReassign: false,
			booking: {
				id: booking.id,
				slotId: booking.slotId,
				staffUserId: booking.staffUserId,
				isActive: booking.isActive,
				kind: booking.kind,
				requestId: booking.requestId,
			},
			targetStaff: null,
			slot: null,
			conflicts: [],
			staleSource,
			currentActiveBookingId,
			error: "Target staff not found",
		};
	}

	const slot = await tx.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, booking.slotId),
	});

	if (!slot) {
		return {
			canReassign: false,
			booking: {
				id: booking.id,
				slotId: booking.slotId,
				staffUserId: booking.staffUserId,
				isActive: booking.isActive,
				kind: booking.kind,
				requestId: booking.requestId,
			},
			targetStaff: {
				userId: targetStaff.userId,
				isActive: targetStaff.isActive,
				isAssignable: targetStaff.isAssignable,
			},
			slot: null,
			conflicts: [],
			staleSource,
			currentActiveBookingId,
			error: "Slot not found",
		};
	}

	const conflicts: CapacityConflict[] = [];

	const staffResolution = await resolveStaffAvailabilityAndCapacity(
		tx,
		newStaffUserId,
		slot.slotDate,
		slot.startTime,
		slot.endTime,
	);

	if (!staffResolution.available) {
		const isAssignableError =
			staffResolution.reason === "Staff is not active or not assignable";
		conflicts.push({
			type: isAssignableError ? "STAFF_NOT_ASSIGNABLE" : "STAFF_UNAVAILABLE",
			details: staffResolution.reason ?? "Target staff unavailable",
		});
	}

	const staffUsed = await countActiveStaffBookingsOnDate(
		tx,
		newStaffUserId,
		slot.slotDate,
		booking.id,
	);

	if (staffUsed >= staffResolution.staffCapacity) {
		conflicts.push({
			type: "STAFF_OVER_CAPACITY",
			details: `Target staff has reached daily capacity limit (${staffResolution.staffCapacity})`,
		});
	}

	return {
		canReassign:
			!staleSource &&
			targetStaff.isActive &&
			targetStaff.isAssignable &&
			conflicts.length === 0,
		booking: {
			id: booking.id,
			slotId: booking.slotId,
			staffUserId: booking.staffUserId,
			isActive: booking.isActive,
			kind: booking.kind,
			requestId: booking.requestId,
		},
		targetStaff: {
			userId: targetStaff.userId,
			isActive: targetStaff.isActive,
			isAssignable: targetStaff.isAssignable,
		},
		slot: {
			id: slot.id,
			slotDate: slot.slotDate,
			startTime: slot.startTime,
			endTime: slot.endTime,
		},
		conflicts,
		staleSource,
		currentActiveBookingId,
		error:
			conflicts.length > 0
				? "Target staff lacks capacity or is not available"
				: undefined,
	};
}

async function executeReassignmentWithTx(
	tx: Tx,
	bookingId: string,
	newStaffUserId: string,
	now: Date,
): Promise<void> {
	const booking = await tx.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	if (!booking) {
		throw { type: "NOT_FOUND", message: "Booking not found" };
	}

	if (!booking.isActive) {
		throw { type: "STALE_SOURCE", message: "Cannot reassign inactive booking" };
	}

	if (booking.staffUserId === newStaffUserId) {
		return;
	}

	await tx
		.update(schema.booking)
		.set({
			staffUserId: newStaffUserId,
			updatedAt: now,
		})
		.where(eq(schema.booking.id, bookingId));
}
