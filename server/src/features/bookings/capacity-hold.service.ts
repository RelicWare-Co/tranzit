import { eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import type { PreviewTokenState } from "./capacity.types";

const PREVIEW_TOKEN_TTL_MS = 15 * 60 * 1000;

type ReassignmentRequest = { bookingId: string; targetStaffUserId: string };

type PreviewBookingSnapshot = {
	staffUserId: string | null;
	isActive: boolean;
	slotId: string;
	requestId: string | null;
	kind: string;
};

const previewTokenStore = new Map<
	string,
	{ state: PreviewTokenState; timeout: ReturnType<typeof setTimeout> }
>();

export function generatePreviewToken(
	requests: ReassignmentRequest[],
	bookings: Map<string, PreviewBookingSnapshot>,
): string {
	const token = crypto.randomUUID();

	const items = requests.map((r) => {
		const booking = bookings.get(r.bookingId);
		return {
			bookingId: r.bookingId,
			targetStaffUserId: r.targetStaffUserId,
			bookingStaffUserId: booking?.staffUserId ?? null,
			bookingIsActive: booking?.isActive ?? false,
			slotId: booking?.slotId ?? "",
			requestId: booking?.requestId ?? null,
			kind: booking?.kind ?? "",
		};
	});

	const timeout = setTimeout(() => {
		previewTokenStore.delete(token);
	}, PREVIEW_TOKEN_TTL_MS);

	previewTokenStore.set(token, {
		state: { token, createdAt: new Date(), items },
		timeout,
	});

	return token;
}

export function validatePreviewToken(
	token: string,
	requests: ReassignmentRequest[],
):
	| { valid: true; state: PreviewTokenState }
	| { valid: false; reason: "PREVIEW_STALE" | "PREVIEW_EXPIRED" } {
	const entry = previewTokenStore.get(token);

	if (!entry) {
		return { valid: false, reason: "PREVIEW_STALE" };
	}

	const { state } = entry;
	const now = new Date();

	if (now.getTime() - state.createdAt.getTime() > PREVIEW_TOKEN_TTL_MS) {
		previewTokenStore.delete(token);
		return { valid: false, reason: "PREVIEW_EXPIRED" };
	}

	for (const item of state.items) {
		const current = requests.find((r) => r.bookingId === item.bookingId);
		if (!current) {
			return { valid: false, reason: "PREVIEW_STALE" };
		}

		if (current.targetStaffUserId !== item.targetStaffUserId) {
			return { valid: false, reason: "PREVIEW_STALE" };
		}
	}

	return { valid: true, state };
}

export function invalidatePreviewToken(token: string): void {
	const entry = previewTokenStore.get(token);
	if (entry) {
		clearTimeout(entry.timeout);
		previewTokenStore.delete(token);
	}
}

export async function checkPreviewDrift(
	requests: ReassignmentRequest[],
	previewState: PreviewTokenState,
): Promise<{ hasDrift: boolean; driftedBookingIds: string[] }> {
	const driftedBookingIds: string[] = [];

	for (const item of previewState.items) {
		const current = requests.find((r) => r.bookingId === item.bookingId);
		if (!current) continue;

		const booking = await db.query.booking.findFirst({
			where: eq(schema.booking.id, item.bookingId),
		});

		if (!booking) {
			driftedBookingIds.push(item.bookingId);
			continue;
		}

		if (booking.isActive !== item.bookingIsActive) {
			driftedBookingIds.push(item.bookingId);
			continue;
		}

		if (booking.staffUserId !== item.bookingStaffUserId) {
			driftedBookingIds.push(item.bookingId);
			continue;
		}

		if (current.targetStaffUserId !== item.targetStaffUserId) {
			driftedBookingIds.push(item.bookingId);
			continue;
		}

		if (item.kind === "citizen" && item.requestId) {
			const serviceRequest = await db.query.serviceRequest.findFirst({
				where: eq(schema.serviceRequest.id, item.requestId),
			});

			if (serviceRequest?.activeBookingId !== item.bookingId) {
				driftedBookingIds.push(item.bookingId);
			}
		}
	}

	return {
		hasDrift: driftedBookingIds.length > 0,
		driftedBookingIds,
	};
}
