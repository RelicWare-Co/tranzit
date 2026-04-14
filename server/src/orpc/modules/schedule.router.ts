import {
	createCalendarOverride,
	createScheduleTemplate,
	generateScheduleSlots,
	getCalendarOverride,
	getScheduleTemplate,
	listCalendarOverrides,
	listScheduleSlotsByDate,
	listScheduleTemplates,
	removeCalendarOverride,
	removeScheduleTemplate,
	updateCalendarOverride,
	updateScheduleTemplate,
} from "../../features/schedule/schedule-admin.service";
import { rpc } from "../context";
import { requireAdminAccess } from "../shared";

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
				return createScheduleTemplate(
					(input ?? {}) as Parameters<typeof createScheduleTemplate>[0],
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
				return updateScheduleTemplate(
					input as Parameters<typeof updateScheduleTemplate>[0],
				);
			}),
			remove: rpc.handler(async ({ context, input }) => {
				await requireAdminAccess(context.headers, {
					schedule: ["read"],
				});
				const payload = input as { id: string };
				return removeScheduleTemplate(payload.id);
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
				return createCalendarOverride({
					input: (input ?? {}) as Parameters<
						typeof createCalendarOverride
					>[0]["input"],
					createdByUserId: session.user.id,
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
				return updateCalendarOverride(
					input as Parameters<typeof updateCalendarOverride>[0],
				);
			}),
			remove: rpc.handler(async ({ context, input }) => {
				await requireAdminAccess(context.headers, {
					schedule: ["read"],
				});
				const payload = input as { id: string };
				return removeCalendarOverride(payload.id);
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
