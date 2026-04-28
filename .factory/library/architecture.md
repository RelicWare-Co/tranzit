# Architecture

## System Overview

SIMUT is an appointment scheduling platform with two main interfaces:
1. **Citizen Portal** - Schedule appointments, manage reservations
2. **Admin Panel** - Backoffice for staff management, scheduling, configuration

## Architecture

### Frontend (packages/web)
- React 19 + Vite
- TanStack Router (file-based routing)
- Mantine 9 for UI components
- Geist Sans font

### Backend (packages/server)
- Bun runtime
- Hono framework
- Better Auth + emailOTP
- Drizzle ORM + SQLite (libsql/Turso)

## Key Components

### Admin Layout (`AdminLayout`)
- Fixed navbar at top
- Collapsible sidebar on left (200-220px)
- Main content area with outlet

### Admin Pages
- `/admin/login` - Admin authentication
- `/admin` - Dashboard with KPIs
- `/admin/citas` - Booking management with calendar
- `/admin/usuarios` - Staff management
- `/admin/tramites` - Procedure management
- `/admin/reportes` - Operations dashboard
- `/admin/auditoria` - Audit log
- `/admin/configuracion` - Settings

### Design System (`-admin-ui.ts`)
- `adminUi` object with CSS classes
- Tokens for colors, spacing, typography
- Uses CSS variables for theming
- **Color token coverage**: error/warning/info scales only go up to *-600. Do NOT reference *-700 tokens (e.g., `--error-700`) — they are not defined and will fall back to browser defaults.

## API Relation Shape (Important)

### `admin.bookings.list` relation population
The `listBookings` function in `packages/server/src/features/bookings/bookings-read.service.ts` populates the following relations per booking:
- `slot` — always populated via `appointmentSlot` query
- `staff` — always populated via `user` query for `staffUserId`
- `request` — populated when `booking.requestId` exists, via `serviceRequest` → `procedureType` → `user` (citizen) chain

Before fix commit `d4b5c6b`, `request` was not populated, causing dashboard UI that relied on `booking.request?.citizen?.name` or `booking.request?.procedureType?.name` to receive `undefined` and fall back to incorrect data (staff email instead of citizen name).
