import { eq } from "drizzle-orm";
import type { db } from "../../lib/db";
import { schema } from "../../lib/db";
import type { CapacityConflict, ReassignmentPreview } from "./capacity.types";
import {
	countActiveStaffBookingsOnDate,
	resolveStaffAvailabilityAndCapacity,
} from "./capacity-check.service";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function previewReassignmentWithTx(
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

export async function executeReassignmentWithTx(
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
