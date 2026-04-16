/**
 * Barrel re-export for backward compatibility.
 *
 * The shared module has been partitioned into focused submodules:
 * - errors.ts        — ORPCError throwing helpers, capacity conflict, idempotency-aware errors
 * - auth-guards.ts   — requireAdminAccess, permission checks
 * - idempotency.ts   — Idempotency key parsing, checking, storing, hashPayload
 * - concurrency.ts   — Optimistic concurrency, If-Match, booking state guards
 * - rrule.ts         — Recurrence rule parsing, occurrence generation
 *
 * Existing imports from "../shared" continue to work unchanged.
 */

export type { PermissionMap } from "./auth-guards";
export { requireAdminAccess } from "./auth-guards";
export {
	fallbackErrorCode,
	resolveCachedIdempotencyResponse,
	throwCapacityConflict,
	throwIdempotencyAwareError,
	throwRpcError,
} from "./errors";
export type { IdempotencyCheckResult } from "./idempotency";
export {
	checkIdempotencyKey,
	hashPayload,
	parseBooleanLike,
	parseIdempotencyKey,
	storeIdempotencyKey,
} from "./idempotency";
export {
	assertAdminBookingKind,
	assertMutableState,
	assertOptimisticConcurrency,
	parseIfMatch,
} from "./optimistic-concurrency";
export type { RecurrenceRule } from "./rrule";
export { generateOccurrences, isDateOnOrAfter, parseRRule } from "./rrule";
