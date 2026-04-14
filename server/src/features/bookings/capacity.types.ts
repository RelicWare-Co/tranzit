import type { db } from "../../lib/db";

export type DbLike =
	| typeof db
	| Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface CapacityCheck {
	available: boolean;
	globalCapacity: number | null;
	globalUsed: number;
	globalRemaining: number | null;
	staffCapacity: number;
	staffUsed: number;
	staffRemaining: number;
	conflicts: CapacityConflict[];
}

export interface CapacityConflict {
	type:
		| "GLOBAL_OVER_CAPACITY"
		| "STAFF_OVER_CAPACITY"
		| "STAFF_UNAVAILABLE"
		| "STAFF_NOT_ASSIGNABLE"
		| "REQUEST_ACTIVE_BOOKING_CONFLICT"
		| "HOLD_TOKEN_CONFLICT";
	details: string;
}

export interface CapacityMutationResult {
	success: boolean;
	bookingId?: string;
	conflicts: CapacityConflict[];
	error?: string;
}

export interface ReassignmentPreview {
	canReassign: boolean;
	booking: {
		id: string;
		slotId: string;
		staffUserId: string | null;
		isActive: boolean;
		kind: string;
		requestId: string | null;
	} | null;
	targetStaff: {
		userId: string;
		isActive: boolean;
		isAssignable: boolean;
	} | null;
	slot: {
		id: string;
		slotDate: string;
		startTime: string;
		endTime: string;
	} | null;
	conflicts: CapacityConflict[];
	staleSource: boolean;
	currentActiveBookingId: string | null;
	error?: string;
}

export type BulkExecutionMode = "best_effort" | "atomic";

export interface BulkReassignmentPreview {
	previewToken: string;
	results: Array<{
		bookingId: string;
		preview: ReassignmentPreview;
	}>;
	eligible: string[];
	excluded: Array<{
		bookingId: string;
		reason: string;
	}>;
	conflicts: Array<{
		bookingId: string;
		reason: string;
		conflicts: CapacityConflict[];
	}>;
	errors: Array<{
		bookingId: string;
		error: string;
	}>;
}

export interface BulkReassignmentResult {
	appliedCount: number;
	failedCount: number;
	failures: Array<{
		bookingId: string;
		reason: string;
	}>;
	results: Array<{
		bookingId: string;
		success: boolean;
		error?: string;
	}>;
}

export interface PreviewTokenState {
	token: string;
	createdAt: Date;
	items: Array<{
		bookingId: string;
		targetStaffUserId: string;
		bookingStaffUserId: string | null;
		bookingIsActive: boolean;
		slotId: string;
		requestId: string | null;
		kind: string;
	}>;
}
