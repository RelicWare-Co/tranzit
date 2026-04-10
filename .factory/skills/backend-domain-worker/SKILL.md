---
name: backend-domain-worker
description: Implements backend domain/auth changes with strict TDD, curl-based API checks, and Maildev SMTP validation for this mission.
---

## When to Use This Skill
- Use for backend-only work in `server/` related to backoffice operativo flows, separated auth behavior, and domain/API correctness.
- Use when endpoint behavior, booking/domain invariants, OTP/email delivery, or operational APIs must be implemented and verified.

## Required Skills
None.

## Work Procedure
1. Define exact backend contract first (route, payloads, status codes, side effects, invariants).
2. Write failing tests first (**red**) for domain logic and/or HTTP handlers.
3. Implement the minimal backend change to pass tests (**green**), then refactor safely.
4. Run backend validations (`bunx tsc --noEmit`, relevant test commands).
5. Manually verify API behavior with `curl` (happy path + critical error path).
6. When email/OTP is touched, run Maildev and verify SMTP delivery/output.
7. Stop spawned processes (`kill <pid>`) and provide handoff JSON with evidence.

## Example Handoff
```json
{
  "salientSummary": "Implemented reservation capacity guards and auth separation checks in backend, with red-to-green tests and curl verification.",
  "whatWasImplemented": "Added backend route/handler logic for schedule and booking invariants, including conflict responses, idempotency-safe mutation guards, and audit event writes required by the mission contract.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "cd server && bun test src/bookings/expire.test.ts",
        "exitCode": 0,
        "observation": "All booking transition cases passed."
      },
      {
        "command": "cd server && bunx tsc --noEmit",
        "exitCode": 0,
        "observation": "Server typecheck clean."
      },
      {
        "command": "curl -i -X POST http://localhost:3001/api/admin/bookings/bkg_123/release",
        "exitCode": 0,
        "observation": "Received expected conflict/success contract response."
      }
    ],
    "interactiveChecks": [
      {
        "action": "Started MailDev and requested OTP through auth API.",
        "observed": "MailDev captured OTP email with expected recipient and subject."
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "server/src/bookings/expire.test.ts",
        "cases": [
          {
            "name": "rejects release when booking already inactive",
            "verifies": "Capacity is not double-freed and returns domain conflict."
          },
          {
            "name": "allows release when booking active",
            "verifies": "Booking becomes inactive and capacity counters are updated once."
          }
        ]
      },
      {
        "file": "server/src/auth/admin-guard.test.ts",
        "cases": [
          {
            "name": "citizen session denied on admin endpoint",
            "verifies": "Admin route returns forbidden for non-admin sessions."
          }
        ]
      }
    ]
  },
  "discoveredIssues": [
    {
      "severity": "medium",
      "description": "Root script `bun --cwd server run dev` may fail on this machine; use `cd server && bun run dev` from services manifest."
    }
  ]
}
```

## When to Return to Orchestrator
- Return once tests are green, typecheck passes, manual `curl` checks are done, and relevant SMTP checks are complete.
- Return immediately if blocked by missing env values, unavailable local services, migration conflicts, or unclear route/domain contracts.
