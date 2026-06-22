<!-- intent-skills:start -->
## Skill loading

Before substantial work, run `bunx @tanstack/intent@latest list`. If a local
skill directly applies, load it with `bunx @tanstack/intent@latest load
<package>#<skill>` and follow its instructions. Run this from the workspace
root for monorepo changes.
<!-- intent-skills:end -->

# Guía para agentes

## Producto y principios

Tranzit es una plataforma de agendamiento para SIMUT Tuluá. Reemplaza un flujo
manual por correo con portal ciudadano, autenticación OTP, trámites
configurables, requisitos físicos, agenda, reservas temporales, operación
interna y auditoría.

Prioridades:

- El backend es la fuente de verdad para disponibilidad, capacidad,
  expiraciones y permisos.
- Configurar antes que hardcodear; no construir lógica crítica sobre mocks.
- Mantener trazabilidad de operaciones críticas y una UX clara para ciudadanía.
- Resolver el flujo real sin sobreingeniería. No añadir pagos, OCR, app nativa,
  multisedes ni integraciones gubernamentales sin una decisión explícita.

## Fuentes de verdad

Antes de cambiar dominio, esquema o backend, lee:

- `packages/server/src/db/SCHEMA.md`
- `packages/server/src/db/schema.ts`
- `packages/server/src/BACKEND_STATUS.md`

`README.md` no es documentación funcional canónica. Para trabajo frontend,
lee también `.impeccable.md` antes de diseñar o modificar UI.

Para cualquier cambio que use componentes, hooks o formularios de Mantine,
consulta primero el índice oficial https://mantine.dev/llms.txt y abre la página
LLM específica del componente. Usa únicamente APIs compatibles con la versión
instalada en `packages/web/package.json`; no deduzcas APIs de versiones
anteriores de Mantine.

## Estado operativo

- La API pública usa oRPC bajo `/api/rpc/*`; no reintroduzcas `/api/admin/*`.
- Ciudadanía y personal interno usan OTP por correo. No reintroduzcas
  autenticación por contraseña.
- Admin y el ciclo ciudadano básico están conectados al backend. Consulta
  `BACKEND_STATUS.md` para contratos y cobertura real; no infieras endpoints
  por la interfaz.
- El ciclo avanzado de `service_request` y las pruebas end-to-end ciudadanas
  siguen incompletos.

## Dominio: reglas no negociables

La agenda es el centro del producto:

- No permitir doble reserva ni sobrecupo por auxiliar.
- Un hold debe expirar; disponibilidad visible y real deben coincidir.
- Las reservas administrativas también consumen capacidad.
- Los overrides de calendario prevalecen sobre el horario base.
- Las operaciones relevantes deben quedar auditables.

Invariantes principales:

- `booking` unifica hold ciudadano, cita confirmada y reserva administrativa.
- `service_request.activeBookingId` apunta a la reserva vigente.
- `booking.isActive` determina si la reserva sigue vigente y consumiendo
  capacidad; desactívala al expirar, cancelar, atender o reemplazar.
- Solo puede existir una reserva ciudadana activa por `service_request`.
- Persistir `procedureSnapshot` antes de confirmar o consolidar un flujo y
  respetar las versiones de configuración.
- `booking_series` es la fuente de recurrencias administrativas; no reemplazar
  esa relación por claves de texto libres.

El detalle y las razones de diseño viven en `SCHEMA.md`.

## Estructura del código

Monorepo Bun con `packages/web` (React, Vite, TanStack Router, Mantine) y
`packages/server` (Bun, Hono, Better Auth, Drizzle, libsql).

- En `packages/web/src/routes`, deja solo archivos de ruta de TanStack Router.
  Las páginas y componentes pertenecen a `features/<dominio>`.
- `shared` contiene primitivas UI, clientes, utilidades y tipos reutilizables;
  no importa desde `features` ni `routes`.
- En backend, cada dominio vive en `features/<dominio>` con router, servicios y
  tipos. `shared` es transversal; `lib` contiene solo infraestructura;
  `middleware` contiene middleware de Hono.
- Usa aliases absolutos en frontend. No edites manualmente
  `packages/web/src/routeTree.gen.ts`.

## Cambios y documentación

Actualiza la documentación en el mismo cambio:

- Cambios de comportamiento, prioridades, arquitectura o flujo de producto:
  este archivo.
- Cambios de dominio o esquema: `packages/server/src/db/SCHEMA.md`.
- Cambios de rutas, contratos o comportamiento backend:
  `packages/server/src/BACKEND_STATUS.md`.
- Corrige cualquier documento enlazado que el cambio vuelva contradictorio.

Para cambios de esquema: modifica `schema.ts` y `SCHEMA.md`, ejecuta
`bun run db:generate`, revisa el SQL, ejecuta `bun run db:migrate` y valida con
`cd packages/server && bunx tsc --noEmit`. No resetees la base local por
defecto; resuelve el baseline de migraciones con cuidado.

## Verificación y convenciones

Comandos habituales desde la raíz:

```bash
bun run dev
bun run dev:server
bun run test
bun run lint
bun run check
bun run db:generate
bun run db:migrate
```

Para backend, ejecuta `cd packages/server && bunx tsc --noEmit` cuando el cambio
lo afecte. Mantén los cambios pequeños y verificables. Usa Conventional Commits
y nunca confirmes `.env`, `packages/server/.env` ni bases SQLite locales.
