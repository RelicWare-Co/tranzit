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
