import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import {
	createTanstackQueryUtils,
	TANSTACK_QUERY_OPERATION_CONTEXT_SYMBOL,
	type TanstackQueryOperationContext,
} from "@orpc/tanstack-query";

type SessionResponse = {
	user: {
		id: string;
		name: string;
		email: string;
		role?: string | null;
		image?: string | null;
	};
	session: {
		id: string;
	};
};

type OnboardingStatusResponse = {
	adminExists: boolean;
};

type OnboardingBootstrapResponse = {
	success: boolean;
	role: string;
};

type RpcProcedure<TOutput, TInput = undefined> = (
	input?: TInput,
) => Promise<TOutput>;

type BookingKind = "citizen" | "administrative";

type AdminBooking = {
	id: string;
	slotId: string;
	staffUserId: string | null;
	requestId: string | null;
	citizenUserId: string | null;
	kind: BookingKind;
	status: string;
	isActive: boolean;
	holdExpiresAt: string | Date | null;
	attendedAt: string | Date | null;
	notes: string | null;
	createdAt: string | Date;
	updatedAt: string | Date;
	slot: {
		id: string;
		slotDate: string;
		startTime: string;
		endTime: string;
	} | null;
	staff: {
		id: string;
		name: string | null;
		email: string;
	} | null;
};

type AdminBookingsListInput = {
	slotId?: string;
	staffUserId?: string;
	requestId?: string;
	citizenUserId?: string;
	kind?: BookingKind;
	status?: string;
	isActive?: boolean;
	dateFrom?: string;
	dateTo?: string;
};

type AdminBookingsCreateInput = {
	slotId: string;
	staffUserId: string;
	kind: BookingKind;
	requestId?: string;
	citizenUserId?: string;
	holdExpiresAt?: string;
	holdToken?: string;
};

type AdminStaffProfile = {
	userId: string;
	isActive: boolean;
	isAssignable: boolean;
	defaultDailyCapacity: number;
	user: {
		id: string;
		name: string | null;
		email: string;
		role: string | null;
	} | null;
};

type AdminScheduleSlot = {
	id: string;
	slotDate: string;
	startTime: string;
	endTime: string;
	status: string;
	capacityLimit: number | null;
	reservedCount: number;
	remainingCapacity: number | null;
	generatedFrom: string;
};

type AdminScheduleSlotsListResponse = {
	date: string;
	slots: AdminScheduleSlot[];
	generatedFrom: string;
	isClosed: boolean;
	count: number;
};

type ProcedureType = {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	isActive: boolean;
	configVersion: number;
	requiresVehicle: boolean;
	allowsPhysicalDocuments: boolean;
	allowsDigitalDocuments: boolean;
	instructions: string | null;
};

export interface TranzitRpcClient {
	session: {
		get: RpcProcedure<SessionResponse>;
	};
	admin: {
		onboarding: {
			status: RpcProcedure<OnboardingStatusResponse>;
			bootstrap: RpcProcedure<OnboardingBootstrapResponse>;
		};
		schedule: {
			slots: {
				list: RpcProcedure<AdminScheduleSlotsListResponse, { date: string }>;
			};
		};
		staff: {
			list: RpcProcedure<AdminStaffProfile[], { isActive?: boolean | string }>;
		};
		bookings: {
			list: RpcProcedure<AdminBooking[], AdminBookingsListInput>;
			create: RpcProcedure<AdminBooking | null, AdminBookingsCreateInput>;
		};
		procedures: {
			list: RpcProcedure<ProcedureType[], { isActive?: boolean | string }>;
		};
	};
}

type RpcQueryContext = TanstackQueryOperationContext;

export const orpcClient = createORPCClient<TranzitRpcClient>(
	new RPCLink<RpcQueryContext>({
		url: "/api/rpc",
		method: ({ context }) => {
			const operationType =
				context[TANSTACK_QUERY_OPERATION_CONTEXT_SYMBOL]?.type;

			// TanStack Query marks reads as non-mutations, so keep them on GET.
			if (operationType && operationType !== "mutation") {
				return "GET";
			}

			return "POST";
		},
	}),
);

export const orpc = createTanstackQueryUtils(orpcClient);
