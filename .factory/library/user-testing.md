# User Testing Strategy — SIMUT Tuluá Platform Completion

## Validation Surface
- **API/HTTP**: Functional validation for auth, scheduling, capacity, booking, recurrence, reassignment, documents, service requests, notifications, and audit flows.
- **SMTP (MailDev)**: OTP and notification delivery validation (message presence + payload checks).
- **Browser**: End-to-end citizen flow (OTP → form → slot selection → hold → confirm) via agent-browser for cross-area flows.

## Validation Concurrency
Concurrency is defined per surface and capped at **5**.

| Surface | Max concurrent runs | Rationale |
|---|---:|---|
| API/HTTP | **5** | Main validation surface; cap uses available host headroom while minimizing contention/noise in shared local services. |
| SMTP (MailDev) | **2** | MailDev is single-instance and order-sensitive for evidence capture; lower parallelism reduces message interleaving and flaky assertions. |
| Browser (agent-browser) | **2** | Browser automation for cross-area E2E flows; higher memory footprint per instance limits concurrency. |

## Setup & Isolation Strategy
- Use dedicated mission test data (unique emails/ids/timestamps per run) to avoid collisions.
- Keep each test flow idempotent where possible; treat retries as new attempts with traceable correlation keys.
- Run API and SMTP assertions as separate steps: first commit API mutation, then verify emitted mail artifact.
- Preserve service isolation assumptions from mission dry-run (frontend/backend/maildev running on reserved mission ports).

## New Surfaces to Test
1. **Document Upload**: multipart form upload, file validation, storage
2. **Document Review**: admin approve/reject with notes
3. **Notifications**: email confirmation/cancellation via MailDev
4. **Audit Events**: database records for mutations
5. **Cross-Area E2E**: agent-browser for complete citizen flow

## Evidence Requirements
For each validated flow, capture:
- Request metadata: method, endpoint, timestamp, key payload fields.
- Response metadata: status code + response body (or relevant excerpts).
- SMTP evidence when applicable: MailDev message id, recipient, subject, OTP/body excerpt.
- Database evidence: audit_event or notification_delivery rows queried directly.
- Browser evidence: screenshots at key steps for E2E flows.

## Admin Auth Workaround (schedule-overrides validation)
The Better Auth password sign-in doesn't work with seeded admin users due to hash format mismatch in the seed script. Workaround to create a working admin session:

1. Create user via API: `POST /api/auth/sign-up/email` with email and password
2. Update role to admin in DB:
   ```bash
   cd server && bun -e "
   import { db, schema } from './src/db';
   import { eq } from 'drizzle-orm';
   const user = await db.query.user.findFirst({ where: eq(schema.user.email, 'your-email') });
   await db.update(schema.user).set({ role: 'admin' }).where(eq(schema.user.id, user.id));
   "
   ```
3. Sign in to get admin session cookie: `POST /api/auth/sign-in/email`
4. Save cookie for subsequent requests

Admin session cookie location: `/tmp/admin_cookies.txt`

## Service Start Issues
- Root `bun run dev:server` fails with bun --cwd error. Use: `cd server && bun run dev`
- Backend health check: `curl http://localhost:3001` should return "Hello Hono + Better Auth"
