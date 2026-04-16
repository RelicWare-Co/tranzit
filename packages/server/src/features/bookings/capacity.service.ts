/**
 * Barrel re-export for backward compatibility.
 *
 * The capacity engine has been decomposed into focused modules:
 * - capacity.types.ts       — Interfaces and type definitions
 * - capacity.utils.ts        — Pure utility functions
 * - capacity-check.service.ts — Read-only capacity queries
 * - capacity-consume.service.ts — Consume, release, confirm operations
 * - capacity-hold.service.ts — Preview token state and drift checks
 * - capacity-reassign.service.ts   — Reassignment preview & execution
 *
 * Existing imports from this module continue to work unchanged.
 */

export type {
	BulkExecutionMode,
	BulkReassignmentPreview,
	BulkReassignmentResult,
	CapacityCheck,
	CapacityConflict,
	CapacityMutationResult,
	DbLike,
	PreviewTokenState,
	ReassignmentPreview,
} from "./capacity.types";

export {
	checkCapacity,
	countActiveSlotBookings,
	countActiveStaffBookingsOnDate,
	getActiveBookingCountForSlot,
	getActiveBookingCountForStaffOnDate,
	resolveStaffAvailabilityAndCapacity,
} from "./capacity-check.service";

export {
	confirmBooking,
	consumeCapacity,
	releaseCapacity,
} from "./capacity-consume.service";
export {
	checkPreviewDrift,
	generatePreviewToken,
	invalidatePreviewToken,
	validatePreviewToken,
} from "./capacity-hold.service";
export {
	executeBulkReassignments,
	previewReassignment,
	previewReassignments,
	reassignBooking,
} from "./capacity-reassign.service";
