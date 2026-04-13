# Auth Hardening Notes

## Rate Limiting
- Better Auth rate limiting is **disabled by default in development** (`enabled: options.rateLimit?.enabled ?? isProduction`). Must explicitly set `rateLimit: { enabled: true }` in config.
- Rate limits use module-level in-memory `Map` storage. This persists across test instances - disable rate limiting in tests that don't specifically test it.
- The emailOTP plugin defines rate limit rules (3 per 60s for send-verification-otp, sign-in/email-otp, etc.) that only take effect when rate limiting is enabled.
- Rate limiting is IP-based. From curl, pass `X-Forwarded-For` header to ensure consistent IP resolution.

## OTP Resend Invalidation
- Better Auth's emailOTP plugin uses a create-then-catch pattern in `resolveOTP`: it tries to `createVerificationValue` and if that throws (due to unique constraint on `identifier`), it deletes the old one and creates new.
- **Without a UNIQUE index on `verification.identifier`**, the catch never fires and old OTPs coexist with new ones, making the old OTP still valid after resend.
- We added `uniqueIndex("verification_identifier_unique_idx")` on `verification.identifier` to fix this.
- The memory adapter used in tests doesn't enforce unique constraints - tests must manually delete old verification rows before resending.

## CORS Configuration
- Default CORS origin in `index.ts` was `http://localhost:3001` (backend port) - wrong. Fixed to `http://localhost:3000` (frontend port).
- Hono's cors middleware with a specific origin string correctly:
  - Returns `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true` for matching origins
  - Omits `Access-Control-Allow-Origin` for non-matching origins

## Sign-out Behavior
- Better Auth's `/sign-out` endpoint requires `Origin` header (CSRF protection) - returns 403 without it.
- After sign-out, the session is deleted from DB. Our Hono `/session` endpoint returns 401 when no user found.
- Better Auth's `/get-session` returns `200` with `null` body (not 401) when no session - this is the raw handler behavior, not our Hono wrapper.

## Privilege Escalation Protection
- The admin plugin marks `role`, `banned`, `banReason`, `banExpires` as `input: false` in its schema.
- `parseUserInput` will throw `FIELD_NOT_ALLOWED` if any of these fields are present in user input during sign-up or OTP sign-in.
- The admin plugin's init hook also sets `role: defaultRole` ("user") on user creation, ensuring a safe default.

## Cookie Handling in Tests
- Better Auth uses signed cookies. Extract the full signed value from `Set-Cookie` header.
- Use `auth.api.getSession({ headers: new Headers({ cookie: sessionCookie }) })` for programmatic session verification.
- Pass `Origin: http://localhost:3000` and `Referer: http://localhost:3000/` headers for sign-out requests.
- Disable `session.cookieCache` in test auth instances to avoid stale cache issues.
