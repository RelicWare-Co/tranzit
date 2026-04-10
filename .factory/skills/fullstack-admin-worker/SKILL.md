---
name: fullstack-admin-worker
description: Delivers coordinated admin fullstack changes (frontend + backend) with TDD, curl/API checks, and Maildev verification when auth/email is affected.
---

## When to Use This Skill
- Use for end-to-end admin/backoffice features that require both `src/` and `server/` updates.
- Use when auth separation affects UI + API contracts and needs validated HTTP behavior.

## Required Skills
None.

## Work Procedure
1. Lock the feature slice (UI states, API contract, auth boundaries, and acceptance checks).
2. Create failing tests first (**red**) for backend logic/handlers and frontend behavior impacted by the feature.
3. Implement minimal backend + frontend changes to satisfy tests (**green**), then refactor.
4. Run relevant validators (tests, lint/check/typecheck for touched areas).
5. Manually verify HTTP/API behavior with `curl` against local backend routes used by the UI.
6. If auth/OTP/email paths are touched, verify Maildev receives expected messages.
7. Stop local processes started for verification and return a structured handoff JSON.

## Example Handoff
```json
{
  "salientSummary": "Implemented fullstack admin reassignment and schedule wiring with contract-aligned error handling and role-separated auth behavior.",
  "whatWasImplemented": "Connected admin UI actions to real `/api/admin/*` endpoints, added server-side conflict-safe reassignment behavior, and updated frontend state handling for success and domain-error flows.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "bun run test -- --passWithNoTests",
        "exitCode": 0,
        "observation": "No tests failed; baseline suite command passes in no-test state."
      },
      {
        "command": "bun run check",
        "exitCode": 0,
        "observation": "Biome checks passed."
      },
      {
        "command": "cd server && bunx tsc --noEmit",
        "exitCode": 0,
        "observation": "Backend typecheck passed."
      },
      {
        "command": "curl -i -X PATCH http://localhost:3001/api/admin/bookings/bkg_456/reassign -H 'content-type: application/json' -d '{\"targetStaffUserId\":\"stf_22\"}'",
        "exitCode": 0,
        "observation": "Endpoint returned expected success/conflict contract."
      }
    ],
    "interactiveChecks": [
      {
        "action": "Loaded admin routes and triggered reassignment from UI against local backend.",
        "observed": "UI reflected success and conflict states consistent with API responses."
      },
      {
        "action": "Started MailDev and exercised OTP-related flow touched by change.",
        "observed": "MailDev captured expected OTP/notification messages."
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "server/src/admin/reassign-booking.test.ts",
        "cases": [
          {
            "name": "rejects reassignment when destination staff unavailable",
            "verifies": "API returns conflict and preserves current active booking."
          }
        ]
      },
      {
        "file": "src/routes/admin/citas.integration.test.tsx",
        "cases": [
          {
            "name": "renders conflict message from reassignment API error",
            "verifies": "User sees actionable error state when backend rejects operation."
          }
        ]
      }
    ]
  },
  "discoveredIssues": [
    {
      "severity": "medium",
      "description": "Vite proxy currently targets `/api/auth` only; admin endpoint calls need explicit backend base URL or proxy expansion."
    }
  ]
}
```

## When to Return to Orchestrator
- Return when red→green cycle is completed, validators pass, manual `curl` checks are done, and any relevant Maildev checks are confirmed.
- Return early with blocker details if local services, env config, or contract gaps prevent safe completion.
