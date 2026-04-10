# Environment — Mission: Backoffice Operativo + Auth Separada

## What belongs here
- Environment variables required to run and validate auth + mail behavior for this mission.
- Dependency/runtime notes that affect local execution consistency.
- Environment-level constraints that apply across milestones.

## What does **not** belong here
- Port assignments, process definitions, and start/stop command details.
- Test case steps or validation scripts.
- UI/browser execution guidance.

> **Source of truth note:** Ports and service commands live in `services.yaml` (not in this file).

## Required environment variables (auth, maildev, cors)

| Variable | Required | Purpose | Mission/dev value |
|---|---:|---|---|
| `BETTER_AUTH_SECRET` | Yes | Better Auth signing/encryption secret | Any strong random secret |
| `BETTER_AUTH_URL` | Yes | Public auth base URL used by Better Auth | `http://localhost:3000` |
| `CORS_ORIGIN` | Yes | Allowed frontend origin for auth endpoints | `http://localhost:3000` |
| `AUTH_OTP_LENGTH` | Yes | OTP code length | `6` |
| `AUTH_OTP_EXPIRES_IN` | Yes | OTP TTL (seconds) | `300` |
| `AUTH_OTP_ALLOWED_ATTEMPTS` | Yes | Max OTP attempts per code | `3` |
| `SMTP_HOST` | Yes | SMTP host for OTP delivery | `127.0.0.1` |
| `SMTP_PORT` | Yes | SMTP port for MailDev | `1025` |
| `SMTP_SECURE` | Yes | SMTP TLS mode flag | `false` |
| `MAIL_FROM` | Yes | Sender identity for OTP mail | `SIMUT Tulua <no-reply@simut.local>` |
| `SMTP_USER` | No | SMTP auth username (if enabled) | empty for local MailDev |
| `SMTP_PASS` | No | SMTP auth password (if enabled) | empty for local MailDev |

## Dependency notes
- Runtime stack for this mission: **Bun + Hono + Better Auth + Nodemailer + MailDev**.
- Backend reads env from root `.env` (`server` code resolves `../.env`), so keep mission values there.
- MailDev is a required local dependency for OTP evidence capture in this mission.
- Keep auth/cors defaults aligned to frontend `:3000` and backend `:3001` deployment assumptions from mission planning.
