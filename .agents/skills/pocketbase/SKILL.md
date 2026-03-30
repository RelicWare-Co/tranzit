---
name: pocketbase
description: Comprehensive PocketBase documentation and implementation guide covering setup, collections, auth, relations, files, API rules, Web APIs, production, Go extensions, JavaScript/JSVM hooks, JSVM types, and legacy upgrade notes. Use when Codex needs to answer questions about PocketBase, debug or implement PocketBase code, map an issue to the official docs, or find exact JSVM symbols and signatures.
---

# PocketBase

## Overview

Use this skill to work from the PocketBase site documentation instead of memory. Route the request to the smallest relevant reference first, then open additional references only when the task crosses domains.

Treat the bundled references as version-specific documentation derived from the PocketBase site repo. Check `references/source-manifest.md` when you need to confirm the source route, source Svelte page, or the PocketBase version used to build the skill.

## Route The Request

- Use `references/core-concepts.md` for install, first-run flow, collections, auth concepts, API rules, file handling, relations, and "what is the recommended PocketBase way to do X?" questions.
- Use `references/web-api.md` for endpoint-level behavior, request or response formats, query parameters, auth requirements, and examples for the REST-ish HTTP APIs.
- Use `references/go-framework.md` for extending PocketBase with Go: hooks, routes, DB access, records, collections, migrations, jobs, logging, realtime, testing, and misc framework APIs.
- Use `references/javascript-framework.md` for JSVM or `pb_hooks` work: hooks, routes, DB access, files, migrations, mail, logging, HTTP requests, and JS-specific caveats.
- Use `references/jsvm-api-index.md` to locate a global symbol quickly before opening the detailed declaration file.
- Use `references/jsvm-types.d.ts` when exact JSVM names, signatures, overloads, field names, or comments matter.
- Use `references/operations-and-faq.md` for deployment, production hardening, backup strategy, and FAQ-style troubleshooting.
- Use `references/upgrade-v023.md` only for legacy migrations from PocketBase v0.22.x to v0.23.x.

## Work With The Docs

- Prefer the official PocketBase terminology from the references when explaining or implementing behavior.
- When the user asks about a specific endpoint, hook, helper, or method, search the relevant reference for the exact route, section title, or symbol name before answering.
- When implementation depends on JSVM exactness, confirm the symbol in `references/jsvm-api-index.md` and then inspect `references/jsvm-types.d.ts`.
- When a question spans multiple layers, combine references deliberately. Example: auth flow questions often need `core-concepts.md` plus `web-api.md`; custom business logic often needs `core-concepts.md` plus `go-framework.md` or `javascript-framework.md`.
- When the user is upgrading an older app, call out that `references/upgrade-v023.md` is legacy material and keep the rest of the advice grounded in the current bundled version from `references/source-manifest.md`.

## Refresh The References

If you have access to a PocketBase site repo, regenerate the references instead of editing them by hand:

```bash
python scripts/build_references.py --site-root /path/to/pocketbase-site --build
```

This rebuilds the Svelte site, regenerates the JSVM docs, extracts the rendered HTML into grouped markdown references, and refreshes the bundled `jsvm-types.d.ts`.
