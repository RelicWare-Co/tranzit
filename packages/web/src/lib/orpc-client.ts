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

type AdminBookingReleaseInput = {
	id: string;
	reason: "cancelled" | "expired" | "attended";
};

type AdminBookingReassignInput = {
	id: string;
	targetStaffUserId: string;
};

type AdminBookingReassignPreviewInput = {
	id: string;
	targetStaffUserId: string;
};

type AdminBookingAvailabilityCheckInput = {
	slotId: string;
	staffUserId: string;
};

type AdminCapacityConflict = {
	type: string;
	details: string;
};

type AdminCapacityCheckResponse = {
	available: boolean;
	conflicts: AdminCapacityConflict[];
	[key: string]: unknown;
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

type AdminStaffDateOverride = {
	id: string;
	staffUserId: string;
	overrideDate: string;
	isAvailable: boolean;
	capacityOverride: number | null;
	availableStartTime: string | null;
	availableEndTime: string | null;
	notes: string | null;
	createdByUserId: string;
	createdAt: string | Date;
	updatedAt: string | Date;
};

type AdminStaffDateOverridesListInput = {
	userId: string;
	date?: string;
};

type AdminStaffDateOverrideCreateInput = {
	userId: string;
	overrideDate: string;
	isAvailable?: boolean;
	capacityOverride?: number;
	availableStartTime?: string | null;
	availableEndTime?: string | null;
	notes?: string | null;
};

type AdminStaffDateOverrideUpdateInput = {
	userId: string;
	overrideId: string;
	overrideDate?: string;
	isAvailable?: boolean;
	capacityOverride?: number;
	availableStartTime?: string | null;
	availableEndTime?: string | null;
	notes?: string | null;
};

type AdminStaffEffectiveAvailabilityInput = {
	userId: string;
	date: string;
};

type AdminStaffEffectiveAvailabilityResponse = {
	userId: string;
	date: string;
	isAvailable: boolean;
	reason: string;
	dailyCapacity: number;
	availableWindow: unknown;
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

type AdminScheduleTemplate = {
	id: string;
	weekday: number;
	isEnabled: boolean;
	morningStart: string | null;
	morningEnd: string | null;
	afternoonStart: string | null;
	afternoonEnd: string | null;
	slotDurationMinutes: number;
	bufferMinutes: number;
	slotCapacityLimit: number | null;
	notes: string | null;
	createdAt: string | Date;
	updatedAt: string | Date;
};

type AdminScheduleTemplateCreateInput = {
	weekday: number;
	slotDurationMinutes: number;
	bufferMinutes?: number;
	slotCapacityLimit?: number | null;
	isEnabled?: boolean;
	morningStart?: string | null;
	morningEnd?: string | null;
	afternoonStart?: string | null;
	afternoonEnd?: string | null;
	notes?: string | null;
};

type AdminScheduleTemplateUpdateInput = {
	id: string;
	weekday?: number;
	slotDurationMinutes?: number;
	bufferMinutes?: number;
	slotCapacityLimit?: number | null;
	isEnabled?: boolean;
	morningStart?: string | null;
	morningEnd?: string | null;
	afternoonStart?: string | null;
	afternoonEnd?: string | null;
	notes?: string | null;
};

type AdminCalendarOverride = {
	id: string;
	overrideDate: string;
	isClosed: boolean;
	morningEnabled: boolean;
	morningStart: string | null;
	morningEnd: string | null;
	afternoonEnabled: boolean;
	afternoonStart: string | null;
	afternoonEnd: string | null;
	slotDurationMinutes: number | null;
	bufferMinutes: number | null;
	slotCapacityLimit: number | null;
	reason: string | null;
	createdByUserId: string;
	createdAt: string | Date;
	updatedAt: string | Date;
};

type AdminCalendarOverrideCreateInput = {
	overrideDate: string;
	isClosed?: boolean;
	morningEnabled?: boolean;
	morningStart?: string | null;
	morningEnd?: string | null;
	afternoonEnabled?: boolean;
	afternoonStart?: string | null;
	afternoonEnd?: string | null;
	slotDurationMinutes?: number | null;
	bufferMinutes?: number | null;
	slotCapacityLimit?: number | null;
	reason?: string | null;
};

type AdminCalendarOverrideUpdateInput = {
	id: string;
	overrideDate?: string;
	isClosed?: boolean;
	morningEnabled?: boolean;
	morningStart?: string | null;
	morningEnd?: string | null;
	afternoonEnabled?: boolean;
	afternoonStart?: string | null;
	afternoonEnd?: string | null;
	slotDurationMinutes?: number | null;
	bufferMinutes?: number | null;
	slotCapacityLimit?: number | null;
	reason?: string | null;
};

type AdminScheduleSlotsGenerateInput = {
	dateFrom: string;
	dateTo: string;
	maxDays?: number;
};

type AdminScheduleSlotsGenerateResponse = {
	dateFrom: string;
	dateTo: string;
	generatedCount: number;
	skippedDatesCount: number;
	generatedSlotIds: string[];
	skippedDates?: string[];
	errors?: Array<{
		date: string;
		code: string;
		message: string;
	}>;
	idempotentReplay: boolean;
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

type CitizenProcedure = {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	isActive: boolean;
	requiresVehicle: boolean;
	allowsPhysicalDocuments: boolean;
	allowsDigitalDocuments: boolean;
	instructions: string | null;
};

type CitizenSlot = {
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

type CitizenSlotsRangeInput = {
	dateFrom?: string;
	days?: number;
};

type CitizenSlotsRangeResponse = {
	dateFrom: string;
	dateTo: string;
	days: number;
	daily: Array<{
		date: string;
		isClosed: boolean;
		generatedFrom: string;
		count: number;
		slots: CitizenSlot[];
	}>;
};

type CitizenBookingSummary = {
	id: string;
	status: string;
	isActive: boolean;
	holdExpiresAt: string | Date | null;
	confirmedAt: string | Date | null;
	cancelledAt: string | Date | null;
	createdAt: string | Date;
	updatedAt: string | Date;
	slot: {
		id: string;
		slotDate: string;
		startTime: string;
		endTime: string;
		status: string;
	} | null;
	request: {
		id: string;
		status: string;
		plate: string | null;
		applicantName: string | null;
		applicantDocument: string | null;
		procedure: {
			id: string;
			slug: string;
			name: string;
			description: string | null;
		} | null;
	} | null;
};

type CitizenBookingHoldInput = {
	procedureTypeId: string;
	slotId: string;
	plate?: string;
	applicantName: string;
	applicantDocument: string;
	documentType?: string;
	phone?: string;
	email?: string;
	notes?: string;
};

type CitizenBookingHoldResponse = {
	requestId: string;
	booking: CitizenBookingSummary;
};

type RequestDocument = {
	id: string;
	requestId: string;
	requirementKey: string;
	label: string;
	deliveryMode: string;
	storageKey: string | null;
	fileName: string | null;
	mimeType: string | null;
	fileSizeBytes: number | null;
	status: string;
	isCurrent: boolean;
	replacesDocumentId: string | null;
	reviewedByUserId: string | null;
	reviewedAt: string | Date | null;
	notes: string | null;
	createdAt: string | Date;
	updatedAt: string | Date;
};

type DocumentUploadInput = {
	requestId: string;
	requirementKey: string;
	label: string;
	deliveryMode: "digital" | "physical";
	fileName: string;
	mimeType: string;
	fileSizeBytes: number;
	content: string;
};

type DocumentUploadResponse = {
	id: string;
	requestId: string;
	requirementKey: string;
	label: string;
	deliveryMode: string;
	storageKey: string;
	fileName: string;
	mimeType: string;
	fileSizeBytes: number;
	status: string;
	isCurrent: boolean;
	createdAt: string | Date;
};

type DocumentDeclarePhysicalInput = {
	requestId: string;
	requirementKey: string;
	label: string;
};

type DocumentDeclarePhysicalResponse = {
	id: string;
	requestId: string;
	requirementKey: string;
	label: string;
	deliveryMode: string;
	storageKey: null;
	fileName: null;
	mimeType: null;
	fileSizeBytes: null;
	status: string;
	isCurrent: boolean;
	createdAt: string | Date;
};

type DocumentListInput = {
	requestId: string;
};

type AdminReservationSeries = {
	id: string;
	kind: string;
	recurrenceRule: unknown;
	timezone: string | null;
	isActive: boolean;
	metadata: Record<string, unknown>;
	notes: string | null;
	createdByUserId: string;
	createdAt: string | Date;
	updatedAt: string | Date;
	activeInstanceCount?: number;
};

type AdminReservationSeriesListInput = {
	isActive?: boolean | string;
	kind?: string;
};

type AdminReservationSeriesCreateInput = {
	recurrenceRule: string | Record<string, unknown>;
	slotId: string;
	staffUserId: string;
	startDate: string;
	endDate: string;
	timezone?: string;
	notes?: string | null;
	metadata?: Record<string, unknown>;
};

type AdminReservationSeriesGetResponse = {
	series: AdminReservationSeries;
	instances: unknown[];
};

type AdminReservationSeriesInstancesInput = {
	id: string;
	status?: string;
	isActive?: boolean | string;
};

type AdminReservationSeriesUpdateInput = {
	id: string;
	staffUserId?: string;
	notes?: string | null;
	metadata?: Record<string, unknown>;
	force?: boolean;
};

type AdminReservationSeriesUpdateFromDateInput = {
	id: string;
	effectiveFrom: string;
	staffUserId?: string;
	notes?: string | null;
};

type AdminReservationSeriesReleaseInput = {
	id: string;
	reason?: string;
};

type AdminReservationSeriesMoveInput = {
	id: string;
	targetSlotId: string;
	targetStaffUserId?: string;
};

type AdminReservationInstanceGetInput = {
	bookingId: string;
};

type AdminReservationInstanceUpdateInput = {
	bookingId: string;
	staffUserId?: string;
	notes?: string | null;
};

type AdminReservationInstanceReleaseInput = {
	bookingId: string;
	reason?: string;
};

type AdminReservationInstanceMoveInput = {
	bookingId: string;
	targetSlotId: string;
	targetStaffUserId?: string;
};

export interface TranzitRpcClient {
	// biome-ignore lint/suspicious/noExplicitAny: required to satisfy @orpc NestedClient generic constraint
	[key: string]: any;
	session: {
		get: RpcProcedure<SessionResponse>;
	};
	documents: {
		upload: RpcProcedure<DocumentUploadResponse, DocumentUploadInput>;
		declarePhysical: RpcProcedure<
			DocumentDeclarePhysicalResponse,
			DocumentDeclarePhysicalInput
		>;
		list: RpcProcedure<RequestDocument[], DocumentListInput>;
		admin: {
			list: RpcProcedure<RequestDocument[], DocumentListInput>;
			get: RpcProcedure<RequestDocument, { documentId: string }>;
			download: RpcProcedure<
				{
					content: ArrayBuffer;
					fileName: string;
					mimeType: string;
					fileSizeBytes: number;
				},
				{ documentId: string }
			>;
			review: RpcProcedure<
				{
					id: string;
					requestId: string;
					requirementKey: string;
					label: string;
					deliveryMode: string;
					status: string;
					notes: string | null;
					reviewedByUserId: string | null;
					reviewedAt: string | Date | null;
					isCurrent: boolean;
					updatedAt: string | Date;
				},
				{
					documentId: string;
					action: "approve" | "reject" | "start_review";
					notes?: string;
				}
			>;
		};
	};
	citizen: {
		procedures: {
			list: RpcProcedure<CitizenProcedure[]>;
		};
		slots: {
			range: RpcProcedure<CitizenSlotsRangeResponse, CitizenSlotsRangeInput>;
		};
		bookings: {
			hold: RpcProcedure<CitizenBookingHoldResponse, CitizenBookingHoldInput>;
			confirm: RpcProcedure<CitizenBookingSummary, { bookingId: string }>;
			cancel: RpcProcedure<CitizenBookingSummary, { bookingId: string }>;
			mine: RpcProcedure<
				CitizenBookingSummary[],
				{ includeInactive?: boolean }
			>;
		};
	};
	admin: {
		onboarding: {
			status: RpcProcedure<OnboardingStatusResponse>;
			bootstrap: RpcProcedure<OnboardingBootstrapResponse>;
		};
		schedule: {
			templates: {
				list: RpcProcedure<AdminScheduleTemplate[]>;
				create: RpcProcedure<
					AdminScheduleTemplate,
					AdminScheduleTemplateCreateInput
				>;
				get: RpcProcedure<AdminScheduleTemplate, { id: string }>;
				update: RpcProcedure<
					AdminScheduleTemplate,
					AdminScheduleTemplateUpdateInput
				>;
				remove: RpcProcedure<{ success: boolean }, { id: string }>;
			};
			overrides: {
				list: RpcProcedure<AdminCalendarOverride[], { date?: string }>;
				create: RpcProcedure<
					AdminCalendarOverride,
					AdminCalendarOverrideCreateInput
				>;
				get: RpcProcedure<AdminCalendarOverride, { id: string }>;
				update: RpcProcedure<
					AdminCalendarOverride,
					AdminCalendarOverrideUpdateInput
				>;
				remove: RpcProcedure<{ success: boolean }, { id: string }>;
			};
			slots: {
				generate: RpcProcedure<
					AdminScheduleSlotsGenerateResponse,
					AdminScheduleSlotsGenerateInput
				>;
				list: RpcProcedure<AdminScheduleSlotsListResponse, { date: string }>;
			};
		};
		staff: {
			list: RpcProcedure<AdminStaffProfile[], { isActive?: boolean | string }>;
			create: RpcProcedure<AdminStaffProfile, AdminStaffCreateInput>;
			get: RpcProcedure<AdminStaffProfile, { userId: string }>;
			update: RpcProcedure<AdminStaffProfile, AdminStaffUpdateInput>;
			remove: RpcProcedure<{ success: boolean }, { userId: string }>;
			dateOverrides: {
				list: RpcProcedure<
					AdminStaffDateOverride[],
					AdminStaffDateOverridesListInput
				>;
				create: RpcProcedure<
					AdminStaffDateOverride,
					AdminStaffDateOverrideCreateInput
				>;
				get: RpcProcedure<
					AdminStaffDateOverride,
					{ userId: string; overrideId: string }
				>;
				update: RpcProcedure<
					AdminStaffDateOverride,
					AdminStaffDateOverrideUpdateInput
				>;
				remove: RpcProcedure<
					{ success: boolean },
					{ userId: string; overrideId: string }
				>;
			};
			effectiveAvailability: RpcProcedure<
				AdminStaffEffectiveAvailabilityResponse,
				AdminStaffEffectiveAvailabilityInput
			>;
		};
		bookings: {
			list: RpcProcedure<AdminBooking[], AdminBookingsListInput>;
			create: RpcProcedure<AdminBooking | null, AdminBookingsCreateInput>;
			get: RpcProcedure<AdminBooking, { id: string }>;
			capacity: RpcProcedure<AdminCapacityCheckResponse, { id: string }>;
			confirm: RpcProcedure<AdminBooking, { id: string }>;
			release: RpcProcedure<
				{ booking: AdminBooking | null; alreadyReleased: boolean },
				AdminBookingReleaseInput
			>;
			reassign: RpcProcedure<AdminBooking, AdminBookingReassignInput>;
			reassignPreview: RpcProcedure<
				{ dryRun: true; [key: string]: unknown },
				AdminBookingReassignPreviewInput
			>;
			reassignmentsPreview: RpcProcedure<
				AdminBookingReassignmentsPreview,
				AdminBookingReassignmentsInput
			>;
			reassignmentsApply: RpcProcedure<
				AdminBookingReassignmentsApplyResult,
				AdminBookingReassignmentsApplyInput
			>;
			availabilityCheck: RpcProcedure<
				AdminCapacityCheckResponse,
				AdminBookingAvailabilityCheckInput
			>;
		};
		procedures: {
			list: RpcProcedure<ProcedureType[], { isActive?: boolean | string }>;
			get: RpcProcedure<ProcedureType, { id: string }>;
			create: RpcProcedure<ProcedureType, ProcedureCreateInput>;
			update: RpcProcedure<ProcedureType, ProcedureUpdateInput>;
			remove: RpcProcedure<ProcedureRemoveResponse, { id: string }>;
		};
		reservationSeries: {
			create: RpcProcedure<unknown, AdminReservationSeriesCreateInput>;
			list: RpcProcedure<
				AdminReservationSeries[],
				AdminReservationSeriesListInput
			>;
			get: RpcProcedure<AdminReservationSeriesGetResponse, { id: string }>;
			instances: RpcProcedure<unknown[], AdminReservationSeriesInstancesInput>;
			update: RpcProcedure<unknown, AdminReservationSeriesUpdateInput>;
			updateFromDate: RpcProcedure<
				unknown,
				AdminReservationSeriesUpdateFromDateInput
			>;
			release: RpcProcedure<unknown, AdminReservationSeriesReleaseInput>;
			move: RpcProcedure<unknown, AdminReservationSeriesMoveInput>;
		};
		reservations: {
			get: RpcProcedure<unknown, AdminReservationInstanceGetInput>;
			update: RpcProcedure<unknown, AdminReservationInstanceUpdateInput>;
			release: RpcProcedure<unknown, AdminReservationInstanceReleaseInput>;
			move: RpcProcedure<unknown, AdminReservationInstanceMoveInput>;
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
