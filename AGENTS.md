# AGENTS.md

## Proposito

Este repositorio implementa una plataforma de agendamiento para SIMUT Tulua.

El objetivo del producto es reemplazar un proceso manual por correo por un sistema con:
- portal ciudadano,
- autenticacion ligera por OTP,
- formularios dinamicos por tramite,
- requisitos y plantillas descargables para entrega fisica,
- agenda configurable,
- reservas temporales de cupos,
- confirmacion de citas,
- asignacion operativa a auxiliares,
- backoffice administrativo,
- auditoria y notificaciones.

La regla general del proyecto es simple: resolver bien el flujo real sin sobreingenieria.

Principios que debes preservar:
- backend como fuente de verdad para disponibilidad, capacidad, expiraciones y permisos,
- configurabilidad antes que hardcodes,
- trazabilidad de acciones criticas,
- UX clara para ciudadano,
- esquema pequeno pero con invariantes fuertes.

## Fuentes de verdad

Antes de tocar el dominio o el esquema, lee estos archivos:
- `packages/server/src/db/SCHEMA.md`
- `packages/server/src/db/schema.ts`
- `packages/server/src/BACKEND_STATUS.md`

Notas importantes:
- `packages/server/src/db/SCHEMA.md` explica por que el modelo esta simplificado como esta y que invariantes deben respetarse.
- `packages/server/src/BACKEND_STATUS.md` describe las rutas y servicios backend realmente implementados hoy.
- `README.md` sigue siendo casi boilerplate de TanStack/Vite. No lo tomes como documentacion funcional del proyecto.
- Este `AGENTS.md`, `packages/server/src/db/SCHEMA.md` y `packages/server/src/BACKEND_STATUS.md` son mas confiables que el `README.md`.

## Gobernanza documental obligatoria (todos los agentes)

Estas reglas son obligatorias para cualquier agente que trabaje en este repo:

- si cambias comportamiento, estado funcional, prioridades, decisiones de arquitectura o flujo de producto, actualiza `AGENTS.md` en el mismo cambio,
- si el cambio afecta dominio/esquema, actualiza `packages/server/src/db/SCHEMA.md` en el mismo cambio,
- si el cambio afecta rutas, contratos o comportamiento backend, actualiza `packages/server/src/BACKEND_STATUS.md` en el mismo cambio,
- si un cambio deja obsoleto algun `.md` enlazado desde este archivo, tambien debes actualizar ese documento en el mismo cambio,
- no cierres una tarea dejando drift entre codigo y documentacion.

Lista minima de `.md` enlazados que debes mantener sincronizados cuando aplique:
- `AGENTS.md`,
- `packages/server/src/db/SCHEMA.md`,
- `packages/server/src/BACKEND_STATUS.md`,
- `README.md` (si el cambio hace necesario corregirlo o alinearlo para evitar contradicciones graves).

## Estado actual del proyecto

No asumas que el sistema ya esta completo. Hoy el repo esta en una fase intermedia:

- El frontend ya tiene landing, login, perfil y una experiencia visual de agendamiento.
- El backend ya tiene auth, esquema del dominio y una capa administrativa funcional.
- Ya existen endpoints reales para schedule, staff, bookings y reservation-series, con capacidad y reasignacion en backend.
- El backend expone la capa administrativa por oRPC en `/api/rpc/*`; `/api/admin/*` ya no se expone como superficie publica.
- Ya existe una capa ciudadana inicial por oRPC para procedimientos, disponibilidad y ciclo base de reserva (hold/confirm/cancel/mis citas).
- El flujo ciudadano opera en modo documental fisico: descarga de plantillas y entrega presencial.
- Todavia faltan APIs ciudadanas completas para ciclo de vida avanzado de `service_request`.

Hoy hay piezas ya conectadas y otras aun parciales:
- `src/routes/login.tsx` ya usa OTP por correo para flujo ciudadano.
- `src/routes/agendar.tsx` ya consume backend real para trámites, disponibilidad y reserva/confirmación.
- `src/routes/mi-perfil.tsx` ya consume citas reales del ciudadano desde backend.
- Sigue pendiente robustecer el ciclo completo de `service_request` y pruebas E2E ciudadanas.

Conclusion practica:
- no construyas logica importante encima de mocks,
- si vas a implementar negocio real, conecta el dominio y reemplaza los placeholders,
- no des por hecho que el flujo actual de login representa la solucion final para ciudadanos.

## Stack actual

Frontend:
- React 19
- Vite
- TanStack Router con file-based routing
- Mantine 9
- Geist Sans
- Tailwind Vite plugin presente, pero la UI actual usa sobre todo Mantine + estilos inline + `src/styles.css`

Backend:
- Bun
- Hono
- Better Auth
- Drizzle ORM
- libsql / Turso / SQLite local
- Nodemailer

Calidad:
- Biome para lint/format/check
- Vitest disponible, pero hoy casi no hay pruebas de dominio
- `bunx tsc --noEmit` en `packages/server/` es una verificacion importante

## Estructura del monorepo

Este proyecto usa Bun workspaces. La estructura es:

```
tranzit/
├── package.json          # Root workspace config
├── packages/
│   ├── web/              # Frontend (React + Vite)
│   └── server/           # Backend (Bun + Hono)
├── .env                  # Variables de entorno (no versionar)
├── AGENTS.md             # Este archivo
└── bun.lock              # Lockfile compartido
```

Frontend (`packages/web/`):
- `vite.config.ts`: proxy local para `/api/auth` y `/api/rpc`
- `src/main.tsx`: monta Mantine, AuthProvider y RouterProvider
- `src/lib/auth-client.ts`: cliente Better Auth del frontend
- `src/lib/AuthContext.tsx`: wrapper de sesion y login/logout para React
- `src/routes/`: rutas actuales (file-based routing)
- `src/routeTree.gen.ts`: archivo generado por TanStack Router

Backend (`packages/server/`):
- `src/index.ts`: entrypoint de runtime (exporta `fetch` del app)
- `src/app.ts`: composicion principal de middlewares y rutas Hono
- `src/features/auth/auth.config.ts`: configuracion Better Auth
- `src/features/auth/auth.mailer.ts`: envio de OTP por correo
- `src/lib/db.ts`: inicializacion de cliente libsql + Drizzle
- `src/db/schema.ts`: schema Drizzle
- `src/db/SCHEMA.md`: explicacion del modelo e invariantes
- `src/BACKEND_STATUS.md`: inventario funcional real del backend

Migraciones:
- migraciones canonicas: `packages/server/drizzle/000*.sql`
- journal canonico: `packages/server/drizzle/meta/_journal.json`
- snapshots: `packages/server/drizzle/meta/*.json`

Locales no trackeados:
- `.env`
- `packages/server/sqlite.db`
- `packages/server/*.db-shm`
- `packages/server/*.db-wal`

## Comandos utiles

Desde la raiz del proyecto (usa `bun run` o `bunx`):

```bash
# Desarrollo
bun run dev              # Frontend en http://localhost:3000
bun run dev:server        # Backend en http://localhost:3001
bun run maildev           # Maildev en http://localhost:1080

# Build y preview
bun run build             # Build frontend
bun run preview           # Preview del build

# Base de datos
bun run db:generate       # Generar migraciones Drizzle
bun run db:migrate         # Aplicar migraciones

# Calidad
bun run test              # Tests
bun run lint              # Lint con Biome
bun run format            # Format con Biome
bun run check             # Check completo
```

Desde un package especifico:
```bash
bun run --filter=@tranzit/web dev
bun run --filter=@tranzit/server dev
cd packages/server && bunx tsc --noEmit
```

## Variables de entorno y entorno local

La configuracion de ejemplo esta en `.env.example`.

Puntos importantes:
- el backend carga `../.env` desde `packages/server/`, o sea, el `.env` de la raiz es la fuente principal usada por el codigo versionado.
- `packages/server/.env` puede existir localmente, pero el codigo actual no depende de ese archivo como fuente principal.
- `TURSO_DATABASE_URL=file:./sqlite.db` desde `packages/server/` apunta a `packages/server/sqlite.db`.
- el frontend corre en `http://localhost:3000`.
- el backend corre en `http://localhost:3001`.
- `vite.config.ts` hace proxy para `/api/auth` y `/api/rpc`.

Ojo con esto:
- `packages/server/src/features/auth/auth.config.ts` usa `BETTER_AUTH_URL` con default `http://localhost:3000`.
- `packages/server/src/lib/env.ts` usa `CORS_ORIGIN` con default `http://localhost:3000`.
- por eso conviene mantener `CORS_ORIGIN=http://localhost:3000` en `.env`.

Si agregas endpoints de dominio fuera de `/api/auth` y `/api/rpc`:
- agrega proxy en `vite.config.ts`, o
- usa URL explicita al backend desde el cliente.

## Contexto funcional que no esta codificado completo en el repo

Este es el comportamiento esperado del producto, aunque aun no este todo implementado:

Ciudadano:
- entra al portal,
- elige tramite,
- llena formulario inicial dinamico,
- valida correo por OTP,
- continua autenticado sin password,
- completa requisitos,
- descarga formatos/plantillas y lleva documentos en fisico,
- ve agenda en tiempo real,
- toma una reserva temporal,
- confirma la cita,
- puede ver estado, instrucciones y eventualmente cancelar o reprogramar.

Backoffice:
- gestiona tramites,
- gestiona formularios y requisitos,
- define horarios base y excepciones por fecha,
- administra auxiliares y capacidad,
- crea reservas administrativas recurrentes,
- reasigna citas,
- consulta auditoria y trazabilidad.

No metas complejidad que el producto no pidio todavia:
- no pagos,
- no OCR,
- no app movil nativa,
- no integraciones gubernamentales automaticas,
- no multisedes,
- no workflow documental avanzado.

## Regla de oro del dominio

La agenda es el centro del sistema. No conviertas esto en "solo un formulario con calendario".

Reglas operativas que debes proteger:
- no doble reserva del mismo cupo,
- no sobrecupo por auxiliar,
- hold temporal con expiracion,
- la disponibilidad visible debe ser consistente con la real,
- reservas administrativas consumen capacidad,
- cambios operativos deben poder auditarse,
- overrides de calendario deben prevalecer sobre horario base.

## Modelo de dominio actual

Lee primero `packages/server/src/db/SCHEMA.md`.

Resumen corto del modelo actual:

- `procedure_type` concentra definicion configurable del tramite en JSON.
- `service_request` representa el flujo del ciudadano.
- `schedule_template` y `calendar_override` definen la agenda base y sus excepciones.
- `appointment_slot` materializa slots reservables.
- `booking` unifica hold temporal, cita confirmada y reserva administrativa.
- `booking_series` guarda la regla de recurrencia de reservas administrativas.
- `staff_profile` y `staff_date_override` modelan auxiliares y excepciones operativas.
- `audit_event` y `notification_delivery` cubren trazabilidad y correo.

## Invariantes del esquema que no debes romper

Lee tambien `packages/server/src/db/SCHEMA.md` para el detalle. Los puntos mas delicados son estos:

- `booking` sigue siendo una tabla unica para hold ciudadano, cita y reserva administrativa. No la partas en varias tablas sin una razon muy fuerte.
- `service_request.activeBookingId` debe apuntar a la reserva/cita vigente.
- `booking.isActive` define si la fila sigue consumiendo capacidad o sigue siendo la reserva vigente.
- solo puede existir una `booking` ciudadana activa por `service_request`.
- si una reserva/cita deja de ser vigente por expiracion, cancelacion, atencion o reprogramacion, marca `isActive = false`.
- `procedure_type.configVersion` y `service_request.procedureConfigVersion` existen para anclar la configuracion efectiva.
- antes de confirmar o consolidar flujos importantes, persiste `service_request.procedureSnapshot`.
- `booking_series` es la fuente para recurrencias administrativas; no uses `seriesKey` como string libre.
- `staff_date_override.availableStartTime` y `availableEndTime` existen para disponibilidad parcial de un auxiliar en una fecha puntual.

## Estado real de auth

Backend hoy:
- Better Auth con plugins `admin()` y `emailOTP()`
- OTP configurable por env
- envio de correo via `packages/server/src/features/auth/auth.mailer.ts`

Frontend hoy:
- el flujo ciudadano (`/login` y `/agendar`) usa OTP por correo (`sendVerificationOtp` + `signIn.emailOtp`)
- el flujo interno admin mantiene login por email/password en `/admin/login`

Direccion correcta del producto:
- ciudadanos deberian entrar por OTP por correo, sin password,
- la "cuenta" debe ser transparente,
- si mas adelante se conserva password auth, deberia quedar claramente separada para staff/admin.

Recomendacion para agentes futuros:
- no expandas el flujo ciudadano password-based como si fuera final,
- cuando implementes el flujo real, alinea la UI con OTP,
- si necesitas dos experiencias de auth, separa ciudadano vs interno de forma explicita.

## Estado real de frontend

La app está conectada de forma funcional en admin y en un primer alcance ciudadano.

Puntos concretos:
- `src/routes/login.tsx` usa OTP ciudadano real.
- `src/routes/agendar.tsx` usa procedimientos + disponibilidad + hold/confirm real via backend.
- `src/routes/mi-perfil.tsx` muestra citas reales del ciudadano y cancelación real.
- `src/routes/index.tsx` y `src/routes/__root.tsx` ya tienen un lenguaje visual definido. Si editas UI, intenta preservar esa direccion y no volver a un layout generico.

Si vas a implementar algo real:
- evita meter mas estado local hardcodeado,
- extrae componentes o integra APIs segun haga falta,
- no edites `src/routeTree.gen.ts` manualmente.

## Estado real de backend

Hoy el backend ya expone:
- `GET /`, `/api/auth/*` (Better Auth + OTP),
- `/api/rpc/*` como superficie principal para:
  - admin (session, onboarding, schedule, staff, bookings, reservation-series y reservations),
  - citizen (procedures list, slots range, bookings hold/confirm/cancel/mine).

Nota:
- `/api/admin/*` ya no se expone como API publica ni como capa interna del runtime; la capa administrativa corre en handlers oRPC nativos.

Ajustes operativos recientes en citizen:
- `citizen.slots.range` valida `dateFrom` como fecha calendario real (no solo regex `YYYY-MM-DD`).
- `citizen.bookings.hold` recorta y valida identidad requerida (`applicantName`, `applicantDocument`) para rechazar valores solo con espacios.

El detalle endpoint por endpoint vive en `packages/server/src/BACKEND_STATUS.md`.

Lo que todavia no esta completo:
- APIs ciudadanas avanzadas de `service_request` (beyond hold/confirm base),
- robustecer validaciones operativas de requisitos físicos en flujo ciudadano,
- instrumentacion de auditoria/notificaciones mas completa para flujo ciudadano.

Si vas a construir esa parte:
- manten la logica critica en backend,
- no pongas la autoridad de disponibilidad en frontend,
- diseña APIs alrededor del dominio, no solo CRUD generico.

Cuando cambies rutas o servicios backend:
- actualiza `packages/server/src/BACKEND_STATUS.md` en el mismo cambio.

### Brecha de conexion frontend-backend (estado operativo)

Admin conectado hoy en frontend:
- onboarding (`admin.onboarding.status`, `admin.onboarding.bootstrap`),
- staff basico (`list/create/update/remove`),
- bookings base (`list/create/reassignmentsPreview/reassignmentsApply`),
- procedures (`list/get/create/update/remove`),
- schedule slots list (`admin.schedule.slots.list`).
- validaciones de formularios admin alineadas en frontend con backend para casos críticos:
  - creación de trámite con `trim`/slug sanitizado,
  - creación de encargado con `trim`/email normalizado,
  - reasignación masiva limitada a 100 items por operación (límite backend).

Admin avanzado conectado con UI funcional premium en frontend:
- `src/routes/admin/configuracion.tsx` y `src/routes/admin/configuracion/-AdminConfiguracionPage.tsx`:
  - `admin.schedule.templates.*` con formularios validados y diseño premium,
  - `admin.schedule.overrides.*` con validaciones en tiempo real,
  - `admin.schedule.slots.generate` con feedback visual,
  - `admin.staff.get` con selector mejorado,
  - `admin.staff.dateOverrides.*` con validaciones de horarios (HH:MM),
  - `admin.staff.effectiveAvailability` con visualización mejorada.
  - Características UX: notificaciones toast, confirmaciones modales, estados empty elegantes,
    skeletons de carga, badges de estado coloridos, tooltips en acciones, validaciones con @mantine/form.
- `src/routes/admin/reportes.tsx` y `src/routes/admin/reportes/-AdminReportesPage.tsx`:
  - `session.get` con display de usuario mejorado,
  - `admin.bookings.get/capacity/confirm/release/reassign/reassignPreview/availabilityCheck`
    con filtros avanzados y panel de acciones contextual,
  - `admin.reservationSeries.*` con creación validada y gestión completa,
  - `admin.reservations.*` para instancias individuales.
  - Características UX: filtros de citas con badges de estado, selección visual de items,
    formularios de series con validación RRULE, confirmaciones antes de acciones destructivas,
    estados de carga con skeletons, empty states ilustrativos.
- `src/routes/admin/auditoria.tsx` y `src/routes/admin/auditoria/-AdminAuditoriaPage.tsx`:
  - `admin.audit.list` con filtros por tipo de entidad, actor, acción y rango de fechas,
  - visualización de eventos de auditoría en tabla con paginación,
  - viewer colapsable de payload JSON para cada entrada,
  - badges de estado por tipo de acción y actor.

Ciudadano conectado hoy en frontend:
- `src/routes/login.tsx`:
  - OTP real (`/api/auth/email-otp/send-verification-otp` + `signIn.emailOtp`).
- `src/routes/agendar.tsx`:
  - `citizen.procedures.list`,
  - `citizen.slots.range`,
  - `citizen.bookings.hold`,
  - `citizen.bookings.confirm`,
  - `citizen.bookings.cancel`.
- `src/routes/mi-perfil.tsx`:
  - `citizen.bookings.mine`,
  - `citizen.bookings.cancel`.

Lo que aun falta para darlo por conectado de verdad:
- estandarizar manejo de concurrencia optimista (`If-Match`) e idempotency keys en acciones de series/instancias,
- cubrir estas superficies con pruebas de frontend y pruebas de integracion.

Siguientes pasos operativos prioritarios:
1. aplicar manejo consistente de concurrencia/idempotencia en todas las mutaciones criticas de reservas/series,
2. agregar pruebas automatizadas sobre admin conectado (frontend + integracion) para evitar regresiones.

Brecha ciudadana que sigue pendiente:
- API de ciclo de vida avanzado de `service_request` (estados y snapshots mas ricos),
- robustecer flujo ciudadano de requisitos fisicos con más validaciones operativas,
- robustecer pruebas automáticas para el flujo ciudadano conectado end-to-end.

## Workflow para cambios de schema

Cuando cambies el schema:

1. Actualiza `packages/server/src/db/schema.ts`.
2. Actualiza `packages/server/src/db/SCHEMA.md`.
3. Genera migracion con `bun run db:generate`.
4. Revisa el SQL generado.
5. Corre `bun run db:migrate`.
6. Corre `cd packages/server && bunx tsc --noEmit`.

No dejes cambios de schema sin documentar.

No asumas que Drizzle siempre genera SQL 100% portable para SQLite/libsql. Si algo falla:
- revisa primero el SQL generado,
- valida sobre una copia local de la BD,
- corrige la migracion de forma explicita si hace falta.

No resetees la base local por defecto.
Si el problema es de baseline local en `__drizzle_migrations`, arreglalo con cuidado en vez de borrar datos sin necesidad.

## Convenciones de codigo

- Usa commits con Conventional Commits.
- No commits `.env`, `packages/server/.env` ni `packages/server/sqlite.db`.
- Prefiere cambios pequenos y verificables.
- Mantén la solucion simple y operable.
- Si agregas reglas nuevas del dominio, documentalas aqui o en `packages/server/src/db/SCHEMA.md`.
- Si una decision afecta producto y no solo implementacion, deja el contexto por escrito.

## Si no sabes por donde empezar

Orden recomendado para cualquier cambio grande:
- lee `AGENTS.md`,
- lee `packages/server/src/db/SCHEMA.md`,
- inspecciona `packages/server/src/db/schema.ts`,
- revisa si el frontend actual es mock o real para esa pieza,
- decide si el cambio pertenece a UI, API, schema o a los cuatro,
- verifica al final con `bunx tsc --noEmit`, `bun run db:migrate` si aplica, y al menos un chequeo rapido de la ruta afectada.
