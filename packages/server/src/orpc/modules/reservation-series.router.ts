import {
	createReservationSeries,
	releaseReservationSeries,
} from "../../features/reservations/reservation-series-create-release.service";
import { moveReservationSeries } from "../../features/reservations/reservation-series-move.service";
import {
	getReservationSeries,
	listReservationSeries,
	listReservationSeriesInstances,
} from "../../features/reservations/reservation-series-read.service";
import {
	updateReservationSeries,
	updateReservationSeriesFromDate,
} from "../../features/reservations/reservation-series-update.service";
import { rpc } from "../context";
import { parseIfMatch, requireAdminAccess } from "../shared";

export function createReservationSeriesRouter() {
	return {
		create: rpc.handler(async ({ context, input }) => {
			const session = await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			return createReservationSeries({
				input: (input ?? {}) as Parameters<
					typeof createReservationSeries
				>[0]["input"],
				createdByUserId: session.user.id,
				idempotencyKeyHeader: context.headers.get("idempotency-key"),
			});
		}),
		list: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			return listReservationSeries(
				(input ?? {}) as Parameters<typeof listReservationSeries>[0],
			);
		}),
		get: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			const payload = input as { id: string };
			return getReservationSeries(payload.id);
		}),
		instances: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			return listReservationSeriesInstances(
				input as Parameters<typeof listReservationSeriesInstances>[0],
			);
		}),
		update: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			const ifMatch = parseIfMatch(context.headers.get("if-match"));
			return updateReservationSeries({
				input: input as Parameters<typeof updateReservationSeries>[0]["input"],
				ifMatch,
			});
		}),
		updateFromDate: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			return updateReservationSeriesFromDate(
				input as Parameters<typeof updateReservationSeriesFromDate>[0],
			);
		}),
		release: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			return releaseReservationSeries({
				input: input as Parameters<typeof releaseReservationSeries>[0]["input"],
				idempotencyKeyHeader: context.headers.get("idempotency-key"),
			});
		}),
		move: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				"reservation-series": ["read"],
			});
			return moveReservationSeries({
				input: input as Parameters<typeof moveReservationSeries>[0]["input"],
				idempotencyKeyHeader: context.headers.get("idempotency-key"),
			});
		}),
	};
}
