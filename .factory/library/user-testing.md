# User Testing Strategy — Mission: Backoffice Operativo + Auth Separada

## Validation Surface
- **API/HTTP**: Functional validation for auth, scheduling, capacity, booking, recurrence, and reassignment flows.
- **SMTP (MailDev)**: OTP and notification delivery validation (message presence + payload checks).

## Validation Concurrency
Concurrency is defined per surface and capped at **5**.

| Surface | Max concurrent runs | Rationale |
|---|---:|---|
| API/HTTP | **5** | Main validation surface; cap uses available host headroom while minimizing contention/noise in shared local services. |
| SMTP (MailDev) | **2** | MailDev is single-instance and order-sensitive for evidence capture; lower parallelism reduces message interleaving and flaky assertions. |

## Setup & Isolation Strategy
- Use dedicated mission test data (unique emails/ids/timestamps per run) to avoid collisions.
- Keep each test flow idempotent where possible; treat retries as new attempts with traceable correlation keys.
- Run API and SMTP assertions as separate steps: first commit API mutation, then verify emitted mail artifact.
- Preserve service isolation assumptions from mission dry-run (frontend/backend/maildev running on reserved mission ports).

## Evidence Requirements
For each validated flow, capture:
- Request metadata: method, endpoint, timestamp, key payload fields.
- Response metadata: status code + response body (or relevant excerpts).
- SMTP evidence when applicable: MailDev message id, recipient, subject, OTP/body excerpt.
- Pass/fail statement tied to expected contract behavior.

## Known constraints
- **No browser testing in this mission** (agent-browser excluded by mission decision).
