# Backend Status (Current Implementation)

Last updated: 2026-04-17

This document describes what the backend **really has implemented today**.
Use it as an operational map before adding or changing backend behavior.

This file complements (not replaces):
- `server/src/db/SCHEMA.md` (domain model + invariants)
- `server/src/db/schema.ts` (actual Drizzle schema)

## 1) Cross-cutting backend behavior

### Runtime and framework
- Runtime: Bun
- HTTP framework: Hono
- ORM/DB: Drizzle + libsql/sqlite
- Structured logging: `hono-pino` + `pino` (global middleware + centralized `onError` logging)
- Auth provider: Better Auth
- Primary business API transport: oRPC at `/api/rpc/*`
- `/api/admin/*` is no longer exposed as a public HTTP surface

### Auth and session
- Better Auth endpoint is mounted on `/api/auth/*`.
- `session.get` is a native oRPC procedure that resolves session via `auth.api.getSession` using request headers.
- `session.get` is available through oRPC (`/api/rpc/session/get`).

### Authorization
- Role-based access control with three roles: `admin`, `staff`, `auditor`.
- Roles and permissions are defined in `server/src/features/auth/auth.permissions.ts` using Better Auth's Access Control system.
- `/api/auth/admin/*` requires `admin` role.
- Admin domain access via oRPC requires at least one of: `admin`, `staff`, `auditor`.
- Each domain module has granular permission guards:
  - schedule requires `schedule: ["read"]`
  - staff requires `staff: ["read"]`
  - bookings requires `booking: ["read"]`
  - reservation-series requires `reservation-series: ["read"]`
  - reservations requires `reservation-series: ["read"]`
- Permission verification uses `auth.api.userHasPermission` server-side.
- Middleware helpers in `server/src/middlewares/authorization.ts`:
  - `requirePermissions(permissions)` — checks granular permissions
  - `requireRole(...roles)` — checks user has at least one role

### CORS
- CORS is applied for `/api/auth/*` and `/api/rpc/*`.
- Allowed origin comes from `CORS_ORIGIN` (default `http://localhost:3000`).
- Credentials are only allowed for the exact configured origin.

### OTP protections
- Better Auth email OTP plugin is enabled (`admin()` + `emailOTP()`).
- OTP behavior is configurable by env:
  - `AUTH_OTP_LENGTH`
  - `AUTH_OTP_EXPIRES_IN`
  - `AUTH_OTP_ALLOWED_ATTEMPTS`
- Additional per-email rate limit exists for OTP send endpoint:
  - `POST /api/auth/email-otp/send-verification-otp`
  - limit: 3 requests per 60s window per email (in-memory)

### Admin onboarding
- Available via oRPC:
  - `admin.onboarding.bootstrap`
  - `admin.onboarding.status`
- Business rule is unchanged:
  - elevates authenticated user to `admin` only when no admins exist yet
  - status returns `{ adminExists: boolean }`

### oRPC surface
- The backend exposes admin/session capabilities through an oRPC router mounted at `/api/rpc/*`.
- oRPC is now the only public transport for admin domain APIs.
- Session and admin onboarding are implemented as native oRPC procedures.
- Schedule, staff, bookings, reservation-series and reservations operations are implemented as native oRPC procedures.
- Citizen-facing procedures for slot discovery and booking lifecycle are available through native oRPC procedures.

## 2) Domain modules and active procedures

All domain operations below are reachable through oRPC procedures (served under `/api/rpc/*`).
Admin modules remain admin-protected; citizen modules require authenticated session.

### 2.1 Schedule module (`server/src/orpc/modules/schedule.router.ts`)

- `admin.schedule.templates.list`
- `admin.schedule.templates.create`
- `admin.schedule.templates.get`
- `admin.schedule.templates.update`
- `admin.schedule.templates.remove`
- `admin.schedule.overrides.list`
- `admin.schedule.overrides.create`
- `admin.schedule.overrides.get`
- `admin.schedule.overrides.update`
- `admin.schedule.overrides.remove`
- `admin.schedule.slots.generate`
- `admin.schedule.slots.list`

Key behavior already implemented:
- strict validation for dates, time windows, slot duration, buffers, and capacity
- precedence `calendar_override > schedule_template`
- slot generation by window with buffer support
- guarded handling of invalid schedule configuration during generation

### 2.2 Staff module (`server/src/orpc/modules/staff.router.ts`)

- `admin.staff.list`
- `admin.staff.create`
- `admin.staff.get`
- `admin.staff.update`
- `admin.staff.remove`
- `admin.staff.dateOverrides.list`
- `admin.staff.dateOverrides.create`
- `admin.staff.dateOverrides.get`
- `admin.staff.dateOverrides.update`
- `admin.staff.dateOverrides.remove`
- `admin.staff.effectiveAvailability`

Key behavior already implemented:
- validation of `weeklyAvailability` structure and windows
- date overrides with partial-day windows and capacity override
- deletion guard when staff has active bookings
- effective availability/capacity resolution by profile + date overrides

### 2.3 Bookings module (`server/src/orpc/modules/bookings.router.ts`)

- `admin.bookings.create`
- `admin.bookings.list` (filters include `dateFrom` and `dateTo`)
- `admin.bookings.get`
- `admin.bookings.capacity`
- `admin.bookings.confirm`
- `admin.bookings.release`
- `admin.bookings.reassign`
- `admin.bookings.reassignPreview`
- `admin.bookings.reassignmentsPreview`
- `admin.bookings.reassignmentsApply`
- `admin.bookings.availabilityCheck`

Key behavior already implemented:
- booking create integrated with capacity engine
- release is idempotent
- confirm checks hold state and hold expiration
- single and bulk reassignment flows
- batch mode support: `best_effort` and `atomic`
- preview token and drift detection for bulk reassignment apply

### 2.4 Procedures module (`server/src/orpc/modules/procedures.router.ts`)

- `admin.procedures.list`
- `admin.procedures.get`
- `admin.procedures.create`
- `admin.procedures.update`
- `admin.procedures.remove`

Key behavior already implemented:
- list procedure types sorted by name
- optional `isActive` filter
- get procedure by ID
- create with slug validation and deduplication
- update with config version increment on schema-impacting changes
- remove with soft-delete guard when service requests exist
- **audit events for all mutations**: create, update, and delete (both soft and hard delete) create `audit_event` entries with `action` and `payload`

### 2.5 Reservation series module (`server/src/orpc/modules/reservation-series.router.ts`, `server/src/orpc/modules/reservations.router.ts`)

Series procedures:
- `admin.reservationSeries.create`
- `admin.reservationSeries.list`
- `admin.reservationSeries.get`
- `admin.reservationSeries.instances`
- `admin.reservationSeries.update`
- `admin.reservationSeries.updateFromDate`
- `admin.reservationSeries.release`
- `admin.reservationSeries.move`

Instance procedures:
- `admin.reservations.get`
- `admin.reservations.update`
- `admin.reservations.release`
- `admin.reservations.move`

Key behavior already implemented:
- recurrence parsing (RRULE string and object support)
- occurrence generation with weekly `BYDAY` handling
- idempotency-key support in mutating series/instance endpoints
- optimistic concurrency via `If-Match` for PATCH series/instance
- detached instance behavior for per-instance PATCH vs series PATCH
- atomic move operations for series and single instance

### 2.6 Citizen portal module (`server/src/orpc/modules/citizen.router.ts`)

- `citizen.procedures.list`
- `citizen.slots.range`
- `citizen.bookings.hold`
- `citizen.bookings.confirm`
- `citizen.bookings.cancel`
- `citizen.bookings.mine`

Key behavior already implemented:
- **Email notifications on booking lifecycle events**:
  - `citizen.bookings.confirm` sends a confirmation email with procedure name, date/time, staff name, and applicant details
  - `citizen.bookings.cancel` sends a cancellation notification email
  - Hold expiration triggers a notification email in both paths:
    - `expireStaleCitizenHolds()` sends email before releasing each expired hold
    - `confirmBooking()` sends email when detecting an expired hold before returning error
- All notification events create `notification_delivery` records with status tracking (`pending` → `sent`/`failed`)
- Email sending is non-blocking; failures are logged but do not affect the booking operation
- Templates include HTML and plain-text versions with inline styles for email compatibility

### 2.6.1 Notification module (`server/src/features/notifications/`)

Email notification service:
- `sendBookingConfirmationEmail` — sends confirmation email with booking details
- `sendBookingCancellationEmail` — sends cancellation email
- `sendHoldExpirationEmail` — sends hold expiration notice
- `sendOtpNotification` — sends OTP email (sign-in, email-verification, forget-password, change-email)
- All functions create `notification_delivery` records with template key, recipient, status, and payload

Templates:
- `booking-confirmation` — includes procedure name, appointment date/time, staff name, applicant info
- `booking-cancellation` — includes procedure name, cancelled appointment details
- `booking-hold-expired` — informs citizen that hold expired without confirmation
- `otp-sign-in`, `otp-email-verification`, `otp-forget-password`, `otp-change-email` — OTP templates with code display

Key behavior:
- **OTP notifications are tracked**: `sendVerificationOtpEmail` in `auth.mailer.ts` routes through `sendOtpNotification`, which creates `notification_delivery` records with `entityType=user` and `entityId=email`
- All notification sends update status to `sent` or `failed` with attempt tracking

### 2.7 Citizen documents module (`server/src/orpc/modules/documents.router.ts`)

Citizen endpoints:
- `documents.upload` — Upload a document for a service request
- `documents.declarePhysical` — Declare a document as physically delivered (creates row with deliveryMode=physical, status=marked_as_physical)
- `documents.list` — List documents for a service request

Admin endpoints:
- `documents.admin.list` — List all documents for a request with review fields
- `documents.admin.listAll` — List all documents across requests (with optional status filter) for document review page
- `documents.admin.get` — Get document details by ID
- `documents.admin.download` — Download document file (oRPC handler)
- `documents.admin.review` — Review a document (approve/reject/start_review) with notes

HTTP endpoints:
- `GET /api/admin/documents/:documentId/download` — Download document file with proper MIME headers

Key behavior already implemented:
- MIME type validation (PDF, PNG, JPG only)
- File size limit (10MB maximum)
- Base64 content encoding validation
- Storage key generation with format: `documents/{requestId}/{timestamp}-{random}-{filename}`
- **File persistence to disk** at storage key path (e.g., `uploads/documents/{requestId}/{timestamp}-{random}-{filename}`)
- Creates `request_document` row with `status=pending`, `isCurrent=true`
- Automatically marks previous documents for same `requirementKey` as not current
- Ownership verification (only service request owner can upload/view documents)
- Admin document download serves file with correct `Content-Type` header
- Admin download requires admin/staff/auditor role
- Physical declaration (`declarePhysical`) creates row with `deliveryMode=physical`, `status=marked_as_physical`, no storageKey
- Physical declaration also marks previous documents for same requirement as not current

Key behavior already implemented:
- review actions: approve (sets status=valid), reject (requires non-empty notes, sets status=rejected), start_review (sets status=in_review)
- validates status transitions (e.g., cannot approve a document already approved)
- physical-marked documents cannot be directly approved without prior state change
- re-review allowed (can approve a previously rejected document)
- creates audit_event on every review action
- sets reviewedByUserId and reviewedAt on review
- authenticated citizen booking lifecycle over OTP session (hold/confirm/cancel/list)
- stale hold cleanup before citizen reads/mutations (automatic release on expiry)
- automatic staff assignment for citizen holds using capacity checks
- citizen hold assignment only considers assignable staff profiles with a valid backing `user` row (prevents FK failures on booking insert)
- real-time slot availability exposure based on generated schedule slots and active bookings
- `service_request` creation with config/version snapshot at booking-hold time
- strict `citizen.slots.range` date validation for `dateFrom` (format `YYYY-MM-DD` plus real calendar date)
- `citizen.bookings.hold` rejects whitespace-only required identity fields (`applicantName`, `applicantDocument`)
- `citizen.bookings.hold` applies normalized/validated Zod output for downstream persistence and booking creation

### 2.8 Service Requests module (`server/src/orpc/modules/service-requests.router.ts`)

- `admin.serviceRequests.list` — List all service requests with pagination and filters
- `admin.serviceRequests.get` — Get full details of a single service request including snapshots and linked booking
- `admin.serviceRequests.updateStatus` — Transition service request status with eligibility checks

Input filters for `list`:
- `status` (string | string[]) — Filter by one or more statuses
- `procedureTypeId` (string) — Filter by procedure type
- `citizenUserId` (string) — Filter by citizen user
- `email` (string) — Filter by email
- `limit` (number, default 50) — Page size
- `offset` (number, default 0) — Page offset
- `orderBy` ("createdAt" | "updatedAt" | "status", default "createdAt")
- `orderDir` ("asc" | "desc", default "desc")

Status transition rules:
- Valid transitions: `draft → booking_held → verified → pending_confirmation → confirmed`
- Any status can transition to `cancelled`
- `confirmed` and `cancelled` are terminal states

Eligibility checks:
- `verified` requires: `booking_confirmed` (active booking status = "confirmed") and `documents_valid` (all current documents for the request are valid or marked_as_physical)
- `pending_confirmation` requires: `eligibility_passed` (explicit eligibility data with `passed: true`)

Key behavior already implemented:
- Atomic status + timestamp updates (verifiedAt, confirmedAt, cancelledAt set appropriately)
- Creates `audit_event` on every status change with action `status_<from>_to_<to>`
- Returns 400 with `INVALID_TRANSITION` for disallowed state changes
- Returns 400 with `ELIGIBILITY_FAILED` when eligibility checks fail
- Config version (`procedureConfigVersion`) captured at request creation time
- Procedure snapshot preserved at request creation

### 2.9 Audit module (`server/src/orpc/modules/audit.router.ts`)

- `admin.audit.list` — List audit events with pagination and filters
- `admin.audit.get` — Get a single audit event by ID

Input filters for `list`:
- `entityType` (string) — Filter by entity type (e.g., "booking", "procedure", "service_request")
- `entityId` (string) — Filter by specific entity ID
- `actorUserId` (string) — Filter by actor user ID
- `action` (string) — Filter by action (e.g., "create", "confirm", "cancel")
- `dateFrom` (string, YYYY-MM-DD) — Filter events from this date (inclusive)
- `dateTo` (string, YYYY-MM-DD) — Filter events until this date (inclusive)
- `limit` (number, default 50, max 200) — Page size
- `offset` (number, default 0) — Page offset
- `orderBy` ("createdAt" | "action" | "entityType", default "createdAt")
- `orderDir` ("asc" | "desc", default "desc")

Key behavior already implemented:
- Uses `audit_event_entity_idx` index for entityType+entityId queries
- Uses `audit_event_actor_idx` index for actorUserId queries
- All entries include non-empty `summary` and `payload` fields
- Filters combine with AND semantics
- Date range validation (dateTo must be >= dateFrom)
- Pagination limits enforced (1-200 for limit, non-negative offset)
- Requires `audit: ["read"]` permission (admin and auditor roles have this)

## 3) Capacity engine (core business logic)

Implemented across:
- `server/src/features/bookings/capacity-check.service.ts`
- `server/src/features/bookings/capacity-consume.service.ts`
- `server/src/features/bookings/capacity-reassign.service.ts`

Main exported operations:
- `checkCapacity(slotId, staffUserId)`
- `consumeCapacity(...)`
- `releaseCapacity(bookingId, reason)`
- `confirmBooking(bookingId)`
- `previewReassignment(...)`
- `previewReassignments(...)`
- `reassignBooking(...)`
- `executeBulkReassignments(...)`

Main guarantees implemented:
- dual capacity check:
  - slot global capacity
  - staff daily capacity
- staff eligibility checks:
  - active + assignable
  - date override availability
  - partial-day window checks
  - weekly availability windows
- transaction-based conflict handling for last-capacity contention
- semantic conflict mapping (`GLOBAL_OVER_CAPACITY`, `STAFF_*`, etc.)
- idempotent release semantics and active booking pointer maintenance

## 4) What is still missing / partial

Even with the current backend, this is still missing or partial:
- advanced citizen API flow for:
  - full service request lifecycle beyond hold/confirm base
  - document review/approval workflow (upload with file persistence is implemented, review API pending)
- full E2E test coverage for citizen frontend-backend integration

## 5) Quality baseline currently passing

Backend currently has active test coverage for:
- auth hardening and auth guards
- schedule auth/validation
- staff auth/validation
- capacity engine and reassignment logic
- reservation idempotency and mutation safety

Verification commands used as baseline:
- `bun run check`
- `cd server && bunx tsc --noEmit`
- `cd server && bun test --timeout 30000`

## 6) Maintenance rule for future agents

When adding/changing backend behavior:
1. update this file (`server/src/BACKEND_STATUS.md`)
2. update `AGENTS.md` if the change impacts onboarding assumptions
3. keep `server/src/db/SCHEMA.md` aligned when domain invariants change
