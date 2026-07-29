import { eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import {
	extractClientInfo,
	requireAdminAccess,
	throwRpcError,
} from "../../shared/orpc";
import { rpc } from "../../shared/orpc/context";
import {
	cancelStaffDeskCase,
	checkInStaffDeskCase,
	completeStaffDeskCase,
	getStaffDeskQueue,
	reviewStaffDeskCase,
} from "./staff-desk.service";

function hasStaffRole(role: string | null | undefined) {
	return (role ?? "")
		.split(",")
		.map((item) => item.trim())
		.includes("staff");
}

async function requireActiveDeskStaff(headers: Headers) {
	const session = await requireAdminAccess(headers, {
		booking: ["read", "update", "confirm", "release"],
	});
	if (!hasStaffRole(session.user.role)) {
		throwRpcError(
			"FORBIDDEN",
			403,
			"La mesa de atención solo está disponible para funcionarios asignados",
		);
	}

	const profile = await db.query.staffProfile.findFirst({
		where: eq(schema.staffProfile.userId, session.user.id),
	});
	if (!profile?.isActive) {
		throwRpcError(
			"FORBIDDEN",
			403,
			"El perfil operativo del funcionario no está activo",
		);
	}

	return session;
}

export function createStaffDeskRouter() {
	return {
		queue: rpc.handler(async ({ context, input }) => {
			const session = await requireActiveDeskStaff(context.headers);
			const payload = (input ?? {}) as { date?: string };
			if (!payload.date) {
				throwRpcError("MISSING_REQUIRED_FIELDS", 422, "date es requerido");
			}
			return getStaffDeskQueue({
				staffUserId: session.user.id,
				date: payload.date,
			});
		}),
		checkIn: rpc.handler(async ({ context, input }) => {
			const session = await requireActiveDeskStaff(context.headers);
			const clientInfo = extractClientInfo(context.headers);
			return checkInStaffDeskCase({
				bookingId: (input as { bookingId?: string })?.bookingId ?? "",
				staffUserId: session.user.id,
				...clientInfo,
			});
		}),
		review: rpc.handler(async ({ context, input }) => {
			const session = await requireActiveDeskStaff(context.headers);
			const clientInfo = extractClientInfo(context.headers);
			const payload = (input ?? {}) as Parameters<
				typeof reviewStaffDeskCase
			>[0];
			return reviewStaffDeskCase({
				...payload,
				staffUserId: session.user.id,
				...clientInfo,
			});
		}),
		complete: rpc.handler(async ({ context, input }) => {
			const session = await requireActiveDeskStaff(context.headers);
			const clientInfo = extractClientInfo(context.headers);
			return completeStaffDeskCase({
				bookingId: (input as { bookingId?: string })?.bookingId ?? "",
				staffUserId: session.user.id,
				...clientInfo,
			});
		}),
		cancel: rpc.handler(async ({ context, input }) => {
			const session = await requireActiveDeskStaff(context.headers);
			const clientInfo = extractClientInfo(context.headers);
			const payload = (input ?? {}) as { bookingId?: string; reason?: string };
			return cancelStaffDeskCase({
				bookingId: payload.bookingId ?? "",
				reason: payload.reason ?? "",
				staffUserId: session.user.id,
				...clientInfo,
			});
		}),
	};
}
