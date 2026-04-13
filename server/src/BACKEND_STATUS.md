# Backend Status (Current Implementation)

Last updated: 2026-04-13

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

## 2) Domain modules and active routes

All domain operations below are reachable through oRPC procedures and remain admin-protected unless explicitly under `/api/auth/*`.

### 2.1 Schedule module (`server/src/features/schedule/schedule.routes.ts`)
Implemented as native oRPC procedures in `server/src/orpc/router.ts` (the legacy routes file remains as migration reference).

- `POST /templates`
- `GET /templates`
- `GET /templates/:id`
- `PATCH /templates/:id`
- `DELETE /templates/:id`
- `POST /overrides`
- `GET /overrides`
- `GET /overrides/:id`
- `PATCH /overrides/:id`
- `DELETE /overrides/:id`
- `POST /slots/generate`
- `GET /slots?date=YYYY-MM-DD`

Key behavior already implemented:
- strict validation for dates, time windows, slot duration, buffers, and capacity
- precedence `calendar_override > schedule_template`
- slot generation by window with buffer support
- guarded handling of invalid schedule configuration during generation

### 2.2 Staff module (`server/src/features/staff/staff.routes.ts`)
Implemented as native oRPC procedures in `server/src/orpc/router.ts` (the legacy routes file remains as migration reference).

- `POST /`
- `GET /`
- `GET /:userId`
- `PATCH /:userId`
- `DELETE /:userId`
- `POST /:userId/date-overrides` (upsert by staff+date)
- `GET /:userId/date-overrides`
- `GET /:userId/date-overrides/:overrideId`
- `PATCH /:userId/date-overrides/:overrideId`
- `DELETE /:userId/date-overrides/:overrideId`
- `GET /:userId/effective-availability?date=YYYY-MM-DD`

Key behavior already implemented:
- validation of `weeklyAvailability` structure and windows
- date overrides with partial-day windows and capacity override
- deletion guard when staff has active bookings
- effective availability/capacity resolution by profile + date overrides

### 2.3 Bookings module (`server/src/features/bookings/bookings.routes.ts`)
Implemented as native oRPC procedures (the legacy HTTP routes file remains as migration reference).

- `POST /`
- `GET /` (filters include `dateFrom` and `dateTo`)
- `GET /:id`
- `GET /:id/capacity`
- `POST /:id/confirm`
- `POST /:id/release`
- `POST /:id/reassign`
- `POST /:id/reassign/preview`
- `POST /reassignments/preview`
- `POST /reassignments`
- `GET /availability/check?slotId=...&staffUserId=...`

Key behavior already implemented:
- booking create integrated with capacity engine
- release is idempotent
- confirm checks hold state and hold expiration
- single and bulk reassignment flows
- batch mode support: `best_effort` and `atomic`
- preview token and drift detection for bulk reassignment apply

### 2.4 Reservation series module (`server/src/features/reservations/reservation-series.routes.ts`)
Implemented as native oRPC procedures in `server/src/orpc/router.ts` (the legacy routes file remains as migration reference).

Series routes:
- `POST /api/admin/reservation-series`
- `GET /api/admin/reservation-series`
- `GET /api/admin/reservation-series/:id`
- `GET /api/admin/reservation-series/:id/instances`
- `PATCH /api/admin/reservation-series/:id`
- `PATCH /api/admin/reservation-series/:id/from-date`
- `POST /api/admin/reservation-series/:id/release`
- `POST /api/admin/reservation-series/:id/move`

Instance routes:
- `GET /api/admin/reservations/:bookingId`
- `PATCH /api/admin/reservations/:bookingId`
- `POST /api/admin/reservations/:bookingId/release`
- `POST /api/admin/reservations/:bookingId/move`

Key behavior already implemented:
- recurrence parsing (RRULE string and object support)
- occurrence generation with weekly `BYDAY` handling
- idempotency-key support in mutating series/instance endpoints
- optimistic concurrency via `If-Match` for PATCH series/instance
- detached instance behavior for per-instance PATCH vs series PATCH
- atomic move operations for series and single instance

## 3) Capacity engine (core business logic)

Implemented in `server/src/features/bookings/capacity.service.ts`.

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

Even with the current admin backend, this is still missing or partial:
- public citizen API flow for:
  - service request lifecycle
  - citizen document upload/review APIs
  - citizen-facing booking flow over OTP session
- complete notification orchestration beyond OTP email
- richer audit event instrumentation in all admin mutations
- full E2E frontend-backend integration (frontend still has mock-heavy flows)

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
