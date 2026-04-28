import {
	createCalendarOverride,
	getCalendarOverride,
	listCalendarOverrides,
	removeCalendarOverride,
	updateCalendarOverride,
} from "../../features/schedule/schedule-overrides-admin.service";
import {
	generateScheduleSlots,
	listScheduleSlotsByDate,
} from "../../features/schedule/schedule-slots-admin.service";
import {
	createScheduleTemplate,
	getScheduleTemplate,
	listScheduleTemplates,
	removeScheduleTemplate,
	updateScheduleTemplate,
} from "../../features/schedule/schedule-templates-admin.service";
import { rpc } from "../../shared/orpc/context";
import { extractClientInfo, requireAdminAccess } from "../../shared/orpc";

export function createScheduleRouter() {
	return {
		templates: {
			list: rpc.handler(async ({ context }) => {
				await requireAdminAccess(context.headers, {
					schedule: ["read"],
				});
				return listScheduleTemplates();
			}),
			create: rpc.handler(async ({ context, input }) => {
				await requireAdminAccess(context.headers, {
					schedule: ["read"],
				});
				const clientInfo = extractClientInfo(context.headers);
				return createScheduleTemplate(
					(input ?? {}) as Parameters<typeof createScheduleTemplate>[0],
					clientInfo,
				);
			}),
			get: rpc.handler(async ({ context, input }) => {
				await requireAdminAccess(context.headers, {
					schedule: ["read"],
				});
				const payload = input as { id: string };
				return getScheduleTemplate(payload.id);
			}),
			update: rpc.handler(async ({ context, input }) => {
				await requireAdminAccess(context.headers, {
					schedule: ["read"],
				});
				const clientInfo = extractClientInfo(context.headers);
				return updateScheduleTemplate(
					input as Parameters<typeof updateScheduleTemplate>[0],
					clientInfo,
				);
			}),
			remove: rpc.handler(async ({ context, input }) => {
				await requireAdminAccess(context.headers, {
					schedule: ["read"],
				});
				const payload = input as { id: string };
				const clientInfo = extractClientInfo(context.headers);
				return removeScheduleTemplate(payload.id, clientInfo);
			}),
		},
		overrides: {
			list: rpc.handler(async ({ context, input }) => {
				await requireAdminAccess(context.headers, {
					schedule: ["read"],
				});
				return listCalendarOverrides(
					(input ?? {}) as Parameters<typeof listCalendarOverrides>[0],
				);
			}),
			create: rpc.handler(async ({ context, input }) => {
				const session = await requireAdminAccess(context.headers, {
					schedule: ["read"],
				});
				const clientInfo = extractClientInfo(context.headers);
				return createCalendarOverride({
					input: (input ?? {}) as Parameters<
						typeof createCalendarOverride
					>[0]["input"],
					createdByUserId: session.user.id,
					...clientInfo,
				});
			}),
			get: rpc.handler(async ({ context, input }) => {
				await requireAdminAccess(context.headers, {
					schedule: ["read"],
				});
				const payload = input as { id: string };
				return getCalendarOverride(payload.id);
			}),
			update: rpc.handler(async ({ context, input }) => {
				await requireAdminAccess(context.headers, {
					schedule: ["read"],
				});
				const clientInfo = extractClientInfo(context.headers);
				return updateCalendarOverride(
					input as Parameters<typeof updateCalendarOverride>[0],
					clientInfo,
				);
			}),
			remove: rpc.handler(async ({ context, input }) => {
				await requireAdminAccess(context.headers, {
					schedule: ["read"],
				});
				const payload = input as { id: string };
				const clientInfo = extractClientInfo(context.headers);
				return removeCalendarOverride(payload.id, clientInfo);
			}),
		},
		slots: {
			generate: rpc.handler(async ({ context, input }) => {
				await requireAdminAccess(context.headers, {
					schedule: ["read"],
				});
				return generateScheduleSlots({
					...((input ?? {}) as Parameters<typeof generateScheduleSlots>[0]),
					ifNoneMatchHeader: context.headers.get("if-none-match"),
				});
			}),
			list: rpc.handler(async ({ context, input }) => {
				await requireAdminAccess(context.headers, {
					schedule: ["read"],
				});
				const payload = (input ?? {}) as { date?: string };
				return listScheduleSlotsByDate(payload.date);
			}),
		},
	};
}
