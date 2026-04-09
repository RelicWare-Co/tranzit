# AGENTS.md

## Proposito

Este repositorio implementa una plataforma de agendamiento para SIMUT Tulua.

El objetivo del producto es reemplazar un proceso manual por correo por un sistema con:
- portal ciudadano,
- autenticacion ligera por OTP,
- formularios dinamicos por tramite,
- carga documental,
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
- `server/src/db/SCHEMA.md`
- `server/src/db/schema.ts`

Notas importantes:
- `server/src/db/SCHEMA.md` explica por que el modelo esta simplificado como esta y que invariantes deben respetarse.
- `README.md` sigue siendo casi boilerplate de TanStack/Vite. No lo tomes como documentacion funcional del proyecto.
- Este `AGENTS.md` y `server/src/db/SCHEMA.md` son mas confiables que el `README.md`.

## Estado actual del proyecto

No asumas que el sistema ya esta completo. Hoy el repo esta en una fase intermedia:

- El frontend ya tiene landing, login, perfil y una experiencia visual de agendamiento.
- El backend ya tiene auth y esquema del dominio.
- El dominio de citas existe en BD, pero todavia casi no hay endpoints ni servicios reales de negocio.

Hoy hay varias piezas mock o incompletas:
- `src/routes/agendar.tsx` es mayormente UI/prototipo con estado local, `setTimeout` y flujo simulado.
- `src/routes/mi-perfil.tsx` usa citas mock en memoria.
- `src/routes/login.tsx` usa email/password tradicional.
- La direccion real del producto para ciudadano es OTP por correo sin password.

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
- `bunx tsc --noEmit` en `server/` es una verificacion importante

## Estructura importante del repo

Raiz:
- `package.json`: scripts del frontend y comandos generales
- `vite.config.ts`: proxy local para `/api/auth`
- `src/`: app frontend
- `server/`: backend, auth, schema y migraciones

Frontend:
- `src/main.tsx`: monta Mantine, AuthProvider y RouterProvider
- `src/lib/auth-client.ts`: cliente Better Auth del frontend
- `src/lib/AuthContext.tsx`: wrapper de sesion y login/logout para React
- `src/routes/`: rutas actuales
- `src/routeTree.gen.ts`: archivo generado, no lo edites manualmente

Backend:
- `server/src/index.ts`: entrypoint Hono
- `server/src/auth.ts`: configuracion Better Auth
- `server/src/mailer.ts`: envio de OTP por correo
- `server/src/db/schema.ts`: schema Drizzle
- `server/src/db/SCHEMA.md`: explicacion del modelo e invariantes

Migraciones:
- migraciones canonicas: `server/drizzle/000*.sql`
- journal canonico: `server/drizzle/meta/_journal.json`
- snapshots: `server/drizzle/meta/*.json`

Importante:
- existe un folder viejo tipo `server/drizzle/2026.../`. No lo tomes como la cadena canonica de migraciones.
- la cadena activa hoy es la que referencia `server/drizzle/meta/_journal.json`.

Locales no trackeados:
- `.env`
- `server/.env`
- `server/sqlite.db`

## Comandos utiles

Frontend:
- `bun run dev`
- `bun run build`
- `bun run preview`

Backend:
- `bun run dev:server`
- `bun run maildev`
- `cd server && bunx tsc --noEmit`
- `cd server && bun run db:generate`
- `cd server && bun run db:migrate`

Calidad:
- `bun run test`
- `bun run lint`
- `bun run format`
- `bun run check`

## Variables de entorno y entorno local

La configuracion de ejemplo esta en `.env.example`.

Puntos importantes:
- el backend carga `../.env` desde `server/`, o sea, el `.env` de la raiz es la fuente principal usada por el codigo versionado.
- `server/.env` puede existir localmente, pero el codigo actual no depende de ese archivo como fuente principal.
- `TURSO_DATABASE_URL=file:./sqlite.db` desde `server/` apunta a `server/sqlite.db`.
- el frontend corre en `http://localhost:3000`.
- el backend corre en `http://localhost:3001`.
- `vite.config.ts` hace proxy solo para `/api/auth`.

Ojo con esto:
- `server/src/auth.ts` usa `BETTER_AUTH_URL` con default `http://localhost:3000`.
- `server/src/index.ts` usa `CORS_ORIGIN` con default `http://localhost:3001`.
- ese default de CORS no coincide con el puerto del frontend.
- por eso conviene mantener `CORS_ORIGIN=http://localhost:3000` en `.env`.

Si agregas endpoints de dominio fuera de `/api/auth`:
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
- sube documentos o marca entrega fisica,
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

Lee primero `server/src/db/SCHEMA.md`.

Resumen corto del modelo actual:

- `procedure_type` concentra definicion configurable del tramite en JSON.
- `service_request` representa el flujo del ciudadano.
- `request_document` guarda entregas documentales con historial simple.
- `schedule_template` y `calendar_override` definen la agenda base y sus excepciones.
- `appointment_slot` materializa slots reservables.
- `booking` unifica hold temporal, cita confirmada y reserva administrativa.
- `booking_series` guarda la regla de recurrencia de reservas administrativas.
- `staff_profile` y `staff_date_override` modelan auxiliares y excepciones operativas.
- `audit_event` y `notification_delivery` cubren trazabilidad y correo.

## Invariantes del esquema que no debes romper

Lee tambien `server/src/db/SCHEMA.md` para el detalle. Los puntos mas delicados son estos:

- `booking` sigue siendo una tabla unica para hold ciudadano, cita y reserva administrativa. No la partas en varias tablas sin una razon muy fuerte.
- `service_request.activeBookingId` debe apuntar a la reserva/cita vigente.
- `booking.isActive` define si la fila sigue consumiendo capacidad o sigue siendo la reserva vigente.
- solo puede existir una `booking` ciudadana activa por `service_request`.
- si una reserva/cita deja de ser vigente por expiracion, cancelacion, atencion o reprogramacion, marca `isActive = false`.
- `procedure_type.configVersion` y `service_request.procedureConfigVersion` existen para anclar la configuracion efectiva.
- antes de confirmar o consolidar flujos importantes, persiste `service_request.procedureSnapshot`.
- `request_document` ya no es 1 archivo por requisito; usa `isCurrent` y `replacesDocumentId` en vez de sobrescribir.
- `booking_series` es la fuente para recurrencias administrativas; no uses `seriesKey` como string libre.
- `staff_date_override.availableStartTime` y `availableEndTime` existen para disponibilidad parcial de un auxiliar en una fecha puntual.

## Estado real de auth

Backend hoy:
- Better Auth con plugins `admin()` y `emailOTP()`
- OTP configurable por env
- envio de correo via `server/src/mailer.ts`

Frontend hoy:
- `AuthContext` usa `signIn.email` y `signUp.email`
- o sea, password auth clasica

Direccion correcta del producto:
- ciudadanos deberian entrar por OTP por correo, sin password,
- la "cuenta" debe ser transparente,
- si mas adelante se conserva password auth, deberia quedar claramente separada para staff/admin.

Recomendacion para agentes futuros:
- no expandas el flujo ciudadano password-based como si fuera final,
- cuando implementes el flujo real, alinea la UI con OTP,
- si necesitas dos experiencias de auth, separa ciudadano vs interno de forma explicita.

## Estado real de frontend

La app no esta conectada de punta a punta.

Puntos concretos:
- `src/routes/agendar.tsx` es una demo rica en UI, pero no consume disponibilidad real ni OTP real.
- `src/routes/mi-perfil.tsx` muestra citas mock.
- `src/routes/login.tsx` esta desacoplado del objetivo final ciudadano.
- `src/routes/index.tsx` y `src/routes/__root.tsx` ya tienen un lenguaje visual definido. Si editas UI, intenta preservar esa direccion y no volver a un layout generico.

Si vas a implementar algo real:
- evita meter mas estado local hardcodeado,
- extrae componentes o integra APIs segun haga falta,
- no edites `src/routeTree.gen.ts` manualmente.

## Estado real de backend

Hoy el backend expone muy poco:
- `GET /`
- `GET /session`
- `/api/auth/*`

No existe aun una capa completa para:
- service requests,
- documents,
- slots,
- bookings,
- assignment,
- admin backoffice.

Si vas a construir esa parte:
- manten la logica critica en backend,
- no pongas la autoridad de disponibilidad en frontend,
- diseña APIs alrededor del dominio, no solo CRUD generico.

## Workflow para cambios de schema

Cuando cambies el schema:

1. Actualiza `server/src/db/schema.ts`.
2. Actualiza `server/src/db/SCHEMA.md`.
3. Genera migracion con `cd server && bun run db:generate`.
4. Revisa el SQL generado.
5. Corre `cd server && bun run db:migrate`.
6. Corre `cd server && bunx tsc --noEmit`.

No dejes cambios de schema sin documentar.

No asumas que Drizzle siempre genera SQL 100% portable para SQLite/libsql. Si algo falla:
- revisa primero el SQL generado,
- valida sobre una copia local de la BD,
- corrige la migracion de forma explicita si hace falta.

No resetees la base local por defecto.
Si el problema es de baseline local en `__drizzle_migrations`, arreglalo con cuidado en vez de borrar datos sin necesidad.

## Convenciones de codigo

- Usa commits con Conventional Commits.
- No commits `.env`, `server/.env` ni `server/sqlite.db`.
- Prefiere cambios pequenos y verificables.
- Mantén la solucion simple y operable.
- Si agregas reglas nuevas del dominio, documentalas aqui o en `server/src/db/SCHEMA.md`.
- Si una decision afecta producto y no solo implementacion, deja el contexto por escrito.

## Si no sabes por donde empezar

Orden recomendado para cualquier cambio grande:
- lee `AGENTS.md`,
- lee `server/src/db/SCHEMA.md`,
- inspecciona `server/src/db/schema.ts`,
- revisa si el frontend actual es mock o real para esa pieza,
- decide si el cambio pertenece a UI, API, schema o a los cuatro,
- verifica al final con `bunx tsc --noEmit`, `bun run db:migrate` si aplica, y al menos un chequeo rapido de la ruta afectada.
