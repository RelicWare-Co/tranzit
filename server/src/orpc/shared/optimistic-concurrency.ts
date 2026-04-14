import type { schema } from "../../lib/db";
import { throwRpcError } from "./errors";

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
