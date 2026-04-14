import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import {
	assertAdminBookingKind,
	assertMutableState,
	checkIdempotencyKey,
	hashPayload,
	parseIdempotencyKey,
	resolveCachedIdempotencyResponse,
	storeIdempotencyKey,
	throwIdempotencyAwareError,
	throwRpcError,
} from "../../orpc/shared";
import { releaseCapacity } from "../bookings/capacity.service";

export async function releaseReservationInstance(params: {
	input: { bookingId: string; reason?: string };
	idempotencyKeyHeader?: string | null;
}) {
	const payload = params.input;
	const idempotencyKey = parseIdempotencyKey(params.idempotencyKeyHeader);
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
			result.error === "Booking not found" ? "NOT_FOUND" : "RELEASE_FAILED";
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
}
