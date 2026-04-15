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

type AdminBookingReassignmentsInput = {
	reassignments: Array<{
		bookingId: string;
		targetStaffUserId: string;
	}>;
};

type AdminBookingReassignmentsApplyInput = AdminBookingReassignmentsInput & {
	executionMode?: "best_effort" | "atomic";
	previewToken?: string;
};

type AdminBookingReassignmentsPreview = {
	dryRun: true;
	previewToken: string;
	eligible: number;
	excluded: number;
	conflicts: number;
	errors: number;
	results: Array<{
		bookingId: string;
		preview: unknown;
	}>;
};

type AdminBookingReassignmentsApplyResult = {
	totalRequested: number;
	successCount: number;
	failureCount: number;
	results: Array<{
		bookingId: string;
		success: boolean;
		error?: string;
	}>;
};

type AdminStaffProfile = {
	userId: string;
	isActive: boolean;
	isAssignable: boolean;
	defaultDailyCapacity: number;
	weeklyAvailability: Record<string, unknown>;
	notes: string | null;
	metadata: Record<string, unknown>;
	createdAt: string | Date;
	updatedAt: string | Date;
	user: {
		id: string;
		name: string | null;
		email: string;
		role: string | null;
	} | null;
};

type AdminStaffCreateInput = {
	userId: string;
	isActive?: boolean;
	isAssignable?: boolean;
	defaultDailyCapacity?: number;
	weeklyAvailability?: unknown;
	notes?: string | null;
	metadata?: Record<string, unknown>;
};

type AdminStaffUpdateInput = {
	userId: string;
	isActive?: boolean;
	isAssignable?: boolean;
	defaultDailyCapacity?: number;
	weeklyAvailability?: unknown;
	notes?: string | null;
	metadata?: Record<string, unknown>;
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
	eligibilitySchema: Record<string, unknown>;
	formSchema: Record<string, unknown>;
	documentSchema: Record<string, unknown>;
	policySchema: Record<string, unknown>;
	createdAt: string | Date;
	updatedAt: string | Date;
};

type ProcedureCreateInput = {
	name: string;
	slug: string;
	description?: string;
	requiresVehicle?: boolean;
	allowsPhysicalDocuments?: boolean;
	allowsDigitalDocuments?: boolean;
	instructions?: string;
	eligibilitySchema?: Record<string, unknown>;
	formSchema?: Record<string, unknown>;
	documentSchema?: Record<string, unknown>;
	policySchema?: Record<string, unknown>;
};

type ProcedureUpdateInput = {
	id: string;
	name?: string;
	description?: string;
	isActive?: boolean;
	requiresVehicle?: boolean;
	allowsPhysicalDocuments?: boolean;
	allowsDigitalDocuments?: boolean;
	instructions?: string;
	eligibilitySchema?: Record<string, unknown>;
	formSchema?: Record<string, unknown>;
	documentSchema?: Record<string, unknown>;
	policySchema?: Record<string, unknown>;
};

type ProcedureRemoveResponse = {
	success: boolean;
	message: string;
	mode?: "soft" | "hard";
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
			create: RpcProcedure<AdminStaffProfile, AdminStaffCreateInput>;
			update: RpcProcedure<AdminStaffProfile, AdminStaffUpdateInput>;
			remove: RpcProcedure<{ success: boolean }, { userId: string }>;
		};
		bookings: {
			list: RpcProcedure<AdminBooking[], AdminBookingsListInput>;
			create: RpcProcedure<AdminBooking | null, AdminBookingsCreateInput>;
			reassignmentsPreview: RpcProcedure<
				AdminBookingReassignmentsPreview,
				AdminBookingReassignmentsInput
			>;
			reassignmentsApply: RpcProcedure<
				AdminBookingReassignmentsApplyResult,
				AdminBookingReassignmentsApplyInput
			>;
		};
		procedures: {
			list: RpcProcedure<ProcedureType[], { isActive?: boolean | string }>;
			get: RpcProcedure<ProcedureType, { id: string }>;
			create: RpcProcedure<ProcedureType, ProcedureCreateInput>;
			update: RpcProcedure<ProcedureType, ProcedureUpdateInput>;
			remove: RpcProcedure<ProcedureRemoveResponse, { id: string }>;
		};
	};
}

type RpcQueryContext = TanstackQueryOperationContext;

const getBaseUrl = () => {
	if (typeof window !== "undefined") {
		return window.location.origin;
	}
	return "http://localhost:3000";
};

export const orpcClient = createORPCClient<TranzitRpcClient>(
	new RPCLink<RpcQueryContext>({
		url: `${getBaseUrl()}/api/rpc`,
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
