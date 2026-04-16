import { getReservationInstance } from "../../features/reservations/reservations-instance-read.service";
import { moveReservationInstance } from "../../features/reservations/reservations-instance-move.service";
import { releaseReservationInstance } from "../../features/reservations/reservations-instance-release.service";
import { updateReservationInstance } from "../../features/reservations/reservations-instance-update-core.service";
import { rpc } from "../context";
import { parseIfMatch, requireAdminAccess } from "../shared";

export function createReservationsRouter() {
	return {
		get: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			const payload = input as { bookingId: string };
			return getReservationInstance(payload.bookingId);
		}),
		update: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			const ifMatch = parseIfMatch(context.headers.get("if-match"));
			const payload = input as {
				bookingId: string;
				staffUserId?: string;
				notes?: string | null;
			};
			return updateReservationInstance({
				...payload,
				ifMatch,
			});
		}),
		release: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			return releaseReservationInstance({
				input: input as Parameters<
					typeof releaseReservationInstance
				>[0]["input"],
				idempotencyKeyHeader: context.headers.get("idempotency-key"),
			});
		}),
		move: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			return moveReservationInstance({
				input: input as Parameters<typeof moveReservationInstance>[0]["input"],
				idempotencyKeyHeader: context.headers.get("idempotency-key"),
			});
		}),
	};
}
