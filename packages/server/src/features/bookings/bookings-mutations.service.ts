import { eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import { logger } from "../../lib/logger";
import { throwRpcError } from "../../orpc/shared";
import {
	sendHoldExpirationEmail,
} from "../notifications/notification.service";
import type { TemplateContext } from "../notifications/notification-templates";
import {
	confirmBooking,
	consumeCapacity,
	releaseCapacity,
} from "./capacity-consume.service";

/**
 * Build the notification template context from a booking.
 * Used for sending hold expiration emails.
 */
const buildNotificationContext = async (
	booking: typeof schema.booking.$inferSelect,
): Promise<TemplateContext> => {
	const slot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, booking.slotId),
	});

	const procedure = booking.requestId
		? await db.query.serviceRequest.findFirst({
				where: eq(schema.serviceRequest.id, booking.requestId),
				with: {
					procedureType: true,
				},
			})
		: null;

	const staffUser = booking.staffUserId
		? await db.query.user.findFirst({
				where: eq(schema.user.id, booking.staffUserId),
			})
		: null;

	const citizenUser = booking.citizenUserId
		? await db.query.user.findFirst({
				where: eq(schema.user.id, booking.citizenUserId),
			})
		: null;

	const draftData =
		procedure?.draftData && typeof procedure.draftData === "object"
			? (procedure.draftData as Record<string, unknown>)
			: null;

	return {
		procedureName: procedure?.procedureType?.name ?? "Trámite",
		appointmentDate: slot?.slotDate ?? "",
		appointmentTime: slot?.startTime ?? "",
		appointmentEndTime: slot?.endTime,
		staffName: staffUser?.name ?? null,
		citizenName: citizenUser?.name ?? null,
		bookingId: booking.id,
		serviceRequest: {
			applicantName:
				typeof draftData?.applicantName === "string"
					? draftData.applicantName
					: null,
			applicantDocument:
				typeof draftData?.applicantDocument === "string"
					? draftData.applicantDocument
					: null,
			plate: typeof draftData?.plate === "string" ? draftData.plate : null,
		},
	};
};

export interface CreateBookingInput {
	slotId: string;
	staffUserId: string;
	kind: "citizen" | "administrative";
	requestId?: string;
	citizenUserId?: string;
	holdExpiresAt?: string;
	holdToken?: string;
}

export async function createBooking(params: {
	input: CreateBookingInput;
	createdByUserId: string;
}) {
	const payload = params.input;

	if (!payload.slotId) {
		throwRpcError("MISSING_REQUIRED_FIELDS", 422, "slotId is required");
	}
	if (!payload.staffUserId) {
		throwRpcError("MISSING_REQUIRED_FIELDS", 422, "staffUserId is required");
	}
	if (!payload.kind || !["citizen", "administrative"].includes(payload.kind)) {
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
		params.createdByUserId,
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

	return await db.query.booking.findFirst({
		where: eq(schema.booking.id, result.bookingId),
	});
}

export async function confirmExistingBooking(id: string) {
	const result = await confirmBooking(id);
	if (!result.success) {
		// If the booking expired, send a hold expiration email before throwing
		if (result.expiredBooking) {
			try {
				const booking = result.expiredBooking;
				const citizenUser = booking.citizenUserId
					? await db.query.user.findFirst({
							where: eq(schema.user.id, booking.citizenUserId),
						})
					: null;

				if (citizenUser?.email) {
					const context = await buildNotificationContext(booking);
					await sendHoldExpirationEmail({
						bookingId: booking.id,
						recipient: citizenUser.email,
						context,
					});
				}
			} catch (error) {
				logger.error(
					{ err: error, bookingId: id },
					"Failed to send hold expiration email",
				);
				// Do not throw - the confirmation failure should still be reported
			}
		}

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
		where: eq(schema.booking.id, id),
	});
}

export async function releaseExistingBooking(input: {
	id: string;
	reason: string;
}) {
	if (
		!input.reason ||
		!["cancelled", "expired", "attended"].includes(input.reason)
	) {
		throwRpcError(
			"INVALID_REASON",
			422,
			"reason must be 'cancelled', 'expired', or 'attended'",
		);
	}

	const reason = input.reason as "cancelled" | "expired" | "attended";
	const result = await releaseCapacity(input.id, reason);
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
		where: eq(schema.booking.id, input.id),
	});

	return {
		booking,
		alreadyReleased: result.alreadyReleased,
	};
}
