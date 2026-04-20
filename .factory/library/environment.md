# Environment

## Services
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

## Commands
```bash
bun run dev          # Frontend
bun run dev:server   # Backend  
bun run lint         # Biome lint
bun run format       # Biome format
bun run check        # Typecheck + lint
```

## Key Files
- `packages/web/src/routes/admin/` - Admin pages
- `packages/web/src/routes/admin/_shared/-admin-ui.ts` - Design system
- `packages/server/src/` - Backend code
- `packages/server/src/db/schema.ts` - Database schema
